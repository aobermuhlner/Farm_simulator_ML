"""Training one configuration, and measuring it on the roles the pool declares.

The training loss is measured over the fitted images and the validation loss over the
held-out ones, both in evaluation mode after the epoch's updates — so the two curves a
student reads differ because of what the model saw, not because dropout was on for one
of them and off for the other. Accuracy is measured in the same pass and on the same
images, because the replay shows it climbing beside the loss and a number measured
somewhere else would be a different model's.

No held-out image reaches the optimizer. That is the whole reason the role exists, and
it is the one thing in here worth checking twice.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

import numpy as np
import torch
from torch import nn

from .declaration import Declaration
from .images import DecodedSplit, as_batch
from .knobs import (
    AUGMENTATION,
    BATCH_SIZE,
    DROPOUT_KNOB,
    EPOCHS,
    LEARNING_RATE,
    LOSS,
    OPTIMIZER,
    REGULARIZATION_KNOB,
    weight_decay_for,
)
from .model import Architecture, build_model
from .pool import Pool


def format_value(value: float | int | str) -> str:
    """A knob value as `configId.ts` writes it: `String(value)` for numbers."""
    if isinstance(value, bool):  # pragma: no cover - no boolean knobs are declared
        raise TypeError("boolean knob values have no declared identifier form")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def configuration_id(declaration: Declaration, knobs: dict[str, float | int | str]) -> str:
    """The identifier a configuration resolves to, in the declared knob order."""
    return "-".join(f"{knob.id}{format_value(knobs[knob.id])}" for knob in declaration.knobs)


@dataclass(frozen=True)
class Epoch:
    epoch: int
    train_loss: float
    val_loss: float
    #: Share of images whose highest-probability category is the true one, in 0..1.
    train_accuracy: float
    val_accuracy: float


@dataclass(frozen=True)
class RunResult:
    configuration_id: str
    knobs: dict[str, float | int | str]
    #: The dataset tier this run was fitted on, as its identifier carries it.
    tier: str
    epochs: int
    seed: int
    architecture: Architecture
    hyperparameters: dict[str, object]
    history: tuple[Epoch, ...]
    #: split -> image id -> probability per declared category, in declared order.
    predictions: dict[str, dict[str, list[float]]]


def _seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)


def _targets(
    pool: Pool, declaration: Declaration, tier: str, ids: tuple[str, ...]
) -> torch.Tensor:
    """What the model is taught: the label the tier files each image under.

    Deliberately not `pool.truth`. `specs/dataset-tiers/spec.md` — a model is fitted
    against its tier's labels and every outcome is scored against the manifest's truth,
    because a practitioner holding a cheaply labelled set has exactly those labels to fit
    to and nothing else. The two coincide for a checked tier and diverge for a hurried
    one, and that divergence is the whole of what a bought dataset teaches.
    """
    index = {category: position for position, category in enumerate(declaration.categories)}
    labels = [pool.tier_label(tier, image_id) for image_id in ids]
    unknown = [label for label in labels if label not in index]
    if unknown:
        raise ValueError(
            f'dataset tier "{tier}" files an image under "{unknown[0]}", '
            "which the task does not declare as a category"
        )
    return torch.tensor([index[label] for label in labels], dtype=torch.long)


def _tensor(pixels: np.ndarray) -> torch.Tensor:
    return torch.from_numpy(as_batch(pixels))


@torch.no_grad()
def _measure(
    model: nn.Module, criterion: nn.Module, pixels: torch.Tensor, targets: torch.Tensor
) -> tuple[float, float]:
    """Mean loss and accuracy over one set of images, from a single evaluation pass."""
    model.eval()
    total = 0.0
    hits = 0
    for start in range(0, len(targets), BATCH_SIZE):
        batch = pixels[start : start + BATCH_SIZE]
        labels = targets[start : start + BATCH_SIZE]
        outputs = model(batch)
        total += criterion(outputs, labels).item() * len(labels)
        hits += int((outputs.argmax(dim=1) == labels).sum().item())
    return total / len(targets), hits / len(targets)


@torch.no_grad()
def _distributions(model: nn.Module, pixels: torch.Tensor) -> np.ndarray:
    model.eval()
    outputs = []
    for start in range(0, len(pixels), BATCH_SIZE):
        outputs.append(torch.softmax(model(pixels[start : start + BATCH_SIZE]), dim=1))
    return torch.cat(outputs).numpy()


def train_configuration(
    declaration: Declaration,
    pool: Pool,
    decoded: dict[str, DecodedSplit],
    knobs: dict[str, float | int | str],
    seed: int,
    epochs: int = EPOCHS,
) -> RunResult:
    """Trains one configuration and evaluates it over the whole pool."""
    _seed_everything(seed)

    tier = str(knobs[declaration.dataset_knob])
    if tier not in declaration.datasets:
        raise ValueError(f'the task declares no dataset tier "{tier}"')

    blocks = int(knobs[declaration.blocks_knob])
    channels = int(knobs[declaration.channels_knob])
    dropout = float(knobs[DROPOUT_KNOB])
    decay = weight_decay_for(knobs[REGULARIZATION_KNOB])

    model, architecture = build_model(declaration, blocks=blocks, base_channels=channels, dropout=dropout)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, weight_decay=decay)

    # Both roles restricted to the tier this run is fitted on. The restriction is what
    # makes each tier's yardstick its own: a larger tier is judged against a larger
    # held-out set drawn from the same distribution, rather than against a fixed one.
    fitted_ids = tuple(pool.tier_role(tier, "fitted"))
    held_out_ids = tuple(pool.tier_role(tier, "heldOut"))
    for role, ids in (("fitted", fitted_ids), ("heldOut", held_out_ids)):
        if not ids:
            raise ValueError(f'dataset tier "{tier}" holds no image in role "{role}"')

    training = decoded["training"]
    position = {image_id: index for index, image_id in enumerate(training.ids)}
    fitted = np.array([position[image_id] for image_id in fitted_ids])
    held_out = np.array([position[image_id] for image_id in held_out_ids])

    fitted_pixels = _tensor(training.pixels[fitted])
    fitted_targets = _targets(pool, declaration, tier, fitted_ids)
    held_out_pixels = _tensor(training.pixels[held_out])
    held_out_targets = _targets(pool, declaration, tier, held_out_ids)

    generator = np.random.default_rng(seed)
    history: list[Epoch] = []

    for epoch in range(1, epochs + 1):
        model.train()
        order = generator.permutation(len(fitted_targets))
        for start in range(0, len(order), BATCH_SIZE):
            batch = order[start : start + BATCH_SIZE]
            optimizer.zero_grad()
            loss = criterion(model(fitted_pixels[batch]), fitted_targets[batch])
            loss.backward()
            optimizer.step()

        train_loss, train_accuracy = _measure(model, criterion, fitted_pixels, fitted_targets)
        val_loss, val_accuracy = _measure(model, criterion, held_out_pixels, held_out_targets)
        history.append(
            Epoch(
                epoch=epoch,
                train_loss=train_loss,
                val_loss=val_loss,
                train_accuracy=train_accuracy,
                val_accuracy=val_accuracy,
            )
        )

    # The training split is predicted over this tier's images alone. A configuration
    # fitted on the smallest tier of a large split would otherwise carry distributions
    # for photographs its student cannot browse and its workshop never reports on.
    held = set(pool.tier_images(tier))
    predictions: dict[str, dict[str, list[float]]] = {}
    for split, images in decoded.items():
        probabilities = _distributions(model, _tensor(images.pixels))
        predictions[split] = {
            image_id: [float(value) for value in row]
            for image_id, row in zip(images.ids, probabilities)
            if split != "training" or image_id in held
        }

    return RunResult(
        configuration_id=configuration_id(declaration, knobs),
        knobs=dict(knobs),
        tier=tier,
        epochs=epochs,
        seed=seed,
        architecture=architecture,
        hyperparameters={
            "optimizer": OPTIMIZER,
            "learningRate": LEARNING_RATE,
            "batchSize": BATCH_SIZE,
            "loss": LOSS,
            "weightDecay": decay,
            "dropout": dropout,
            "augmentation": AUGMENTATION,
            "pixelScale": 255.0,
            "torch": torch.__version__,
            "threads": torch.get_num_threads(),
        },
        history=tuple(history),
        predictions=predictions,
    )

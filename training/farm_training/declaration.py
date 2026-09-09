"""The task declaration, read rather than restated.

The trainer takes its categories, its knob values and its input resolution from
`declarations/<task>.json`, because a second copy of them here could disagree with the
one the app validates — and a trained artifact describing a model the app no longer
offers is exactly the silent wrongness this pipeline exists to avoid.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .paths import REPO_ROOT


class DeclarationError(RuntimeError):
    """A declaration the trainer cannot build a model from."""


@dataclass(frozen=True)
class Knob:
    id: str
    kind: str
    values: tuple[float | int | str, ...]
    default: float | int | str


@dataclass(frozen=True)
class Declaration:
    id: str
    schema_version: str
    pool: str
    #: The model family these runs belong to. Recorded in every artifact so that a
    #: configuration identifier can never be resolved against the wrong family.
    family_id: str
    predictions: str
    categories: tuple[str, ...]
    knobs: tuple[Knob, ...]
    input_size: int
    #: Which knob sets depth and which sets width — named by the declaration, not assumed.
    blocks_knob: str
    channels_knob: str
    #: Which knob selects the dataset this family is fitted on. Named, never inferred.
    dataset_knob: str
    #: The dataset tiers the task declares, smallest first.
    datasets: tuple[str, ...]

    def knob(self, knob_id: str) -> Knob:
        for knob in self.knobs:
            if knob.id == knob_id:
                return knob
        raise DeclarationError(f'the task declares no knob "{knob_id}"')

    @property
    def defaults(self) -> dict[str, float | int | str]:
        """The configuration a student is first offered."""
        return {knob.id: knob.default for knob in self.knobs}

    def pool_dir(self) -> Path:
        return REPO_ROOT / self.pool

    def predictions_dir(self) -> Path:
        return REPO_ROOT / self.predictions


def _slider_values(knob: dict) -> tuple[float | int, ...]:
    """A slider's permitted values, enumerated from its declared bounds and step."""
    minimum, maximum, step = knob["min"], knob["max"], knob["step"]
    if step <= 0:
        raise DeclarationError(f'knob "{knob["id"]}" declares a step of {step}')
    values: list[float | int] = []
    value = minimum
    while value <= maximum + 1e-9:
        values.append(round(value, 6) if isinstance(step, float) else value)
        value += step
    return tuple(values)


def load_declaration(task_id: str) -> Declaration:
    path = REPO_ROOT / "declarations" / f"{task_id}.json"
    if not path.is_file():
        raise DeclarationError(f"no declaration at {path}")
    raw = json.loads(path.read_text(encoding="utf8"))

    # The family this trainer builds: the one that ships predictions and draws a
    # convolutional stack. Found rather than assumed to be the first, because a task
    # declares several families and only this one has weights to fit.
    families = [
        family
        for family in raw.get("families", [])
        if family.get("ships") == "predictions"
        and (family.get("diagram") or {}).get("kind") == "cnn"
    ]
    if len(families) != 1:
        raise DeclarationError(
            f'task "{task_id}" declares {len(families)} convolutional prediction-shipping '
            "families; this trainer builds exactly one"
        )
    family = families[0]
    diagram = family["diagram"]

    knobs = tuple(
        Knob(
            id=knob["id"],
            kind=knob["kind"],
            values=tuple(knob["values"]) if knob["kind"] == "choice" else _slider_values(knob),
            default=knob["default"],
        )
        for knob in family["knobs"]
    )

    datasets = tuple(tier["id"] for tier in raw["datasets"])
    dataset_knob = family["datasetKnob"]
    if dataset_knob not in {knob.id for knob in knobs}:
        raise DeclarationError(
            f'model family "{family["id"]}" selects its photographs with knob '
            f'"{dataset_knob}", which it does not declare'
        )

    return Declaration(
        id=raw["id"],
        schema_version=raw["schemaVersion"],
        pool=raw["pool"],
        family_id=family["id"],
        predictions=family["predictions"],
        categories=tuple(category["id"] for category in raw["categories"]),
        knobs=knobs,
        input_size=diagram["inputSize"],
        blocks_knob=diagram["blocksKnob"],
        channels_knob=diagram["channelsKnob"],
        dataset_knob=dataset_knob,
        datasets=datasets,
    )

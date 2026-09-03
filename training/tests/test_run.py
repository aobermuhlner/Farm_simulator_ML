"""A run is repeatable, measured on the declared roles, and fits nothing held out."""

from __future__ import annotations

import numpy as np
import pytest

from farm_training.declaration import load_declaration
from farm_training.images import decode_pool
from farm_training.knobs import WEIGHT_DECAY, weight_decay_for
from farm_training.pool import load_pool
from farm_training.run import configuration_id, train_configuration

SHORT_RUN = 2


@pytest.fixture(scope="module")
def declaration():
    return load_declaration("apple-harvest")


@pytest.fixture(scope="module")
def pool(declaration):
    return load_pool(declaration.pool_dir())


@pytest.fixture(scope="module")
def decoded(pool):
    return decode_pool(pool)


@pytest.fixture(scope="module")
def knobs(declaration):
    return {**declaration.defaults, "blocks": 2, "channels": 8}


@pytest.fixture(scope="module")
def result(declaration, pool, decoded, knobs):
    return train_configuration(declaration, pool, decoded, knobs, seed=7, epochs=SHORT_RUN)


def test_the_identifier_matches_the_declared_knob_order(declaration, knobs):
    assert configuration_id(declaration, knobs) == "blocks2-channels8-regularization1-dropout0"


def test_epochs_are_contiguous_from_one(result):
    assert [entry.epoch for entry in result.history] == list(range(1, SHORT_RUN + 1))
    assert result.epochs == SHORT_RUN


def test_losses_are_measured_and_finite(result):
    for entry in result.history:
        assert np.isfinite(entry.train_loss)
        assert np.isfinite(entry.val_loss)
        assert entry.train_loss > 0


def test_accuracies_are_measured_as_shares(result):
    for entry in result.history:
        assert 0.0 <= entry.train_accuracy <= 1.0
        assert 0.0 <= entry.val_accuracy <= 1.0


def test_every_pool_image_gets_a_distribution(result, pool, declaration):
    for split, images in result.predictions.items():
        assert set(images) == set(pool.order[split])
        for image_id, distribution in images.items():
            assert len(distribution) == len(declaration.categories)
            assert all(0.0 <= value <= 1.0 for value in distribution)
            assert sum(distribution) == pytest.approx(1.0, abs=1e-5)


def test_held_out_images_sit_under_the_training_split(result, pool):
    for image_id in pool.roles["heldOut"]:
        assert image_id in result.predictions["training"]
    assert set(result.predictions) == {"training", "pool"}


def test_the_same_seed_reproduces_the_history(declaration, pool, decoded, knobs, result):
    again = train_configuration(declaration, pool, decoded, knobs, seed=7, epochs=SHORT_RUN)
    assert [(e.epoch, e.train_loss, e.val_loss, e.train_accuracy, e.val_accuracy) for e in again.history] == [
        (e.epoch, e.train_loss, e.val_loss, e.train_accuracy, e.val_accuracy) for e in result.history
    ]
    assert again.predictions == result.predictions


def test_no_held_out_image_reaches_the_optimizer(declaration, pool, decoded, knobs, result):
    # Same seed, same fitted images, but the held-out set replaced by copies of a fitted
    # one: if held-out images influenced the weights, the fitted losses would move.
    starved = type(pool)(
        directory=pool.directory,
        pool_id=pool.pool_id,
        schema_version=pool.schema_version,
        seed=pool.seed,
        atlases=pool.atlases,
        images=pool.images,
        order=pool.order,
        roles={"fitted": pool.roles["fitted"], "heldOut": [pool.roles["fitted"][0]]},
    )
    other = train_configuration(declaration, starved, decoded, knobs, seed=7, epochs=SHORT_RUN)
    assert [e.train_loss for e in other.history] == [e.train_loss for e in result.history]
    assert [e.val_loss for e in other.history] != [e.val_loss for e in result.history]


def test_the_run_records_what_it_depended_on(result, knobs):
    assert result.knobs == knobs
    assert result.seed == 7
    assert result.architecture.blocks == 2
    assert result.hyperparameters["optimizer"] == "adam"
    assert result.hyperparameters["weightDecay"] == weight_decay_for(knobs["regularization"])
    for field in ("learningRate", "batchSize", "loss", "augmentation", "pixelScale", "torch", "threads"):
        assert field in result.hyperparameters


def test_every_declared_regularization_value_has_a_weight_decay(declaration):
    for value in declaration.knob("regularization").values:
        assert weight_decay_for(value) == WEIGHT_DECAY[int(value)]
    with pytest.raises(KeyError):
        weight_decay_for(9)

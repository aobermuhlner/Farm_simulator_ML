"""Fitting against a tier's labels, and scoring against the manifest's truth.

`openspec/changes/dataset-tiers/specs/dataset-tiers/spec.md` — a model is fitted on the
labels the selected tier files its images under, while every figure reported as an outcome
is computed against the true category the manifest declares. The two coincide for the one
tier the pool authors today, so the divergence is exercised here against a doctored pool
whose tier labels deliberately disagree with its categories. That is the case the
mechanism exists for, and it has to be checked before the photographs that need it arrive.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from farm_training.declaration import load_declaration
from farm_training.images import decode_pool
from farm_training.pool import PoolError, load_pool
from farm_training.run import train_configuration

TASK = "apple-harvest"
TIER = "starter"
SHORT_RUN = 2


@pytest.fixture(scope="module")
def declaration():
    return load_declaration(TASK)


@pytest.fixture(scope="module")
def pool(declaration):
    return load_pool(declaration.pool_dir())


def pool_with(tmp_path: Path, source: Path, mutate) -> Path:
    """A copy of the committed pool with its manifest edited."""
    directory = tmp_path / "pool"
    shutil.copytree(source, directory)
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf8"))
    mutate(manifest)
    (directory / "manifest.json").write_text(json.dumps(manifest), encoding="utf8")
    return directory


class TestReadingTheTierColumns:
    def test_the_tier_yields_every_photograph_it_holds(self, pool, declaration):
        smallest = declaration.datasets[0]
        held = pool.tier_images(smallest)

        assert len(held) == 200
        assert held == pool.order["training"]
        # Both roles restricted to the tier, which is the tier's own yardstick.
        assert len(pool.tier_role(smallest, "fitted")) == 160
        assert len(pool.tier_role(smallest, "heldOut")) == 40

    def test_every_photograph_it_holds_carries_a_label_from_that_tier(self, pool):
        for image_id in pool.tier_images(TIER):
            assert pool.tier_label(TIER, image_id) in ("red", "green", "wormy")

    def test_the_labels_agree_with_the_truth_in_a_pool_that_authors_no_mislabels(self, pool):
        for image_id in pool.tier_images(TIER):
            assert pool.tier_label(TIER, image_id) == pool.truth(image_id)

    def test_a_tier_the_pool_holds_nothing_for_refuses_rather_than_fitting_on_nothing(
        self, pool, declaration
    ):
        # `bulk` and `checked` are declared, shown and explained, and have no photographs
        # behind them: asking to fit on one says so instead of fitting on an empty set.
        for tier in declaration.datasets[1:]:
            with pytest.raises(PoolError, match=tier):
                pool.tier_images(tier)

    def test_an_evaluation_image_carrying_a_tier_refuses(self, tmp_path, pool):
        def mutate(manifest):
            manifest["images"]["p-0001"]["tier"] = TIER
            manifest["images"]["p-0001"]["tierLabels"] = {TIER: "red"}

        with pytest.raises(PoolError, match="p-0001"):
            load_pool(pool_with(tmp_path, pool.directory, mutate))

    def test_a_training_image_with_no_tier_refuses(self, tmp_path, pool):
        def mutate(manifest):
            del manifest["images"]["t-001"]["tier"]

        with pytest.raises(PoolError, match="t-001"):
            load_pool(pool_with(tmp_path, pool.directory, mutate))


@pytest.fixture(scope="module")
def relabelled(tmp_path_factory, pool):
    """The committed pool with its one tier filing every red apple as green.

    Module-scoped and built once: it copies 3 MB of atlases, and nothing that reads it
    writes to it.
    """

    def mutate(manifest):
        for value in manifest["images"].values():
            labels = value.get("tierLabels")
            if labels is None:
                continue
            if labels[TIER] == "red":
                labels[TIER] = "green"

    return load_pool(pool_with(tmp_path_factory.mktemp("relabelled"), pool.directory, mutate))


class TestFittingFollowsTheLabels:
    """A pool whose tier files every red apple as green, and nothing else changed."""

    def test_the_doctored_pool_keeps_its_truth_and_moves_only_its_labels(self, relabelled):
        reds = [id for id in relabelled.tier_images(TIER) if relabelled.truth(id) == "red"]

        assert len(reds) == 100
        # The manifest's own category is untouched: it is the only ground truth there is,
        # and a tier label is not one.
        for image_id in reds:
            assert relabelled.truth(image_id) == "red"
            assert relabelled.tier_label(TIER, image_id) == "green"

    def test_the_loss_is_measured_against_the_labels_and_not_against_the_truth(
        self, declaration, pool, relabelled
    ):
        knobs = {**declaration.defaults, "blocks": 2, "channels": 8}
        decoded = decode_pool(pool)

        honest = train_configuration(declaration, pool, decoded, knobs, seed=7, epochs=SHORT_RUN)
        misled = train_configuration(
            declaration, relabelled, decoded, knobs, seed=7, epochs=SHORT_RUN
        )

        # Same seed, same architecture, same pixels: only the label column moved. A run
        # measured against the manifest's categories would have produced the same curve.
        assert [entry.train_loss for entry in misled.history] != [
            entry.train_loss for entry in honest.history
        ]

        # And it follows the labels rather than merely differing from the truth: a model
        # fitted on a set that calls every red apple green learns to call them green.
        fitted = relabelled.tier_role(TIER, "fitted")
        reds = [id for id in fitted if relabelled.truth(id) == "red"]
        order = list(declaration.categories)
        as_green = sum(
            1
            for image_id in reds
            if order[
                max(
                    range(len(order)),
                    key=lambda position: misled.predictions["training"][image_id][position],
                )
            ]
            == "green"
        )
        assert as_green > len(reds) / 2

    def test_the_run_records_the_tier_it_was_fitted_on(self, declaration, pool):
        knobs = {**declaration.defaults, "blocks": 2, "channels": 8}
        result = train_configuration(
            declaration, pool, decode_pool(pool), knobs, seed=7, epochs=1
        )

        assert result.tier == TIER
        assert result.configuration_id.endswith(f"-dataset{TIER}")

    def test_the_predictions_cover_the_tier_s_own_photographs(self, declaration, pool):
        knobs = {**declaration.defaults, "blocks": 2, "channels": 8}
        result = train_configuration(
            declaration, pool, decode_pool(pool), knobs, seed=7, epochs=1
        )

        assert set(result.predictions["training"]) == set(pool.tier_images(TIER))
        assert set(result.predictions["pool"]) == set(pool.order["pool"])

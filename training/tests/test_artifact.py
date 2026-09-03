"""What the writer stores, and what it refuses to store."""

from __future__ import annotations

import json

import pytest

from farm_training.artifact import (
    ArtifactError,
    Pipeline,
    configuration_file_name,
    write_artifact,
)
from farm_training.declaration import load_declaration
from farm_training.encode import DECIMALS, SUM_TOLERANCE, EncodingError, quantize
from farm_training.pool import load_pool
from farm_training.run import Epoch, RunResult
from farm_training.model import Architecture

PIPELINE = Pipeline(revision="0" * 40, dirty=False)


@pytest.fixture(scope="module")
def declaration():
    return load_declaration("apple-harvest")


@pytest.fixture(scope="module")
def pool(declaration):
    return load_pool(declaration.pool_dir())


def fake_result(pool, declaration, configuration_id="blocks2-channels8-regularization1-dropout0"):
    """A run-shaped result over the real pool, so completeness is genuinely exercised."""
    uniform = [1 / len(declaration.categories)] * len(declaration.categories)
    return RunResult(
        configuration_id=configuration_id,
        knobs={"blocks": 2, "channels": 8, "regularization": 1, "dropout": 0},
        epochs=2,
        seed=7,
        architecture=Architecture(blocks=2, channels=(8, 16), spatial=(64, 32), parameters=1),
        hyperparameters={"optimizer": "adam"},
        history=(Epoch(1, 1.0, 1.1), Epoch(2, 0.9, 1.0)),
        predictions={
            split: {image_id: list(uniform) for image_id in ids} for split, ids in pool.order.items()
        },
    )


def test_writes_an_index_and_one_file_per_configuration(tmp_path, declaration, pool):
    write_artifact(declaration, pool, [fake_result(pool, declaration)], tmp_path, PIPELINE)

    index = json.loads((tmp_path / "index.json").read_text(encoding="utf8"))
    assert set(index["configurations"]) == {"blocks2-channels8-regularization1-dropout0"}
    assert index["pool"] == {
        "poolId": pool.pool_id,
        "schemaVersion": pool.schema_version,
        "seed": pool.seed,
    }
    assert index["encoding"]["decimals"] == DECIMALS
    assert index["encoding"]["sumTolerance"] >= SUM_TOLERANCE
    assert index["categories"] == list(declaration.categories)

    entry = index["configurations"]["blocks2-channels8-regularization1-dropout0"]
    assert entry["shaping"] == []
    assert entry["pipeline"] == {"revision": "0" * 40, "dirty": False}
    for field in ("knobs", "epochs", "seed", "hyperparameters", "architecture", "file"):
        assert field in entry

    document = json.loads((tmp_path / entry["file"]).read_text(encoding="utf8"))
    assert document["taskId"] == declaration.id
    assert document["configurationId"] == "blocks2-channels8-regularization1-dropout0"
    assert len(document["predictions"]["training"]) == 200
    assert len(document["predictions"]["pool"]) == 1000
    assert [epoch["epoch"] for epoch in document["history"]] == [1, 2]


def test_the_index_carries_no_predictions(tmp_path, declaration, pool):
    write_artifact(declaration, pool, [fake_result(pool, declaration)], tmp_path, PIPELINE)
    index_size = (tmp_path / "index.json").stat().st_size
    configuration_size = (tmp_path / "blocks2-channels8-regularization1-dropout0.json").stat().st_size
    assert index_size * 10 < configuration_size


def test_a_missing_image_refuses_naming_it(tmp_path, declaration, pool):
    result = fake_result(pool, declaration)
    del result.predictions["pool"]["p-0042"]
    with pytest.raises(ArtifactError, match="p-0042"):
        write_artifact(declaration, pool, [result], tmp_path, PIPELINE)
    assert not (tmp_path / "index.json").exists()


def test_an_image_the_manifest_does_not_declare_refuses(tmp_path, declaration, pool):
    result = fake_result(pool, declaration)
    result.predictions["pool"]["p-9999"] = [0.4, 0.3, 0.3]
    with pytest.raises(ArtifactError, match="p-9999"):
        write_artifact(declaration, pool, [result], tmp_path, PIPELINE)


def test_a_history_with_a_gap_refuses(tmp_path, declaration, pool):
    result = fake_result(pool, declaration)
    broken = RunResult(**{**result.__dict__, "history": (Epoch(1, 1.0, 1.0), Epoch(3, 0.9, 0.9))})
    with pytest.raises(ArtifactError, match="blocks2-channels8"):
        write_artifact(declaration, pool, [broken], tmp_path, PIPELINE)


def test_an_id_that_is_not_a_file_name_refuses():
    with pytest.raises(ArtifactError, match="path separator"):
        configuration_file_name("blocks2/channels8")
    with pytest.raises(ArtifactError, match="file name"):
        configuration_file_name(".hidden")


def test_ground_truth_is_never_written(tmp_path, declaration, pool):
    result = fake_result(pool, declaration)
    poisoned = RunResult(
        **{**result.__dict__, "hyperparameters": {"optimizer": "adam", "category": "red"}}
    )
    with pytest.raises(ArtifactError, match="category"):
        write_artifact(declaration, pool, [poisoned], tmp_path, PIPELINE)
    assert not (tmp_path / "index.json").exists()


def test_an_empty_artifact_refuses(tmp_path, declaration, pool):
    with pytest.raises(ArtifactError):
        write_artifact(declaration, pool, [], tmp_path, PIPELINE)


class TestQuantization:
    def kwargs(self, **overrides):
        return {"categories": 3, "configuration": "c", "image_id": "t-001", **overrides}

    def test_stored_values_sum_to_exactly_one(self):
        for values in ([0.3334, 0.3333, 0.3333], [0.9999, 0.00005, 0.00005], [0.5, 0.25, 0.25]):
            stored = quantize(list(values), **self.kwargs())
            assert sum(stored) == 1.0
            assert all(round(value, DECIMALS) == value for value in stored)

    def test_no_component_moves_by_more_than_a_quantum(self):
        values = [0.1235, 0.4567, 0.4198]
        stored = quantize(values, **self.kwargs())
        for original, encoded in zip(values, stored):
            assert abs(original - encoded) <= 10**-DECIMALS

    def test_the_wrong_number_of_values_refuses(self):
        with pytest.raises(EncodingError, match="t-001"):
            quantize([0.5, 0.5], **self.kwargs())

    def test_a_value_outside_the_unit_range_refuses(self):
        with pytest.raises(EncodingError, match="outside"):
            quantize([1.5, -0.5, 0.0], **self.kwargs())

    def test_values_that_are_not_a_distribution_refuse(self):
        with pytest.raises(EncodingError, match="sum"):
            quantize([0.2, 0.2, 0.2], **self.kwargs())


def test_the_output_directory_does_not_make_a_clean_tree_dirty(declaration):
    from farm_training.artifact import git_pipeline

    counted = git_pipeline()
    ignored = git_pipeline(output=declaration.predictions_dir())
    assert counted.revision == ignored.revision
    # The artifact being written is never evidence that the code producing it is unsaved.
    assert not (ignored.dirty and not counted.dirty)


def test_the_writer_alters_no_value_it_was_given(tmp_path, declaration, pool):
    """No hidden shaping: what is stored is the run's own numbers, quantized and nothing else."""
    result = fake_result(pool, declaration)
    produced = {
        "t-001": [0.7123, 0.2011, 0.0866],
        "t-002": [0.0004, 0.9993, 0.0003],
        "p-0001": [0.3336, 0.3332, 0.3332],
    }
    for image_id, values in produced.items():
        split = "training" if image_id.startswith("t-") else "pool"
        result.predictions[split][image_id] = list(values)

    write_artifact(declaration, pool, [result], tmp_path, PIPELINE)
    document = json.loads(
        (tmp_path / "blocks2-channels8-regularization1-dropout0.json").read_text(encoding="utf8")
    )

    for image_id, values in produced.items():
        split = "training" if image_id.startswith("t-") else "pool"
        assert document["predictions"][split][image_id] == quantize(
            list(values),
            categories=len(declaration.categories),
            configuration=result.configuration_id,
            image_id=image_id,
        )

"""The pool reader refuses rather than training on whatever resolved."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from farm_training.declaration import load_declaration
from farm_training.pool import ROLES, SPLITS, PoolError, load_pool

TASK = "apple-harvest"


@pytest.fixture(scope="session")
def declaration():
    return load_declaration(TASK)


@pytest.fixture(scope="session")
def pool(declaration):
    return load_pool(declaration.pool_dir())


def broken_pool(tmp_path: Path, source: Path, mutate) -> Path:
    """A copy of the committed pool with one thing wrong with it."""
    directory = tmp_path / "pool"
    shutil.copytree(source, directory)
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf8"))
    mutate(manifest)
    (directory / "manifest.json").write_text(json.dumps(manifest), encoding="utf8")
    return directory


def test_reads_the_committed_pool(pool, declaration):
    assert pool.pool_id == declaration.pool
    assert pool.schema_version == declaration.schema_version
    assert len(pool.images) == 1200
    assert len(pool.order["training"]) == 200
    assert len(pool.order["pool"]) == 1000


def test_roles_partition_the_training_split(pool):
    fitted, held_out = pool.roles["fitted"], pool.roles["heldOut"]
    assert len(fitted) + len(held_out) == 200
    assert not set(fitted) & set(held_out)
    assert len(held_out) < len(fitted)
    for image_id in fitted + held_out:
        assert pool.images[image_id].split == "training"


def test_every_category_is_in_both_roles(pool, declaration):
    for role in ROLES:
        present = {pool.images[image_id].category for image_id in pool.roles[role]}
        assert present == set(declaration.categories)


def test_regions_follow_the_declared_atlas_geometry(pool):
    for image_id, image in pool.images.items():
        atlas = pool.atlases[image.atlas]
        region = pool.region_for(image_id)
        assert region.x == (image.cell % atlas.grid) * atlas.cell_size
        assert region.y == (image.cell // atlas.grid) * atlas.cell_size
        assert region.x + region.size <= atlas.width
        assert region.y + region.size <= atlas.height


def test_ground_truth_comes_from_the_manifest(pool, declaration):
    for image_id in pool.images:
        assert pool.truth(image_id) in declaration.categories


def test_a_cell_outside_its_atlas_refuses_naming_the_image(tmp_path, declaration):
    def mutate(manifest):
        manifest["images"]["p-0500"]["cell"] = 4096

    directory = broken_pool(tmp_path, declaration.pool_dir(), mutate)
    with pytest.raises(PoolError, match="p-0500"):
        load_pool(directory)


def test_an_unknown_atlas_refuses_naming_the_image(tmp_path, declaration):
    def mutate(manifest):
        manifest["images"]["t-007"]["atlas"] = "atlas-nowhere"

    directory = broken_pool(tmp_path, declaration.pool_dir(), mutate)
    with pytest.raises(PoolError, match="t-007"):
        load_pool(directory)


def test_a_missing_atlas_file_refuses_naming_it(tmp_path, declaration):
    directory = broken_pool(tmp_path, declaration.pool_dir(), lambda manifest: None)
    (directory / "atlas-pool-2.png").unlink()
    with pytest.raises(PoolError, match="atlas-pool-2"):
        load_pool(directory)


def test_a_training_image_without_a_role_refuses(tmp_path, declaration):
    def mutate(manifest):
        del manifest["images"]["t-004"]["role"]

    directory = broken_pool(tmp_path, declaration.pool_dir(), mutate)
    with pytest.raises(PoolError, match="t-004"):
        load_pool(directory)


def test_a_role_on_an_evaluation_image_refuses(tmp_path, declaration):
    def mutate(manifest):
        manifest["images"]["p-0300"]["role"] = "heldOut"

    directory = broken_pool(tmp_path, declaration.pool_dir(), mutate)
    with pytest.raises(PoolError, match="p-0300"):
        load_pool(directory)


def test_a_role_count_that_does_not_match_refuses(tmp_path, declaration):
    def mutate(manifest):
        manifest["splits"]["training"]["roles"]["heldOut"]["count"] = 7

    directory = broken_pool(tmp_path, declaration.pool_dir(), mutate)
    with pytest.raises(PoolError, match="heldOut"):
        load_pool(directory)


def test_a_third_split_refuses_naming_it(tmp_path, declaration):
    def mutate(manifest):
        manifest["splits"]["validation"] = {"count": 40}

    directory = broken_pool(tmp_path, declaration.pool_dir(), mutate)
    with pytest.raises(PoolError, match="validation"):
        load_pool(directory)


def test_the_declaration_reads_the_knobs_the_app_offers(declaration):
    assert declaration.categories == ("red", "green", "wormy")
    assert declaration.input_size == 128
    assert declaration.knob("channels").values == (8, 16, 32)
    assert declaration.knob("regularization").values == (0, 1, 2, 3)
    assert set(SPLITS) == {"training", "pool"}

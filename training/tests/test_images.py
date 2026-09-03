"""Every image's pixels come from the region its manifest entry declares."""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from farm_training.declaration import load_declaration
from farm_training.images import PIXEL_SCALE, as_batch, decode_pool
from farm_training.pool import load_pool


@pytest.fixture(scope="module")
def pool():
    return load_pool(load_declaration("apple-harvest").pool_dir())


@pytest.fixture(scope="module")
def decoded(pool):
    return decode_pool(pool)


def test_decodes_every_manifest_image_at_the_declared_size(decoded, pool):
    total = sum(len(split) for split in decoded.values())
    assert total == len(pool.images) == 1200
    for split, images in decoded.items():
        assert len(images) == len(pool.order[split])
        assert images.pixels.shape[1:] == (128, 128, 3)


def test_keeps_the_manifest_order(decoded, pool):
    for split, images in decoded.items():
        assert list(images.ids) == pool.order[split]


def test_each_cell_matches_a_direct_crop_of_its_atlas(decoded, pool):
    # Spot-checked against an independent crop rather than against the same slicing
    # code: the point is that the region rule agrees with the app's, not with itself.
    for split, sample in (("training", ("t-001", "t-100", "t-200")), ("pool", ("p-0001", "p-0777", "p-1000"))):
        images = decoded[split]
        for image_id in sample:
            entry = pool.images[image_id]
            atlas = pool.atlases[entry.atlas]
            with Image.open(pool.directory / atlas.file) as handle:
                whole = handle.convert("RGB")
                x = (entry.cell % atlas.grid) * atlas.cell_size
                y = (entry.cell // atlas.grid) * atlas.cell_size
                expected = np.asarray(whole.crop((x, y, x + atlas.cell_size, y + atlas.cell_size)))
            index = images.ids.index(image_id)
            assert np.array_equal(images.pixels[index], expected)


def test_two_images_of_different_categories_are_not_the_same_pixels(decoded, pool):
    training = decoded["training"]
    red = next(i for i, name in enumerate(training.ids) if pool.truth(name) == "red")
    green = next(i for i, name in enumerate(training.ids) if pool.truth(name) == "green")
    assert not np.array_equal(training.pixels[red], training.pixels[green])


def test_batches_are_channels_first_floats_in_the_unit_range(decoded):
    batch = as_batch(decoded["training"].pixels[:4])
    assert batch.shape == (4, 3, 128, 128)
    assert batch.dtype == np.float32
    assert batch.min() >= 0.0 and batch.max() <= 1.0
    assert PIXEL_SCALE == 255.0

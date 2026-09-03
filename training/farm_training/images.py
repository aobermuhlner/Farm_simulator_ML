"""Decoding the pool's atlases once, into memory.

Each atlas PNG is opened a single time and sliced into its cells, so a 40-epoch run
decodes 5 images rather than 48,000. Cells are kept as `uint8` and scaled to [0, 1] per
batch: the whole pool as float32 is ~236 MB against ~59 MB here, and the conversion is
free next to a convolution.

The scaling constant is exactly that — a constant. Nothing here is derived from the
data's own statistics, because a normalization fitted to the fitted images would make the
run depend on the role assignment in a way the artifact does not record.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image

from .pool import Pool

#: Pixels arrive as bytes and are scaled by this, and by nothing else.
PIXEL_SCALE = 255.0


@dataclass(frozen=True)
class DecodedSplit:
    """One split's images, in manifest order."""

    ids: tuple[str, ...]
    #: (N, size, size, 3) uint8 — RGB, alpha dropped.
    pixels: np.ndarray

    def __len__(self) -> int:
        return len(self.ids)


def decode_split(pool: Pool, split: str) -> DecodedSplit:
    """Every image of one split, cropped from the region its entry resolves to."""
    ids = tuple(pool.order[split])
    if not ids:
        return DecodedSplit(ids=(), pixels=np.empty((0, 0, 0, 3), dtype=np.uint8))

    atlases: dict[str, np.ndarray] = {}
    for atlas_id, atlas in pool.atlases.items():
        if atlas.split != split:
            continue
        with Image.open(pool.directory / atlas.file) as handle:
            atlases[atlas_id] = np.asarray(handle.convert("RGB"), dtype=np.uint8)

    size = pool.atlases[pool.images[ids[0]].atlas].cell_size
    pixels = np.empty((len(ids), size, size, 3), dtype=np.uint8)

    for index, image_id in enumerate(ids):
        image = pool.images[image_id]
        region = pool.region_for(image_id)
        cell = atlases[image.atlas][
            region.y : region.y + region.size, region.x : region.x + region.size
        ]
        pixels[index] = cell

    return DecodedSplit(ids=ids, pixels=pixels)


def decode_pool(pool: Pool) -> dict[str, DecodedSplit]:
    """Both splits, decoded once for the whole run."""
    return {split: decode_split(pool, split) for split in pool.order}


def as_batch(pixels: np.ndarray) -> np.ndarray:
    """Cells as float32 in [0, 1], channels-first, as the model expects them."""
    return np.ascontiguousarray(pixels.transpose(0, 3, 1, 2), dtype=np.float32) / PIXEL_SCALE

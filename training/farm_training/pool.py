"""Reading the image pool the way the app reads it.

`openspec/changes/prediction-artifacts/specs/prediction-artifacts/spec.md` — "Pixels are
read through the pool's declared delivery": an image's pixels come from the region its
manifest entry resolves to, by the same rule `src/pool/index.ts` applies, and an entry or
region that will not resolve refuses naming the image id.

The refusal is a preflight over the whole pool rather than an error raised when a broken
entry is finally reached. Training for two minutes and *then* discovering image 900 does
not resolve would leave a half-written artifact to clean up; checking all 1200 first means
"no artifact is written from a partially readable pool" holds by construction.

Ground truth stays here, in the manifest, and is never written into an artifact.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

#: The two splits, named as the prediction artifact names them.
SPLITS = ("training", "pool")

#: The roles a training image plays. Both live inside the training split.
ROLES = ("fitted", "heldOut")

_REQUIRED_IMAGE_FIELDS = ("split", "category", "atlas", "cell")
_REQUIRED_ATLAS_FIELDS = ("file", "split", "width", "height", "cellSize", "grid", "capacity")


class PoolError(RuntimeError):
    """A pool that cannot be read as declared. Always names what is wrong."""


@dataclass(frozen=True)
class Atlas:
    id: str
    file: str
    split: str
    width: int
    height: int
    cell_size: int
    grid: int
    capacity: int


@dataclass(frozen=True)
class Region:
    x: int
    y: int
    size: int


@dataclass(frozen=True)
class PoolImage:
    id: str
    split: str
    category: str
    atlas: str
    cell: int
    role: str | None
    #: The smallest dataset tier holding this image. Training images only.
    tier: str | None
    #: What each tier holding this image files it under. Training images only.
    #:
    #: A claim, not ground truth. `category` above stays the only truth in the system;
    #: this is what a dataset says, and a tier whose claim differs from it was labelled
    #: carelessly rather than lying. Labels do not nest, so there is one per holding tier.
    tier_labels: dict[str, str] | None


@dataclass(frozen=True)
class Pool:
    directory: Path
    pool_id: str
    schema_version: str
    seed: int
    atlases: dict[str, Atlas]
    images: dict[str, PoolImage]
    #: Image ids per split, in manifest order, which never varies.
    order: dict[str, list[str]]
    #: Training image ids per role, in the same order. Not a third split.
    roles: dict[str, list[str]]
    #: Training image ids each tier holds, in manifest order. Not a third split either.
    #:
    #: A tier holds an image when it files it under something, which is the nesting rule
    #: applied once: an image entering at one tier is filed by that tier and by every
    #: larger one the pool authors. A tier the pool holds no photographs for is absent
    #: rather than empty, because nothing in the manifest mentions it at all.
    tiers: dict[str, list[str]]

    def region_for(self, image_id: str) -> Region:
        """The pixel region an entry refers to — the rule `regionFor` applies."""
        image = self.images.get(image_id)
        if image is None:
            raise PoolError(f'image "{image_id}" is not declared by this pool')
        atlas = self.atlases.get(image.atlas)
        if atlas is None:
            raise PoolError(f'image "{image_id}" names atlas "{image.atlas}", which the pool does not declare')
        return Region(
            x=(image.cell % atlas.grid) * atlas.cell_size,
            y=(image.cell // atlas.grid) * atlas.cell_size,
            size=atlas.cell_size,
        )

    def truth(self, image_id: str) -> str:
        """The image's true category. The manifest is the only place this exists."""
        image = self.images.get(image_id)
        if image is None:
            raise PoolError(f'image "{image_id}" is not declared by this pool')
        return image.category

    def tier_label(self, tier: str, image_id: str) -> str:
        """What one tier files an image under — what a model fitted on it is taught.

        Never ground truth. `truth` above is what a harvest is scored against, and the two
        differ exactly when a dataset was labelled carelessly, which is the lesson a
        bought tier exists to teach.
        """
        image = self.images.get(image_id)
        if image is None:
            raise PoolError(f'image "{image_id}" is not declared by this pool')
        label = (image.tier_labels or {}).get(tier)
        if label is None:
            raise PoolError(f'dataset tier "{tier}" does not hold image "{image_id}"')
        return label

    def tier_images(self, tier: str) -> list[str]:
        """Every training image a tier holds, in manifest order."""
        held = self.tiers.get(tier)
        if held is None:
            raise PoolError(
                f'this pool holds no photographs for dataset tier "{tier}", '
                "so nothing can be fitted on it"
            )
        return list(held)

    def tier_role(self, tier: str, role: str) -> list[str]:
        """A tier's fitted or held-out images: the declared role restricted to the tier.

        Roles are declared once per image and independently of any tier, so a tier's
        yardstick grows with it — a larger tier is judged against a larger held-out set
        drawn from the same distribution rather than against a fixed one it would outrun.
        """
        if role not in ROLES:
            raise PoolError(f'"{role}" is not a declared training role')
        held = set(self.tier_images(tier))
        return [image_id for image_id in self.roles[role] if image_id in held]


def _require(mapping: dict, fields: tuple[str, ...], what: str) -> None:
    for field in fields:
        if field not in mapping:
            raise PoolError(f"{what} declares no {field}")


def _read_atlases(raw: dict) -> dict[str, Atlas]:
    atlases: dict[str, Atlas] = {}
    for atlas_id, value in raw.items():
        _require(value, _REQUIRED_ATLAS_FIELDS, f'atlas "{atlas_id}"')
        if value["split"] not in SPLITS:
            raise PoolError(f'atlas "{atlas_id}" serves split "{value["split"]}", which is not a declared split')
        if value["grid"] * value["cellSize"] != value["width"]:
            raise PoolError(
                f'atlas "{atlas_id}" declares a {value["grid"]}x{value["grid"]} grid of '
                f'{value["cellSize"]}px cells, which does not fill its {value["width"]}px width'
            )
        atlases[atlas_id] = Atlas(
            id=atlas_id,
            file=value["file"],
            split=value["split"],
            width=value["width"],
            height=value["height"],
            cell_size=value["cellSize"],
            grid=value["grid"],
            capacity=value["capacity"],
        )
    return atlases


def _read_image(image_id: str, value: dict, atlases: dict[str, Atlas]) -> PoolImage:
    _require(value, _REQUIRED_IMAGE_FIELDS, f'image "{image_id}"')

    split = value["split"]
    if split not in SPLITS:
        raise PoolError(f'image "{image_id}" belongs to split "{split}", which is not a declared split')

    role = value.get("role")
    if split == "training":
        if role is None:
            raise PoolError(f'training image "{image_id}" declares no role')
        if role not in ROLES:
            raise PoolError(f'training image "{image_id}" declares role "{role}", which is not a declared role')
    elif role is not None:
        raise PoolError(f'image "{image_id}" is in split "{split}" but declares training role "{role}"')

    tier = value.get("tier")
    tier_labels = value.get("tierLabels")
    if split == "training":
        if tier is None:
            raise PoolError(f'training image "{image_id}" declares no dataset tier')
        if not isinstance(tier_labels, dict) or not tier_labels:
            raise PoolError(f'training image "{image_id}" declares no label for the tiers that hold it')
        if tier not in tier_labels:
            raise PoolError(
                f'training image "{image_id}" enters at dataset tier "{tier}", which files it under nothing'
            )
        for named, label in tier_labels.items():
            if not isinstance(label, str) or label == "":
                raise PoolError(
                    f'training image "{image_id}" is filed by dataset tier "{named}" under nothing usable'
                )
    elif tier is not None or tier_labels is not None:
        # A tier on an evaluation image says a model was fitted on the harvest, which
        # would collapse the gap the two splits exist to teach.
        raise PoolError(
            f'image "{image_id}" is in split "{split}" but declares dataset tier "{tier}"; '
            "a tier is a portion of the training split alone"
        )

    if value["atlas"] not in atlases:
        raise PoolError(f'image "{image_id}" names atlas "{value["atlas"]}", which the pool does not declare')

    return PoolImage(
        id=image_id,
        split=split,
        category=value["category"],
        atlas=value["atlas"],
        cell=value["cell"],
        role=role,
        tier=tier,
        tier_labels=dict(tier_labels) if isinstance(tier_labels, dict) else None,
    )


def _check_counts(manifest: dict, pool: "Pool") -> None:
    splits = manifest["splits"]
    for split in SPLITS:
        declared = splits[split]["count"]
        present = len(pool.order[split])
        if declared != present:
            raise PoolError(f'split "{split}" declares {declared} images but {present} are described')

    declared_roles = splits["training"].get("roles")
    if declared_roles is None:
        raise PoolError("the training split declares no roles, so no validation loss can be attributed")
    for role in ROLES:
        declared = declared_roles[role]["count"]
        present = len(pool.roles[role])
        if declared != present:
            raise PoolError(f'role "{role}" declares {declared} images but {present} are assigned to it')
        if present == 0:
            raise PoolError(f'role "{role}" has no images')


def load_pool(directory: Path) -> Pool:
    """Reads a pool manifest and refuses anything it cannot resolve as declared."""
    manifest_path = directory / "manifest.json"
    if not manifest_path.is_file():
        raise PoolError(f"no manifest at {manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    _require(manifest, ("poolId", "schemaVersion", "seed", "splits", "atlases", "images"), "the pool manifest")

    declared_splits = set(manifest["splits"])
    unknown = declared_splits - set(SPLITS)
    if unknown:
        raise PoolError(f"the pool manifest declares split \"{sorted(unknown)[0]}\", which is not a declared split")

    atlases = _read_atlases(manifest["atlases"])
    images: dict[str, PoolImage] = {}
    order: dict[str, list[str]] = {split: [] for split in SPLITS}
    roles: dict[str, list[str]] = {role: [] for role in ROLES}
    tiers: dict[str, list[str]] = {}

    for image_id, value in manifest["images"].items():
        image = _read_image(image_id, value, atlases)
        images[image_id] = image
        order[image.split].append(image_id)
        if image.role is not None:
            roles[image.role].append(image_id)
        for tier in image.tier_labels or {}:
            tiers.setdefault(tier, []).append(image_id)

    pool = Pool(
        directory=directory,
        pool_id=manifest["poolId"],
        schema_version=manifest["schemaVersion"],
        seed=manifest["seed"],
        atlases=atlases,
        images=images,
        order=order,
        roles=roles,
        tiers=tiers,
    )
    _check_counts(manifest, pool)
    preflight(pool)
    return pool


def preflight(pool: Pool) -> None:
    """Resolves every image's region before anything is trained or written.

    Refuses naming the image id, so a pool that is readable for 900 images and not for
    the 901st stops the run rather than producing an artifact over whatever resolved.
    """
    for atlas in pool.atlases.values():
        path = pool.directory / atlas.file
        if not path.is_file():
            raise PoolError(f'atlas "{atlas.id}" names file "{atlas.file}", which is not present at {path}')

    for image_id, image in pool.images.items():
        atlas = pool.atlases[image.atlas]
        if atlas.split != image.split:
            raise PoolError(
                f'image "{image_id}" is in split "{image.split}" but its atlas "{atlas.id}" serves "{atlas.split}"'
            )
        if not isinstance(image.cell, int) or image.cell < 0 or image.cell >= atlas.capacity:
            raise PoolError(
                f'image "{image_id}" sits at cell {image.cell} of atlas "{atlas.id}", which holds {atlas.capacity} cells'
            )
        region = pool.region_for(image_id)
        if region.x + region.size > atlas.width or region.y + region.size > atlas.height:
            raise PoolError(
                f'image "{image_id}" resolves to a region at ({region.x}, {region.y}) of size {region.size}, '
                f"which does not fit inside atlas \"{atlas.id}\" at {atlas.width}x{atlas.height}"
            )

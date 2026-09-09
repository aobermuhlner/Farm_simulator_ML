"""Writing the prediction artifact: one index, one file per configuration.

`specs/prediction-artifacts/spec.md` — resolving one configuration must not transfer the
configurations a student did not choose, and must cost a bounded number of requests, so
coverage and provenance live in `index.json` and each configuration's predictions live in
a file of their own. Each file repeats the schema version, the task id and its own
configuration id, so a file fetched alone is self-identifying and an index that has
drifted from the files beside it refuses rather than mislabelling one run as another.

Two things this writer will not do. It will not write a true category, a predicted label
or a chosen action — ground truth stays in the pool manifest and the decision rule stays a
live computation. And it will not alter a value: shaping, if it is ever needed, is a
separate pass that records itself, so an artifact with no shaping step is readable as
measured.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .declaration import Declaration
from .encode import encoding_record, quantize
from .paths import REPO_ROOT
from .pool import Pool
from .run import RunResult, format_value

#: Field names that would turn a distribution into an answer. Never written.
FORBIDDEN_FIELDS = frozenset({"category", "truth", "label", "action", "prediction", "correct"})


class ArtifactError(RuntimeError):
    """An artifact that would be wrong to write."""


@dataclass(frozen=True)
class Pipeline:
    revision: str
    dirty: bool

    def as_record(self) -> dict:
        return {"revision": self.revision, "dirty": self.dirty}


def git_pipeline(repo_root: Path = REPO_ROOT, output: Path | None = None) -> Pipeline:
    """The revision a run was produced at, and whether the tree was dirty.

    Recorded rather than assumed: a reviewer repeating a run needs the code that made it,
    and a dirty tree means that code is not in history — which the ship gate refuses,
    while an authoring iteration is free to carry on.

    The artifact's own directory is excluded from that judgement. It is the output being
    produced: on a first run it is untracked and on a re-run it is modified, so counting
    it would make every run dirty and the flag would mean nothing.
    """

    def git(*args: str) -> str:
        return subprocess.run(
            ["git", *args], cwd=repo_root, capture_output=True, text=True, check=True
        ).stdout.strip()

    status = ["status", "--porcelain"]
    if output is not None:
        relative = output.resolve().relative_to(repo_root.resolve()).as_posix()
        status += ["--", ".", f":(exclude){relative}"]

    try:
        revision = git("rev-parse", "HEAD")
        dirty = git(*status) != ""
    except (OSError, subprocess.CalledProcessError) as cause:
        raise ArtifactError(f"cannot record the producing revision: {cause}") from cause
    return Pipeline(revision=revision, dirty=dirty)


def _refuse_forbidden_fields(document: object, where: str) -> None:
    if isinstance(document, dict):
        for key, value in document.items():
            if key in FORBIDDEN_FIELDS:
                raise ArtifactError(f'{where} carries field "{key}", which an artifact may not state')
            _refuse_forbidden_fields(value, f"{where}.{key}")
    elif isinstance(document, list):
        for item in document:
            _refuse_forbidden_fields(item, where)


def configuration_file_name(configuration_id: str) -> str:
    """The file one configuration is written to, refusing an id that is not a file name."""
    if configuration_id == "" or configuration_id.startswith("."):
        raise ArtifactError(f'configuration id "{configuration_id}" is not a usable file name')
    if "/" in configuration_id or "\\" in configuration_id:
        raise ArtifactError(f'configuration id "{configuration_id}" contains a path separator')
    return f"{configuration_id}.json"


def _predictions_document(
    declaration: Declaration,
    pool: Pool,
    result: RunResult,
) -> dict:
    categories = len(declaration.categories)
    predictions: dict[str, dict[str, list[float]]] = {}

    # A configuration covers its own tier's training images and the whole evaluation
    # pool — `specs/prediction-artifacts/spec.md`, which stops requiring a distribution
    # for a training image outside the tier once tiers exist.
    covered = {
        "training": pool.tier_images(result.tier),
        "pool": pool.order["pool"],
    }
    for split, ids in covered.items():
        produced = result.predictions.get(split, {})
        missing = [image_id for image_id in ids if image_id not in produced]
        if missing:
            raise ArtifactError(
                f'configuration "{result.configuration_id}" has no distribution for image "{missing[0]}"'
            )
        extra = set(produced) - set(ids)
        if extra:
            outside = sorted(extra & set(pool.order.get(split, ())))
            if outside:
                raise ArtifactError(
                    f'configuration "{result.configuration_id}" predicts image "{outside[0]}", '
                    f'which dataset tier "{result.tier}" does not hold'
                )
            raise ArtifactError(
                f'configuration "{result.configuration_id}" predicts image "{sorted(extra)[0]}", '
                "which the manifest does not declare"
            )
        predictions[split] = {
            image_id: quantize(
                produced[image_id],
                categories=categories,
                configuration=result.configuration_id,
                image_id=image_id,
            )
            for image_id in ids
        }

    if not result.history:
        raise ArtifactError(f'configuration "{result.configuration_id}" has no history')
    expected = list(range(1, len(result.history) + 1))
    if [entry.epoch for entry in result.history] != expected:
        raise ArtifactError(
            f'configuration "{result.configuration_id}" has a history that is not epochs '
            f"1 to {len(result.history)}"
        )

    return {
        "schemaVersion": declaration.schema_version,
        "taskId": declaration.id,
        "familyId": declaration.family_id,
        "configurationId": result.configuration_id,
        "history": [
            {
                "epoch": entry.epoch,
                "trainLoss": round(entry.train_loss, 6),
                "valLoss": round(entry.val_loss, 6),
                "trainAccuracy": round(entry.train_accuracy, 6),
                "valAccuracy": round(entry.val_accuracy, 6),
            }
            for entry in result.history
        ],
        "predictions": predictions,
    }


def _index_document(
    declaration: Declaration,
    pool: Pool,
    results: list[RunResult],
    pipeline: Pipeline,
) -> dict:
    configurations = {}
    for result in results:
        # The tier is recorded rather than left to be read off the identifier's spelling:
        # two configurations differing only in their tier are the comparison the tiers
        # exist to teach, and a reviewer holding the artifact should be able to say which
        # fitting set produced which curve.
        carried = format_value(result.knobs[declaration.dataset_knob])
        if carried != result.tier:
            raise ArtifactError(
                f'configuration "{result.configuration_id}" was fitted on dataset tier '
                f'"{result.tier}" but its identifier carries "{carried}"'
            )
        configurations[result.configuration_id] = {
            "file": configuration_file_name(result.configuration_id),
            "knobs": dict(result.knobs),
            "tier": result.tier,
            "epochs": result.epochs,
            "seed": result.seed,
            "pipeline": pipeline.as_record(),
            "hyperparameters": dict(result.hyperparameters),
            "architecture": result.architecture.as_record(),
            # No shaping step: these figures are as measured.
            "shaping": [],
        }

    return {
        "schemaVersion": declaration.schema_version,
        "taskId": declaration.id,
        "familyId": declaration.family_id,
        "categories": list(declaration.categories),
        "pool": {
            "poolId": pool.pool_id,
            "schemaVersion": pool.schema_version,
            "seed": pool.seed,
        },
        "encoding": encoding_record(len(declaration.categories)),
        "configurations": configurations,
    }


def write_artifact(
    declaration: Declaration,
    pool: Pool,
    results: list[RunResult],
    directory: Path | None = None,
    pipeline: Pipeline | None = None,
) -> Path:
    """Writes the index and one file per configuration, or writes nothing at all."""
    if not results:
        raise ArtifactError("an artifact must cover at least one configuration")

    seen = [result.configuration_id for result in results]
    if len(set(seen)) != len(seen):
        raise ArtifactError("two runs claim the same configuration id")

    target = directory if directory is not None else declaration.predictions_dir()
    pipeline = pipeline if pipeline is not None else git_pipeline(output=target)

    # Everything is built and checked before anything is written, so a refusal never
    # leaves half an artifact behind for the next reader to trip over.
    index = _index_document(declaration, pool, results, pipeline)
    documents = {
        result.configuration_id: _predictions_document(declaration, pool, result) for result in results
    }
    _refuse_forbidden_fields(index, "index.json")
    for configuration_id, document in documents.items():
        _refuse_forbidden_fields(document, configuration_file_name(configuration_id))

    target.mkdir(parents=True, exist_ok=True)
    for configuration_id, document in documents.items():
        path = target / configuration_file_name(configuration_id)
        path.write_text(json.dumps(document, separators=(",", ":")) + "\n", encoding="utf8")
    (target / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf8")
    return target

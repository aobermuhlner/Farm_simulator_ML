"""Where the trainer finds the repository it is authoring data for.

The training workspace is its own project, but everything it reads (the pool, the task
declaration) and everything it writes (the prediction artifact) lives in the repository
above it. Resolving that once, here, keeps every other module free of `..` arithmetic.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TRAINING_ROOT = REPO_ROOT / "training"

#: Per-run checkpoints and review plots. Authoring by-products, never shipped.
RUNS_DIR = TRAINING_ROOT / "runs"

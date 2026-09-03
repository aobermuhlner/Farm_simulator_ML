"""Train the configurations a task ships, and write the prediction artifact.

    uv run python -m farm_training.train

Defaults to the opening lesson: the smallest stack at every declared width, with the
regularization knobs at their declared defaults. Those are the three configurations a
student can select before anything is unlocked, which is what the artifact has to cover.

Nothing here shapes a number. If a run does not teach what it should, the response is to
change something the artifact records and run again.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from .artifact import write_artifact
from .declaration import load_declaration
from .images import decode_pool
from .knobs import EPOCHS, RUN_SEED
from .paths import RUNS_DIR
from .pool import load_pool
from .run import RunResult, train_configuration


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", default="apple-harvest")
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    parser.add_argument("--seed", type=int, default=RUN_SEED)
    parser.add_argument("--blocks", type=int, default=None, help="defaults to the declared default")
    parser.add_argument(
        "--channels",
        type=int,
        nargs="+",
        default=None,
        help="defaults to every declared width",
    )
    parser.add_argument("--out", type=Path, default=None, help="defaults to the declared path")
    return parser.parse_args(argv)


def write_review_plot(result: RunResult, directory: Path) -> Path | None:
    """A loss curve per run, for the review step. An authoring by-product, not shipped."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:  # pragma: no cover - the plot is a convenience, not a deliverable
        return None

    epochs = [entry.epoch for entry in result.history]
    figure, axes = plt.subplots(figsize=(5, 3.2))
    axes.plot(epochs, [entry.train_loss for entry in result.history], label="fitted")
    axes.plot(epochs, [entry.val_loss for entry in result.history], label="held out")
    axes.set_xlabel("epoch")
    axes.set_ylabel("loss")
    axes.set_title(result.configuration_id, fontsize=8)
    axes.legend()
    figure.tight_layout()

    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "loss.png"
    figure.savefig(path, dpi=120)
    plt.close(figure)
    return path


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    declaration = load_declaration(args.task)
    pool = load_pool(declaration.pool_dir())
    decoded = decode_pool(pool)

    blocks = args.blocks if args.blocks is not None else declaration.defaults[declaration.blocks_knob]
    widths = args.channels if args.channels is not None else declaration.knob(declaration.channels_knob).values

    results: list[RunResult] = []
    for width in widths:
        knobs = {**declaration.defaults, declaration.blocks_knob: blocks, declaration.channels_knob: width}
        started = time.perf_counter()
        result = train_configuration(declaration, pool, decoded, knobs, seed=args.seed, epochs=args.epochs)
        elapsed = time.perf_counter() - started
        results.append(result)

        last = result.history[-1]
        run_dir = RUNS_DIR / result.configuration_id
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "history.json").write_text(
            json.dumps(
                [
                    {"epoch": e.epoch, "trainLoss": e.train_loss, "valLoss": e.val_loss}
                    for e in result.history
                ],
                indent=2,
            ),
            encoding="utf8",
        )
        write_review_plot(result, run_dir)

        print(
            f"{result.configuration_id}  {result.architecture.parameters:>8,} params  "
            f"{elapsed:6.1f}s  train {last.train_loss:.4f}  val {last.val_loss:.4f}"
        )

    target = write_artifact(declaration, pool, results, args.out)
    print(f"wrote {len(results)} configurations to {target}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())

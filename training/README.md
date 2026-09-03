# Training workspace

Authoring tooling. Trains the models behind each task configuration and writes the
prediction artifacts the web app reads. **Nothing here ships** — the browser trains
nothing and never loads a checkpoint. It reads the JSON artifact this produces.

Kept as its own uv project rather than folded into the repo root, which is a Node
project: the two dependency trees have nothing to say to each other, and the web build
never needs a Python interpreter present.

## Setup

Managed by [uv](https://docs.astral.sh/uv/). The interpreter is pinned in
`.python-version` and uv installs it if it is missing — no system Python is used.

```sh
cd training
uv sync
```

`torch` resolves from PyTorch's CPU wheel index, pinned in `pyproject.toml`. The default
PyPI wheel bundles a CUDA runtime measured in gigabytes, for models that train in under
a minute on a laptop CPU.

Run anything through uv, so the pinned environment is the one that executes:

```sh
uv run python <script>
```

## Running it

```sh
uv run python -m farm_training.train
```

Trains what the opening lesson can select — the two-block stack at every declared width,
with the regularization knobs at their declared defaults — and writes the artifact to the
path `declarations/apple-harvest.json` names. `--epochs`, `--seed`, `--blocks`,
`--channels` and `--out` override; the defaults are the shipped run.

The artifact records the git revision it was produced at and whether the tree was dirty,
ignoring the artifact directory itself. The ship gate (`test/artifact-shipping.test.ts`)
refuses a dirty-tree artifact, so the order is: commit the pipeline, train, commit the
artifact.

## What it costs

Measured on this machine (8 CPU threads), 40 epochs over the 160 fitted images at batch
32, 128px input:

| blocks | channels | parameters | 40 epochs |
| --- | --- | --- | --- |
| 2 | 8 | 4,347 | ~24 s |
| 2 | 16 | 16,755 | ~43 s |
| 2 | 32 | 65,763 | ~113 s |

Roughly quadratic in width, so the deeper and wider corners of the full 108-configuration
grid cost more than the earlier depth-only measurements suggested. The first run is scoped
to three configurations for reviewability regardless: someone has to look at each curve
and decide it teaches what it should.

## What the first three runs showed

Reviewed 2026-09-03, against the committed artifact. Accuracy is the highest-probability
category, per population:

| | channels 8 | channels 16 | channels 32 |
| --- | --- | --- | --- |
| final fitted loss | 0.410 | 0.149 | 0.032 |
| final held-out loss | 0.408 | 0.140 | 0.024 |
| training worms | 0% | 100% | 100% |
| pool reds, in band | 100% | 99.5% | 100% |
| pool reds, out of band | 84% | 59% | 63% |
| pool worms, obvious | 30% | 65% | 63% |
| pool worms, subtle | 0% | 16% | 14% |

Three findings, all of which the game design has to live with:

1. **The held-out slice shows no gap.** Validation loss tracks training loss and sits
   slightly below it at every width, because the held-out 40 are drawn from the same
   authored band as the fitted 160 — unseen images of an entirely seen distribution. The
   generalization gap is between the training split and the evaluation pool (100% on
   training worms, 14% on the pool's subtle ones), and that is the harvest report's story,
   not the loss curve's. Whatever `training-simulation` says about the curves must not
   promise a gap they do not contain.
2. **Width alone does teach, at the bottom end.** channels 8 cannot see a worm at all —
   0% on the training worms it was fitted on — and its apparent 84% on out-of-band reds is
   the same failure wearing a good number: it calls almost everything red. Moving to 16 is
   the visible lesson: worms learned perfectly, unseen reds dropping to 59%.
3. **The top end teaches little.** channels 16 and 32 behave almost identically on every
   population. The third step of the width knob currently costs 70 s of training and shows
   a student nothing new.

No shaping was applied, and none is needed: the lesson lands in the harvest breakdown as
measured.

## What a run records

Per epoch: the loss over the fitted images and over the held-out ones, and the accuracy
over each — the share whose highest-probability category is the true one. The accuracies
are measured in the same evaluation pass as the losses, so the four figures of an epoch
describe one and the same model state. The web app replays them; nothing derives an
accuracy from a loss.

## Layout

- `farm_training/` — the pipeline: `pool` and `images` read the pool the way the app
  does, `model` builds the declared architecture, `run` trains and measures, `encode`
  and `artifact` write what ships, `knobs` holds every fixed choice a run records.
- `tests/` — `uv run pytest`. Refusals over doctored copies of the committed pool, and
  the determinism the artifact's provenance claims.
- `runs/<configuration-id>/` — per-run history and a loss-curve plot. Gitignored:
  authoring by-products, not deliverables.
- The shipped artifact is written to the `predictions` path the task declaration names,
  and is committed.

See `openspec/changes/prediction-artifacts/` for the contract this tooling has to meet.

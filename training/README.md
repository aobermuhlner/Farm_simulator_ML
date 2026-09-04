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

## What the three runs show

Reviewed 2026-09-04, against the committed artifact, on pool seed 20260904 — the pool
whose held-out 40 are drawn from the harvest's own populations. Every figure below is read
out of the committed histories and prediction files; nothing here was measured by a run of
its own.

The end of each run, from the recorded per-epoch history:

| | channels 8 | channels 16 | channels 32 |
| --- | --- | --- | --- |
| final fitted accuracy | 84.4% | 98.1% | 100.0% |
| final held-out accuracy | 80.0% | 80.0% | 80.0% |
| gap | 4.4 pp | 18.1 pp | 20.0 pp |
| final fitted loss | 0.374 | 0.077 | 0.035 |
| final held-out loss | 0.472 | 0.623 | 0.790 |

Accuracy is the highest-probability category, per population, over the committed
predictions:

| population | n | channels 8 | channels 16 | channels 32 |
| --- | --- | --- | --- | --- |
| fitted reds | 80 | 100% | 100% | 100% |
| fitted worms | 40 | 38% | 92% | 100% |
| held-out reds, in band | 8 | 100% | 100% | 100% |
| held-out reds, out of band | 12 | 83% | 83% | 83% |
| held-out worms, obvious | 6 | 67% | 67% | 67% |
| held-out worms, subtle | 4 | 0% | 0% | 0% |
| pool reds, in band | 200 | 99% | 99% | 99% |
| pool reds, out of band | 300 | 55% | 53% | 51% |
| pool worms, obvious | 150 | 58% | 64% | 66% |
| pool worms, subtle | 100 | 12% | 21% | 26% |
| pool greens | 250 | 100% | 100% | 100% |

Four findings:

1. **The held-out slice now shows the gap.** This supersedes the 2026-09-03 finding that
   it showed none — that was true, and it was the defect `held-out-generalization` set out
   to remove. The two loss curves start together and separate from roughly epoch 15: at
   channels 32 the fitted loss falls to 0.035 while the held-out loss *rises* to 0.790, and
   fitted accuracy reaches 100% against 80% held out. That is textbook overfitting, drawn
   on the screen the student reads before they spend a month. The proposal estimated ~74%
   held-out; the measured figure is 80%, so the gap is real and slightly narrower than
   estimated. What was measured is what is recorded — the pool was not reshaped to hit the
   estimate.
2. **The held-out headline is coarse, and flat across the three widths.** All three land on
   exactly 80% — 32 of 40 images — because 40 images give 2.5% granularity and the eight
   they miss are the same eight populations every time: two out-of-band reds, two obvious
   worms, all four subtle worms. The *loss* curve is what separates the widths, and it
   separates dramatically. A student reading accuracy alone at this scale learns less than
   one reading the curve; the report's per-category breakdown remains where the real story
   is told.
3. **Width alone does teach, at the bottom end.** channels 8 gets 38% of the worms it was
   fitted on, and its 55% on out-of-band pool reds is not a good number wearing a disguise
   any more than before: it is barely separating the categories at all. Moving to 16 is the
   visible lesson — fitted worms 38% to 92%, subtle pool worms 12% to 21%.
4. **The top end still teaches little on the harvest, but now teaches on the curve.**
   channels 16 and 32 differ by a few points on every pool population. What does separate
   them is the overfitting itself: 18.1 pp of gap against 20.0 pp, and a held-out loss of
   0.623 against 0.790. The third step of the width knob is still the most expensive to
   train, and now shows a student a steeper divergence rather than a different harvest.

No shaping was applied, and none is needed: the lesson lands in the loss curve and in the
harvest breakdown as measured.

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

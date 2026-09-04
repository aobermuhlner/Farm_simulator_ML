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
| 2 | 32 | 65,763 | ~108 s |

Roughly quadratic in width, so the deeper and wider corners of the full 108-configuration
grid cost more than the earlier depth-only measurements suggested. The first run is scoped
to three configurations for reviewability regardless: someone has to look at each curve
and decide it teaches what it should.

## What the three runs show

Reviewed 2026-09-04, against the committed artifact, on pool seed 855711213 — the pool
recoloured by `colour-accessibility`, whose red is a deep crimson and whose green is a
yellow-green, separated in lightness as well as in hue. Every figure below is read out of
the committed histories and prediction files; nothing here was measured by a run of its
own. The figures moved substantially against the 20260904 pool and the four findings are
rewritten rather than adjusted — see finding 3 for the one that reversed.

The end of each run, from the recorded per-epoch history:

| | channels 8 | channels 16 | channels 32 |
| --- | --- | --- | --- |
| final fitted accuracy | 99.4% | 100.0% | 100.0% |
| final held-out accuracy | 67.5% | 72.5% | 75.0% |
| gap | 31.9 pp | 27.5 pp | 25.0 pp |
| final fitted loss | 0.059 | 0.025 | 0.009 |
| final held-out loss | 0.738 | 0.922 | 1.024 |
| best held-out loss | 0.462 (epoch 20) | 0.453 (epoch 14) | 0.475 (epoch 14) |
| losses separate by 0.2 | epoch 25 | epoch 18 | epoch 11 |

Accuracy is the highest-probability category, per population, over the committed
predictions:

| population | n | channels 8 | channels 16 | channels 32 |
| --- | --- | --- | --- | --- |
| fitted reds | 80 | 100% | 100% | 100% |
| fitted worms | 40 | 98% | 100% | 100% |
| held-out reds, in band | 8 | 100% | 100% | 100% |
| held-out reds, out of band | 12 | 67% | 67% | 67% |
| held-out worms, obvious | 6 | 17% | 50% | 50% |
| held-out worms, subtle | 4 | 0% | 0% | 25% |
| pool reds, in band | 200 | 100% | 100% | 100% |
| pool reds, out of band | 300 | 78% | 76% | 78% |
| pool worms, obvious | 150 | 49% | 49% | 53% |
| pool worms, subtle | 100 | 9% | 12% | 23% |
| pool greens | 250 | 100% | 100% | 100% |

Four findings:

1. **The colour judgement got easy, as the palette change said it would.** Greens and
   in-band pool reds are at 100% everywhere, and out-of-band pool reds went from 51-55%
   on the old palette to 76-78%. `colour-accessibility/design.md` accepted this trade
   explicitly: separating the categories by lightness as well as by hue is what makes the
   task performable for a student with a red/green deficiency, and it makes red versus
   green easier for the model too. The cost is real — the out-of-band reds used to be
   half the evidence that a narrow fitted band does not generalize, and they now carry
   much less of it. What they still show is that the *fitted band* is what a model
   learns: 100% in band against 76-78% out of it, at every width.
2. **The worm is where the whole lesson now lives.** Every width gets the worms it was
   fitted on (98%, 100%, 100%) and none of them generalizes: obvious pool worms sit at
   49-53% and subtle ones at 9-23%. Subtle worms are the one population that still climbs
   with capacity — 9% to 12% to 23% — which is the over-regularization lesson intact and
   the only place the three widths differ by more than noise on the harvest. A student who
   reads earnings alone sees three similar months; the per-category breakdown is what
   shows them that the robot is trashing good apples or bagging wormy ones.
3. **The accuracy gap now *narrows* with width, and this reverses the previous finding.**
   On the 20260904 pool the gap grew with capacity — 4.4, 18.1, 20.0 pp. It now shrinks:
   31.9, 27.5, 25.0 pp. Nothing about overfitting changed direction; what changed is that
   the smallest model is no longer merely underfitting a hard colour problem, so all three
   reach ~100% fitted accuracy and the gap is set by held-out accuracy, which *improves*
   with width. The loss curve still tells the textbook story and tells it more sharply than
   before: held-out loss at the end rises with width (0.738, 0.922, 1.024), and the two
   curves separate earlier the wider the model is (epoch 25, 18, 11). This is recorded as
   measured. The pool was not reshaped until the old numbers came back.
4. **Every run overfits, and the curve says when.** All three reach their best held-out
   loss between epoch 14 and 20 and get worse for the remaining twenty-odd epochs, while
   fitted loss keeps falling to near zero. Forty epochs is past the useful point for every
   configuration the opening lesson can select — which is a thing the replay shows and the
   harvest cannot, and an argument for the workshop phase existing at all. Held-out
   accuracy is no longer flat across the widths (67.5%, 72.5%, 75.0%) as it was on the old
   pool, so the headline figure now separates them; the same four out-of-band reds are
   missed by all three, and the widths differ only in worms (9, 7 and 6 missed of 10).

No shaping was applied, and none is needed: the lesson lands in the loss curve and in the
harvest breakdown as measured.

### What the pool looks like

Looked at, not only measured. The training split was browsed in the app and the same
images were put through a full-severity deuteranopia and protanopia simulation.

Under normal vision the reds are crimson, the greens yellow-green, and the pale worm
coming out of its bite hole reads as a worm at every visibility the pool draws. Under both
simulated deficiencies the two categories separate by lightness exactly as the measurement
says they do: reds go dark olive under deuteranopia and near-black under protanopia, greens
go bright yellow in both, and no shadowed green is ever as light as a lit red. The worm
stays the lightest thing on the apple in every row, which is why the marking check asks
for one element rather than all of them — the bite hole disappears into the fruit under
both deficiencies and the pale body does not.

One thing the render shows that the numbers do not: at the far edge of the lower
out-of-band region, hues -30 and -26, an apple reads as a plum rather than as a red apple,
and the ground truth still calls it a ripe red apple. This is recorded rather than fixed —
see the note on the hue bands in `tools/pool/params.ts`.

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

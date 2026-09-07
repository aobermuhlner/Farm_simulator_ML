# Fitted tree

Rung 2 of `Game_design.md` §2. Depends on `decision-tree-builder` (rung 1, which sells the
node budget this change reuses), `measured-features` (the feature vectors it fits over) and
`model-families` (the family abstraction it registers through). `dataset-tiers` is *not* a
dependency: this change fits the starter set only — see What Changes.

## Why

This is where the game first says *the data can find a better threshold than you did* — and
immediately after, *and it will happily find one that only works on the photos it was
shown*. That is the cleanest introduction to the train/held-out gap available, and it lands
before any neural-network vocabulary is on screen, over a model the student can still read
end to end.

At rung 1 the student picked `darkSpotArea > 0.06` by eye. Here the same feature set is
swept exhaustively and comes back with 0.058 — a small, legible, checkable improvement over
their own guess. That is §2's floor made concrete: genuinely a bit better than the hand
tree, enough that the upgrade pays back within the year, and not so much better that the
afternoon spent writing the hand tree looks wasted.

A student who meets overfitting on a five-node tree meets it as a property of *fitting*,
not as a quirk of neural networks. Rung 4 then inherits a vocabulary the student already
owns.

## What Changes

- **A fitted-tree family, fitted offline and shipped as the tree.** The pipeline under
  `training/` fits the tree; the artifact carries the fitted tree's structure — a few dozen
  `(feature, threshold)` pairs — and the browser evaluates it over the manifest's measured
  features. Not per-image distributions: for a tree the model is smaller than its own
  predictions, and the structure has to ship regardless because §2 requires the tree to be
  drawable and a specific apple's path through it traceable. Shipping both would pay roughly
  forty times the bytes for the same behaviour.
- **BREAKING for `model-families`, as an upstream requirement.** That change currently plans
  two prediction sources, `artifact` and `live`. This one needs a third — ship the fitted
  model, evaluate in the browser — and the family interface has to return a configuration
  entry rather than a per-image distribution, because a per-image `predict` signature has
  nowhere to put the history the workshop needs. If `model-families` lands with only two
  sources and a per-image signature, this change is blocked.
- **Capacity is the node budget the student already bought, not a new depth knob.** Rung 1
  sells three splits and more for money; the same budget caps the fitted tree. One capacity
  currency across two adjacent rungs, rung 1's purchases keep paying rather than going
  obsolete, and the economy reads as one system. Coverage is therefore one-dimensional — one
  fitted tree per purchasable budget, four or five configurations in total.
- **The history is indexed by splits added, not epochs.** Fitting a tree is not iterative,
  so there is no epoch 7 of it. Growing best-first — each step taking the split that most
  reduces impurity — makes the tree at *k* splits a prefix of the tree at *k+1*, so the
  sequence is one tree growing rather than a series of unrelated fits. Measured at every
  step against the fitted and the held-out images, that is a genuine learning curve on the
  same axis as the knob: the gap opens as the budget is spent.
- **Loss is log loss over the leaf distributions**, which is the same quantity the
  convolutional runs record as cross-entropy. The two families' curves are then in the same
  units and a student moving up the ladder is reading the same chart.
- **Leaves carry a distribution over categories, never an action.** Rung 1's hand tree ends
  in actions the student chose; this one ends in how sure the data is, and the decision
  policy converts that into an action exactly as it does for the network. That keeps the
  decision rule a live computation, and it is a lesson rather than a compromise: *you told
  it what to do; the fitted tree tells you how sure it is, and the policy decides.*
- **The starter set only.** The tree fits the 200-image starter set on the 160 fitted / 40
  held-out roles the convolutional runs already use, so the two families' gaps are measured
  over the same populations and are comparable. The larger tiers are deliberately out of
  scope: today's pool is 200 training and 1 000 evaluation, so a 1 000-photo tier would have
  to be drawn from the evaluation pool — the model would be fitted on the harvest, and the
  gap this rung exists to show would collapse. Sourcing a larger fitting set needs a pool
  regeneration, which §11 says to batch with `heirloom-cultivars` and pay for once. Recorded
  here as `dataset-tiers`' decision, not worked around.
- **The gap is measured and recorded, not asserted.** The measured fitted-versus-held-out
  figures go into `training/README.md` beside the convolutional ones, node-indexed, and the
  ship gate refuses a shipped tree whose gap does not widen across the budgets it covers.
  §2 requires the plateau to be authored on purpose; this is that requirement applied one
  rung down.
- **The floor is measured against a declared reference tree.** §2's "genuinely a bit better
  than the one below" is unverifiable against a tree the student wrote, so the pipeline
  measures the fitted tree against a declared reference hand tree and records the margin. A
  margin outside the intended band is a finding to act on, not a number to ship quietly.
- **It reads features and nothing else.** The fitting step reads the manifest's measured
  feature vectors; it never opens an atlas and it cannot reach a generation attribute. What
  `measured-features` makes structurally impossible in the browser stays impossible in the
  pipeline.

## Capabilities

### New Capabilities
- `fitted-tree`: the family, the node budget as its capacity, the shipped-model artifact and
  what it must contain, the split-indexed growth history, leaves as distributions, and the
  measured gap and floor it is required to exhibit.

### Modified Capabilities
- `prediction-artifacts`: four requirements are written against a family that trains for a
  number of epochs and emits one distribution per image, and a shipped tree satisfies
  neither shape. *A shipped artifact is trained, and records what produced it* records an
  epoch count; *The training history is measured on the declared roles* requires one entry
  per epoch, contiguous; *A covered configuration is complete or refused* requires a stored
  distribution for every manifest image in both splits. A model artifact meets that last
  requirement's intent structurally — a tree evaluates every image by construction, so no
  run can silently shrink to the images that happened to be present — but it cannot meet its
  letter. *Pixels are read through the pool's declared delivery* also needs scoping: this
  pipeline reads no pixels, and its chain of custody to them runs through the feature
  measurement `measured-features` performs in the pool tools.

## Impact

A fitting step under `training/` (scikit-learn, best-first growth to a leaf budget) and its
recorded measurements in `training/README.md`; a shipped tree artifact and its reader; a
family declaration and catalog entries binding each purchasable node budget to a covered
configuration, which `progression-catalog`'s *Nothing for sale opens a configuration no
model was trained for* then checks unchanged; a tree evaluator in `src/families/` reading
`src/features/`. The convolutional artifacts are untouched and must resolve unchanged — a
test, not an intention. `web/src/screens/TrainingRun.tsx` renders the literal string
`epoch <n>`, which is one family's vocabulary hardcoded in a screen; the split-indexed
history makes that wrong on screen, so the label becomes declared data and §6.5's extension
of the `no-task-specific-code` invariant gains something to catch.

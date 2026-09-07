# Design

## Context

See `proposal.md` — Why, for the lesson this rung carries and the scope it is held to.

Five facts about the current shape decide the approach.

`web/src/model/run.ts` shows where the engine's boundary actually is: `runPool` takes a
`ConfigurationEntry` and scores it, and the decision policy, the payoff table and the report
never learn where the entry came from. Anything that can produce a `ConfigurationEntry` is
downstream-invisible, so the choice of prediction source is settled entirely by what has to
be shipped and who has to be trusted — not by how the report works.

`ConfigurationEntry` carries `history: TrainingEpoch[]`, and `TrainingEpoch` is
epoch-indexed. Fitting a tree is not iterative, so there is no epoch 7 of it; whatever this
family produces has to fit that field or the field has to move.

`"epoch": 1` is a literal key in the three shipped artifacts under
`artifacts/apple-harvest/predictions/`, and `"epochs": 40` a literal key in their index.
Renaming it on disk invalidates all three and forces a retrain — the thing the proposal says
must not happen.

`web/src/screens/TrainingRun.tsx:154` renders the literal string `` `epoch ${epochs}` ``.
That is one family's vocabulary written into a screen, and it becomes wrong on screen the
moment a second family has a differently-shaped history.

`prediction-artifacts` is written throughout for a family that trains for a number of epochs
and emits one distribution per image. Four of its requirements describe that shape closely
enough that a shipped tree cannot satisfy their letter, which is why the delta exists.

## Goals / Non-Goals

**Goals:**

- The tree that scores the harvest and the tree drawn on screen are one object, so they
  cannot drift apart.
- The workshop's fitted-versus-held-out figures for this family are measured over the same
  populations the convolutional runs use, in the same units, so the two rungs' charts are
  comparable rather than merely similar.
- The gap widening with capacity is a reviewed measurement recorded before the catalog is
  priced, not a hope confirmed in playtesting.
- The three shipped convolutional artifacts resolve byte-identically. This is a test.

**Non-Goals:**

- Fitting anything in the browser. Settled below, with the conditions that would reopen it.
- Larger dataset tiers. The starter set only; the collision is recorded, not solved.
- Rung 3's forest. It inherits most of this and is its own change.
- Changing the replay screen's animation. It replays a history it is given; it starts
  showing a tree growing because the history it is given describes one.

## Decisions

### Ship the fitted tree, not its predictions

The pipeline fits offline under `training/`; the artifact carries the tree's structure; the
browser evaluates it over the manifest's measured features.

For a network the weights are useless to the client, so predictions are what ship. For a
tree the model is *smaller than its own predictions* — a five-node tree is a handful of
`(feature, threshold)` pairs against 1 200 distributions — and the structure has to ship
regardless, because §2 requires the tree to be drawable and a specific apple's path through
it traceable. Shipping the distributions as well would pay roughly forty times the bytes for
behaviour the structure already determines, and would introduce the possibility of the two
disagreeing.

*Alternative considered — ship the per-image distributions, as the convolutional family
does.* Rejected for the reason above. It is the option `prediction-artifacts` supports
unchanged, which is a real advantage, but the redundancy is not defensible once the structure
has to ship anyway.

*Alternative considered — fit in the browser, live.* This is the strongest rejected option
and worth recording properly. It would make pressing *train* genuinely honest at this rung,
let the threshold sweep be shown rather than described, remove the coverage dimension
entirely, and make the whole staleness class of bug impossible — there is no frozen data to
drift from its source. It was rejected because §2 requires the plateau to be *authored*, and
`prediction-artifacts` makes deliberate shaping a recorded step precisely so a lesson cannot
quietly depend on what a fit happened to produce. Fitting offline means a reviewer reads a
recorded number and decides whether it teaches what it should, which is the same gate the
convolutional runs pass through. Consistency across the ladder was the tiebreaker: one rung
whose numbers were reviewed and one whose numbers appear at run time are two different
standards of evidence.

*Conditions that would reopen it:* if the measured gap turns out too narrow to survive the
40-image held-out set (see Risks), live fitting over a larger owned tier becomes the cheaper
way to get a real gap than regenerating the pool.

### The node budget is the knob, and best-first growth makes it the history axis too

Capacity is the node budget the progression already sells for the hand-written tree, counted
in internal nodes. The fit grows the tree **best-first** — at each step taking the split that
most reduces impurity anywhere in the current tree — to the budget's leaf count.

The two decisions are really one. Best-first growth to a leaf budget is what makes the tree
at *k* splits a genuine prefix of the tree at *k+1*, and that nesting is what turns the
history into one tree growing rather than a series of unrelated fits. It also matches the
purchase exactly: buying two more nodes *extends* the student's tree instead of replacing it,
which is both the honest description and the better feeling. `scikit-learn`'s
`DecisionTreeClassifier` switches to best-first growth when `max_leaf_nodes` is set, so this
costs a parameter rather than an implementation.

*Alternative considered — depth as a separate capacity knob*, as the stub originally proposed.
Rejected: it is a second capacity currency next to rung 1's node budget, it makes rung 1's
purchases stop mattering, and depth-limited growth is breadth-nested rather than
split-nested, so the history's steps would be levels — four coarse points instead of one per
node, on an axis the student cannot buy.

### A step is a split, and loss is log loss over smoothed leaf distributions

Each history entry describes the tree holding the first *k* splits. Its training figures are
measured over the 160 fitted images and its validation figures over the 40 held-out ones —
the same populations, same roles, as the convolutional runs.

Loss is the negative log likelihood the leaf distributions assign to the declared categories,
which is the quantity the convolutional runs already record as cross-entropy. Same unit, same
populations, so the two families' curves belong on the same chart.

**Leaf distributions are Laplace-smoothed** (add-one over the leaf's class counts) before
anything reads them. A pure leaf otherwise assigns probability zero to every category it did
not see, and a single held-out image landing in a pure leaf that is wrong about it makes log
loss infinite — which would blow up the curve the rung exists to show, and would produce a
stored vector that no declared tolerance can sensibly bound. Add-one is chosen over clamping
to an epsilon because it is interpretable at this rung: a leaf that saw eight reds and no
greens reports nine-elevenths rather than certainty, and "the leaf only saw eight apples" is
a sentence a student can be told.

*Trade-off, accepted:* smoothing flattens exactly the confidence the decision policy reads,
so a small-budget tree's leaves will look less certain than the tree "really" is. That is the
right direction — a leaf standing on eight images *should* not be certain — but it means the
policy's thresholds see a different confidence profile from this family than from the network,
and the payoff numbers are not directly comparable even though the losses are.

### Leaves are distributions; the reference hand tree is declared data

A leaf carries a distribution over categories, never an action. This is forced —
`prediction-artifacts` refuses an artifact carrying a chosen action, and the decision policy
must stay a live computation — but it is also the interesting asymmetry with the rung below,
where the student's leaves *are* actions they picked. The teaching line is that the fitted
tree reports how sure it is and the policy decides what to do about it.

The reference tree that §2's floor is measured against is declared alongside the family, in
the same tree shape rung 1 produces, seeded from §5.4's mockup. The pipeline measures both it
and the fitted tree over the evaluation pool and records the margin. Declaring it rather than
hard-coding it keeps the floor auditable and keeps the pipeline from naming a feature.

### The on-disk step key stays `epoch` until the retrain that is already planned

The spec's vocabulary becomes "step"; the on-disk key does not move yet. The reader accepts
`step` and falls back to `epoch`, the tree artifacts write `step`, and the convolutional
artifacts keep `epoch` until `heirloom-cultivars` retrains everything anyway (§11, change 14)
— at which point the fallback is deleted.

*Alternatives considered:* rename the key now — rejected, it invalidates three shipped
artifacts and forces a retrain this change explicitly must not cause. Keep `epoch` forever as
the universal step index — rejected, it leaves one family's vocabulary in the format
permanently, which is the same mistake as leaving it in the screen. Riding the planned
retrain costs one fallback branch with a named removal condition.

The *displayed* label is separate and moves now: the family declares it, and
`TrainingRun.tsx` reads it instead of writing `epoch`. That is what makes §6.5's extension of
the `no-task-specific-code` invariant enforceable rather than aspirational.

### Layout mirrors the convolutional artifact

One file per configuration under the path the declaration names, with an index carrying
coverage, pool binding, provenance and encoding — the same shape
`artifacts/apple-harvest/predictions/` already has. Trees are small enough that a single file
would satisfy *One configuration is retrievable without the others* by accident; mirroring
the existing layout satisfies it on purpose and means one reader shape rather than two.

### The starter set only, and the tier collision is recorded

The fit uses the 200-image starter set's 160 fitted images, validating on its 40 held-out
ones. A 1 000-photo tier would have to be drawn from the 1 000-image evaluation pool, which
would fit the model on the harvest and collapse the gap this rung exists to show. Sourcing a
larger fitting set needs a pool regeneration; §11 says to batch that with
`heirloom-cultivars` and pay for it once. This change therefore ships one tier and names the
constraint for `dataset-tiers` rather than working around it.

### Determinism is a declared tie-breaking rule

Best-first growth has to choose among equally good splits, and the choice must be recorded or
the run is not repeatable. Feature evaluation order is fixed by the declared feature list and
ties break toward the earliest declared feature, then the lowest threshold; the seed is
recorded even though the fit is deterministic, so the recorded fields alone reproduce the
tree.

## Risks / Trade-offs

- **The gap may be too narrow for 40 held-out images to resolve.** The convolutional gaps run
  25–32 pp, where 2.5% granularity is ample. A tree's gap across four or five budgets may be
  a few points, which is one or two images wide — non-monotone by luck of the draw, and Year
  6's whole beat ("96% on the photos, 90% in the field") depends on it reproducing. →
  Measure it before the catalog is priced, and treat a gap under about two images' width as a
  finding that escalates: either the held-out role grows (a pool change, batched with change
  14) or the family fits a larger tier (which needs the same pool change). Do not ship a
  narrower lesson and hope; the ship gate refusing non-widening gaps is what makes this
  surface rather than pass.
- **Smoothing changes what the policy sees.** → Accepted and recorded above. Worth checking
  that a smoothed small-budget tree does not become uniformly indecisive under the declared
  thresholds, which would make the rung feel broken rather than uncertain.
- **Blocked on `model-families` providing a third prediction source.** If that change lands
  with only `artifact` and `live`, and with a per-image `predict` signature, this change
  cannot be built as designed. → Stated in the proposal as an upstream requirement rather
  than discovered during apply. `model-families` is change 8 and this is change 13, so there
  is room to get it right.
- **Best-first growth means a bad early split persists into every larger budget.** → This is
  a feature at this rung: buying capacity extends what you have, and a student who watches a
  poor first split survive four purchases has learned something real about greedy fitting.
- **The floor is measured against our reference tree, not the student's.** A student who
  writes a better tree than the reference sees a purchase that does not pay. → Unavoidable
  without inspecting the student's tree, and the honest framing is available: the workshop
  shows both trees' figures side by side, so a student who beat the fit can see that they did.

## Migration Plan

Additive. No pool change, no convolutional retrain, and the three shipped artifacts must
resolve byte-identically — asserted by test, not intended.

Order: the `prediction-artifacts` delta and the reader's `step`/`epoch` fallback land first
and must leave the existing artifacts loading; then the fitting step and its recorded
measurements; then the family declaration, the evaluator and the catalog entries. The
catalog's node-budget entries are priced only after the gap and floor measurements exist,
because `progression-catalog` refuses to sell what no model was fitted for and the
measurements are what decide which budgets are worth selling.

Rollback is removing the family declaration and its catalog entries: the artifact becomes
unreferenced and the convolutional path is untouched.

## Open Questions

- The node budget values and their prices. §4.5's first-pass numbers put +2 nodes at 400 CHF;
  which budgets exist and what each costs is catalog data, tunable after the measurements
  land, and §11 is explicit that fixing prices should cost an afternoon rather than a change.
- Whether the growth animation reuses the replay clock as-is or wants a per-step pause long
  enough to read a new split. A screen detail that does not affect the artifact, the specs or
  the task breakdown.

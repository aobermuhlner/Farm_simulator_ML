## Why

The simulator will teach several different ML lessons (apple harvesting first, later
things like animal skin-disease screening where a false positive is cheaper than a
false negative). If each lesson is built as bespoke screens and bespoke scoring, the
second one costs as much as the first and the two teach inconsistently.

There is a natural seam that makes them the same product: a lesson is a *frozen model*
whose outputs were precomputed, plus a *live decision policy* applied to those outputs,
plus a payoff table that turns decisions into money. Defining that contract before any
UI or data work exists means changes 2-5 (prediction artifacts, dataset generation,
training replay, harvest scoring) all build against one shape instead of negotiating
one pairwise.

## What Changes

- Introduce a declarative **task contract**: a task is data, not code. It declares its
  ground-truth categories, the actions available, the image pool it draws from, the
  hyperparameter knobs exposed to the student, where its precomputed predictions live,
  its payoff table, and its teaching copy.
- Separate **model output** from **decision policy**. Precomputed artifacts store
  per-image *probability vectors* per category, never final labels. Turning a
  probability vector into an action is computed live from the task's policy.
  - Consequence: the apple task exposes knobs on the model side (depth, width,
    regularization, dropout); the later screening task exposes knobs on the policy
    side (thresholds, cost asymmetry). Both run on one engine.
- Define **config identity**: an ordered set of knob values maps to a deterministic
  config id that keys both the prediction table and the training history, plus a schema
  version so precomputed artifacts fail loudly rather than silently mismatching when
  the knob set changes.
- Define the **payoff table** as a value per `(true_category, action)` cell, so scoring
  and the harvest report read one structure — the report is the same table filled with
  counts.
- Declare the **knob schema** so configuration UI renders itself from task data rather
  than from hand-written screens per task.

Not in this change: artifact file format and quantization (prediction-artifacts), image
generation and the train/test distribution gap (dataset-generation), training replay UX
(training-simulation), harvest sampling and reporting (harvest-scoring), and the web
stack and deployment (deferred until the abstraction settles).

## Capabilities

### New Capabilities
- `task-contract`: what a task declares in order to be playable — categories, actions,
  pool reference, exposed knobs and their declared types, prediction artifact reference,
  payoff table, teaching copy — plus config identity and artifact schema versioning.
- `decision-policy`: how a per-image probability vector becomes a chosen action, and how
  a payoff table converts `(true_category, action)` pairs into earnings. Covers argmax,
  thresholded, and cost-optimal policies as declared task data.

### Modified Capabilities
<!-- None. openspec/specs/ is currently empty; this change establishes the first specs. -->

## Impact

- **New**: `openspec/specs/task-contract/spec.md`, `openspec/specs/decision-policy/spec.md`.
- **Downstream changes**: `prediction-artifacts` consumes config identity and the
  probability-vector requirement; `dataset-generation` produces what `pool` references;
  `training-simulation` reads training histories keyed by config id; `harvest-scoring`
  consumes the payoff table and the decision policy.
- **Code**: none yet. The repository has no application code; this change defines the
  contract that the eventual implementation must satisfy.
- **Dependencies**: none added. The contract assumes static hosting with no backend, so
  everything it references must be a shippable static artifact.
- **Risk**: if the knob set for the apple task changes after prediction artifacts are
  authored, every artifact keyed by config id must be regenerated. The schema version
  field is the mitigation.

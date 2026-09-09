# Model families

`Game_design.md` §6.2 — "the one big change". Depends on `progression-catalog`, which
shipped. Supersedes the stub scaffolded 2026-09-04, whose two central claims are corrected
below.

## Why

Today a task declares *one* architecture family: one knob list, one diagram, one prediction
artifact. `model-architecture`'s *A task declares an architecture family* is written that
way throughout, and so are `task-contract`'s completeness, knob and identity requirements.

The ladder needs a task to offer several — a fitted tree, a forest, a convolutional network
— and the student to move up it by buying. Without the abstraction every rung grows its own
report screen, its own workshop and its own scoring path, and the `no-task-specific-code`
invariant is the first thing to go.

The load-bearing distinction is **what a family ships**. A convolutional network's
predictions are looked up in a frozen artifact keyed by configuration id, because 128
channels of weights cannot go down the wire and cannot run in the browser. A fitted tree
ships the model itself — a few dozen `(feature, threshold)` pairs — and is evaluated in the
browser over the measured features `measured-features` put in the pool manifest. Put both
behind one interface and the decision policy, the payoff table and the report are written
once and serve the whole ladder.

## What Changes

- **A model family becomes a declared entity**: id, its own knobs, its own diagram, its own
  catalog entries, its teaching copy, the icon and short label for its labour slot on the
  farm card, and what it ships.

- **What a family ships is `model` or `predictions` — not `artifact` or `live`.** The stub
  proposed that pair and it is the wrong axis. "Live" is not a source: it is what every
  family except the convolutional one does. The CNN precomputes *because its model cannot
  ship*, so the real distinction is whether the pipeline sends the model or a table of its
  predictions, and the declared field should say that. A third source is not needed — the
  student-authored case that would have required one is dropped below.

- **The hand-written tree is dropped from the ladder, and this change is much smaller for
  it.** §2's rung 1 — a tree the student writes, evaluated live, saved as their own model —
  was the sole reason for a third prediction source, for an authored model in a labour slot,
  and for the fault line described next. Its pedagogy moves to `model-tutorials`, where it
  costs no economy, no artifact, no slot and no save state beyond a completion flag.
  `decision-tree-builder` is left standing for a separate decision rather than archived here;
  three documents still point at it.

- **The stub's claim that everything downstream consumes a distribution was false, and is now
  true.** It asserted that the policy, the payoff table and the report neither know nor care
  what produced a distribution. With rung 1 in, that was wrong twice over: `src/features/rules.ts`
  returns an `ActionId`, and the farm's own hands have never produced a distribution at all —
  `src/sorting/tally.ts` scores actions on a separate path from `src/scoring/index.ts`. With
  rung 1 gone, every *family* yields a distribution and the hands remain the one
  action-producing labour, on the path they already have. **`decision-policy` therefore needs
  no change**, which is worth stating because the stub implied it did.

- **A task declares several families, with one selected in the workshop.** Which family is
  selected is **not** which model is at work: `farm-labour` makes the labour slot a separate,
  deliberately committed piece of state, so opening the picker to look at a tree must not take
  the network off the orchard. The picker swaps the settings panel; the slot decides who
  brings the crop in.

- **Per-family knob values are remembered independently**, so tuning the network does not lose
  the tree's budget.

- **BREAKING for `task-contract`: knobs, the diagram and the prediction reference move from
  the task to the family.** Declaration completeness, knob declarations and configuration
  identity are all currently written against a single family. `declarations/apple-harvest.json`
  is reshaped accordingly. Categories, actions, `categoryActions`, payoffs, the delivery term,
  the pool, the features, the rule budget and hand sorting stay on the task — they describe
  the job, not the model doing it.

- **Configuration identity becomes family-scoped, and the shipped convolutional artifacts must
  resolve unchanged.** This is the compatibility requirement that makes the change safe, and
  the cheap way to meet it is for the identifier string to stay exactly what
  `src/task/configId.ts` composes today and for the *family* to decide which artifact it is
  looked up in. Then one family's ids can never collide with another's, and no shipped
  artifact is reinterpreted. A test, not an intention.

- **BREAKING for `farm-labour`: a labour slot becomes family-qualified.** *A slot records the
  model that was made, not the settings it came from* survives intact and is the right rule —
  but a bare configuration identifier no longer names one model, because two families can
  compose the same string. The slot records which family made it as well.

- **The family interface returns a configuration entry, not a per-image distribution.**
  `fitted-tree` requires this as an upstream condition and it is correct: a per-image
  `predict(image, config)` signature has nowhere to put the training history the workshop
  needs, and the workshop's curve is the better diagnostic this whole design is trying to get
  read. The shape is the one `src/task/artifact.ts` already returns — a history plus a way to
  get a distribution per image — with the history optional, since a family may have none.

- **A history's axis is declared, because it is not always epochs.** `fitted-tree` indexes its
  growth by splits added, deliberately, so that its curve is in the same units as the network's
  and a student climbing the ladder reads the same chart.
  `web/src/screens/TrainingRun.tsx` renders the literal string `epoch <n>`, which is one
  family's vocabulary hardcoded in a screen; the axis label becomes declared data.

- **The refusal taxonomy stays at three, correcting the stub.** It proposed a fourth case,
  *not applicable*, for a live family with no coverage. No family has that shape any more: a
  model-shipping family has coverage too — one fitted tree per purchasable budget — so
  `progression-catalog`'s *Locked, untrained and invalid are three different refusals* applies
  unchanged, and *Nothing for sale opens a configuration no model was trained for* keeps
  checking catalog entries against coverage exactly as it does today.

- **`network-diagram` needs no change, and confirming that is part of the work.** *Each
  family's drawing is separately mountable* already anticipates this generalization. The
  change should demonstrate it rather than assume it.

- **The invariant extends: no screen names a model family.** §6.5's wording, and
  `web/src/no-task-specific-code.test.tsx` is where it is enforced.

- **Two things are called a family and one of them has to be renamed.**
  `model-architecture`'s families — fully-connected and convolutional — are a choice of *how
  knobs are interpreted and drawn*, one per task. A ladder family is a rung you buy. They are
  different nouns and the codebase cannot carry both under one word; naming is a decision this
  change has to take rather than leave.

## Capabilities

### New Capabilities
- `model-families`: a family as a declared entity, what it ships, the registry and the two
  evaluators behind one interface returning a configuration entry, family-scoped configuration
  identity, per-family knob memory, and the declared history axis.

### Modified Capabilities
- `model-architecture`: *A task declares an architecture family* becomes several families with
  one selected, and the convolutional requirements become statements about one family rather
  than about the task. Carries the renaming.
- `task-contract`: knobs, diagram and prediction reference move to the family; declaration
  completeness and configuration identity are rewritten against it.
- `farm-labour`: a slot is family-qualified.
- `prediction-artifacts`: an artifact is bound to a family as well as to a task and a pool, and
  the identity it keys entries by is scoped to that family.
- `game-save`: knob values are recorded per family, and which family is selected is progress.
- `simulator-shell`: the workshop holds a family picker, a report identifies the family as well
  as the configuration that produced it, and the no-task-specific-code requirement gains the
  family clause.

## Impact

New `src/families/` holding the registry and the two evaluators; a reshaped
`declarations/apple-harvest.json` with families as declared entities and its validator in
`src/task/validate.ts`; family qualification through `src/labour/index.ts`,
`src/progression/`, `src/save/` and `src/scoring/`; a family picker on the workshop screen and
the declared axis label in `web/src/screens/TrainingRun.tsx`.

Reads `src/features/` for the model-shipping evaluator and the frozen artifacts for the other.
**No retraining.** The shipped artifacts are re-emitted once to record which family they
belong to — metadata only, changing no probability, no configuration key and no training
history — and every currently shipped configuration must resolve to the same distributions
and the same history afterwards, which the change owes as a test. `design.md` records why
recording the family is preferred to assuming it. `model-tutorials` and `fitted-tree` both
depend on this landing first — a tutorial has nothing to be keyed to and a fitted tree has
nothing to register through until a family is a declared entity.

## Context

See `proposal.md` — Why. What matters for the approach is the shape of what exists.

`TaskDeclaration` carries `knobs`, `predictions` and `diagram` directly, and
`src/task/artifact.ts` resolves a configuration against a single artifact keyed by the
string `src/task/configId.ts` composes from those knobs. `src/labour/index.ts` stores a
`FieldedModel { configurationId }` per task. `src/scoring/index.ts` takes a
`ConfigurationEntry { history, predictions }` and scores it; the farm's hands score on a
separate path in `src/sorting/tally.ts`. `measured-features` has already put per-image
feature vectors in the pool manifest and a reader for them in `src/features/`.

Three constraints shape everything below. There is no backend, so a model-shipping family
must be evaluated in the browser. The shipped convolutional predictions must keep resolving,
because retraining them is the most expensive operation in the project. And
`web/src/no-task-specific-code.test.tsx` is a test, not an aspiration — the picker has to
render from declarations or the suite fails.

## Goals / Non-Goals

**Goals:**

- One resolution path that both shipped forms satisfy, so `src/scoring/`, `src/policy/` and
  the report are written once.
- Configuration identity that is family-scoped without changing a single shipped key.
- A declaration reshape that a validator can refuse precisely, at load.

**Non-Goals:**

- Any second family for the apple task. This change ships the abstraction and declares the
  convolutional family through it. `fitted-tree` supplies the first family that exercises
  the picker for real.
- Unifying the two scoring paths. See Decisions.
- Any change to how a family is bought, or to the tutorial gate. `progression-catalog` is
  untouched here; `model-tutorials` owns the gate.

## Decisions

### The family interface returns an accessor, not a materialized entry

`fitted-tree` requires the interface to return a configuration entry rather than a per-image
distribution, and it is right about why: a per-image `predict(image, config)` has nowhere to
put the training history, and the history is the diagnostic the whole design wants read.

But today's `ConfigurationEntry.predictions` is a materialized `Record<SplitName,
Record<imageId, number[]>>`, and a model-shipping family has no such map — it has a tree and
a feature table. Building the map eagerly would make selecting a family walk the whole pool
before showing anything.

So the entry a family returns exposes the history plus two accessors: the distribution for
one image of one split, and the image ids a split holds. The artifact-backed family closes
over its stored record; the model-shipping family evaluates on call and reads split
membership from the pool manifest. `scoreEntry` currently iterates `Object.keys(rows)`,
which is exactly what the second accessor replaces.

*Alternatives:* returning `ConfigurationEntry` unchanged and having model-shipping families
materialize it — simpler to wire, and cheap for a tree, but it bakes in the assumption that
predictions are always enumerable in advance, which is the assumption this change exists to
remove. Rejected. Returning a per-image `predict` — rejected upstream by `fitted-tree`.

### Identity stays byte-identical; the family scopes the lookup, not the string

A family-qualified identifier — `cnn/blocks3-channels16-regularization1-dropout0` — would be
self-describing, and it would change every key in every shipped artifact. So identity is
scoped by *where it is resolved*, not by what it says: `configId.ts` composes exactly what it
composes today, each family declares its own predictions path, and the family decides which
artifact a string is looked up in. Two families composing the same string is then harmless,
because neither ever looks in the other's artifact.

The refusal that makes this safe is the artifact recording which family it belongs to, so a
mis-wired declaration fails loudly rather than answering with the wrong family's model.

### The shipped artifacts gain a family id, and that is a re-emit rather than a retrain

This is the one place the proposal's "no artifact is regenerated" needed sharpening, and the
specs and the proposal have been reconciled to it. `prediction-artifacts` requires an
artifact to record its family and refuses one that records none; the shipped artifacts record
only a task. Both cannot hold.

Adding the field is the right resolution: it is a metadata edit over the existing files, it
changes no probability, no configuration key and no training history, and the repo already
treats re-emitting as routine (`Re-emit the shipped artifacts against the 1.1.0 pool`). The
expensive thing — retraining — does not happen, and the test that the same configurations
resolve to the same distributions is what proves it.

*Alternative:* treating a missing family id as the task's only family. Cheap, and it would
let the files stand untouched — but it is exactly the silent assumption the refusal exists to
prevent, and it would have to be carried forever for files that take a minute to re-emit.
Rejected.

### `ships` is declared, and it is `model` or `predictions`

Not `artifact | live`, which conflates where a prediction comes from with whether the model
could travel; and not inferred from the family's architecture kind or from whether an
artifact file happens to be present, which would make adding a file change behaviour.

Two values, not three. The student-authored source that would have needed a third is gone
with rung 1, and adding it speculatively would leave a branch nothing exercises.

### Architecture kinds and model families are different nouns

`model-architecture`'s "family" — fully-connected or convolutional — becomes an **architecture
kind**, which is already the word `task-contract` uses in *A task may declare how its
architecture is drawn* and the word the code uses in `DIAGRAM_KINDS` / `DiagramKind`. A rung
a student buys is a **model family**. The rename is mechanical and the delta spec carries it
as REMOVED plus ADDED rather than as an edit, so the archive cannot quietly lose the old
names.

### The two scoring paths stay two

Every family yields a distribution, so `src/scoring/scoreRun` serves all of them; the farm's
hands keep scoring actions in `src/sorting/tally.ts`. Collapsing the two — pushing the policy
inside each family so that everything scores actions — was considered and rejected for now.
Nothing in this change produces actions, so there is no duplication to remove, and the move
would rewrite `decision-policy`'s first requirement to buy nothing. If a family ever authors
its own decisions, that is the change that should pay for it.

### The save resets rather than migrates

Knob values become `Record<FamilyId, KnobValues>` and each task records its selected family;
a labour slot records a family alongside its identifier. Old saves have a flat knob map and a
bare identifier.

A migration is well-defined — there was only ever one family, so a flat map and a bare
identifier both belong to it. It is still not worth writing: `game-save` already commits to
resetting rather than migrating wrongly, the app has no users whose progress is precious yet,
and `farm-labour`'s delta makes a slot with no family revert to the hands with the cause
reported, which is the graceful half of the behaviour anyway. Bump the schema version and let
the declared reset path run.

### The declaration reshape, and what stays on the task

Families become an array on the task. `knobs`, `predictions` and `diagram` move onto each
family, joined by the family's id, label, `ships`, teaching copy, slot icon and label, and
its history axis where it has one.

Everything describing the *job* stays on the task: categories, actions, `categoryActions`,
policy, payoffs, the delivery term, the pool, `features`, `ruleBudget` and `handSorting`.
The test for the split is whether two families of one task could disagree about it — they
cannot disagree about what a wormy apple is worth, and they must be able to disagree about
what knobs they have.

`validate.ts` gains a per-family pass: id uniqueness within the task, knob id uniqueness
within the family, the separator checks run per family, and a diagram's knob references
resolved against its own family's knobs rather than the task's.

## Risks / Trade-offs

- **This change ships nothing a student can see.** The apple task will declare exactly one
  family, and the specs require a single family not to be presented as a choice — so the
  picker is invisible until `fitted-tree` lands. → Exercise it with a fixture task declaring
  two families, in the same place `no-task-specific-code` already builds unrelated
  declarations. The abstraction is then under test even though the shipped game looks
  identical.
- **A silent mis-wiring is the worst failure available here**, because two families can
  compose the same identifier and a wrong lookup would return a real, plausible distribution.
  → The artifact's recorded family id and the refusal on mismatch are the guard, and they are
  worth a test that deliberately points one family at another's artifact.
- **Seven delta specs is a large change for one session.** → The task order below keeps the
  suite green at each stage: declaration and validator, then identity scoping, then the
  registry and the two evaluators, then the save, then the picker. Nothing needs the picker
  to be correct in order to be tested.
- **The re-emit touches every shipped artifact.** → It changes metadata only, and the
  standing test is that every currently shipped configuration resolves to the same
  distributions and the same history after it.
- **`ruleBudget` now sits on a task that offers no hand-written rule to anybody**, since rung 1
  is gone. → Out of scope here; `fitted-tree` owns correcting its documented justification,
  and `fitted-tree-tutorial` records the coupling.

## Migration Plan

1. Reshape `declarations/apple-harvest.json` so its knobs, predictions reference and diagram
   sit under one declared convolutional family. No knob, value, default or help string
   changes.
2. Re-emit the shipped artifacts with a recorded family id. Metadata only.
3. Bump the save schema version so existing saves reset rather than migrate.

Rollback is the inverse of steps 1 and 2 and needs no code, because the artifacts' payloads
are untouched by either.

## Open Questions

- Whether the picker presents as tabs or as a select. A presentation detail that changes no
  requirement and no task; decide it when there are two real families to look at.
- Whether a history's declared axis label needs singular and plural forms for copy, or
  whether one form reads acceptably everywhere it appears.

## What moved

Recorded here because task 8.4 asks for it: everything below is a behaviour or a figure
that is different after this change, and everything not below is not.

- **No measured figure moved.** The shipped artifacts were re-emitted with `familyId`
  recorded and nothing else: one line per file, four files. `test/artifacts-untouched.test.ts`
  now resolves every covered configuration through the family-scoped path and asserts the
  history and every distribution equal the numbers its own file carries, so the promise is
  standing rather than a one-off diff. No configuration was retrained; the recorded seed,
  epoch count and pipeline revision of each run are the ones already committed.

- **The save schema is `3.0.0`, and existing saves reset.** Knob values became a map per
  family and a labour slot gained one, so a `2.0.0` save has no honest reading. The
  declared reset path runs and reports itself, which `save-codec` now asserts for `2.0.0`
  as well as for the version before it.

- **A labour slot on the farm overview shows the family's declared icon and short label
  rather than the configuration identifier.** That is the specified behaviour — the farm
  is read at a glance for which family is working which crop — and it is a visible change
  to the shipped game, the only one this change makes. The identifier is still named in
  the report, now beside the family that made it.

- **The training replay's axis is the family's declared word.** The apple family declares
  `epoch`, so the shipped lesson reads exactly as it did. What changed is that the screen
  no longer writes the word: the test id is `training-step`, the CSS classes are
  `step-line` / `step-bar`, and the copy is composed from the declared term. A family
  declaring no history is presented with no curve and nothing reports its absence.

- **The untrained refusal names the family as well as the identifier.** Same code
  (`untrained-configuration`), same standing in the three-refusal order, one more noun in
  the sentence — because the same identifier may well be covered in another family of the
  same task, and the old wording would then read as a flat contradiction of what a student
  can see.

- **Two refusals were added beyond what the specs enumerate**, and both are the same class
  of mistake as the ones they sit beside. A task-level `diagram` is refused alongside a
  task-level `knobs` and `predictions`: the delta spec names only the latter two, but a
  declaration written against the old shape carries all three and silently ignoring the
  drawing is exactly what "refused rather than loaded with them ignored" exists to stop. A
  prediction-shipping family naming no artifact, and a model-shipping family naming no
  models, are refused at load rather than at the first fetch.

- **`web/src/data/load.ts` no longer branches on what a family ships.** Which reader an
  index goes through is decided in `src/families/` from the declaration, beside the
  evaluator dispatch, so the shell's invariant is met by construction rather than by care.
  The invariant test grew a family suite: family ids and shipped-form branches by the id
  matcher, labels, slot icons, slot labels and axis labels by the label matcher.

## Open questions, resolved

- **Tabs or a select** — neither. The picker is a row of pressed-state buttons, which is
  what let a locked rung be presented exactly as a locked knob value is: shown where it
  would be shown unlocked, greyed, with the item that opens it and that item's price
  beside it. A `<select>` cannot grey an option and say why. Still a presentation detail,
  and still free to change when there are two real families to look at.

- **Singular and plural axis forms** — one form reads acceptably everywhere it appears,
  so the declaration carries one. The two places that would have wanted a plural were
  rephrased instead: the progress line reads `epoch 3 of 40` and the finished line reads
  `Training finished at epoch 40`. A family whose axis needs a plural can have the field
  added without touching either screen.

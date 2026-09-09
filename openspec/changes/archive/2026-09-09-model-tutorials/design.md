# Design

## Context

See `proposal.md` — *Why*. The pieces this has to fit between already exist:

- `src/task/types.ts` carries `ModelFamilyDeclaration`, and `src/task/validate.ts` refuses a
  declaration at load with an issue naming the field. `DiagramDeclaration` is the precedent
  for a per-family, kind-discriminated blob of declared data that a validator checks and a
  screen dispatches on.
- `web/src/components/architecture/ArchitectureDiagram.tsx` is the precedent for the
  mounting: a file that dispatches on `kind` and does nothing else, with each family's
  drawing usable on its own. `network-diagram`'s *Each family's drawing is separately
  mountable* is the requirement it satisfies, and this change adds the second per-family
  mountable thing.
- `src/progression/availability.ts` already computes a `FamilyAvailability` per family from
  the catalog and what is owned. Its own comment says the three arguments are three and no
  more, "deliberately: a fourth would be a way for something other than ownership to decide
  what a student may choose."
- `src/labour/index.ts` holds `putToWork` / `handBack`, and `src/save/index.ts` holds
  `SavedFarm` at schema version `3.0.0`, with a restore that drops references the
  declarations no longer carry.

The tension the design has to resolve is between that availability comment and the gate.
The specs resolve it by scope: what may be **selected** stays ownership-only; what may be
**put to work** is the one thing that gains a second input.

## Goals / Non-Goals

**Goals:**

- One declared shape for a tutorial, validated at load, that no screen has to know the
  meaning of.
- A gate that lives in exactly one place in the engine, so that "can this be fielded" has
  one answer and the workshop and the labour resolver cannot disagree about it.
- A mounting registry that a body change (`fitted-tree-tutorial`) can add a kind to without
  touching the frame.
- A save migration that costs a student nothing.

**Non-Goals:**

- Any actual puzzle. This change ships the frame and registers no kind beyond a test
  fixture; `fitted-tree-tutorial` supplies the first real body.
- Adding a tutorial to `declarations/apple-harvest.json`. The shipped game is unchanged by
  this change — a gate with no puzzle behind it would be a wall.
- Gating anything but fielding: not buying, not selecting, not making, not the report.

## Decisions

### The tutorial is declared on the family, not in a new top-level declaration

**Chosen:** an optional `tutorial` on `ModelFamilyDeclaration`, alongside `diagram` and
`history`.

`ModelFamilyDeclaration`'s own doc comment states the split: "A family owns everything that
is about the *model* … The test for the split is whether two families of one task could
disagree about a field." Two families can certainly disagree about which puzzle explains
them, so the tutorial is the family's. It also keeps adding a lesson a single-file data
change, which `CLAUDE.md` names as the property to protect.

**Alternative considered:** a `declarations/tutorials.json` beside `catalog.json`, with
families referencing tutorials by id. That makes global uniqueness structural and makes
sharing one tutorial across tasks trivial. Rejected because it adds a declaration file, a
loader, a fetch path and web wiring for a problem that has one instance today, and because
it splits a family's data across two files against the precedent set for `diagram`.

### Completion is keyed by the tutorial's own id, and same-id tutorials must agree

The user's decision is that completion is recorded once per family, globally. Family ids
are only unique *within* a task, so they cannot be that key. The tutorial therefore carries
its own `id`, and completion is a set of those ids.

That makes "once, globally" exact: two families in two tasks that declare the same tutorial
id share one completion. To stop that from becoming a silent contradiction, two tutorials
declaring one id must be the same tutorial — checked by deep equality at load and refused
naming the id, the same shape of check as duplicate family ids and duplicate catalog item
ids.

**Alternative considered:** keying by `task + family`. Rejected per the user's decision: it
would ask a student to sit one lesson twice.

### The gate is computed in `src/progression/`, next to availability, not inside it

`computeAvailability(catalog, tasks, owned)` keeps its three arguments and its meaning.
Fieldability is a separate, adjacent function — something of the shape
`fieldableFamilies(tasks, completed)` — and the engine composes the two where a decision is
actually made.

This is the mechanical expression of the spec's scope split, and it keeps the comment in
`availability.ts` true rather than having to be softened. A caller wanting "may this be
selected" asks availability; a caller wanting "may this be fielded" asks both.

**Alternative considered:** a fourth argument to `computeAvailability`. Rejected — it would
make every selection question depend on tutorial state, which is precisely what the
modified requirement forbids.

### `putToWork` gains a refusal; `handBack` gains nothing

The refusal lives with `putToWork` in `src/labour/`, so that no caller can field an
untutored family by going around the workshop. `handBack` stays unconditional: a tutorial
must never be able to strand a model on a task, which the spec states outright.

Restore reuses the existing drop-and-report path in `src/save/`, with a **new named cause**
distinct from `UNKNOWN_CONFIGURATION` and the withdrawn-family cause. The distinction is not
cosmetic: those two say this build cannot make what was recorded, and this one says there is
something to go and do. The cause carries the tutorial so the shell can word it that way and
offer the way to it.

### The frame validates the envelope; each kind validates itself

`src/task/validate.ts` checks the envelope — id present, title present, teaching copy
present, `kind` recognised. Everything past `kind` is handed to that kind's checker, which
answers two questions: is this puzzle data well formed, and does it admit a solution that
clears the pass condition. A kind that cannot answer the second is not a kind the registry
accepts.

This is why the frame can refuse an unwinnable tutorial at load without knowing what a
solution is — the specs put winnability in each instance change, and this is the seam that
lets them.

### Two registries, one per side

- **Engine registry** (`src/tutorials/`): `kind` → `{ validate, winnable, judge }`. Pure,
  no React, testable without a DOM.
- **Screen registry** (`web/src/components/tutorial/TutorialBody.tsx`): `kind` → component,
  dispatching and nothing else, exactly like `ArchitectureDiagram.tsx`.

Neither is keyed by family id. A body may name its family; the frame around it may not, and
`web/src/no-task-specific-code.test.tsx` is extended to hold that line — the same way it
already exempts a family's own drawing.

### The save gains a field and the schema version goes to `4.0.0`

`SavedFarm` gains `tutorials: readonly string[]`. The spec says a save recording none opens
with none complete rather than refusing, so the field is optional on read.

That is a compatible addition, but `game-save`'s existing rule is blunt: a save whose
version is not the version this build reads is discarded whole. There is no migration path
in this codebase and the spec forbids inventing one, so the version bump resets existing
saves — acceptable for a teaching tool with no shipped student data, and consistent with
every prior schema change.

### An unknown completion id is kept, not dropped

Every other unrecognised reference in a save is dropped. This one is not, and the spec says
so explicitly so it does not read as an oversight. The asymmetry is justified by what each
choice costs: a dropped owned id could otherwise open something the catalog no longer
describes, while a kept completion id gates nothing at all while nothing declares it. The
cost of dropping it is making a student re-sit a lesson they passed, which is the exact
thing this change exists to avoid asking twice.

## Risks / Trade-offs

- **The gate contradicts a shipped requirement, and the next change will cite it** → the
  modified requirement states the exception as *exactly one* further input and re-lists the
  inputs that remain forbidden. The defence — §2 was arguing against *ownership* gates, and
  a comprehension gate is a different animal — is recorded in `proposal.md` rather than
  assumed, so a future change proposing a second gate has to argue against a written
  position instead of an inferred one.
- **Deep-equality on same-id tutorials is a fussy check that will fire on a whitespace
  difference** → it fires at load with the id named, in a repo where every other structural
  defect already refuses at load. One instance exists today, so the check is cheap
  insurance rather than a maintenance burden.
- **A frame with no real kind cannot be played end to end** → deliberate. The frame is
  exercised by a fixture kind in tests, and `fitted-tree-tutorial` is the change that makes
  it playable. Shipping the frame without touching `declarations/apple-harvest.json` means
  the shipped game is byte-identical in behaviour until that lands.
- **Two registries could drift — an engine kind with no body, or the reverse** → a test
  asserts the two key sets are equal, so a half-added kind fails at build rather than
  rendering a blank modal.
- **The version bump discards existing saves** → the spec already requires that a save
  which cannot be read resets with the student told. No migration is written, per
  `game-save`'s "no value SHALL be guessed, migrated or repaired".

## Migration Plan

1. Land the engine (types, validator, registry, gate, save field) with the schema version
   bumped to `4.0.0`. Existing local saves reset with the disclosure the spec already
   requires.
2. Land the shell (workshop affordance, withheld control and its wording, restore cause).
3. Ship no tutorial in `declarations/apple-harvest.json`. Every family declares none, so
   the gate is inert and the game plays exactly as it does today.
4. `fitted-tree-tutorial` adds the first kind to both registries and the first `tutorial`
   block to a declaration, at which point the gate becomes live for that family alone.

Rollback is removing the `tutorial` block from the declaration: the gate is inert again
without any code being reverted.

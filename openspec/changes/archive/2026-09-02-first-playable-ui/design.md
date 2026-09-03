## Context

See `proposal.md` — Why. Requirements are in `specs/simulator-shell/spec.md`; this
document covers only how they are met.

What already exists constrains the shape of this slice more than anything else. The
engine under `src/` is complete: `runHarvest` takes a declaration, requested knob values,
a prediction artifact, a split and a ground-truth map, and returns either a `RunOutcome`
carrying earnings, per-cell counts and per-image outcomes, or a list of issues that each
name their cause. Every refusal the shell must display is already produced there. So the
UI is genuinely a rendering layer, not a second implementation, and the main design
question is how to keep it that way.

Three facts set the boundaries. The app must build to static files — no backend, so
declarations, fixtures and artifacts are fetched or bundled, never served. There are no
images yet, so nothing depicts an apple. And the fixture covers 2 of the 108
configurations the knobs describe, which makes the refusal path a normal state of the
application rather than an edge case.

## Goals / Non-Goals

**Goals:**
- Prove the contract holds against real screens: a declaration in, a playable task out.
- Keep the engine the only place where a rule lives. A rule re-expressed in the UI is a
  rule that can disagree with itself.
- Make the fixture gap legible rather than embarrassing — an unprecomputed configuration
  should teach the student something true about how the simulator works.

**Non-Goals:**
- Visual design beyond legibility, and any mobile layout.
- Any image rendering. There are no images; the report is counts and money.
- Performance work. Ten fixture images say nothing about a thousand real ones.
- Deployment automation. The build must produce a static bundle; publishing it is manual
  for now.

## Decisions

**The engine is imported, never reimplemented.**
The alternative that always tempts a UI layer is recomputing something small — a payoff
sum for a preview, a "would this pick?" hint next to a knob. Every such shortcut creates
a second implementation of a rule the specs assign to one place, and the two drift. The
shell therefore calls `runHarvest` and renders `RunOutcome`, and derives no earnings,
counts or chosen actions of its own. If a screen needs a number the engine does not
return, that is an engine change with a spec behind it, not a calculation in a component.

**Declarations and fixtures are fetched at runtime, not imported into the bundle.**
Importing `apple-harvest.json` directly would be simpler and would type-check at build
time. But the contract's whole claim is that a task is data; a task baked into the bundle
is a task that ships on the build's schedule, and it would let the compiler quietly grant
declarations a validity the runtime validator is supposed to establish. Fetching them
means the app exercises `validateDeclaration` on real input the way a deployed simulator
would, and adding a lesson stays a data change.

**Refusals are a rendered state, not an exception path.**
`runHarvest` returns `{ ok: false, issues }` rather than throwing, so the natural shape is
a discriminated union in the view state: idle, running, report, or refused-with-issues.
Rendering issues as ordinary content — rather than a toast, a console warning or an error
boundary — is what makes the ~100 unprecomputed configurations survivable. A student who
picks one sees an explanation of why that combination is not available, which is closer to
a lesson about precomputation than to a bug.

**The knob control is chosen by the knob's declared kind, and by nothing else.**
`KnobDeclaration` is a discriminated union of `choice` and `slider`, so the renderer
switches on `kind` and on no other property. A mapping keyed by knob id — the obvious
shortcut for making `dropout` render nicely — would reintroduce exactly the per-task
screen code this change exists to disprove the need for. Where a control needs more than
the declaration carries, the finding is that `task-contract` under-declares, and the fix
is a delta there.

**The fixture grows to cover the default configuration and its immediate neighbours.**
Authoring all 108 would duplicate what `prediction-artifacts` owns and would be thrown
away. Authoring none leaves the app opening on a refusal, which demos the error path and
nothing else. A handful — the declared default plus a few configurations reachable by
moving one knob — gives a student a path where changing a knob changes the harvest, which
is the point of the product, while leaving the rest of the space refusing honestly. The
added entries stay hand-written stand-ins and stay in `test/fixtures/`.

**One split is run: the evaluation pool.**
The engine can score the training split too, and the train-versus-harvest gap is the
clearest overfitting visual available — but presenting it is `training-simulation`'s work,
and doing it here would mean designing the comparison twice. The slice runs the pool and
leaves the training-side numbers to the change that owns them.

**The app tree is `web/`, separate from `src/`.**
Putting the screens under `src/ui/` would keep one root and one tsconfig, but it would
also put framework code inside the tree this change promises not to touch. Keeping them
apart makes that promise checkable by path rather than by review: `src/` stays
framework-free and dependency-free, `web/` holds React and the Vite root, and a diff that
touches `src/` during this change is a signal rather than a detail.

**No router.**
Four stages of one linear flow are view state, not URLs. A router would add a dependency
and a set of deep-link questions — what does a link to a report of an unprecomputed
configuration do? — for no benefit at this size. If deep links matter later, the flow is
small enough to retrofit.

## Risks / Trade-offs

- **A fixture-backed UI implies a working product that does not exist yet.** → The report
  is required to disclose fixture provenance, and no performance or plausibility
  conclusion from this slice transfers to real artifacts.
- **The "no task-specific code paths" requirement is easy to state and easy to violate
  quietly** — one `if (knob.id === 'dropout')` is all it takes. → It is checkable rather
  than aspirational: declared ids can be grepped for in the screen code, and a second
  throwaway declaration with unrelated categories is the test that it renders.
- **Runtime fetching means a malformed declaration fails in the browser rather than at
  build time.** → That is the behaviour the contract specifies; the validator names the
  missing field, and the shell is required to show that name.
- **Choosing React commits the project to a runtime dependency it has so far avoided.** →
  The engine stays framework-free and dependency-free, so the commitment is confined to
  the screen layer and a different renderer would not touch `src/task`, `src/policy` or
  `src/scoring`.
- **~100 refusing configurations may read as brokenness rather than as design.** → The
  refusal copy has to explain precomputation, not just report a missing key; if it cannot
  be made to read as intentional, the honest alternative is to cover more of the
  cross-product in the fixture.

## Migration Plan

None. Nothing is being replaced: this is the first UI in a repository that has none.
Rollback is deleting the app tree and the added build scripts; the engine, the
declaration and the specs are untouched by it, which is itself the check that the
abstraction held.

## Open Questions

- **Whether the report shows per-image outcomes or only the aggregate cells.**
  `RunOutcome` carries `images` with each chosen action and payoff, so both are available
  with no engine change. Per-image detail may be the more honest view once real images
  exist, which makes this a question `dataset-generation` is better placed to answer.

## Context

See `proposal.md` — Why. Requirements are in `specs/network-diagram/spec.md` and
`specs/task-contract/spec.md`; this document covers only how they are met.

Four facts about the code decide most of what follows. `validateDeclaration` in
`src/task/validate.ts` refuses a bad declaration at load, field by field, and every other
part of the system trusts a validated declaration completely. `ConfigureTask` already holds
the current knob values in its own `useState`, so a diagram of the current configuration
needs no new state anywhere. `web/src/no-task-specific-code.test.tsx` fails any screen file
that names a declared knob id, which is why the knob-to-architecture mapping cannot live in
the component. And `main` is capped at 46rem, so "beside the settings" is a real constraint
rather than a free choice.

The apple task's knobs are the concrete case: `2 | 4 | 8` layers, and widths `16 | 64 | 256`
to be drawn as `2 | 4 | 8` units.

## Goals / Non-Goals

**Goals:**
- One picture, correct in its layer count, honest about its widths, redrawn from the values
  already in `ConfigureTask`'s state.
- The mapping declared and validated, so a malformed diagram refuses at load like
  everything else.
- No knob id in screen code, and a second lesson drawing its own architecture unchanged.

**Non-Goals:**
- Drawing regularization or dropout. Both are knobs a student turns, and greying dropped
  units is an obvious follow-up, but it is a different picture with a different teaching
  claim behind it and it should get its own spec.
- Weights, activations, gradients, or anything that changes during training. The diagram is
  of an architecture, not of a run.
- Animating the redraw. A student changing a knob should see the new network, not a
  transition.
- Mobile layout beyond stacking the two columns. Laptop-first, per the project definition.
- Making the drawn widths configurable by the student.

## Decisions

**The mapping lives in the declaration, and is validated there.**
`TaskDeclaration` gains an optional `diagram` block; `validate.ts` gains a `checkDiagram`
that runs only when the block is present, in the same style as `checkPolicy` and
`checkPayoffs`. The alternative — reading the block in the component and coping with
whatever it finds — was rejected because it puts the one part of a declaration that is not
checked at load into the one place that cannot report a load failure: a student would meet
a malformed diagram as a blank column halfway through a lesson. `checkDiagram` needs the
knob *declarations*, not just their ids, so it reads `input.knobs` itself and reports
nothing when the knobs are already malformed — those issues are the cause and repeating
them per knob would bury it.

**`unitsShown` is an object keyed by the width knob's declared values.**
JSON object keys are strings, so the apple block reads `{ "16": 2, "64": 4, "256": 8 }` and
lookup is by `String(value)`. Validation requires a key for every value the knob permits,
which is what makes "a width with no drawn count" impossible rather than merely unlikely.
The alternative, a list positionally aligned to the knob's `values`, couples two arrays by
index and reads as a puzzle in the JSON.

**The output layer comes from the declared categories, not from the block.**
This is a deliberate departure from the block sketched when this change was agreed, which
had an `outputsShown`. A network really does have one output per category, so declaring the
number separately creates a second source of truth that can disagree with `categories` —
and when it does, nothing can say which is right. Deriving it means the output layer is the
one part of the drawing that is literally true, and a task adding a category gets a fourth
output unit for free. Inputs stay declared, because the real input is a 128px image and
there is no small number to derive from: any count drawn is an authored abstraction.

**The architecture is resolved in `src/task/`, drawn in `web/src/`.**
A new `src/task/diagram.ts` exports a function from `(declaration, knob values)` to a
plain shape — input count, a list of hidden-layer unit counts, output count, plus the
declared width value and the two knob labels needed for the disclosure. The component
receives that and does geometry only. This follows the split the codebase already has:
`web/src/model/run.ts` is a door into the engine rather than a place where rules live, and
`src/` stays framework-free and testable under the node environment. It also means the
"which knob, what count" resolution is tested next to the validator that guarantees its
input, instead of through a DOM.

**Nothing is drawn beside a configuration that does not resolve.**
The resolver returns nothing when the current values are not permitted by their knobs, and
the screen draws no diagram in that case — it is already showing "These settings cannot be
used" from `identifyConfiguration`. Defensive rather than reachable: `KnobControl` offers
only declared values. The alternative, drawing a best-effort network next to a refusal,
would show a student an architecture the engine has just said it will not run.

**Inline SVG with a computed `viewBox`, not canvas and not DOM elements.**
The drawing is a few hundred circles and lines with no pixel requirements, so canvas buys
nothing and costs the accessible name the spec requires. Positioned `div`s would need the
edges drawn as rotated elements. SVG gives line primitives, one `role="img"` with an
`aria-label` composed from the declaration, and — because the `viewBox` is computed from
the layer count and the widest layer while the element itself is sized in CSS — the picture
scales to whatever the column is instead of overflowing it. Worst case with the apple
knobs is 8 hidden layers of 8 units: `3×8 + 7×(8×8) + 8×3`, under 500 lines, re-created on
each knob change. That is nothing to React at this size, so no memoization until something
measures slow.

**Two columns inside `ConfigureTask`, within the existing 46rem.**
The settings fieldset and the diagram become a grid of `minmax(20rem, 1fr)` and
`minmax(15rem, 20rem)`, collapsing to one column under a breakpoint. Widening `main` was
considered and rejected: it is a global change that would re-flow the farm overview and the
report to buy room on one screen, and the proposal's claim is that nothing else moves. The
cost is a dense diagram at eight layers, which the `viewBox` handles by shrinking rather
than clipping.

**The disclosure is composed from declared labels, never from ids.**
The copy names the width knob's declared label and its current value — "64" — and says the
drawn units are a stand-in for it while the layer count is exact. Because it is built from
`knob.label`, the screen passes `no-task-specific-code` unchanged. One concrete trap worth
naming, having already cost time on `training-browser`: that test also fails on `width:` in
a CSS-in-JS style object, since `width` is a declared knob id. SVG presentation
*attributes* (`width={…}`, `height={…}`, `viewBox={…}`) do not match the pattern, so the
drawing sizes itself with attributes and with the stylesheet, not with inline style objects.

## Risks / Trade-offs

- **Eight layers of eight units in a 15–20rem column is dense.** → The `viewBox` scales it
  down rather than clipping, and the density is arguably the lesson: eight fat layers
  *should* look like a lot of machine next to two thin ones. Revisit the column width once
  it is on screen at the extreme setting.
- **An abstracted width can mislead exactly the student it is meant to help** — "I set 256
  and it drew 8". → The spec requires the true value on screen next to the statement that
  the widths are stand-ins, and the layer count is explicitly *not* disclaimed so the two
  do not blur together.
- **The apple declaration gains a field, and its tests assert over that file.**
  `test/apple-harvest.declaration.test.ts` and `test/validate-declaration.test.ts` both
  read the shipped declaration. → The block is optional, so no existing required-field
  assertion changes; the work is adding coverage, not editing it. Confirm rather than
  assume, since the shipped declaration is the input to several suites.
- **A validated-then-drawn contract means the resolver has branches nothing can reach.** →
  They return "no diagram" rather than throwing, which is the same choice
  `web/src/data/pool.ts` made for its unreachable placement failure, and for the same
  reason: the promise should not rest on the branch being unreachable.
- **Two more things to keep in step: a declaration field and a spec.** → Both are covered
  by `task-contract`, which is where the rest of the declaration's rules already live, so
  there is no new place to look.

## Migration Plan

Additive. A task without a `diagram` block behaves exactly as today, which is every task
until the apple declaration gains one in the same change. Rollback is removing the block
from the declaration — the diagram disappears and nothing else notices — or removing the
column from `ConfigureTask`. No data migration, no artifact regeneration, and no change to
configuration identity, so every precomputed configuration id stays valid.

## Open Questions

Deferrable: none of these changes the specs, the approach, or the task breakdown.

- **How much room the diagram column really wants**, once eight layers are in it. The
  answer is a CSS number, best chosen with the extreme setting on screen.
- **Whether dropout should grey out units.** Probably wanted, needs no new declaration
  beyond naming the knob, and belongs in its own change with its own teaching claim.
- **Whether the input layer should be labelled as pixels.** It is an abstraction of a
  128px image, and saying so may help or may just add words.

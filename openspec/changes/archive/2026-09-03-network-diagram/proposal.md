## Why

The whole lesson is that network capacity has consequences — that stacking layers and
widening them buys the ability to memorise 200 training apples instead of learning what
makes an apple ripe. Right now that object is invisible. A student meets it as two
dropdowns reading "Hidden layers: 4" and "Neurons per layer: 64", and unless they already
know what those words denote, they are turning dials on a black box and reading earnings
afterwards.

A picture of the thing being configured is the cheapest way to make the knobs mean
something before any theory is read. It also makes the coming lesson legible in advance:
a student who has watched the network grow from two thin layers to eight fat ones has
somewhere to put "it memorised the training set" when the report says so.

This is additive and unblocked. It needs no predictions, no pool and no scoring — only the
knob values already on screen.

## What Changes

- Add an **architecture diagram beside the settings** on the configuration screen, drawn
  from the current knob values and redrawn as they move, so the picture is never a
  description of a configuration the student has already left.
- Draw the **hidden-layer count faithfully**: a knob reading 4 draws four hidden layers.
- Draw the **units per layer abstractly**, from a mapping the task declares — 16 units as
  2 circles, 64 as 4, 256 as 8. 256 circles cannot be drawn at any useful size, and a
  diagram that tried would be a smear rather than a picture.
- **Say that the widths are abstractions.** A student who reads eight circles as eight
  neurons has been misinformed by the screen, which is the same failure the fixture
  disclosure and the browser's pool notice exist to prevent. The layer count is exact and
  the width is a stand-in, and the screen says which is which.
- **Connect adjacent layers fully**, in the classic way feed-forward networks are drawn,
  because that is the picture a student will meet everywhere else.
- Derive the **output layer from the declared categories** — one unit per category — so it
  needs no declaration of its own and is the one part of the drawing that is literally
  true.
- Put the **knob-to-architecture mapping in the task declaration**, as an optional
  `diagram` block naming which knob sets the depth, which sets the width, and what each
  of that knob's values should draw. Screen code therefore names no knob id, per
  `simulator-shell`'s standing rule, and a task that declares no diagram simply gets none.
- **Validate that block like every other part of a declaration**: a diagram naming a knob
  the task does not declare, or leaving one of that knob's values unmapped, refuses at load
  with the cause named rather than drawing a network with a hole in it.

## Capabilities

### New Capabilities
- `network-diagram`: what a student sees of the architecture their knob values describe —
  which parts of the drawing are faithful, which are abstractions and how that is
  disclosed, how it responds as knobs move, and what happens for a task that declares no
  diagram.

### Modified Capabilities
- `task-contract`: gains a requirement for the optional `diagram` block — what a task may
  declare about how its architecture is drawn, and that a declared-but-malformed block is
  refused with its cause rather than partially honoured. The existing completeness
  requirement is unchanged: the block is optional, so no existing declaration becomes
  invalid.

## Impact

- New spec `network-diagram`, and a delta on `task-contract`.
- `src/task/types.ts` and `src/task/validate.ts` gain the block and its validation;
  `declarations/apple-harvest.json` gains one. No other engine change: configuration
  identity, the decision policy and scoring are untouched, and a run computes exactly what
  it computes today.
- A new component under `web/src/components/`, a layout change to `ConfigureTask` to seat
  it beside the settings fieldset, and grid styles. `simulator-shell`'s four stages are
  literally unchanged — this is content on the configuration screen, not a new stage.
- Laptop-first, as the project definition has it. The diagram is a secondary column beside
  the settings on a laptop; narrow viewports stack it under them rather than breaking.
- Independent of `prediction-artifacts`, `training-simulation` and `harvest-scoring`. It
  blocks nothing and is blocked by nothing.

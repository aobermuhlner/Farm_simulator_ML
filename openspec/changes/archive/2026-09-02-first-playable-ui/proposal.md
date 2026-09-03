## Why

The task contract makes a bet that nothing has yet tested: that a lesson is data, and
adding one touches no screen code. Two of its requirements — the configuration screen is
rendered from knob declarations alone, and the farm overview lists tasks from their
declarations — describe screens that do not exist. The engine under `src/` is complete
and tested headlessly, but no pixel has ever been drawn from a declaration.

Everything downstream is expensive and hard to unwind. `dataset-generation` authors
roughly a thousand images and `prediction-artifacts` shapes a hundred-odd configurations
against a frozen knob set. If a knob declaration turns out to carry too little to render
a usable control, or the report needs a number the contract does not produce, the cheap
moment to learn it is now — against ten fixture images — not after that authoring is
done and keyed to the contract.

A thin slice also ends the state where the project has no runnable artifact at all.

## What Changes

- Add a **Vite + React + TypeScript** app that builds to a static bundle, deployable to
  GitHub Pages, resolving the tech stack `task-abstraction/design.md` deferred until the
  abstraction settled. It has settled.
- Build four screens over the **existing engine, consumed unchanged**: a farm overview
  listing tasks from their declarations, a configuration screen generated from knob
  declarations, a run, and a report. `src/task/`, `src/policy/` and `src/scoring/` are
  imported, not rewritten or duplicated.
- Render the report as the **payoff table filled with counts** — per true-category and
  chosen-action cells alongside total earnings — so the over-selective configuration is
  diagnosable rather than reduced to one number.
- Surface every **engine refusal as a first-class screen state**. The engine already
  refuses out-of-range knob values, unknown configurations, version mismatches and
  malformed distributions by naming the cause; the UI shows that cause instead of a
  blank page or a plausible-looking wrong number.
- **Extend the prediction fixture** to cover the declared default configuration and a
  few neighbours, so the app has a working happy path on load. The fixture currently
  holds 2 of 108 configurations and none of them is the default. The other ~100 remain
  deliberately absent and exercise the refusal path above.
- Add **task-level and knob-level teaching copy** behind help affordances, as the
  contract already requires it to be declared.

Not in this change: training replay and loss curves (`training-simulation`), real images,
pool manifests and sprite atlases (`dataset-generation`), harvest sampling and its
variance (`harvest-scoring`), final payoff values (`harvest-scoring` owns those; the ones
in the declaration today are placeholders), mobile layout, and deployment automation.
The slice runs on fixtures and says so.

## Capabilities

### New Capabilities
- `simulator-shell`: the screens a student moves through — farm overview, configuration,
  run, report — and how each is derived from task declarations rather than written per
  task. Includes how engine refusals are presented and how a task's declared teaching
  copy reaches the student.

### Modified Capabilities
<!-- None. `task-contract` and `decision-policy` already specify the behaviour this
     change implements; this slice tests them rather than altering them. If building
     the screens reveals that a declaration carries too little to render, that gap is
     a `task-contract` delta raised then, not assumed now. -->

## Impact

- **New**: `openspec/specs/simulator-shell/spec.md`; a `web/` (or `src/ui/`) app tree,
  `index.html`, and a Vite config; React, React DOM and the Vite toolchain as the first
  runtime dependencies this repository has taken.
- **Changed**: `package.json` gains `dev`, `build` and `preview` scripts alongside the
  existing `test` and `typecheck`. `test/fixtures/apple-predictions.json` gains
  configurations — it stays a fixture, and `prediction-artifacts` still owns the real
  artifact and the shaping that produces it.
- **Unchanged**: everything under `src/task/`, `src/policy/` and `src/scoring/`, and
  `declarations/apple-harvest.json`. If this change needs to edit them, the abstraction
  did not hold and that is the finding.
- **Downstream**: `prediction-artifacts` and `dataset-generation` gain a real consumer to
  validate against instead of only tests. `training-simulation` and `harvest-scoring`
  gain screens to extend rather than screens to invent.
- **Risk**: a fixture-backed UI can mislead about real scale — ten images and a handful
  of configurations say nothing about a thousand images or a sprite atlas. Mitigated by
  keeping the slice explicitly labelled as running on fixtures, and by treating no
  performance conclusion from it as transferable.

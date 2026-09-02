# STUB — not yet authored

Scaffolded during the 2026-09-02 exploration session. Depends on `task-abstraction`,
which is complete: read its `design.md` and both specs under `specs/` before filling
this in.

## Why

Running a month is where the lesson lands. `decision-policy` already requires that a run
report counts per category-and-action combination alongside total earnings; this change
defines the run itself — sampling, presentation, and how the report is read.

## What Changes

- Define the month run: sample roughly 20% of the evaluation pool as "this harvest",
  per the project definition.
- Decide how sampling variance is handled. Fresh sample per run makes the same
  configuration pay differently each time. Either hide it with a fixed seed, or lean in
  and teach evaluation noise by letting students run several months and see the spread.
  Leaning in only works if the spread is visibly smaller than the difference between
  configurations — a numbers question, answerable once payoff values exist.
- Present the report as a farm sales breakdown that is structurally a confusion matrix
  with money attached.
- Set the payoff values for the apple task.
- Guard against the diagnosis trap: an over-selective configuration scores well on wormy
  apples for entirely the wrong reason — it rejects nearly everything. A single earnings
  number would let a student conclude "low regularization detects worms well".

## Capabilities

### New Capabilities
- `harvest-run`: provisional. How a month is sampled, scored, and reported, and how
  sampling variance is surfaced.

### Modified Capabilities
<!-- To be determined. May modify decision-policy if reporting needs more than counts. -->

## Impact

To be determined. Consumes the payoff table and policy from `task-abstraction`, the
distributions from `prediction-artifacts`, and the pool from `dataset-generation`.

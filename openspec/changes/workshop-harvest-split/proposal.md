# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §3 and §5.2, and from `CLAUDE.md`'s "Two
separated phases: workshop, then harvest", which commits to this already. Depends on
`progression-catalog` for the market it wedges in. Read
`openspec/specs/simulator-shell/spec.md`'s *The student moves through overview,
configuration, run and report* — that requirement is what this change rewrites.

## Why

Today a student presses "run a month" straight from the knobs. That conflates two
different questions — *is my model any good* and *did the farm make money* — and it means
the better diagnostic, the loss curve and the train-versus-held-out gap, never gets read
at all. It also makes the harvest feel like a slot machine: a button you press again when
you do not like the number.

Splitting the year into three phases fixes both. The workshop is free and unlimited, so
hypotheses are cheap. The harvest is one deliberate act per year, so it is a decision the
student defends rather than a roll they repeat.

## What Changes

- Three phases per year (§3): **workshop** — free, repeatable, no money moves; **market**
  — spend, irreversible; **harvest** — one commitment per year.
- The workshop holds what already exists: browse the training split, tune knobs or build
  a model, replay the run, read the train-versus-held-out figures. Nothing there costs
  anything, and that is a requirement rather than an accident.
- Running the harvest is reached from the farm overview (§5.2), not from the knobs, and
  becomes available only once every available task has a model that resolves. Until then
  the button is visible and greyed with the reason named.
- The harvest is confirmed before it runs and cannot be re-run within the same year.
- Money moves only in the market and at the harvest.
- Deliberately out of scope: what the harvest samples, what it pays, and what its report
  says. That is all `harvest-scoring`. This change is the navigation and the commitment.

## Capabilities

### New Capabilities
<!-- None expected. This restates how the shell's stages relate. -->

### Modified Capabilities
- `simulator-shell`: provisional. The four-stage walk becomes the year loop, with the run
  gated on a resolvable model, reached from the overview, and committed rather than
  repeatable.

## Impact

To be determined. Routing and screen composition in `web/src/`, plus whatever holds the
"already harvested this year" flag — which belongs in the save from
`progression-catalog`. No engine change, no pool change, no artifact change.

This change is not in `Game_design.md` §11's table, which folds the year loop into
`harvest-scoring`. It is split out because `harvest-scoring` is already carrying
sampling, payoffs, delivery terms and the report, and because the market and sorting
screens need somewhere to live before the harvest is specified.

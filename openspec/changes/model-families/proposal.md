# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §6.2, which calls this "the one big change".
Depends on `progression-catalog`. Read `openspec/specs/model-architecture/spec.md` —
*A task declares an architecture family* is the requirement this change generalizes — plus
`openspec/specs/task-contract/spec.md`, `openspec/specs/network-diagram/spec.md`'s *Each
family's drawing is separately mountable*, and `openspec/specs/prediction-artifacts/spec.md`
in full.

## Why

Today a task declares *one* architecture family: one knob list, one diagram, one
prediction artifact. The ladder needs a task to offer several — a hand-written tree, a
fitted tree, a forest, a convolutional network — and the student to move up it by buying.

The load-bearing distinction is not what the models are, it is where a prediction comes
from. A convolutional network's predictions are looked up in a frozen artifact keyed by
configuration id. A hand-written tree's are evaluated live in the browser over measured
features: no artifact, no training, no download. Put both behind one interface and
everything downstream — the decision policy, the payoff table, the report — consumes a
distribution and neither knows nor cares which kind produced it. Written once, it serves
the whole ladder.

Without this abstraction every rung would grow its own report screen, and the
`no-task-specific-code` invariant would be the first thing to go.

## What Changes

- A model family becomes a declared entity: id, its own knobs, its own diagram, its
  catalog entry, its teaching copy, and its **prediction source** — `artifact` or `live`.
- A task declares several families with one active; the student chooses among the ones
  they own. Which family is active is saved state.
- A family registry and the two evaluators, behind a single
  `predict(image, config) -> Distribution`.
- Per-family knob values are remembered independently, so tuning the network does not
  lose the tree.
- Configuration identity stays scoped to its family, so one family's ids can never
  collide with another's and the shipped convolutional artifacts keep resolving
  unchanged. This is the compatibility requirement that makes the change safe.
- The untrained refusal applies only to artifact-backed families. A live family has no
  coverage and cannot refuse that way, so the refusal taxonomy from
  `progression-catalog` — locked, untrained, invalid — gains a fourth case worth naming:
  not applicable.
- `network-diagram` already requires each family's drawing to be separately mountable, so
  this generalization is anticipated rather than new. Confirm that and say so.
- The invariant extends: no screen names a model family.

## Capabilities

### New Capabilities
- `model-families`: provisional. A family as a declared entity, the artifact-versus-live
  prediction source, and the single interface everything downstream consumes.

### Modified Capabilities
- `model-architecture`: provisional. *A task declares an architecture family* becomes
  several families with one active, and the convolutional requirements become statements
  about one family rather than about the task.
- `task-contract`: provisional. Task declaration completeness, knob declarations and
  configuration identity are all currently written against a single family.

## Impact

To be determined. New `src/families/`, `declarations/families/*.json`, a family picker on
the configuration screen, and a reshaped declaration schema with its validator. Reads
`src/features/` for the live evaluator (`measured-features`) and the frozen artifacts for
the other. No retraining: the existing convolutional artifacts must resolve unchanged,
which is a test, not an intention.

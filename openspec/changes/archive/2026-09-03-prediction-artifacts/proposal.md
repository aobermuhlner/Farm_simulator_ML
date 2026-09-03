# Ship real prediction artifacts, trained

## Why

Every contract the simulator needs is in place — `src/task/artifact.ts` resolves a
configuration id to a probability distribution per image and a per-epoch history, and
`src/scoring` scores from it — but nothing has ever been trained. Runs are scored from
`test/fixtures/apple-predictions.json`: nine hand-written configurations over ten
invented image ids, with loss curves typed by hand. The 200/1000 image pool
`dataset-generation` produced is browsable but has no predictions at all, which is why
`web/src/data/paths.ts` still points the app at the fixture and the training browser has
to tell students that what they are looking at is not what their run scored.

Until real models exist, no lesson can be checked. Whether a 4-block stack at zero
regularization actually overfits the authored training band is currently an assertion in
a spec, not an observation.

## What Changes

- Add a training workspace: Python 3.11+ with PyTorch on CPU, under `training/`, run by
  hand. It is authoring tooling, not part of the web build, and the browser continues to
  train nothing.
- Train **three configurations only** to start: the smallest stack, `blocks` = 2, at each
  declared width `channels` ∈ {8, 16, 32}, with the regularization knobs at their declared
  defaults (`regularization1-dropout0`). This is the set the opening lesson can actually
  select: per the game design the farmer starts with the smallest model he can afford, so
  depth and the two regularization knobs are shown but not yet turnable, and width is the
  one thing a student varies. The full 108-configuration grid is a later run, unlocked
  alongside the knobs that reach it.
- Move the `blocks` knob's declared default from 3 to 2, so the configuration a student is
  first offered is the smallest stack — and, as this spec requires, one the shipped
  artifact covers.
- **Hold out a validation slice inside the 200-image training split**, declared in the
  pool manifest and reproducible from the pool seed, so `trainLoss` and `valLoss` are
  measured rather than invented. (Measured: the two curves track each other, because the
  held-out images share the fitted images' authored band. The generalization gap lives
  between the training split and the evaluation pool — see `design.md`.) Image ids do not change — `image-pool` requires that
  regeneration not renumber, so prediction artifacts stay resolvable.
- Define the on-disk encoding: probability quantization, file layout under the
  `predictions` path the declaration already names, the per-epoch history shape, and the
  schema version stamped into each artifact.
- The trainer reads pixels by cropping the atlas each manifest entry names, resolving
  regions with the same rule `src/pool/` already applies, and refuses rather than
  guessing when an entry or region will not resolve.
- Ground truth continues to live only in the manifest. The artifact carries
  distributions, never labels and never a chosen action.
- Switch the app's scoring input from the fixture to the generated pool and the trained
  artifact, which retires the training browser's "not the images your run scored"
  notice for the apple task. The fixture stays as a test fixture.
- Record the authoring loop in one place: train for real, review the resulting curves and
  distributions against the intended lessons, and record any deliberate shaping as a
  reviewed step — not as fudge factors spread through the trainer.
- Freeze the apple knob set as declared — `blocks`, `channels`, `regularization`,
  `dropout` — closing `task-abstraction/design.md`'s open question of one composite
  regularization knob or two. The declaration already answers it; this records it as
  settled rather than incidental.

Not in scope: the animated epoch replay and the loss-curve drawing a student sees, which
is `training-simulation`; the remaining 105 configurations; and shipping model weights,
which the browser never needs because inference is precomputed.

Also not in scope, and scaffolded as `knob-availability`: the mechanism that shows a
locked knob greyed out rather than turnable. This change trains what that mechanism will
open with and leaves the declaration's value lists as they are — until it lands, a knob
combination outside the trained three is offered and refuses as untrained, which is
exactly the refusal this spec defines.

## Capabilities

### New Capabilities
- `prediction-artifacts`: how a configuration's predictions and training history are
  produced, encoded, versioned and shipped — the trained-model pipeline and the file
  contract it writes, including which configurations a shipped artifact must cover and
  how a partial artifact refuses.

### Modified Capabilities
- `image-pool`: the training split gains a declared validation slice. The spec currently
  requires exactly two splits of fixed size; it must instead admit a reproducible role
  within the training split, keep the browsable 200 intact, and keep image ids stable
  across the regeneration that adds it.

`task-contract` is deliberately **not** modified. Its history shape already carries
`trainLoss` and `valLoss`, and validation images stay under the `training` key of the
artifact's predictions — they are training-split images playing a role, so a third split
name would duplicate what the manifest declares.

## Impact

- New: `training/` (trainer, pinned requirements, per-run checkpoints and review plots
  kept out of the shipped bundle), and the generated artifact under the `predictions`
  path `declarations/apple-harvest.json` already declares.
- Changed: `tools/pool/manifest.ts` and the regenerated `pools/apple-harvest/manifest.json`
  to declare the validation slice; `declarations/apple-harvest.json` for the `blocks`
  default; `web/src/data/paths.ts` and `DATA_MOUNTS` to serve and copy artifacts;
  `vite.config.ts` follows that table.
- Depends on `dataset-generation` (complete). Consumed by `training-simulation` and
  `harvest-scoring`, both still stubs.
- New toolchain dependency: a Python toolchain, kept out of the Node project. `training/` is
  its own uv project pinned to CPython 3.12 with CPU-only torch wheels; uv supplies the
  interpreter, so the system Python 3.6.4 is not used and nothing needs installing by hand.
  Measured cost on this machine: under a minute per configuration for 40 epochs, so the
  three-configuration scope above is a reviewability decision rather than a compute one.

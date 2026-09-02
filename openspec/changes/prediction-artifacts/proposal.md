# STUB — not yet authored

Scaffolded during the 2026-09-02 exploration session. Depends on `task-abstraction`,
which is complete: read its `design.md` and both specs under `specs/` before filling
this in.

## Why

`task-abstraction` requires per-image probability distributions and per-epoch training
histories, keyed by configuration id, for both the training split and the evaluation
pool. This change defines how those artifacts are encoded, generated, shaped, and
shipped as static files.

## What Changes

- Freeze the apple task's knob set and value ranges, resolving the open question in
  `task-abstraction/design.md`: one composite regularization knob or two.
- Define the on-disk encoding for prediction distributions, including quantization and
  file layout, and the encoding for per-epoch training histories.
- Define the authoring and shaping process — how the intended teaching outcomes are
  produced and reviewed in one place.
- Define the schema version stamped into each artifact.

## Capabilities

### New Capabilities
- `prediction-artifacts`: provisional. The encoding, versioning, and generation contract
  for precomputed prediction distributions and training histories.

### Modified Capabilities
<!-- To be determined. May modify task-contract if the encoding forces contract changes. -->

## Impact

To be determined. Consumed by `training-simulation` and `harvest-scoring`; depends on
the image pool defined in `dataset-generation`.

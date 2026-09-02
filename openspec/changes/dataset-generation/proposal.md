# STUB — not yet authored

Scaffolded during the 2026-09-02 exploration session. Depends on `task-abstraction`,
which is complete: read its `design.md` and both specs under `specs/` before filling
this in.

## Why

The apple task's two teaching points only appear if the data is engineered to produce
them. An under-regularized model becomes over-selective because the training reds were
uniform; an over-regularized model eats the wormy apples because it learned only
"is it reddish". Neither emerges by accident — the gap between the training split and
the evaluation pool has to be deliberate.

## What Changes

- Decide how apple images are produced: generated then augmented, per the 2026-09-02
  decision. The generator choice is downstream of the parameterization.
- Define the controllable attributes the lessons depend on — hue, roundness, gloss,
  lighting, worm presence and subtlety — so the distribution gap is authored, not lucky.
- Specify the deliberate training-split vs evaluation-pool difference: few uniform reds
  in training, varied reds in the pool; obvious worms in training, subtle worms on
  otherwise-perfect reds in the pool.
- Define the pool manifest and image delivery, including sprite atlasing so a pool of
  ~1000 images is not ~1000 requests.
- Make the training split browsable, as the project definition requires.

## Capabilities

### New Capabilities
- `image-pool`: provisional. What an image pool declares, how its splits differ, and how
  images and ground-truth labels are delivered to a static client.

### Modified Capabilities
<!-- To be determined. -->

## Impact

To be determined. Provides what `task-contract`'s `pool` reference points at, and the
inputs `prediction-artifacts` generates against.

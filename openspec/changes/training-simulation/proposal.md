# STUB — not yet authored

Scaffolded during the 2026-09-02 exploration session. Depends on `task-abstraction`,
which is complete: read its `design.md` and both specs under `specs/` before filling
this in.

## Why

Per the 2026-09-02 decision, the simulator replays a configuration's training run —
animated epochs and loss curves — rather than training anything. This is not decoration.
The loss curves are the student's *first* diagnostic: they read the curve, form a
hypothesis, then run the harvest and get confirmed or surprised. That is a better
learning loop than earnings-only feedback.

```
  no regularization                     regularization too strong
  loss                                  loss
   |  \                                  |  \
   |   \___ train                        |   \___ train  --.
   |    \                                |    \___ val   --'  both stall high
   |  ___/  val   <-- divergence         |
   +-------------- epochs                +-------------- epochs
      "memorizing"                          "can't fit anything"
```

## What Changes

- Define the replay behaviour: epoch progression, curve rendering, pacing, and what a
  student can do mid-replay.
- Distinguish what is read from the precomputed training history versus what is computed
  for display.
- Settle the honesty wording. "Replaying this configuration's training run" is accurate;
  "training your model now" is a claim students may later catch. This was flagged as a
  decision to record deliberately, not to default into.
- Pair the curves with the train-versus-harvest accuracy gap, which is the clearest
  overfitting visual available.

## Capabilities

### New Capabilities
- `training-replay`: provisional. How a configuration's stored training history is
  presented as an animated run, and what claims the presentation makes about it.

### Modified Capabilities
<!-- To be determined. -->

## Impact

To be determined. Reads training histories keyed by configuration id from
`prediction-artifacts`.

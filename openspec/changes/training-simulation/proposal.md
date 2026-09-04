# STUB — not yet authored

Scaffolded during the 2026-09-02 exploration session; re-scoped 2026-09-04 against
`Game_design.md` §1.1, §2 (rung 4) and §3. Depends on `model-families` — the replay is one
family's workshop diagnostic, not the workshop's only one — and on
`workshop-harvest-split`, which is what makes it free and repeatable. Read
`openspec/specs/prediction-artifacts/spec.md`'s *The training history is measured on the
declared roles* and the archived `2026-09-04-held-out-generalization` change.

## Why

Per the 2026-09-02 decision, the simulator replays a configuration's training run —
animated epochs and loss curves — rather than training anything. This is not decoration.
The loss curves are the student's *first* diagnostic: they read the curve, form a
hypothesis, then run the harvest and get confirmed or surprised. That is a better learning
loop than earnings-only feedback.

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

The gap those curves promise now genuinely exists: `2026-09-04-held-out-generalization`
draws the held-out images from the harvest's distribution, so the two curves separate
because the separation is real and not because the screen implies it.

## What Changes

- Define the replay behaviour: epoch progression, curve rendering, pacing, and what a
  student can do mid-replay.
- Distinguish what is read from the precomputed training history versus what is computed
  for display.
- Settle the honesty wording. "Replaying this configuration's training run" is accurate;
  "training your model now" is a claim students may later catch. This was flagged as a
  decision to record deliberately, not to default into, and §1.1 makes it a rule rather
  than a preference: a visible simplification is disclosed on screen, because a student
  who catches the game lying about a mechanism stops trusting its claims too.
- Pair the curves with the train-versus-held-out accuracy gap, which is the clearest
  overfitting visual available and now has something to show.
- **Only artifact-backed families have a history to replay.** A live family's workshop
  diagnostic is its mistakes list (`decision-tree-builder`) instead. The workshop must
  present whichever the active family declares, without naming either — which is the
  `no-task-specific-code` invariant applied to a new noun.
- The replay is a workshop activity: free, unlimited, and no money moves. That is a
  requirement, because it is what makes forming hypotheses cheap.

## Capabilities

### New Capabilities
- `training-replay`: provisional. How a configuration's stored training history is
  presented as an animated run, and what claims the presentation makes about it.

### Modified Capabilities
- `simulator-shell`: provisional. The workshop selects a diagnostic from the active
  family's declared prediction source.

## Impact

To be determined. Reads training histories keyed by configuration id from
`prediction-artifacts`. A screen and a small amount of animation state; no engine
arithmetic beyond what the history already holds.

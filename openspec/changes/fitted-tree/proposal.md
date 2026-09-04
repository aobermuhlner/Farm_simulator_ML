# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §2 (rungs 2–3). Depends on
`decision-tree-builder` and `dataset-tiers`. Read the archived
`2026-09-04-held-out-generalization` change before filling this in — it is the precedent
for making a train/held-out gap real rather than asserted, and this change has to do the
same thing for a different model family.

## Why

This is where the game first says *the data can find a better threshold than you did* —
and immediately after, *and it will happily find one that only works on the photos it was
shown*. That is the cleanest introduction to the train/test gap available, and it lands
before any neural-network vocabulary is on screen, over a model the student can still read
end to end.

It is also the first purchase that makes the bought dataset visibly matter, which is why
it belongs before the network rather than being the first thing cut for scope. A student
who meets overfitting on a depth-4 tree meets it as a property of *fitting*, not as a
quirk of neural networks.

## What Changes

- A fitted-tree family with depth as its capacity knob. Depth is capacity, and the
  train-versus-held-out gap widens with it — which is the lesson, so the gap has to be
  measured and recorded, not assumed.
- **The prediction source is the decision.** Artifact-backed means fitting offline for
  every (depth × dataset tier) and shipping the distributions, consistent with the
  network and cheap to serve. Live means fitting in the browser from the manifest's
  feature vectors — no artifact at all, but a real fitting algorithm in the client and a
  claim that it genuinely trains, which would then be true. Both are defensible;
  `model-families` supports either.
- It must clear §2's floor: genuinely a bit better than the hand-written tree, enough that
  the upgrade visibly pays back within a year, and not so much better that the hand tree
  looks like a waste of the student's afternoon.
- The workshop shows both numbers side by side — agreement on the fitted images and on the
  held-out ones — because "the first time two numbers disagree" is the whole point of the
  purchase (§4.6, Year 6).
- Settles part of §10.2 by shipping: the middle rungs exist.

## Capabilities

### New Capabilities
- `fitted-tree`: provisional. The family, its depth knob, where its predictions come
  from, and the measured gap it is required to exhibit.

### Modified Capabilities
<!-- To be determined. None if the family abstraction from model-families holds; a
     modification to prediction-artifacts if a second artifact-backed family needs
     anything the coverage rules do not already say. -->

## Impact

To be determined. A family declaration, an evaluator or a fitting step under `training/`,
catalog entries, and the measured gap recorded the way `training/README.md` records the
network's. If it is artifact-backed, the shipped-artifact provenance and coverage rules
apply unchanged, which is a reason to prefer it.

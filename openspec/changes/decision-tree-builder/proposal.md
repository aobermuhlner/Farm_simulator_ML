# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §2 (rung 1) and §5.4. Depends on
`measured-features`, `model-families` and `dataset-tiers`. Read
`openspec/specs/network-diagram/spec.md`'s *Each family's drawing is separately
mountable* and *The drawing is declared, never assumed* before filling this in.

## Why

Rung 1, and the moment the game earns the word "educative". The student does not tune a
model here, they *write* one: pick a feature, pick a threshold, hang two branches, and the
robot then executes exactly what they wrote on every apple all year.

It is the one point in the whole progression where the model is fully transparent *and*
fully theirs, which is what makes the convolutional network's opacity later feel like a
trade they chose rather than a black box they were handed. A student who has written a
rule and watched it fail on apples they can see understands what a learned feature is
*for* in a way no amount of copy delivers.

Architecturally it is nearly free. The tree runs live in the browser over the manifest's
measured feature vectors, so rung 1 costs zero training compute and zero download, and it
sits beside the artifact-backed network without disturbing it.

## What Changes

- A tree editor (§5.4): each internal node a declared feature and a threshold, each leaf
  a declared action. It renders from the declared feature list and the declared action
  list and names neither.
- A live family, registered through `model-families`, evaluating the tree over measured
  features. No artifact, no training history, nothing precomputed.
- **The node budget is a purchase.** Three splits to start, more cost money, bought
  through the same catalog as everything else — the same "capacity is bought, not given"
  mechanic `CLAUDE.md` commits to for the convolutional blocks. Reusing it across families
  is what makes the economy feel like one system rather than two.
- The workshop diagnostic for rung 1: agreement with the labels on the dataset the student
  owns, and a way into the photos the tree gets wrong, shown next to their labels. That
  plays the role the loss curve plays for rung 4, and it is the moment the dataset stops
  being an inventory item and becomes something the student looks at.
- The tree is saved state, remembered across years like any other configuration.
- Honesty on screen: this tree runs live, nothing is trained, the student wrote the rules.
  That claim is true here, which is why it is worth saying — it is the contrast that makes
  the replay screen's more careful wording credible.
- The tree's drawing is one more separately-mountable family diagram, and it is a genuine
  diagram rather than an unlabelled graphic: the paths are readable and a specific apple's
  path through it can be traced.

## Capabilities

### New Capabilities
- `decision-tree-builder`: provisional. How a tree is composed, validated, evaluated live,
  budgeted, drawn, and diagnosed against the owned dataset.

### Modified Capabilities
- `network-diagram`: provisional. A tree drawing is a family drawing, which the capability
  anticipates but does not yet describe.
- `simulator-shell`: provisional. The workshop holds a builder as well as a knob panel,
  and which one appears follows the active family.

## Impact

To be determined. A tree spec type and evaluator in `src/families/`, the editor screen,
catalog entries for the node budget, and the tree in the save. Reads `src/features/` and
nothing else — in particular it must not be able to reach a generation attribute, which
`measured-features` makes a structural property rather than a discipline.

# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §2 (rung 1), §5.4 and §6.3. Depends on
nothing. Read `openspec/specs/image-pool/spec.md`'s *Generation attributes are recorded
per image* and *Pool manifest completeness*, and `openspec/specs/training-browser/spec.md`'s
*Generation attributes are not displayed*, before filling this in — the whole point of
this change is the line between those two kinds of number.

## Why

A decision tree needs numbers to split on, and where those numbers come from decides
whether rung 1 teaches anything. The pool already records generation attributes per image
— the parameters that *produced* the apple — and the training browser is already
forbidden from displaying them. Handing them to a tree would let a student build a rule
that reads the answer sheet: a perfect model, learned nothing.

Features measured from the delivered pixels are the honest version. They are noisy and
imperfect, and the noise is itself the lesson: the rule you wrote is only as good as the
measurement it is written over. That is also what makes the later wall true — a tree can
only ask questions about the numbers somebody measured, and nobody measured "the stripes
run lengthwise".

This change is cheap and lands early because it adds no pixel. It is worth doing before
the expensive changes so that `decision-tree-builder` is not waiting on it.

## What Changes

- The pool manifest gains a measured feature vector per image, for both splits: redness,
  greenness, size, roundness, dark-spot area, spot count, texture variance (§5.4's
  feature list is the starting point, not a fixed set).
- Features are computed by the pool tools from the delivered pixels and recorded in the
  manifest, so nothing is measured in the browser and every model sees the same numbers.
- **The separation is the requirement.** A feature must be derivable from the atlas
  alone; a feature computed from a generation attribute is refused, with the feature
  named. This is the rule that keeps rung 1 from reading the answer sheet, and it is
  worth a scenario rather than a comment.
- Feature names, units and ranges are declared with teaching copy, because a student
  picks a threshold on them and has to know what 0.06 means. The tree builder renders the
  feature list from the declaration and names no feature itself.
- No pixel changes, so no retraining. But the manifest does change, and `image-pool`
  binds pool identity to a version while `prediction-artifacts` binds every artifact to
  the pool that produced it. Whether an additive manifest field bumps the pool version
  and invalidates shipped artifacts, or is explicitly additive, is the decision this
  change has to make rather than discover.

## Capabilities

### New Capabilities
- `measured-features`: provisional. What a measured feature is, how it is computed and
  declared, and why it may not read a generation attribute.

### Modified Capabilities
- `image-pool`: provisional. *Pool manifest completeness* gains the feature vector, and
  the manifest's role as the only source of ground truth has to accommodate numbers that
  are neither ground truth nor generation parameters.

## Impact

To be determined. New feature-measurement step in `tools/pool/`, new manifest fields, a
regenerated (but pixel-identical) manifest, new `src/features/` for reading them, and a
declaration slot for the feature list and its copy. Pool tests gain assertions that the
measured values correlate with but do not equal the generation attributes — a weak check,
and worth thinking about how to make it a real one.

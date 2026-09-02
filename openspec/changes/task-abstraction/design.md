## Context

See `proposal.md` — Why. Requirements are in `specs/task-contract/spec.md` and
`specs/decision-policy/spec.md`; this document covers only how they are met.

Three constraints shape everything below. There is no backend, so every artifact the
simulator reads must be a static file served from GitHub Pages. Model behaviour is
precomputed and deliberately shaped so the teaching points land, so "the model" is
authored data rather than a running computation. And the second planned lesson —
screening where a false positive is cheaper than a false negative — must reuse this
machinery rather than fork it.

The repository currently contains no application code, so there is nothing to migrate
and no existing pattern to conform to.

## Goals / Non-Goals

**Goals:**
- One engine that runs both the apple harvest lesson and the later screening lesson, with
  the difference expressed entirely as task data.
- A configuration identity that is stable, human-readable, and shared by every
  precomputed artifact keyed to it.
- Failure modes that are loud. An educational tool that silently shows wrong numbers is
  worse than one that refuses to start.

**Non-Goals:**
- The on-disk encoding of prediction artifacts — quantization, file layout, chunking.
  That is `prediction-artifacts`.
- The concrete knob values for the apple task, and the images themselves.
  Those are `prediction-artifacts` and `dataset-generation`.
- Screen layout, routing, framework, and deployment. Deferred until the abstraction
  settles.
- Live training or live inference of any kind.

## Decisions

**Store probability distributions, not decisions.**
The alternative — storing the final action per image per configuration — is smaller and
simpler, but it welds the decision rule into the artifact. The screening lesson is
*entirely* about varying that rule, so it would need a second artifact format and a
second scoring path. Storing distributions makes the policy a live computation over
frozen data, which is the seam that lets one engine serve both lessons. The other
alternative, shipping real weights and running inference in the browser, was rejected:
weights per configuration cost megabytes, and outcomes could no longer be shaped.

**Precompute the full knob cross-product rather than anchor-and-interpolate.**
Authoring only a few anchor configurations and interpolating between them would cut
authoring effort, but interpolated distributions produce incoherent per-image behaviour —
an apple would drift in and out of being picked for no visible reason, and students
comparing two adjacent configurations would see noise rather than a lesson. The
cross-product is affordable at the intended scale:

```
  knobs      depth x width x regularization x dropout   ~= 10^2 configurations
  per config test pool + training split, one distribution per image
             ~1200 images x one small distribution       ~= a few KB
  total                                                  ~= hundreds of KB
```

That is small enough to ship whole, so the simpler and more coherent option wins. This
holds only while the knob count stays small and coarse, which is also the pedagogical
requirement — see Risks.

**Configuration identity is a derived readable string, not a hash.**
An identifier composed from knob ids and their values in declared order (shaped like
`d8-w64-r3-do0`) satisfies determinism just as well as a content hash, and is far better
to work with: it is greppable inside artifacts, diffable in version control, and an
author shaping a specific configuration's outputs can find the right rows by eye. A hash
would be opaque at exactly the moment someone needs to hand-adjust data.

**Categories and actions are separate declared sets joined by a mapping.**
Collapsing them — one action per category — would fit the screening lesson (two
categories, two actions) but not the apple lesson, which has three categories and two
actions: red is picked, green and wormy are both declined, and they are declined for
different reasons and carry different payoffs. Keeping the sets separate avoids inventing
fake categories to pad an action list.

**The payoff table is the single structure behind both earnings and the report.**
Scoring sums its entries; the report is the same table filled with counts. Deriving both
from one declaration removes the class of bug where the report explains a number the
scoring did not actually compute. It also means the report is structurally a confusion
matrix with money attached, which is the intended stealth lesson.

**Version mismatch refuses to run.**
Best-effort partial loading — using whatever rows match and skipping the rest — is the
worst available behaviour here, because the result is a plausible-looking harvest that
teaches something untrue. Refusing to start, naming both versions, is recoverable;
quietly wrong numbers are not.

**Tasks are static declaration files validated at load.**
Compiling declarations into the bundle would give build-time checking, but it makes
adding a lesson a code change and defeats the point. The cost of loading them as data is
that a malformed declaration can ship, which is why the completeness, range, and
payoff-table requirements in the specs are enforced at load rather than assumed.

**Both data splits are precomputed, not just the evaluation pool.**
Predictions on the training split cost almost nothing extra and unlock the clearest
overfitting visual available: high accuracy on data the model learned from, sharply lower
accuracy on the harvest. Without the training-side numbers, overfitting can only be
asserted to the student rather than shown.

## Risks / Trade-offs

- **Knob set churn invalidates every precomputed artifact.** → The schema version makes
  the mismatch loud rather than silent, and artifact authoring should not begin until the
  apple task's knob set is frozen. Freezing it is work for `prediction-artifacts`.
- **The cross-product grows multiplicatively, so one extra knob can be expensive.** →
  Keep knobs few and their value sets coarse. This aligns with the product constraint of
  few options per screen, but it is a real ceiling: a fifth knob roughly triples the
  artifact.
- **Runtime-validated declarations can ship broken to students.** → Validation is
  specified as refusal plus a named cause, so a broken task fails visibly in review
  rather than producing a subtly wrong lesson in class.
- **Shaped outcomes can drift into implausibility.** → All shaping stays in one authoring
  step (`prediction-artifacts`) so it is reviewable in one place, and the training replay
  must be worded as a replay rather than as live training (`training-simulation`).
- **The cost-optimal policy is only intuitive if payoffs are in money.** → Payoff entries
  are currency amounts, not abstract points, so expected-payoff reasoning reads as
  ordinary farm economics.
- **A single earnings number invites hill-climbing instead of thinking.** →
  Per-combination counts are a specified output, not an optional extra, so diagnosis is
  always available next to the score.

## Migration Plan

None. This change establishes the first specs in an empty repository; there is no
existing behaviour to preserve and nothing to roll back beyond deleting the artifacts.

## Open Questions

Both are deferrable: the contract holds either way, and neither changes the specs, the
approach, or the task breakdown.

- **Is regularization one composite knob or two (loss-regularization strength and dropout
  separately)?** Two is more honest and more teachable; one composite roughly halves the
  cross-product and the authoring work. Resolve in `prediction-artifacts`, when the knob
  set is frozen.
- **Does the apple task expose a decision threshold at all, or is it highest-probability
  only until the screening lesson introduces thresholds as the new idea?**
  `specs/decision-policy/spec.md` supports either, so this is a curriculum sequencing
  choice rather than a design one.

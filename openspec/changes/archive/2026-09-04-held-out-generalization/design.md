# Design

## Context

See `proposal.md` — Why, for the measurements that motivate this.

Three facts about the current tooling shape the approach.

`tools/pool/sample.ts` authors the split gap in one function, `groupsFor(split)`, as an
explicit partition: 300 of the 500 pool reds are pushed out of band by construction and
exactly 100 of the 250 pool worms are subtle, rather than sampled from a wide range and
counted afterwards. That function is meant to be the shortest available answer to "how do
the two splits differ", and it is the natural place for the held-out populations to live.

`tools/pool/roles.ts` runs *after* sampling, from `ROLE_SEED`'s own generator, and never
touches the stream the images were drawn from. That is what makes roles additive today: a
regenerated pool reproduces the same apples byte for byte and adds a field. The design
note in that file says so explicitly. This change spends that property, deliberately.

`prediction-artifacts` binds an artifact to its pool by three values: pool id, pool schema
version, and pool seed. None of the three changes on its own when the sampling groups
change — so a regenerated pool with the same seed would load a stale artifact silently,
scoring one pool's predictions against another pool's images under the same ids. That is
the exact failure the binding requirement exists to prevent, so the seed has to move.

## Goals / Non-Goals

**Goals:**

- The held-out 40 are a small sample of the harvest, so the fitted-versus-held-out gap a
  run measures is the generalization gap.
- The fitted 160 are unchanged in kind: same narrow band, same obvious worms, same counts.
- A stale prediction artifact refuses loudly rather than resolving against new images.
- The populations stay authored by explicit partition, not by sampling and hoping.

**Non-Goals:**

- Changing the evaluation pool. Its composition, its size and its lessons stay as they are.
- Changing any screen. The replay draws the history it is given; it starts showing a gap
  because the gap starts existing.
- Distinguishing the roles in the training browser. The browser shows the split as one set
  of 200 and displays neither roles nor generation attributes; that stays true.
- Widening coverage. The same three configurations are retrained, not more.

## Decisions

### Roles become sampling groups rather than a post-hoc assignment

The training split's entry in `groupsFor` gains held-out groups drawn from the pool's
distributions, and the role rides on `SampledImage` from the moment it is drawn.
`assignRoles`, `roleCounts`'s current caller and `ROLE_SEED` go away; the manifest still
declares the role per image and the counts per role, so nothing downstream changes shape.

*Alternative considered:* keep the shuffle, then re-draw attributes for whichever ids it
picked. Rejected — the role assignment and the attribute draw would be two places that
have to agree about what a held-out image looks like, and the file that decides roles
would silently decide appearance too. Putting both in `groupsFor` keeps one readable
answer to what each population is.

*Consequence, accepted:* roles are no longer additive over an existing pool. The spec
delta removes the scenario that promised an image keeps its role across regeneration and
replaces it with the reproducibility the seed already gives.

### The pool seed moves

`SEED` is bumped, so the regenerated pool declares an identity the old artifacts do not
match and the existing binding refuses them by seed, naming both values.

*Alternatives considered:* bump the manifest schema version — rejected, the manifest's
shape is not changing, and its version must equal the one the task declares, so the bump
would cascade into `declarations/apple-harvest.json` and from there into every artifact's
schema version, all to signal something that is not a schema change. Rely on the images
changing — rejected, that is precisely the silent case.

### The held-out populations mirror the pool's proportions

Held-out counts stay at 20 red / 10 green / 10 wormy, and each category is partitioned the
way the evaluation pool partitions it:

| | evaluation pool | held out |
| --- | --- | --- |
| red, in band | 200 | 8 |
| red, out of band | 300 | 12 |
| green | 250 | 10 |
| wormy, subtle | 100 | 4 |
| wormy, obvious | 150 | 6 |

Proportional rather than seed-dependent, for the same reason the pool's own populations
are: a lesson that depends on how a draw happened to fall is a lesson that can quietly
stop working.

*Alternative considered:* enlarge the held-out set to 80 so the per-category rates are
less coarse. Rejected — it would halve the fitted wormy population, and the fitted set is
what the lesson about capacity is measured on.

### The band's name follows what it now means

`TRAINING_RED` becomes the fitted band, and `insideTrainingRedBand` follows it. The band
is now a property of one role inside the training split, and a name saying "training" is
exactly the confusion this change exists to remove. `WORM_VISIBILITY.training` moves the
same way. This touches the pool tooling and the tests asserting against the committed
manifest; it touches no shipped code.

## Risks / Trade-offs

- **The measured gap may be narrower than the ~74% the proposal estimates.** → Measure it
  after retraining and record what was measured. `prediction-artifacts` already makes
  shaping a recorded step; reshaping the pool until the number looks good is the thing
  that requirement exists to make visible, not a fallback.
- **Ten held-out wormy images give a coarse per-category rate.** → The headline the replay
  shows is overall accuracy over 40 images, at 2.5% granularity. The per-category story
  stays where the report already tells it, broken down by category and action.
- **The workshop now predicts the harvest, so the month is less of a surprise.** → This is
  the intended direction: CLAUDE.md's guard against the diagnosis trap asks the workshop's
  train-versus-test gap to make the real story visible. The month keeps what is its own —
  the money, and the breakdown per category and action.
- **The browsable split now mixes subtle worms in with obvious ones.** → Teaching value
  rather than a leak: the browser displays neither roles nor generation attributes, and a
  student seeing that faint worms exist is a student better placed to read the curve.
- **Regenerating invalidates the committed pool and every artifact at once.** → One
  ordering, below. The ship gate already refuses an artifact trained against a dirty tree,
  which forces the commits to happen in that order rather than as one lump.

## Migration Plan

1. Land the parameter and sampler changes with their tests, against the existing pool.
2. Regenerate the pool (`npm run pool:generate`) and commit it — new manifest, new atlases,
   new seed. Every artifact now refuses, which is the intended intermediate state.
3. Retrain the three shipped configurations (~3 min measured) and commit them, so the ship
   gate sees a clean tree.
4. Re-measure and restate `training/README.md`'s findings table against the new pool.

Rollback is reverting those commits; nothing leaves the repository, and no student-facing
deployment happens until `dist/` is rebuilt.

## Open Questions

- Whether the replay's wording should change now that "held-out images" is a real
  generalization test. It is accurate either way, so this can wait for whoever authors
  `openspec/changes/training-simulation/`.

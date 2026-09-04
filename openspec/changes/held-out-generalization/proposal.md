# Draw the held-out images from the distribution the harvest uses

## Why

The workshop's held-out slice does not measure generalization, so the screen a student
reads for a diagnosis shows them nothing. `roles.ts` assigns `heldOut` as a stratified
random 20% of the training split, and the training split is sampled entirely from the
narrow authored band — so the held-out 40 are unseen *images* of an entirely seen
*distribution*. Both accuracy curves reach 100% together and both loss curves lie on top
of each other. A student reads "100% on held-out data", concludes the model is sound,
runs a month and watches the robot pick wormy apples.

Measured on the shipped artifact, `blocks2-channels16`:

| | training split | evaluation pool |
| --- | --- | --- |
| wormy apples | 50/50 = 100% | 113/250 = 45% |
| red apples | 100/100 = 100% | 376/500 = 75% |

The cause is in the parameters. Every wormy apple in the training split has worm
visibility 0.70–0.99; the evaluation pool spans 0.15–1.00, so 155 of its 250 worms are
fainter than anything the model ever saw. Of the 88 pool worms below 0.30 visibility, 86%
are picked.

`training/README.md` recorded this as finding 1 before the replay screen existed, and
warned that whatever the replay said "must not promise a gap they do not contain". The
replay now labels a curve "held-out images", which promises exactly that. This is also
what CLAUDE.md asks the workshop to deliver: "the workshop's train-versus-test gap is
what makes the real story visible."

## What Changes

- The narrow authored band becomes a property of the **fitted** role rather than of the
  training split. The 160 fitted images keep the band they have today.
- The 40 held-out images are drawn from the same distributions the evaluation pool uses:
  reds across the wide spread including out-of-band ones, wormy apples across the full
  visibility range including subtle ones. Held-out accuracy then estimates harvest
  accuracy, which is what makes it a diagnosis.
- **BREAKING** — the role is decided when an image is sampled, not assigned afterwards
  from `ROLE_SEED`, because the role now determines which distribution the image is drawn
  from. Regenerating from the same parameters still reproduces the same roles and the same
  apples; what is spent is additivity over a *changed* parameter, which is what this change
  itself performs. The pool is republished under a new seed, so every prediction artifact
  keyed to the old images refuses instead of resolving against new ones.
- Both splits keep their sizes and category counts. The training split is still 200
  browsable images, the evaluation pool still 1000, and the roles are still not a third
  split.
- Every shipped configuration is retrained against the regenerated pool.

What this does *not* change: the fitted population, the evaluation pool's composition,
the payoff table, the decision policy, or any screen. The replay already draws whatever
the history holds — it starts showing a gap because the gap starts existing.

## Capabilities

### New Capabilities
<!-- None. This changes what the existing pool capability requires of the held-out role. -->

### Modified Capabilities

- `image-pool`: one requirement is replaced and one is modified.
  - *The distribution gap between the splits is authored* is **removed** and replaced by
    two: *The distribution gap between the fitted images and the harvest is authored*,
    which is the same gap scoped to the fitted role, and *The held-out role is drawn from
    the harvest's distribution*, which says where the other 40 training images come from
    and refuses a held-out set confined to the fitted band. The replacement is not a
    rewording: three scenarios of the old requirement assert that the training split's
    reds are uniform and its worms obvious, and this change makes both false of the split
    as a whole while keeping them true of its fitted images.
  - *The training split declares a validation role per image* is **modified** — the role
    is fixed at sampling time, because it now determines the distribution an image is
    drawn from, rather than assigned afterwards from a separate seed. Roles stop being
    additive over an existing pool: regeneration from the same parameters still preserves
    them, but changing what a role draws from produces a new pool that stale artifacts
    refuse.

## Impact

- `tools/pool/params.ts`, `sample.ts`, `roles.ts`, `manifest.ts` — the held-out
  populations become sampling groups of the training split; `ROLE_SEED` and the post-hoc
  shuffle go away.
- `pools/apple-harvest/` regenerates: new manifest, new atlases, new seed. Every image
  behind an id changes, so this is a new pool rather than an edit to the existing one —
  see `design.md` for why the seed has to move for stale artifacts to refuse.
- `artifacts/apple-harvest/predictions/` — all three shipped configurations retrain
  (~3 min measured). The training pipeline itself is untouched: `prediction-artifacts`
  already binds an artifact to its pool, so a stale artifact refuses rather than
  mislabelling.
- Tests asserting the committed pool's bands and composition move with the parameters:
  `test/pool-*.test.ts`, `training/tests/test_pool.py`.
- `training/README.md` finding 1 is superseded and its measured table is restated.
- `openspec/changes/training-simulation/` is still an unauthored stub. The replay screen
  it will eventually specify needs no code change here, but the honesty of its "held-out
  images" label depends on this change landing.

### Expected effect, to be confirmed by measurement

Held out becomes 20 wide-spread reds, 10 greens and 10 wormy apples across the full
visibility range. Applying the pool's measured per-category rates gives roughly 74%
held-out accuracy against 100% fitted — a gap wide enough to read off the curve, and one
that should widen as the fitted curve climbs. Ten wormy images is a small sample and the
held-out worm rate will be coarse; the headline the screen shows is overall accuracy,
where 40 images give 2.5% granularity. If the measured gap turns out to be narrower than
this estimate, the response is to record what was measured, not to reshape the pool
until it matches.

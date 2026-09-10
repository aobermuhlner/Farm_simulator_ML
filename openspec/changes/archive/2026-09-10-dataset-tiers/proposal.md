# Dataset tiers

Change 6 of `Game_design.md` §11, from §8.1's top-ranked suggestion, §4.5 and §2. Depends
on `progression-catalog`, which is landed. `fitted-tree` names this change as the owner of
the tier decision it deferred.

## Why

The money loop needs something to buy that teaches, and every item in today's catalog buys
*capacity* — deeper stacks, more channels, a bigger node budget. Capacity is one lesson and
the game already tells it well. The other half of why a model is good is the data it was
fitted on, and nothing a student can buy says so.

There is a lesson hiding in the price list. The cheap set was labelled in a hurry and some
of its labels are wrong; the expensive one was checked. Since `manual-sorting` deliberately
keeps none of the player's own clicks, this is where label noise lives — and it is the
better version anyway, because it is authored and therefore reliably teachable rather than
dependent on how carefully one student clicked in Year 1. A student who browses their
bargain dataset and finds a wormy apple filed under *ripe red* has learned something no
paragraph of help copy can teach.

Why now, before the images exist: the tier has to be part of what a configuration *is*, and
that is a change to identity. Making it later means re-keying every artifact shipped in the
meantime. Making it now costs one re-run of three configurations, about three minutes.

## What Changes

- **A dataset tier becomes a declared thing.** The task declares its tiers: an id, a
  student-facing label, the number of photos, the composition across the task's categories,
  and the tier's label quality. Three are declared here — `starter` (200, free with the
  robot, checked), `bulk` (1 000, skewed towards red, some labels wrong) and `checked`
  (2 000, balanced, correct).

- **A tier is selected by a knob, not read off what is owned.** Each family declares which
  of its knobs picks the fitting set; that knob's values are tier ids. This is the
  load-bearing decision and it settles the stub's coverage question. `progression-catalog`
  already forbids the alternative — *"Buying an item SHALL only add identifiers a student
  can select; it SHALL NOT change what any identifier means"* — and a tier read off
  ownership would change what `blocks2-channels16-regularization1-dropout0` resolves to on
  the day the photos were bought. It is also the better game: a student owning two tiers can
  hold the architecture still, move only the data, and watch the train-versus-held-out gap
  close. That comparison is the whole lesson, and an ambient tier throws it away.

- **BREAKING: every configuration identifier gains a tier part.**
  `blocks2-channels16-regularization1-dropout0` becomes
  `blocks2-channels16-regularization1-dropout0-datasetstarter`. The dataset knob is declared
  last so the change is a pure suffix append and the existing parts keep their order. The
  three shipped artifacts are re-emitted by re-running the pipeline over the same pool with
  the same seeds — the same weights and the same numbers under new keys, about three minutes
  of compute, not a retrain of anything new.

- **Coverage becomes tier times configuration, and tiers ship one at a time.** The mechanism
  for that already exists and is already in use: `catalog.json` carries three items with a
  `notForSaleReason` and no price, and `progression-catalog` blesses it — *"An unpriced item
  may name untrained ground."* `bulk` and `checked` ship as unpriced items in the
  already-declared but empty `data` group: visible, locked, and honest about why.

- **Settles §10.8 — the cheap labels really are wrong.** The pool manifest gains, per
  training image, the tier at which that image enters the training split and the label each
  tier files it under, alongside the true category it already declares. A model is fitted
  against its tier's labels and scored against the manifest's truth. Only the pipeline and
  the browser read the tier labels; the decision policy and the scoring never see them.

- **No model requires a dataset** (§4.5). Every family runs on `starter`. The larger tiers
  are bought because the workshop showed the student why, never because a screen refused to
  proceed without them.

- **The top tier is 2 000 photos, not §4.5's 5 000.** A 5 000-image training split is about
  13 MB of atlases that `training-browser` currently requires be shown in full, on static
  hosting, to a school laptop; and the widest shipped configuration takes roughly 45 minutes
  to fit on it against the ~108 seconds measured in `training/README.md` for 160 images. At
  2 000 both bills roughly halve and the gap-closing curve the tier exists to draw looks the
  same. §4.5 calls its numbers illustrative; this one is being used.

- **No new images.** This change ships the mechanism, the declarations and the copy. The
  pool stays 200 training and 1 000 evaluation, so `starter` is the only tier with images
  behind it. `fitted-tree` recorded why the larger tiers cannot be faked from what exists —
  *"a 1 000-photo tier would have to be drawn from the evaluation pool ... and the gap this
  rung exists to show would collapse"* — and §11 wants the pool regeneration batched with
  `heirloom-cultivars` and paid for once. Pricing `bulk` and `checked` is then a change to
  the catalog and to nothing else, which is exactly what `progression-catalog` promises.

- **The pool manifest gains fields, and the images do not move.** Schema version rises from
  1.1.0 to 1.2.0. Regenerated from the same seed and the same parameters, every image id
  keeps its pixels and its role; only the manifest says more. Because an artifact records
  the pool schema version it was produced against, the re-emission above covers this too.

## Capabilities

### New Capabilities
- `dataset-tiers`: what a dataset tier is — its size, composition and label quality — how a
  family's fitting set is selected from the tiers a task declares, how ownership gates which
  tiers may be selected, and the rule that a model is fitted against its tier's labels while
  every score is computed against the manifest's truth.

### Modified Capabilities
- `image-pool`: the manifest declares, per training image, the tier it enters at and the
  label each tier files it under. The two-split rule and the fitted/held-out roles are
  unchanged; a tier is a nested subset of the training split and never a third split, and no
  tier draws an image from the evaluation pool.
- `prediction-artifacts`: a covered configuration's identifier carries its tier, and an
  artifact records which tier's labels each covered configuration was fitted against. The
  artifact still carries no ground truth — a tier label is not one.
- `training-browser`: the browser shows the images of the tier the workshop currently
  selects, labelled as that tier labels them, and states that tier's label quality and
  composition. A tier that files some apples wrongly says so.
- `task-contract`: a task declaration carries its dataset tiers, and a family declares which
  of its knobs selects one. Declaration completeness and the identifier rules extend to
  cover both.

## Impact

Declarations first: `declarations/apple-harvest.json` gains a tiers block and a `dataset`
knob on the convolutional family; `declarations/catalog.json` gains two unpriced items in
its `data` group. Then `src/task/` (validation, families, configuration identity),
`src/pool/` (manifest reading), the training browser screen, and `training/` — where the
pipeline learns to fit against a label column and score against the category column, and
re-emits the three shipped artifacts under their new keys.

Deliberately out of scope, and named here so a later session finds them: the pool
regeneration that gives `bulk` and `checked` real images, the authored label noise itself,
prices for either tier, and whatever `training-browser` must become when a split is 2 000
images rather than 200.

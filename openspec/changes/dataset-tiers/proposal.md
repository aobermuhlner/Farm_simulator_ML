# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §8.1 (its top-ranked suggestion), §4.5 and
§2. Depends on `progression-catalog`. Read `openspec/specs/training-browser/spec.md` and
`openspec/specs/prediction-artifacts/spec.md`'s *Coverage is declared* before filling this
in — the coverage question below is the one that decides whether this change is cheap or
expensive.

## Why

A bought dataset has to mean something beyond a bigger number, and there is a lesson
waiting in the price: the cheap set was labelled in a hurry and some of its labels are
wrong; the expensive one was checked twice. Since `manual-sorting` deliberately does not
keep the player's own clicks, this is where label noise lives — and it is the better
version anyway, because it is authored and therefore reliably teachable rather than
dependent on how carefully one student clicked in Year 1.

The same slot can carry composition. The cheap set is skewed and has few wormy apples;
the expensive one is balanced. Both of those are the difference between a dataset that is
an inventory item and one that explains a model's behaviour.

## What Changes

- A dataset becomes a declared catalog item with size, category composition and label
  quality: the starter 200 free with the robot, 1 000 for 800, 5 000 for 2 500.
- Which dataset is owned determines what the training browser shows and what a fitted
  model is fitted on. The browser discloses the label quality of the set it is showing —
  a set with wrong labels in it must say so, per the §1.1 rider.
- **No model requires a dataset** (§4.5). The convolutional network runs on the starter
  set; it is simply *worse* on it, and the workshop's train-versus-held-out gap shows
  exactly how much worse. That gap is the honest argument for the bigger sets and it is a
  claim that survives §1.1 — more data helps most exactly when the model has the capacity
  to overfit. Let the player discover it rather than gating on it.
- Settles §10.8: does the cheap set really carry wrong labels, or is "labelled in a hurry"
  only flavour text? Really carrying them is the honest version and the better lesson, but
  every fitted model must then be trained against the *noisy* labels while being scored
  against the true ones — a real cost in the training pipeline, not a copy change.
- **The coverage question.** If a model can be fitted on any of three tiers, then trained
  coverage is the product of tier and configuration, not configuration alone, and every
  shipped artifact triples. Deciding how a tier participates in configuration identity —
  and whether the tiers ship one at a time — is the load-bearing decision here.
- The pool must hold enough images for the largest tier. Today it is 200 training and
  1 000 evaluation, so a 5 000-image tier does not exist yet. If that needs a regeneration
  it needs a retrain, and it should be batched with `heirloom-cultivars` rather than paid
  for twice (§7).

## Capabilities

### New Capabilities
- `dataset-tiers`: provisional. What a bought dataset is — size, composition, label
  quality — how ownership selects one, and how its label quality is disclosed.

### Modified Capabilities
- `training-browser`: provisional. The browser shows the dataset that is owned rather
  than the whole training split, and states its label quality alongside its composition.
- `prediction-artifacts`: provisional, if the dataset tier becomes part of what a
  configuration means.
- `image-pool`: provisional, if tier sizes or compositions require the pool to change.

## Impact

To be determined. Catalog entries, a declaration slot for tier definitions, the training
browser, and — if the noisy-label option is taken — the training pipeline under
`training/`, which would need to fit on one label set and score on another. Potentially
expensive; the cheap subset of this change is worth identifying explicitly in
`design.md`.

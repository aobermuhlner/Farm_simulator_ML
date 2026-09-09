# Dataset tiers — tasks

Follow `design.md`'s Migration Plan order: the pool speaks first, the declarations second,
the code that reads them third, and the artifacts last. Each group leaves the build green.

## 1. The pool declares tiers

- [x] 1.1 Add tier assignment to `tools/pool/roles.ts` (or a sibling): derive each training image's entry tier from the pool seed, nested so an image held by one tier is held by every larger one. Verify with a new `test/pool-tiers.test.ts` asserting the same seed reproduces the same entry tiers and that membership nests across the declared tiers.
- [x] 1.2 Emit `tier` and the per-tier labels per training image in `tools/pool/manifest.ts`, and refuse a tier or a tier label on an evaluation-pool image. Verify in `test/pool-manifest.test.ts` that every training image carries an entry tier and one label per holding tier, and that no evaluation image carries either.
- [x] 1.3 Guard the tier restriction of the roles in the generator: every declared tier must hold at least one fitted and one held-out image of every declared category, refusing with the tier, role and category named. Verify in `test/pool-roles.test.ts`.
- [x] 1.4 Raise the pool schema version to 1.2.0 and regenerate `pools/apple-harvest`. Verify the five atlas PNGs are byte-identical to the committed ones (`git status` shows only `manifest.json` changed) and that `test/pool-committed.test.ts` passes.

## 2. The declarations describe them

- [x] 2.1 Add a `datasets` block to `declarations/apple-harvest.json` declaring `starter` (200, checked), `bulk` (1 000, skewed to red, some labels wrong) and `checked` (2 000, balanced, correct) with label, size, per-category composition, label quality and disclosure copy, in ascending size order. Verify `test/apple-harvest.declaration.test.ts` accepts it.
- [x] 2.2 Add a `dataset` knob to the convolutional family, declared **last**, values `starter`/`bulk`/`checked`, default `starter`, with help copy; add `datasetKnob: "dataset"` to the family. Verify `test/config-identity.test.ts` shows the identifier gaining exactly a `-datasetstarter` suffix with every earlier part unmoved.
- [x] 2.3 Rewrite the convolutional family's declared theory copy, which currently says the knobs "do not change the apples" — a dataset knob changes exactly the apples. Verify by reading the workshop copy in `web/src/App.workshop.test.tsx`'s rendered output.
- [x] 2.4 Add `bulk` and `checked` to `declarations/catalog.json` in the existing `data` group as unpriced items with a `notForSaleReason` naming that no model has been fitted on them. Verify `test/catalog-declaration.test.ts` and `test/catalog-check.test.ts` accept the catalog and that neither item is offered for purchase.

## 3. Loading and validation

- [x] 3.1 Type and validate the tiers block in `src/task/types.ts` and `src/task/validate.ts`: unique ids, ascending distinct sizes, labels within the declared categories, and every required tier field. Verify with cases in `test/validate-declaration.test.ts` for a missing tiers block, a duplicate id and tiers out of size order.
- [x] 3.2 Validate the family's `datasetKnob` in `src/task/families.ts`: it must name a knob the family declares, that knob must be an enumerated choice whose every value is a declared tier id, and its default must be the task's smallest tier. Verify in `test/family-declaration.test.ts` for a missing `datasetKnob`, one naming an unknown knob, and a knob value naming no tier.
- [x] 3.3 Refuse a `datasets` block declared inside a family, naming that tiers belong to the task. Verify in `test/validate-declaration.test.ts`.
- [x] 3.4 Read the tier and tier-label fields in `src/pool/index.ts`, and refuse an entry tier the task does not declare, a label outside the declared categories, and a tier on an evaluation image, each naming the image id. Verify in `test/pool-reader.test.ts`.
- [x] 3.5 Check each declared tier's size and composition against the images the manifest assigns it, refusing with the tier, the category and both figures; accept a tier the pool holds no images for. Verify in `test/pool-manifest.test.ts` that `starter` agrees, that a doctored count refuses, and that `bulk` and `checked` load without images.
- [x] 3.6 Confirm ownership gating needs no new unlock kind: a `knob-values` item naming the `dataset` knob opens the tier across every family declaring it. Verify in `test/progression-availability.test.ts` that an unowned tier is shown with what opens it and cannot be selected, and in `test/progression-locked.test.ts` that the locked refusal names the item.

## 4. Fitting against labels, scoring against truth

- [x] 4.1 Teach `training/farm_training/pool.py` to read a training image's tier and per-tier labels, and to yield the images of a named tier with that tier's labels. Verify with a test under `training/tests/` that fitting on `starter` yields 200 images labelled by the tier column.
- [x] 4.2 Fit against the tier's labels and measure both history losses over that tier's fitted and held-out images, against those same labels, in `training/farm_training/train.py`. Verify with a `training/tests/` case using a fixture pool whose tier labels differ from its categories, asserting the loss follows the labels.
- [x] 4.3 Record the tier id per covered configuration in `training/farm_training/artifact.py`, and refuse to emit a tier disagreeing with the configuration's identifier. Verify in `training/tests/` and in `test/artifact-contract.test.ts`.
- [x] 4.4 Restrict a covered configuration's training-split predictions to its own tier's images in the artifact writer and the reader, refusing an entry for a training image outside the tier. Verify in `test/artifact-contract.test.ts` and `test/fixture-coverage.test.ts`.
- [x] 4.5 Confirm no tier label reaches scoring: the crop scorer and the decision policy still read the manifest's category. Verify `test/crop-scoring.test.ts` and `test/policy.test.ts` pass unchanged, and add a case fitting on a tier whose labels differ, asserting earnings are computed from the true categories.

## 5. Re-emit the shipped artifacts

- [ ] 5.1 Commit the pipeline changes before producing artifacts, as `training/README.md` requires. Verify the working tree outside `artifacts/` is clean.
- [ ] 5.2 Re-run `uv run python -m farm_training.train` for the three shipped configurations against the 1.2.0 pool. Verify each artifact's coverage key is the old identifier plus `-datasetstarter`, that its recorded tier is `starter`, and that its per-epoch losses match the previously shipped values.
- [ ] 5.3 Update `artifacts/apple-harvest/predictions/index.json` and confirm the ship gate passes. Verify `test/artifact-shipping.test.ts` and `test/artifacts-untouched.test.ts`.
- [ ] 5.4 Confirm the catalog cannot price untrained ground: with `bulk` and `checked` unpriced, `test/catalog-check.test.ts` accepts; adding a price to either makes it refuse naming an uncovered identifier. Verify both directions.

## 6. The browser shows what was bought

- [ ] 6.1 Show the images of the tier the selected family's dataset knob names, and name that tier by its declared label. Verify in `web/src/App.training.test.tsx` that the browsed set follows the knob and not what is owned.
- [ ] 6.2 Label each image by the category its tier files it under, not by its true category, and count the composition by those same labels. Verify in `web/src/App.training.test.tsx` with a fixture tier whose labels differ from the truth.
- [ ] 6.3 Display the selected tier's declared label-quality copy, and mark no image and show no count as mislabelled. Verify in `web/src/App.training.test.tsx` for both a checked and a mislabelling fixture tier.
- [ ] 6.4 Confirm no screen names a tier, a size or a label quality. Verify `web/src/no-task-specific-code.test.tsx` passes with the new copy in place.

## 7. Whole-system checks

- [ ] 7.1 Verify a save written before this change reopens with its money and purchases intact and its dataset knob at `starter`, and that a model it had at work is either restored on `starter` or dropped per `game-save` rather than crashing. Cover in `test/save-codec.test.ts` and `web/src/App.save.test.tsx`.
- [ ] 7.2 Verify the full suite and the workshop end to end: `npm test`, and a manual pass through farm → workshop → training browser → market confirming `bulk` and `checked` appear, are explained, and cannot be bought.
- [ ] 7.3 Record in `training/README.md` that the shipped figures are `starter`-tier measurements fitted against `starter`'s labels, so the later tiers have something to be compared against.

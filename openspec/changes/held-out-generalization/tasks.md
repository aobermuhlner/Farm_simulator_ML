## 1. Parameters

- [x] 1.1 Rename `TRAINING_RED` to the fitted band and `WORM_VISIBILITY.training` to `.fitted` in `tools/pool/params.ts`, following the rename through `bands.ts` (`insideTrainingRedBand`), `sample.ts` and every test that names them; verify `npm test` passes unchanged, since this task changes no value
- [x] 1.2 Add the held-out population counts to `params.ts` — 8 in-band reds, 12 out-of-band reds, 10 greens, 4 subtle worms, 6 obvious worms — and verify `test/pool-params.test.ts` asserts they sum to the declared `HELD_OUT_COUNTS` per category and to 40 overall
- [x] 1.3 Bump `SEED`, and verify `test/pool-params.test.ts` asserts the committed manifest's seed equals it (the committed pool now fails this, which is the intended state until task 3.1)

## 2. Sampling

- [x] 2.1 Give `SampledImage` a role and have `groupsFor('training')` return the fitted groups plus the five held-out groups drawn from the evaluation pool's distributions; verify `test/pool-sampling.test.ts` asserts every sampled training image carries a role and that each held-out group draws from the pool band its evaluation-pool counterpart draws from
- [x] 2.2 Delete `assignRoles` and `ROLE_SEED`, and read roles from the sampled images in `manifest.ts`; verify `test/pool-roles.test.ts` still asserts the roles partition the split, that every category appears in both roles, and that the same seed reproduces both the roles and the images behind each id
- [x] 2.3 Add the refusal for a held-out set confined to the fitted band, naming the category; verify `test/pool-roles.test.ts` covers it over a doctored assignment
- [x] 2.4 Update `test/pool-distribution.test.ts` so the band and worm-visibility assertions read the fitted images rather than the whole training split, and add the held-out assertions the spec names — held-out reds outside the fitted band, held-out worms below the lowest fitted worm visibility with the rest of their attributes in band

## 3. Regenerate and retrain

- [x] 3.1 Run `npm run pool:generate` and commit the regenerated pool; verify `test/pool-committed.test.ts` and `test/pool-manifest.test.ts` pass against the new manifest and that `training/tests/test_pool.py` still refuses its doctored copies (`cd training && uv run pytest`)
- [x] 3.2 Confirm the stale artifacts refuse rather than resolving: verify the prediction-artifact suite reports a pool-seed mismatch naming both seeds, and that opening the task in the app shows that refusal rather than a report
- [ ] 3.3 Retrain the three shipped configurations (`cd training && uv run python -m farm_training.train`) against the regenerated pool and commit them; verify `test/artifact-shipping.test.ts` passes, including the clean-tree provenance check

## 4. Measure and record

- [ ] 4.1 Measure the fitted and held-out accuracy per epoch for each retrained configuration and record the final gap; verify the numbers come from the committed histories rather than from a separate script's own run
- [ ] 4.2 Restate `training/README.md`'s findings — finding 1 said the held-out slice shows no gap, which this change is meant to end — with the measured fitted-versus-held-out figures and the per-population harvest table regenerated from the new pool
- [ ] 4.3 Open the task in the app and confirm the replay's two accuracy curves visibly separate and the two loss curves no longer lie on top of each other; if the gap is materially narrower than the design's estimate, record what was measured rather than reshaping the pool

## 5. Close out

- [ ] 5.1 Run the full suite (`npm test`, `npm run typecheck`, and `cd training && uv run pytest`) and verify everything passes against the regenerated pool and retrained artifacts
- [ ] 5.2 Sync the `image-pool` delta into `openspec/specs/image-pool/spec.md` and archive the change

## 1. Overlay geometry becomes declared data

- [x] 1.1 Move the shade ellipse's centre and radii and the highlight ellipse's centre, rotation and radius coefficients out of `tools/pool/draw.ts` markup into declared constants in `tools/pool/params.ts`, and verify the existing `test/pool-drawing.test.ts` pixel assertions still pass unchanged
- [x] 1.2 Add a test asserting the drawing code and the measurement code read the same declared overlay constants, so the two cannot drift into separate copies of the same ellipse
- [x] 1.3 Regenerate the pool and verify every atlas PNG is byte-identical to the committed one — this task is what proves the extraction moved no pixel

## 2. Declared measurement parameters

- [x] 2.1 Declare the sensitivity parameters in `tools/pool/params.ts` — dark-spot luminance cut as a fraction of the body's modal luminance, colour-distance cut, minimum blob size in pixels, and the channel each comparison runs on — each with a recorded reason for its value, and verify a test asserts every declared parameter carries a non-empty reason
- [x] 2.2 Declare, per feature, which overlays it masks (`redness` and `textureVar` mask nothing, `darkSpotArea` and `spotCount` mask both, `roundness` masks nothing) and verify a test asserts the declaration covers every declared feature exactly once
- [x] 2.3 Add a test asserting the highlight mask uses the radii at `gloss = 1` and is therefore identical for every image, so masking reads no per-image attribute
- [x] 2.4 Add a test asserting neither mask at maximum size overlaps the region worms are drawn in, so masking the overlays does not mask what the spot features exist to find

## 3. The measurement pass

- [x] 3.1 Add `tools/pool/features.ts` computing the five declared features from a rasterized cell and the declared parameters, taking pixels and pool-wide geometry only, and verify unit tests cover each feature against hand-checked cells
- [x] 3.2 Add a test asserting the measurement signature accepts no per-image manifest value — no category, no attributes, no split, no role — so the provenance requirement is enforced by the type rather than by review
- [x] 3.3 Wire the pass into `tools/pool/generate.ts` between rasterizing and manifest assembly, and verify measuring the same atlases twice produces identical feature vectors
- [x] 3.4 Add a test asserting no feature draws on randomness, wall-clock time or anything machine-dependent, by measuring the same cell twice in one process and across a fresh process

## 4. Manifest and declaration

- [x] 4.1 Add the feature vector to `ManifestImage` in `tools/pool/manifest.ts` and write it for every image in both splits, and verify the manifest reader refuses an image whose vector is missing a declared feature, naming the feature and the image id
- [x] 4.2 Make the reader refuse a manifest recording a feature the task does not declare, naming the feature and the image id, and verify with a test fixture
- [x] 4.3 Declare the feature list in `declarations/apple-harvest.json` — id, label, unit or scale, range across the pool, teaching copy, and declared contaminating attributes per feature — and verify `src/task/validate.ts` refuses a feature missing any of those fields, naming the feature and the field
- [x] 4.4 Declare the maximum node budget for hand-written rules in the task declaration, and verify validation refuses a declaration that omits it
- [x] 4.5 Bump the pool manifest `schemaVersion` to `1.1.0` and the declaration's `schemaVersion` to match, and verify the existing pool-identity check refuses the mismatched pair
- [x] 4.6 Regenerate the pool and verify the atlases are still byte-identical, the declared seed is unchanged, and only the manifest gained fields

## 5. Declaration-level checks over the pool

- [x] 5.1 Add a check refusing a declared feature that is constant across the pool, naming it, and verify it by declaring a size feature in a fixture and watching it refuse
- [x] 5.2 Add a check refusing two declared features that are monotone functions of one another within the declared tolerance, naming both, and verify it by declaring `greenness` alongside `redness` in a fixture
- [x] 5.3 Add a check refusing a feature whose declared contaminating attribute does not measurably move its value within a category, naming the feature and the attribute, and verify against the real pool
- [x] 5.4 Add a check asserting every measured value falls inside its declared range, and verify it refuses a fixture whose range is too narrow

## 6. The two guards

- [x] 6.1 Implement the separation metric — best single-threshold balanced accuracy per feature and category, one-vs-rest, maximised over categories — and verify unit tests cover a perfectly separating feature, a useless one, and the class-imbalance case the metric exists to handle
- [x] 6.2 Add the inversion guard: no declared feature's separation over the fitted images exceeds its separation over the evaluation pool beyond the declared tolerance, refusing with the feature and both figures, and verify it against the real pool
- [x] 6.3 Fit the inversion tolerance to the measured pool and record the value with its reason, then verify the guard passes for every declared feature — retuning `spotCount`'s declared sensitivity or dropping the feature if it inverts, and recording that decision as shaping
- [x] 6.4 Implement the bounded brute-force rule search over the declared features within the declared maximum node budget, thresholds taken as midpoints between adjacent observed values subsampled to a declared cap, and verify it runs over the manifest without rasterizing and completes inside the normal test run
- [x] 6.5 Add the ladder guard: the best rule fitted on the fitted images scores below the weakest configuration in the shipped artifact index on the evaluation pool, overall and on every declared category, refusing with the rule, the category and both scores
- [ ] 6.6 Verify the ladder guard against the three shipped configurations and record the resulting margins, so a later change can see how much room the guard had

## 7. Reading features in the app

- [x] 7.1 Add `src/features/` as a typed reader over the manifest's feature vectors, and verify a test asserts it exposes no measurement code and computes nothing from pixels
- [x] 7.2 Verify `web/src/no-task-specific-code.test.tsx` still passes and extend it so that no screen names a particular feature id or label

## 8. Artifacts and the browser

- [x] 8.1 Re-run the three shipped configurations through `farm_training.train` at their recorded seeds, and verify each prediction file's probabilities are unchanged and only `pool.schemaVersion` differs in the index
- [x] 8.2 Verify the app loads the regenerated pool against the re-stamped artifacts with no refusal, and that a deliberately stale artifact fixture still refuses naming both schema versions
- [x] 8.3 Extend the training-browser tests so no per-split distribution, range, average or count of any measured feature is displayed, alongside the existing assertion for generation attributes

## 9. Close out

- [ ] 9.1 Run the full suite and `npm run typecheck`, and verify both pass
- [x] 9.2 Resolve design.md's open question on whether `roundness` stays, using the measured contamination from task 5.3, and record the outcome in the declaration
- [x] 9.3 Verify `openspec validate measured-features --strict` passes

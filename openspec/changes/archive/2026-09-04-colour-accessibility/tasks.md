## 1. The verification module

- [x] 1.1 Add `src/colour-vision/` declaring the deuteranopia and protanopia simulations at full severity, sRGB-to-CIELAB conversion, CIEDE2000, and the declared thresholds and lightness margin; verify `test/colour-vision.test.ts` reproduces Sharma's published CIEDE2000 test pairs to three decimals and the simulation's published matrix output for a handful of primaries
- [x] 1.2 Give the module the two comparisons the spec names — worst pairwise distance over two sets of colours, and whether two sets' lightness ranges overlap — with failures carrying both colours, the deficiency and the measured value; verify `test/colour-vision.test.ts` asserts the message names all three over a deliberately failing pair
- [x] 1.3 Verify nothing on a screen imports the module: `npm run build` output does not grow, and `web/src/no-task-specific-code.test.tsx` still passes

## 2. The defect on the record

- [x] 2.1 Add `test/pool-palette.test.ts` measuring the declared red and green bands over every hue and lighting value they can be drawn with, excluding the specular highlight, against the thresholds; verify it fails against today's parameters at the measured 0.4 under deuteranopia, naming the pair
- [x] 2.2 Add the highlight bound to the same test — the largest highlight `gloss` allows covers at most a sixth of the body; verify it passes against today's drawing, since this is a property the drawing already has

## 3. The palette

- [x] 3.1 Add `BODY_TONE` to `tools/pool/params.ts` as the declared control points (−30: 0.88/0.35, −6: 0.86/0.36, 75: 0.66/0.59, 120: 0.64/0.60) with clamped linear interpolation, and have `draw.ts` read it in place of `BODY_SATURATION` and `BODY_LIGHTNESS`; verify `test/pool-drawing.test.ts` still shows hue changing only `body.fill`, and that two attribute vectors sharing a hue produce the same fill
- [x] 3.2 Verify `test/pool-params.test.ts` asserts every hue the declared bands can draw falls inside the range the control points cover, so no image is filled from an interpolation off the end of the declaration
- [x] 3.3 Move the hue bands — fitted red −22..−12, pool red −30..−6, out-of-band hue regions [−30, −23] and [−11, −6], green 75..120 — leaving every other band value alone; verify `test/pool-params.test.ts` still holds the fitted band inside the pool spread, keeps each out-of-band region clear of the fitted band by more than the rounding step, and keeps green clear of red
- [x] 3.4 Verify `test/pool-palette.test.ts` now passes and records the measured figures the design states: ΔE2000 10.2 under deuteranopia and 25.5 under protanopia, with lightness gaps of 10.5 and 25.3
- [x] 3.5 Add the worm-marking check to `test/pool-palette.test.ts` — at least one element of the marking clears the declared distance from every red body colour it can sit on, under both deficiencies; verify it passes on the pale worm and records that the bite hole alone does not, which is why the requirement asks for one element rather than all

## 4. Pool identity covers the pixels

- [x] 4.1 Split `SEED` into an authored date-shaped constant and a derived value: the constant combined with a stable digest over the parameters the drawing reads — the tone ramp, the shadow and highlight coefficients, the cell size — with the digest implemented in-repo so it cannot move with a Node version; verify `test/pool-params.test.ts` asserts the derived seed changes when a tone control point is perturbed and does not change when a parameter the drawing never reads is
- [x] 4.2 Have `manifest.ts` declare the derived value, unchanged in shape and type; verify `test/pool-manifest.test.ts` and `training/tests/test_pool.py` read it as before and that no schema version moved
- [x] 4.3 Verify `test/pool-params.test.ts` asserts the committed manifest's seed equals the derived value — the committed pool now fails this, which is the intended state until task 5.1

## 5. Regenerate and retrain

- [x] 5.1 Run `npm run pool:generate` and commit the regenerated pool; verify `test/pool-committed.test.ts`, `test/pool-manifest.test.ts` and `test/pool-distribution.test.ts` pass against the new manifest, and that `training/tests/test_pool.py` still refuses its doctored copies (`cd training && uv run pytest`)
- [x] 5.2 Confirm the stale artifacts refuse rather than resolving: verify the prediction-artifact suite reports a pool-seed mismatch naming both seeds, and that opening the task in the app shows that refusal rather than a report
- [x] 5.3 Retrain the three shipped configurations (`cd training && uv run python -m farm_training.train`) against the regenerated pool and commit them; verify `test/artifact-shipping.test.ts` passes, including the clean-tree provenance check

## 6. The screens

- [x] 6.1 Add `--series-fitted` and `--series-held-out` to `web/src/styles.css` in both themes, with the held-out series at `#3d4b9e` light and `#8f95e8` dark, and point the curve, head and key rules at them instead of `--warn`; verify the issues panel still uses `--warn` and looks unchanged
- [x] 6.2 Add `web/src/palette.test.tsx` parsing the palette tokens out of `styles.css` per theme block and checking each declared pair through `src/colour-vision/`; verify it passes in both themes at the measured 48.6 and 49.0, and fails if the held-out token is set back to `--warn`'s value
- [x] 6.3 Verify the same test refuses a category or series colour written as a literal outside the token block, so a colour the check cannot see cannot be introduced
- [x] 6.4 Verify `web/src/screens/TrainingRun.test.tsx` asserts each series carries a stroke pattern distinguishing it from the other and that the key names both series in text, so colour is not the only cue

## 7. Measure and record

- [x] 7.1 Re-measure the harvest per population for the three retrained configurations and restate `training/README.md`'s findings table and its four findings against the new pool; verify every figure comes from the committed histories and prediction files rather than from a script's own run
- [x] 7.2 Open the task in the app, browse the training split, and confirm the apples read as apples and the worm reads as a worm; verify the same grid through a deficiency simulator and record what was seen
- [x] 7.3 If a lesson lands materially differently on the regenerated pool, record what was measured in `training/README.md` rather than moving a band until the old numbers come back

## 8. Close out

- [x] 8.1 Run the full suite (`npm test`, `npm run typecheck`, and `cd training && uv run pytest`) and verify everything passes against the regenerated pool and retrained artifacts
- [x] 8.2 Sync the `image-pool` delta and the new `colour-vision-safety` spec into `openspec/specs/` and archive the change

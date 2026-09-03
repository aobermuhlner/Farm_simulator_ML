# Tasks

Order follows `design.md` — Migration Plan. Groups 1–3 only add files and fields; group 4
is the switch that can be reverted on its own.

## 1. Validation roles in the pool

- [x] 1.1 Add the role parameters to `tools/pool/params.ts` — `ROLE_SEED = SEED ^ 0x726f6c65`
      and the per-category held-out counts (red 20, green 10, wormy 10 of 100/50/50) — and
      verify a unit test asserts they sum to the declared category counts and that held-out
      is the smaller role
- [x] 1.2 Assign roles from their own `createRandom(ROLE_SEED)` stream, stratified per
      category over the training ids in manifest order, and verify a test shows two
      assignments from the same seed are identical and every category appears in both roles
- [x] 1.3 Write `role` per training image and `splits.training.roles` counts in
      `tools/pool/manifest.ts`, leaving evaluation entries without a role, and verify the
      generated manifest shape in a `buildManifest` unit test
- [x] 1.4 Regenerate with `npm run pool:generate` and verify the five atlas PNGs are
      byte-identical to the committed ones and `git diff pools/apple-harvest/manifest.json`
      shows only added `role` and `roles` fields
- [x] 1.5 Read the roles in `src/pool/index.ts` — expose them as a `roles` lookup beside `order`
      and the manifest `seed` — and verify `test/pool-reader.test.ts` covers each refusal:
      a role on an evaluation image, a training image without one, and a declared role
      count disagreeing with its images, each naming the offender
- [x] 1.6 Verify the roles did not become a split: a test asserts `POOL_SPLITS` is still
      the two names, browsing the training split still presents all 200 images, and a
      manifest declaring a third split still refuses naming it

## 2. The trainer

- [x] 2.1 Read the manifest and the declaration in `training/`, resolving every image's
      region by the same atlas/cell rule, and verify a doctored manifest (cell beyond
      capacity) refuses naming that image id before any epoch and writes no file
- [x] 2.2 Decode the atlases once into an in-memory array, and verify a test checks a
      sample of cell origins against `regionOf`'s arithmetic and that all 1200 images
      decode at 128px
- [x] 2.3 Build the model from declared knob values — two 3×3 convs with ReLU then 2×2
      max pool per block, channels doubling, global average pooling, dropout, dense head
      of one output per declared category — and verify a test asserts per-block channels
      and spatial sizes follow the doubling and halving rules at each permitted width
- [x] 2.4 Implement the run: Adam at 1e-3, batch 32, 40 epochs, cross-entropy, weight
      decay from the `{0: 0.0, 1: 1e-4, 2: 1e-3, 3: 1e-2}` mapping, train loss over the
      fitted images and validation loss over the held-out ones with no held-out image
      reaching the optimizer, and verify two runs of one configuration on this machine
      produce an identical history
- [x] 2.5 Assemble provenance per configuration — knob values, epoch count, seed,
      hyperparameters, the built architecture, the git revision and dirty flag, and an
      empty shaping list — and verify every field is present in the emitted index
- [x] 2.6 Encode probabilities at three decimals with largest-remainder renormalization,
      and verify a unit test shows decoded vectors have one value per category, each in
      [0, 1], summing to exactly 1.000, and that a vector failing any of those refuses
      naming the configuration, image and defect
- [x] 2.7 Write `index.json` and one file per configuration under the declaration's
      `predictions` path, each file repeating `schemaVersion`, `taskId` and its own
      `configurationId`, and verify the writer refuses an id containing a path separator
      or a leading dot rather than writing it

## 3. Train, commit, gate

- [x] 3.1 Move the `blocks` default from 3 to 2 in `declarations/apple-harvest.json` and
      verify `npm test` passes and the declared defaults resolve to
      `blocks2-channels16-regularization1-dropout0`
- [x] 3.2 Train `blocks2` at channels 8, 16 and 32 and commit the artifact, verifying the
      index covers exactly those three ids and each file carries 1200 distributions across
      the two splits and 40 contiguous epochs
- [x] 3.3 Add the ship-gate suite over the committed artifact and manifest, verifying pool
      id, schema version and seed match; coverage is non-empty and contains the default
      id; each covered configuration has exactly one distribution per manifest image in
      the right split with held-out images under `training`; epochs are contiguous; every
      vector decodes within the declared tolerance; and provenance is present with a
      clean-tree revision
- [x] 3.4 Extend the gate with the two refusals that keep the artifact honest, verifying
      an entry carrying a true category or a chosen action is refused naming that field,
      and a configuration whose numbers were altered without a recorded shaping step is
      refused as unshippable
- [x] 3.5 Add the architecture parity check, verifying `blockChannels`/`blockSizes`
      recomputed from the declaration equal the `architecture` block each configuration
      recorded, and that the test names the configuration when they diverge

## 4. Switch the app to the trained artifact

- [x] 4.1 Add `'data/artifacts': 'artifacts'` to `DATA_MOUNTS` and verify the dev
      middleware serves `index.json` and `closeBundle` copies the directory into `dist`
- [x] 4.2 Derive the predictions URL from the loaded declaration's `predictions` field and
      collapse `TaskDataPaths.pool`/`generatedPool` into one `pool: PoolPaths`, verifying
      `web/src/data/paths.test.tsx` covers the derivation and that no second predictions
      constant remains
- [x] 4.3 Load ground truth through `readPool()` over the generated manifest instead of
      the fixture, verifying a task whose manifest refuses does not load and that the
      images the browser shows are the images the run scores
- [x] 4.4 Read coverage from the index before fetching any configuration file, verifying a
      valid but uncovered configuration refuses as `untrained-configuration` naming the id,
      distinct from an invalid configuration, with no substitution or fallback
- [x] 4.5 Remove the training browser's "not the images your run scored" notice and verify
      the screen test that asserted it is updated to assert the browsed pool is the scored
      one
- [x] 4.6 Verify the whole build end to end: `npm test`, `npm run typecheck` and
      `npm run build` pass, and `dist/data/artifacts/apple-harvest/predictions/index.json`
      is present in the output

## 5. Review and record

- [x] 5.1 Review the three runs against the intended lesson — train-versus-validation gap
      per width, and the per-category distributions on the subtle-worm and out-of-band-red
      populations — and verify the finding is written down, including the case where width
      alone does not separate
- [x] 5.2 Re-measure `training/README.md`'s cost table across widths rather than depths and
      verify it lists timings and parameter counts for `blocks2` at channels 8, 16 and 32
- [x] 5.3 Not applicable, and recorded as such: 5.1 found the lesson lands in the harvest
      breakdown as measured, so no shaping was applied and the artifact records none. The
      reader still refuses an unattributed shaping step (`test/artifact-index.test.ts`),
      so the path exists the day it is needed

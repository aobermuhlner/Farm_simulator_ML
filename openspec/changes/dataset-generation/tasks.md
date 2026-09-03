## 1. Generator scaffold

- [x] 1.1 Add `@resvg/resvg-js` as a dev dependency and a `pool:generate` npm script pointing at `tools/pool/generate.ts`; verify the script runs to completion on the Node 18 baseline `package.json` still declares in `engines`, so no contributor needs a newer Node than the project asks for
- [x] 1.2 Write `tools/pool/params.ts` holding the fixed seed, the per-category counts and every attribute interval from `design.md`; verify a test asserts the counts sum to 200 and 1000, that green holds an identical share of both splits, and that the training red band lies inside the pool red band
- [x] 1.3 Implement a seeded PRNG in `tools/pool/random.ts` with no dependency; verify a test asserts two generators on the same seed produce identical sequences and that two different seeds diverge

## 2. Attribute sampling

- [x] 2.1 Implement per-split, per-category attribute sampling from the intervals in 1.2; verify a test asserts every sampled training red falls inside the training band, and that no green image leaves its hue range or carries worm visibility above zero
- [x] 2.2 Implement the authored gap — pool reds spread past the training band, and the subtle worms carrying low worm visibility with every other attribute inside the training red band; verify a test asserts the out-of-band pool red count and exactly 100 subtle-worm images, the two populations `specs/image-pool/spec.md` requires
- [x] 2.3 Assign image ids in generation order as `t-001` for the training split and `p-0001` for the pool; verify a test asserts ids are unique and densely numbered, and that regenerating from the same seed reproduces an identical id-to-attribute mapping

## 3. Drawing and rasterization

- [x] 3.1 Implement the attribute-vector-to-SVG function in `tools/pool/draw.ts`, drawing the worm as an overlay whose size and opacity scale with worm visibility; verify a test asserts that two vectors differing in exactly one attribute produce SVG differing only in that attribute's element, so the mapping stays single-valued
- [x] 3.2 Rasterize each vector to a 128x128 cell and pack 256 cells per 2048x2048 atlas with encoder metadata stripped; verify a test asserts the atlas dimensions and cell capacity, and that two consecutive runs produce byte-identical atlases by checksum
- [x] 3.3 Emit the atlases as PNG into `pools/apple-harvest/` — one for the training split, four for the pool, PNG because the chosen rasterizer writes no other format; verify the five files exist, that their total size is under 3.5 MB against a measured 2.94 MB, and that a decode of each returns the expected dimensions

## 4. Manifest

- [x] 4.1 Emit `pools/apple-harvest/manifest.json` carrying the pool id, schema version, per-split declared counts, one descriptor per atlas with its cell size and grid, and per image its split, true category, attributes, atlas and cell index; verify a test asserts every field `specs/image-pool/spec.md` requires is present for all 1200 images
- [x] 4.2 Check the emitted manifest against `declarations/apple-harvest.json` — pool id equal to its `pool` reference, schema version equal to its `schemaVersion`; verify tests assert both hold for the committed manifest and that a deliberately altered copy of each is refused naming both values
- [ ] 4.3 Commit the generated atlases and manifest; verify a re-run of `pool:generate` leaves the working tree clean, which is the only evidence that generation is reproducible in practice rather than in principle

## 5. Pool reader and refusals

- [x] 5.1 Implement the manifest reader in `src/pool/` returning `ValidationIssue` lists rather than throwing, matching how the rest of the engine refuses; verify a test asserts a well-formed manifest loads and exposes ground truth per image id
- [x] 5.2 Implement the completeness refusal naming the missing field and the image it belongs to; verify tests omit each required field in turn, at pool level and image level, and assert the refusal names it
- [x] 5.3 Implement the identity and version refusals — pool id differing from the task's `pool` reference, schema version differing from the task's; verify tests assert each refusal names both values and that no run proceeds from either
- [x] 5.4 Implement the structural refusals — a declared split count disagreeing with the images present, an image in two splits, a category absent from a split, and a cell index outside its atlas capacity; verify a test covers each with a hand-written malformed manifest naming the defect
- [x] 5.5 Implement stable ordered enumeration of the training split; verify a test asserts two enumerations of the same manifest yield the same ids in the same order

## 6. Spec checks over the committed pool

- [x] 6.1 Assert the authored sizes and split disjointness against the committed manifest — 200 training, 1000 pool, every image in exactly one split; verify the test reads the real manifest rather than a fixture, so a regeneration that drifts fails here
- [x] 6.2 Assert the category mix and green's controlled role — every category present in both splits, green's share equal across them within the declared tolerance, no green image wormy; verify all three hold on the committed manifest
- [x] 6.3 Assert the distribution gap on the committed manifest — training reds inside the band, pool reds outside it, training worm visibility high, and the subtle worms present with their other attributes inside the training red band; verify each of the four `specs/image-pool/spec.md` scenarios has a corresponding assertion
- [x] 6.4 Assert that worm visibility is graded rather than single-valued in both splits, and that every image carries a value for each declared attribute; verify both against the committed manifest

## 7. Serving the pool

- [x] 7.1 Add the pool directory to `DATA_MOUNTS` in `web/src/data/paths.ts` as `data/pools`; verify a test asserts `sourcePathFor` resolves a manifest URL under the new mount to its on-disk path
- [x] 7.2 Derive `Content-Type` from the file extension in the dev middleware in `vite.config.ts` instead of always sending `application/json`, and confirm the build's copy step carries binary files; verify a test asserts the extension-to-type mapping serves `.json` and `.png` correctly, and that `npm run build` produces the atlases under `dist/data/pools/`
- [x] 7.3 Leave `DATA_URLS.applePool` on the fixture, per `design.md`; verify `npm test` and `npm run typecheck` both pass and that the shell's existing engine and screen tests are unchanged, confirming this change ships the pool without altering what a student sees

## 8. Verification

- [x] 8.1 Re-read `specs/image-pool/spec.md` against the implementation and record every requirement that is neither covered by a test nor deliberately deferred to `prediction-artifacts`; verify the resulting list is empty or handed to `/opsx:update` as findings

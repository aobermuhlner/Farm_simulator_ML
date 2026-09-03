## 1. Serving the generated pool to the app

- [x] 1.1 Add the generated manifest and atlas URLs to `DATA_URLS` in `web/src/data/paths.ts`, leaving `applePool` on the fixture; verify a test asserts `sourcePathFor` resolves the new manifest URL to `pools/apple-harvest/manifest.json` and that `applePool` is unchanged
- [x] 1.2 Implement a lazy pool fetch in `web/src/data/` that fetches the manifest and hands it to `readPool` from `src/pool/`, returning the reader's issues rather than throwing, per `design.md`; verify tests cover a successful load, an unreachable manifest, and a manifest the reader refuses

## 2. The grid

- [x] 2.1 Implement a `TrainingBrowser` screen under `web/src/screens/` that renders the training split in the order the pool enumerates it; verify a test asserts the rendered image ids match `pool.order.training` exactly, including its length
- [x] 2.2 Crop each cell from the atlas using the scale, background-size and background-position arithmetic in `design.md`, driven by `regionFor`; verify a test asserts one cell's computed background-position against the region the reader resolves for that image, and that two images in one atlas resolve to different positions
- [x] 2.3 Label every cell with the display label its task declares for that image's true category, exposed as the cell's accessible name; verify a test queries cells by their declared label and asserts no category id appears in the screen's source
- [x] 2.4 Map pool data to the screen's props so that image attributes are never passed in, per `design.md`; verify a test asserts no attribute value from the manifest appears anywhere in the rendered output, and that the props type carries no attribute field
- [x] 2.5 State the split's composition — a count per declared category, computed from the images actually rendered; verify a test asserts the counts shown equal the rendered counts per category and match the committed 100 red, 50 green and 50 wormy

## 3. Reaching it and coming back

- [x] 3.1 Add the browser as a view inside `ConfigureTask` with a control that opens it and one that returns, per `design.md`'s reason for not making it a stage in `App`; verify a test opens the browser and returns, asserting the configuration screen is shown again
- [x] 3.2 Verify knob values survive the trip: a test changes a knob away from its default, opens the browser, returns, and asserts the changed value is still selected and that no run was scored
- [x] 3.3 Confirm the browser is reachable without running first; verify a test opens a task, goes straight to the browser, and asserts the split renders with no report present

## 4. Honesty and refusals

- [x] 4.1 Show the mismatch notice while `fixtureBacked` is true, worded per `design.md` so it reads as "these are the training apples, the run scored stand-ins" rather than "this data is fake"; verify tests assert the notice appears when fixture-backed and is absent when not
- [x] 4.2 Render a pool refusal through the existing `Issues` component with the cause the reader named, and render no grid alongside it; verify tests cover an unreachable manifest and a pool-id or version mismatch, asserting both values appear and that no image cells are present
- [x] 4.3 Verify a partial pool never half-draws: a test refuses a manifest whose image names an unknown atlas and asserts the refusal is shown with no cells rendered

## 5. Verification

- [x] 5.1 Look at the rendered grid against the real committed atlas and confirm the apples are the right apples in the right cells and that a subtle worm is findable at the chosen thumbnail size; verify by capturing the grid once and inspecting it, since jsdom asserts the arithmetic but not the pixels
- [x] 5.2 Confirm the change is additive: verify `npm test` and `npm run typecheck` pass, the existing shell and engine tests are unchanged, and a student who never opens the browser sees what they saw before
- [x] 5.3 Re-read `specs/training-browser/spec.md` against the implementation and record every requirement neither covered by a test nor deliberately deferred; verify the resulting list is empty or handed to `/opsx:update` as findings

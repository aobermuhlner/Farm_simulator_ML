## 1. Toolchain

- [x] 1.1 Add Vite, React, React DOM and their types as dependencies with the app rooted at `web/`, and add `dev`, `build` and `preview` scripts alongside the existing `test` and `typecheck`; verify `npm run build` emits a static bundle and `npm run typecheck` still passes
- [x] 1.2 Add `@testing-library/react` and a jsdom environment to the Vitest config without disturbing the existing node-environment engine tests; verify `npm test` runs both a rendered-component test and the existing engine suite in one pass
- [x] 1.3 Serve `declarations/` and `test/fixtures/` as static assets the running app can fetch; verify a test asserts the declaration and prediction fixture both resolve over the app's own asset paths rather than through a bundler import

## 2. Loading task data

- [x] 2.1 Implement fetching and validating a task declaration at runtime through the engine's existing `validateDeclaration`, exposing a loaded-or-refused result; verify tests cover a valid declaration loading and a declaration missing a required field surfacing the field name
- [x] 2.2 Implement loading the prediction artifact and the ground-truth pool manifest for a loaded task; verify a test asserts a schema version mismatch is surfaced naming both versions and that no task data is returned from the mismatch

## 3. Farm overview

- [x] 3.1 Render the overview from declarations, listing each task by its declared title and marking declared-unavailable tasks as not selectable; verify tests assert an available task is selectable and an announced-but-unavailable one is present and not selectable
- [x] 3.2 Implement selecting a task and advancing to its configuration; verify a test asserts the selected task's declared title and task-level teaching copy appear on the configuration screen

## 4. Configuration screen

- [x] 4.1 Render one control per declared knob, choosing the control by the knob's declared `kind` alone, seeded with its declared default; verify tests assert a choice knob renders its declared values, a slider renders its declared min, max and step, and neither reads any property beyond `kind` to decide the control
- [x] 4.2 Render a help affordance on every knob that reveals that knob's declared help copy; verify a test asserts every rendered knob offers help and that activating one shows the copy declared for that knob
- [x] 4.3 Feed the current knob values through the engine's `resolveConfiguration` and display the resolved configuration identifier; verify a test asserts setting the same knob values in different orders shows one identical identifier

## 5. Run and report

- [x] 5.1 Implement the run by calling the engine's `runHarvest` against the evaluation pool split, with the shell computing no earnings, counts or actions of its own; verify a test asserts a completed run's displayed earnings equal the engine's returned value for the same inputs
- [x] 5.2 Render the report as the payoff table filled with counts — one cell per declared category and action, zero cells included — alongside total earnings, using declared labels; verify a test asserts all six apple cells and the total are present and labelled from the declaration
- [x] 5.3 Display the configuration identifier the report was produced from, and clear or mark the report stale when a knob value changes afterwards; verify tests assert the identifier is shown and that a changed knob leaves no earlier report presented as the current result
- [x] 5.4 Implement returning from a report to the configuration with the task still selected and running again; verify a test asserts the second run reports the new configuration's identifier
- [x] 5.5 Disclose on the report that its predictions came from fixture data; verify a test asserts the disclosure is present on a fixture-backed report

## 6. Refusal states

- [x] 6.1 Render every `runHarvest` refusal as ordinary content carrying the cause the engine named, showing no earnings figure and no partial report; verify a test asserts a refused run displays the engine's issue text and no total
- [x] 6.2 Present an unprecomputed configuration as an explanation of precomputation naming the configuration identifier, not as a generic failure; verify a test selects a knob combination absent from the fixture and asserts the identifier and an explanation are shown

## 7. Fixture extension

- [x] 7.1 Extend `test/fixtures/apple-predictions.json` with the declared default configuration and a few reachable by moving one knob, keeping the entries hand-written stand-ins and storing no action or label; verify tests assert the default configuration resolves, that at least one single-knob change from it also resolves, and that the existing artifact-contract tests still pass
- [x] 7.2 Confirm the extended fixture still leaves most of the cross-product absent so the refusal path stays reachable; verify a test asserts at least one declared knob combination has no artifact entry

## 8. Contract verification

- [x] 8.1 Add a second throwaway task declaration with unrelated categories and actions and render it through the same screens; verify a test asserts it produces an overview entry, a configuration screen and a report with no screen code added or changed for it
- [x] 8.2 Confirm no task id, category id, action id or knob id declared by a task appears in `web/`; verify a test or check greps the screen sources for the apple declaration's declared ids and asserts none are found
- [x] 8.3 Confirm `src/task/`, `src/policy/`, `src/scoring/` and `declarations/apple-harvest.json` are unchanged by this change; verify the diff touches none of them, and record any that had to change as a finding against `task-contract` for `/opsx:update`

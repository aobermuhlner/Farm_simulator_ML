## 1. The farm declaration

- [x] 1.1 Add `declarations/farm.json` carrying the farm's name, the currency label, the precision money is counted to, the opening balance and the opening year, and nothing else per `design.md`; verify a test asserts the file parses and that `sourcePathFor('data/declarations/farm.json')` resolves to it with no change to `DATA_MOUNTS`
- [x] 1.2 Implement a farm declaration validator in `src/economy/` returning `ValidationIssue` lists in the house shape, refusing a missing or wrongly-shaped field with the field named; verify tests cover a complete declaration, one missing the currency, one whose precision is not a non-negative integer, and one whose opening balance is finer than its own precision
- [x] 1.3 Implement amount conversion and formatting from the declared currency — an amount to whole units of the declared precision, and whole units back to a presented string carrying the declared label — with grouping done without a locale, per `design.md`; verify tests assert 0.404 rounds to 0.40, that a formatted figure carries the declared label and no other, and that a second currency declaration formats differently with no code change

## 2. Money

- [x] 2.1 Implement the farm's money value in `src/economy/` — immutable, counted in whole units, no React and no storage — with credit and debit returning a new farm value; verify tests assert eighteen thousand credits of 0.40 total exactly 7 200.00 and that the module imports neither React nor any storage API
- [x] 2.2 Require a reason on every movement and keep the year's movements recoverable in order with their amounts and reasons; verify tests assert two debits read back in order with their reasons, and that a movement with no reason throws rather than recording, per `design.md`'s split between refusals and programming errors
- [x] 2.3 Refuse a debit larger than the balance with a `ValidationIssue` naming the shortfall, leaving the balance and the year's movements untouched; verify a test debits 1 200 against 800 and asserts the shortfall of 400 is named, the balance is still 800, and no movement was recorded
- [x] 2.4 Refuse a non-integer or non-finite amount at the module edge so a doubly-applied conversion fails loudly; verify tests assert both throw and that neither leaves a movement behind

## 3. The year and the ledger

- [x] 3.1 Implement recording a harvest as one indivisible operation — settle what the harvest paid, append exactly one year record, advance the year — and expose no separate year advance, per `design.md`; verify tests assert a harvest in year 3 appends one record for year 3 and leaves the year at 4, and that credits and debits alone never change the year or append a record
- [x] 3.2 Floor the balance at zero when a harvest settles to a loss greater than the balance, recording what the harvest paid and what the floor absorbed as separate fields on the year record; verify a test records a harvest of −500 against a balance of 200 and asserts a balance of zero, −500 as what the harvest paid, and 300 absorbed
- [x] 3.3 Give each year record its year, what the harvest paid, what the floor absorbed and the balance the year closed at, appended in the order years closed and never mutated afterwards; verify tests assert three harvests produce three records with ascending years, that each closing balance equals the balance held after that harvest, that the year in progress has no record, and that an earlier record is unchanged by a later harvest
- [x] 3.4 Confirm no failure state exists: verify a test asserts the farm value carries no bankrupt, lost or game-over state, and that a farm at a zero balance still accepts a harvest and closes the following year

## 4. Loading the farm

- [x] 4.1 Fetch and validate `farm.json` in `web/src/data/` alongside the shipped tasks, handing the validator's issues back rather than throwing, per the module's existing contract; verify tests cover a successful load, an unreachable file, and a declaration the validator refuses
- [x] 4.2 Hold the farm's money, year and ledger in `App`'s state, opened at the declared opening state, and present a refusal to load the farm through `Issues` with the cause reported and no bar, year or balance on screen; verify tests assert the opening state is shown from the declaration and that a refused farm declaration shows the cause with no bar rendered

## 5. The persistent bar

- [x] 5.1 Implement the bar in `web/src/components/` rendering the declared farm name, the current year and the current balance with its declared label, its values labelled so a screen reader reads them as named values rather than loose text; verify tests query the year and the balance by their accessible names and assert the declared label appears
- [x] 5.2 Render the bar's summary facts from an ordered list of label-and-value pairs whose props type carries nothing else, per `design.md`; verify tests assert two supplied facts render with their labels in the order supplied, that an empty list renders name, year and balance with no empty summary row, and that the props type has no field naming a subject
- [x] 5.3 Place the bar above the stage switch in `App` so it is present on the overview, configuration, run and report; verify a test walks a student from the overview through a run to a report asserting the year and balance are readable on each screen
- [x] 5.4 Verify the bar follows the money without navigation: a test changes the balance while a stage is on screen and asserts that screen's bar shows the new figure

## 6. The invariant and honesty

- [x] 6.1 Extend `web/src/no-task-specific-code.test.tsx` to the farm's declared vocabulary — its name, its currency label and its summary fact labels — so no screen may name one; verify the extended test passes and fails when a currency label is pasted into a screen
- [x] 6.2 Confirm nothing claims to save: verify a test asserts no control on any screen offers to save, load, restore or reset the farm, and that no rendered copy states progress is kept
- [x] 6.3 Confirm the seam stays unattached: verify a test runs a task to a report and asserts the balance, the year and the ledger are unchanged, so no money moves outside a recorded harvest

## 7. Verification

- [x] 7.1 Confirm the change is additive: verify `npm test` and `npm run typecheck` pass, that the existing shell, engine and pool tests are unchanged, and that a student who ignores the bar sees the same four stages they saw before
- [x] 7.2 Confirm the engine stays framework-free with the new module in it: verify the existing engine-purity test covers `src/economy/` and still passes
- [x] 7.3 Re-read `specs/game-economy/spec.md` and `specs/simulator-shell/spec.md` against the implementation and record every requirement neither covered by a test nor deliberately deferred; verify the resulting list is empty or handed to `/opsx:update` as findings

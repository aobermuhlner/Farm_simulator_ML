## 1. Prerequisites and declared data

- [x] 1.1 Confirm the payoff table this screen prices with exists before starting: the task declares three actions with a complete payoff table (`three-action-sorting`); verify by reading `declarations/apple-harvest.json` rather than by assuming, and stop here if it is still two actions
- [x] 1.2 Add to the task declaration how many apples one person can sort in a harvest and the per-apple time cap, and extend `src/task/validate.ts` to refuse values that cannot work — a sorting limit below the number of declared categories, or a non-positive time cap — naming the cause; verify `test/validate-declaration.test.ts` covers the refusals and `test/apple-harvest.declaration.test.ts` asserts the shipped values
- [x] 1.3 Add the crop's opening size and category composition to `declarations/farm.json`, refused with the field named by `src/economy/declaration.ts` as the currency and opening balance already are, and read the year's crop size from farm state so it grows as the orchard does; verify a test asserts the opening crop of about ten apples, that a larger orchard yields a larger crop, and that a missing composition refuses rather than being defaulted from the pool

## 2. Drawing the crop

- [x] 2.1 Add `src/sorting/` with a crop draw that is a deterministic function of the farm's identity and the year: category counts follow the crop's declared composition allocated to whole apples, every declared category appears at least once, pictures come from the evaluation split, and no image repeats; verify a new `test/sorting-crop.test.ts` asserts the same farm and year reproduce the crop apple for apple, that a new year does not, and that the mix follows the crop rather than the evaluation split's own 500/250/250
- [x] 2.2 Apply the sorting limit at the draw: a crop within it is presented entire, a crop beyond it presents the declared number and reports the remainder as unsorted; verify the test asserts a ten-apple crop reports no remainder and a four-hundred-apple crop presents the limit and names the shortfall
- [x] 2.3 Refuse a crop that cannot be presented — too few images of a category in the evaluation split, a crop smaller than the number of declared categories, a missing crop size or composition — each naming its cause; verify the same test file covers all of them and that none returns a partial crop

## 3. Measuring and pricing

- [x] 3.1 Tally a completed sort into a count per declared category and action, scoring a decision correct when it matches the action the declaration maps that image's true category to, with the category read from the manifest; verify `test/sorting-tally.test.ts` asserts a mistake is recorded against the action actually chosen rather than merged with the others
- [x] 3.2 Price the tally with the declared payoff table over the apples actually decided, and compute what a faultless sort of those same apples would have paid; verify the test asserts unsorted apples contribute nothing, that no wage is attributed to an apple no decision was made about, and that changing a payoff entry changes the wage for identical decisions
- [x] 3.3 Assert the plateau in the module: two crops of different sizes, both beyond the sorting limit, pay the same wage for identical decisions; verify the test covers it, since this is the mechanism that makes a robot worth buying
- [x] 3.4 Compute the throughput figures — elapsed time, apples per minute, and the time the whole crop would take at that rate including the unsorted remainder — from per-apple durations capped at the declared maximum; verify the test asserts one long apple contributes the cap and that two sorts differing only in their durations produce the same wage

## 4. The sorting screen

- [x] 4.1 Add the sorting stage to the shell as a farm stage carrying the persistent bar, reachable from the farm overview and leavable back to it, offered whenever no robot is working the orchard and not offered for a crop a robot is working; verify `FarmOverview` tests assert it is offered with no robot, offered again the following year, not offered once a robot works the orchard, and offered again if the robot is taken off it
- [x] 4.2 Render one apple at a time by cropping the atlas, with the declared actions in declared order, each carrying its declared label, a distinct key binding shown on the control, and a directional gesture where three or fewer actions are declared; verify the screen test asserts pointer and keyboard each reach every action and that the bindings follow the declared order
- [x] 4.3 Show nothing about the apple but its picture — no category, no declared label, no generation attribute, no verdict on the previous decision — while showing the position in the crop and the student's own per-action tallies; verify the screen test asserts no attribute value and no correctness feedback appears mid-sort
- [x] 4.4 Present the refusals from task 2.3 with the cause the module named, and no apple, no partial crop and no wage; verify the screen test covers an unreachable pool and a mismatched one

## 5. The summary

- [x] 5.1 Show the per-category-and-action breakdown alongside the count correct, including combinations with a count of zero; verify the screen test asserts the breakdown is present rather than a headline alone
- [x] 5.2 Show the wage, the faultless-sort wage, the throughput arithmetic and — when part of the crop went unsorted — how many apples were left and that they earned nothing; verify the screen test covers a crop sorted entire and a crop past the limit
- [x] 5.3 Show the declared price of putting a robot on the orchard when the farm declares one, and omit the comparison when it does not; verify the screen test covers both, and that no price appears that the declaration does not carry
- [x] 5.4 Offer a review of the incorrectly decided images after the wage is shown, each with its category's declared label and the action that category maps to, and make no such review reachable mid-sort; verify the screen test asserts the review shows no generation attribute

## 6. Paying the year

- [x] 6.1 On completing every apple presented, record a harvest through `src/economy/` — settle the wage, append exactly one record for the year that closed, advance the year — as the one indivisible step that module defines; verify a test asserts one ledger record per hand-sorted year and that re-entering a year already harvested shows its outcome instead of a new crop
- [x] 6.2 Make an abandoned sort settle nothing, append nothing and leave the year where it was; verify the test asserts the balance, the ledger and the year are all unchanged
- [x] 6.3 Assert that no per-image decision leaves the sort: nothing is written to a dataset, an artifact or saved state, and the year's record holds only the wage, the counts and the measured rate; verify a test inspects the recorded state for per-image decisions and fails if any survive

## 7. Close out

- [x] 7.1 Extend `web/src/no-task-specific-code.test.tsx` to cover the sorting stage: a second task declaring unrelated categories and actions renders it from its declaration with no screen change; verify the test fails when a category or action id is hard-coded into the sorting screen
- [x] 7.2 Check the shipped payoff table is not degenerate through this screen: a sort that chooses one action for every apple earns visibly less than a careful one; verify a test asserts it and, if it fails, report the table rather than compensating for it here
- [x] 7.3 Play the first harvests in the app — ten apples sorted whole, then a larger crop after trees are bought, then a crop past the sorting limit — and record what each paid, how long each took, and where the wage stops rising; verify the figures come from the app rather than from a separate calculation
- [x] 7.4 Set the first-pass numbers against what 7.3 measured: the starting crop, what one person can sort in a harvest, and the price of the robot, so that the plateau bites at a point where the robot is nearly affordable; verify these move as declared data and that no code changes to retune them
- [x] 7.5 Run the full suite (`npm test`, `npm run typecheck`) and verify it passes, then sync the `simulator-shell` delta into `openspec/specs/simulator-shell/spec.md` and archive the change

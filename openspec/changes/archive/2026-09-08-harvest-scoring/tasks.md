## 1. The declared delivery term

- [x] 1.1 Add the delivery term to the task declaration types (`measures`, `delivering`, `tolerance`, `warnAbove`, `downgradedValue`) as an optional field, and verify a declaration without one still type-checks and loads
- [x] 1.2 Validate the term in `src/task/validate.ts`: every named category and action is declared, at least one of each, the delivering actions are not every declared action, and at least one measured category's declared action lies outside them — verify each refusal names the offending id, in `test/validate-declaration.test.ts`
- [x] 1.3 Validate `tolerance > 0` and `0 < warnAbove < tolerance`, and verify both refusals name the field
- [x] 1.4 Verify a task declaring no delivery term is accepted as complete and reports nothing missing, per the `task-contract` delta

## 2. The year's crop belongs to the farm

- [x] 2.1 Add `yearVariation` to the farm declaration types and validator: each range must contain that category's declared share, lie strictly inside (0, 1), and leave every other declared category room for at least one apple — verify each refusal names the category, in `test/farm-declaration.test.ts`
- [x] 2.2 Draw the year's composition in `src/sorting/crop.ts` from `streamFor(seed, year)` before the image draw: varying categories from their ranges, the rest holding their declared ratio and absorbing the remainder — verify the per-category counts sum to the crop size and that the non-varying categories keep their ratio
- [x] 2.3 Verify the composition draw is deterministic in (seed, year) and that two different years of one farm draw different compositions, in `test/crop-draw.test.ts`
- [x] 2.4 Replace the exhaust-once image draw with `floor(n/m)` full passes plus a shuffled remainder, and verify no photograph appears more than `ceil(n/m)` times and none appears twice while another appears once
- [x] 2.5 Return whether any photograph recurred, and the count of photographs the split holds per category, on the crop — verify a 6 000-apple crop reports recurrence and a 300-apple crop does not
- [x] 2.6 Verify a crop of 6 000 is drawn against the 1 000-image evaluation split with the year's composition intact, and that every declared category is represented at least once
- [x] 2.7 Verify the crop refuses with a named cause when the farm records no usable size, and that no partial crop is returned

## 3. Valuing a delivery

- [x] 3.1 Add a delivery valuation over a `RunOutcome` in `src/scoring/`: gross, delivered count, measured share, breach, downgrade and paid, per `design.md` Decision 4 — verify the arithmetic `gross - downgrade = paid` holds in every branch
- [x] 3.2 Verify a share below the tolerance pays gross and applies no downgrade, and a share at the tolerance pays every delivered apple the downgraded value while non-delivered apples keep their payoff entries
- [x] 3.3 Verify a crop with nothing delivered reports no share and no downgrade, and that discarding everything earns less than a delivery inside the tolerance
- [x] 3.4 Verify a task declaring no term is valued as the plain payoff sum with no share, tolerance or downgrade reported — the `decision-policy` delta's compatibility scenario
- [x] 3.5 Record the warning: set `warned` when the share reaches `warnAbove` but not the tolerance, and verify it is not set below the band nor when the delivery is downgraded
- [x] 3.6 Verify that one image's chosen action changing across the tolerance moves earnings by more than the difference between that image's two payoff entries, per the `decision-policy` delta
- [x] 3.7 Assemble the harvest record — crop size, drawn composition, per-cell counts, gross, share, tolerance, warned, downgrade, paid, recurrence — and verify each figure is recoverable after the farm has advanced several years

## 4. Scoring the crop instead of the pool

- [x] 4.1 Change `runFielded` in `web/src/model/run.ts` to take the year's crop and score the distributions of its images, dropping the `'pool'` split argument — verify the count of images scored equals the crop size, not the pool size
- [x] 4.2 Verify a crop that repeats a photograph scores that photograph once per appearance, so its payoff and its cell count are both counted each time
- [x] 4.3 Verify a task at work by a model and the same year sorted by hand are applied to the same crop, of the same size and composition, in `web/src/App.farm.test.tsx`
- [x] 4.4 Verify a year run, abandoned before closing, and run again presents the same crop
- [x] 4.5 Verify the refusal path is unchanged: a configuration that cannot be resolved or fetched leaves the year open with the engine's own cause, and no crop is substituted

## 5. The report

- [x] 5.1 Add per-row earnings to the report and verify no figure combines only the identified cells' money, alongside the existing no-accuracy-figure assertion
- [x] 5.2 Show gross, downgrade and paid as three figures when a term is declared, and the total alone when none is — verify both in `web/src/App.shipped.test.tsx`
- [x] 5.3 Show the delivery line: measured share, the count and declared labels of the measured categories, the tolerance, and accepted or downgraded — verify it reads from the declaration and names nothing apple-specific
- [x] 5.4 Show the warning in the same place a downgrade is reported, and verify it appears when the harvest recorded one and not otherwise
- [x] 5.5 Show the crop's size and each category's share for the year in declared labels, and verify no wording presents the difference between two years as noise, variance or error
- [x] 5.6 Show the recurrence disclosure with the count of photographs the pool holds, and verify it is absent for a crop that repeated nothing
- [x] 5.7 Verify `web/src/no-task-specific-code.test.tsx` still passes: no screen names a category, an action, or the delivery term's vocabulary

## 6. Hand sorting keeps its guarantees

- [x] 6.1 Present only distinct photographs to a person, drawn from those not yet used, and verify no picture is shown twice from a crop in which photographs recur
- [x] 6.2 Apply the delivery term to the wage over the apples the student decided, and verify a careless sort that reaches the tolerance is downgraded on the same terms a robot's delivery would be
- [x] 6.3 Verify a sort that keeps the share below the tolerance is paid the plain payoff sum, and that the perfect-play comparison figure is computed the same way
- [x] 6.4 State the measured share and the tolerance on the sorting summary, and verify the unsorted count and throughput arithmetic are unchanged
- [x] 6.5 Verify the existing hand-sorting tests pass against the new crop draw, updating expected apples where the stream shift moved them (`design.md` Decision 3)

## 7. The numbers, set from measurement

- [x] 7.1 Set `openingCrop` to 6 000 and `yearVariation.wormy` to 0.07–0.14 in `declarations/farm.json`, and verify the farm opens and draws a crop of 6 000
- [x] 7.2 Change the wormy row of the payoff table to −0.50 for both crating actions in `declarations/apple-harvest.json`, and verify `decision-policy`'s best-paying-action validator still accepts the declaration
- [x] 7.3 Add the delivery term to `declarations/apple-harvest.json` with tolerance 0.12, `warnAbove` 0.09 and `downgradedValue` 0.05, and verify the task loads and harvests
- [x] 7.4 Update the earnings figures in `test/fixtures/`, `test/farm-money.test.ts`, `test/farm-ledger.test.ts` and the web tests, deriving expected values from the declaration where a test can rather than hard-coding them
- [x] 7.5 Add a test asserting per-year earnings for all three shipped configurations at the mildest and wettest declared year, against `design.md` Decision 5's table (1 363 / 1 353 / 1 388 at the declared 10 % year, ±1 CHF)

## 8. The guards, as tests over what ships

- [x] 8.1 Add a build-time test that scores every selectable configuration over the mildest and wettest compositions the declared ranges permit, and asserts every measured share falls on the same side of the tolerance — per `design.md` Decision 8
- [x] 8.2 Add a test that the measured share stays below the tolerance for every shipped configuration across the whole declared range, and record the highest share it finds so a future retune sees the margin
- [x] 8.3 Add a test that, within one year's crop, the best-earning selectable configuration earns more than the worst-earning one
- [x] 8.4 Add a test that one configuration's earnings spread across many draws of one held composition stays below its distance from the other selectable configurations in that year
- [x] 8.5 Add a test that the warning band is reachable: some composition the declared ranges permit puts a shipped configuration's share at or above `warnAbove` and below the tolerance
- [x] 8.6 Add a test that a hand sort crating every apple breaches the tolerance in the wettest declared year and does not in the mildest, so the punishing branch is exercised by play and not only by fixtures

## 9. Closing the change

- [x] 9.1 Run the whole suite and the type-check, and verify nothing outside this change's scope regressed
- [x] 9.2 Play a year end to end in the browser — draw a crop, bring it in by a model, read the report, then bring the following year in by hand — and verify the delivery line, the warning band, the year's composition and the recurrence disclosure all appear as specified
- [x] 9.3 Record the measured per-year figures and the highest observed share in `design.md`, replacing the simulated numbers with the ones the shipped code produces

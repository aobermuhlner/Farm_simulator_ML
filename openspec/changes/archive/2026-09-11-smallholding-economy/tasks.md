## 1. The declarations

- [x] 1.1 In `declarations/farm.json` set `openingBalance` to 0, `orchard.opening` to 1 and `orchard.piecesPerUnit` to 5, and add `automation: { "item": "sorting-tree" }`; verify the farm declaration validator accepts it and reports an opening crop of 5
- [x] 1.2 In `declarations/apple-harvest.json` triple every entry of `payoffs` (red 1.20 / 0.60 / 0, green -0.90 / 0.60 / 0, wormy -1.50 / -1.50 / 0) and set `delivery.downgradedValue` to 0.15; verify the task validator accepts it and that a hand-computed perfect-play figure of 0.87 a piece matches what the scoring code returns for one apple of each category in declared proportion
- [x] 1.3 In `declarations/apple-harvest.json` remove `handSorting.perHarvest`, leaving `secondsPerImage`; verify the task declaration still loads once task 2.1 lands
- [x] 1.4 In `declarations/catalog.json` empty `ownedAtStart`, give `robot-eye` a price of 10000 and drop its `notForSaleReason`, and drop `sorting-tree` to 100; verify the catalog validator accepts it and that a new farm reports owning nothing
- [x] 1.5 Rewrite the shop copy for `robot-eye` (it no longer came with the robot) and for `sorting-tree` (it is no longer the second model, it is the first one the farm can own, and it is what stops the clicking); verify no copy in the catalog claims either model is free or already owned
- [x] 1.6 Replace `orchard-expansion` with six items — +4 at 15, +5 at 55, +10 at 110, +30 at 220, +50 at 550, and +100 at 1100 with `repeat: 3` — each with its own label and copy; verify the market reports a reachable maximum of 400 trees
- [x] 1.7 Re-price `tree-four-questions` to 150 and `tree-six-questions` to 400; verify the catalog validator accepts it

## 2. Validation and declaration types

- [x] 2.1 Drop `perHarvest` from the `handSorting` declaration type and from `src/task/validate.ts`, keeping `secondsPerImage` and its checks; verify the validator suite passes and that a declaration still carrying `perHarvest` is refused as an unknown field rather than silently honoured
- [x] 2.2 Confirm `src/economy/declaration.ts` accepts a zero opening balance and a one-unit orchard with no new refusal; verify by loading the new `farm.json` in a test that asserts balance 0, land 1 and crop 5

## 3. The crop presented for hand sorting

- [x] 3.1 In `src/sorting/crop.ts` stop clamping the presented crop to a declared number, so the whole crop is presented when the split can supply it distinctly; verify with a crop of 5 that all 5 apples are presented and nothing is reported unsorted
- [x] 3.2 Bound the presented portion by the evaluation split, keeping the crop's own composition: find the category that runs out of distinct photographs first and scale the portion to it; verify a 2000-apple crop against the 500/250/250 split presents about 714 apples holding each category in the crop's proportions, and that the rest is counted as undecided
- [x] 3.3 Verify that two crops of different sizes but the same composition, both beyond what the split can supply, present the same apples and pay the same wage for identical decisions

## 4. Delivering part of a crop

- [x] 4.1 Extend `src/sorting/tally.ts` with the figures the stop choice is made against: the wage so far, the count that would be discarded, the declaration-derived value of that count, and the projected time at the capped measured rate; verify a unit test that the value figure is computed from the declared composition and payoffs and is unchanged when the true categories of the remaining apples differ
- [x] 4.2 Add the deliver control and its confirmation to `web/src/screens/HandSort.tsx`, absent until the first decision, naming what is delivered and how many are discarded; verify a test that the control is absent at zero decisions, present after one, and that abandoning the confirmation leaves the balance, the year and the decisions untouched
- [x] 4.3 Settle a delivered partial sort exactly as a completed one — wage against the balance, one ledger record, the year advances; verify a test that delivering after 3 of 5 apples appends exactly one record and advances the year
- [x] 4.4 Make a delivered year unreturnable: re-entering shows that year's outcome and never re-offers the discarded apples; verify a test that re-entry after an early delivery credits nothing further and presents no apple
- [x] 4.5 Show the declared automation's price beside the deliver offer as well as in the summary, and omit both when no `automation` is declared; verify a test with and without the field that no price appears the declaration does not carry
- [x] 4.6 Verify that nothing on the stop panel states or implies the category of any apple not yet decided

## 5. A crop too small for its shares

- [x] 5.1 Add the requirement's behaviour to the crop draw and its report: the drawn counts are what is recorded and reported at every size; verify a test that a 5-apple crop at 55/35/10 draws 2/2/1
- [x] 5.2 Verify a test that the whole of the wormy `yearVariation` range (0.07 to 0.14) yields 2/2/1 at a 5-apple crop, and that neither year is presented as differing from the other or as noise, error or sampling variation
- [x] 5.3 Ensure no screen prints the declared composition beside a crop whose counts differ from it by more than whole-apple rounding; verify by rendering the opening farm and asserting 55/35/10 appears nowhere against that crop

## 6. Fixtures, tests and the suite

- [x] 6.1 Update every fixture and test carrying the old opening figures — 2000 balance, 100 trees, 60 apples a tree, 60 per harvest — to the new ones; verify by grepping the test tree for those literals and finding only deliberate ones
- [x] 6.2 Update every test asserting a payoff or earnings figure to the tripled table; verify the scoring and harvest suites pass
- [x] 6.3 Verify that no prediction artifact, pool manifest or model fixture needed changing — if one did, stop and report it rather than updating it, since nothing here should move what a model predicts
- [x] 6.4 Run the whole suite and the no-task-specific-code guard; verify both pass

## 7. Playing it

- [x] 7.1 Open a new farm and walk the opening: hand-sort 5 apples, read the wage and the automation price, and confirm the figures on screen match 4.35 at perfect play
- [x] 7.2 Walk the ladder far enough to buy the first expansion and the sorting tree, confirming the orchard reads 1, 5, 10 and the market states a maximum of 400 trees
- [x] 7.3 On an orchard large enough for the split to bind, start sorting, stop part way, and confirm the delivered wage, the discarded count and the closed year are all what the panel promised

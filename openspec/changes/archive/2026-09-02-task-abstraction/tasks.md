## 1. Project scaffold

- [x] 1.1 Add `package.json` with TypeScript and Vitest, a strict-mode `tsconfig.json`, and `vitest.config.ts`; verify `npm test` runs and reports zero tests without error
- [x] 1.2 Declare the task-declaration types in `src/task/types.ts` covering every field named by task-contract's completeness requirement; verify `npx tsc --noEmit` passes

## 2. Apple task declaration

- [x] 2.1 Write `declarations/apple-harvest.json` with a stable id, display title, pool reference, prediction artifact reference and schema version; verify a test imports and parses it against the types from 1.2
- [x] 2.2 Declare the three categories, the two actions, and the category-to-action mapping (red to pick, green to decline, wormy to decline); verify a test asserts every declared category maps to a declared action
- [x] 2.3 Declare each exposed knob with id, label, kind, allowed values, default and help copy, using design.md's working set of depth, width, regularization and dropout; verify a test asserts all six fields are present on every knob
- [x] 2.4 Fill the payoff table with a value for every category-and-action pair, and declare the decision policy plus task-level and knob-level teaching copy; verify a test asserts all six payoff cells and every remaining required field are present

## 3. Declaration validation

- [x] 3.1 Implement completeness validation in `src/task/validate.ts` that refuses a declaration missing any required field and names the missing field; verify tests omit each required field in turn and assert the refusal names it
- [x] 3.2 Implement the at-least-two-categories-and-actions check and mapping coverage check; verify tests reject a declaration with one category, one action, and an unmapped category
- [x] 3.3 Implement knob value validation rejecting values outside a knob's declared value list or its min/max/step; verify tests reject an out-of-list choice and an off-step slider value, and assert no run is scored from either
- [x] 3.4 Implement payoff table completeness validation that names the missing category-and-action combination; verify a test omits one cell and asserts the error names that pair
- [x] 3.5 Implement schema version comparison that refuses to run on mismatch, names both the declared and artifact versions, and never falls back to partial data; verify tests cover mismatch refusal and matching-version success

## 4. Configuration identity

- [x] 4.1 Implement the derived readable configuration id in `src/task/configId.ts` from knob ids and values in declared order, per design.md; verify tests assert the same knob values set in different orders produce one identical id
- [x] 4.2 Implement lookup of prediction entries and training history by configuration id against a hand-written fixture artifact; verify a test asserts both lookups resolve to the same configuration

## 5. Decision policies

- [x] 5.1 Implement the highest-probability policy in `src/policy/`; verify a test asserts the action mapped from the greatest-probability category is the one chosen
- [x] 5.2 Implement the threshold policy with per-category thresholds, the declared-order tie-break when several categories clear, and the fallback when none do; verify tests cover all three branches and that raising a threshold never increases that action's count
- [x] 5.3 Implement the cost-optimal policy choosing the action with the greatest expected payoff from the distribution and payoff table; verify a test with an asymmetric penalty asserts the alternative action beats the most likely category
- [x] 5.4 Implement rejection of a declaration that declares no decision policy; verify a test asserts it is rejected as incomplete and does not run

## 6. Scoring and reporting

- [x] 6.1 Implement earnings as the sum of payoff entries for each evaluated image's true category and chosen action; verify a test asserts identical earnings across two runs over the same images and configuration
- [x] 6.2 Implement per-category-and-action counts reported alongside total earnings; verify a test asserts the counts are present and that an over-selective configuration's low correct-category count is distinguishable from its low-value-action counts

## 7. Contract verification

- [x] 7.1 Confirm against the fixture that stored entries are probability distributions only, carry one probability per declared category, and cover both the training split and the evaluation pool, and that swapping the declared policy leaves the fixture unchanged; verify tests assert no stored action or label appears and both splits resolve
- [x] 7.2 Re-read both specs against the implementation and record every requirement that is neither covered by a test nor already out of scope for this change; verify the resulting list is empty or handed to `/opsx:update` as findings

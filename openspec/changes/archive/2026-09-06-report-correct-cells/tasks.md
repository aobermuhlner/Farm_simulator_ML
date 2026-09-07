## 1. The shape no shipped task has

- [x] 1.1 Add a many-to-one fixture to `web/src/test-support/declarations.ts`: a declaration with at least three categories and at least two actions, mapping two of its categories onto the same action, named for the shape it holds open rather than for any domain; it must validate under `src/task/validate.ts` unchanged, which includes the agreement rule `three-action-sorting` added — every category's declared action strictly outpaying every other action in that category's row — so give it a payoff table that satisfies that rather than a flat one; verify a test asserts it validates with no issues and that its `categoryActions` maps two categories to one action
- [x] 1.2 Confirm the fixture actually discriminates a mapping implementation from a diagonal one, since that is the only reason it exists: verify a test asserts that for this declaration the cells its mapping names are *not* the diagonal — at least one row's named cell sits at a column index different from that row's index, and one column carries the named cell of two different rows — so an implementation that marked `categories[i]` against `actions[i]` would fail it

## 2. The report marks the cell the declaration names

- [x] 2.1 Mark the declared cell in `web/src/screens/Report.tsx` by comparing each cell's action against `declaration.categoryActions[category.id]`, and expose the mark on the cell alongside the existing `data-cell` attribute so tests can target it without reading styles; verify tests assert exactly one marked cell in every row, that it is the cell the mapping names — checked against both `appleDeclaration()` and the many-to-one fixture — and that a marked cell holding a count of zero is marked exactly as one holding a large count
- [x] 2.2 Confirm the mark needed nothing from the engine: verify the component takes no new prop for it, that `RunOutcome` and `scoreRun` are unchanged, and that a report rendered from a hand-built outcome with counts that contradict the declaration still marks the cells the declaration names — the mark is a property of the task, not of the run

## 3. The cue is not colour, and not only visual

- [x] 3.1 Draw the marked cell in `web/src/styles.css` with a static border treatment that is visibly distinct from any focus or hover styling the table or its ancestors carry; verify a test reads `styles.css` and asserts the rule selecting the marked cell sets at least one property that is not a colour, because jsdom does not apply stylesheets and a test asserting a computed colour here would assert nothing
- [x] 3.2 Put `.visually-hidden` text inside the marked cell naming what the cell is, using the existing class; verify a test asserts the marked cell's accessible text contains that wording and that an unmarked cell's does not, so the distinction reaches a reader going through the table cell by cell
- [x] 3.3 Extend the table's existing `<caption>` with one sentence keying the treatment in words, as `colour-vision-safety` requires of a key; verify a test asserts the caption is present and mentions the marking, and that the sentence names no declared category, action or task — it speaks of categories and actions only

## 4. The prohibitions the requirement carries

- [x] 4.1 Verify a test asserts the report presents no count or proportion of correctly treated images and no figure summing the marked cells — render a report and assert that the only aggregate on screen is the declared total earnings, so that marking the correct cells does not become the first step towards the accuracy number `CLAUDE.md` warns against
- [x] 4.2 Verify a test asserts the columns stay in `declaration.actions` order and the rows in `declaration.categories` order when rendered from the many-to-one fixture, where the marks do not line up — a guard against a later change that sorts columns to make them line up
- [x] 4.3 Verify `web/src/no-task-specific-code.test.tsx` still passes with the mark in place, confirming that no category id, action id or declared label entered `Report.tsx` and that the new wording is generic

## 5. Nothing else moved

- [x] 5.1 Assert the engine is untouched: verify the existing scoring and policy suites pass unchanged, and confirm by hand that `git status` reports no change under `src/`, `declarations/`, `artifacts/` or `pools/`
- [x] 5.2 Run the full suite and `openspec validate report-correct-cells --strict` through the bundled Node under `AppData\Local\Temp\os-node` — the machine's default Node 18 cannot run the CLI — and record in the change any requirement the run showed to be stated more narrowly than the code now behaves

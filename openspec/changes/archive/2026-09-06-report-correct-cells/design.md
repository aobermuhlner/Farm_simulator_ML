## Context

See `proposal.md` — Why. The requirement is in `specs/simulator-shell/spec.md`; this
document covers only how it is met and which of the choices it left open were taken.

Four facts about the current state decide most of what follows.

**The screen already holds everything it needs.** `Report.tsx` receives the whole
`TaskDeclaration`, and `categoryActions` is a required, already-validated field on it
(`task-contract`, `checkCategoryActions`). Deciding whether a cell is the one its category
calls for is `declaration.categoryActions[category.id] === action.id` — one expression over
data the component is already given. Nothing has to be computed, passed down, or stored.

**Both shipped declarations are now one-to-one.** `three-action-sorting` made the apple
mapping a bijection, and the screening fixture (`unrelatedDeclaration`) was always one. The
old apple task, mapping `green` and `wormy` both onto `decline`, was the repository's only
many-to-one declaration and it is gone. So nothing that ships would notice if this were
implemented as "mark the diagonal", and the rule would be wrong the day a task maps two
categories onto one action.

**The accessible-text pattern already exists.** `styles.css` carries a `.visually-hidden`
class, so announcing something to a screen reader without drawing it is house style rather
than a new mechanism.

**The vocabulary test cannot see prose.** `no-task-specific-code.test.tsx` scans `.ts` and
`.tsx` files for declared ids and labels. It will catch a screen that writes `crate-red`,
and it will not catch a caption that drifts into talking about apples. Generic wording is
therefore a discipline here, not something a test enforces.

## Goals / Non-Goals

**Goals:**
- The correct cell in each row identified from the declared mapping, so a task that is not
  one-to-one is served correctly by the same code that serves one that is.
- A cue that survives having its colours removed and reaches a reader who never sees the
  table at all.
- No engine change, and that asserted rather than assumed.
- The prohibition on an accuracy figure enforced by a test, not merely honoured by not
  writing one.

**Non-Goals:**
- Any change to what a run computes. `scoreRun` already produces the counts; this is the
  same outcome, better labelled.
- Highlighting *performance* — colouring a cell by how full or empty it is, ranking rows by
  error, or drawing attention to the worst cell. That is a different feature and a much more
  opinionated one; this change marks where correct *is*, not how the run did against it.
- Mobile layout. Laptop-first stands, and the requirement already forbids answering the
  narrow-screen question by collapsing cells.
- Exposing the mapping anywhere else. The configuration screen and the overview are
  untouched.

## Decisions

### The mark is derived at render, not carried on the outcome

The alternative was to have `scoreRun` mark each count as correct or not, so the report
reads a flag rather than doing a lookup. Rejected: it moves a presentation concern into the
engine and gives `src/scoring/` a second reason to change, when the only consumer is one
table. Deriving it in the component is also what keeps the claim in `proposal.md` — that
`src/` is untouched — literally true and cheap to assert.

It also keeps the mark honest about what it is. A flag on the outcome would read as a
property of the run; a lookup into the declaration reads as a property of the task, which is
what it is. The same nine cells are marked the same way whatever the model did.

### Shape and words, never a tick

The cue is a static border treatment on the marked cell — a shape, so it survives the
colours being removed — plus `.visually-hidden` text inside the cell naming what the cell
is, plus one sentence in the table's existing caption keying the treatment in words.
`colour-vision-safety` requires the first two of those outright ("Colour is never a
category's only cue on a screen", "A colour-coded key SHALL name in words what it keys"); the
third is what makes the first two mean anything to a student who has not been told what a
box around a number signifies.

Three alternatives were rejected.

*A background tint alone* is forbidden by the spec above, and would have been the obvious
thing to reach for.

*Bold text alone* is a weak cue at the size a count is drawn, and it fails hardest exactly
where the mark matters most: a marked cell containing `0` is the single most diagnostic
thing this report can show, and a bold `0` is nearly indistinguishable from a plain one.

*A tick or check mark in the cell* is the one worth arguing about, because it is what most
confusion matrices do. It is rejected because it says the wrong thing. The marked cell is
where correct *would* be, not a cell that *was* correct — on a badly configured run a marked
cell holds `0`, and a `0` beside a tick reads as a contradiction rather than as the finding.
A border around the cell says "this is the cell this row is aiming at" and stays true
whatever number is in it. Mixing a glyph into a column of numerals also makes the counts
harder to scan, which is the opposite of the point.

### The wording stays over categories and actions

The visually-hidden text and the caption sentence speak of "the action this category calls
for". They name no category, no action and no task, so the vocabulary test passes — but more
to the point, that phrasing is the accurate one. "Correct" invites the reading that the
count in the cell is a score, and "expected" suggests a prediction. What the mapping
declares is what the task calls for, and saying so is both true and task-agnostic.

### The many-to-one case is held open by a fixture

Since no shipped declaration maps two categories onto one action, a fixture is added to
`web/src/test-support/declarations.ts` that does, purely so the rule cannot quietly
degenerate into "mark the diagonal". It goes there rather than inline in the report's test
because the file is already the house's home for shape fixtures (`unrelatedDeclaration`,
`diagrammedDeclaration`, `convolutionalDeclaration`) and because the shape is one any later
screen test may need.

This is worth the file it costs. A diagonal implementation and a mapping implementation are
indistinguishable against every declaration in the repository, so without this fixture the
requirement's central distinction is untested by construction, and the cheaper wrong version
would pass review.

### The absent accuracy figure is asserted

A test asserts the report renders no proportion or count of correctly treated images. The
alternative is simply not to build one, which is what "we won't do that" usually means.
Rejected because the spec says SHALL NOT and because this is precisely the prohibition a
later well-meant change walks through — marking the correct cells makes summing them the
obvious next move, which is why the prohibition lives in the same requirement as the marking
rather than filed somewhere else.

### Declared order is already right, and gets a guard

`Report.tsx` maps `declaration.categories` and `declaration.actions` in declared order, so
the requirement that nothing be reordered to align the marks holds today by construction.
The test is a guard against a future change that sorts columns to make the marks line up — a
tempting tidy-up once the marks exist, and one that would make the report a picture of
itself rather than of the task.

## Risks / Trade-offs

**A boxed cell can read as selectable.** A border is also what focus and hover look like, so
the mark could be read as an affordance in a table that has none. → The treatment is static
and distinct from any interactive styling, and the caption sentence says what it means in
words. If it still reads as interactive, the fix is the drawing, not the rule.

**The mark can be misread as praise.** A student may take the box to mean "these were
right", which inverts the finding on a bad run. → The wording carries this: the cell is the
one the category *calls for*, and a marked cell holding `0` is then legible as the failure it
is rather than as a contradiction. This is the reason a tick was rejected.

**Generic prose is on the honour system.** Nothing tests that the caption stays free of
apples, because the vocabulary test only sees declared ids and labels. → Keep the sentence
about categories and actions. It is one sentence, and it is the same discipline every other
line of screen copy in this repository already keeps.

**A fixture written for one test.** The many-to-one declaration exists only to hold a
distinction open and has no shipped counterpart. → That is the point rather than a defect;
the alternative is a requirement whose central clause no test can fail. It is named for what
it holds open so a later reader does not mistake it for a task anyone plans to build.

## Migration Plan

No data migration: nothing is stored, no declaration gains a field, and no artifact is read
differently. Order of work, each step leaving the suite green:

1. The many-to-one fixture goes in first, so the tests that distinguish mapping from diagonal
   exist before the thing they distinguish.
2. `Report.tsx` marks the declared cell, with its hidden text and its caption sentence.
3. `styles.css` draws the treatment.
4. The guards go in last — declared order preserved, no accuracy figure, `src/` untouched —
   where they can fail honestly.

## Open Questions

- Whether a marked cell holding `0` deserves a stronger treatment than a marked cell holding
  a large count. It is the most diagnostic state the table has, and drawing it harder would
  be defensible. It is deferred because it is a question about emphasis rather than about the
  rule, and answering it later changes neither the requirement nor the tasks.

## What the implementation showed

Recorded after the fact, as the last task asks: three places where the code now behaves in a
way the requirement does not quite reach.

**A cell's text is no longer its count.** Announcing the mark to a screen reader meant
putting text inside the marked cell, which made `textContent` stop being the number. The
count now sits in its own element and the announcement beside it. The requirement says the
identification must reach assistive technology and says nothing about what that does to the
cell, so anything later reading a cell's text — a scraper, a snapshot test, a future export —
now reads the announcement too. Worth knowing before something depends on the old shape.

**The key is coupled to the drawing.** The caption names the treatment in the word
"outlined", which satisfies `colour-vision-safety`'s requirement that a key name what it
keys, but ties the sentence to the ring. If the open question above is ever answered by
drawing a starved cell differently, the caption has to move with it. The requirement asks
for a key, not for a key that stays in step, so nothing would fail if they drifted apart.

**The colour-removal scenario is met through the stylesheet, not the render.** jsdom applies
no stylesheet, so the test reads `styles.css` and asserts the rule sets a property that is
not a colour, rather than rendering the table without colour and looking. That is the
strongest check available in this suite and it is a check on the mechanism rather than on the
result. A visual regression tool would be the thing that closes the gap, and there is not one
here.

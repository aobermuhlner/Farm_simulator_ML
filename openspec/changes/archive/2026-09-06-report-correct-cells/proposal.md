# Mark the cell that was right

## Why

The report renders every category-and-action count and says nothing about which of them
were the right answer. The declaration already knows: `categoryActions` names, for each
category, the one action that category calls for. That is declared data the report reads
past. A student is left holding the mapping in their head while reading a grid, and the
grid was the thing they were supposed to be reading.

`three-action-sorting` has just landed, which makes this cost more rather than less. The
apple task now runs six cells to nine with a one-to-one mapping, so the report is literally
a confusion matrix — and a confusion matrix whose correct cells are not marked is a harder
read than the yes/no it replaced, not an easier one. The stealth lesson `Report.tsx`
already claims in its own header comment only lands if the student can see the shape.

## What Changes

- The report marks, in every row, the cell holding the action that row's category is
  declared to call for. One cell per row, read from `categoryActions`.
- The mark is **not** the diagonal. A diagonal is what the marks happen to look like when a
  task's mapping is one-to-one, which is true of both declarations that ship today and is
  not a property the rule may lean on. Stated over the declared mapping, a task mapping two
  categories onto one action marks that action's cell in both rows and has no diagonal at
  all, and no screen has to know which shape it got. No shipped declaration is many-to-one
  since `three-action-sorting` made the apple mapping a bijection, so this case is held open
  by a fixture built for it — which is the only thing stopping the rule from quietly
  degenerating into "mark the diagonal".
- The mark is carried by text or shape, never by colour alone. `colour-vision-safety`
  already requires this of every distinction a screen draws; this change is the first to
  draw one on the report, so it is the first that has to satisfy it there.
- The mark is announced to assistive technology rather than being a visual-only cue. A grid
  read one cell at a time is exactly where "which of these was right" cannot be recovered
  from position.
- The table keeps all its cells in declared order. Nothing is grouped, moved or reordered so
  that the marks line up — a task's action order is the task's statement, not the report's
  to rearrange.
- **No accuracy figure, and no correct/incorrect totals.** Marking which cells were right
  makes a single "how many did it get right" number the obvious next step, and that number
  is the diagnosis trap `CLAUDE.md` names outright. The mark tells the student where to
  look; it must not hand them a way to stop looking.

## Capabilities

### New Capabilities
<!-- None. This adds obligations to a requirement the report already has. -->

### Modified Capabilities
- `simulator-shell`: restates *The report is the payoff table filled with counts* so that
  the report also identifies, per row, the cell the declaration names as that category's
  action — read from the mapping rather than from position, carried by more than colour,
  reaching assistive technology, and without reordering or collapsing anything to do it.

## Impact

- `web/src/screens/Report.tsx` — the only screen change, and a small one: the mark is a
  lookup into `categoryActions`, which is already on the declaration the screen holds.
- `web/src/styles.css` — how a marked cell is drawn.
- `web/src/screens/Report.test.tsx` — the marked cell per row, the many-to-one fixture, the
  colour-independent cue, the screen-reader announcement, declared order preserved, and that
  no accuracy figure appeared.
- `web/src/no-task-specific-code.test.tsx` — unchanged and must stay passing: the mark is
  read from the declaration, so no category id, action id, or word like "ripe" enters screen
  code.
- `src/scoring/`, `src/policy/`, `src/task/` — unchanged, and asserted to be. Nothing about
  what a run computes changes; this is the same outcome, better labelled.
- No declaration changes. `categoryActions` is already required of every task by
  `task-contract` and already validated, so there is no new declared field and nothing for a
  task author to add.

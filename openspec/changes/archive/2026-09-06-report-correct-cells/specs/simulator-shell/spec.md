## MODIFIED Requirements

### Requirement: The report is the payoff table filled with counts

The report SHALL present a cell for every combination of declared true category and
declared action, showing the count of evaluated images in that cell, alongside the total
earnings for the run. Categories and actions SHALL be labelled with the labels their task
declares.

Every declared action SHALL be given its own column however many the task declares. No two
actions SHALL be combined into one column, and no cell SHALL be omitted, collapsed into a
"wrong" or "other" total, or dropped for want of room, because two images treated
differently and wrongly are two different mistakes and the report is where that difference
has to be visible.

In every row the report SHALL identify the cell whose action is the one that row's category
is declared to call for. Which cell that is SHALL be read from the task's declared
category-to-action mapping and SHALL NOT be inferred from the cell's position. A task
mapping two categories onto one action therefore has one identified cell in each of those
rows and no diagonal at all, and a task whose mapping is one-to-one gets a diagonal as a
consequence of what it declares rather than as a rule about where the marks go.

The identification SHALL be carried by text or by shape and SHALL NOT be carried by colour
alone, and it SHALL be available to a reader using assistive technology rather than being a
visual cue only. A grid read one cell at a time is precisely where "which of these was the
right answer" cannot be recovered from position, so a mark that only a sighted reader can
see is a mark that has not been made.

Rows and columns SHALL stay in the order their task declares. No cell SHALL be moved,
grouped or reordered so that the identified cells line up, because the order of a task's
actions is the task's statement and not the report's to rearrange.

The report SHALL NOT present a count or proportion of images treated correctly, nor any
combined figure over the identified cells. Identifying which cell was right tells a student
where to look; a single figure summing those cells would let them stop looking, which is
the one thing this report exists to prevent.

#### Scenario: Every combination is present in the report
- **WHEN** a report is shown for a task with three categories and three actions
- **THEN** all nine category-and-action counts are displayed, including combinations with a count of zero
- **AND** the total earnings are displayed alongside them

#### Scenario: Two ways of being wrong about one image are separate cells
- **WHEN** a task declares two actions that are both incorrect for the same category
- **THEN** the report shows that category's count under each of them in its own cell
- **AND** neither is folded into the other or into a combined error figure

#### Scenario: An over-selective configuration is diagnosable on screen
- **WHEN** a configuration rarely chooses the high-value action
- **THEN** the report distinguishes the count for the category where that action was correct from the counts where the low-value action was correct

#### Scenario: A wider action set needs no screen change
- **WHEN** a task declaring one more action than another is reported on
- **THEN** its report carries one more column, labelled from its declaration
- **AND** no screen code is added or changed for it

#### Scenario: Each row identifies the cell its category calls for
- **WHEN** a report is shown for a task declaring a category-to-action mapping
- **THEN** exactly one cell in every row is identified as that category's declared action
- **AND** the identified cell is the one the mapping names

#### Scenario: A mapping that is not one-to-one has no diagonal
- **WHEN** a task maps two of its categories onto the same action
- **THEN** both of those rows identify that action's cell
- **AND** the identified cells do not form a diagonal, and none is placed as though they should

#### Scenario: The identification survives the colours being removed
- **WHEN** the report is read with its colours removed
- **THEN** the identified cell in each row is still distinguishable from the other cells in that row

#### Scenario: The identification reaches a screen reader
- **WHEN** the report's table is read cell by cell by assistive technology
- **THEN** the identified cell is announced as the one its category calls for

#### Scenario: Declared order is not rearranged to align the marks
- **WHEN** a task's declared action order places the identified cells out of line with each other
- **THEN** the columns stay in the task's declared order
- **AND** no cell is moved or grouped to align them

#### Scenario: No accuracy figure is offered
- **WHEN** a report is shown
- **THEN** no count or proportion of correctly treated images is presented
- **AND** no figure combining the identified cells is presented

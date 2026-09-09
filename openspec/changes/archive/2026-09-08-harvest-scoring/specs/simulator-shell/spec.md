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

The report SHALL additionally carry money and the year's own circumstances:

- **What each row earned.** Every category's row SHALL state what that category's apples
  came to, so the money is attached to the categories it came from rather than only to the
  run. No figure SHALL combine only the identified cells' money, for the same reason no
  count may.
- **The arithmetic of what was paid.** WHEN the task declares a delivery term, the report
  SHALL show the gross, what the downgrade took off it, and what the harvest paid, as three
  figures whose arithmetic a reader can follow. WHEN it declares none, the total earnings
  stand alone.
- **The delivery line.** WHEN the task declares a delivery term, the report SHALL state the
  measured share, the count and the categories it was measured over, the tolerance it was
  measured against, and whether the delivery was accepted or downgraded. WHEN nothing was
  delivered, it SHALL say so rather than showing a share.
- **The warning.** WHEN the harvest recorded a warning, the report SHALL say how close the
  measured share came to the tolerance, in the same place the downgrade would be reported,
  so the sentence a student reads before a bad year is in the place they will read it again
  during one.
- **The year's crop.** The report SHALL state the size of the crop and the share of it each
  declared category held that year, in that task's declared category labels. This is what
  lets a leaner year be attributed to the year. It SHALL NOT be labelled as noise, variance
  or error.
- **Recurring photographs.** WHEN photographs recurred in the crop, the report SHALL state
  that they did and how many the pool holds.

None of these SHALL be expressed in vocabulary belonging to any particular task. The
categories a delivery term measures, the actions that count as delivering, and the labels
of both are read from the declaration, so a task measuring something other than worms
reports through the same screen.

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

#### Scenario: The money is attached to the categories it came from
- **WHEN** a report is shown
- **THEN** each category's row states what that category's apples earned
- **AND** no figure combines the money of the identified cells alone

#### Scenario: A downgraded delivery shows its arithmetic
- **WHEN** a harvest whose delivery was downgraded is reported
- **THEN** the gross, the amount the downgrade took off, and what the harvest paid are all shown
- **AND** the gross less the downgrade equals what it paid

#### Scenario: An accepted delivery still shows the line
- **WHEN** a harvest whose measured share stayed below the tolerance is reported
- **THEN** the measured share and the tolerance are shown, and the delivery is stated as accepted

#### Scenario: The warning is where the downgrade would be
- **WHEN** a harvest that recorded a warning is reported
- **THEN** how close the measured share came to the tolerance is stated
- **AND** it appears in the same place a downgrade is reported

#### Scenario: The breakdown contradicts the headline
- **WHEN** a delivery is downgraded by the apples of one rare category
- **THEN** the total paid is shown alongside the count of those apples and what the downgrade cost
- **AND** the cost of that category's cells is legible against the size of the crop

#### Scenario: The year is stated so a lean year can be attributed
- **WHEN** two closed years' reports for one unchanged configuration are read
- **THEN** each states its crop's size and the share each category held
- **AND** neither presents the difference between them as noise, variance or error

#### Scenario: Recurring photographs are disclosed on the report
- **WHEN** a harvest whose crop repeated photographs is reported
- **THEN** the report states that photographs recur and how many the pool holds

#### Scenario: A task with no delivery term reports no delivery line
- **WHEN** a harvest for a task declaring no delivery term is reported
- **THEN** no share, tolerance, downgrade or warning appears
- **AND** the total earnings are shown as one figure

#### Scenario: The delivery line names nothing task-specific in the shell
- **WHEN** a task whose delivery term measures a category unrelated to apples is reported on
- **THEN** the measured categories and delivering actions are named from that task's declaration
- **AND** no screen code is added or changed for it

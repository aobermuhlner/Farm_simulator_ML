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

## Purpose

Defines the screens a student moves through — farm overview, configuration, run, report —
and requires that each is derived from task declarations rather than written per task, so
that the task contract's promise holds in front of a student and not only in tests.

## Requirements

### Requirement: The student moves through overview, configuration, run and report

The shell SHALL present a task as four stages: an overview of available tasks, a
configuration of that task's declared knobs, a run, and a report of that run. A student
SHALL be able to return from a report to the configuration and run again without
reselecting the task.

#### Scenario: A run is reachable from the overview
- **WHEN** a student selects an available task and accepts the declared knob defaults
- **THEN** a run completes and its report is shown

#### Scenario: A configuration can be revised and re-run
- **WHEN** a student returns from a report to the configuration and changes a knob
- **THEN** the task remains selected
- **AND** running again produces a report for the new configuration

### Requirement: The market is a stage of the farm, not of a task

The shell SHALL present a market, reachable from the farm overview without a task being
selected and leavable back to it. The market SHALL be rendered from the declared catalog
alone: its groups in the order they are declared, each item under its declared group with
its declared label, its shop copy, and its price where it has one, together with which of
owned, buyable now, not yet affordable, or not for sale it currently is. A group with no
items SHALL NOT be shown as an empty section.

The balance SHALL be readable from the market as it is from every other screen, and a
purchase SHALL be reflected in the balance and in that item's state without leaving the
market. WHEN the catalog cannot be loaded, the market SHALL NOT be shown and the refusal
SHALL be presented with its cause instead.

#### Scenario: The market is reached from the overview and left again
- **WHEN** a student opens the market from the farm overview and then leaves it
- **THEN** the market is shown without any task having been selected
- **AND** the overview is shown again on leaving

#### Scenario: Items render under their declared groups, in declared order
- **WHEN** the catalog declares two groups with items in each
- **THEN** both groups are shown in the order declared, each with its own items
- **AND** no group name or item name is written into the screen

#### Scenario: The four states are distinguishable on screen
- **WHEN** the catalog holds an owned item, an affordable one, one beyond the balance and one with no price
- **THEN** each is presented as owned, as buyable, as not yet affordable, or as not for sale
- **AND** no two of those read the same

#### Scenario: Buying is reflected without leaving the market
- **WHEN** a purchase is confirmed in the market
- **THEN** the balance shown falls by the price and the item is shown as owned
- **AND** the student is still in the market

#### Scenario: A catalog that cannot be loaded has no market
- **WHEN** the catalog is missing or refused
- **THEN** the refusal is shown with the cause that was reported
- **AND** no market is shown

### Requirement: A persistent bar shows the year, the money and what the farm currently is

Every screen of an opened farm SHALL carry a bar showing the farm's declared name, the
current year, and the current balance with its declared currency label. The bar SHALL also
present a row of summary facts about the farm, each a label and its value, rendered in the
order they are supplied; WHEN no facts are supplied the bar SHALL show the name, the year
and the balance alone rather than an empty row. The bar SHALL show the current values on
whichever screen the student is on, with no navigation needed to read them. WHEN the farm
cannot be opened, no bar SHALL be shown and the refusal SHALL be presented with its cause
instead.

#### Scenario: The bar is present on every stage
- **WHEN** a student moves from the overview through configuration and a run to a report
- **THEN** the year and the balance are shown on each of those screens

#### Scenario: The bar follows the money
- **WHEN** the balance changes while a student is on a screen
- **THEN** that screen's bar shows the new balance
- **AND** the student did not have to navigate to see it

#### Scenario: Summary facts are rendered as supplied
- **WHEN** two summary facts are supplied to the bar
- **THEN** both are shown with their labels, in the order supplied
- **AND** no fact's subject is named by the bar itself

#### Scenario: A farm with nothing to summarise shows no empty row
- **WHEN** no summary facts are supplied
- **THEN** the bar shows the farm's name, the year and the balance
- **AND** no empty summary row is rendered

#### Scenario: A farm that cannot be opened has no bar
- **WHEN** the farm's declaration is missing or refused
- **THEN** the refusal is shown with the cause that was reported
- **AND** no bar, no year and no balance are shown

### Requirement: A report identifies the configuration that produced it

Every report SHALL name the configuration identifier it was produced from. WHEN knob
values change after a report is shown, that report SHALL NOT continue to be presented as
the result of the current configuration.

#### Scenario: Report names its configuration
- **WHEN** a report is shown
- **THEN** it displays the configuration identifier the run resolved to

#### Scenario: A stale report is not passed off as current
- **WHEN** a knob value is changed while a report from an earlier configuration is on screen
- **THEN** that report is either cleared or marked as belonging to the earlier configuration
- **AND** it is not presented as the result of the current knob values

### Requirement: Engine refusals are shown with the cause the engine named

WHEN the engine refuses — an unresolvable configuration, a schema version mismatch, a
malformed stored distribution, or an incomplete declaration — the shell SHALL present the
refusal together with the cause the engine reported. It SHALL NOT show a blank screen, a
partial result, or any earnings figure for a refused run.

#### Scenario: A configuration with no precomputed entry is explained
- **WHEN** a student selects a knob combination the prediction artifact has no entry for
- **THEN** the shell reports that this configuration has not been precomputed, naming the configuration identifier
- **AND** no report and no earnings figure are shown

#### Scenario: A version mismatch stops the task rather than degrading it
- **WHEN** a task's declared schema version differs from its prediction artifact's version
- **THEN** the shell reports the mismatch naming both versions
- **AND** the task cannot be run

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

### Requirement: Declared teaching copy is reachable from the screens

A task's declared task-level copy SHALL be reachable from its configuration screen, and
every rendered knob SHALL offer an affordance that shows that knob's declared help copy.
No explanatory copy about a task SHALL be written into screen code.

#### Scenario: Every knob offers its declared help
- **WHEN** the configuration screen renders a task's knobs
- **THEN** each knob offers a help affordance
- **AND** activating it shows that knob's declared help copy

### Requirement: The shell contains no task-specific code paths

No task id, category id, action id or knob id declared by a task SHALL appear in screen
code, and no screen SHALL branch on one. A task's screens SHALL be produced from its
declaration alone.

The same rule SHALL hold over what the farm declares: no farm name, no currency label and
no summary fact's label SHALL appear in screen code, and no screen SHALL branch on one.
The persistent bar SHALL be produced from the farm declaration and the facts it is
supplied, and SHALL name nothing of its own.

The same rule SHALL hold over what the catalog declares: no item id, item label, group id,
group label or shop copy SHALL appear in screen code, and no screen SHALL branch on one.
No screen SHALL name an unlock condition — which item opens which thing SHALL be read from
the catalog, never written into a screen, so that a market for an entirely different farm
renders through the same screens.

#### Scenario: An unrelated task renders without screen changes
- **WHEN** a second task declaring unrelated categories and actions is added as a declaration
- **THEN** it renders its overview entry, configuration screen and report through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: A farm declaring a different currency renders without screen changes
- **WHEN** the farm declares a different name and a different currency label
- **THEN** the bar shows both of them
- **AND** no screen code is added or changed for it

#### Scenario: An unrelated catalog renders without screen changes
- **WHEN** a catalog declaring different groups, items and prices is loaded
- **THEN** the market renders it, and locked things name the items that open them
- **AND** no screen code is added or changed for it

### Requirement: Fixture-backed data is disclosed as such

WHEN the predictions a run reads are fixture stand-ins rather than generated artifacts,
the shell SHALL say so where the results are shown, so that no student or reviewer reads
a fixture result as a real model outcome.

#### Scenario: A fixture-backed report is labelled
- **WHEN** a report is produced from fixture predictions
- **THEN** the report indicates that it was produced from fixture data

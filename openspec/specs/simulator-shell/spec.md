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

#### Scenario: Every combination is present in the report
- **WHEN** a report is shown for a task with three categories and two actions
- **THEN** all six category-and-action counts are displayed, including combinations with a count of zero
- **AND** the total earnings are displayed alongside them

#### Scenario: An over-selective configuration is diagnosable on screen
- **WHEN** a configuration rarely chooses the high-value action
- **THEN** the report distinguishes the count for the category where that action was correct from the counts where the low-value action was correct

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

#### Scenario: An unrelated task renders without screen changes
- **WHEN** a second task declaring unrelated categories and actions is added as a declaration
- **THEN** it renders its overview entry, configuration screen and report through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: A farm declaring a different currency renders without screen changes
- **WHEN** the farm declares a different name and a different currency label
- **THEN** the bar shows both of them
- **AND** no screen code is added or changed for it

### Requirement: Fixture-backed data is disclosed as such

WHEN the predictions a run reads are fixture stand-ins rather than generated artifacts,
the shell SHALL say so where the results are shown, so that no student or reviewer reads
a fixture result as a real model outcome.

#### Scenario: A fixture-backed report is labelled
- **WHEN** a report is produced from fixture predictions
- **THEN** the report indicates that it was produced from fixture data

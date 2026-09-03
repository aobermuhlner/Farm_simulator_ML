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

#### Scenario: An unrelated task renders without screen changes
- **WHEN** a second task declaring unrelated categories and actions is added as a declaration
- **THEN** it renders its overview entry, configuration screen and report through the same screens
- **AND** no screen code is added or changed for it

### Requirement: Fixture-backed data is disclosed as such

WHEN the predictions a run reads are fixture stand-ins rather than generated artifacts,
the shell SHALL say so where the results are shown, so that no student or reviewer reads
a fixture result as a real model outcome.

#### Scenario: A fixture-backed report is labelled
- **WHEN** a report is produced from fixture predictions
- **THEN** the report indicates that it was produced from fixture data

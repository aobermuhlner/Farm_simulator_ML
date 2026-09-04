## ADDED Requirements

### Requirement: The farm presents stages that belong to no task

The shell SHALL be able to present stages that belong to the farm rather than to a task run —
a stage a student enters from the overview, works through, and returns from. Such a stage
SHALL be reachable from the overview, SHALL be leavable back to it, and SHALL NOT be enterable
when the state of the farm does not offer it. Entering one SHALL NOT select a task for
configuration, run a task, or produce a report of a run.

The four task stages are unchanged by this: a farm stage sits beside them rather than inside
them, and carries the persistent bar as every other stage does.

#### Scenario: A farm stage is entered from the overview
- **WHEN** the farm offers a stage that is not a task run
- **THEN** it is reachable from the overview
- **AND** entering it neither scores a run nor shows a report

#### Scenario: Leaving returns to the overview
- **WHEN** a student leaves a farm stage
- **THEN** the overview is shown again

#### Scenario: A stage the farm does not offer is not enterable
- **WHEN** the state of the farm does not offer a stage
- **THEN** that stage cannot be entered

#### Scenario: The bar is present there too
- **WHEN** a student is on a farm stage
- **THEN** the year and the balance are shown on it

#### Scenario: The task stages are untouched
- **WHEN** a task is selected from an overview that also offers a farm stage
- **THEN** configuration, run and report proceed as they did before

## MODIFIED Requirements

### Requirement: The shell contains no task-specific code paths

No task id, category id, action id or knob id declared by a task SHALL appear in screen
code, and no screen SHALL branch on one. A task's screens SHALL be produced from its
declaration alone. This SHALL hold for every stage the shell presents, including stages that
belong to the farm rather than to a task run and that render a task's images, labels or
actions.

The same rule SHALL hold over what the farm declares: no farm name, no currency label and
no summary fact's label SHALL appear in screen code, and no screen SHALL branch on one.
The persistent bar SHALL be produced from the farm declaration and the facts it is
supplied, and SHALL name nothing of its own.

#### Scenario: An unrelated task renders without screen changes
- **WHEN** a second task declaring unrelated categories and actions is added as a declaration
- **THEN** it renders its overview entry, configuration screen and report through the same screens
- **AND** every farm stage that presents its images or actions renders them from its declaration through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: A farm declaring a different currency renders without screen changes
- **WHEN** the farm declares a different name and a different currency label
- **THEN** the bar shows both of them
- **AND** no screen code is added or changed for it

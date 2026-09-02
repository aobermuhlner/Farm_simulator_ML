## Purpose

Defines what a lesson must declare in order to be playable, so that new ML lessons are
added to the simulator as data — categories, knobs, payoffs, teaching copy — rather than
as new screens and new scoring code.

## ADDED Requirements

### Requirement: Task declaration completeness

A task SHALL declare all of: a stable id, a display title, its ground-truth categories,
the actions available to the automated system, a reference to its image pool, the
hyperparameter knobs exposed to the student, a reference to its precomputed prediction
artifact, a payoff table, and its teaching copy. The system SHALL refuse to present a
task whose declaration is missing any of these.

#### Scenario: Complete declaration is playable
- **WHEN** a task declaration provides every required field
- **THEN** the task appears as selectable and can be configured and run

#### Scenario: Incomplete declaration is rejected
- **WHEN** a task declaration omits a required field
- **THEN** the task is not offered to the student
- **AND** the omission is reported as a configuration error naming the missing field

### Requirement: Categories and actions are task-declared

Ground-truth categories and available actions SHALL be declared per task, with at least
two of each. No part of the system outside a task's own declaration and teaching copy
SHALL assume apple-specific category or action names.

#### Scenario: A task with unrelated categories runs on the same engine
- **WHEN** a task declares categories `healthy` and `diseased` and actions `flag` and `pass`
- **THEN** it configures, runs, and scores through the same flow as the apple task
- **AND** no apple-specific vocabulary appears in its screens

### Requirement: Knob declarations drive the configuration screen

Each exposed knob SHALL declare an id, a student-facing label, a kind of either
enumerated choice or continuous slider, its allowed values (a value list for an
enumerated choice, or minimum, maximum and step for a slider), a default value, and
help copy. The configuration screen SHALL be rendered from these declarations alone.

#### Scenario: Adding a knob requires no screen changes
- **WHEN** a knob is added to a task declaration
- **THEN** the configuration screen offers that knob with its declared label, control kind and default
- **AND** no task-specific screen code is required for it to appear

#### Scenario: Out-of-range knob value is rejected
- **WHEN** a configuration requests a knob value outside the knob's declared allowed values
- **THEN** the configuration is rejected as invalid
- **AND** no run is scored from it

### Requirement: Deterministic configuration identity

An ordered set of knob values SHALL map to a deterministic configuration identifier.
The same knob values SHALL always produce the same identifier, independent of the order
in which the student set them, the session, or the machine.

#### Scenario: Same selection yields the same identifier
- **WHEN** two students independently select identical knob values for the same task
- **THEN** both configurations resolve to the same configuration identifier

#### Scenario: Identifier keys the precomputed lookups
- **WHEN** a configuration identifier is resolved
- **THEN** it selects that configuration's prediction entries and its training history
- **AND** both lookups refer to the same configuration

### Requirement: Artifact schema versioning

A task SHALL declare the schema version its precomputed artifacts were generated
against, and each artifact SHALL carry the version it was generated with. A mismatch
SHALL fail visibly and SHALL NOT be silently tolerated or worked around with partial
data.

#### Scenario: Mismatched artifact version is surfaced
- **WHEN** a task's declared schema version differs from its prediction artifact's version
- **THEN** the task reports a version mismatch identifying both versions
- **AND** the task does not run

#### Scenario: Matching version loads normally
- **WHEN** the declared and artifact schema versions are equal
- **THEN** the task loads and runs without warning

### Requirement: Predictions are probability distributions, not decisions

A task's prediction artifact SHALL provide, for each image and each configuration
identifier, a probability distribution over that task's declared categories. It SHALL
NOT store a chosen action or a final label, so that the decision rule remains
changeable without regenerating predictions.

#### Scenario: Decision rule changes without regenerating artifacts
- **WHEN** a task's decision policy is changed
- **THEN** existing prediction artifacts remain valid and are reused unchanged

#### Scenario: Distribution covers every declared category
- **WHEN** a prediction entry is read for an image and configuration
- **THEN** it provides one probability per declared category of that task

### Requirement: Predictions cover both the training split and the evaluation pool

A task's prediction artifact SHALL contain entries for both the browsable training split
and the larger evaluation pool, so that performance on data the model learned from can
be shown alongside performance on unseen data.

#### Scenario: Training and harvest performance shown together
- **WHEN** a student views results for one configuration
- **THEN** performance on the training split and on the evaluated harvest are both available for that same configuration

### Requirement: Teaching copy is declared alongside the task

Explanatory copy SHALL be declared as task data at both the task level and the
individual knob level, so that theory is available in context without being hard-coded
into screens.

#### Scenario: Knob help is available in context
- **WHEN** a student requests help on a specific knob
- **THEN** that knob's declared help copy is shown

### Requirement: Task discovery from declarations

The farm overview SHALL list tasks from their declarations, and SHALL distinguish tasks
that are available to play from tasks that are announced but not yet playable.

#### Scenario: Only available tasks are selectable
- **WHEN** the farm overview is shown while only the apple harvest task is available
- **THEN** the apple harvest task is selectable
- **AND** any announced but unavailable task is visibly not selectable

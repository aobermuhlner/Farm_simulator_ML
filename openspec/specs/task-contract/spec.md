## Purpose

Defines what a lesson must declare in order to be playable, so that new ML lessons are
added to the simulator as data — categories, knobs, payoffs, teaching copy — rather than
as new screens and new scoring code.

## Requirements

### Requirement: Task declaration completeness

A task SHALL declare all of: a stable id, a display title, its ground-truth categories,
the actions available to the automated system, a mapping from each declared category to
the action that category calls for, its decision policy, a reference to its image pool,
the hyperparameter knobs exposed to the student, a reference to its precomputed
prediction artifact, a payoff table, its teaching copy, and whether it is available to
play. The system SHALL refuse to present a task whose declaration is missing any of
these.

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
help copy. The configuration screen SHALL be rendered from these declarations together
with which of their values are currently available, and from nothing else.

A knob declaration SHALL NOT state its own availability. What is available is decided
outside the task's declaration, so that a declaration reads the same whatever a student
owns, and so that opening a value never edits the file that defines it. A value that is
not available SHALL be shown and SHALL NOT be offered for selection; a knob with no
available value beyond its default SHALL be shown at that default. A knob's declared
default SHALL always be available. The screen SHALL name no unlock condition of its own.

#### Scenario: Adding a knob requires no screen changes
- **WHEN** a knob is added to a task declaration
- **THEN** the configuration screen offers that knob with its declared label, control kind and default
- **AND** no task-specific screen code is required for it to appear

#### Scenario: Out-of-range knob value is rejected
- **WHEN** a configuration requests a knob value outside the knob's declared allowed values
- **THEN** the configuration is rejected as invalid
- **AND** no run is scored from it

#### Scenario: An unavailable value is shown but not offered
- **WHEN** a knob declares a value that is not currently available
- **THEN** the configuration screen shows that value
- **AND** it cannot be selected

#### Scenario: A declaration does not change when a value is opened
- **WHEN** a value that was unavailable becomes available
- **THEN** the task declaration is the same file it was
- **AND** the knob's declared values, default and help copy are unchanged

### Requirement: Deterministic configuration identity

An ordered set of knob values SHALL map to a deterministic configuration identifier.
The same knob values SHALL always produce the same identifier, independent of the order
in which the student set them, the session, or the machine.

#### Scenario: Same selection yields the same identifier
- **WHEN** two students independently select identical knob values for the same task
- **THEN** both configurations resolve to the same configuration identifier

A configuration identifier the prediction artifact has no entry for, and an artifact
declaring a different task than the one being resolved, SHALL be refused rather than
resolved.

#### Scenario: Identifier keys the precomputed lookups
- **WHEN** a configuration identifier is resolved
- **THEN** it selects that configuration's prediction entries and its training history
- **AND** both lookups refer to the same configuration

#### Scenario: Unknown configuration is refused
- **WHEN** a configuration identifier has no entry in the task's prediction artifact
- **THEN** the lookup is refused naming that identifier
- **AND** no run is scored from it

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
changeable without regenerating predictions. The artifact SHALL declare the category
order its probability vectors are indexed by, and an order that disagrees with the
task's declared categories SHALL be refused. A stored entry that is not a probability
distribution over those categories SHALL be refused rather than scored.

#### Scenario: Decision rule changes without regenerating artifacts
- **WHEN** a task's decision policy is changed
- **THEN** existing prediction artifacts remain valid and are reused unchanged

#### Scenario: Distribution covers every declared category
- **WHEN** a prediction entry is read for an image and configuration
- **THEN** it provides one probability per declared category of that task
- **AND** the probabilities are indexed by the task's declared category order

#### Scenario: Malformed distribution is refused rather than scored
- **WHEN** a stored entry carries the wrong number of probabilities, a value outside zero to one, or values that do not sum to one
- **THEN** reading it is refused naming the defect
- **AND** no action is chosen and no earnings are computed from it

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

### Requirement: A task may declare how its architecture is drawn

A task MAY declare how the architecture its knobs describe should be drawn. WHEN it does,
the declaration SHALL name the kind of architecture, and SHALL carry the fields that kind
requires. The declaration SHALL NOT name the output units, which are the task's declared
categories, for any kind.

For the fully-connected kind, the declaration SHALL name the knob whose value sets the
number of hidden layers, the knob whose value sets the units per layer, the count to draw
for each value that width knob permits, and the number of input units to draw.

For the convolutional kind, the declaration SHALL name the knob whose value sets the
number of convolutional blocks, the knob whose value sets the base channel count, the
spatial resolution of the task's input, and the drawn depth to use for each value that
channel knob permits. It SHALL NOT name a per-block spatial size, which is derived from
the input resolution and the block's position.

A field one kind requires SHALL NOT be required of another kind, and a field belonging to
a kind other than the one declared SHALL NOT be honoured.

The block is optional: a declaration without one remains complete and playable, and its
task is simply drawn no architecture.

#### Scenario: A complete diagram declaration is honoured
- **WHEN** a task declares a fully-connected diagram naming knobs it declares, a drawn count for every value of its width knob, and a number of input units
- **THEN** the declaration is accepted
- **AND** the task's architecture is drawn from it

#### Scenario: A complete convolutional diagram declaration is honoured
- **WHEN** a task declares a convolutional diagram naming knobs it declares, an input resolution, and a drawn depth for every value of its channel knob
- **THEN** the declaration is accepted
- **AND** the task's architecture is drawn from it

#### Scenario: A kind's fields are required only of that kind
- **WHEN** a convolutional diagram omits a field only the fully-connected kind requires
- **THEN** the declaration is accepted

#### Scenario: A task without one stays playable
- **WHEN** a task declaration omits the diagram block
- **THEN** the declaration is still complete
- **AND** the task appears as selectable and can be configured and run

### Requirement: A declared diagram is validated with its cause named

WHEN a task declares a diagram, the system SHALL refuse a declaration whose diagram block
declares an unknown kind, omits a field the declared kind requires, names a knob the task
does not declare, names a depth knob whose permitted values are not all whole numbers,
leaves any permitted value of its width or channel knob without a drawn count, or maps a
value to a drawn count that is not a positive whole number. For the convolutional kind it
SHALL additionally refuse a declaration whose input resolution is not a positive whole
number, or whose depth knob permits a block count the declared input resolution cannot
support. Each refusal SHALL name the field or value at fault. A declared diagram SHALL NOT
be partially honoured, ignored, or repaired by substituting a value the task did not
declare.

#### Scenario: A diagram naming an undeclared knob is rejected
- **WHEN** a diagram names a knob the task does not declare
- **THEN** the declaration is rejected
- **AND** the refusal names that knob

#### Scenario: An unmapped width value is rejected
- **WHEN** a diagram omits a drawn count for one of the values its width or channel knob permits
- **THEN** the declaration is rejected
- **AND** the refusal names the unmapped value

#### Scenario: A depth knob that cannot yield whole layers is rejected
- **WHEN** a diagram names as its depth knob a knob permitting a value that is not a whole number
- **THEN** the declaration is rejected
- **AND** the refusal names that knob and that value

#### Scenario: An undrawable count is rejected
- **WHEN** a diagram maps a width or channel value to a drawn count that is zero, negative or not a whole number
- **THEN** the declaration is rejected
- **AND** the refusal names that count

#### Scenario: An unknown kind is rejected
- **WHEN** a diagram declares a kind the system does not support
- **THEN** the declaration is rejected
- **AND** the refusal names that kind and the kinds it supports

#### Scenario: A block count the input resolution cannot support is rejected
- **WHEN** a convolutional diagram's depth knob permits a block count that would pool the declared input resolution below one spatial position
- **THEN** the declaration is rejected
- **AND** the refusal names the input resolution, that block count and that knob

#### Scenario: A malformed input resolution is rejected
- **WHEN** a convolutional diagram declares an input resolution that is zero, negative or not a whole number
- **THEN** the declaration is rejected
- **AND** the refusal names that value

#### Scenario: An incomplete diagram block is rejected rather than half-used
- **WHEN** a diagram block is present but omits a field its declared kind requires
- **THEN** the declaration is rejected naming the missing field
- **AND** no architecture is drawn from the partial block

### Requirement: A declared input resolution must match the task's pool

WHEN a task declares a convolutional diagram, the input resolution it declares SHALL match
the image size the task's pool manifest provides. A mismatch SHALL be refused, naming both
the declared resolution and the pool's, because the two disagreeing means either the
drawing states spatial sizes the model does not have or the model is built for images the
pool does not contain.

#### Scenario: A matching resolution is accepted
- **WHEN** a convolutional task declares the input resolution its pool manifest provides
- **THEN** the declaration is accepted

#### Scenario: A mismatched resolution stops the task
- **WHEN** a convolutional task declares an input resolution differing from its pool manifest's image size
- **THEN** the mismatch is reported naming both resolutions
- **AND** the task does not run

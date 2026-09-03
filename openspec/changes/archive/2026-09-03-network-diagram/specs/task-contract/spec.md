## ADDED Requirements

### Requirement: A task may declare how its architecture is drawn

A task MAY declare how the architecture its knobs describe should be drawn. WHEN it does,
the declaration SHALL name the kind of architecture, the knob whose value sets the number
of hidden layers, the knob whose value sets the units per layer, the count to draw for
each value that width knob permits, and the number of input units to draw. The declaration
SHALL NOT name the output units, which are the task's declared categories.

The block is optional: a declaration without one remains complete and playable, and its
task is simply drawn no architecture.

#### Scenario: A complete diagram declaration is honoured
- **WHEN** a task declares a diagram naming knobs it declares, a drawn count for every value of its width knob, and a number of input units
- **THEN** the declaration is accepted
- **AND** the task's architecture is drawn from it

#### Scenario: A task without one stays playable
- **WHEN** a task declaration omits the diagram block
- **THEN** the declaration is still complete
- **AND** the task appears as selectable and can be configured and run

### Requirement: A declared diagram is validated with its cause named

WHEN a task declares a diagram, the system SHALL refuse a declaration whose diagram block
is incomplete, names a knob the task does not declare, names a depth knob whose permitted
values are not all whole numbers, leaves any permitted value of its width knob without a
drawn count, or maps a value to a drawn count that is not a positive whole number. Each
refusal SHALL name the field or value at fault. A declared diagram SHALL NOT be partially
honoured, ignored, or repaired by substituting a value the task did not declare.

#### Scenario: A diagram naming an undeclared knob is rejected
- **WHEN** a diagram names a knob the task does not declare
- **THEN** the declaration is rejected
- **AND** the refusal names that knob

#### Scenario: An unmapped width value is rejected
- **WHEN** a diagram omits a drawn count for one of the values its width knob permits
- **THEN** the declaration is rejected
- **AND** the refusal names the unmapped value

#### Scenario: A depth knob that cannot yield whole layers is rejected
- **WHEN** a diagram names as its depth knob a knob permitting a value that is not a whole number
- **THEN** the declaration is rejected
- **AND** the refusal names that knob and that value

#### Scenario: An undrawable count is rejected
- **WHEN** a diagram maps a width value to a drawn count that is zero, negative or not a whole number
- **THEN** the declaration is rejected
- **AND** the refusal names that count

#### Scenario: An incomplete diagram block is rejected rather than half-used
- **WHEN** a diagram block is present but omits a required field
- **THEN** the declaration is rejected naming the missing field
- **AND** no architecture is drawn from the partial block

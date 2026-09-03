## MODIFIED Requirements

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

## ADDED Requirements

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

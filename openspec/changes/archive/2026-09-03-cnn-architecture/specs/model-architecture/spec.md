## Purpose

Defines which architecture families a task can declare, what a task's capacity knobs mean
inside the family it chose, and the constraints that make a declared architecture
expressible at that task's input resolution — so that the model a student tunes is one
that could actually learn the task, and so that each family stays usable by a page other
than the one that introduced it.

## ADDED Requirements

### Requirement: A task declares an architecture family

A task SHALL declare which architecture family its knobs describe. The system SHALL
support a fully-connected family and a convolutional family, and SHALL determine a task's
family from that task's own declaration rather than from the kind of data it uses or from
any default. A task's capacity knobs SHALL be interpreted according to its declared
family, and a knob SHALL NOT carry a meaning the declared family does not give it.

#### Scenario: A task declaring the convolutional family is read as convolutional
- **WHEN** a task declares the convolutional family
- **THEN** its capacity knobs are interpreted as convolutional capacity
- **AND** nothing interprets them as fully-connected layers and units

#### Scenario: A task declaring the fully-connected family is read as fully-connected
- **WHEN** a task declares the fully-connected family
- **THEN** its capacity knobs are interpreted as hidden layers and units per layer

#### Scenario: No family is assumed
- **WHEN** a task declares no architecture
- **THEN** no family is substituted for it
- **AND** the task remains complete, configurable and runnable

### Requirement: The apple harvest task uses a convolutional architecture

The apple harvest task SHALL declare a convolutional architecture over its image input.
The architecture SHALL be a sequence of convolutional blocks, each applying two 3x3
convolutions with a rectified activation after each and then 2x2 max pooling; the channel
count SHALL double from one block to the next; and the stack SHALL be followed by global
average pooling and a dense classifier producing one output per declared category as a
probability distribution.

The task SHALL NOT declare a fully-connected network over raw pixels. At this task's input
resolution such a network gives every unit of the first hidden layer tens of thousands of
inputs and no notion of locality, which is a different failure from the one the task's
regularization knobs exist to teach.

#### Scenario: The declared architecture is convolutional
- **WHEN** the apple harvest task's architecture is read
- **THEN** it is a convolutional stack of the declared block form
- **AND** its classifier produces one output per declared category

#### Scenario: Channels double per block
- **WHEN** the block channel counts are read for any permitted base channel count
- **THEN** each block after the first has twice the channels of the block before it

#### Scenario: The outputs stay tied to the categories
- **WHEN** the task's declared categories change in number
- **THEN** the number of classifier outputs changes to match
- **AND** no separately declared output count can disagree with the categories

### Requirement: Capacity knobs name blocks and channels in the convolutional family

For a task in the convolutional family, the knob the task names as setting depth SHALL
select the number of convolutional blocks, and the knob it names as setting width SHALL
select the base channel count of the first block. Each knob's permitted values SHALL be
values the declared architecture can actually be built at.

#### Scenario: Depth selects blocks
- **WHEN** the depth knob of a convolutional task is set to one of its permitted values
- **THEN** the architecture has exactly that many convolutional blocks

#### Scenario: Width selects base channels
- **WHEN** the width knob of a convolutional task is set to one of its permitted values
- **THEN** the first block has that many channels
- **AND** each later block doubles it

#### Scenario: Capacity increases with each step of either knob
- **WHEN** either capacity knob is moved from a permitted value to a larger one with the other held fixed
- **THEN** the resulting architecture has strictly more capacity than before

### Requirement: A declared architecture must be expressible at the task's input resolution

The number of convolutional blocks SHALL be bounded by the input resolution the task's
pool provides: each block halves the spatial size, so a block count that would reduce the
feature map below a single spatial position SHALL be refused when the declaration is
loaded. The refusal SHALL name the input resolution, the offending block count, and the
knob permitting it. The system SHALL NOT clamp the block count, drop trailing blocks, or
draw an architecture it has refused to build.

#### Scenario: An unbuildable block count is refused at load
- **WHEN** a convolutional task's depth knob permits a block count that would pool the feature map below one spatial position at the task's input resolution
- **THEN** the declaration is rejected
- **AND** the refusal names the input resolution, that block count and that knob

#### Scenario: A buildable block count is accepted
- **WHEN** every block count the depth knob permits leaves at least one spatial position at the task's input resolution
- **THEN** the declaration is accepted

#### Scenario: An unbuildable depth is not quietly repaired
- **WHEN** a declaration is refused for an unbuildable block count
- **THEN** no architecture with a reduced block count is substituted
- **AND** the task does not run

### Requirement: The regularization knobs act somewhere the architecture provides

A task's declared architecture SHALL provide a place for each regularization knob the task
declares to act. A task SHALL NOT declare a dropout knob whose declared architecture has
nowhere to apply dropout, because a knob a student turns to no effect teaches that the
concept does not matter.

#### Scenario: A declared dropout knob has a place in the architecture
- **WHEN** a task declares a dropout knob
- **THEN** its declared architecture includes a stage where that dropout applies

#### Scenario: The apple task's dropout acts on its classifier head
- **WHEN** the apple harvest task's architecture is read
- **THEN** its classifier head includes a dropout stage driven by the declared dropout knob

### Requirement: Each architecture family is usable independently of any one screen

Support for an architecture family — its declaration, the resolution of a configuration
into a concrete architecture, and its drawing — SHALL be usable by any page, not only by
the configuration screen that first needed it. Resolving a declared architecture SHALL NOT
require a task to be running, a run to have been scored, or the configuration screen to be
mounted. A second page SHALL be able to present a declared architecture by supplying a
declaration and a set of knob values and nothing else.

This applies to the fully-connected family as much as the convolutional one. The apple
task moving to a convolutional architecture SHALL NOT remove, weaken or leave unspecified
support for the fully-connected family, which remains available for a later task or page
to declare and to draw.

#### Scenario: An architecture resolves outside the configuration screen
- **WHEN** a declaration and a set of knob values are supplied from a page other than the configuration screen
- **THEN** the architecture resolves and can be drawn there
- **AND** no run, score or configuration-screen state is required

#### Scenario: The fully-connected family survives the apple task's move
- **WHEN** the apple harvest task is declared convolutional
- **THEN** a task declaring the fully-connected family is still accepted and still drawn
- **AND** the fully-connected drawing remains available to be mounted on its own

#### Scenario: A family is added without touching the pages that draw it
- **WHEN** a task declaring a family the system supports is added as a declaration
- **THEN** its architecture is resolved and drawn from its own declaration
- **AND** no page names that task, its knobs or its family

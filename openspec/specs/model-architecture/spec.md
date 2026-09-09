## Purpose

Defines which architecture kinds a model family can declare, what a family's capacity
knobs mean inside the kind it chose, and the constraints that make a declared architecture
expressible at its task's input resolution — so that the model a student tunes is one that
could actually learn the task, and so that each kind stays usable by a page other than the
one that introduced it.

An architecture *kind* — fully-connected or convolutional — is a choice of how knobs are
interpreted and drawn. It is not a *model family*, which is a rung of the ladder a student
buys; `model-families` defines those. The two were one word until they could no longer be,
and nothing here should be read as being about the other.

## Requirements

### Requirement: The apple harvest task uses a convolutional architecture

The apple harvest task SHALL declare a family whose architecture is convolutional over its
image input. That architecture SHALL be a sequence of convolutional blocks, each applying
two 3x3 convolutions with a rectified activation after each and then 2x2 max pooling; the
channel count SHALL double from one block to the next; and the stack SHALL be followed by
global average pooling and a dense classifier producing one output per declared category as
a probability distribution.

No family of this task SHALL declare a fully-connected network over raw pixels. At this
task's input resolution such a network gives every unit of the first hidden layer tens of
thousands of inputs and no notion of locality, which is a different failure from the one
that family's regularization knobs exist to teach.

The task's other families are not required to declare an architecture at all, and this
requirement SHALL NOT be read as obliging them to. It fixes what the convolutional family
is, not how many families the task has.

#### Scenario: The declared architecture is convolutional
- **WHEN** the apple harvest task's convolutional family is read
- **THEN** its architecture is a convolutional stack of the declared block form
- **AND** its classifier produces one output per declared category

#### Scenario: Channels double per block
- **WHEN** the block channel counts are read for any permitted base channel count
- **THEN** each block after the first has twice the channels of the block before it

#### Scenario: The outputs stay tied to the categories
- **WHEN** the task's declared categories change in number
- **THEN** the number of classifier outputs changes to match
- **AND** no separately declared output count can disagree with the categories

#### Scenario: A family declaring no architecture is not refused for it
- **WHEN** the apple harvest task declares a family whose model is not a network
- **THEN** that family is accepted without an architecture
- **AND** nothing requires it to be convolutional
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

A family's declared architecture SHALL provide a place for each regularization knob that
family declares to act. A family SHALL NOT declare a dropout knob whose declared
architecture has nowhere to apply dropout, because a knob a student turns to no effect
teaches that the concept does not matter.

A family declaring no architecture SHALL NOT declare a regularization knob that names a
stage of one, for the same reason.

#### Scenario: A declared dropout knob has a place in the architecture
- **WHEN** a family declares a dropout knob
- **THEN** its declared architecture includes a stage where that dropout applies

#### Scenario: The apple task's dropout acts on its classifier head
- **WHEN** the apple harvest task's convolutional family is read
- **THEN** its classifier head includes a dropout stage driven by that family's declared dropout knob

#### Scenario: A knob with nowhere to act is refused
- **WHEN** a family declaring no architecture declares a knob naming a stage of one
- **THEN** the declaration is refused naming that knob

### Requirement: A model family declares an architecture kind

Each model family SHALL declare which architecture kind its knobs describe. The system
SHALL support a fully-connected kind and a convolutional kind, and SHALL determine a
family's kind from that family's own declaration rather than from the task it belongs to,
from the kind of data the task uses, or from any default. A family's capacity knobs SHALL
be interpreted according to its declared kind, and a knob SHALL NOT carry a meaning the
declared kind does not give it.

Two families of one task MAY declare different kinds, and a family MAY declare no kind at
all — a family whose model is not a network has no architecture to interpret knobs against,
and SHALL NOT have one substituted for it.

#### Scenario: A family declaring the convolutional kind is read as convolutional
- **WHEN** a family declares the convolutional kind
- **THEN** its capacity knobs are interpreted as convolutional capacity
- **AND** nothing interprets them as fully-connected layers and units

#### Scenario: A family declaring the fully-connected kind is read as fully-connected
- **WHEN** a family declares the fully-connected kind
- **THEN** its capacity knobs are interpreted as hidden layers and units per layer

#### Scenario: No kind is assumed
- **WHEN** a family declares no architecture kind
- **THEN** no kind is substituted for it
- **AND** the family remains complete, configurable and able to bring a crop in

#### Scenario: One task's families may differ in kind
- **WHEN** a task declares one family of the convolutional kind and one declaring no kind
- **THEN** each family's knobs are interpreted according to its own declaration
- **AND** neither family's kind is applied to the other

### Requirement: Capacity knobs name blocks and channels in the convolutional kind

For a family of the convolutional kind, the knob the family names as setting depth SHALL
select the number of convolutional blocks, and the knob it names as setting width SHALL
select the base channel count of the first block. Each knob's permitted values SHALL be
values the declared architecture can actually be built at.

#### Scenario: Depth selects blocks
- **WHEN** the depth knob of a convolutional family is set to one of its permitted values
- **THEN** the architecture has exactly that many convolutional blocks

#### Scenario: Width selects base channels
- **WHEN** the width knob of a convolutional family is set to one of its permitted values
- **THEN** the first block has that many channels
- **AND** each later block doubles it

#### Scenario: Capacity increases with each step of either knob
- **WHEN** either capacity knob is moved from a permitted value to a larger one with the other held fixed
- **THEN** the resulting architecture has strictly more capacity than before

### Requirement: Each architecture kind is usable independently of any one screen

Support for an architecture kind — its declaration, the resolution of a configuration into
a concrete architecture, and its drawing — SHALL be usable by any page, not only by the
screen that first needed it. Resolving a declared architecture SHALL NOT require a task to
be running, a crop to have been brought in, a family to be selected, or the workshop to be
mounted. A second page SHALL be able to present a declared architecture by supplying a
family declaration and a set of knob values and nothing else.

This applies to the fully-connected kind as much as the convolutional one. The apple task's
families being convolutional SHALL NOT remove, weaken or leave unspecified support for the
fully-connected kind, which remains available for a later task or family to declare and to
draw.

#### Scenario: An architecture resolves outside the workshop
- **WHEN** a family declaration and a set of knob values are supplied from a page other than the workshop
- **THEN** the architecture resolves and can be drawn there
- **AND** no crop, score, selected family or workshop state is required

#### Scenario: The fully-connected kind survives the apple task's families
- **WHEN** the apple harvest task's families are declared convolutional
- **THEN** a family declaring the fully-connected kind is still accepted and still drawn
- **AND** the fully-connected drawing remains available to be mounted on its own

#### Scenario: A kind is added without touching the pages that draw it
- **WHEN** a family declaring a kind the system supports is added as a declaration
- **THEN** its architecture is resolved and drawn from its own declaration
- **AND** no page names that task, its knobs, its family or its kind

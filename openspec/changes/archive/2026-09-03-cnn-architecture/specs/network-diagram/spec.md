## MODIFIED Requirements

### Requirement: The drawing follows the current knob values

The diagram SHALL depict the configuration currently selected. WHEN a knob the diagram
depends on changes, the diagram SHALL be redrawn from the new value. It SHALL NOT depict a
configuration the student has moved away from, and SHALL NOT wait for a run to catch up.

#### Scenario: Changing the depth redraws the layers
- **WHEN** the student changes the knob the task names as setting its depth
- **THEN** the number of hidden layers drawn changes to match, for a fully-connected task
- **AND** the number of convolutional blocks drawn changes to match, for a convolutional task

#### Scenario: Changing the width redraws the units
- **WHEN** the student changes the knob the task names as setting its width
- **THEN** the number of units drawn in each hidden layer changes to match, for a fully-connected task
- **AND** the drawn channel depth of each block changes to match, for a convolutional task

#### Scenario: No run is required to update it
- **WHEN** a knob is changed and no run is scored
- **THEN** the diagram already depicts the new configuration

### Requirement: The hidden-layer count is drawn faithfully

For a task in the fully-connected family, the number of hidden layers drawn SHALL equal
the value of the knob the task names as setting the depth, for every value that knob
permits. This part of the drawing is exact.

#### Scenario: Every permitted depth draws that many hidden layers
- **WHEN** the depth knob of a fully-connected task is set to any of its declared values
- **THEN** exactly that many hidden layers are drawn

### Requirement: Unit counts are drawn as declared, not literally

For a task in the fully-connected family, the number of units drawn in each hidden layer
SHALL be the count the task's diagram declaration maps the current width value to, not the
width value itself. A width no diagram can usefully draw is the reason the mapping exists.

#### Scenario: A declared width draws its declared stand-in count
- **WHEN** the width knob of a fully-connected task is set to a value the task maps to a drawn count
- **THEN** each hidden layer is drawn with that many units

#### Scenario: Wider settings draw wider layers
- **WHEN** the width knob of a fully-connected task is moved from a smaller declared value to a larger one
- **THEN** each hidden layer is drawn with at least as many units as before
- **AND** the drawn count is greater wherever the task maps the two values differently

### Requirement: The abstraction is disclosed and the true value is stated

WHEN any part of the drawing is a stand-in rather than a count of what the configuration
has, the screen SHALL say so, and SHALL state the value the configuration actually
specifies. A student SHALL NOT be able to read an abstracted quantity as the real one.
Each architecture family SHALL disclose its own abstraction: the fully-connected drawing
abstracts the units per layer, and the convolutional drawing abstracts the channel depth.

#### Scenario: A student is told the widths are stand-ins
- **WHEN** a diagram is drawn containing an abstracted quantity
- **THEN** the screen states that that quantity is an abstraction rather than a count

#### Scenario: The real width is on screen
- **WHEN** the width knob is set to any of its declared values
- **THEN** that value is shown as the quantity the configuration specifies

#### Scenario: The exact part is not disclaimed
- **WHEN** the diagram is shown
- **THEN** nothing on screen suggests a faithfully drawn quantity is an approximation

### Requirement: The input and output layers are shown

The diagram SHALL draw the task's input and the classifier output either side of the
architecture's body. The output SHALL contain exactly one unit per category the task
declares. For a task in the fully-connected family, the input SHALL contain the number of
units the task's diagram declaration names, as a stand-in for the image input. For a task
in the convolutional family, the input SHALL be drawn as the image volume the task's pool
provides rather than as a number of units.

#### Scenario: One output unit per declared category
- **WHEN** a diagram is drawn for a task declaring three categories
- **THEN** the output is drawn with three units

#### Scenario: A task with different categories gets a different output layer
- **WHEN** a diagram is drawn for a task declaring two categories
- **THEN** the output is drawn with two units

#### Scenario: A convolutional input is drawn as a volume
- **WHEN** a diagram is drawn for a convolutional task
- **THEN** the input is drawn as an image volume rather than as a column of units

### Requirement: Adjacent layers are drawn fully connected

For a task in the fully-connected family, every unit of each layer SHALL be drawn
connected to every unit of the next layer, in the conventional feed-forward portrayal. No
connection SHALL be drawn between layers that are not adjacent, and none between units of
the same layer.

This portrayal SHALL NOT be applied to a convolutional task's blocks, where it would
misstate the architecture.

#### Scenario: Each pair of adjacent layers is fully connected
- **WHEN** a fully-connected diagram is drawn
- **THEN** the number of connections between each adjacent pair of layers equals the product of their unit counts

#### Scenario: Nothing skips a layer
- **WHEN** a fully-connected diagram is drawn
- **THEN** no connection joins two units in the same layer or in layers that are not adjacent

### Requirement: The diagram is not an unlabelled graphic

The diagram SHALL carry a text alternative that names the architecture it depicts, so that
a student who cannot see it is told what the drawing says. For a fully-connected task the
alternative SHALL name the number of hidden layers and the declared units per layer. For a
convolutional task it SHALL name the number of blocks, the channel count of each block and
the spatial size the stack reduces the input to.

#### Scenario: The drawing has an accessible description
- **WHEN** the diagram is drawn
- **THEN** it exposes a text alternative naming the architecture's depth and width as the task's family defines them

#### Scenario: The description follows the knobs
- **WHEN** a knob the diagram depends on changes
- **THEN** the text alternative names the new configuration

## ADDED Requirements

### Requirement: A convolutional architecture is drawn as feature-map volumes

For a task in the convolutional family, the diagram SHALL portray the architecture as a
sequence of feature-map volumes, one per convolutional block, in order from the input.
Each volume SHALL be drawn narrower than the one before it and deeper than the one before
it, so that the trade the stack makes — spatial resolution for channel depth — is visible
in the drawing rather than only in the text.

#### Scenario: One volume per block
- **WHEN** a convolutional diagram is drawn at any permitted depth
- **THEN** exactly that many feature-map volumes are drawn after the input

#### Scenario: The volumes shrink and deepen along the stack
- **WHEN** a convolutional diagram is drawn with two or more blocks
- **THEN** each volume is drawn spatially smaller than the volume before it
- **AND** each volume is drawn deeper than the volume before it

### Requirement: Convolution is not drawn as full connectivity

The convolutional drawing SHALL NOT draw every position of one volume connected to every
position of the next. Where it depicts the relationship between adjacent volumes at all,
it SHALL depict it as a local region of one volume producing a position in the next, which
is what a convolution does. Weight sharing and locality are the architecture's reason for
existing on image data, so a drawing that contradicts them misteaches the lesson the task
was rebuilt to deliver.

#### Scenario: No full connectivity between blocks
- **WHEN** a convolutional diagram is drawn
- **THEN** no set of connections between two volumes equals the product of their positions

#### Scenario: Locality is what is depicted
- **WHEN** the relationship between two adjacent volumes is depicted
- **THEN** it is depicted as a local region of the earlier volume producing a position in the later one

### Requirement: The spatial sizes of a convolutional stack are drawn faithfully

For a task in the convolutional family, the spatial size stated for each block SHALL be
the size that block's feature map actually has at the current configuration, derived from
the task's input resolution and the number of blocks before it. These sizes are small
enough to state exactly, so they SHALL NOT be abstracted or rounded. Only the channel
depth is a stand-in.

#### Scenario: Each block states its true spatial size
- **WHEN** a convolutional diagram is drawn at any permitted depth
- **THEN** the spatial size stated for each block is the size derived from the input resolution and that block's position

#### Scenario: Adding a block halves the stated size
- **WHEN** the depth knob is increased by one block
- **THEN** the size stated for the newly added block is half the size stated for the block before it

#### Scenario: The spatial sizes are not disclaimed as approximations
- **WHEN** a convolutional diagram is drawn
- **THEN** nothing on screen suggests the stated spatial sizes are stand-ins

### Requirement: The classifier head is shown as part of the architecture

The convolutional drawing SHALL show what happens between the last feature-map volume and
the outputs: the global pooling that discards spatial position, and the dense classifier
that follows it. A drawing that jumps from the last volume to the outputs hides the stage
where the dropout knob acts.

#### Scenario: Pooling and the classifier are both shown
- **WHEN** a convolutional diagram is drawn
- **THEN** the global pooling stage and the dense classifier stage are both shown between the last volume and the outputs

#### Scenario: The head follows the categories
- **WHEN** the task's declared category count changes
- **THEN** the classifier's drawn output count changes to match

### Requirement: Each family's drawing is separately mountable

The drawing for each supported architecture family SHALL be usable on its own, given a
resolved architecture of that family and nothing else. Selecting which family's drawing to
use SHALL be separable from the drawings themselves, so that a page wanting only one
family can present it without pulling in the other, and adding a family later does not
require changing an existing family's drawing.

#### Scenario: A family's drawing is used directly
- **WHEN** a resolved architecture of one family is supplied to that family's drawing
- **THEN** the architecture is drawn
- **AND** no task declaration, screen state or other family's drawing is required

#### Scenario: The fully-connected drawing is available to another page
- **WHEN** a page other than the configuration screen presents a fully-connected architecture
- **THEN** it draws it through the same drawing the configuration screen uses
- **AND** no drawing code is duplicated for it

#### Scenario: Adding a family leaves existing drawings untouched
- **WHEN** support for a further architecture family is added
- **THEN** the existing families' drawings are unchanged

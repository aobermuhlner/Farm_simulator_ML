## Purpose

Defines what a student sees of the network their knob values describe — which parts of the
drawing are faithful to the configuration, which are deliberate abstractions, how that
difference is disclosed, and how the drawing follows the knobs — so that tuning capacity
is an act on a visible object rather than on two numbers in a form.

## ADDED Requirements

### Requirement: The architecture is shown on the configuration screen

The configuration screen SHALL present a diagram of the network the current knob values
describe, for a task that declares one. Seeing it SHALL NOT require running the task, and
it SHALL be visible alongside the knobs rather than behind a control the student must find.

#### Scenario: A student sees the network they are configuring
- **WHEN** a student opens the configuration screen of a task that declares a diagram
- **THEN** a diagram of that task's network is shown
- **AND** no run is needed for it to appear

#### Scenario: The knobs remain usable
- **WHEN** the diagram is shown
- **THEN** every declared knob is still offered with its declared label and current value
- **AND** the task can still be run

### Requirement: The drawing follows the current knob values

The diagram SHALL depict the configuration currently selected. WHEN a knob the diagram
depends on changes, the diagram SHALL be redrawn from the new value. It SHALL NOT depict a
configuration the student has moved away from, and SHALL NOT wait for a run to catch up.

#### Scenario: Changing the depth redraws the layers
- **WHEN** the student changes the knob the task names as setting the number of hidden layers
- **THEN** the number of hidden layers drawn changes to match the new value

#### Scenario: Changing the width redraws the units
- **WHEN** the student changes the knob the task names as setting the units per layer
- **THEN** the number of units drawn in each hidden layer changes to match the new value

#### Scenario: No run is required to update it
- **WHEN** a knob is changed and no run is scored
- **THEN** the diagram already depicts the new configuration

### Requirement: The hidden-layer count is drawn faithfully

The number of hidden layers drawn SHALL equal the value of the knob the task names as
setting the depth, for every value that knob permits. This part of the drawing is exact.

#### Scenario: Every permitted depth draws that many hidden layers
- **WHEN** the depth knob is set to any of its declared values
- **THEN** exactly that many hidden layers are drawn

### Requirement: Unit counts are drawn as declared, not literally

The number of units drawn in each hidden layer SHALL be the count the task's diagram
declaration maps the current width value to, not the width value itself. A width no
diagram can usefully draw is the reason the mapping exists.

#### Scenario: A declared width draws its declared stand-in count
- **WHEN** the width knob is set to a value the task maps to a drawn count
- **THEN** each hidden layer is drawn with that many units

#### Scenario: Wider settings draw wider layers
- **WHEN** the width knob is moved from a smaller declared value to a larger one
- **THEN** each hidden layer is drawn with at least as many units as before
- **AND** the drawn count is greater wherever the task maps the two values differently

### Requirement: The abstraction is disclosed and the true value is stated

WHEN the diagram draws fewer units than the configuration actually has, the screen SHALL
say so, and SHALL state the number of units the configuration actually specifies. A student
SHALL NOT be able to read the number of units drawn as the number of units the network has.

#### Scenario: A student is told the widths are stand-ins
- **WHEN** a diagram is drawn whose unit counts are stand-ins for the declared width
- **THEN** the screen states that the widths shown are abstractions rather than counts

#### Scenario: The real width is on screen
- **WHEN** the width knob is set to any of its declared values
- **THEN** that value is shown as the number of units the configuration specifies

#### Scenario: The exact part is not disclaimed
- **WHEN** the diagram is shown
- **THEN** nothing on screen suggests the number of hidden layers drawn is an approximation

### Requirement: The input and output layers are shown

The diagram SHALL draw an input layer and an output layer either side of the hidden layers.
The output layer SHALL contain exactly one unit per category the task declares. The input
layer SHALL contain the number of units the task's diagram declaration names, as a stand-in
for the image input.

#### Scenario: One output unit per declared category
- **WHEN** a diagram is drawn for a task declaring three categories
- **THEN** the output layer is drawn with three units

#### Scenario: A task with different categories gets a different output layer
- **WHEN** a diagram is drawn for a task declaring two categories
- **THEN** the output layer is drawn with two units

### Requirement: Adjacent layers are drawn fully connected

Every unit of each layer SHALL be drawn connected to every unit of the next layer, in the
conventional feed-forward portrayal. No connection SHALL be drawn between layers that are
not adjacent, and none between units of the same layer.

#### Scenario: Each pair of adjacent layers is fully connected
- **WHEN** the diagram is drawn
- **THEN** the number of connections between each adjacent pair of layers equals the product of their unit counts

#### Scenario: Nothing skips a layer
- **WHEN** the diagram is drawn
- **THEN** no connection joins two units in the same layer or in layers that are not adjacent

### Requirement: The drawing is declared, never assumed

The diagram SHALL be produced from the task's own declaration. A task that declares no
diagram SHALL be shown none, and the system SHALL NOT substitute a default or guessed
architecture for it. No knob id SHALL appear in screen code, so a task declaring different
knobs and a different mapping SHALL draw its own architecture with no screen change.

#### Scenario: A task with no declared diagram is shown none
- **WHEN** a student opens the configuration screen of a task that declares no diagram
- **THEN** no diagram is shown
- **AND** the configuration screen is otherwise unchanged, and the task still runs

#### Scenario: An unrelated task draws its own architecture
- **WHEN** a second task declaring different knobs and a different width mapping is added as a declaration
- **THEN** its diagram is drawn from its own declaration
- **AND** no screen code is added or changed for it

### Requirement: The diagram is not an unlabelled graphic

The diagram SHALL carry a text alternative that names the architecture it depicts,
including the number of hidden layers and the declared units per layer, so that a student
who cannot see it is told what the drawing says.

#### Scenario: The drawing has an accessible description
- **WHEN** the diagram is drawn
- **THEN** it exposes a text alternative naming the number of hidden layers and the declared units per layer

#### Scenario: The description follows the knobs
- **WHEN** a knob the diagram depends on changes
- **THEN** the text alternative names the new configuration

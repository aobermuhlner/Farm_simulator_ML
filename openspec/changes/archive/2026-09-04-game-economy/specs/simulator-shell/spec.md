## ADDED Requirements

### Requirement: A persistent bar shows the year, the money and what the farm currently is

Every screen of an opened farm SHALL carry a bar showing the farm's declared name, the
current year, and the current balance with its declared currency label. The bar SHALL also
present a row of summary facts about the farm, each a label and its value, rendered in the
order they are supplied; WHEN no facts are supplied the bar SHALL show the name, the year
and the balance alone rather than an empty row. The bar SHALL show the current values on
whichever screen the student is on, with no navigation needed to read them. WHEN the farm
cannot be opened, no bar SHALL be shown and the refusal SHALL be presented with its cause
instead.

#### Scenario: The bar is present on every stage
- **WHEN** a student moves from the overview through configuration and a run to a report
- **THEN** the year and the balance are shown on each of those screens

#### Scenario: The bar follows the money
- **WHEN** the balance changes while a student is on a screen
- **THEN** that screen's bar shows the new balance
- **AND** the student did not have to navigate to see it

#### Scenario: Summary facts are rendered as supplied
- **WHEN** two summary facts are supplied to the bar
- **THEN** both are shown with their labels, in the order supplied
- **AND** no fact's subject is named by the bar itself

#### Scenario: A farm with nothing to summarise shows no empty row
- **WHEN** no summary facts are supplied
- **THEN** the bar shows the farm's name, the year and the balance
- **AND** no empty summary row is rendered

#### Scenario: A farm that cannot be opened has no bar
- **WHEN** the farm's declaration is missing or refused
- **THEN** the refusal is shown with the cause that was reported
- **AND** no bar, no year and no balance are shown

## MODIFIED Requirements

### Requirement: The shell contains no task-specific code paths

No task id, category id, action id or knob id declared by a task SHALL appear in screen
code, and no screen SHALL branch on one. A task's screens SHALL be produced from its
declaration alone.

The same rule SHALL hold over what the farm declares: no farm name, no currency label and
no summary fact's label SHALL appear in screen code, and no screen SHALL branch on one.
The persistent bar SHALL be produced from the farm declaration and the facts it is
supplied, and SHALL name nothing of its own.

#### Scenario: An unrelated task renders without screen changes
- **WHEN** a second task declaring unrelated categories and actions is added as a declaration
- **THEN** it renders its overview entry, configuration screen and report through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: A farm declaring a different currency renders without screen changes
- **WHEN** the farm declares a different name and a different currency label
- **THEN** the bar shows both of them
- **AND** no screen code is added or changed for it

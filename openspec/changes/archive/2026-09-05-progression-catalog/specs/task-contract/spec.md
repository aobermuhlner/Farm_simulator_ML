## MODIFIED Requirements

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

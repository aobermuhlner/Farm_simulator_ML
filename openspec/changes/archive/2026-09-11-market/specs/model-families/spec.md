## MODIFIED Requirements

### Requirement: A task declares its model families, and one of them is selected

A task SHALL declare at least one model family. Each family SHALL declare a stable id
unique within its task, a student-facing label, the knobs it exposes, what it ships, its
teaching copy, and how it appears in a labour slot. A task declaring no family SHALL be
refused at load, and a task declaring two families with the same id SHALL be refused naming
that id.

Exactly one of a task's families SHALL be selected at any time, WHERE any of them is
available to the student. The selected family SHALL decide which knobs the workshop presents
and which model the workshop is making. WHEN progress states nothing about which family is
selected, the first declared family that is available SHALL be selected, rather than none
and rather than a family that cannot be selected. WHEN progress records a family that has
since become unavailable, the same rule SHALL apply, so a farm always opens on something it
can use.

WHEN no family of a task is available, none SHALL be selected. The task SHALL present every
family it declares with what opens each, SHALL offer no knobs and no model to make, and
SHALL NOT report the absence as a failure — a farm that has not yet bought a model for a
task is a farm at the start of the game, not a farm in an invalid state. What that task's
crop is brought in by in the meantime is the farm's labour to decide, unchanged.

Selecting a family SHALL move no money, append no record to the ledger, and leave the year
as it was.

#### Scenario: A task's families are read from its declaration
- **WHEN** a task declaring several families is loaded
- **THEN** each declared family is available to be selected by its declared id and label
- **AND** no family the declaration does not carry is offered

#### Scenario: A task declaring no family is refused
- **WHEN** a task declaration carries no model family
- **THEN** the declaration is refused naming that omission
- **AND** the task is not loaded

#### Scenario: Duplicate family ids are refused
- **WHEN** a task declares two families with the same id
- **THEN** the declaration is refused naming that id

#### Scenario: Silence selects the first declared family
- **WHEN** a task is presented and progress states nothing about which family is selected
- **THEN** the first declared family that is available is selected

#### Scenario: A locked first family is passed over
- **WHEN** the first declared family is not available and a later one is
- **THEN** the later one is selected
- **AND** the locked one is presented with what opens it

#### Scenario: A recorded family that has become unavailable is not selected
- **WHEN** progress records a family that is no longer available
- **THEN** the first declared available family is selected instead

#### Scenario: A task with no available family selects none
- **WHEN** every family a task declares is locked
- **THEN** none is selected and no knobs are offered
- **AND** each family is presented with what opens it
- **AND** nothing reports the absence as a failure

#### Scenario: Selecting a family costs nothing
- **WHEN** a different family is selected
- **THEN** the balance, the ledger and the year are as they were

## MODIFIED Requirements

### Requirement: Ownership is the only input to what is available

What a student may select SHALL be a function of the catalog and the items owned, and of
nothing else. Anything the catalog does not mention SHALL be available. A thing the
catalog mentions SHALL be available exactly when an item that opens it is owned. Owning an
item SHALL open what that item declares and nothing further.

Nothing SHALL become available through the year reached, the balance held, a task having
been played, or any other state of the farm.

Putting a model family to work SHALL be the one exception, and it SHALL gain exactly one
further input: whether that family's declared tutorial has been completed. A family whose
tutorial is incomplete SHALL still be selectable, configurable and buildable — the
exception reaches only the act of putting it to work, and reaches nothing else the catalog
governs. No further input SHALL be added to it: not the year, not the balance, not whether
a task has been played, and not any other state of the farm.

Whether a tutorial has been completed SHALL have no bearing on what may be bought. *Money
is the only key to a purchase* is untouched by this exception: the market SHALL never bar a
purchase on a tutorial, and SHALL never state that anything but money would obtain an item.

#### Scenario: What the catalog does not mention is open

- **WHEN** a knob value is named by no item
- **THEN** it is selectable from the first year, whatever is owned

#### Scenario: What the catalog mentions is locked until it is bought

- **WHEN** a knob value is opened by an item the farm does not own
- **THEN** it is not selectable
- **AND** buying that item makes it selectable

#### Scenario: Money and time open nothing on their own

- **WHEN** a farm reaches a later year with a large balance and has bought nothing
- **THEN** exactly the same things are available as on the first day

#### Scenario: An item opens what it declares and no more

- **WHEN** an item that opens one knob's values is bought
- **THEN** those values become selectable
- **AND** no value of any other knob changes state

#### Scenario: An untutored family is selectable but not fieldable

- **WHEN** a family whose tutorial is incomplete is owned
- **THEN** it is selectable in the workshop and its knobs are usable
- **AND** it cannot be put to work

#### Scenario: A completed tutorial opens fielding and nothing else

- **WHEN** a family's tutorial is completed
- **THEN** that family can be put to work
- **AND** no knob value and no catalog item changes state

#### Scenario: A tutorial bars no purchase

- **WHEN** the market is shown to a farm that has completed no tutorial
- **THEN** every item the balance covers offers to be bought
- **AND** nothing states that completing a tutorial would obtain an item

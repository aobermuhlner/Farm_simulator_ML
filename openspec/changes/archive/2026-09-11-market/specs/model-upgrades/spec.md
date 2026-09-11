## ADDED Requirements

### Requirement: The bench is a stage of the workshop, and it lists what the task's families are

The workshop SHALL offer a bench: a stage reached from it and left back to it, listing every
model family the task declares, in declared order, each with its declared label. A family the
student does not own SHALL be listed like any other, with the item that opens it and that
item's price where it has one — the bench shows what a task's models are, not only the ones
already bought.

The bench SHALL be reachable whether or not a model has been made, whether or not one is at
work, and whatever family is selected. Which family is selected SHALL have no bearing on what
the bench lists, because a student cannot select a family they have not bought and the bench
is where they find out what buying one would give them.

Entering the bench SHALL NOT select a family, put a model to work, take one off, run a year,
or produce a report.

#### Scenario: The bench is reached from the workshop and left again
- **WHEN** a student opens the bench from a task's workshop and then leaves it
- **THEN** the bench was shown with the task's families
- **AND** the workshop is shown again on leaving

#### Scenario: Every declared family is listed, owned or not
- **WHEN** a task declares three families of which one is owned
- **THEN** all three are listed in declared order with their declared labels
- **AND** the two that are not owned are listed with the item that opens each

#### Scenario: The selection does not decide what the bench shows
- **WHEN** the bench is opened with one family selected and again with another
- **THEN** the same families are listed both times

#### Scenario: Opening the bench commits nothing
- **WHEN** a student enters the bench and leaves it
- **THEN** the selected family, the model at work and the year are as they were

### Requirement: An upgrade is shown under the family and the knob it opens

Under each family the bench SHALL show the items sold there that open values of that
family's knobs, each under the knob it opens, with the knob's declared label, the values the
item opens, the item's declared label and shop copy, and its price where it has one. An item
opening values of a knob of one family SHALL NOT be shown under any other family.

Each item SHALL be shown as owned, buyable now, not yet affordable, or not for sale, by the
same reading the market gives those four states, and a repeatable one SHALL be shown with
how many times it has been bought and how many the catalog still permits.

A knob for which nothing is sold at the bench SHALL NOT be shown there, and a family for
which nothing is sold at the bench SHALL be listed with the fact that nothing further is for
sale for it — the bench is a shop, and an empty shelf under a heading is a promise it cannot
keep. Where a value of a knob is locked by an item sold in the market, the bench SHALL NOT
offer it: what opens that value is presented where a student meets the lock, which is the
configuration screen, and it is bought where it is sold.

No knob label, family label or item copy SHALL be written into the bench. Everything it
shows SHALL come from the task declaration and the catalog.

#### Scenario: An upgrade sits under its knob
- **WHEN** an item opening two values of one knob is sold at the bench
- **THEN** it is shown under that family, under that knob, with the knob's declared label
- **AND** the two values it opens are named

#### Scenario: An upgrade appears under one family only
- **WHEN** two families each declare a knob of the same id and an item opens values of one of them
- **THEN** that item is shown under the family whose knob it opens
- **AND** it is not shown under the other

#### Scenario: The four states read the same as they do in the market
- **WHEN** the bench holds an owned upgrade, an affordable one, one beyond the balance and one with no price
- **THEN** each is presented as owned, as buyable, as not yet affordable, or as not for sale
- **AND** an item with no price is shown with the declared reason it cannot be bought yet

#### Scenario: A repeatable upgrade shows what is left of it
- **WHEN** an upgrade the catalog permits three times has been bought once
- **THEN** it is shown with the one bought and the two the catalog still permits

#### Scenario: A knob sold nowhere at the bench is not on it
- **WHEN** a family declares a knob no bench item opens
- **THEN** that knob is not shown on the bench

#### Scenario: A family with nothing for sale says so
- **WHEN** a family has no upgrades sold at the bench
- **THEN** it is listed with the fact that nothing further is for sale for it
- **AND** no empty knob heading is shown under it

#### Scenario: The bench does not sell what the market sells
- **WHEN** a knob has a value opened by an item sold in the market
- **THEN** the bench offers no purchase of that item

### Requirement: Buying at the bench is the market's purchase under another roof

A purchase made at the bench SHALL be the purchase `progression-catalog` specifies and
nothing else: confirmed with the item and its price named before any money moves, abandoned
without cost, debited exactly once on confirmation with the item as the recorded reason,
refused with the shortfall named when the balance does not cover it, refused with the limit
named beyond the catalog's repeat limit, and irreversible — no control at the bench SHALL
offer to sell, refund or return anything.

Money SHALL be the only key there, exactly as it is in the market. A purchase at the bench
SHALL NOT be conditioned on owning the family whose knob it opens, on owning any other
upgrade, on a tutorial having been completed, on the year, or on a task having been played.
An upgrade for a family the student does not own SHALL therefore be buyable, and buying it
SHALL open that value for when the family is owned. Nothing at the bench SHALL state that
anything but money would obtain an item.

A purchase SHALL be reflected in the balance and in that item's state without leaving the
bench.

#### Scenario: A confirmed purchase debits once and says what for
- **WHEN** an upgrade is bought at the bench
- **THEN** the balance falls by exactly its price
- **AND** the year's movements record one debit carrying that item as its reason

#### Scenario: An abandoned purchase costs nothing
- **WHEN** a purchase is begun at the bench and not confirmed
- **THEN** the balance is unchanged and the item is not owned

#### Scenario: An upgrade for an unowned family is still bought with money alone
- **WHEN** an upgrade of a family the student does not own is bought and the balance covers it
- **THEN** the purchase is made
- **AND** nothing states that owning the family would have been required

#### Scenario: A tutorial bars nothing at the bench
- **WHEN** the bench is shown to a student who has completed no tutorial
- **THEN** every item the balance covers offers to be bought
- **AND** nothing states that completing a tutorial would obtain one

#### Scenario: The bench sells nothing back
- **WHEN** an owned upgrade is shown at the bench
- **THEN** no control offers to sell, refund or return it

#### Scenario: Buying is reflected without leaving the bench
- **WHEN** a purchase is confirmed at the bench
- **THEN** the balance shown falls by the price and the item's state changes
- **AND** the student is still at the bench

### Requirement: Buying an upgrade opens a value and selects nothing

Buying an upgrade SHALL make the values it opens selectable and SHALL do nothing else. It
SHALL NOT set a knob to a value it opened, SHALL NOT change the configuration the student
left in the workshop, SHALL NOT invalidate a model already made, and SHALL NOT take a model
off a task.

A student who buys a deeper stack and returns to the knobs SHALL find the knobs as they left
them, with more of them selectable. Buying is what makes a choice possible; making the
choice stays the student's.

#### Scenario: The knobs are as they were left
- **WHEN** an upgrade is bought and the student returns to the workshop
- **THEN** every knob holds the value it held before
- **AND** the values the upgrade opened are now selectable

#### Scenario: A made model survives a purchase
- **WHEN** a model has been made and an upgrade is then bought
- **THEN** that model is still presented as the model of the current knob values

#### Scenario: A working model survives a purchase
- **WHEN** a model is at work on a task and an upgrade for it is bought
- **THEN** that model is still at work

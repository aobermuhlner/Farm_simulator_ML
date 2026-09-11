## MODIFIED Requirements

### Requirement: The market is a stage of the farm, not of a task

The shell SHALL present a market, reachable from the farm overview without a task being
selected and leavable back to it. The market SHALL be rendered from the declared catalog
alone: each item under its declared group with its declared label, its shop copy, and its
price where it has one, together with which of owned, buyable now, not yet affordable, or
not for sale it currently is.

Groups SHALL be gathered into sections by the part of the farm they belong to. A group that
names a task SHALL be shown under a heading that is that task's own declared title; groups
naming no task SHALL be shown under the farm rather than under any one part of it, after the
parts. Sections SHALL appear in the order their first group is declared and groups within a
section in the order they are declared, so that the order of the shelves stays one fact in
one place. No section heading and no group heading SHALL be written into the screen: a task's
heading is its declared title, and a second task's shelf SHALL appear with no screen change.

A group with no items SHALL NOT be shown as an empty section, and a section whose groups all
have no items SHALL NOT be shown at all. Items sold at the workshop's upgrade bench SHALL
NOT be shown in the market.

The balance SHALL be readable from the market as it is from every other screen, and a
purchase SHALL be reflected in the balance and in that item's state without leaving the
market. WHEN the catalog cannot be loaded, the market SHALL NOT be shown and the refusal
SHALL be presented with its cause instead.

#### Scenario: The market is reached from the overview and left again
- **WHEN** a student opens the market from the farm overview and then leaves it
- **THEN** the market is shown without any task having been selected
- **AND** the overview is shown again on leaving

#### Scenario: Items render under their declared groups, in declared order
- **WHEN** the catalog declares two groups with items in each
- **THEN** both groups are shown in the order declared, each with its own items
- **AND** no group name or item name is written into the screen

#### Scenario: A group belonging to a task is shown under that task's title
- **WHEN** a group names a task
- **THEN** its items are shown under a heading that is that task's declared title

#### Scenario: A group belonging to no task is shown under the farm
- **WHEN** a group names no task
- **THEN** its items are shown under the farm rather than under a part of it
- **AND** that section comes after the sections belonging to parts of the farm

#### Scenario: A second task's shelf needs no screen change
- **WHEN** a catalog declares a group naming a task the shell has never presented
- **THEN** that task's section is shown with its declared title and that group's items
- **AND** no screen code is added or changed for it

#### Scenario: An empty section is not shown
- **WHEN** every group of one section has no items
- **THEN** that section is not shown

#### Scenario: The four states are distinguishable on screen
- **WHEN** the catalog holds an owned item, an affordable one, one beyond the balance and one with no price
- **THEN** each is presented as owned, as buyable, as not yet affordable, or as not for sale
- **AND** no two of those read the same

#### Scenario: Upgrades are not in the market
- **WHEN** the catalog holds items sold at the workshop's upgrade bench
- **THEN** none of them is shown in the market

#### Scenario: Buying is reflected without leaving the market
- **WHEN** a purchase is confirmed in the market
- **THEN** the balance shown falls by the price and the item is shown as owned
- **AND** the student is still in the market

#### Scenario: A catalog that cannot be loaded has no market
- **WHEN** the catalog is missing or refused
- **THEN** the refusal is shown with the cause that was reported
- **AND** no market is shown

### Requirement: The workshop moves no money

No stage of the workshop SHALL credit or debit the balance, append a record for a year, or
advance the year, with one exception: a purchase made at the upgrade bench, which is a
purchase like any other and debits like any other. Entering the workshop, browsing what a
task declares, making a model any number of times, sitting a tutorial any number of times,
putting a model to work, and entering the bench to read what it sells SHALL all leave the
balance and the year exactly as they were.

Hypotheses have to be cheap or they will not be formed. A workshop that charged for a model
would teach a student to guess once rather than to look, and a tutorial that charged for an
attempt would teach them to guess at the puzzle rather than read it. Buying capacity is not
an attempt at anything: it is the deliberate, confirmed, irreversible act
`progression-catalog` specifies, and it is put beside the knobs because that is where its
price can be read against what it moves. What must stay free is trying things; what is paid
for is having more things to try.

No stage of the workshop SHALL advance the year, and the bench SHALL NOT be an exception to
that.

#### Scenario: Making a model costs nothing

- **WHEN** a student makes a model in the workshop any number of times
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Putting a model to work costs nothing

- **WHEN** a student puts a model to work and hands the job back again
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Sitting a tutorial costs nothing

- **WHEN** a student opens a tutorial and attempts it any number of times, passing or failing
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Reading the bench costs nothing

- **WHEN** a student enters the bench, reads what it sells and leaves without confirming a purchase
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: A purchase at the bench is the one thing that moves money

- **WHEN** a purchase is confirmed at the bench
- **THEN** the balance falls by exactly that price and one debit is recorded with the item as its reason
- **AND** the year is unchanged

### Requirement: The tutorial is reached from the workshop, never sprung in the market

WHEN the selected family declares a tutorial, the workshop SHALL offer it beside that
family's knobs, whether or not it has been completed, so that its theory copy stays
reachable after it is passed. Nothing SHALL open it unbidden while a student is tuning
knobs, making a model, or buying at the bench.

Neither counter SHALL present a tutorial, open one on a purchase, or condition a purchase on
one. Buying a family and being ambushed by a puzzle is the shop telling a student that money
was not the key, which is a thing the shop has already promised it will never say.

#### Scenario: The workshop offers the selected family's tutorial

- **WHEN** a family declaring a tutorial is selected in the workshop
- **THEN** that tutorial is offered beside its knobs

#### Scenario: A completed tutorial is still offered

- **WHEN** the selected family's tutorial has been completed
- **THEN** it is still offered from the workshop
- **AND** opening it presents its puzzle and its theory copy

#### Scenario: Buying a family opens no puzzle

- **WHEN** an item that opens a family declaring a tutorial is bought
- **THEN** the market shows the purchase and nothing else
- **AND** no tutorial is presented until the student reaches the workshop

#### Scenario: Buying an upgrade opens no puzzle

- **WHEN** an upgrade for a family declaring a tutorial is bought at the bench
- **THEN** the bench shows the purchase and nothing else
- **AND** no tutorial is opened

#### Scenario: A family declaring no tutorial offers none

- **WHEN** a family declaring no tutorial is selected in the workshop
- **THEN** no tutorial is offered
- **AND** the workshop is as it was before tutorials existed

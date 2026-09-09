## MODIFIED Requirements

### Requirement: The catalog is checked against what it claims to open

Everything an item opens SHALL name something that exists. Where it opens values of a
knob, it SHALL name a declared task, a knob that task declares, and values that knob
permits. Where it opens growth of the farm, it SHALL name a whole amount of land of one or
more — a purchase that grows the farm by nothing is a purchase that does nothing, which is
the same defect as an item that opens nothing. An item SHALL open at least one thing, so
that nothing is sold that does nothing.

No item SHALL open a knob's declared default value: the default is the configuration
every student opens at, and a locked default would leave a task with no configuration to
run. No two items SHALL open the same knob value, so that what opens a locked thing is
always exactly one item and can always be named. Growth is not subject to that rule,
because growth accumulates rather than unlocking: two items that each grow the farm open
two different things, and a student who buys both gets both.

A kind of thing to open that the build does not recognise SHALL be refused naming that
kind, rather than ignored — an unlock that silently opens nothing is indistinguishable
from a bug. Every failure here SHALL name the item and the defect, and the farm SHALL NOT
open.

#### Scenario: An item opening a knob no task declares is refused
- **WHEN** an item opens a knob id no declared task carries
- **THEN** the refusal names the item and that knob id
- **AND** the farm does not open

#### Scenario: An item opening a value the knob does not permit is refused
- **WHEN** an item opens a value outside a knob's declared allowed values
- **THEN** the refusal names the item, the knob and that value

#### Scenario: A knob's default may not be locked
- **WHEN** an item opens a knob's declared default value
- **THEN** the catalog is refused naming that knob and its default

#### Scenario: Two items may not open the same thing
- **WHEN** two items open the same knob value
- **THEN** the catalog is refused naming both items and that value

#### Scenario: An unrecognised kind of unlock is refused, not ignored
- **WHEN** an item declares a kind of thing to open that this build does not recognise
- **THEN** the refusal names that kind
- **AND** the farm does not open

#### Scenario: An item that opens nothing is refused
- **WHEN** an item declares nothing that owning it opens
- **THEN** the catalog is refused naming that item

#### Scenario: Growth of no land is refused
- **WHEN** an item declares that it grows the farm by zero, a fraction, or no amount at all
- **THEN** the refusal names the item and that field
- **AND** the farm does not open

#### Scenario: Two items may both grow the farm
- **WHEN** two items each declare that they grow the farm
- **THEN** the catalog is accepted
- **AND** a farm that buys both holds the land both gave

### Requirement: Money is the only key to a purchase

An item SHALL be purchasable whenever the farm's balance covers its price and it has not
already been bought as many times as the catalog permits it to be, and SHALL NOT be gated
on owning any other item. An item the balance does not cover SHALL be presented as not yet
affordable — never as barred, and never as requiring anything but money.

An item the catalog permits to be bought more than once SHALL be presented with how many
times it has been bought and how many the catalog still permits, so that a student can see
what is left to earn towards rather than discovering the limit by reaching it. An item
bought as many times as the catalog permits SHALL be shown with what it gave and SHALL
offer no further purchase; it SHALL NOT be presented as unaffordable, since no amount of
money would obtain another.

An item declared without a price SHALL be presented as not for sale, together with the
declared reason it cannot be bought yet, and SHALL NOT be presented as though money alone
would obtain it. No screen SHALL invent a reason of its own for any of these states.

#### Scenario: An affordable item can be bought
- **WHEN** the balance covers an item's price
- **THEN** that item offers to be bought

#### Scenario: An unaffordable item is saving for, not barred
- **WHEN** the balance does not cover an item's price
- **THEN** the item is shown with its price and reported as not yet affordable
- **AND** nothing states that owning something else would obtain it

#### Scenario: Purchasability changes only with the balance
- **WHEN** any item is bought
- **THEN** no other item becomes purchasable except by the balance covering its price

#### Scenario: An item not for sale says why
- **WHEN** an item declares no price
- **THEN** it is shown with the declared reason it cannot yet be bought
- **AND** it offers no purchase

#### Scenario: A repeatable item shows how much of it is left
- **WHEN** an item the catalog permits to be bought five times has been bought twice
- **THEN** it is shown with those two and the three the catalog still permits
- **AND** it offers to be bought while the balance covers its price

#### Scenario: An item bought to its limit offers nothing further
- **WHEN** an item has been bought as many times as the catalog permits
- **THEN** it is shown with what it gave
- **AND** it offers no purchase
- **AND** it is not reported as unaffordable

### Requirement: A purchase moves money once and cannot be undone

Buying SHALL be confirmed before any money moves, with the item and its price named, and
abandoning the confirmation SHALL leave the balance and what is owned untouched. On
confirmation the price SHALL be debited exactly once, with the item as the reason recorded
for the movement, and the item SHALL become owned.

An item MAY declare how many times it can be bought. An item declaring no such limit SHALL
be buyable once, and buying it again SHALL be refused and SHALL move no money. An item
declaring a limit SHALL be buyable up to that many times, each purchase debiting the price
once and recording its own movement, and a purchase beyond the limit SHALL be refused with
the limit named and SHALL move no money. A declared limit that is not a whole number of one
or more SHALL be refused with the item and the field named, and the farm SHALL NOT open.

What each purchase opens SHALL be given each time it is bought, so an item that grows the
farm by a given amount of land grows it by that amount on every purchase. A purchase the
balance cannot cover SHALL be refused with the shortfall named, leaving the balance and what
is owned untouched. There SHALL be no way to sell, refund or return a bought item, however
many times it was bought.

#### Scenario: A confirmed purchase debits once and says what for
- **WHEN** a purchase of a priced item is confirmed
- **THEN** the balance falls by exactly that price
- **AND** the year's movements record one debit carrying that item as its reason

#### Scenario: An abandoned purchase costs nothing
- **WHEN** a purchase is begun and not confirmed
- **THEN** the balance is unchanged and the item is not owned

#### Scenario: Buying what is already owned is refused
- **WHEN** an owned item declaring no repeat limit is bought again
- **THEN** the attempt is refused
- **AND** no movement is recorded

#### Scenario: A repeatable item is bought again
- **WHEN** an item the catalog permits to be bought five times is bought a second time
- **THEN** the balance falls by exactly its price again
- **AND** a second debit carrying that item as its reason is recorded
- **AND** what it opens has been given twice

#### Scenario: A purchase past the declared limit is refused
- **WHEN** an item is bought once more than the catalog permits
- **THEN** the refusal names the limit
- **AND** no movement is recorded and nothing further is given

#### Scenario: A limit that is not a whole count is refused
- **WHEN** an item declares a repeat limit of zero, a fraction or a negative number
- **THEN** the refusal names the item and that field
- **AND** the farm does not open

#### Scenario: A purchase beyond the balance is refused with the shortfall
- **WHEN** an item priced above the balance is confirmed
- **THEN** the refusal names the shortfall
- **AND** the item is not owned

#### Scenario: Nothing sells anything back
- **WHEN** an owned item is shown anywhere
- **THEN** no control offers to sell, refund or return it

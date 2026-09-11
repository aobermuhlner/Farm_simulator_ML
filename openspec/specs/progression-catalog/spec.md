## Purpose

Holds everything the farm can buy and everything a purchase opens: the declared catalog
with its prices and its shop copy, the items a farm owns, and the single rule that turns
ownership into what a student may select — so that model capacity is earned rather than
picked, and every gate in the game is one piece of data rather than five systems.

## Requirements

### Requirement: The catalog is declared, and nothing purchasable is written into code

The farm SHALL declare its catalog: the groups items are shown under, in the order they are
shown, and for each item a stable id, the group it belongs to, a student-facing label, its
shop copy, what owning it opens, and its price where it is for sale. Each group SHALL
declare a stable id, a student-facing label and the counter it stands at, and MAY declare
the task it belongs to — the part of the farm its items are for. A group naming no task
belongs to the farm rather than to any one part of it.

The catalog SHALL also declare which items every farm owns. Those items SHALL be owned by
every farm that is opened, not only by a farm that has never bought anything, so that a farm
saved before the catalog named an item does not return to find what it was already using
locked. It is a floor rather than an opening state, and it reads the same way `game-save`
already reads a reference this build no longer declares: what the declarations say now
decides what the farm has now.

No item, price, group, group heading, shop copy or unlock rule SHALL be written into engine
or screen code. A catalog that omits a required field, carries one of the wrong shape,
declares two items with the same id, declares two groups with the same id, places an item in
a group it does not declare, or names in a group a task no declaration carries SHALL be
refused with the field named, and the farm SHALL NOT open.

#### Scenario: A complete catalog opens the farm
- **WHEN** the catalog declares its groups and every item completely
- **THEN** the farm opens and each counter shows the items its groups carry

#### Scenario: An incomplete catalog refuses rather than assumes
- **WHEN** an item omits its label
- **THEN** the refusal names that item and the missing field
- **AND** no market and no farm are shown

#### Scenario: Two items with one id are refused
- **WHEN** two items declare the same id
- **THEN** the refusal names the repeated id
- **AND** the farm does not open

#### Scenario: A group naming a task no declaration carries is refused
- **WHEN** a group names a task id no declaration carries
- **THEN** the refusal names that group and that task id
- **AND** the farm does not open

#### Scenario: What a new farm owns is declared, not assumed
- **WHEN** the catalog declares the items every farm owns
- **THEN** a new farm owns exactly those items and nothing else

#### Scenario: A farm saved before an item was declared still owns it
- **WHEN** a farm whose save names none of them is opened against a catalog declaring items every farm owns
- **THEN** that farm owns each of them
- **AND** what it had already bought is owned as it was

### Requirement: The catalog is checked against what it claims to open

Everything an item opens SHALL name something that exists. Where it opens values of a knob,
it SHALL name a declared task, a knob that task declares, and values that knob permits.
Where it opens a model family, it SHALL name a declared task and a family that task
declares. Where it opens growth of the farm, it SHALL name a whole amount of land of one or
more — a
purchase that grows the farm by nothing is a purchase that does nothing, which is the same
defect as an item that opens nothing. An item SHALL open at least one thing, so that nothing
is sold that does nothing.

No item SHALL open a knob's declared default value: the default is the configuration every
student opens at, and a locked default would leave a task with no configuration to run. No
two items SHALL open the same knob value, so that what opens a locked thing is always
exactly one item and can always be named. Growth is not subject to that rule, because growth
accumulates rather than unlocking: two items that each grow the farm open two different
things, and a student who buys both gets both.

A kind of thing to open that the build does not recognise SHALL be refused naming that kind,
rather than ignored — an unlock that silently opens nothing is indistinguishable from a bug.
Every failure here SHALL name the item and the defect, and the farm SHALL NOT open.

#### Scenario: An item opening a knob no task declares is refused
- **WHEN** an item opens a knob id no declared task carries
- **THEN** the refusal names the item and that knob id
- **AND** the farm does not open

#### Scenario: An item opening a value the knob does not permit is refused
- **WHEN** an item opens a value outside a knob's declared allowed values
- **THEN** the refusal names the item, the knob and that value

#### Scenario: A priced item opening a family its task does not declare is refused
- **WHEN** a priced item opens a family id the task it names does not declare
- **THEN** the refusal names the item, the task and that family id
- **AND** the farm does not open

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

### Requirement: Nothing for sale opens a configuration no model was trained for

Every configuration reachable once every priced item is owned SHALL be covered by the task's
prediction artifact. A catalog whose priced items would open an uncovered configuration
SHALL be refused at load, naming the item and one configuration identifier it would open
that no model was trained for. A priced item that opens a model family SHALL leave that
family's declared defaults covered, so that buying a model buys at least one configuration
that can be run.

An item declared without a price SHALL NOT be subject to this rule, because nothing can buy
it: an unpriced item exists to show a student what is coming and to keep the ground it names
locked until a model for it is trained. Pricing such an item SHALL be a change to the catalog
and to nothing else.

For the same reason an unpriced item MAY open a model family the task it names does not
declare. The task itself SHALL still be one that exists, because a shelf entry for a field
the farm does not have is not a rung of the ladder. It
can never be owned, so it can never open anything, and a rung of the ladder that has not been
built yet is exactly the thing the shelf exists to show — with the declared reason it is not
for sale in place of a price. Pricing it SHALL then be refused until the family it names is
declared, so the latitude ends where money begins.

#### Scenario: A priced item opening untrained ground refuses the catalog
- **WHEN** an item carries a price and opens knob values whose combinations the artifact does not cover
- **THEN** the catalog is refused naming that item and an uncovered identifier
- **AND** the farm does not open

#### Scenario: A priced family whose defaults are uncovered is refused
- **WHEN** a priced item opens a family whose declared default configuration the artifact does not cover
- **THEN** the catalog is refused naming that item and that identifier

#### Scenario: An unpriced item may name untrained ground
- **WHEN** an item without a price opens knob values the artifact does not cover
- **THEN** the catalog is accepted
- **AND** those values stay locked

#### Scenario: An unpriced item may name a family that does not exist yet
- **WHEN** an item without a price opens a family id its declared task does not declare
- **THEN** the catalog is accepted
- **AND** that item is shown with the declared reason it cannot be bought yet

#### Scenario: Pricing an item that names no declared family is refused
- **WHEN** an item naming a family id its task does not declare is given a price
- **THEN** the catalog is refused naming the item and that family id

#### Scenario: An unpriced item naming a task that does not exist is still refused
- **WHEN** an item without a price names a task no declaration carries
- **THEN** the refusal names the item and that task id

#### Scenario: The shipped catalog leaves nothing untrained selectable
- **WHEN** the shipped catalog and the shipped task are loaded together
- **THEN** every configuration a student can select, owning anything they can buy, is covered by the shipped artifact

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

### Requirement: A locked thing is shown with what opens it, never hidden

A locked thing SHALL appear wherever the same thing would appear unlocked — greyed rather
than removed — together with the label of the item that opens it and that item's price
where it has one. Seeing what cannot yet be afforded is how a student learns there is
something to earn, so nothing locked SHALL be hidden, and nothing locked SHALL be
presented as unavailable without saying what would open it.

A locked knob value SHALL NOT be selectable. A knob none of whose values beyond its
default are available SHALL still be shown, at its declared default.

#### Scenario: A locked value is shown and not selectable
- **WHEN** a knob has values that are locked
- **THEN** those values are shown alongside the available ones
- **AND** they cannot be selected

#### Scenario: A locked value says what opens it
- **WHEN** a locked value is shown
- **THEN** the item that opens it is named
- **AND** that item's price is shown where it has one

#### Scenario: A fully locked knob sits at its default
- **WHEN** every value of a knob beyond its default is locked
- **THEN** the knob is shown at its declared default rather than removed from the screen

#### Scenario: Buying changes what is offered, not what is shown
- **WHEN** an item is bought
- **THEN** the same knobs and the same values are on screen as before it
- **AND** what changed is which of them can be selected

### Requirement: Locked, untrained and invalid are three different refusals

A configuration requesting a value the task's declaration does not permit SHALL be refused
as invalid. A configuration requesting a declared value that is locked SHALL be refused as
locked, naming the value and the item that opens it. A configuration whose values are all
permitted and all available, but which the prediction artifact does not cover, SHALL be
refused as untrained, naming the identifier.

The three SHALL carry distinct causes and SHALL NOT be reported in one another's words: a
student who has not bought something has made no error, and a student who has bought
something has not met the limits of what was trained. No run SHALL be scored from any of
the three.

#### Scenario: A locked value refuses as locked
- **WHEN** a configuration naming a locked but declared value is requested
- **THEN** the refusal reports that the value is not yet owned and names what opens it
- **AND** it is not reported as untrained or as invalid

#### Scenario: An available but uncovered configuration refuses as untrained
- **WHEN** a configuration whose values are all available resolves to an identifier outside the artifact's coverage
- **THEN** the refusal names that identifier and reports that no model was trained for it
- **AND** it is not reported as locked

#### Scenario: A value outside the declaration refuses as invalid
- **WHEN** a configuration names a value the knob does not permit
- **THEN** the refusal reports an invalid configuration
- **AND** it is not reported as locked

#### Scenario: No run is scored from any of the three
- **WHEN** a configuration is refused as invalid, as locked, or as untrained
- **THEN** no earnings, no report and no training history are produced from it

### Requirement: Unlocking extends what can be selected and reinterprets nothing

A locked knob SHALL sit at its declared default and SHALL contribute that default to the
configuration identifier, exactly as an unlocked knob left at its default would. Buying an
item SHALL only add identifiers a student can select; it SHALL NOT change what any
identifier means, what any previously selectable configuration resolves to, or the
coverage of any shipped artifact.

#### Scenario: A locked knob still appears in the identifier
- **WHEN** the opening configuration of a task with locked knobs is resolved
- **THEN** its identifier carries every knob, each locked one at its declared default

#### Scenario: The opening identifier is the one the defaults resolve to
- **WHEN** a new farm opens a task and accepts what it is offered
- **THEN** the identifier resolved is the identifier the task's declared defaults resolve to

#### Scenario: Unlocking adds identifiers and changes none
- **WHEN** an item that opens a knob's values is bought
- **THEN** the identifiers selectable before it are still selectable and still resolve to the same artifacts
- **AND** the identifiers the new values reach are added to them

### Requirement: A model family is opened for one task, by an item that names both

An item MAY open a model family, naming the task and the family. Owning it SHALL make that
family available in that task, and SHALL make no family of any other task available. A
second task declaring a family of the same id SHALL be a second purchase: a model is bought
for a field the way a robot is, and *money buys the robot for the next task* is the reading
the economy already gives every other part of the farm.

A family no item names SHALL be available from the first day, which is the default-open rule
applied to families and not an exception to it. No two items SHALL open the same family of
the same task, so that what opens a locked family is always exactly one item and can always
be named. Two items opening the same family id in two different tasks SHALL be accepted,
because they open two different things.

#### Scenario: Buying a family opens it for the task it names
- **WHEN** an item opening a family of one task is bought
- **THEN** that family becomes selectable in that task's workshop

#### Scenario: One task's purchase opens nothing in another
- **WHEN** two tasks each declare a family of the same id and an item opening one of them is bought
- **THEN** only the task the item names offers it
- **AND** the other is still shown with the item that opens it

#### Scenario: A family the catalog does not mention is open
- **WHEN** a task declares a family no item opens
- **THEN** it is selectable from the first day, whatever is owned

#### Scenario: Two items may not open one family of one task
- **WHEN** two items open the same family of the same task
- **THEN** the catalog is refused naming both items and that family
- **AND** the farm does not open

### Requirement: Every item is sold at exactly one counter

Each group SHALL declare the counter its items stand at: the market, or the workshop's
upgrade bench. Every item SHALL sit in exactly one group, so the counter an item is sold at
SHALL be one fact with one place to read it, and no item SHALL be offered at both. A group
declaring a counter this build does not recognise SHALL be refused naming that counter, and
the farm SHALL NOT open.

Every item of a group standing at the bench SHALL open values of knobs of exactly one model
family, and nothing else. An item that grows the farm, opens a family, or reaches across two
families is not an upgrade to a model and SHALL be refused naming the item and what it
opens. What the bench is for is reading a price against the knob it moves; an item with no
one knob to sit under has no place there.

Which counter an item stands at SHALL have no bearing on what a purchase does, what it
costs, how it is confirmed, or what it opens. A counter is where a thing is bought and
nothing more.

#### Scenario: The market shows only what stands at the market
- **WHEN** the market is presented
- **THEN** every item shown belongs to a group declaring the market
- **AND** no item of a bench group is shown there

#### Scenario: The bench shows only what stands at the bench
- **WHEN** the bench is presented
- **THEN** every item shown belongs to a group declaring the bench

#### Scenario: An unrecognised counter is refused
- **WHEN** a group declares a counter this build does not recognise
- **THEN** the refusal names that counter
- **AND** the farm does not open

#### Scenario: A bench item that is not a model upgrade is refused
- **WHEN** an item in a bench group opens land, opens a family, or opens knobs of two families
- **THEN** the refusal names the item and what it opens
- **AND** the farm does not open

#### Scenario: The counter changes nothing about the purchase
- **WHEN** the same price is paid at the market and at the bench
- **THEN** each is confirmed before money moves, debited once, recorded with its item as the reason, and irreversible

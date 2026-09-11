## MODIFIED Requirements

### Requirement: The orchard grows only by purchase, and only money buys it

The land the farm holds SHALL open at the declared opening and SHALL change only when an item
declaring that it grows the farm is bought. Nothing else SHALL move it: not the year reached,
not a harvest, not a model put to work, not the balance held. The land SHALL never decrease, and
there SHALL be no way to sell, return or shrink it.

Buying growth SHALL be gated on the balance covering its price and on nothing else. No other
item's ownership SHALL bar it, and nothing SHALL present it as requiring anything but money.
Where the catalog offers growth in rungs of ascending size and price, each rung SHALL be an item
in its own right, bought on its own price alone, so that ascending prices are what order the
ladder and no rung is gated on the rung below it.

What makes expanding before the work can be automated a poor decision rather than a barred one
is that one person's reach runs out before the orchard does. Hand sorting is offered over the
whole crop and paid over exactly the apples decided, so a student who expands early is not
stopped — they are handed more apples than they will click through, and told in figures what
they left. The bound on it is the evaluation split: once the orchard bears more apples of a
category than there are distinct photographs of it, the extra apples cannot be put in front of a
person at all, and what one person can bring in stops rising with the land however patient they
are. That is anti-grind rule 2, carried by a real shortage of pictures rather than by a declared
cap, and it is preferred to a barred control because a control that does nothing teaches
nothing.

#### Scenario: A bought expansion grows the land
- **WHEN** an item declaring that it grows the farm by a given amount of land is bought
- **THEN** the land held rises by exactly that amount
- **AND** the crop the farm bears rises by that amount times the declared yield

#### Scenario: Time, money and harvests move no land
- **WHEN** a farm advances several years, closes harvests and accumulates a large balance without buying growth
- **THEN** the land held is the declared opening land

#### Scenario: Nothing shrinks the orchard
- **WHEN** the orchard is shown anywhere
- **THEN** no control offers to sell, return or reduce it

#### Scenario: Only money keeps expansion out of reach
- **WHEN** growth is offered while the balance does not cover its price
- **THEN** it is reported as not yet affordable
- **AND** nothing states that owning anything else would obtain it

#### Scenario: Owning nothing else does not bar expansion
- **WHEN** a farm that owns no other item and whose balance covers the price buys growth
- **THEN** the purchase is made and the land grows

#### Scenario: A later rung is not gated on an earlier one
- **WHEN** a farm whose balance covers a larger rung of the growth ladder has bought none of the smaller ones
- **THEN** that rung offers to be bought
- **AND** nothing states that a smaller rung must be owned first

#### Scenario: Expanding past the split does not raise what hands can bring in
- **WHEN** a farm whose crop already exceeds the evaluation split's photographs of every category grows the orchard and brings the crop in by hand with identical decisions
- **THEN** the wage is the wage the smaller crop paid

## Purpose

The orchard as owned, purchasable state: how the farm declares the land it holds and what
that land bears, how the crop follows the orchard as it grows, when a purchase takes
effect, and what the game may and may not claim about deploying a model more widely.

## ADDED Requirements

### Requirement: The farm declares land and yield, and the crop is derived from them

The farm SHALL declare its orchard: how much land it opens with, how many pieces of crop a
unit of that land bears in a year, what a unit of it is called, and what the orchard itself
is called. The number of pieces the farm's crop holds SHALL be the product of the land held
and the declared yield, and SHALL NOT be declared separately.

A declared crop size beside a declared orchard would be two statements about one fact, with
nothing able to say which is right when a later edit makes them disagree. The crop is
therefore derived and only the land is declared.

An orchard whose land or yield is not a whole number of one or more, or whose names are not
present, SHALL be refused with the field named, and the farm SHALL NOT open. A farm
declaring no orchard at all SHALL be refused the same way, because a farm with no land
bears no crop and there is no size to assume for it.

Every check the farm makes against the smallest crop it will ever bear SHALL be made
against the crop its declared opening land bears, since the orchard only ever grows.

#### Scenario: The opening crop is the land times the yield
- **WHEN** a farm declaring one hundred units of land at sixty pieces each is opened
- **THEN** its crop holds six thousand pieces

#### Scenario: A crop size cannot be declared beside an orchard
- **WHEN** the farm declaration is read
- **THEN** no declared field states the size of the crop
- **AND** the size presented is the one derived from the land and the yield

#### Scenario: An orchard with no land is refused
- **WHEN** the farm declares an orchard whose land is zero, fractional or absent
- **THEN** the refusal names that field
- **AND** no farm, no balance and no year are shown

#### Scenario: An orchard with no yield is refused
- **WHEN** the farm declares an orchard whose yield per unit is zero, fractional or absent
- **THEN** the refusal names that field
- **AND** the farm does not open

#### Scenario: A farm declaring no orchard is refused rather than assumed
- **WHEN** the farm declaration carries no orchard
- **THEN** the refusal names the missing field
- **AND** no crop size is substituted for it

#### Scenario: Checks against the smallest crop use the opening land
- **WHEN** a declared range is checked for leaving every category a whole piece to hold
- **THEN** it is checked against the crop the declared opening land bears

### Requirement: The orchard grows only by purchase, and only money buys it

The land the farm holds SHALL open at the declared opening and SHALL change only when an
item declaring that it grows the farm is bought. Nothing else SHALL move it: not the year
reached, not a harvest, not a model put to work, not the balance held. The land SHALL never
decrease, and there SHALL be no way to sell, return or shrink it.

Buying growth SHALL be gated on the balance covering its price and on nothing else. No
other item's ownership SHALL bar it, and nothing SHALL present it as requiring anything but
money.

What makes expanding before the work can be automated a poor decision rather than a barred
one is already specified elsewhere: one person's reach is bounded while the crop is not, so
the wage does not move and the count of pieces left unbrought is stated. A student who
expands early is told in figures what they bought. That is anti-grind rule 2 made legible,
and it is preferred to a barred control because a control that does nothing teaches nothing.

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

### Requirement: Growth takes effect on the next crop brought in

Growing the orchard SHALL take effect from the next crop brought in. It SHALL NOT alter a
crop already brought in within an open year, and SHALL NOT alter a year already closed or
anything that year recorded.

A crop brought in after growth was bought SHALL be the crop the grown orchard bears, in the
year it is brought in, so that expanding and then running the year pays that year rather
than the next. Growing pays immediately or the claim that it pays is not true.

#### Scenario: Expanding then running the year pays that year
- **WHEN** growth is bought and the year is then run
- **THEN** the crop brought in is the one the grown orchard bears

#### Scenario: A crop already in is not re-drawn
- **WHEN** growth is bought while a year is open and one task's crop has already been brought in
- **THEN** what that crop brought in is unchanged

#### Scenario: A closed year is not rewritten
- **WHEN** growth is bought after a year has closed
- **THEN** every figure that year recorded is the figure it closed with

### Requirement: Growth multiplies the money and leaves every rate where it was

WHEN one configuration brings in the crops of two orchards in the same year of the same
farm, the shares drawn for that year SHALL be the same shares, the count of pieces in each
category SHALL differ only by the rounding of those shares to whole pieces, and the
measured share of any declared delivery term and the money SHALL differ in proportion to
the land held, up to which pictures the crop repeats.

That last qualification is measured rather than conceded. A crop is dealt from a finite
split by whole passes over it plus a partial pass, and a crop twice the size is not two
copies of the smaller one — it takes a different number of whole passes and a differently
sized partial one, so the mix of individual pictures is not scaled even where the count
of pieces per category is. Proportionality therefore holds to a fraction of a percent
rather than exactly, and the size of that fraction SHALL be recorded where it is measured,
so that a later change to how a crop is dealt is seen to move it. It is two orders of
magnitude below the difference between the configurations a student is choosing between,
which is what makes it a rounding and not a lesson.

Nothing SHALL present growing the orchard as changing how well a model performs — not as
error, not as accuracy, not as noise, not as variance, not as risk, and not as a model
degrading. A larger orchard makes a mistake cost more, in money; it does not make a model
worse. A student who leaves believing that more data breaks a model has been handed a false
claim, and a false claim is the one thing the game must not teach. What does break a model
is the crop *changing*, which is a different mechanism and belongs to whatever introduces
one.

A declared percentage tolerance SHALL therefore fall on the same side of the line at every
size the orchard can reach, and growth alone SHALL NOT breach one.

#### Scenario: Doubling the orchard doubles the money
- **WHEN** one configuration brings in the crop of an orchard and then of an orchard twice the land, in the same year of the same farm
- **THEN** the money the second pays is twice the money the first pays, to within a fraction of a percent
- **AND** the count of pieces in each category is twice the count, up to the rounding of whole pieces

#### Scenario: Doubling the orchard moves no rate
- **WHEN** those same two crops are brought in
- **THEN** the shares drawn for the year are the same shares
- **AND** the measured share of the delivery term is the same share to within a fraction of a percent

#### Scenario: The departure from proportionality is recorded rather than assumed small
- **WHEN** the money and the measured share are compared across a whole multiple of the land
- **THEN** how far each falls from the exact multiple is recorded
- **AND** it is far below the difference between the configurations a student chooses between

#### Scenario: A tolerance is not breached by growth alone
- **WHEN** a configuration whose delivery is accepted at the opening orchard brings in the crop of the largest orchard the farm can reach, in the same year
- **THEN** its delivery is accepted there too

#### Scenario: Growth is never presented as a change in performance
- **WHEN** the orchard is offered, bought, or reported anywhere
- **THEN** nothing presented describes growing it as changing an error, an accuracy, a risk, a variance or a model's performance

### Requirement: The orchard is presented as what it is and what it could be

The orchard SHALL be shown on every screen of an opened farm, as the land held, the land it
could reach, and the name the farm declares for a unit of it. The land it could reach SHALL
be the declared opening plus everything the catalog could still sell towards it. WHEN no
catalog is loaded, the land held SHALL be shown alone rather than against a limit invented
for it.

Every word of this SHALL come from declarations — the orchard's own name and its unit's
name — so that a farm whose land is measured in something other than trees presents through
the same screens unchanged.

#### Scenario: The orchard is on every screen
- **WHEN** a student moves from the overview through the market and a run to a report
- **THEN** the land held and the land it could reach are shown on each of those screens

#### Scenario: The figures follow a purchase
- **WHEN** growth is bought
- **THEN** the land shown rises by what was bought
- **AND** the land it could reach is unchanged

#### Scenario: A farm with no catalog shows no invented limit
- **WHEN** an opened farm has no catalog
- **THEN** the land held is shown
- **AND** no maximum is shown

#### Scenario: The vocabulary is the farm's
- **WHEN** the orchard is presented
- **THEN** the name of the orchard and the name of a unit of land are the declared ones
- **AND** no screen names a unit of land of its own

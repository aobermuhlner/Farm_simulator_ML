## Purpose

What a year's harvest is: the crop the farm bears that year — its size, the composition
drawn for that year, and the photographs that stand for it — and what the crop is worth
once the payoff table has been summed and the declared delivery term applied over the
whole batch. One crop per task per year, whatever labour brings it in.

## Requirements


### Requirement: A year's crop belongs to the farm, and every labour brings in the same one

A task's crop for a year SHALL be drawn once and SHALL be the crop that whatever occupies
that task's labour slot is applied to. A model at work SHALL be scored over that crop
rather than over the task's pool, and the manual labour SHALL be presented as much of that
same crop as the task declares one person reaches. No labour SHALL be scored against
anything other than the year's crop.

The crop SHALL be a deterministic function of the farm's identity and the year, so a
student who leaves and returns is given the same crop, and no crop can be redrawn by
abandoning the year it belongs to.

#### Scenario: The labour does not change the apples
- **WHEN** the same farm's same year is brought in by a model, and the same year is brought in by hand
- **THEN** both are applied to the same crop, of the same size and the same composition

#### Scenario: A model is no longer scored over the pool
- **WHEN** a task at work by a model is brought in for a year
- **THEN** the images scored are the year's crop
- **AND** the count of images scored is the size of the crop rather than the size of the task's pool

#### Scenario: Leaving and returning finds the same year
- **WHEN** a year is run, abandoned before it closes, and run again
- **THEN** the crop is the same crop, of the same size and composition

#### Scenario: A new year is a new crop
- **WHEN** the farm advances a year
- **THEN** that year's crop is drawn again rather than repeated from the previous year

#### Scenario: Two farms do not share a crop
- **WHEN** two farms with different identities are at the same year
- **THEN** their crops for that year differ

### Requirement: The crop's size follows the orchard


The number of apples in a year's crop SHALL be read from the state of the farm, opening at
the size the farm's declared orchard bears and growing as that orchard does, so that the
crop harvested is the crop the farm actually bears. A farm recording no usable size SHALL
refuse to draw a crop, naming the size it found.

The farm no longer declares a crop size for the crop to open at. It declares land and what
a unit of land bears, and the opening size is their product — so the sentence "the crop
harvested is the crop the farm actually bears" is now true by construction rather than by
two declared figures agreeing.

#### Scenario: A bigger orchard is a bigger crop
- **WHEN** the farm's orchard grows between one year and the next
- **THEN** the later year's crop holds more apples

#### Scenario: The opening crop is what the declared orchard bears
- **WHEN** a farm is opened and its first crop is drawn
- **THEN** the crop holds the declared opening land times the declared yield per unit of land
- **AND** no separately declared crop size was consulted

#### Scenario: An unusable size refuses rather than assumes
- **WHEN** the farm records no usable crop size
- **THEN** no crop is drawn and the refusal names the size that was found

### Requirement: Some years are wormier than others, within a declared range

The farm SHALL declare the composition its crop is made of by category. It MAY additionally
declare, for one or more of those categories, a range the category's share varies within
from year to year. The share drawn for a category that declares a range SHALL come from
that range; the categories that declare none SHALL keep their declared proportions to one
another and absorb the remainder, so the year's shares sum to the whole crop. Shares SHALL
be allocated to whole apples that sum to the crop's size.

The draw SHALL be deterministic in the farm's identity and the year. A year's drawn
composition SHALL be recorded with that year's harvest.

A declared range SHALL contain that category's declared share, SHALL lie strictly between
zero and one, and its upper bound SHALL leave room for every other declared category to
hold at least one apple. A range failing any of these SHALL be refused with the category
named, and the farm SHALL NOT open.

Year-to-year variation SHALL NOT be presented as noise, error or sampling variation. It
SHALL be presented as the condition of that year, in the vocabulary the task declares for
its categories.

#### Scenario: A wet year holds more worms
- **WHEN** two years of one farm draw different shares for a category that declares a range
- **THEN** the year drawing the larger share holds more apples of that category
- **AND** the categories declaring no range hold proportionally fewer

#### Scenario: The shares still sum to the crop
- **WHEN** a year's composition is drawn
- **THEN** the per-category counts sum to exactly the crop's size

#### Scenario: The same year draws the same weather
- **WHEN** one farm's same year is drawn twice
- **THEN** the composition drawn is identical

#### Scenario: A category with no declared range still varies with the others
- **WHEN** the share drawn for a varying category is larger than its declared share
- **THEN** each category declaring no range holds a smaller share than it declares
- **AND** the ratio between those categories is the ratio their declared shares have

#### Scenario: A range that excludes the declared share is refused
- **WHEN** the farm declares a range for a category that does not contain that category's declared share
- **THEN** the refusal names that category and the farm does not open

#### Scenario: A range that leaves no room for another category is refused
- **WHEN** a declared upper bound leaves some other declared category unable to hold one apple
- **THEN** the refusal names the category whose range is at fault

### Requirement: A crop too small for its shares holds every category, and is not reported as its shares

A crop SHALL hold at least one apple of every declared category, and that rule SHALL take
precedence over the declared shares. WHEN a crop is small enough that honouring it moves a
category's count away from the share it was drawn at, the count SHALL be the one that holds
every category, and the declared composition SHALL NOT be presented anywhere as the composition
that crop drew.

A farm may open on an orchard small enough for this to be the ordinary case rather than an edge
of one. At a crop of five apples and a declared composition of 55 / 35 / 10, the shares yield
three, two and none; a whole apple is then taken from the largest to give the smallest one, and
the crop is two, two and one in every year the farm ever draws. This is kept on purpose — the
first crop a student meets contains all three kinds of apple, which is the first thing they need
to see — but it is a crop the declaration does not describe, and a screen that prints the
declared shares beside it would be stating something untrue at exactly the moment a student is
learning to trust the numbers.

The drawn counts SHALL therefore be what is recorded with that year's harvest and what is
reported for it, at every crop size. A declared range for a category SHALL be applied to such a
crop as it is applied to any other, and SHALL NOT be presented as varying anything it did not
move: WHEN the whole of a declared range yields the same counts, those counts SHALL be
presented as that year's crop with nothing claimed about variation, error or sampling.

#### Scenario: Five apples hold all three kinds
- **WHEN** a crop of five apples is drawn at a declared composition of 55 / 35 / 10
- **THEN** every declared category holds at least one apple
- **AND** the counts are two, two and one

#### Scenario: The declared shares are not presented as what was drawn
- **WHEN** a crop whose counts differ from the declared shares by more than whole-apple rounding is reported
- **THEN** the counts reported are the drawn ones
- **AND** the declared composition is not presented as that crop's composition

#### Scenario: A range that cannot move a crop this small claims nothing
- **WHEN** two years of one farm draw a crop small enough that the whole of a category's declared range yields the same counts
- **THEN** both years report those counts as their crop
- **AND** nothing presents the two years as differing, or as noise, error or sampling variation

#### Scenario: A larger crop is unaffected
- **WHEN** a crop large enough to express its declared shares as whole apples is drawn
- **THEN** its counts follow the shares drawn for that year
- **AND** no apple is moved between categories to hold one of each

### Requirement: A crop larger than its pool repeats photographs and says so

Photographs for a crop SHALL be taken from the evaluation split of the task's pool, matched
to the category each apple of the crop is. Every declared category SHALL be represented in
the crop at least once.

WHEN a category needs more apples than the split holds photographs of, photographs of that
category SHALL recur within the crop. No photograph SHALL recur while a photograph of that
category has not yet been used, so the crop covers the whole split before it repeats
anything.

WHEN any photograph recurs in a crop, that SHALL be stated wherever that harvest is
reported, together with how many photographs the split holds. WHEN none recurs, nothing
SHALL be stated. A crop is a mechanism rather than a claim about machine learning, and a
mechanism a student could discover by reading the source is one the screen states first.

#### Scenario: A crop eight times its pool is still drawn
- **WHEN** a crop of six thousand apples is drawn against a split holding one thousand photographs
- **THEN** the crop holds six thousand apples
- **AND** its per-category counts are the year's drawn composition

#### Scenario: The whole split is used before anything repeats
- **WHEN** a crop needs more apples of a category than the split holds photographs of
- **THEN** every photograph of that category appears in the crop
- **AND** no photograph appears a third time while another appears once

#### Scenario: Repetition is disclosed
- **WHEN** a harvest is reported for a crop in which photographs recurred
- **THEN** the report states that photographs recur and how many the split holds

#### Scenario: A crop within its pool's means discloses nothing
- **WHEN** a crop no larger than the split's photographs of every category is reported
- **THEN** nothing about recurring photographs is stated

#### Scenario: Every category reaches the crop
- **WHEN** a crop is drawn
- **THEN** each declared category is represented in it at least once

### Requirement: A delivery is its gross less a declared delivery term

The gross of a harvest SHALL be the sum, over every apple of the crop, of the payoff table
entry for that apple's true category and the action chosen for it.

A task MAY declare a delivery term. A declared term SHALL name the categories it measures,
the actions that count as delivering, a tolerance, and the per-item value a downgraded
delivery is paid at instead. The measured share SHALL be the count of apples of a measured
category given a delivering action, divided by the count of apples given a delivering
action.

WHEN the measured share reaches the tolerance, the apples given a delivering action SHALL
be paid the declared downgraded value each in place of their payoff entries, and the apples
given any other action SHALL keep their payoff entries. WHEN it does not, or when no term
is declared, the harvest SHALL pay its gross. WHEN nothing was delivered at all, the share
SHALL be undefined and no downgrade SHALL apply.

A task declaring no delivery term SHALL be valued exactly as it is today, so adding the
concept changes nothing for a task that does not use it.

#### Scenario: A delivery inside the tolerance pays its gross
- **WHEN** a harvest's measured share is below the declared tolerance
- **THEN** the harvest pays its gross
- **AND** no downgrade is applied

#### Scenario: A delivery at the tolerance is downgraded whole
- **WHEN** a harvest's measured share reaches the declared tolerance
- **THEN** every apple given a delivering action pays the declared downgraded value
- **AND** the apples given any other action pay their payoff entries

#### Scenario: One rare category decides the value of everything delivered
- **WHEN** two harvests differ only in how many apples of a measured category were given a delivering action, one side of the tolerance each
- **THEN** their values differ by far more than the payoff entries of those apples differ

#### Scenario: Discarding everything is not an optimum
- **WHEN** every apple of a crop is given a non-delivering action
- **THEN** no downgrade applies
- **AND** the harvest pays only what those actions' payoff entries pay, which is less than a delivery inside the tolerance pays

#### Scenario: A task with no delivery term is unaffected
- **WHEN** a task declaring no delivery term is harvested
- **THEN** the harvest pays the sum of its payoff entries
- **AND** no share is measured and no downgrade is reported

#### Scenario: Nothing delivered is not a breach
- **WHEN** no apple of a crop was given a delivering action
- **THEN** no share is reported and no downgrade is applied

### Requirement: The warning comes before the punishment, always

A declared delivery term SHALL declare a warning share below its tolerance. WHEN the
measured share reaches the warning share but not the tolerance, the harvest SHALL record
that it warned, together with the measured share and the tolerance it was measured against.

A term whose warning share is not strictly below its tolerance, or whose tolerance is not
strictly above zero, SHALL be refused with the field named — a tolerance of zero would
downgrade a faultless delivery, and a warning at the tolerance would never be seen before
the downgrade it exists to precede.

#### Scenario: A near miss is recorded as a warning
- **WHEN** a harvest's measured share reaches the warning share but stays below the tolerance
- **THEN** the harvest records that it warned, with the measured share and the tolerance
- **AND** it still pays its gross

#### Scenario: A comfortable delivery does not warn
- **WHEN** a harvest's measured share is below the warning share
- **THEN** nothing is recorded as a warning

#### Scenario: A warning that could never precede anything is refused
- **WHEN** a delivery term declares a warning share at or above its tolerance
- **THEN** the task is refused with the field named and does not run

#### Scenario: A tolerance of zero is refused
- **WHEN** a delivery term declares a tolerance of zero
- **THEN** the task is refused with the field named and does not run

### Requirement: No year the farm can draw crosses the tolerance by itself

For every configuration the farm can select and every composition the declared ranges
permit, the measured share SHALL fall on the same side of the tolerance. A year SHALL NOT
be the difference between a delivery accepted and a delivery downgraded.

A downgrade is reserved for a crop that has *changed* — a cultivar a model was never fitted
to — because that is a true claim about machine learning, and because a downgrade a student
could not have prevented by any decision available to them teaches only that the game is
arbitrary.

#### Scenario: The wettest year and the mildest agree
- **WHEN** every selectable configuration is scored over the wettest composition the declared ranges permit, and over the mildest
- **THEN** each configuration's measured share falls on the same side of the tolerance in both

#### Scenario: A weather range that could breach the tolerance is a defect
- **WHEN** some selectable configuration's measured share reaches the tolerance under some composition the declared ranges permit
- **THEN** the declared ranges or the tolerance are wrong and are corrected before shipping

### Requirement: The draw varies less than the models do

With a year's composition held, the spread of one configuration's earnings across the
photographs that could be drawn for it SHALL stay visibly smaller than the difference
between the best-earning and worst-earning configurations the farm can select in that same
year. Within any one year, the best-earning selectable configuration SHALL earn more than
the worst-earning one.

Which photographs were drawn is not something a student can see or act on, so it must not
be what decides their year. The composition drawn for the year is held to no such bound: it
is named on screen, in the task's own vocabulary, so a harvest that earned less than last
year's can be attributed to the year rather than mistaken for the model changing under the
student.

#### Scenario: Two draws of one year rank the configurations the same way
- **WHEN** one configuration is scored over many draws of one year's composition
- **THEN** the spread of its earnings is smaller than its distance from the other selectable configurations in that year

#### Scenario: A better model earns more in the year it is used
- **WHEN** every selectable configuration is scored over one year's crop
- **THEN** the best-earning one earns more than the worst-earning one

#### Scenario: A leaner year is attributable
- **WHEN** a harvest earns less than the previous year's under an unchanged configuration
- **THEN** the composition drawn for each year is recorded and reported
- **AND** nothing presents the difference as error, noise or variance

### Requirement: A harvest records enough to explain itself

A recorded harvest SHALL carry, for the year it belongs to: the size of the crop, the
composition drawn for it, the count of apples per true category and chosen action, the
gross, the measured share and the tolerance it was measured against when a term is
declared, whether the delivery was downgraded, the amount the downgrade cost, whether it
warned, whether photographs recurred, and what the harvest finally paid.

What a harvest paid SHALL be recoverable without re-deriving it from the crop, so a closed
year can be shown after the fact from what was recorded.

#### Scenario: A closed year explains its own number
- **WHEN** a closed year's harvest is read back
- **THEN** the gross, the downgrade if any, and what it paid are all recoverable
- **AND** the gross less the downgrade equals what it paid

#### Scenario: The arithmetic is recorded, not recomputed
- **WHEN** a closed year's harvest is read back after the farm has advanced several years
- **THEN** its figures are the figures it closed with
- **AND** nothing is re-derived from the current state of the farm

#### Scenario: A harvest with no term records no share
- **WHEN** a task declaring no delivery term records a harvest
- **THEN** no measured share, tolerance or downgrade appears on the record

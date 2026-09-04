## Purpose

Defines the harvest a student brings in with their own eyes while no robot works the orchard:
which apples they are shown, what their decisions are measured against, what the crop pays,
what happens to the apples they cannot get through, and what is deliberately not kept.

## ADDED Requirements

### Requirement: Hand sorting is the labour whenever no robot works the orchard

Hand sorting SHALL be how a crop is brought in whenever no robot is working the orchard, and
SHALL NOT be offered for a crop a robot is working. The labour follows what the farm has put
to work: a farm that owns no robot sorts by hand every year, and a farm whose robot is taken
off the orchard sorts by hand again.

A crop SHALL be brought in once. A year already harvested SHALL NOT be sorted again for pay.

#### Scenario: No robot, so the student sorts
- **WHEN** a farm with no robot working the orchard reaches its harvest
- **THEN** hand sorting is how that harvest is brought in

#### Scenario: It is the labour again the following year
- **WHEN** that farm advances a year and still has no robot working the orchard
- **THEN** it sorts by hand again

#### Scenario: A robot replaces the hands
- **WHEN** a robot is working the orchard
- **THEN** hand sorting is not offered for that crop

#### Scenario: A robot taken off the orchard hands the job back
- **WHEN** a farm that had a robot working the orchard no longer has one
- **THEN** hand sorting is how the next harvest is brought in

#### Scenario: A year is harvested once
- **WHEN** a year's harvest has already been brought in
- **THEN** sorting that year by hand credits nothing further

### Requirement: The apples presented are the crop, up to what one person can sort

Hand sorting SHALL present the apples of the year's crop itself rather than a sample standing
in for them. WHEN the crop is no larger than the declared number of apples one person can sort
in a harvest, every apple of it SHALL be presented, and the wage SHALL be paid over exactly the
decisions made. WHEN the crop is larger, that declared number SHALL be presented and the
remainder SHALL go unsorted: unsorted apples SHALL earn nothing, and their count SHALL be
stated on screen.

No part of the crop SHALL be paid for on the strength of decisions made about other apples.
This is what makes hand sorting stop being worth doing as the orchard grows: it is bounded by
one person while the crop is not, so a growing share of the harvest is left on the ground.

#### Scenario: A small crop is sorted entire
- **WHEN** the crop is smaller than the declared number one person can sort
- **THEN** every apple of the crop is presented
- **AND** nothing is reported as unsorted

#### Scenario: A large crop is sorted as far as one person gets
- **WHEN** the crop is larger than the declared number one person can sort
- **THEN** that declared number of apples is presented
- **AND** the count of apples left unsorted is stated

#### Scenario: Nothing is estimated for the apples that were not seen
- **WHEN** part of the crop goes unsorted
- **THEN** those apples earn nothing
- **AND** no wage is attributed to any apple no decision was made about

#### Scenario: Growing past what one person can sort does not raise the wage
- **WHEN** two crops of different sizes, both beyond that declared number, are sorted with identical decisions
- **THEN** both pay the same wage

### Requirement: The crop follows the orchard, and is drawn from its declared composition

The number of apples in a year's crop SHALL be read from the state of the farm, opening at the
size the farm declares and growing as the orchard does, so that the crop a student sorts is
the crop the farm actually bears. The category of each apple SHALL follow the
crop's declared category composition rather than the composition of the pool the pictures come
from, allocated to whole apples so that the categories sum to the crop.

Pictures SHALL be taken from the evaluation split of the task's pool, no image SHALL appear
twice in one crop, and every declared category SHALL be represented at least once.

The crop SHALL be a deterministic function of the farm's identity and the year, so a student
who leaves and returns is shown the same apples in the same order, and no crop can be redrawn
by abandoning it.

#### Scenario: A bigger orchard is more apples to sort
- **WHEN** the farm's orchard grows between one year and the next
- **THEN** the crop presented for the later year holds more apples

#### Scenario: The mix on screen is the crop's mix
- **WHEN** a crop is drawn for a composition that differs from the evaluation split's
- **THEN** each category's share of the apples follows the crop's declared composition
- **AND** it does not follow that category's share of the evaluation split

#### Scenario: Every category is on screen at least once
- **WHEN** a crop is drawn
- **THEN** each declared category appears at least once

#### Scenario: No apple is shown twice
- **WHEN** a crop is drawn
- **THEN** every apple in it is a distinct image of the evaluation split

#### Scenario: Leaving and returning presents the same crop
- **WHEN** a student abandons a sort part-way and enters hand sorting again in the same year
- **THEN** the same apples are presented in the same order

#### Scenario: A new year draws a new crop
- **WHEN** the farm advances a year
- **THEN** that year's apples are drawn again rather than repeated from the previous year

### Requirement: One apple at a time, with nothing on screen but its picture

The screen SHALL present one image at a time together with the task's declared actions, and
SHALL NOT reveal anything about that image beyond its picture: not its category, not its
declared label, not any generation attribute the manifest records, and not any statistic
derived from one. It SHALL NOT report whether a decision was right until the crop is sorted.

How far through the crop the student is, and how many times they have chosen each action so
far, MAY be shown — both are facts about their own choices rather than about the apples.

#### Scenario: An apple arrives unlabelled
- **WHEN** an apple is presented for a decision
- **THEN** neither its category nor its declared label appears on screen

#### Scenario: A student sees apples, not parameters
- **WHEN** an apple is presented
- **THEN** no attribute value for that image appears on screen

#### Scenario: No running score
- **WHEN** a decision is made and the next apple is presented
- **THEN** nothing on screen states whether the previous decision was correct

#### Scenario: Progress and the student's own tallies are shown
- **WHEN** apples have been sorted
- **THEN** the position in the crop and the count of each action chosen so far are displayed

### Requirement: Every declared action is reachable by pointer and by key

The screen SHALL offer every action the task declares, labelled with that action's declared
label, in the declared action order. Each action SHALL be choosable with a pointer and with a
distinct key assigned by declared order, and that key SHALL be displayed on its control. WHEN
the declared action set is small enough for each action to carry a distinct directional
gesture, each action SHALL additionally be choosable by that gesture.

#### Scenario: A control per declared action
- **WHEN** the screen renders a task declaring three actions
- **THEN** three controls are offered, carrying those actions' declared labels in the declared order

#### Scenario: Keys follow declared order and are shown
- **WHEN** the controls are rendered
- **THEN** each carries a distinct key binding assigned from the declared action order
- **AND** that binding is displayed on the control

#### Scenario: Pointer and keyboard are each complete
- **WHEN** a task declares more actions than there are distinct gestures
- **THEN** every declared action is still choosable by pointer and by key

### Requirement: A decision is measured against the action the task maps its category to

A decision SHALL be counted correct when the chosen action is the action the task's declared
category-to-action mapping gives for that image's true category, and incorrect otherwise. The
true category SHALL be read from the pool manifest and from nowhere else. No other notion of
a correct answer SHALL be introduced.

#### Scenario: The declared mapping decides
- **WHEN** a student chooses the action the task maps the image's true category to
- **THEN** the decision is counted correct

#### Scenario: A wrong answer is recorded as the answer it was
- **WHEN** a student chooses an action the mapping gives for a different category
- **THEN** the decision is counted incorrect
- **AND** it is recorded against the action actually chosen rather than merged with the other mistakes

#### Scenario: Ground truth comes from the manifest
- **WHEN** a decision is scored
- **THEN** the category it is scored against is the one the manifest declares for that image

### Requirement: The summary breaks the harvest down per category and action

The summary SHALL report a count for every combination of declared true category and declared
action across the apples sorted, alongside the number of decisions that were correct. A single
accuracy figure SHALL NOT be the only outcome reported.

#### Scenario: Every combination is present
- **WHEN** a hand-sorted harvest of a task with three categories and three actions is summarised
- **THEN** all nine category-and-action counts are displayed, including those with a count of zero

#### Scenario: The headline is not alone
- **WHEN** the summary is shown
- **THEN** the count correct is displayed alongside the per-combination breakdown rather than instead of it

### Requirement: The wage is the declared payoff table over the apples actually sorted

The wage SHALL be the sum, over every apple the student decided, of the declared payoff entry
for that apple's true category and the action chosen for it. The summary SHALL also state what
the same apples would have paid had each been given the action its category maps to. No bonus,
penalty or modifier the declaration does not contain SHALL be introduced here.

#### Scenario: Mistakes are priced by kind
- **WHEN** two students make the same number of correct decisions but distribute their mistakes across different actions
- **THEN** their wages differ according to the declared payoff entries for those mistakes

#### Scenario: Perfect play is shown for comparison
- **WHEN** the summary is shown
- **THEN** the wage those same apples would have paid under a faultless sort is displayed alongside the wage earned

#### Scenario: Nothing is added to the declared payoffs
- **WHEN** a payoff entry in the task declaration is changed
- **THEN** the wage for the same decisions changes accordingly
- **AND** no term the declaration does not contain contributes to it

### Requirement: The wage depends on the decisions, never on their speed

How long a student takes SHALL NOT affect the wage. Time SHALL be measured and reported for
the throughput argument alone.

#### Scenario: Two paces, one wage
- **WHEN** two students make identical decisions over the same crop at different speeds
- **THEN** they are paid the same wage

### Requirement: The throughput arithmetic is stated

The summary SHALL state how long the sort took, how many apples a minute that is, and how long
the whole crop would take at that rate — including the part that went unsorted. The time
attributed to any one apple SHALL be capped at a declared maximum, so a screen left standing
does not distort the rate.

#### Scenario: The arithmetic is shown, not implied
- **WHEN** the summary is shown
- **THEN** the elapsed time, the rate per minute and the time the whole crop would take at that rate are all displayed

#### Scenario: The unsorted remainder is priced in time
- **WHEN** part of the crop went unsorted
- **THEN** the projected time covers the whole crop rather than only the apples decided

#### Scenario: An abandoned screen does not distort the rate
- **WHEN** one apple is left on screen for longer than the declared per-apple maximum
- **THEN** the time counted for that apple is that maximum
- **AND** the reported rate reflects the capped time

### Requirement: A completed sort is that year's harvest and pays once

Completing the apples presented SHALL record a harvest: the wage is settled against the
balance, one record is appended for the year that closed, and the year advances — the one
indivisible step the economy defines for a harvest, used here exactly as an automated harvest
will use it. An abandoned sort SHALL settle nothing and append nothing. Re-entering hand
sorting for a year already harvested SHALL present that year's outcome rather than a new crop.

#### Scenario: Paid once
- **WHEN** every apple presented has been decided
- **THEN** a harvest is recorded for that year with the wage as what it paid
- **AND** exactly one ledger record is appended and the year advances

#### Scenario: Re-entering does not pay again
- **WHEN** hand sorting is entered again for a year whose harvest has already been credited
- **THEN** that year's outcome is shown
- **AND** no further credit is made

#### Scenario: An abandoned sort pays nothing
- **WHEN** a student leaves before the last apple presented is decided
- **THEN** the balance is unchanged, no ledger record is appended, and the year does not advance

### Requirement: The sort produces no labels

The student's per-image decisions SHALL NOT be persisted, exported, or used as labels for
fitting or evaluating any model, and SHALL NOT be added to any dataset. Only the aggregates
the summary reports SHALL survive the sort.

#### Scenario: Decisions do not become data
- **WHEN** a harvest is sorted by hand
- **THEN** no per-image decision is written to any dataset, artifact or saved state

#### Scenario: Only aggregates survive
- **WHEN** the year's record is inspected after a hand-sorted harvest
- **THEN** it holds the wage, the counts and the measured rate, and no per-image decision

### Requirement: Mistakes are reviewable after payment, never during

Once the wage is shown, the images the student decided incorrectly SHALL be reviewable, each
with the declared label of its true category and the action that category maps to. The review
SHALL NOT display any generation attribute. No such review SHALL be reachable while apples are
still being sorted.

#### Scenario: The mistakes are shown with their declared labels
- **WHEN** the student reviews their mistakes after the summary
- **THEN** each image is shown with its category's declared label and the declared action that category maps to

#### Scenario: The review reveals no parameters
- **WHEN** an image is reviewed
- **THEN** no attribute value for it appears on screen

#### Scenario: No review mid-sort
- **WHEN** a sort is part-way through
- **THEN** no review of already-decided apples is reachable

### Requirement: The price of automating the job is stated against the wage

WHEN the farm declares a purchase that puts a robot on the orchard, the summary SHALL state
that purchase's declared price alongside the wage, so the throughput argument arrives with its
price attached. WHEN no such purchase is declared, the summary SHALL omit the comparison rather
than naming a price of its own, and SHALL NOT name the purchase in screen code.

#### Scenario: The price is shown when one is declared
- **WHEN** the farm declares a purchase that puts a robot on the orchard
- **THEN** the summary displays its declared price alongside the wage

#### Scenario: Nothing declared, nothing claimed
- **WHEN** the farm declares no such purchase
- **THEN** the summary omits the comparison
- **AND** no price appears that the declaration does not carry

### Requirement: A crop that cannot be presented refuses with its cause

WHEN the crop cannot be drawn — the pool is unreachable, mismatched with the task or
structurally invalid; the evaluation split holds too few images of a declared category; the
crop is too small to hold one apple of every declared category; or no crop size or composition
is declared — hand sorting SHALL present the refusal with the cause, and SHALL NOT present a
partial crop, a blank apple, or any wage.

#### Scenario: An unreachable pool is explained
- **WHEN** the pool manifest cannot be fetched
- **THEN** the refusal is shown naming the cause
- **AND** no apple and no wage are shown

#### Scenario: A crop too small to hold every category is refused
- **WHEN** the crop holds fewer apples than the task declares categories
- **THEN** the refusal names the category that would be absent
- **AND** no apple is presented

#### Scenario: A missing crop composition is refused rather than assumed
- **WHEN** no category composition is declared for the crop
- **THEN** the refusal says so
- **AND** the evaluation split's own composition is not substituted for it

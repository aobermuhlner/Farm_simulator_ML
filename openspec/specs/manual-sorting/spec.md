# manual-sorting Specification

## Purpose
Defines the harvest a student brings in with their own eyes while no robot works the orchard:
which apples they are shown, what their decisions are measured against, what the crop pays,
what happens to the apples they cannot get through, and what is deliberately not kept.

## Requirements

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

### Requirement: The apples presented are the crop, entire, up to the photographs there are

Hand sorting SHALL present the apples of the year's crop itself rather than a sample standing
in for them, and SHALL present all of them. No declared number SHALL bound how many apples a
person may be offered, and no apple of the crop SHALL be withheld from a student still willing
to decide it.

The apples presented SHALL be distinct photographs, no matter how often a photograph recurs in
the crop as a whole. A person is asked to judge each apple on its picture, and the same picture
returning is a different question — whether they remember what they answered — so the part of
the crop a person is shown is drawn from photographs not yet used.

That is the one bound on hand sorting, and it is a real one. WHEN the crop needs more distinct
photographs of some category than the evaluation split holds of it, the apples presented SHALL
be as much of the crop as keeps that crop's own composition — bounded by whichever category runs
out of photographs first — and everything beyond that SHALL be counted among the apples the
student did not decide. Hand sorting therefore stops growing with the orchard once the split is
exhausted, however patient the student is, and it stops because there are no more pictures
rather than because a number said so.

What is presented SHALL keep the crop's composition at every size, and SHALL NOT be filled out
with whichever categories happen to have photographs left. A student sorting by hand is being
compared against a robot sorting the same orchard, and a hand-sorted portion richer in one
category than the crop it stands for would make that comparison a different task rather than a
smaller one.

#### Scenario: The whole crop is offered
- **WHEN** a crop is presented for hand sorting whose every category the split can supply distinctly
- **THEN** every apple of it is reachable in turn
- **AND** no declared number limits how many may be decided

#### Scenario: No picture is shown twice to a person
- **WHEN** a crop in which photographs recur is presented for hand sorting
- **THEN** every apple presented is a distinct photograph

#### Scenario: The split is what hand sorting runs out of
- **WHEN** a crop needs more distinct photographs of some category than the evaluation split holds of it
- **THEN** the apples presented stop at what that category can supply, keeping the crop's composition
- **AND** the rest of the crop is counted among the apples left undecided

#### Scenario: A short category does not make the portion a different crop
- **WHEN** one category runs out of photographs before the others
- **THEN** the apples presented hold each category in the crop's own proportions
- **AND** no category is over-represented because photographs of it remained

#### Scenario: Growing past the split does not raise what one person can bring in
- **WHEN** two crops of different sizes but the same composition, both beyond what the split can supply, are sorted with identical decisions
- **THEN** both pay the same wage

### Requirement: The student decides when the sorting stops

Once at least one apple has been decided, the screen SHALL offer to deliver what has been
decided so far and discard the rest. Choosing it SHALL be confirmed before anything is settled,
naming what will be delivered and how many apples will be discarded, and abandoning that
confirmation SHALL return the student to the apple they were on with nothing changed.

Delivering SHALL settle the wage over exactly the apples decided, on the same terms a completed
sort settles, and the apples not decided SHALL be discarded: they SHALL earn nothing, and they
SHALL NOT be returned to, re-offered, or carried into another year.

Before the first decision the offer SHALL NOT be present, so that no year is closed for nothing
and no harvest is recorded that no apple was sorted for. Leaving the screen without delivering
SHALL remain an abandoned sort, settling nothing.

#### Scenario: Delivering part of a crop pays for that part
- **WHEN** a student decides some of a crop and delivers
- **THEN** the wage is the payoff sum over the apples decided
- **AND** the apples not decided earn nothing

#### Scenario: The discarded apples do not come back
- **WHEN** a student has delivered part of a crop
- **THEN** the apples not decided are not offered again in that year or any other

#### Scenario: Stopping is confirmed first
- **WHEN** the student chooses to deliver
- **THEN** what will be delivered and how many apples will be discarded are named before anything is settled

#### Scenario: Abandoning the confirmation changes nothing
- **WHEN** the student abandons the confirmation
- **THEN** the sort continues from the apple they were on
- **AND** the balance, the year and the apples decided are unchanged

#### Scenario: Nothing is offered before the first decision
- **WHEN** no apple of the crop has been decided
- **THEN** no offer to deliver is present

### Requirement: The cost of stopping is stated before the choice is made

WHEN the offer to deliver is present, the screen SHALL state what the student is choosing
between: what the apples decided so far would pay, how many apples would be discarded, about
what those apples are worth, and how long they would take at the rate this student has been
sorting at. The time SHALL use the same capped per-apple measurement the summary uses.

The figure stated for the apples not yet decided SHALL be computed from the farm's declared
composition and the declared payoff for each category's own action — what the orchard bears on
that many apples — and SHALL NOT be computed from the categories those particular apples
actually are. It SHALL be presented as what the orchard bears rather than as what those apples
hold. A figure drawn from the true categories of apples still on screen would answer, in
aggregate, the question the student is being paid to answer one apple at a time.

This is where the argument for automating the job is made, and it is made in the student's own
measured numbers rather than in a claim.

#### Scenario: The trade is shown on both sides
- **WHEN** the offer to deliver is present
- **THEN** the wage so far, the count that would be discarded, about what they are worth and how long they would take at the measured rate are all displayed

#### Scenario: The remainder is priced from the orchard, not from the apples
- **WHEN** two crops with the same number of apples left but different true categories among them are compared
- **THEN** the figure stated for the apples left is the same figure
- **AND** it is presented as what the orchard bears on that many apples

#### Scenario: No running score leaks through the remainder
- **WHEN** the offer to deliver is present
- **THEN** nothing displayed states the category of any apple not yet decided

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

The wage SHALL be the value of what the student delivered: the sum, over every apple the
student decided, of the declared payoff entry for that apple's true category and the action
chosen for it, less whatever the task's declared delivery term takes off that sum. The term
SHALL be measured over the apples the student decided and SHALL apply to a person's crates
exactly as it applies to a robot's — the co-op buys apples, not labour. The summary SHALL
also state what the same apples would have paid had each been given the action its category
maps to. No bonus, penalty or modifier the declaration does not contain SHALL be introduced
here.

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

#### Scenario: A person's crates face the same co-op
- **WHEN** a student's decisions put a share of a measured category into delivering actions that reaches the declared tolerance
- **THEN** the wage is downgraded on the same terms a robot's delivery would be
- **AND** the summary states the measured share and the tolerance

#### Scenario: A careful sort is not downgraded
- **WHEN** a student's decisions keep the measured share below the declared tolerance
- **THEN** the wage is the payoff sum over the apples decided

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

A sort SHALL be completed either by deciding every apple presented or by delivering what has
been decided. Completing a sort SHALL record a harvest: the wage is settled against the
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

#### Scenario: Delivering early closes the year the same way
- **WHEN** a student delivers part of a crop
- **THEN** a harvest is recorded for that year with that wage as what it paid
- **AND** exactly one ledger record is appended and the year advances

#### Scenario: A delivered year cannot be returned to for the rest
- **WHEN** hand sorting is entered again for a year that was delivered early
- **THEN** that year's outcome is shown
- **AND** the apples that were discarded are not offered

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

WHEN the farm declares a purchase that puts a robot on the orchard, its declared price SHALL be
stated both alongside the wage in the summary and alongside the offer to deliver, so the
throughput argument arrives with its price attached at the moment the student is weighing
whether to go on clicking. WHEN no such purchase is declared, both SHALL omit the comparison
rather than naming a price of their own, and SHALL NOT name the purchase in screen code.

#### Scenario: The price is shown when one is declared
- **WHEN** the farm declares a purchase that puts a robot on the orchard
- **THEN** the summary displays its declared price alongside the wage

#### Scenario: Nothing declared, nothing claimed
- **WHEN** the farm declares no such purchase
- **THEN** the summary omits the comparison
- **AND** no price appears that the declaration does not carry

#### Scenario: The price is shown beside the choice to stop
- **WHEN** the offer to deliver is present and the farm declares such a purchase
- **THEN** its declared price is displayed alongside that offer

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

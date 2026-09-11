## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: The apples presented are the crop, up to what one person can sort

**Reason**: The declared number of apples one person may sort made hand sorting a formality
rather than a rung: a crop of six thousand apples offered sixty of them, so the student was paid
over one per cent of a harvest and the remaining ninety-nine per cent were withheld by a
declared figure rather than by anything they could feel. The throughput argument for automating
the job cannot be made by a screen that stopped the student long before they were tired.

**Migration**: Replaced by *The apples presented are the crop, entire, up to the photographs
there are*, which offers the whole crop, and *The student decides when the sorting stops*,
which lets the student draw the line the declared number used to draw. The wage arithmetic is
unchanged — it was already the payoff sum over the apples actually decided — and the unsorted
remainder is still stated, now as what the student chose to leave. `handSorting.perHarvest` is
removed from the task declaration; `handSorting.secondsPerImage` is unaffected. The claim that
hand sorting plateaus survives, carried by the evaluation split rather than by a declared cap.

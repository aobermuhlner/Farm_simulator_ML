## MODIFIED Requirements

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

The apples presented SHALL be distinct photographs, no matter how often a photograph recurs
in the crop as a whole. A person is asked to judge each apple on its picture, and the same
picture returning is a different question — whether they remember what they answered — so
the part of the crop a person is shown is drawn from photographs not yet used. This bounds
what one person can be asked to sort at what the pool holds, which is far above what one
person reaches anyway.

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

#### Scenario: No picture is shown twice to a person
- **WHEN** a crop in which photographs recur is presented for hand sorting
- **THEN** every apple presented is a distinct photograph

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

## REMOVED Requirements

### Requirement: The crop follows the orchard, and is drawn from its declared composition

**Reason**: The crop was never about sorting by hand. It is the farm's crop for the year, and
this change makes the model path harvest the same one instead of scoring the whole evaluation
pool. Keeping its definition inside `manual-sorting` would have meant either the automated
harvest depending on the hand-sorting capability, or two definitions of one crop drifting
apart. The requirement moves to `harvest-run`, which owns the crop's size, the composition
drawn for the year, and how photographs are drawn for it.

**Migration**: Every guarantee it made is carried forward by `harvest-run`, except one that is
deliberately narrowed. *A bigger orchard is more apples to sort*, *the mix on screen is the
crop's mix*, *every category is on screen at least once*, *leaving and returning presents the
same crop* and *a new year draws a new crop* are restated there and hold unchanged. *No apple
is shown twice* narrows: it now holds of the apples presented to a person, which is where it
was doing its work, and is restated in *The apples presented are the crop, up to what one
person can sort*. The crop as a whole may repeat a photograph, because a crop of six thousand
apples cannot be drawn from a thousand distinct photographs, and `harvest-run` requires that
recurrence to be stated on screen wherever the harvest is reported.

## ADDED Requirements

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

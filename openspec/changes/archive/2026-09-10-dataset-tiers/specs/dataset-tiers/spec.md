## Purpose

Defines what a bought dataset is — how many photos it holds, of what mix, and how well they
were labelled — how the fitting set of a model is chosen from the tiers its task declares,
and why a tier that files some apples under the wrong category says so on screen instead of
letting a student discover it only in the harvest report.

## ADDED Requirements

### Requirement: A task declares its dataset tiers

A task SHALL declare at least one dataset tier. Each tier SHALL declare a stable id unique
within the task, a student-facing label, the number of training photos it holds, its
composition as a count per category the task declares, its label quality, and the copy that
discloses that quality to a student.

Label quality SHALL be declared as whether the tier files every image under its true
category or files some under another, together with the copy that says so. It SHALL NOT be
inferred from the tier's price, its size, its id, or whether any image currently disagrees.

Tiers SHALL be declared in ascending order of size and no two SHALL declare the same size,
so that "the smaller tier" and "the larger tier" name exactly one tier each wherever this
capability uses them. A task declaring no tier, two tiers sharing an id, or tiers out of
ascending size order SHALL be refused at load naming the defect.

#### Scenario: Tiers are read from the declaration
- **WHEN** a task declaring several dataset tiers is loaded
- **THEN** each declared tier is available by its declared id, label, size, composition and label quality
- **AND** no tier the declaration does not carry is offered

#### Scenario: A task declaring no tier is refused
- **WHEN** a task declaration carries no dataset tier
- **THEN** the declaration is refused naming that omission
- **AND** the task is not loaded

#### Scenario: Duplicate tier ids are refused
- **WHEN** a task declares two dataset tiers with the same id
- **THEN** the declaration is refused naming that id

#### Scenario: Tiers out of ascending size order are refused
- **WHEN** a task declares a tier smaller than one declared before it, or two tiers of the same size
- **THEN** the declaration is refused naming both tiers and their sizes
- **AND** the task is not loaded

### Requirement: A tier is chosen by a declared knob, never by what is owned

Each model family SHALL declare which of its knobs selects the fitting set. That knob SHALL
be an enumerated choice, every one of its values SHALL be the id of a tier the task
declares, and its declared default SHALL be the task's smallest tier. Which tier a model was
fitted on SHALL be a function of that knob's value alone — never of the items owned, the
year reached, the balance held, or which tier is the largest available.

A family declaring no such knob, naming a knob it does not declare, or whose dataset knob
carries a value naming no declared tier, SHALL be refused at load naming the family and the
defect.

#### Scenario: The selected tier is the knob's value
- **WHEN** a configuration is resolved for a family whose dataset knob reads a tier id
- **THEN** the tier it was fitted on is the tier that id names

#### Scenario: Owning more photos changes no model's tier
- **WHEN** a larger tier is bought and a configuration selected before the purchase is resolved again
- **THEN** it is fitted on the tier its dataset knob names, as it was before
- **AND** nothing about the resolved configuration changed

#### Scenario: The dataset knob defaults to the smallest tier
- **WHEN** a family is selected for which progress records no values
- **THEN** its dataset knob sits at the task's smallest declared tier

#### Scenario: A dataset knob naming an undeclared tier is refused
- **WHEN** a family's dataset knob declares a value that is the id of no declared tier
- **THEN** the declaration is refused naming the family, the knob and that value
- **AND** the task is not loaded

#### Scenario: A family declaring no dataset knob is refused
- **WHEN** a family declares no knob as its dataset knob, or names a knob it does not declare
- **THEN** the declaration is refused naming the family and the defect
- **AND** the task is not loaded

### Requirement: A larger tier contains the smaller ones and may relabel them

Every image of a smaller tier SHALL belong to every larger tier of the same task, so that
buying photos adds to the set a student holds and removes nothing from it.

A larger tier MAY file an image under a different label than a smaller tier does. Membership
nests; labels do not. A tier that was checked therefore corrects what a hurried one filed
wrongly, and buying it improves the labels on photos the student already had rather than
leaving two contradictory copies of one image.

#### Scenario: Every image of a smaller tier belongs to the larger
- **WHEN** two tiers of one task are compared
- **THEN** every image the smaller holds is also held by the larger

#### Scenario: A larger tier may correct a smaller tier's label
- **WHEN** an image belongs to two tiers that file it under different labels
- **THEN** both labels stand, each for its own tier
- **AND** neither is refused as a contradiction

### Requirement: Ownership gates which tiers may be selected and gates nothing else

A tier's availability SHALL be decided exactly as any other knob value's is: by the catalog
and the items owned, and by nothing else. A tier that is not available SHALL be shown and
SHALL NOT be offered for selection. Selecting a tier SHALL move no money, append no record
to the ledger and leave the year as it was.

Buying a tier SHALL only add configuration identifiers a student may select. It SHALL NOT
change what any identifier means, what any previously selectable configuration resolves to,
or which tier any of them was fitted on.

#### Scenario: An unowned tier is shown and not selectable
- **WHEN** the workshop presents a dataset knob whose larger tiers are not owned
- **THEN** those tiers are shown with what would open them
- **AND** they cannot be selected

#### Scenario: Buying photos adds identifiers and changes none
- **WHEN** an item opening a tier is bought
- **THEN** the identifiers selectable before it are still selectable and still resolve to the same entries
- **AND** the identifiers the new tier reaches are added to them

#### Scenario: Selecting a tier costs nothing
- **WHEN** a different tier is selected on a family's dataset knob
- **THEN** the balance, the ledger and the year are as they were

### Requirement: A model is fitted against its tier's labels and every outcome is scored against the truth

Fitting SHALL use the label the selected tier files an image under. Every figure reported as
an outcome — earnings, the per-category and per-action breakdown, and anything a harvest
report shows — SHALL be computed against the true category the pool manifest declares, and
SHALL NOT consult a tier label.

A training history's losses SHALL be measured against the labels of the tier the
configuration was fitted on, because those labels are the whole of what the model's owner
has to judge it by. A student whose workshop curves look healthy and whose harvest disagrees
is seeing the cost of cheap labels, which is the lesson; a workshop quietly scored against
truth would hide it.

A tier label SHALL NOT reach the decision policy, the scoring, or any figure presented as an
outcome.

#### Scenario: Fitting uses the tier's labels
- **WHEN** a configuration is fitted on a tier that files some images under another category
- **THEN** the labels it is fitted against are that tier's labels

#### Scenario: A harvest is scored against the manifest's truth
- **WHEN** a run of a model fitted on a mislabelling tier is scored
- **THEN** every earning and every category breakdown is computed against the manifest's true categories
- **AND** no tier label contributes to any of them

#### Scenario: The workshop's curves are measured against the tier's labels
- **WHEN** a configuration's training history is read
- **THEN** its training and validation losses were measured against the labels of the tier it was fitted on

#### Scenario: No tier label reaches a decision
- **WHEN** a distribution is converted into an action
- **THEN** the conversion consults the declared decision policy and the distribution alone
- **AND** no tier label is an input to it

### Requirement: A tier's label quality is disclosed wherever the tier is offered or shown

Wherever a tier is offered for selection, priced in the market, or its images are browsed,
its declared label quality SHALL be stated. A tier that files any image under a category
other than its true one SHALL say so; a tier that files every image correctly SHALL say
that. The words SHALL come from the tier's declaration, and no screen SHALL name a tier, a
size or a label quality of its own.

Disclosure SHALL NOT extend to which images are mislabelled. Naming them would hand over the
thing a student is meant to find by looking.

#### Scenario: A tier with wrong labels says so where it is offered
- **WHEN** a tier declaring that it files some images wrongly is shown in the workshop or the market
- **THEN** its declared disclosure copy is displayed with it

#### Scenario: A checked tier says it was checked
- **WHEN** a tier declaring that every image is filed correctly is shown
- **THEN** its declared disclosure copy is displayed with it

#### Scenario: The disclosure is declared copy
- **WHEN** a tier's label quality is stated on any screen
- **THEN** the words shown are the words its declaration carries
- **AND** no tier id, size or quality is written into screen code

#### Scenario: Which images are wrong is not disclosed
- **WHEN** a mislabelling tier's images are browsed
- **THEN** no image is marked as mislabelled
- **AND** no count of mislabelled images is displayed

### Requirement: A tier's declared size and composition agree with the images the pool assigns it

WHEN the pool holds images for a tier, that tier's declared size SHALL equal the number of
training images the manifest assigns to it, and its declared composition SHALL equal, for
every declared category, the number of those images that tier files under that category. A
disagreement SHALL be refused at load naming the tier, the category where they differ, the
declared figure and the actual one.

A tier the pool holds no images for SHALL be accepted as a declaration, so that a tier can
be shown and explained before it is authored. It becomes unreachable rather than special: no
prediction artifact covers a configuration naming it, and no item that opens it may carry a
price, so the existing untrained and locked refusals already answer for it and no further
kind of refusal is introduced.

#### Scenario: A declared size that does not match its images is refused
- **WHEN** a tier declares a size differing from the number of training images the manifest assigns it
- **THEN** loading is refused naming the tier, the declared size and the actual count

#### Scenario: A declared composition that does not match its labels is refused
- **WHEN** a tier declares a per-category count differing from the images it files under that category
- **THEN** loading is refused naming the tier, that category, the declared count and the actual count

#### Scenario: A tier with no images loads and stays unreachable
- **WHEN** a task declares a tier the pool holds no images for
- **THEN** the declaration is accepted and the tier is shown
- **AND** selecting it is refused as untrained or as locked, and by no new kind of refusal

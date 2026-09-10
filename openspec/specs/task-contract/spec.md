## Purpose

Defines what a lesson must declare in order to be playable, so that new ML lessons are
added to the simulator as data — categories, knobs, payoffs, teaching copy — rather than
as new screens and new scoring code.

## Requirements

### Requirement: Task declaration completeness

A task SHALL declare all of: a stable id, a display title, its ground-truth categories,
the actions available to the automated system, a mapping from each declared category to
the action that category calls for, its decision policy, a reference to its image pool, the
dataset tiers its pool is divided into, the numbers measured from each image's pixels, the
largest hand-written rule it offers, at least one model family, a payoff table, how much of
its job one person can do by hand, its teaching copy, and whether it is available to play.
The system SHALL refuse to present a task whose declaration is missing any of these.

The hyperparameter knobs exposed to the student and the reference to a precomputed
prediction artifact are no longer the task's to declare; they belong to each model family,
because a task offers several families and they share neither. A declaration carrying knobs
or a prediction reference at the task level SHALL be refused, naming where they now belong,
rather than loaded with them ignored.

The dataset tiers are the task's, and which of them a model is fitted on is the family's.
The photos describe the job — they are the same photos whatever is fitted to them — while
choosing among them is a decision a student makes per model, through a knob the family
declares. A declaration carrying tiers inside a family, or a family with no declared dataset
knob, SHALL be refused naming where each belongs.

What the task keeps describes the job rather than the model doing it: what the categories
are, what may be done about them, what that is worth, which pictures it is judged on, which
of those pictures may be bought, what can be measured from them, and how much of it a person
can do unaided. Every family of one task is judged against the same job.

How much of its job one person can do by hand is two figures: how many images a student
is presented with in a single harvest, and the longest a single image may count towards a
measured rate. Every task carries them, so a task that cannot be done by hand is refused
where its author can see it rather than in front of a student.

A task MAY additionally declare a delivery term, which prices its batch as a whole rather
than its images one at a time. The term is optional because a task whose mistakes are all
priced adequately per image needs none, and a task that omits it SHALL behave exactly as
though the concept did not exist.

#### Scenario: Complete declaration is playable
- **WHEN** a task declaration provides every required field and at least one model family
- **THEN** the task appears as selectable and can be configured and run

#### Scenario: Incomplete declaration is rejected
- **WHEN** a task declaration omits a required field
- **THEN** the task is not offered to the student
- **AND** the omission is reported as a configuration error naming the missing field

#### Scenario: A declaration without a delivery term is complete
- **WHEN** a task declaration provides every required field and no delivery term
- **THEN** the task is accepted and playable
- **AND** nothing about a delivery term is reported as missing

#### Scenario: Knobs at the task level are refused
- **WHEN** a task declaration carries hyperparameter knobs outside any model family
- **THEN** the declaration is refused naming that they belong to a family
- **AND** the task is not loaded

#### Scenario: A prediction reference at the task level is refused
- **WHEN** a task declaration carries a reference to a prediction artifact outside any model family
- **THEN** the declaration is refused naming that it belongs to a family
- **AND** the task is not loaded

#### Scenario: A declaration without dataset tiers is refused
- **WHEN** a task declaration carries no dataset tiers
- **THEN** the declaration is refused naming that omission
- **AND** the task is not loaded

#### Scenario: Tiers inside a family are refused
- **WHEN** a model family declares dataset tiers of its own
- **THEN** the declaration is refused naming that they belong to the task
- **AND** the task is not loaded
### Requirement: A declared delivery term names only what the task declares

A declared delivery term SHALL name at least one measured category and at least one
delivering action, and every category and action it names SHALL be one the task declares.
A term naming a category or an action the task does not declare, or naming none of either,
SHALL be refused with the offending name reported, and the task SHALL NOT run.

The delivering actions SHALL NOT be every action the task declares. A term whose
delivering actions leave no action outside them measures a share whose denominator is the
whole crop and can never be escaped, which is a fine that pretends to be a threshold.

At least one measured category SHALL be a category whose declared action lies outside the
delivering actions, so that the term prices a mistake rather than pricing correct work.

#### Scenario: An undeclared category in the term is refused
- **WHEN** a delivery term measures a category the task does not declare
- **THEN** the task is refused and the refusal names that category

#### Scenario: An undeclared action in the term is refused
- **WHEN** a delivery term names a delivering action the task does not declare
- **THEN** the task is refused and the refusal names that action

#### Scenario: A term with no way out is refused
- **WHEN** a delivery term names every declared action as delivering
- **THEN** the task is refused and the refusal names the term's delivering actions

#### Scenario: A term that prices only correct work is refused
- **WHEN** every category a delivery term measures has its declared action among the delivering actions
- **THEN** the task is refused and the refusal names those categories

#### Scenario: A well-formed term is accepted
- **WHEN** a delivery term measures a category whose declared action lies outside its delivering actions, and names only declared categories and actions
- **THEN** the declaration is accepted and the term is applied when the task is harvested

### Requirement: Categories and actions are task-declared

Ground-truth categories and available actions SHALL be declared per task, with at least
two of each. No part of the system outside a task's own declaration and teaching copy
SHALL assume apple-specific category or action names.

#### Scenario: A task with unrelated categories runs on the same engine
- **WHEN** a task declares categories `healthy` and `diseased` and actions `flag` and `pass`
- **THEN** it configures, runs, and scores through the same flow as the apple task
- **AND** no apple-specific vocabulary appears in its screens

### Requirement: Knob declarations drive the configuration screen

Each knob a model family exposes SHALL declare an id, a student-facing label, a kind of
either enumerated choice or continuous slider, its allowed values (a value list for an
enumerated choice, or minimum, maximum and step for a slider), a default value, and help
copy. A knob id SHALL be unique within its family; two families of one task MAY declare
knobs with the same id, since neither is resolved against the other. The workshop SHALL be
rendered from the selected family's knob declarations together with which of their values
are currently available, and from nothing else.

A knob declaration SHALL NOT state its own availability. What is available is decided
outside the task's declaration, so that a declaration reads the same whatever a student
owns, and so that opening a value never edits the file that defines it. A value that is
not available SHALL be shown and SHALL NOT be offered for selection; a knob with no
available value beyond its default SHALL be shown at that default. A knob's declared
default SHALL always be available. The screen SHALL name no unlock condition of its own,
and SHALL name no family of its own.

#### Scenario: Adding a knob requires no screen changes
- **WHEN** a knob is added to a model family's declaration
- **THEN** the workshop offers that knob with its declared label, control kind and default while that family is selected
- **AND** no task-specific or family-specific screen code is required for it to appear

#### Scenario: Out-of-range knob value is rejected
- **WHEN** a configuration requests a knob value outside the knob's declared allowed values
- **THEN** the configuration is rejected as invalid
- **AND** no crop is scored from it

#### Scenario: An unavailable value is shown but not offered
- **WHEN** a knob declares a value that is not currently available
- **THEN** the workshop shows that value
- **AND** it cannot be selected

#### Scenario: A declaration does not change when a value is opened
- **WHEN** a value that was unavailable becomes available
- **THEN** the task declaration is the same file it was
- **AND** the knob's declared values, default and help copy are unchanged

#### Scenario: Two families may share a knob id
- **WHEN** two families of one task each declare a knob with the same id
- **THEN** both declarations are accepted
- **AND** each family's knob is resolved only against that family

#### Scenario: Only the selected family's knobs are presented
- **WHEN** a task declaring several families is presented in the workshop
- **THEN** the knobs shown are those of the selected family
- **AND** no other family's knobs are shown or selectable
### Requirement: Deterministic configuration identity

An ordered set of one family's knob values SHALL map to a deterministic configuration
identifier. The same knob values SHALL always produce the same identifier, independent of
the order in which the student set them, the session, or the machine.

An identifier SHALL also be readable back: together with the family that composed it, it
SHALL name exactly one ordered set of that family's knob values. An identifier SHALL
therefore be resolved only against the family that composed it; the same string composed by
two families of one task SHALL name each family's own configuration and never the other's.
An identifier SHALL NOT be read back against a task without knowing which family composed
it.

To that end, the character an identifier joins its parts with SHALL NOT appear in any knob
id, nor in the written form of any value a knob permits — which excludes a string value
containing it and a numeric value whose written form does, such as a negative number. A
declaration carrying that character in either place SHALL be refused at load, naming the
family, the knob and the offending id or value, rather than loaded into a task whose
identifiers cannot be read back.

A family whose knob declarations are unchanged SHALL compose exactly the identifiers it
composed when its task declared it alone. Declaring further families SHALL NOT add to,
remove from or reorder any identifier.

#### Scenario: Same selection yields the same identifier
- **WHEN** two students independently select identical knob values for the same family of the same task
- **THEN** both configurations resolve to the same configuration identifier

#### Scenario: An identifier names the values it was composed from
- **WHEN** an identifier composed from a family's knob values is read back against that family
- **THEN** it yields exactly the knob values it was composed from

#### Scenario: An identifier is not read back against the wrong family
- **WHEN** an identifier composed by one family is read back against a different family of the same task
- **THEN** it does not resolve to that family's configuration
- **AND** the mismatch is refused rather than resolved

#### Scenario: A separator inside a knob id is refused
- **WHEN** a family declares a knob whose id contains the identifier's separator
- **THEN** the declaration is refused naming that family, that knob and its id
- **AND** the task is not loaded

#### Scenario: A separator inside a declared string value is refused
- **WHEN** a family declares a choice knob one of whose string values contains the identifier's separator
- **THEN** the declaration is refused naming that family, that knob and that value
- **AND** the task is not loaded

#### Scenario: A knob permitting a negative value is refused
- **WHEN** a family declares a knob permitting a negative number, whose written form carries the identifier's separator
- **THEN** the declaration is refused naming that family, that knob and that value
- **AND** the task is not loaded

#### Scenario: Existing identifiers survive the task gaining families
- **WHEN** a task that declared one family is redeclared with that family plus others, its knob declarations unchanged
- **THEN** that family composes exactly the identifiers it composed before

A configuration identifier the family's shipped predictions have no entry for, and shipped
predictions declaring a different task or family than the one being resolved, SHALL be
refused rather than resolved.

#### Scenario: Identifier keys the precomputed lookups
- **WHEN** a configuration identifier is resolved against its family
- **THEN** it selects that configuration's prediction entries and its training history within that family
- **AND** both lookups refer to the same configuration

#### Scenario: Unknown configuration is refused
- **WHEN** a configuration identifier has no entry in its family's shipped predictions
- **THEN** the lookup is refused naming that family and that identifier
- **AND** no crop is scored from it
### Requirement: Artifact schema versioning

A task SHALL declare the schema version its precomputed artifacts were generated
against, and each artifact SHALL carry the version it was generated with. A mismatch
SHALL fail visibly and SHALL NOT be silently tolerated or worked around with partial
data.

#### Scenario: Mismatched artifact version is surfaced
- **WHEN** a task's declared schema version differs from its prediction artifact's version
- **THEN** the task reports a version mismatch identifying both versions
- **AND** the task does not run

#### Scenario: Matching version loads normally
- **WHEN** the declared and artifact schema versions are equal
- **THEN** the task loads and runs without warning

### Requirement: Predictions are probability distributions, not decisions

A task's prediction artifact SHALL provide, for each image and each configuration
identifier, a probability distribution over that task's declared categories. It SHALL
NOT store a chosen action or a final label, so that the decision rule remains
changeable without regenerating predictions. The artifact SHALL declare the category
order its probability vectors are indexed by, and an order that disagrees with the
task's declared categories SHALL be refused. A stored entry that is not a probability
distribution over those categories SHALL be refused rather than scored.

#### Scenario: Decision rule changes without regenerating artifacts
- **WHEN** a task's decision policy is changed
- **THEN** existing prediction artifacts remain valid and are reused unchanged

#### Scenario: Distribution covers every declared category
- **WHEN** a prediction entry is read for an image and configuration
- **THEN** it provides one probability per declared category of that task
- **AND** the probabilities are indexed by the task's declared category order

#### Scenario: Malformed distribution is refused rather than scored
- **WHEN** a stored entry carries the wrong number of probabilities, a value outside zero to one, or values that do not sum to one
- **THEN** reading it is refused naming the defect
- **AND** no action is chosen and no earnings are computed from it

### Requirement: Predictions cover both the training split and the evaluation pool

A task's prediction artifact SHALL contain entries for both the browsable training split
and the larger evaluation pool, so that performance on data the model learned from can
be shown alongside performance on unseen data.

#### Scenario: Training and harvest performance shown together
- **WHEN** a student views results for one configuration
- **THEN** performance on the training split and on the evaluated harvest are both available for that same configuration

### Requirement: Teaching copy is declared alongside the task

Explanatory copy SHALL be declared as task data at both the task level and the
individual knob level, so that theory is available in context without being hard-coded
into screens.

#### Scenario: Knob help is available in context
- **WHEN** a student requests help on a specific knob
- **THEN** that knob's declared help copy is shown

### Requirement: Task discovery from declarations

The farm overview SHALL list tasks from their declarations, and SHALL distinguish tasks
that are available to play from tasks that are announced but not yet playable.

#### Scenario: Only available tasks are selectable
- **WHEN** the farm overview is shown while only the apple harvest task is available
- **THEN** the apple harvest task is selectable
- **AND** any announced but unavailable task is visibly not selectable

### Requirement: A task may declare how its architecture is drawn

A model family MAY declare how the architecture its knobs describe should be drawn. WHEN it
does, the declaration SHALL name the kind of architecture, and SHALL carry the fields that
kind requires. The declaration SHALL NOT name the output units, which are the task's
declared categories, for any kind.

A drawing is declared by a family rather than by the task, because a task's families do not
share an architecture and cannot share a drawing. Each family's drawing SHALL be resolvable
from that family's declaration and knob values alone.

For the fully-connected kind, the declaration SHALL name the knob whose value sets the
number of hidden layers, the knob whose value sets the units per layer, the count to draw
for each value that width knob permits, and the number of input units to draw.

For the convolutional kind, the declaration SHALL name the knob whose value sets the
number of convolutional blocks, the knob whose value sets the base channel count, the
spatial resolution of the task's input, and the drawn depth to use for each value that
channel knob permits. It SHALL NOT name a per-block spatial size, which is derived from
the input resolution and the block's position.

A field one kind requires SHALL NOT be required of another kind, and a field belonging to
a kind other than the one declared SHALL NOT be honoured. A knob a diagram names SHALL be
a knob its own family declares; naming a knob of another family SHALL be refused.

The block is optional: a family without one remains complete and playable, and is simply
drawn no architecture.

#### Scenario: A complete diagram declaration is honoured
- **WHEN** a family declares a fully-connected diagram naming knobs it declares, a drawn count for every value of its width knob, and a number of input units
- **THEN** the declaration is accepted
- **AND** that family's architecture is drawn from it

#### Scenario: A complete convolutional diagram declaration is honoured
- **WHEN** a family declares a convolutional diagram naming knobs it declares, an input resolution, and a drawn depth for every value of its channel knob
- **THEN** the declaration is accepted
- **AND** that family's architecture is drawn from it

#### Scenario: A kind's fields are required only of that kind
- **WHEN** a convolutional diagram omits a field only the fully-connected kind requires
- **THEN** the declaration is accepted

#### Scenario: A task without one stays playable
- **WHEN** a family's declaration omits the diagram block
- **THEN** the declaration is still complete
- **AND** the task appears as selectable and that family can be configured and put to work

#### Scenario: A diagram naming another family's knob is refused
- **WHEN** a family's diagram names a knob that a different family of the same task declares
- **THEN** the declaration is refused naming that family and that knob
- **AND** the task is not loaded
### Requirement: A declared diagram is validated with its cause named

WHEN a task declares a diagram, the system SHALL refuse a declaration whose diagram block
declares an unknown kind, omits a field the declared kind requires, names a knob the task
does not declare, names a depth knob whose permitted values are not all whole numbers,
leaves any permitted value of its width or channel knob without a drawn count, or maps a
value to a drawn count that is not a positive whole number. For the convolutional kind it
SHALL additionally refuse a declaration whose input resolution is not a positive whole
number, or whose depth knob permits a block count the declared input resolution cannot
support. Each refusal SHALL name the field or value at fault. A declared diagram SHALL NOT
be partially honoured, ignored, or repaired by substituting a value the task did not
declare.

#### Scenario: A diagram naming an undeclared knob is rejected
- **WHEN** a diagram names a knob the task does not declare
- **THEN** the declaration is rejected
- **AND** the refusal names that knob

#### Scenario: An unmapped width value is rejected
- **WHEN** a diagram omits a drawn count for one of the values its width or channel knob permits
- **THEN** the declaration is rejected
- **AND** the refusal names the unmapped value

#### Scenario: A depth knob that cannot yield whole layers is rejected
- **WHEN** a diagram names as its depth knob a knob permitting a value that is not a whole number
- **THEN** the declaration is rejected
- **AND** the refusal names that knob and that value

#### Scenario: An undrawable count is rejected
- **WHEN** a diagram maps a width or channel value to a drawn count that is zero, negative or not a whole number
- **THEN** the declaration is rejected
- **AND** the refusal names that count

#### Scenario: An unknown kind is rejected
- **WHEN** a diagram declares a kind the system does not support
- **THEN** the declaration is rejected
- **AND** the refusal names that kind and the kinds it supports

#### Scenario: A block count the input resolution cannot support is rejected
- **WHEN** a convolutional diagram's depth knob permits a block count that would pool the declared input resolution below one spatial position
- **THEN** the declaration is rejected
- **AND** the refusal names the input resolution, that block count and that knob

#### Scenario: A malformed input resolution is rejected
- **WHEN** a convolutional diagram declares an input resolution that is zero, negative or not a whole number
- **THEN** the declaration is rejected
- **AND** the refusal names that value

#### Scenario: An incomplete diagram block is rejected rather than half-used
- **WHEN** a diagram block is present but omits a field its declared kind requires
- **THEN** the declaration is rejected naming the missing field
- **AND** no architecture is drawn from the partial block

### Requirement: A declared input resolution must match the task's pool

WHEN a task declares a convolutional diagram, the input resolution it declares SHALL match
the image size the task's pool manifest provides. A mismatch SHALL be refused, naming both
the declared resolution and the pool's, because the two disagreeing means either the
drawing states spatial sizes the model does not have or the model is built for images the
pool does not contain.

#### Scenario: A matching resolution is accepted
- **WHEN** a convolutional task declares the input resolution its pool manifest provides
- **THEN** the declaration is accepted

#### Scenario: A mismatched resolution stops the task
- **WHEN** a convolutional task declares an input resolution differing from its pool manifest's image size
- **THEN** the mismatch is reported naming both resolutions
- **AND** the task does not run

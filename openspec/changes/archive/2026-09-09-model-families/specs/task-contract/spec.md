## MODIFIED Requirements

### Requirement: Task declaration completeness

A task SHALL declare all of: a stable id, a display title, its ground-truth categories,
the actions available to the automated system, a mapping from each declared category to
the action that category calls for, its decision policy, a reference to its image pool,
the numbers measured from each image's pixels, the largest hand-written rule it offers, at
least one model family, a payoff table, how much of its job one person can do by hand, its
teaching copy, and whether it is available to play. The system SHALL refuse to present a
task whose declaration is missing any of these.

The hyperparameter knobs exposed to the student and the reference to a precomputed
prediction artifact are no longer the task's to declare; they belong to each model family,
because a task offers several families and they share neither. A declaration carrying knobs
or a prediction reference at the task level SHALL be refused, naming where they now belong,
rather than loaded with them ignored.

What the task keeps describes the job rather than the model doing it: what the categories
are, what may be done about them, what that is worth, which pictures it is judged on, what
can be measured from them, and how much of it a person can do unaided. Every family of one
task is judged against the same job.

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

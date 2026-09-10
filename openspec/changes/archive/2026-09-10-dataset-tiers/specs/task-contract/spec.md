## MODIFIED Requirements

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

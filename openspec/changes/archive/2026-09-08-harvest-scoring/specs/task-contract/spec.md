## MODIFIED Requirements

### Requirement: Task declaration completeness

A task SHALL declare all of: a stable id, a display title, its ground-truth categories,
the actions available to the automated system, a mapping from each declared category to
the action that category calls for, its decision policy, a reference to its image pool,
the hyperparameter knobs exposed to the student, a reference to its precomputed
prediction artifact, a payoff table, how much of its job one person can do by hand, its
teaching copy, and whether it is available to play. The system SHALL refuse to present a
task whose declaration is missing any of these.

How much of its job one person can do by hand is two figures: how many images a student
is presented with in a single harvest, and the longest a single image may count towards a
measured rate. Every task carries them, so a task that cannot be done by hand is refused
where its author can see it rather than in front of a student.

A task MAY additionally declare a delivery term, which prices its batch as a whole rather
than its images one at a time. The term is optional because a task whose mistakes are all
priced adequately per image needs none, and a task that omits it SHALL behave exactly as
though the concept did not exist.

#### Scenario: Complete declaration is playable
- **WHEN** a task declaration provides every required field
- **THEN** the task appears as selectable and can be configured and run

#### Scenario: Incomplete declaration is rejected
- **WHEN** a task declaration omits a required field
- **THEN** the task is not offered to the student
- **AND** the omission is reported as a configuration error naming the missing field

#### Scenario: A declaration without a delivery term is complete
- **WHEN** a task declaration provides every required field and no delivery term
- **THEN** the task is accepted and playable
- **AND** nothing about a delivery term is reported as missing

## ADDED Requirements

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

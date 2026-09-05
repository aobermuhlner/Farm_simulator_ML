## ADDED Requirements

### Requirement: A category's declared action is its best-paying action

For every declared category, the payoff table entry for the action that category is
declared to call for SHALL be strictly greater than the entry for every other declared
action in that category's row. A declaration in which some other action matches or outpays
the declared one SHALL be rejected, naming the category, the action it declares, and the
action that matches or outpays it.

The category-to-action mapping states what is *correct* and the payoff table states what is
*paid*. When the two disagree the task pays for a mistake: the earnings-maximising
behaviour stops being the behaviour the task teaches, the report's counts stop meaning what
their labels say, and a student who hill-climbs earnings is rewarded for it. Requiring
agreement makes the correct treatment of every category also its most profitable one, so no
declared action can be optimal everywhere and no declared category can be left with a
treatment that never pays.

An action that no category is declared to call for SHALL remain permitted, so that a task
may offer a cautious action that is never the correct answer to any single category and is
chosen only when no category is certain enough.

#### Scenario: A table that pays more for the wrong treatment is refused
- **WHEN** a task maps a category to one action but its payoff table pays more for a different action in that category's row
- **THEN** the task is rejected as invalid and does not run
- **AND** the refusal names that category, its declared action, and the action that outpays it

#### Scenario: A tie between the declared action and another is refused
- **WHEN** a category's declared action and some other action carry equal payoffs in that category's row
- **THEN** the task is rejected as invalid
- **AND** the refusal names that category and both actions

#### Scenario: Treating every image correctly is the best-paying outcome
- **WHEN** every evaluated image is given the action its true category is declared to call for
- **THEN** no other assignment of declared actions to those images yields greater earnings

#### Scenario: An action no category calls for is still allowed
- **WHEN** a task declares an action that is no category's declared action, and no category's row pays that action at least as much as its own declared action
- **THEN** the declaration is accepted
- **AND** the action remains available to the declared policy

## MODIFIED Requirements

### Requirement: Threshold policy

WHEN a task declares a threshold policy, it SHALL declare a threshold per declared
category, a fallback action, and a priority order over its declared categories. A
category's action SHALL be chosen when that category's probability meets or exceeds its
threshold. WHEN more than one category meets its threshold, the one appearing earliest in
the declared priority order SHALL determine the action. WHEN no category meets its
threshold, the declared fallback action SHALL be chosen.

The rule SHALL be stated over categories and their declared actions and SHALL NOT depend on
how many actions a task declares, so a task declaring more than two is resolved by the same
rule as a task declaring two.

A declared priority order SHALL name every declared category exactly once. A threshold
policy whose priority order omits a category, names one twice, or names one the task does
not declare SHALL be rejected, naming the category at fault. Priority SHALL NOT be inferred
from the declared category order: that order is fixed by the order the prediction
artifact's probability vectors are indexed by, so a task could not express a change of
priority without invalidating an artifact that has nothing to do with the decision rule.

#### Scenario: Nothing clears its threshold
- **WHEN** every category's probability for an image is below that category's threshold
- **THEN** the declared fallback action is chosen for the image

#### Scenario: Raising a threshold makes the system more conservative
- **WHEN** a category's threshold is raised and the same images are evaluated again
- **THEN** the count of images assigned that category's action does not increase

#### Scenario: Priority decides between two categories that both clear
- **WHEN** two categories both meet their thresholds for an image and their declared actions differ
- **THEN** the action of the category earlier in the declared priority order is chosen
- **AND** the other category's action is not chosen for that image

#### Scenario: A cautious threshold on a rare category outranks a more probable one
- **WHEN** a category placed first in the priority order meets its low threshold for an image
- **AND** a more probable category also meets its own higher threshold
- **THEN** the first category's action is chosen

#### Scenario: Priority is declared, not read off the category order
- **WHEN** a task's priority order is changed and the same images are evaluated again
- **THEN** the actions chosen may differ
- **AND** no configuration identifier changes and no artifact is regenerated

#### Scenario: An incomplete priority order is rejected
- **WHEN** a threshold policy declares a priority order that omits a declared category, repeats one, or names an undeclared one
- **THEN** the task is rejected as invalid and does not run
- **AND** the refusal names that category

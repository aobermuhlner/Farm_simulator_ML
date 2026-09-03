## Purpose

Defines how a per-image probability distribution becomes a chosen action and how chosen
actions become earnings, so that lessons about decision thresholds and asymmetric error
costs are expressed as task configuration rather than as new code.

## Requirements

### Requirement: The decision policy is declared task data evaluated live

A task SHALL declare which decision policy converts a probability distribution into an
action. The policy SHALL be evaluated at run time from the stored distributions and
SHALL NOT be baked into the precomputed artifacts.

#### Scenario: Policy changes without new predictions
- **WHEN** a task's declared policy is replaced with a different policy
- **THEN** runs use the new policy against the existing prediction artifacts
- **AND** no configuration identifier changes and no artifact is regenerated

#### Scenario: Undeclared policy is rejected
- **WHEN** a task declares no decision policy
- **THEN** the task is rejected as incomplete and does not run

### Requirement: Highest-probability policy

WHEN a task declares the highest-probability policy, the chosen action SHALL be the
action mapped from the category with the greatest probability, using the task's declared
category-to-action mapping. WHEN more than one category shares the greatest probability,
the one appearing earliest in the task's declared category order SHALL determine the
action.

#### Scenario: Most likely category determines the action
- **WHEN** an image's distribution gives its greatest probability to a category mapped to a given action
- **THEN** that action is chosen for the image

### Requirement: Threshold policy

WHEN a task declares a threshold policy, it SHALL declare a threshold per category and a
fallback action. A category's action SHALL be chosen when that category's probability
meets or exceeds its threshold. WHEN more than one category meets its threshold, the one
appearing earliest in the task's declared category order SHALL determine the action.
WHEN no category meets its threshold, the declared fallback action SHALL be chosen.

#### Scenario: Nothing clears its threshold
- **WHEN** every category's probability for an image is below that category's threshold
- **THEN** the declared fallback action is chosen for the image

#### Scenario: Raising a threshold makes the system more conservative
- **WHEN** a category's threshold is raised and the same images are evaluated again
- **THEN** the count of images assigned that category's action does not increase

### Requirement: Cost-optimal policy

WHEN a task declares the cost-optimal policy, the chosen action SHALL be the action with
the greatest expected payoff, computed from the image's probability distribution and the
task's payoff table. WHEN more than one action shares the greatest expected payoff, the
one appearing earliest in the task's declared action order SHALL be chosen.

#### Scenario: An asymmetric penalty overrides the most likely category
- **WHEN** the most likely category maps to an action whose payoff table entry carries a large penalty for the other plausible category
- **AND** an alternative action has greater expected payoff across the distribution
- **THEN** the alternative action is chosen

### Requirement: Payoff table completeness

A task's payoff table SHALL define a value for every combination of declared
ground-truth category and declared action. A table with any missing combination SHALL be
rejected.

#### Scenario: Missing combination is rejected
- **WHEN** a payoff table omits a value for some category and action combination
- **THEN** the task is rejected as invalid and does not run
- **AND** the missing combination is named in the error

### Requirement: Earnings are the sum of payoff entries

Total earnings for a run SHALL equal the sum, over every evaluated image, of the payoff
table entry for that image's true category and the action chosen for it.

#### Scenario: Earnings are reproducible for a fixed set of images
- **WHEN** the same images are evaluated twice under the same configuration and policy
- **THEN** the reported earnings are identical

### Requirement: Outcomes are reported per category and action combination

A run SHALL report the count of evaluated images for every combination of true category
and chosen action, in addition to total earnings. Earnings alone SHALL NOT be the only
reported outcome.

#### Scenario: A total-only report is insufficient
- **WHEN** a run completes
- **THEN** the per-combination counts are available alongside the total earnings

#### Scenario: An over-selective configuration is diagnosable
- **WHEN** a configuration rarely chooses the high-value action, including on the categories where that action is correct
- **THEN** the report shows the low count for the correct category as well as the low count for the categories where the low-value action was correct
- **AND** the two are distinguishable rather than combined into one score

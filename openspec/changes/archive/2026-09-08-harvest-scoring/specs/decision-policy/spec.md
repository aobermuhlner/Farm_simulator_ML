## ADDED Requirements

### Requirement: Earnings are the payoff sum, less any declared delivery term

Total earnings for a run SHALL equal the sum, over every evaluated image, of the payoff
table entry for that image's true category and the action chosen for it — less whatever the
task's declared delivery term takes off that sum over the batch as a whole. A task
declaring no delivery term SHALL earn exactly that sum, unchanged.

The payoff table remains the only per-image price list: no per-image term is introduced
here, and the delivery term is the only thing between the sum and the earnings. What the
term is and how it is measured belongs to `harvest-run`; what this requirement gives up is
the claim that earnings can be read off one image at a time.

That claim was worth giving up. A price list that can be reasoned about one apple at a time
can be hill-climbed one apple at a time, and the mistake a student most needs to make and
see corrected is exactly the greedy one: *this apple is probably fine, crate it.* A term
over the whole batch is what makes a rare category worth more than the sum of its apples,
which is the lesson of imbalanced classification and is not expressible as a sum.

#### Scenario: Earnings are reproducible for a fixed set of images
- **WHEN** the same images are evaluated twice under the same configuration and policy
- **THEN** the reported earnings are identical

#### Scenario: A task with no delivery term earns its payoff sum
- **WHEN** a task declaring no delivery term is run
- **THEN** its earnings equal the sum of the payoff entries for the actions chosen
- **AND** nothing is subtracted from that sum

#### Scenario: Earnings are no longer a per-image quantity
- **WHEN** a task declaring a delivery term is run, and one image's chosen action changes so that the batch crosses the term's tolerance
- **THEN** the change in earnings is larger than the difference between that image's two payoff entries

#### Scenario: The payoff table is still the only price list
- **WHEN** a payoff entry in the task declaration is changed
- **THEN** the earnings for the same chosen actions change accordingly
- **AND** no per-image term the declaration does not contain contributes to them

## REMOVED Requirements

### Requirement: Earnings are the sum of payoff entries

**Reason**: A delivery term over the whole batch is not a sum of per-image entries, and the
co-op contract this change ships is exactly such a term. The requirement is replaced by
*Earnings are the payoff sum, less any declared delivery term*, which keeps the old rule
verbatim for any task that declares no term.

**Migration**: No task declaration changes to keep the old behaviour: a task with no
declared delivery term earns the payoff sum exactly as before, and the replacing
requirement says so in its own scenario. A task that declares a term accepts that its
earnings are a property of the run rather than of its images — the guarantee that survives
is the one in *A category's declared action is its best-paying action*: treating every
image correctly still yields the greatest earnings available.

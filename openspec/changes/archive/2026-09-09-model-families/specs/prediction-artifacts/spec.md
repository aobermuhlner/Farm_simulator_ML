## MODIFIED Requirements

### Requirement: An artifact is bound to the pool that produced it

An artifact SHALL record the task id and the model family id it was produced for, together
with the pool id, the pool schema version and the pool seed of the images it was produced
from. Loading it against a task, a family or a pool differing in any of these SHALL be
refused, naming the recorded and the loaded value, because predictions keyed to the image
ids of one pool are meaningless against images another pool generated under the same ids,
and predictions keyed to the configuration identifiers of one family are meaningless against
another family that composes the same identifiers from different knobs.

The family binding is what makes family-scoped configuration identity safe. Two families of
one task may compose identical identifier strings, so an artifact that recorded only its
task could be resolved against the wrong family's configuration and would answer, wrongly,
rather than refuse.

#### Scenario: A matching pool loads
- **WHEN** an artifact's recorded pool id, schema version and seed equal the loaded pool's, and its recorded task and family are the ones being resolved
- **THEN** the artifact loads and its predictions are resolvable against that pool

#### Scenario: A differently seeded pool is refused
- **WHEN** an artifact records a pool seed the loaded manifest does not declare
- **THEN** loading is refused naming both seeds
- **AND** no crop is scored from that artifact

#### Scenario: Another family's artifact is refused
- **WHEN** an artifact recording one family is loaded for a different family of the same task
- **THEN** loading is refused naming the recorded and the requested family
- **AND** no crop is scored from that artifact

#### Scenario: An artifact recording no family is refused
- **WHEN** an artifact records no model family id
- **THEN** loading is refused naming that omission
- **AND** no family is assumed for it

### Requirement: One configuration is retrievable without the others

Artifact files SHALL live under the path the model family's declaration names for its
predictions, and SHALL be laid out so that resolving one configuration does not require
transferring the predictions of configurations the student did not choose. Resolving a
configuration SHALL cost a number of requests that does not grow with the number of images
in the pool, with the number of configurations the artifact covers, or with the number of
families the task declares.

A family whose model ships rather than its predictions SHALL be subject to the same bound:
selecting one of its configurations SHALL NOT require transferring the models of
configurations the student did not choose, nor the artifacts of any other family.

#### Scenario: Choosing a configuration transfers that configuration
- **WHEN** one configuration's predictions are resolved from an artifact covering many
- **THEN** the other configurations' predictions are not transferred

#### Scenario: Resolution cost is bounded
- **WHEN** a configuration is resolved
- **THEN** the number of requests issued is bounded and independent of the pool's image count, of the artifact's coverage size, and of how many families the task declares

#### Scenario: Selecting a family transfers only that family
- **WHEN** one family of a task declaring several is selected and a configuration of it resolved
- **THEN** nothing belonging to the task's other families is transferred

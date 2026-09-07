## MODIFIED Requirements

### Requirement: A shipped artifact is trained, and records what produced it

Every probability distribution, every fitted model and every loss value in a shipped
artifact SHALL be produced by fitting a model to the images of the pool's training split and
evaluating it over the pool's images. Values SHALL NOT be authored by hand.

Each artifact SHALL record, per covered configuration, what produced it: the knob values the
configuration resolves from, the number of steps the run performed, the seed the run used,
and the revision of the producing pipeline. What a step is SHALL be declared by the model
family the configuration belongs to — an epoch for a family that trains iteratively, a split
added for a family that fits a tree — so that a recorded step count is readable without
knowing which family produced it. A run SHALL depend on nothing it does not record — not
wall-clock time, not ambient machine state, not an operator's unrecorded choice, not an
undeclared tie-breaking rule among equally good fits — so that a reviewer holding the
artifact, the pool and the recorded fields can repeat it.

#### Scenario: Provenance is present for every covered configuration
- **WHEN** a shipped artifact is read
- **THEN** each covered configuration carries its knob values, step count, seed and producing revision

#### Scenario: A hand-authored artifact is not shippable
- **WHEN** an artifact carries distributions, fitted models or losses with no recorded run that produced them
- **THEN** it is refused as a shipped artifact, naming the configurations lacking provenance
- **AND** it is not served to the app

#### Scenario: A run is repeatable from what it recorded
- **WHEN** a run is repeated against the same pool with the recorded seed, step count and knob values
- **THEN** it requires no input the artifact does not record
- **AND** it produces the same fitted model or the same distributions

### Requirement: Pixels are read through the pool's declared delivery

A producing pipeline that reads an image's pixels SHALL obtain them by resolving the region
its manifest entry declares within the delivered resource that entry names, applying the same
resolution rule the app applies. An entry or a region that does not resolve SHALL cause a
refusal naming the image id, and no artifact SHALL be written from a partially readable pool.

A producing pipeline that fits on values the manifest records rather than on pixels SHALL
read those values from the manifest and SHALL NOT read the delivered images at all. Its chain
of custody to the pixels is the measurement the pool tooling performed when it wrote those
values; a value the manifest does not declare for every image SHALL cause a refusal naming
the value, and no artifact SHALL be written from it.

#### Scenario: Every image is read from its declared region
- **WHEN** a pipeline that reads pixels reads the pool
- **THEN** each image's pixels come from the region its manifest entry resolves to

#### Scenario: An unresolvable entry stops production
- **WHEN** an image's declared region does not fit inside its declared resource
- **THEN** production is refused naming that image id
- **AND** no artifact file is written

#### Scenario: A pipeline fitting on recorded values reads no image
- **WHEN** a pipeline fits on values the manifest records
- **THEN** it reads those values from the manifest and opens no delivered resource

#### Scenario: A value missing for an image stops production
- **WHEN** a value a pipeline fits on is not declared for every image of the split it fits
- **THEN** production is refused naming that value
- **AND** no artifact file is written

### Requirement: The training history is measured on the declared roles

A covered configuration's history SHALL carry one entry per step the run performed, numbered
contiguously from the first step to the last with none missing or repeated. What a step is
SHALL be declared by the model family: an epoch for a family that trains iteratively, a split
added for a family that fits a tree. Each entry's training loss SHALL be measured over the
training split's fitted images and its validation loss over the training split's held-out
images. No held-out image SHALL influence the model the entry describes.

#### Scenario: Epochs are contiguous
- **WHEN** a configuration of a family that trains iteratively has its history read
- **THEN** it contains one entry per epoch, numbered contiguously, with no gap or duplicate

#### Scenario: A family declares what a step is
- **WHEN** a configuration's history is read
- **THEN** the number of entries equals the number of steps the run performed, as that configuration's family declares a step

#### Scenario: Validation loss is measured on unfitted images
- **WHEN** a step's validation loss is produced
- **THEN** it is measured over the training split's held-out images
- **AND** those images contributed nothing to the model that step describes

#### Scenario: An invented epoch is refused
- **WHEN** a history carries an entry for a step the run did not perform, or omits one it did
- **THEN** the artifact is refused naming that configuration and that step

### Requirement: A covered configuration is complete or refused

For every configuration it declares as covered, an artifact SHALL yield a distribution for
every image the pool manifest declares, in both the training split and the evaluation pool,
each image exactly once, together with that configuration's history. Held-out training images
SHALL appear under the same split as the fitted ones, because they are training-split images
playing a role and not a third split. A covered configuration SHALL NOT be scored on the
images that happen to be present.

An artifact that stores those distributions SHALL satisfy this by enumeration: an entry
naming an image the manifest does not declare, a manifest image the entry set omits, or a
repeated image SHALL cause a refusal naming the configuration and the defect.

An artifact that stores a fitted model instead SHALL satisfy this structurally, by being
evaluable over every manifest image of both splits without enumerating them. The model SHALL
be refused, naming the configuration and the defect, when it reads a value the manifest does
not declare for every image, or when any image would reach no outcome or more than one; and
the model SHALL NOT be evaluated over the subset of images it happens to resolve.

A covered configuration missing its history SHALL be refused naming the configuration,
whichever of the two forms the artifact takes.

#### Scenario: A covered configuration spans the whole pool
- **WHEN** a covered configuration's predictions are read
- **THEN** every manifest image of the training split and of the evaluation pool yields exactly one distribution

#### Scenario: Held-out images sit under the training split
- **WHEN** the training split's predictions are read
- **THEN** they include the held-out images alongside the fitted ones
- **AND** no third split name appears in the artifact

#### Scenario: A missing image refuses rather than shrinking the run
- **WHEN** an artifact storing distributions omits one for an image the manifest declares
- **THEN** the artifact is refused naming that configuration and that image id
- **AND** no earnings figure is produced from the images that were present

#### Scenario: A model that cannot span the pool refuses rather than shrinking the run
- **WHEN** an artifact storing a fitted model reads a value the manifest does not declare for every image, or leaves an image with no outcome or more than one
- **THEN** the artifact is refused naming that configuration and that defect
- **AND** no earnings figure is produced from the images the model did resolve

#### Scenario: A configuration missing its history refuses
- **WHEN** a covered configuration carries no history
- **THEN** the artifact is refused naming that configuration

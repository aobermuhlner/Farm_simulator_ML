## Purpose

Defines how a configuration's predictions and training history come to exist — trained
from the pool's own pixels, bound to the pool that produced them, encoded and versioned on
disk, and honest about which configurations they cover — so that the lessons the simulator
teaches are observations a reviewer can check rather than numbers someone typed.

## ADDED Requirements

### Requirement: A shipped artifact is trained, and records what produced it

Every probability distribution and every loss value in a shipped prediction artifact SHALL
be produced by training a model on the images of the pool's training split and evaluating
it over the pool's images. Values SHALL NOT be authored by hand.

Each artifact SHALL record, per covered configuration, what produced it: the knob values
the configuration resolves from, the number of epochs run, the seed the run used, and the
revision of the producing pipeline. A run SHALL depend on nothing it does not record — not
wall-clock time, not ambient machine state, not an operator's unrecorded choice — so that
a reviewer holding the artifact, the pool and the recorded fields can repeat it.

#### Scenario: Provenance is present for every covered configuration
- **WHEN** a shipped artifact is read
- **THEN** each covered configuration carries its knob values, epoch count, seed and producing revision

#### Scenario: A hand-authored artifact is not shippable
- **WHEN** an artifact carries distributions or losses with no recorded run that produced them
- **THEN** it is refused as a shipped artifact, naming the configurations lacking provenance
- **AND** it is not served to the app

#### Scenario: A run is repeatable from what it recorded
- **WHEN** a run is repeated against the same pool with the recorded seed, epoch count and knob values
- **THEN** it requires no input the artifact does not record

### Requirement: An artifact is bound to the pool that produced it

An artifact SHALL record the pool id, the pool schema version and the pool seed of the
images it was produced from. Loading it against a pool differing in any of the three SHALL
be refused, naming the recorded and the loaded value, because predictions keyed to the
image ids of one pool are meaningless against images another pool generated under the same
ids.

#### Scenario: A matching pool loads
- **WHEN** an artifact's recorded pool id, schema version and seed equal the loaded pool's
- **THEN** the artifact loads and its predictions are resolvable against that pool

#### Scenario: A differently seeded pool is refused
- **WHEN** an artifact records a pool seed the loaded manifest does not declare
- **THEN** loading is refused naming both seeds
- **AND** no run is scored from that artifact

### Requirement: Pixels are read through the pool's declared delivery

The producing pipeline SHALL obtain an image's pixels by resolving the region its manifest
entry declares within the delivered resource that entry names, applying the same
resolution rule the app applies. An entry or a region that does not resolve SHALL cause a
refusal naming the image id, and no artifact SHALL be written from a partially readable
pool.

#### Scenario: Every image is read from its declared region
- **WHEN** the pipeline reads the pool
- **THEN** each image's pixels come from the region its manifest entry resolves to

#### Scenario: An unresolvable entry stops production
- **WHEN** an image's declared region does not fit inside its declared resource
- **THEN** production is refused naming that image id
- **AND** no artifact file is written

### Requirement: The training history is measured on the declared roles

A covered configuration's history SHALL carry one entry per epoch the run performed,
numbered contiguously from the first epoch to the last with none missing or repeated. Each
entry's training loss SHALL be measured over the training split's fitted images and its
validation loss over the training split's held-out images. No held-out image SHALL
influence the model's weights.

#### Scenario: Epochs are contiguous
- **WHEN** a configuration's history is read
- **THEN** it contains one entry per epoch, numbered contiguously, with no gap or duplicate

#### Scenario: Validation loss is measured on unfitted images
- **WHEN** an epoch's validation loss is produced
- **THEN** it is measured over the training split's held-out images
- **AND** those images contributed nothing to the model's weights

#### Scenario: An invented epoch is refused
- **WHEN** a history carries an entry for an epoch the run did not perform, or omits one it did
- **THEN** the artifact is refused naming that configuration and that epoch

### Requirement: Coverage is declared, and an uncovered configuration refuses as untrained

An artifact SHALL declare the set of configuration identifiers it covers. That set SHALL
be non-empty and SHALL include the identifier the task's declared knob defaults resolve
to, so that the first configuration a student is offered always resolves.

A configuration identifier outside the declared coverage SHALL be refused before any run
is scored, naming that identifier, and the refusal SHALL be distinguishable from the
refusal of an invalid configuration: a student choosing knob values within their declared
allowed values has made no error, and the cause is that no model was trained for that
combination. Coverage SHALL NOT be worked around by substituting a nearby configuration,
interpolating between covered ones, or falling back to a default.

#### Scenario: Coverage is enumerable at load
- **WHEN** an artifact is loaded
- **THEN** the set of configuration identifiers it covers is available without reading any prediction entry

#### Scenario: The default configuration is always covered
- **WHEN** a task's declared knob defaults resolve to a configuration identifier
- **THEN** the shipped artifact covers that identifier

#### Scenario: An uncovered but valid configuration refuses as untrained
- **WHEN** a student selects knob values within their declared allowed values that resolve to an identifier outside the artifact's coverage
- **THEN** the refusal names that identifier and reports that no model was trained for it
- **AND** it is not reported as an invalid configuration

#### Scenario: No configuration is substituted for an uncovered one
- **WHEN** a configuration outside coverage is requested
- **THEN** no other configuration's predictions or history are used in its place
- **AND** no run is scored

### Requirement: A covered configuration is complete or refused

For every configuration it declares as covered, an artifact SHALL provide a distribution
for every image the pool manifest declares, in both the training split and the evaluation
pool, each image exactly once, together with that configuration's history. Held-out
training images SHALL appear under the same split as the fitted ones, because they are
training-split images playing a role and not a third split.

An entry naming an image the manifest does not declare, a manifest image the entry set
omits, a repeated image, or a covered configuration missing its history SHALL cause a
refusal naming the configuration and the defect. A covered configuration SHALL NOT be
scored on the images that happen to be present.

#### Scenario: A covered configuration spans the whole pool
- **WHEN** a covered configuration's predictions are read
- **THEN** every manifest image of the training split and of the evaluation pool has exactly one distribution

#### Scenario: Held-out images sit under the training split
- **WHEN** the training split's predictions are read
- **THEN** they include the held-out images alongside the fitted ones
- **AND** no third split name appears in the artifact

#### Scenario: A missing image refuses rather than shrinking the run
- **WHEN** a covered configuration omits a distribution for an image the manifest declares
- **THEN** the artifact is refused naming that configuration and that image id
- **AND** no earnings figure is produced from the images that were present

### Requirement: Stored probabilities decode to valid distributions

An artifact SHALL declare the precision its probabilities are stored at and the category
order they are indexed by. A stored vector SHALL decode to one probability per declared
category, each between zero and one, summing to one within a tolerance the artifact
declares and that the declared precision can meet. Quantization SHALL NOT be a licence to
ship a vector that is not a distribution: a decoded vector failing any of these SHALL be
refused naming the configuration, the image and the defect.

#### Scenario: A decoded vector is a distribution
- **WHEN** a stored vector is decoded
- **THEN** it yields one probability per declared category, each within zero to one, summing to one within the declared tolerance

#### Scenario: The declared precision can meet the declared tolerance
- **WHEN** an artifact declares a storage precision and a sum tolerance
- **THEN** the tolerance is no tighter than the worst rounding error that precision can produce

#### Scenario: A vector that will not decode is refused
- **WHEN** a stored vector decodes to the wrong number of values, a value outside zero to one, or a sum outside the declared tolerance
- **THEN** reading it is refused naming the configuration, the image id and the defect

### Requirement: One configuration is retrievable without the others

Artifact files SHALL live under the path the task declaration names for its predictions,
and SHALL be laid out so that resolving one configuration does not require transferring
the predictions of configurations the student did not choose. Resolving a configuration
SHALL cost a number of requests that does not grow with the number of images in the pool
or with the number of configurations the artifact covers.

#### Scenario: Choosing a configuration transfers that configuration
- **WHEN** one configuration's predictions are resolved from an artifact covering many
- **THEN** the other configurations' predictions are not transferred

#### Scenario: Resolution cost is bounded
- **WHEN** a configuration is resolved
- **THEN** the number of requests issued is bounded and independent of the pool's image count and of the artifact's coverage size

### Requirement: The artifact carries no ground truth and no decision

The producing pipeline SHALL NOT write an image's true category, a predicted label, or a
chosen action into an artifact, and SHALL refuse rather than emit one. An artifact
carrying any of them SHALL be refused, so that ground truth stays declared in the pool
manifest alone and the decision rule stays a live computation over frozen data.

#### Scenario: Production emits distributions only
- **WHEN** an artifact is produced
- **THEN** it carries probability distributions and history, and nothing naming a category as true or an action as chosen

#### Scenario: An artifact carrying labels is refused
- **WHEN** an artifact entry carries a true category or a chosen action
- **THEN** it is refused naming that field
- **AND** no run is scored from it

### Requirement: Deliberate shaping is a recorded step

WHEN a shipped artifact's numbers are deliberately shaped so that a lesson lands — beyond
what the training run itself produced — the shaping SHALL be recorded in the artifact's
provenance as a named step, and SHALL be attributable to the configurations it touched.
Shaping SHALL NOT be applied as unrecorded adjustments inside the producing pipeline, and
a reviewer SHALL be able to tell, from the artifact alone, which figures are as measured
and which were shaped.

#### Scenario: Shaping is visible in the artifact
- **WHEN** a configuration's numbers were shaped
- **THEN** the artifact records the shaping step and the configurations it applied to

#### Scenario: An unshaped artifact says so
- **WHEN** no shaping was applied
- **THEN** the artifact records no shaping step
- **AND** its figures are readable as measured

#### Scenario: Hidden shaping is not permitted
- **WHEN** the producing pipeline adjusts a value without recording it as a shaping step
- **THEN** the resulting artifact is refused as a shipped artifact

### Requirement: The shipped task scores the pool it shows

The shipped build SHALL score runs over the same pool whose images the student can browse,
using a trained artifact for that pool. A build SHALL NOT ship a task whose browsable
images and scored images come from different sources.

#### Scenario: Browsed and scored images agree
- **WHEN** a student browses the training split and then runs a configuration
- **THEN** the images browsed are the images the run was scored over

#### Scenario: A split source is not shippable
- **WHEN** a task's scored predictions are keyed to images other than the pool it presents
- **THEN** that task is not shipped

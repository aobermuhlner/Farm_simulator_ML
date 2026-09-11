## Purpose

Defines how a configuration's predictions and training history come to exist — trained
from the pool's own pixels, bound to the pool that produced them, encoded and versioned on
disk, and honest about which configurations they cover — so that the lessons the simulator
teaches are observations a reviewer can check rather than numbers someone typed.

## Requirements

### Requirement: A shipped artifact is trained, and records what produced it

Every probability distribution, every fitted model and every loss value in a shipped
artifact SHALL be produced by fitting a model to the images of the pool's training split
and evaluating it over the pool's images. Values SHALL NOT be authored by hand, except
that a shipped model MAY be authored while the frame around it is being built, in which
case its provenance SHALL record that it was authored and by what — see `fitted-tree`.
That exception covers a model and never a distribution, a loss or a history: a number
presented as measured is a number somebody measured.

Each artifact SHALL record, per covered configuration, what produced it: the knob values
the configuration resolves from, the number of steps the run performed, the seed the run
used, and the revision of the producing pipeline. What a step is SHALL be declared by the
model family the configuration belongs to — an epoch for a family that trains iteratively,
a split added for a family that fits a tree — so that a recorded step count is readable
without knowing which family produced it. A configuration whose family performs no steps
SHALL record none, and SHALL carry no history to disagree with. A run SHALL depend on
nothing it does not record — not wall-clock time, not ambient machine state, not an
operator's unrecorded choice, not an undeclared tie-breaking rule among equally good fits
— so that a reviewer holding the artifact, the pool and the recorded fields can repeat it.

#### Scenario: Provenance is present for every covered configuration
- **WHEN** a shipped artifact is read
- **THEN** each covered configuration carries its knob values, step count, seed and producing revision

#### Scenario: A hand-authored artifact is not shippable
- **WHEN** an artifact carries distributions, fitted models or losses with no recorded run that produced them
- **THEN** it is refused as a shipped artifact, naming the configurations lacking provenance
- **AND** it is not served to the app

#### Scenario: An authored model says so rather than claiming a run
- **WHEN** a shipped model was written by hand rather than fitted
- **THEN** its provenance records that it was authored and what authored it
- **AND** it is not refused for carrying no run

#### Scenario: A run is repeatable from what it recorded
- **WHEN** a run is repeated against the same pool with the recorded seed, step count and knob values
- **THEN** it requires no input the artifact does not record
- **AND** it produces the same fitted model or the same distributions

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
### Requirement: Pixels are read through the pool's declared delivery

A producing pipeline that reads an image's pixels SHALL obtain them by resolving the
region its manifest entry declares within the delivered resource that entry names,
applying the same resolution rule the app applies. An entry or a region that does not
resolve SHALL cause a refusal naming the image id, and no artifact SHALL be written from a
partially readable pool.

A producing pipeline that fits on values the manifest records rather than on pixels SHALL
read those values from the manifest and SHALL NOT read the delivered images at all. Its
chain of custody to the pixels is the measurement the pool tooling performed when it wrote
those values; a value the manifest does not declare for every image SHALL cause a refusal
naming the value, and no artifact SHALL be written from it.

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

A covered configuration's history SHALL carry one entry per step the run performed,
numbered contiguously from the first step to the last with none missing or repeated. What
a step is SHALL be declared by the model family: an epoch for a family that trains
iteratively, a split added for a family that fits a tree. Each entry's training loss SHALL
be measured over the fitted images of the tier that configuration was fitted on, and its
validation loss over that tier's held-out images. No held-out image SHALL influence the
model the entry describes.

Both losses SHALL be measured against the labels that tier files its images under, never
against the manifest's true categories. A history is what the model's owner can see of it,
and a cheaply labelled set is judged by the labels it came with.

#### Scenario: Epochs are contiguous
- **WHEN** a configuration of a family that trains iteratively has its history read
- **THEN** it contains one entry per epoch, numbered contiguously, with no gap or duplicate

#### Scenario: A family declares what a step is
- **WHEN** a configuration's history is read
- **THEN** the number of entries equals the number of steps the run performed, as that configuration's family declares a step

#### Scenario: Validation loss is measured on unfitted images
- **WHEN** a step's validation loss is produced
- **THEN** it is measured over the held-out images of the tier the configuration was fitted on
- **AND** those images contributed nothing to the model that step describes

#### Scenario: An invented epoch is refused
- **WHEN** a history carries an entry for a step the run did not perform, or omits one it did
- **THEN** the artifact is refused naming that configuration and that step

#### Scenario: Losses are measured against the tier's labels
- **WHEN** a configuration fitted on a tier that files some images wrongly has its history produced
- **THEN** both losses are measured against that tier's labels
- **AND** the manifest's true categories are not consulted

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

For every configuration it declares as covered, an artifact SHALL yield a distribution for
every image of the dataset tier that configuration was fitted on and for every image of the
evaluation pool the manifest declares, each image exactly once, together with that
configuration's history where its family records one. Held-out training images SHALL appear
under the same split as the fitted ones, because they are training-split images playing a
role and not a third split. A covered configuration SHALL NOT be scored on the images that
happen to be present.

A configuration SHALL NOT be required to carry a distribution for a training image outside
its tier. Those images are ones its student cannot browse and its workshop does not report
on, so carrying them would pay for pictures nobody looks at; a configuration fitted on the
smallest tier is complete when it spans that tier.

An artifact that stores those distributions SHALL satisfy this by enumeration: an entry
naming an image the manifest does not declare, an image of the configuration's tier or of
the evaluation pool that the entry set omits, an entry for a training image outside the
configuration's tier, or a repeated image SHALL cause a refusal naming the configuration
and the defect.

An artifact that stores a fitted model instead SHALL satisfy this structurally, by being
evaluable over every one of those images without enumerating them. The model SHALL be
refused, naming the configuration and the defect, when it reads a value the manifest does
not declare for every image, or when any image would reach no outcome or more than one; and
the model SHALL NOT be evaluated over the subset of images it happens to resolve.

A covered configuration whose family records a history and which carries none SHALL be
refused naming the configuration, whichever of the two forms the artifact takes.

#### Scenario: A covered configuration spans the whole pool
- **WHEN** a covered configuration's predictions are read
- **THEN** every image of its tier and every image of the evaluation pool has exactly one distribution

#### Scenario: Held-out images sit under the training split
- **WHEN** the training split's predictions are read
- **THEN** they include the held-out images alongside the fitted ones
- **AND** no third split name appears in the artifact

#### Scenario: A missing image refuses rather than shrinking the run
- **WHEN** an artifact storing distributions omits one for an image of its tier or of the evaluation pool
- **THEN** the artifact is refused naming that configuration and that image id
- **AND** no earnings figure is produced from the images that were present

#### Scenario: A model that cannot span the pool refuses rather than shrinking the run
- **WHEN** an artifact storing a fitted model reads a value the manifest does not declare for every image, or leaves an image with no outcome or more than one
- **THEN** the artifact is refused naming that configuration and that defect
- **AND** no earnings figure is produced from the images the model did resolve

#### Scenario: A configuration missing its history refuses
- **WHEN** a covered configuration whose family records a history carries none
- **THEN** the artifact is refused naming that configuration

#### Scenario: An image outside the configuration's tier is refused
- **WHEN** a covered configuration carries a distribution for a training image its tier does not hold
- **THEN** the artifact is refused naming that configuration, that image id and that tier

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

### Requirement: An artifact records the tier each covered configuration was fitted against

An artifact SHALL record, per covered configuration, the id of the dataset tier that
configuration was fitted on. That id SHALL be the value the configuration's own identifier
carries for its family's dataset knob; an artifact recording a tier that disagrees with the
identifier, or recording none, SHALL be refused naming the configuration and both values.

The tier id is what is recorded, not the tier's labels. An artifact SHALL NOT carry the
label any tier files an image under, for the same reason it carries no true category: what a
dataset claims about an image is the pool manifest's to declare, and an artifact repeating
it would give a second place for the two to disagree.

Recording the tier is what makes the shipped figures readable. Two configurations differing
only in their tier are the comparison the tiers exist to teach, and a reviewer holding the
artifact SHALL be able to tell which fitting set produced which curve without inferring it
from the identifier's spelling.

#### Scenario: The recorded tier is present and agrees with the identifier
- **WHEN** a shipped artifact is read
- **THEN** each covered configuration records a tier id
- **AND** that id is the value its identifier carries for the family's dataset knob

#### Scenario: A disagreeing tier is refused
- **WHEN** a covered configuration records a tier other than the one its identifier carries
- **THEN** the artifact is refused naming that configuration, the recorded tier and the identifier's

#### Scenario: An artifact carrying tier labels is refused
- **WHEN** an artifact entry carries the label a tier files an image under
- **THEN** it is refused naming that field
- **AND** no run is scored from it

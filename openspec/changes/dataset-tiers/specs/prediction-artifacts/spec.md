## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: The training history is measured on the declared roles

A covered configuration's history SHALL carry one entry per epoch the run performed,
numbered contiguously from the first epoch to the last with none missing or repeated. Each
entry's training loss SHALL be measured over the fitted images of the tier that
configuration was fitted on, and its validation loss over that tier's held-out images. No
held-out image SHALL influence the model's weights.

Both losses SHALL be measured against the labels that tier files its images under, never
against the manifest's true categories. A history is what the model's owner can see of it,
and a cheaply labelled set is judged by the labels it came with.

#### Scenario: Epochs are contiguous
- **WHEN** a configuration's history is read
- **THEN** it contains one entry per epoch, numbered contiguously, with no gap or duplicate

#### Scenario: Validation loss is measured on unfitted images
- **WHEN** an epoch's validation loss is produced
- **THEN** it is measured over the held-out images of the tier the configuration was fitted on
- **AND** those images contributed nothing to the model's weights

#### Scenario: An invented epoch is refused
- **WHEN** a history carries an entry for an epoch the run did not perform, or omits one it did
- **THEN** the artifact is refused naming that configuration and that epoch

#### Scenario: Losses are measured against the tier's labels
- **WHEN** a configuration fitted on a tier that files some images wrongly has its history produced
- **THEN** both losses are measured against that tier's labels
- **AND** the manifest's true categories are not consulted

### Requirement: A covered configuration is complete or refused

For every configuration it declares as covered, an artifact SHALL provide a distribution
for every image of the dataset tier that configuration was fitted on and for every image of
the evaluation pool the manifest declares, each image exactly once, together with that
configuration's history. Held-out training images SHALL appear under the same split as the
fitted ones, because they are training-split images playing a role and not a third split.

A configuration SHALL NOT be required to carry a distribution for a training image outside
its tier. Those images are ones its student cannot browse and its workshop does not report
on, so carrying them would pay for pictures nobody looks at; a configuration fitted on the
smallest tier is complete when it spans that tier.

An entry naming an image the manifest does not declare, an image of the configuration's tier
or of the evaluation pool that the entry set omits, an entry for a training image outside
the configuration's tier, a repeated image, or a covered configuration missing its history
SHALL cause a refusal naming the configuration and the defect. A covered configuration SHALL
NOT be scored on the images that happen to be present.

#### Scenario: A covered configuration spans the whole pool
- **WHEN** a covered configuration's predictions are read
- **THEN** every image of its tier and every image of the evaluation pool has exactly one distribution

#### Scenario: Held-out images sit under the training split
- **WHEN** the training split's predictions are read
- **THEN** they include the held-out images alongside the fitted ones
- **AND** no third split name appears in the artifact

#### Scenario: A missing image refuses rather than shrinking the run
- **WHEN** a covered configuration omits a distribution for an image of its tier or of the evaluation pool
- **THEN** the artifact is refused naming that configuration and that image id
- **AND** no earnings figure is produced from the images that were present

#### Scenario: An image outside the configuration's tier is refused
- **WHEN** a covered configuration carries a distribution for a training image its tier does not hold
- **THEN** the artifact is refused naming that configuration, that image id and that tier

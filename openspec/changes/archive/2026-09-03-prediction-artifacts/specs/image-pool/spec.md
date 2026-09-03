## ADDED Requirements

### Requirement: The training split declares a validation role per image

The manifest SHALL declare, for every image of the training split, the role it plays in
training: fitted, or held out for validation. Both roles SHALL be non-empty, SHALL
together account for every training image and SHALL share none, and the held-out role
SHALL be the smaller of the two. The manifest SHALL declare each role's image count, and a
declared count disagreeing with the images assigned to it SHALL be refused naming the
role, the declared count and the actual count.

Every category the task declares SHALL appear in both roles, so that a validation loss is
measured over the same categories the fitted images cover. The role assignment SHALL be
derived from the pool seed, so that the same seed and parameters yield the same
assignment, and SHALL be stable across regeneration: an image keeps the role it had, and a
prediction artifact produced against those roles stays interpretable.

The role belongs to the training split alone. A role declared for an evaluation-pool
image, and a training image with no declared role, SHALL each be refused naming that image
id.

#### Scenario: The roles partition the training split
- **WHEN** the manifest is loaded
- **THEN** every training image carries exactly one role
- **AND** the two roles together account for all 200 training images and share none

#### Scenario: A declared role count that does not match its images is refused
- **WHEN** a role declares a count differing from the number of training images assigned to it
- **THEN** loading is refused naming the role, the declared count and the actual count

#### Scenario: Every category appears in both roles
- **WHEN** the roles are inspected
- **THEN** each declared category has at least one fitted image and at least one held-out image

#### Scenario: The same seed reproduces the roles
- **WHEN** the pool is generated twice from the same seed and parameters
- **THEN** each training image is assigned the same role in both runs

#### Scenario: Regeneration does not reassign roles
- **WHEN** a pool is regenerated
- **THEN** each training image keeps the role it had before
- **AND** a prediction artifact produced against those roles remains interpretable

#### Scenario: A role on an evaluation image is refused
- **WHEN** the manifest declares a training role for an image of the evaluation pool
- **THEN** loading is refused naming that image id

#### Scenario: A training image without a role is refused
- **WHEN** a training-split image declares no role
- **THEN** loading is refused naming that image id

## MODIFIED Requirements

### Requirement: Two splits of fixed size

A pool SHALL declare exactly two splits: a browsable training split of 200 images and an
evaluation pool of 1000 images. The manifest SHALL declare each split's image count, and a
declared count that disagrees with the images actually described SHALL be refused.

The roles declared within the training split SHALL NOT constitute a third split. Every
image SHALL belong to exactly one of the two splits; holding an image out for validation
SHALL change neither the split it belongs to nor the 200 images the training split
browses, and a manifest declaring any split beyond these two SHALL be refused naming it.

#### Scenario: The authored sizes hold
- **WHEN** the apple pool is loaded
- **THEN** the training split contains 200 images and the evaluation pool contains 1000

#### Scenario: A declared count that does not match its images is refused
- **WHEN** a split declares a count differing from the number of images assigned to it
- **THEN** loading is refused naming the split, the declared count and the actual count

#### Scenario: Splits do not overlap
- **WHEN** the manifest is loaded
- **THEN** every image belongs to exactly one split

#### Scenario: Holding images out does not shrink the browsable split
- **WHEN** the training split is browsed after a validation role is declared
- **THEN** all 200 training images are still presented
- **AND** the held-out ones are not excluded from browsing

#### Scenario: A third split is refused
- **WHEN** a manifest declares a split other than the training split and the evaluation pool
- **THEN** loading is refused naming that split

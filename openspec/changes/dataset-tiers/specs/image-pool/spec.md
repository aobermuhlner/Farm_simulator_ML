## ADDED Requirements

### Requirement: The manifest declares each training image's tier and each tier's label for it

For every image of the training split the manifest SHALL declare the smallest dataset tier
that holds it, and, for every tier that holds it, the label that tier files it under. A
declared label SHALL be one of the categories the task declares.

Tier membership SHALL nest: an image held by one tier SHALL be held by every larger tier of
the same task. The manifest therefore declares membership once, as the smallest tier an
image enters at, and every larger tier holds it by construction.

A tier SHALL NOT hold an image of the evaluation pool. A tier is a portion of the training
split and nothing else, because a model fitted on the harvest cannot show the gap the splits
exist to teach.

An image's entry tier and its per-tier labels SHALL be derived from the pool seed, so that
the same seed and the same parameters yield the same tiers and the same labels. Changing
which images a tier holds, or which labels it files them under, produces a new pool rather
than a reassignment within the old one.

The true category the manifest already declares for each image SHALL remain the only ground
truth. A tier label SHALL NOT be read as one: it records what a dataset claims, and a tier
whose claim differs from the truth is a tier that was labelled carelessly, not a manifest
that lied.

#### Scenario: Every training image declares its entry tier and its labels
- **WHEN** the manifest is loaded
- **THEN** every training image declares the smallest tier that holds it
- **AND** it declares a label for each tier that holds it

#### Scenario: An entry tier the task does not declare is refused
- **WHEN** a training image declares an entry tier that is the id of no tier the task declares
- **THEN** loading is refused naming that image id and that tier

#### Scenario: A label outside the declared categories is refused
- **WHEN** a tier files an image under a label that is not one of the task's declared categories
- **THEN** loading is refused naming the image id, the tier and that label

#### Scenario: A tier on an evaluation image is refused
- **WHEN** the manifest declares a tier or a tier label for an image of the evaluation pool
- **THEN** loading is refused naming that image id

#### Scenario: The same seed reproduces the tiers and the labels
- **WHEN** the pool is generated twice from the same seed and parameters
- **THEN** each training image enters at the same tier in both runs
- **AND** each tier files it under the same label in both runs

#### Scenario: Truth is still read from the category, never from a tier label
- **WHEN** a harvest is scored, or a training image's true category is needed
- **THEN** the category the manifest declares for that image is used
- **AND** no tier label is consulted

## MODIFIED Requirements

### Requirement: Two splits of fixed size

A pool SHALL declare exactly two splits: a browsable training split of 200 images and an
evaluation pool of 1000 images. The manifest SHALL declare each split's image count, and a
declared count that disagrees with the images actually described SHALL be refused.

The roles declared within the training split SHALL NOT constitute a third split. Every
image SHALL belong to exactly one of the two splits; holding an image out for validation
SHALL change neither the split it belongs to nor the 200 images the training split
browses, and a manifest declaring any split beyond these two SHALL be refused naming it.

A dataset tier SHALL NOT constitute a split either. A tier is a nested portion of the
training split, so an image's tier SHALL change neither the split it belongs to nor its
declared role, and the split counts the manifest declares SHALL count every training image
whatever tier it enters at.

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

#### Scenario: A tier is not a split
- **WHEN** the manifest declares tiers within the training split
- **THEN** the training split's declared count still counts every training image
- **AND** no tier is reported as a split

### Requirement: The training split declares a validation role per image

The manifest SHALL declare, for every image of the training split, the role it plays in
training: fitted, or held out for validation. Both roles SHALL be non-empty, SHALL
together account for every training image and SHALL share none, and the held-out role
SHALL be the smaller of the two. The manifest SHALL declare each role's image count, and a
declared count disagreeing with the images assigned to it SHALL be refused naming the
role, the declared count and the actual count.

Every category the task declares SHALL appear in both roles, so that a validation loss is
measured over the same categories the fitted images cover.

A role is declared once per image and independently of any tier. A tier's fitted and
held-out portions SHALL be the restriction of these roles to the images that tier holds.
For every declared tier both portions SHALL be non-empty and every category the task
declares SHALL appear in both, so that each tier is fitted and validated on the same
footing as every other, and a manifest where any tier fails this SHALL be refused naming the
tier, the role and the category. The held-out portion therefore grows with the tier: a
larger tier is judged against a larger yardstick drawn from the same distribution, rather
than against a fixed one that a bigger fit would outrun.

An image's role SHALL be fixed when the image is sampled, because the role determines the
distribution it is drawn from, and SHALL be derived from the pool seed, so that the same
seed and the same parameters yield the same roles and the same images. Roles are therefore
not additive over an existing pool: changing which distribution a role draws from produces
a new pool rather than a reassignment within the old one. A prediction artifact stays
interpretable because it is bound to the pool that produced it, not because roles survive
a change of parameters.

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
- **AND** the image behind each id is the same in both runs

#### Scenario: Regeneration does not reassign roles
- **WHEN** a pool is regenerated from the seed and parameters it was generated from
- **THEN** each training image keeps the role it had before
- **AND** a prediction artifact produced against those roles remains interpretable

#### Scenario: A pool whose parameters changed is a new pool
- **WHEN** the distribution a role draws from is changed and the pool is regenerated
- **THEN** the regenerated pool declares an identity distinguishable from the previous one
- **AND** a prediction artifact produced against the previous pool refuses naming the recorded and the loaded value, rather than scoring its predictions against images generated under the same ids

#### Scenario: A role on an evaluation image is refused
- **WHEN** the manifest declares a training role for an image of the evaluation pool
- **THEN** loading is refused naming that image id

#### Scenario: A training image without a role is refused
- **WHEN** a training-split image declares no role
- **THEN** loading is refused naming that image id

#### Scenario: Every tier is fitted and validated on every category
- **WHEN** the roles are restricted to the images of any declared tier
- **THEN** that tier has at least one fitted and at least one held-out image of every declared category

#### Scenario: A tier with an empty role is refused
- **WHEN** a declared tier holds no held-out image, or none of some declared category in either role
- **THEN** loading is refused naming the tier, the role and the category

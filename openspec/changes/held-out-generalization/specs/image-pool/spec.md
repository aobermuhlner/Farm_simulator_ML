## ADDED Requirements

### Requirement: The held-out role is drawn from the harvest's distribution

The training split's held-out images SHALL be drawn from the same distributions the
evaluation pool is drawn from: reds across the wider spread, including reds whose
attributes fall outside the band the fitted reds occupy, and wormy images across the full
worm-visibility range, including subtle worms whose remaining attributes sit inside that
band. Every category SHALL be drawn from the distribution its evaluation-pool images are
drawn from, so the held-out set is a small sample of the harvest rather than a sample of
what the model was fitted on.

Held-out performance is therefore an estimate of harvest performance, and the difference
between the fitted and held-out measurements of a run is the generalization gap. A pool
whose held-out images are confined to the fitted band SHALL be refused, naming the
category whose held-out images do not span the declared distribution: a held-out set that
cannot show the gap is the defect this requirement exists to prevent.

The held-out images SHALL remain part of the training split. They are browsable with the
rest of it and SHALL NOT constitute a split of their own.

#### Scenario: Held-out reds include reds outside the fitted band
- **WHEN** the held-out red images are compared against the band the fitted reds occupy
- **THEN** some of them fall outside it

#### Scenario: Held-out worms include subtle ones
- **WHEN** the held-out wormy images are inspected
- **THEN** some carry worm visibility below the lowest visibility any fitted wormy image carries
- **AND** their remaining attributes fall inside the band the fitted reds occupy

#### Scenario: Each category is held out from its harvest distribution
- **WHEN** the held-out images of a category are compared with that category's evaluation-pool images
- **THEN** both are drawn from the same declared distribution for that category

#### Scenario: A held-out set confined to the fitted band is refused
- **WHEN** every held-out image of a category falls inside the band the fitted images occupy
- **THEN** loading is refused naming that category

#### Scenario: Held-out images are still browsed with the split
- **WHEN** the training split is browsed
- **THEN** the held-out images are presented alongside the fitted ones as part of the same 200

### Requirement: The distribution gap between the fitted images and the harvest is authored

The images a model is fitted on and the images it is harvested over SHALL differ
deliberately in the ways the lessons depend on. Red images the model is fitted on SHALL
occupy a narrow band of hue, roundness and gloss. Red images in the evaluation pool SHALL
span a wider range, including reds whose attributes fall outside that fitted band. Wormy
images the model is fitted on SHALL have high worm visibility, and the evaluation pool
SHALL contain wormy images whose worm visibility is low and whose remaining attributes
fall inside the band the fitted reds occupy.

The band is a property of the fitted images rather than of the training split as a whole.
The training split also carries the held-out images, which are drawn from the evaluation
pool's distributions, so a statement about how the training split looks SHALL be read as a
statement about its fitted images.

#### Scenario: Fitted reds are uniform
- **WHEN** the attributes of the training split's fitted red images are compared
- **THEN** their hue, roundness and gloss fall within the declared fitted band

#### Scenario: The harvest contains reds the fitted images never showed
- **WHEN** the evaluation pool's red images are compared against the fitted band
- **THEN** the pool contains red images outside that band

#### Scenario: The harvest contains subtle worms on otherwise-perfect reds
- **WHEN** the evaluation pool's wormy images are inspected
- **THEN** some carry low worm visibility with hue, roundness and gloss inside the band the fitted reds occupy

#### Scenario: Fitted worms are obvious
- **WHEN** the training split's fitted wormy images are inspected
- **THEN** their worm visibility is high

## MODIFIED Requirements

### Requirement: The training split declares a validation role per image

The manifest SHALL declare, for every image of the training split, the role it plays in
training: fitted, or held out for validation. Both roles SHALL be non-empty, SHALL
together account for every training image and SHALL share none, and the held-out role
SHALL be the smaller of the two. The manifest SHALL declare each role's image count, and a
declared count disagreeing with the images assigned to it SHALL be refused naming the
role, the declared count and the actual count.

Every category the task declares SHALL appear in both roles, so that a validation loss is
measured over the same categories the fitted images cover.

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

## REMOVED Requirements

### Requirement: The distribution gap between the splits is authored

**Reason**: The gap is no longer between the two splits but between the fitted images and
the harvest. Three of this requirement's scenarios assert that the training split's reds
are uniform and its worms obvious, which this change deliberately makes false: the
training split now carries 40 held-out images drawn from the evaluation pool's
distributions. Keeping the requirement would leave the spec asserting both that the
training split is uniform and that part of it is not.

**Migration**: Replaced by "The distribution gap between the fitted images and the harvest
is authored", which states the same gap scoped to the fitted role, and by "The held-out
role is drawn from the harvest's distribution", which states where the remaining training
images come from. The evaluation pool's obligations are carried over unchanged.

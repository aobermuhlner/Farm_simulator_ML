## Purpose

Defines what an image pool declares — its identity, its two splits, and per image the
ground truth and generation attributes behind it — so that the distribution gap the
lessons depend on is authored, checkable, and reproducible rather than accidental.

## Requirements

### Requirement: Pool manifest completeness

A pool SHALL be described by a manifest declaring a stable pool id, the schema version it
was generated against, and its splits. For every image the manifest SHALL declare a
stable image id, the split it belongs to, its true category, the generation attributes it
was produced from, the measured features it was measured to have, and where its pixels are
delivered. A manifest missing any of these SHALL be refused rather than partially loaded,
and the refusal SHALL name what is missing.

The manifest therefore carries three kinds of number per image, and they are not
interchangeable. The true category is ground truth. The generation attributes are what
produced the pixels. The measured features are what the pixels turn out to look like when
somebody measures them, and they are neither ground truth nor a generation parameter — they
are an observation of the delivered image, recorded here so that it is made once and made
identically for everything that consumes the pool. A consumer SHALL NOT substitute one kind
for another.

The measured features declared per image SHALL be exactly the features the task declares,
with no feature missing and none recorded that the task does not declare. A disagreement
SHALL be refused naming the feature and the image.

#### Scenario: Complete manifest loads
- **WHEN** a manifest declares a pool id, schema version, splits, and every field for every image
- **THEN** the pool loads and its images, ground truth and measured features are available to the engine

#### Scenario: Incomplete manifest is refused
- **WHEN** a manifest omits a required field, for an image or for the pool
- **THEN** loading is refused naming the missing field and the image it belongs to
- **AND** no run is scored from that pool

#### Scenario: A missing feature is refused
- **WHEN** an image records no value for a feature the task declares
- **THEN** loading is refused naming that feature and that image id

#### Scenario: An undeclared feature is refused
- **WHEN** an image records a feature the task does not declare
- **THEN** loading is refused naming that feature and that image id

### Requirement: The manifest is the only source of ground truth

An image's true category SHALL be declared in the pool manifest and nowhere else.
Prediction artifacts SHALL NOT carry labels, and a consumer that needs an image's true
category SHALL read it from the manifest. An image that predictions exist for but the
manifest does not describe SHALL be refused rather than scored or guessed at.

#### Scenario: Scoring reads truth from the manifest
- **WHEN** a harvest is scored
- **THEN** each evaluated image's true category comes from the pool manifest

#### Scenario: An image with predictions but no declared truth is refused
- **WHEN** a prediction entry names an image the manifest declares no category for
- **THEN** scoring is refused naming that image id
- **AND** no earnings figure is produced for that run

### Requirement: Pool identity and version are checked against the task

A manifest's pool id SHALL equal the `pool` reference of the task declaration resolving
it, and its schema version SHALL equal the schema version that task declares. Either
mismatch SHALL fail visibly, naming both values, and SHALL NOT be tolerated with partial
data.

#### Scenario: Pool id mismatch stops the task
- **WHEN** a task references a pool id the loaded manifest does not declare
- **THEN** the task reports the mismatch naming both the referenced and the declared pool id
- **AND** the task does not run

#### Scenario: Pool schema version mismatch stops the task
- **WHEN** a manifest's schema version differs from the version its task declares
- **THEN** the task reports a version mismatch identifying both versions
- **AND** the task does not run

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

### Requirement: Every category is represented in both splits

Every category its task declares SHALL appear in both splits. A pool where a category is
absent from either split SHALL be refused, so that performance on the training split and
on the harvest are comparable per category.

#### Scenario: A category missing from a split is refused
- **WHEN** a manifest assigns a declared category to the evaluation pool but to no training image
- **THEN** loading is refused naming that category and the split it is missing from

### Requirement: Generation attributes are recorded per image

The manifest SHALL record, per image, the attributes it was generated from: hue,
roundness, gloss, lighting, and worm visibility as a graded value rather than a flag.
Attributes SHALL be recorded for every image in both splits, so that the distribution
difference between the splits is machine-checkable rather than asserted.

#### Scenario: Attributes are present for every image
- **WHEN** the manifest is loaded
- **THEN** every image in both splits carries a value for each declared attribute

#### Scenario: Worm visibility is graded
- **WHEN** wormy images are inspected
- **THEN** their worm visibility values span a range rather than a single value

### Requirement: Green is a controlled baseline

Green SHALL carry the same share of each split, its hue SHALL be separated from the red band
in both splits, and no green image SHALL carry a worm. No authored distribution difference
SHALL rely on green, so that it stays a stable reference rather than a confounding variable.

Separation in hue degrees SHALL NOT be taken as evidence that green is distinguishable from
red. The two bands SHALL additionally satisfy `colour-vision-safety` — verified
distinguishable under simulated deuteranopia and protanopia over the full range of the
attributes both categories are drawn from — because a hue gap says nothing about what a
student with a red/green deficiency sees, and green's whole purpose is to be the category a
model and a student can both take for granted.

#### Scenario: Green's share does not differ between splits
- **WHEN** the green proportion of each split is computed
- **THEN** the two proportions are equal within the declared tolerance

#### Scenario: No green image is wormy
- **WHEN** green images are inspected in either split
- **THEN** none of them carries worm visibility above zero

#### Scenario: Green is separated from red under simulated deficiency
- **WHEN** the green and red bands are measured under simulated deuteranopia and protanopia
- **THEN** every red-versus-green pair clears the declared distance
- **AND** the two categories' simulated lightness ranges do not overlap

### Requirement: The pool is reproducible from its seed

Generating a pool from the same seed and the same attribute parameters SHALL produce the
same images and the same manifest. Image ids SHALL be stable across regeneration, so that
prediction artifacts keyed to image ids survive a regeneration of the pool.

The seed a pool declares SHALL cover every parameter its pixels are drawn from, the palette
included, and not only the parameters its attributes are sampled from. A pool regenerated
after any of those parameters changed SHALL therefore declare a seed differing from the one
before, and a prediction artifact produced against the earlier pool SHALL refuse by seed.

This closes the case where recolouring the pool leaves the manifest byte-identical: the
attributes, the ids, the splits and the roles would all still match, so the binding a
prediction artifact relies on would see nothing wrong and would score one pool's predictions
against another pool's pixels. A pool is identified by what it looks like, not only by what
it records.

The seed SHALL NOT cover what the manifest merely records about pixels it did not change.
Measurement parameters are not drawing parameters: changing a detection threshold changes
the recorded feature values while every pixel stays as it was, so the seed stays as it was
too and the trained artifacts keep loading. What such a change does move is the manifest's
schema version, because a manifest that records different fields — or the same fields
measured under different declared parameters — is a different manifest schema, and a
consumer reading it needs to know. A prediction artifact bound to the previous schema
version SHALL therefore be re-stamped by re-running the export that produced it, which is
sound precisely because the pixels did not move and the probabilities come out unchanged.

#### Scenario: The same seed reproduces the pool
- **WHEN** the pool is generated twice from the same seed and parameters
- **THEN** both runs produce identical images and an identical manifest

#### Scenario: Regeneration does not renumber images
- **WHEN** a pool is regenerated
- **THEN** each image keeps the id, split and true category it had before
- **AND** existing prediction artifacts keyed to those ids remain resolvable

#### Scenario: A recoloured pool declares a different seed
- **WHEN** a palette parameter is changed and the pool is regenerated
- **THEN** the regenerated manifest declares a seed differing from the previous one
- **AND** a prediction artifact produced against the previous pool refuses naming both seeds

#### Scenario: A change that leaves the pixels alone leaves the seed alone
- **WHEN** the pool is regenerated after no drawing or sampling parameter has changed
- **THEN** the declared seed is unchanged
- **AND** the committed prediction artifacts still load

#### Scenario: A measurement change moves the schema version and not the seed
- **WHEN** a declared measurement parameter is changed and the pool is regenerated
- **THEN** the declared seed is unchanged and the atlases are byte-identical
- **AND** the declared schema version differs from the previous one

#### Scenario: An artifact bound to the previous schema version refuses until it is re-stamped
- **WHEN** a prediction artifact recording the previous schema version is loaded against the regenerated pool
- **THEN** loading is refused naming both schema versions
- **AND** re-running the export against the regenerated pool produces the same probabilities under the new schema version

### Requirement: Images are delivered in batches, not one request per image

Presenting a whole split SHALL NOT require one network request per image. The manifest
SHALL name, per image, the delivered resource its pixels live in and the region within
that resource. A region that falls outside its declared resource SHALL be refused.

#### Scenario: Browsing the training split is a bounded number of requests
- **WHEN** all 200 training images are presented
- **THEN** the number of image requests issued is bounded and independent of the image count

#### Scenario: An out-of-bounds region is refused
- **WHEN** an image's declared region does not fit inside its declared resource
- **THEN** loading is refused naming that image id

### Requirement: The training split enumerates in a stable order

The manifest SHALL expose the training split as an ordered enumeration, identical on
every load, so that a browsing screen pages through the same examples in the same order
for every student.

#### Scenario: Enumeration order is stable
- **WHEN** the training split is enumerated twice
- **THEN** both enumerations yield the same image ids in the same order

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

### Requirement: The body colour is a declared function of the hue attribute

The colour an image's body is filled with SHALL be declared as a function of the hue it was
drawn from: the saturation and the lightness per hue, interpolated between declared control
points and clamped outside them. It SHALL NOT depend on the image's category. Two images
drawn from the same hue SHALL be filled with the same colour whatever categories they belong
to.

Keeping the palette a function of the recorded attribute rather than of the category is what
keeps the pixels explainable from the manifest. A category-keyed palette would put a signal
in the images that the recorded attributes do not account for, and the distribution gap this
capability exists to make machine-checkable would stop being checkable from the attributes
alone.

The declared palette SHALL cover every hue the pool's bands can draw, so that no image is
filled with an interpolation off the end of the declaration.

#### Scenario: The same hue is the same colour in every category
- **WHEN** two images of different categories are drawn from the same hue
- **THEN** their bodies are filled with the same colour

#### Scenario: A hue between control points is interpolated
- **WHEN** an image is drawn from a hue lying between two declared control points
- **THEN** its saturation and lightness are interpolated between those two points

#### Scenario: Every drawable hue is covered by the declaration
- **WHEN** the declared bands are compared against the palette's control points
- **THEN** every hue the bands can draw falls inside the range the control points cover

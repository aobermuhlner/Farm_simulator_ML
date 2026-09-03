## Purpose

Defines what an image pool declares — its identity, its two splits, and per image the
ground truth and generation attributes behind it — so that the distribution gap the
lessons depend on is authored, checkable, and reproducible rather than accidental.

## Requirements

### Requirement: Pool manifest completeness

A pool SHALL be described by a manifest declaring a stable pool id, the schema version it
was generated against, and its splits. For every image the manifest SHALL declare a
stable image id, the split it belongs to, its true category, the generation attributes it
was produced from, and where its pixels are delivered. A manifest missing any of these
SHALL be refused rather than partially loaded, and the refusal SHALL name what is
missing.

#### Scenario: Complete manifest loads
- **WHEN** a manifest declares a pool id, schema version, splits, and every field for every image
- **THEN** the pool loads and its images and ground truth are available to the engine

#### Scenario: Incomplete manifest is refused
- **WHEN** a manifest omits a required field, for an image or for the pool
- **THEN** loading is refused naming the missing field and the image it belongs to
- **AND** no run is scored from that pool

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
evaluation pool of 1000 images. The manifest SHALL declare each split's image count, and
a declared count that disagrees with the images actually described SHALL be refused.

#### Scenario: The authored sizes hold
- **WHEN** the apple pool is loaded
- **THEN** the training split contains 200 images and the evaluation pool contains 1000

#### Scenario: A declared count that does not match its images is refused
- **WHEN** a split declares a count differing from the number of images assigned to it
- **THEN** loading is refused naming the split, the declared count and the actual count

#### Scenario: Splits do not overlap
- **WHEN** the manifest is loaded
- **THEN** every image belongs to exactly one split

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

### Requirement: The distribution gap between the splits is authored

The two splits SHALL differ deliberately in the ways the lessons depend on. Red images in
the training split SHALL occupy a narrow band of hue, roundness and gloss. Red images in
the evaluation pool SHALL span a wider range, including reds whose attributes fall
outside that training band. Wormy images in the training split SHALL have high worm
visibility, and the evaluation pool SHALL contain wormy images whose worm visibility is
low and whose remaining attributes fall inside the band the training reds occupy.

#### Scenario: Training reds are uniform
- **WHEN** the attributes of the training split's red images are compared
- **THEN** their hue, roundness and gloss fall within the declared training band

#### Scenario: The harvest contains reds the training split never showed
- **WHEN** the evaluation pool's red images are compared against the training band
- **THEN** the pool contains red images outside that band

#### Scenario: The harvest contains subtle worms on otherwise-perfect reds
- **WHEN** the evaluation pool's wormy images are inspected
- **THEN** some carry low worm visibility with hue, roundness and gloss inside the band the training reds occupy

#### Scenario: Training worms are obvious
- **WHEN** the training split's wormy images are inspected
- **THEN** their worm visibility is high

### Requirement: Green is a controlled baseline

Green SHALL carry the same share of each split, its hue SHALL be separated from the red
band in both splits, and no green image SHALL carry a worm. No authored distribution
difference SHALL rely on green, so that it stays a stable reference rather than a
confounding variable.

#### Scenario: Green's share does not differ between splits
- **WHEN** the green proportion of each split is computed
- **THEN** the two proportions are equal within the declared tolerance

#### Scenario: No green image is wormy
- **WHEN** green images are inspected in either split
- **THEN** none of them carries worm visibility above zero

### Requirement: The pool is reproducible from its seed

Generating a pool from the same seed and the same attribute parameters SHALL produce the
same images and the same manifest. Image ids SHALL be stable across regeneration, so that
prediction artifacts keyed to image ids survive a regeneration of the pool.

#### Scenario: The same seed reproduces the pool
- **WHEN** the pool is generated twice from the same seed and parameters
- **THEN** both runs produce identical images and an identical manifest

#### Scenario: Regeneration does not renumber images
- **WHEN** a pool is regenerated
- **THEN** each image keeps the id, split and true category it had before
- **AND** existing prediction artifacts keyed to those ids remain resolvable

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

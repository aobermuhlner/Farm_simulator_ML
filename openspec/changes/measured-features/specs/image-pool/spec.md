## MODIFIED Requirements

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

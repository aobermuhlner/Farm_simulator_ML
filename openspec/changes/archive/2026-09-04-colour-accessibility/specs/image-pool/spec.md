## ADDED Requirements

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

## MODIFIED Requirements

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

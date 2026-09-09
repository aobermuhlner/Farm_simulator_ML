## Purpose

Defines what a measured feature is — a number computed from an image's delivered pixels
rather than read from the parameters that produced it — how features are declared to the
student, and the guards that keep a feature set from teaching something false about
features or about what they can do.

What a feature set can achieve against a trained model is recorded here, because this is
where it can be measured. Whether one rung of the ladder ought to out-score another belongs
to the capability that declares rungs; this one supplies the measurement and forbids
misrepresenting it.

## Requirements

### Requirement: A feature is measured from delivered pixels and declared drawing geometry

A measured feature SHALL be computed from an image's delivered pixels and from drawing
geometry declared for the pool as a whole. It SHALL NOT read any value the manifest records
per image: not the image's true category, not its generation attributes, not its split and
not its training role.

Declared drawing geometry — where the shadow overlay and the specular highlight are placed
within a cell — is pool-wide declared data rather than per-image data, so a feature MAY
exclude those regions. This distinction is what the requirement turns on: masking a region
that is in the same place for every image tells the measurement nothing about *this* image,
whereas reading a recorded attribute tells it the answer.

A feature computed from a per-image manifest value SHALL be refused, and the refusal SHALL
name the feature and the value it read.

#### Scenario: Features are computed from the atlas
- **WHEN** the feature vector for an image is produced
- **THEN** every declared feature's value is derived from that image's delivered pixels and from pool-wide declared geometry

#### Scenario: A feature reading a generation attribute is refused
- **WHEN** a declared feature is computed from a value the manifest records for that image
- **THEN** measurement is refused naming the feature and the per-image value it read
- **AND** no manifest is written

#### Scenario: Excluding a declared overlay region is permitted
- **WHEN** a feature excludes the declared shadow or highlight region before measuring
- **THEN** the feature is accepted
- **AND** the region excluded is the same for every image in the pool

### Requirement: Measurement is reproducible and identical for every model

A feature's value SHALL be a pure function of the delivered pixels and the declared
measurement parameters. Measuring the same pool twice SHALL produce identical feature
vectors, and no feature SHALL draw on randomness, on wall-clock time, or on anything that
varies between machines.

Features SHALL be measured once, where the pool is produced, and recorded in the manifest.
They SHALL NOT be measured in the browser, so that every model evaluated against the pool
sees the same numbers and a student's results do not depend on their device.

#### Scenario: The same pool measures the same twice
- **WHEN** feature measurement is run twice over the same atlases with the same declared parameters
- **THEN** both runs produce identical feature vectors for every image

#### Scenario: Features are read, not recomputed, at run time
- **WHEN** a model is evaluated over the pool
- **THEN** every feature value it consumes is read from the manifest rather than measured from pixels

### Requirement: A measured feature is contaminated, and the contamination is declared

Each declared feature SHALL declare which generation attributes it is contaminated by: the
attributes that move its value without being the attribute it is nominally about. A
feature declaring no contamination SHALL be refused, because a feature that recovers one
attribute cleanly is that attribute under a different name and teaches nothing a measured
feature exists to teach.

The declared contamination SHALL be checkable against the pool: for every feature, at least
one declared contaminating attribute SHALL measurably move the feature's value within a
category, and a declared contamination that does not SHALL be refused naming the feature
and the attribute.

#### Scenario: Every feature declares what contaminates it
- **WHEN** the declared feature list is validated
- **THEN** each feature names at least one contaminating generation attribute

#### Scenario: A declared contamination that does not hold is refused
- **WHEN** a feature declares contamination by an attribute that does not move its value within a category
- **THEN** validation is refused naming the feature and the attribute

### Requirement: No declared feature is a duplicate or a constant

Two declared features SHALL NOT be reducible to one another, and no declared feature SHALL
be constant across the pool. A feature list where one feature is a monotone function of
another within the declared tolerance SHALL be refused naming both; a feature whose value
does not vary across the pool SHALL be refused naming it.

A student choosing between two names for the same number, or picking a threshold on a
number that never moves, learns something false about what a feature is. This is a
declaration-level check, not a matter of taste: it is why the apple task declares five
features rather than the seven that were sketched.

#### Scenario: A duplicated feature is refused
- **WHEN** two declared features are monotone functions of one another across the pool
- **THEN** validation is refused naming both features

#### Scenario: A constant feature is refused
- **WHEN** a declared feature takes the same value for every image in the pool
- **THEN** validation is refused naming that feature

### Requirement: No feature separates categories better on the evaluation split than on the fitted images

For every declared feature, the separation it achieves between categories over the
evaluation split SHALL NOT exceed the separation it achieves over the training split's
fitted images, beyond a declared tolerance. A feature that does SHALL be refused, naming
the feature and both measurements.

This is the trap the requirement exists to prevent. A feature that looks weak on the 200
images a student can browse and turns out strong on the evaluation split teaches the
reverse of every real distribution-shift lesson: the student inspects their own data,
correctly concludes the feature is useless, and is punished for reasoning correctly. A
feature may be weak everywhere, or weak on the evaluation split and strong on the fitted
images — that is overfitting, and it is the lesson. It may not be the other way round.

The comparison is against the evaluation split as a whole, not against a year's crop. A
crop is drawn under a composition that varies by year, and a guard about the authored gap
between the images a student fits on and the images they are scored over must not move with
one year's weather.

#### Scenario: Separation does not improve on the evaluation split
- **WHEN** each declared feature's category separation is measured over the fitted images and over the evaluation split
- **THEN** no feature's evaluation-split separation exceeds its fitted separation beyond the declared tolerance

#### Scenario: An inverted feature is refused
- **WHEN** a feature separates categories better on the evaluation split than on the fitted images beyond the tolerance
- **THEN** validation is refused naming the feature, its fitted separation and its evaluation-split separation

### Requirement: What the feature set can achieve against the shipped models is measured and recorded

The best rule expressible over the declared features within the declared node budget, with
its thresholds chosen against the training split's fitted images, SHALL be measured against
every trained configuration the task ships: in category scores over the evaluation split,
and in what it earns over a year's crop at the extremes of the declared composition. Those
figures SHALL be recorded.

The recorded figures SHALL be pinned. A change that moves any of them SHALL be refused until
the figure is re-recorded, naming the figure, its recorded value and its measured value.

Whether a hand-written rule beats a trained model is a measurement, not a property. It moves
when the pool moves, when a configuration is added, when the node budget grows, and it is
*meant* to move when the change that makes learned features necessary lands. A requirement
fixing its direction would have to be rewritten each time it legitimately changed, and would
demand the remedy from whichever capability happened to be under the hand rather than from
the one that owns the cause. What must hold is that it never moves unnoticed: a change that
alters the standing of hand-written rules against trained ones has to say so out loud, and
then has a number to aim at.

Both currencies are recorded because they can disagree, and because a student reads the
second. A score is comparable across changes; earnings are what the harvest report shows,
and a delivery term can reorder two models a score ranks the other way.

The figures SHALL be recorded at the largest node budget the task offers for hand-written
rules. A change that offers more SHALL re-record them, so that a budget a student can reach
is never one the recording has not been taken at.

#### Scenario: The figures are recorded against every shipped configuration
- **WHEN** the best rule within the declared node budget is fitted on the fitted images
- **THEN** its category scores over the evaluation split are recorded against every configuration the task ships
- **AND** what it earns over a year's crop is recorded against those same configurations, at the extremes of the declared composition

#### Scenario: A change that moves the figures is refused until they are re-recorded
- **WHEN** a measured figure differs from the recorded one
- **THEN** the change is refused naming the figure, its recorded value and its measured value

#### Scenario: Raising the node budget re-records the figures
- **WHEN** the task offers a larger node budget for hand-written rules than the figures were recorded at
- **THEN** the change is refused until the figures are re-recorded at the larger budget

### Requirement: The game claims no advantage the recorded figures do not show

No declared copy and no screen SHALL present one way of deciding an apple as better than
another where the recorded figures do not show it to be. Where the figures show the reverse,
the game MAY say what a model is *for*, and SHALL NOT say that it is better. A claim the
recorded figures contradict SHALL be refused, naming the claim and the figure.

This is what the ladder requirement was protecting, and it is true whichever way the figures
point. A student who buys a model on a promise of better accuracy and then measures worse
accuracy has been taught that measurement does not settle things — the opposite of the whole
exercise, and a lesson far more expensive than a bad harvest. The honest sentence when a
learned model does not yet win on the crop as it stands is about expressiveness: it can ask
questions the declared features cannot express, which is a claim about what it is for rather
than about what it currently earns.

#### Scenario: No shipped copy claims an unrecorded advantage
- **WHEN** the declared teaching copy, the declared market copy and the screens are inspected
- **THEN** none of them presents a model as better than another where the recorded figures do not show it

#### Scenario: A contradicted claim is refused
- **WHEN** declared copy claims an advantage the recorded figures measure the other way
- **THEN** loading is refused naming the claim and the recorded figure that contradicts it

### Requirement: Measurement sensitivity is declared data and its choice is recorded

Every parameter that decides what a measurement can and cannot detect — a detection
threshold, a minimum region size, the channel a comparison is made on — SHALL be declared
data rather than a constant buried in the measuring code, and each SHALL carry a recorded
reason for the value it holds.

The difficulty of a feature set is authored whether or not anyone admits it. Two defensible
spot detectors over these same pixels differ by more than a factor of two in how many worms
they find, so the sensitivity is a teaching decision, and an undeclared one is a teaching
decision made by accident. Recording it is the same discipline `prediction-artifacts`
already applies to deliberate shaping of a trained model's results.

#### Scenario: Sensitivities are declared with reasons
- **WHEN** the declared measurement parameters are inspected
- **THEN** every sensitivity parameter carries a declared value and a recorded reason

#### Scenario: An undeclared sensitivity is refused
- **WHEN** a feature's measurement depends on a threshold that is not declared
- **THEN** measurement is refused naming the feature and the undeclared parameter

### Requirement: Features are declared with the copy a student needs to pick a threshold

A task SHALL declare its features: for each, a stable id, a label, the unit or scale its
values are expressed on, the range it spans across the pool, and teaching copy saying what
the number means and how it is measured. A feature missing any of these SHALL be refused
naming it and the missing field.

A student sets a threshold on these numbers by hand, so a bare id is not enough: 0.06 has
to mean something before it can be chosen. The teaching copy SHALL describe the measurement
honestly, including that it is measured from the picture and can be wrong.

No screen SHALL name a particular feature. A screen presenting features SHALL render them
from the declaration, so that adding, removing or renaming a feature is a data change.

#### Scenario: A complete feature declaration loads
- **WHEN** a task declares each feature's id, label, unit, range and teaching copy
- **THEN** the feature list loads and is available to the screens that present it

#### Scenario: An incomplete feature declaration is refused
- **WHEN** a declared feature omits its label, unit, range or teaching copy
- **THEN** loading is refused naming the feature and the missing field

#### Scenario: The declared range matches the pool
- **WHEN** a feature's declared range is compared against its measured values across the pool
- **THEN** every measured value falls inside the declared range

#### Scenario: No screen names a feature
- **WHEN** the screens that present features are inspected
- **THEN** none of them names a particular feature id or label

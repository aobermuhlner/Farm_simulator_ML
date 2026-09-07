## Purpose

Defines the fitted-tree model family: a decision tree fitted offline to the starter set's
fitted images, shipped as the tree itself rather than as its predictions, and evaluated in
the browser over measured features — so that the rung where the data first finds a better
threshold than the student did, and first overfits doing it, teaches from figures a reviewer
can check rather than from numbers someone chose.

## ADDED Requirements

### Requirement: The family ships a fitted tree, not per-image predictions

The fitted-tree family's shipped artifact SHALL carry, per covered configuration, the
fitted tree's structure: for every internal node the declared feature it tests and the
threshold it tests against, and for every leaf its distribution over the task's declared
categories. It SHALL NOT carry a distribution per pool image.

Predictions for the family SHALL be obtained by evaluating that structure over an image's
measured feature vector, so that the tree a student is shown and the tree that scores their
harvest are the same object and cannot disagree.

#### Scenario: The artifact carries a structure
- **WHEN** a covered configuration of the fitted-tree family is read
- **THEN** it yields the tree's internal nodes with their feature and threshold, and its leaves with their distributions

#### Scenario: No per-image distributions are shipped
- **WHEN** the family's artifact is read
- **THEN** it contains no distribution keyed by a pool image id

#### Scenario: The drawn tree is the scoring tree
- **WHEN** a configuration is drawn on screen and then scored over the pool
- **THEN** both read the same shipped structure

### Requirement: A shipped tree is complete and evaluable, or it is refused

Every internal node of a shipped tree SHALL name a feature the pool manifest declares for
every image and a finite threshold within that feature's declared range, and SHALL have
exactly two children. Every path from the root SHALL terminate in a leaf. Evaluation SHALL
therefore reach exactly one leaf for every image the manifest declares, in both the training
split and the evaluation pool, without enumerating them.

A tree naming a feature the manifest does not declare for every image, a threshold outside
that feature's declared range or not finite, a node with other than two children, or a path
that does not terminate SHALL be refused naming the configuration and the defect. A shipped
tree SHALL NOT be evaluated over the images it happens to resolve.

#### Scenario: Every image reaches a leaf
- **WHEN** a shipped tree is evaluated over the pool
- **THEN** every manifest image of the training split and of the evaluation pool reaches exactly one leaf

#### Scenario: An undeclared feature refuses
- **WHEN** an internal node names a feature the pool manifest does not declare for every image
- **THEN** the artifact is refused naming that configuration and that feature
- **AND** no run is scored from it

#### Scenario: A non-terminating path refuses
- **WHEN** a path from the root reaches a node that is neither an internal node with two children nor a leaf
- **THEN** the artifact is refused naming that configuration and that node

### Requirement: A leaf carries a distribution over categories, never an action

A leaf SHALL carry one probability per declared category, each between zero and one, summing
to one within the tolerance the artifact declares. A leaf SHALL NOT carry a chosen action, a
predicted label, or an image's true category, and an artifact carrying one SHALL be refused
naming the field.

The decision rule SHALL remain a live computation over the leaf's distribution, applied by
the same policy that applies to every other family, so that what the robot does with a
confident-but-wrong leaf is a property of the policy rather than of the tree.

#### Scenario: A leaf decodes to a distribution
- **WHEN** a leaf is read
- **THEN** it yields one probability per declared category, each within zero to one, summing to one within the declared tolerance

#### Scenario: A leaf naming an action is refused
- **WHEN** a leaf carries an action, a predicted label or a true category
- **THEN** the artifact is refused naming that configuration, that leaf and that field
- **AND** no run is scored from it

#### Scenario: The policy decides, not the leaf
- **WHEN** an image reaches a leaf and an action is produced for it
- **THEN** the action follows from applying the declared decision policy to that leaf's distribution

### Requirement: The node budget is the family's capacity, and coverage follows what is purchasable

The fitted-tree family's capacity SHALL be the node budget the progression already sells,
expressed as the number of internal nodes a tree may contain. It SHALL NOT introduce a
separate capacity knob of its own, so that a budget bought for a hand-written tree also
raises the fitted tree's capacity and nothing purchased becomes obsolete.

The budget SHALL contribute to the family's configuration identity. The shipped artifact
SHALL cover every budget the catalog can put in a student's hands, including the budget owned
before any purchase; a budget the catalog sells but the artifact does not cover SHALL be
refused as untrained rather than fitted on demand or served from a nearby budget.

#### Scenario: A bought budget raises both families
- **WHEN** a node budget is owned
- **THEN** it caps the number of internal nodes of both the hand-written tree and the fitted tree

#### Scenario: Every purchasable budget is covered
- **WHEN** the catalog's fitted-tree budgets are enumerated
- **THEN** the shipped artifact covers a configuration for each of them, and for the budget owned before any purchase

#### Scenario: An uncovered budget refuses as untrained
- **WHEN** a budget outside the artifact's coverage is selected
- **THEN** the refusal reports that no model was fitted for it, naming the configuration
- **AND** no tree is fitted at run time and no other budget's tree is used in its place

### Requirement: The growth history is indexed by splits added, and the trees are nested

A covered configuration's history SHALL carry one entry per internal node the fitted tree
contains, numbered contiguously from the first split to the last with none missing or
repeated. Entry *k* SHALL describe the tree holding the first *k* splits, and the tree at
*k* splits SHALL be a prefix of the tree at *k+1* — each step adding one split and changing
no earlier one — so that the history describes one tree growing rather than a series of
unrelated fits.

An entry for a split the fitted tree does not contain, an omitted split, or a step that
alters an earlier split's feature or threshold SHALL cause a refusal naming the
configuration and the step.

#### Scenario: Steps are contiguous and match the tree
- **WHEN** a configuration's history is read
- **THEN** it contains one entry per internal node of its shipped tree, numbered contiguously, with no gap or duplicate

#### Scenario: Growth is nested
- **WHEN** the tree at step *k* is compared with the tree at step *k+1*
- **THEN** every split present at *k* is present at *k+1* with the same feature and threshold
- **AND** exactly one split has been added

#### Scenario: A step that rewrites an earlier split is refused
- **WHEN** a step changes the feature or threshold of a split an earlier step established
- **THEN** the artifact is refused naming that configuration and that step

### Requirement: The history's losses are measured on the declared roles, in the same units as the convolutional family

Each history entry's training loss and accuracy SHALL be measured over the training split's
fitted images and its validation loss and accuracy over the training split's held-out images.
No held-out image SHALL influence any split's feature or threshold, or any leaf's
distribution.

Loss SHALL be the negative log likelihood the tree's leaf distributions assign to those
images' declared categories — the same quantity the convolutional family records — so that
the two families' curves are in one unit and a student climbing the ladder reads one chart.

#### Scenario: Validation figures are measured on unfitted images
- **WHEN** a step's validation loss and accuracy are produced
- **THEN** they are measured over the training split's held-out images
- **AND** those images contributed to no split and no leaf distribution

#### Scenario: Loss is comparable across families
- **WHEN** a fitted-tree history and a convolutional history are read for the same pool
- **THEN** both losses are negative log likelihoods over the same declared categories and the same populations

### Requirement: The fitted-versus-held-out gap widens with the budget, and it is measured

The difference between a configuration's final fitted accuracy and its final held-out
accuracy SHALL be measured from the shipped artifact and recorded for every covered budget.
Across the covered budgets in increasing order, that difference SHALL not decrease, because
the rung exists to show that spending capacity buys agreement on the fitted photos faster
than it buys agreement on unseen ones.

A shipped artifact whose recorded gaps decrease as the budget rises SHALL be refused as a
shipped artifact, naming the budgets whose gaps invert. The gaps SHALL be recorded as
measured; adjusting them to widen SHALL be a recorded shaping step or not done at all.

#### Scenario: Gaps are recorded per budget
- **WHEN** a shipped fitted-tree artifact is reviewed
- **THEN** the fitted and held-out accuracy and their difference are recorded for every covered budget

#### Scenario: An inverting gap is not shippable
- **WHEN** a larger budget's recorded gap is narrower than a smaller budget's
- **THEN** the artifact is refused as a shipped artifact, naming both budgets
- **AND** it is not served to the app

### Requirement: The fitted tree clears a declared reference tree by a recorded margin

The family SHALL declare a reference hand-written tree — a tree of the kind a student writes
at the rung below, within the budget owned before any purchase — and the producing pipeline
SHALL measure both that reference tree and the fitted tree of the same budget over the
evaluation pool and record the difference.

The recorded margin SHALL be positive, so the purchase is worth making, and SHALL fall
within the band the family declares, so the rung below does not read as wasted. A margin
outside that band SHALL be reported as a finding naming the measured value and the declared
band; it SHALL NOT be corrected by re-declaring the band to contain whatever was measured.

#### Scenario: The margin is measured and recorded
- **WHEN** a shipped fitted-tree artifact is produced
- **THEN** the reference tree's and the fitted tree's figures over the evaluation pool are recorded, with their difference

#### Scenario: A fitted tree no better than the reference is a finding
- **WHEN** the recorded margin is not positive
- **THEN** it is reported as a finding naming the measured value

#### Scenario: A margin outside the declared band is a finding
- **WHEN** the recorded margin falls outside the declared band
- **THEN** it is reported as a finding naming the measured value and the band

### Requirement: Fitting reads measured features and nothing else

The producing pipeline SHALL obtain the numbers it fits on from the pool manifest's measured
feature vectors alone. It SHALL NOT read an image's pixels, and it SHALL NOT read a
generation attribute or any value derived from one.

A fitting run given a feature the manifest records as derived from a generation attribute, or
attempting to read an attribute or a delivered image, SHALL be refused naming the feature or
the attribute, so that the rung cannot be made to read the answer sheet.

#### Scenario: Fitting reads the manifest's features
- **WHEN** a fitting run reads its inputs
- **THEN** every number it fits on comes from a measured feature vector the manifest declares

#### Scenario: An attribute-derived feature refuses
- **WHEN** a fitting run is given a feature derived from a generation attribute
- **THEN** the run is refused naming that feature
- **AND** no artifact file is written

### Requirement: The family names its own history axis

The fitted-tree family SHALL declare the name its history's steps are shown under, and a
screen displaying that history SHALL take the name from the declaration. A screen SHALL NOT
write the step name of any one family into itself, because the convolutional family counts
epochs and this one counts splits, and a screen that names either has named a family.

A family whose declaration omits the step name SHALL be refused rather than shown under a
default.

#### Scenario: The axis is named by the family
- **WHEN** a fitted-tree history is displayed
- **THEN** its steps are labelled with the name the family declares

#### Scenario: A missing step name refuses
- **WHEN** a family declaration omits its history's step name
- **THEN** the declaration is refused naming the family and the missing field

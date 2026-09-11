## Purpose

Defines the fitted-tree model family: a decision tree shipped as the tree itself rather than
as a table of its predictions, evaluated in the browser over measured features, bought
through the catalog and reached only by passing the comprehension puzzle that gates it — so
that the frame the architecture promises is carried by a second family rather than only by
the one it was built around.

The trees this change ships are placeholders, authored rather than fitted, per `CLAUDE.md` —
*This is a prototype: build the frame before the contents*. What that costs is written down
here: the family records no history, claims no fit, and is required to say so. What a real
fit must then exhibit is deferred with the fitting, and belongs to the change that lands it.

## Requirements

### Requirement: The family ships a fitted tree, not per-image predictions

The fitted-tree family's shipped artifact SHALL carry, per covered configuration, the
tree's structure: for every internal node the declared feature it tests and the
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

The family's capacity SHALL be a node budget, expressed as the number of internal nodes a
tree may contain, sold through the catalog like every other capacity in the game. It SHALL
NOT introduce a second capacity knob of its own.

The budget SHALL contribute to the family's configuration identity. The shipped artifact
SHALL cover every budget the catalog can put in a student's hands, including the budget owned
before any purchase; a budget the catalog sells but the artifact does not cover SHALL be
refused as uncovered rather than built on demand or served from a nearby budget.

#### Scenario: Every purchasable budget is covered
- **WHEN** the catalog's budgets for this family are enumerated
- **THEN** the shipped artifact covers a configuration for each of them, and for the budget owned before any purchase

#### Scenario: An uncovered budget refuses
- **WHEN** a budget outside the artifact's coverage is selected
- **THEN** the refusal names the configuration and reports that no model covers it
- **AND** no tree is produced at run time and no other budget's tree is used in its place

### Requirement: The family reads measured features and nothing else

Evaluating this family SHALL obtain every number it reads from the pool manifest's measured
feature vectors alone. It SHALL NOT read an image's pixels, and it SHALL NOT read a generation
attribute or any value derived from one. The same SHALL hold of whatever later produces its
trees.

A tree naming a feature the manifest records as derived from a generation attribute, or an
evaluator attempting to read an attribute or a delivered image, SHALL be refused naming the
feature or the attribute, so that this family cannot be made to read the answer sheet.

#### Scenario: Evaluation reads the manifest's features
- **WHEN** the family evaluates an image
- **THEN** every number it reads comes from a measured feature vector the manifest declares

#### Scenario: An attribute-derived feature refuses
- **WHEN** a tree names a feature derived from a generation attribute
- **THEN** it is refused naming that feature
- **AND** no configuration resolves from it

### Requirement: The family is reached by passing the comprehension puzzle

The family SHALL declare the tutorial that gates it. Owning it without having passed that
tutorial SHALL withhold putting it to work and SHALL withhold nothing else, exactly as
`model-tutorials` requires of any gated family.

The binding is a requirement rather than a declaration detail because it is the whole of what
makes this rung reached by understanding rather than by paying. A build in which the family
is owned and immediately fieldable has lost that, silently, and nothing else would catch it.

#### Scenario: The family declares its gate
- **WHEN** the family's declaration is read
- **THEN** it names the tutorial that must be passed before it may be put to work

#### Scenario: Owned but unsolved withholds only the work
- **WHEN** the family is owned and its tutorial has not been passed
- **THEN** it cannot be put to work
- **AND** it can still be selected, configured and read about

### Requirement: A placeholder tree is recorded as one, and nothing claims a fit that did not happen

A shipped tree that was authored rather than fitted SHALL record that in its own provenance.
Nothing downstream SHALL have to infer it from an absent history, a missing seed, or the date
on a file.

No declared copy and no screen SHALL state or imply that a placeholder tree was fitted to any
images: not that it learned, not that it was trained, not that it was fitted to the photos the
student owns. A claim of a fit that did not happen SHALL be refused, naming the claim.

The prototype rule permits shipping a model that is not fitted. It does not permit saying one
was. These are the same standard the convolutional family is already held to for its replayed
history, applied to the case where there is no run to replay at all.

#### Scenario: A placeholder records what it is
- **WHEN** a shipped tree's provenance is read
- **THEN** it states whether the tree was authored or fitted, and by what

#### Scenario: A tree claiming a fit it cannot show is refused
- **WHEN** a shipped tree records that it was fitted without recording what fitted it
- **THEN** the artifact is refused naming that configuration

#### Scenario: No copy claims a fit that did not happen
- **WHEN** the declared teaching copy and the screens presenting this family are inspected
- **THEN** none of them states or implies that a placeholder tree was fitted to any images

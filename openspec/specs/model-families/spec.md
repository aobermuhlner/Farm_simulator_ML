## Purpose

Defines what a model family is as declared data — the several kinds of model one task can
offer, what each of them ships to the browser, and the single shape everything downstream
resolves them through — so that a rung of the learning ladder can be added as a declaration
rather than as a second copy of the workshop, the scoring and the report.

## Requirements

### Requirement: A task declares its model families, and one of them is selected

A task SHALL declare at least one model family. Each family SHALL declare a stable id
unique within its task, a student-facing label, the knobs it exposes, what it ships, its
teaching copy, and how it appears in a labour slot. A task declaring no family SHALL be
refused at load, and a task declaring two families with the same id SHALL be refused naming
that id.

Exactly one of a task's families SHALL be selected at any time, WHERE any of them is
available to the student. The selected family SHALL decide which knobs the workshop presents
and which model the workshop is making. WHEN progress states nothing about which family is
selected, the first declared family that is available SHALL be selected, rather than none
and rather than a family that cannot be selected. WHEN progress records a family that has
since become unavailable, the same rule SHALL apply, so a farm always opens on something it
can use.

WHEN no family of a task is available, none SHALL be selected. The task SHALL present every
family it declares with what opens each, SHALL offer no knobs and no model to make, and
SHALL NOT report the absence as a failure — a farm that has not yet bought a model for a
task is a farm at the start of the game, not a farm in an invalid state. What that task's
crop is brought in by in the meantime is the farm's labour to decide, unchanged.

Selecting a family SHALL move no money, append no record to the ledger, and leave the year
as it was.

#### Scenario: A task's families are read from its declaration
- **WHEN** a task declaring several families is loaded
- **THEN** each declared family is available to be selected by its declared id and label
- **AND** no family the declaration does not carry is offered

#### Scenario: A task declaring no family is refused
- **WHEN** a task declaration carries no model family
- **THEN** the declaration is refused naming that omission
- **AND** the task is not loaded

#### Scenario: Duplicate family ids are refused
- **WHEN** a task declares two families with the same id
- **THEN** the declaration is refused naming that id

#### Scenario: Silence selects the first declared family
- **WHEN** a task is presented and progress states nothing about which family is selected
- **THEN** the first declared family that is available is selected

#### Scenario: A locked first family is passed over
- **WHEN** the first declared family is not available and a later one is
- **THEN** the later one is selected
- **AND** the locked one is presented with what opens it

#### Scenario: A recorded family that has become unavailable is not selected
- **WHEN** progress records a family that is no longer available
- **THEN** the first declared available family is selected instead

#### Scenario: A task with no available family selects none
- **WHEN** every family a task declares is locked
- **THEN** none is selected and no knobs are offered
- **AND** each family is presented with what opens it
- **AND** nothing reports the absence as a failure

#### Scenario: Selecting a family costs nothing
- **WHEN** a different family is selected
- **THEN** the balance, the ledger and the year are as they were

### Requirement: A family declares what it ships, and that is what decides how it predicts

Each family SHALL declare whether the pipeline ships its model or a table of its
predictions. A family shipping its model SHALL be evaluated in the browser over the
measured features the task declares. A family shipping predictions SHALL have its
distributions looked up in the frozen artifact its declaration names, and SHALL NOT be
evaluated in the browser.

What a family ships SHALL be declared rather than inferred from the family's id, its knobs,
its architecture, or whether an artifact happens to be present. A family declaring neither,
or declaring something the system does not support, SHALL be refused at load naming what it
declared.

#### Scenario: A model-shipping family is evaluated over measured features
- **WHEN** a family declaring that its model ships resolves a configuration
- **THEN** its distributions are computed in the browser from the task's measured features
- **AND** no table of per-image predictions is fetched for it

#### Scenario: A prediction-shipping family is looked up
- **WHEN** a family declaring that its predictions ship resolves a configuration
- **THEN** its distributions are read from the artifact its declaration names
- **AND** nothing recomputes them in the browser

#### Scenario: An unsupported shipped form is refused
- **WHEN** a family declares a shipped form the system does not support
- **THEN** the declaration is refused naming that form
- **AND** the task is not loaded

### Requirement: A family resolves a configuration to one entry, whatever it ships

Resolving a configuration against a family SHALL yield a single entry carrying that
configuration's training history, where it has one, together with the means to obtain a
probability distribution over the task's declared categories for any image of the task's
pool. Both SHALL come from the same entry, so that a history and a distribution can never
refer to different configurations.

A family SHALL NOT yield a chosen action, a label, or an outcome. Converting a distribution
into an action SHALL remain the declared decision policy's live computation, exactly as it
is for a task with one family.

Resolution SHALL be refused, naming its cause, when the family has no entry for that
configuration, when what it ships is bound to a different task, family or pool than the one
being resolved, and when a distribution it yields is not a valid distribution over the
task's declared categories.

#### Scenario: One entry carries the history and the predictions
- **WHEN** a configuration is resolved against a family that has a history
- **THEN** the history and the distributions returned belong to that same configuration

#### Scenario: A family with no history resolves anyway
- **WHEN** a configuration is resolved against a family that records no training history
- **THEN** the resolution succeeds and yields distributions
- **AND** nothing reports a missing history as a failure

#### Scenario: A family yields no decision
- **WHEN** any family resolves a configuration and its distributions are read
- **THEN** what it yields is a probability distribution over the declared categories
- **AND** no action, label or outcome is carried with it

#### Scenario: An unusable distribution is refused with its cause
- **WHEN** a family yields a value that is not a valid distribution over the task's declared categories
- **THEN** the resolution is refused naming the image and the cause
- **AND** no crop is scored from it

### Requirement: Configuration identity is scoped to the family that composed it

A configuration identifier SHALL be composed from the knob ids and values of one family,
and SHALL be resolved only against that family. Two families of the same task SHALL be able
to compose the same identifier string without either resolving to the other's model.

An identifier SHALL NOT gain, lose or reorder parts because a task declares more families
than it did. A family whose knobs are unchanged SHALL compose exactly the identifiers it
composed when its task declared it alone, so that shipped predictions already keyed by those
identifiers continue to resolve unchanged.

#### Scenario: The same string in two families names two models
- **WHEN** two families of one task each compose the same identifier string
- **THEN** each resolves against its own family
- **AND** neither resolves to the other's entry

#### Scenario: Shipped identifiers survive the task gaining families
- **WHEN** a task that declared one family is redeclared with that family plus others, its knobs unchanged
- **THEN** that family composes the identifiers it composed before
- **AND** the predictions already shipped for them resolve unchanged

### Requirement: Knob values are remembered for each family separately

Progress SHALL record the knob values a student set for each family independently. Setting a
value on one family SHALL leave every other family's values as they were. WHEN a family is
selected and progress records no values for it, its knobs SHALL sit at their declared
defaults.

#### Scenario: Tuning one family does not disturb another
- **WHEN** a knob of one family is changed and a different family is then selected
- **THEN** the second family's knob values are the values it last held

#### Scenario: A family never tuned opens at its defaults
- **WHEN** a family is selected for which progress records no values
- **THEN** its knobs sit at their declared defaults

### Requirement: A history's axis is declared, and a family may have none

WHEN a family records a training history, its declaration SHALL name what that history is
indexed by, in words a student reads. Nothing SHALL present a history's index under a name
of its own. A family that records no history SHALL declare none, and SHALL NOT be presented
with an empty curve or a zero-length axis.

#### Scenario: The axis is presented as declared
- **WHEN** a family whose history is indexed by something other than epochs is presented
- **THEN** its history is labelled with the term its declaration names
- **AND** no screen supplies a term of its own

#### Scenario: A family without a history shows none
- **WHEN** a family that records no history is selected
- **THEN** no training history is presented for it
- **AND** nothing reports its absence as a failure

### Requirement: A family declares how it appears in a labour slot

Each family SHALL declare the icon and the short label by which a student recognises it in
a task's labour slot, so that the farm can be read at a glance for which family is working
which crop. What fills a labour slot SHALL be presented from that declaration, and a screen
SHALL NOT supply an icon or a label of its own for any family. The farm's manual labour
SHALL keep supplying its own, since the hands are the absence of a family.

#### Scenario: A slot is presented from the family's declaration
- **WHEN** a task worked by a model is presented on the farm overview
- **THEN** its slot shows the icon and short label that family declares

#### Scenario: A new family needs no screen change to be recognised
- **WHEN** a task is declared with a family the shell has never presented
- **THEN** its slot renders from that family's declared icon and label
- **AND** no screen code is added or changed for it

### Requirement: No screen names a model family

No model family id, family label, or family-specific vocabulary declared by a family SHALL
appear in screen code, and no screen SHALL branch on one. A family's drawing and a family's
tutorial each name exactly their own family and nothing else; every other screen SHALL be
produced from the declaration alone.

#### Scenario: An unrelated family renders without screen changes
- **WHEN** a task is declared with a family whose id, label and knobs the shell has never seen
- **THEN** it is offered, configured, put to work and reported through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: Nothing branches on which family is selected
- **WHEN** screen code is inspected for the families the declarations carry
- **THEN** no family id or label appears in it outside that family's own drawing and tutorial

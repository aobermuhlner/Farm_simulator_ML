## ADDED Requirements

### Requirement: A tutorial states what it simplifies, and it is not hidden

Every tutorial SHALL declare what it withholds or simplifies relative to the model it
teaches, as a field of its own rather than as a passage inside its theory copy. A tutorial
omitting it SHALL be refused at load with the family and the missing field named, and the task
SHALL NOT be loaded.

That statement SHALL be presented in plain view wherever the puzzle is presented: it SHALL NOT
be collapsed, SHALL NOT sit behind a control the student has to operate, and SHALL NOT be
reachable only by scrolling past the puzzle's own controls. A simplification a student would
notice by reading the source has to be said where it lands, and one sentence that is read is
worth more than three paragraphs that are not.

Theory copy MAY remain behind a disclosure, as it does on every other screen. This requirement
is about the one statement a tutorial makes about itself, not about the theory beside it.

#### Scenario: The statement is shown without being opened

- **WHEN** a tutorial is presented
- **THEN** what it simplifies is readable without operating any control
- **AND** it appears with the puzzle rather than in place of it

#### Scenario: A tutorial omitting it is refused

- **WHEN** a family's tutorial declares no statement of what it simplifies
- **THEN** the refusal names that family and the missing field
- **AND** the task is not loaded

#### Scenario: Theory may still sit behind a disclosure

- **WHEN** a tutorial is presented
- **THEN** its theory copy may be behind a disclosure
- **AND** that does not satisfy the statement of what it simplifies

## MODIFIED Requirements

### Requirement: A tutorial is declared data, keyed to a model family

A model family MAY declare a tutorial. A family declaring none SHALL be put to work as
soon as it is owned, exactly as every family is today, so that adding a tutorial to one
family changes nothing about any other.

A declared tutorial SHALL carry a stable id, a student-facing title, its theory copy, what it
simplifies, the kind of puzzle it is, and whatever data that kind needs to be posed and
judged. What the tutorial teaches, what it says, and what counts as solving it SHALL all be
read from that declaration; no screen SHALL supply any of them.

A tutorial omitting a required field, carrying one of the wrong shape, or declaring a kind
of puzzle this build does not recognise SHALL be refused at load with the family and the
defect named, and the task SHALL NOT be loaded. A kind that is not recognised SHALL be
refused rather than ignored, because a tutorial that silently poses nothing is a gate that
silently opens.

A kind checking its own puzzle data SHALL be given the declaration of the task the family
belongs to. A puzzle naming a category or a feature that task does not declare SHALL therefore
be refused at load with the family and the undeclared name given, and the task SHALL NOT be
loaded. Without the declaration no kind could hold a puzzle to the task's own vocabulary, and a
puzzle that invents a category is a puzzle whose answer means nothing the rest of the game
recognises.

Being given the declaration SHALL NOT let the frame branch on which family is being taught: a
task declaration is not a family, and how a tutorial is opened, presented, judged, recorded and
used as a gate SHALL still be decided without reference to any family.

#### Scenario: A family declaring no tutorial is gated by nothing

- **WHEN** a family that declares no tutorial is owned
- **THEN** it can be put to work immediately
- **AND** nothing presents a tutorial for it

#### Scenario: A declared tutorial is read from the declaration

- **WHEN** a family declaring a tutorial is presented
- **THEN** its title, its theory copy and what it simplifies are the ones the declaration carries
- **AND** no screen supplies a title or copy of its own

#### Scenario: A tutorial missing a required field is refused

- **WHEN** a family's tutorial omits its theory copy
- **THEN** the refusal names that family and the missing field
- **AND** the task is not loaded

#### Scenario: An unrecognised kind of puzzle is refused, not ignored

- **WHEN** a tutorial declares a kind of puzzle this build does not recognise
- **THEN** the refusal names that kind
- **AND** the task is not loaded

#### Scenario: A puzzle naming a category the task does not declare is refused

- **WHEN** a tutorial's puzzle names a category the task declaring it does not declare
- **THEN** the refusal names that family and that category
- **AND** the task is not loaded

#### Scenario: A puzzle naming a feature the task does not declare is refused

- **WHEN** a tutorial's puzzle names a measured feature the task declaring it does not declare
- **THEN** the refusal names that family and that feature
- **AND** the task is not loaded

### Requirement: Each kind of puzzle is separately mountable, and only it names its family

The body of each supported kind of tutorial SHALL be usable on its own, given that
tutorial's declared data and nothing else: no task declaration, no screen state, and no
other kind's body. Selecting which body to mount SHALL be separable from the bodies
themselves, so that adding a kind later does not require changing an existing kind's body.

A kind whose puzzle is about particular images of the task's pool MAY additionally be given the
images of that pool's browsable split, and SHALL be given them only where it declares that it
needs them. A body needing none SHALL still be usable on its declared data alone. Nothing else
of the pool SHALL be given to any body: in particular no generation attribute and no measured
feature value, so a puzzle that turns on a measurement SHALL carry that measurement in its own
declared data.

Whether an answer passes SHALL NOT depend on those images. A body given them SHALL state, where
they are being fetched or cannot be fetched, that this is so and why, and SHALL offer no answer
until they are present — but the judgement of an answer SHALL rest on declared data alone, so
the frame and the gate can never disagree about what solving the puzzle means.

The interaction is the lesson and therefore cannot be data-driven, so a body MAY name the
family it teaches and SHALL name no other. The frame around it — the way a tutorial is
opened, presented, judged, recorded and used as a gate — SHALL name no family at all.

#### Scenario: A body is used directly

- **WHEN** a tutorial's declared data is supplied to that kind's body
- **THEN** the puzzle is posed
- **AND** no task declaration, screen state or other kind's body is required
- **AND** where that kind declares it needs the browsable split's images, those are the only further thing it is given

#### Scenario: Adding a kind leaves existing bodies untouched

- **WHEN** support for a further kind of tutorial is added
- **THEN** the existing kinds' bodies are unchanged
- **AND** the frame is unchanged

#### Scenario: The frame names no family

- **WHEN** the tutorial frame's code is inspected
- **THEN** no family id or family label appears in it
- **AND** nothing branches on which family is being taught

#### Scenario: A body is given no pool data beyond the pictures

- **WHEN** a body is given the browsable split's images
- **THEN** no generation attribute and no measured feature value reaches it with them
- **AND** a puzzle turning on a measurement carries that measurement in its own declared data

#### Scenario: Pictures that cannot be fetched are stated, and judgement is unaffected

- **WHEN** a body's pictures cannot be fetched
- **THEN** the body states that and why
- **AND** no answer can be offered
- **AND** the same answer offered later is judged on declared data alone

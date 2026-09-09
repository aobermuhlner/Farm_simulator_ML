## Purpose

Defines the comprehension gate a student passes once, for free, between owning a model
family and putting it to work: the tutorial as declared data keyed to a family, its
generic frame and its separately-mountable body, completion as the only thing recorded,
and the load-time refusal of a puzzle that cannot be won — so that a rung of the ladder is
reached by understanding it rather than only by paying for it.

## ADDED Requirements

### Requirement: A tutorial is declared data, keyed to a model family

A model family MAY declare a tutorial. A family declaring none SHALL be put to work as
soon as it is owned, exactly as every family is today, so that adding a tutorial to one
family changes nothing about any other.

A declared tutorial SHALL carry a stable id, a student-facing title, its theory copy, the
kind of puzzle it is, and whatever data that kind needs to be posed and judged. What the
tutorial teaches, what it says, and what counts as solving it SHALL all be read from that
declaration; no screen SHALL supply any of them.

A tutorial omitting a required field, carrying one of the wrong shape, or declaring a kind
of puzzle this build does not recognise SHALL be refused at load with the family and the
defect named, and the task SHALL NOT be loaded. A kind that is not recognised SHALL be
refused rather than ignored, because a tutorial that silently poses nothing is a gate that
silently opens.

#### Scenario: A family declaring no tutorial is gated by nothing

- **WHEN** a family that declares no tutorial is owned
- **THEN** it can be put to work immediately
- **AND** nothing presents a tutorial for it

#### Scenario: A declared tutorial is read from the declaration

- **WHEN** a family declaring a tutorial is presented
- **THEN** its title and theory copy are the ones the declaration carries
- **AND** no screen supplies a title or copy of its own

#### Scenario: A tutorial missing a required field is refused

- **WHEN** a family's tutorial omits its theory copy
- **THEN** the refusal names that family and the missing field
- **AND** the task is not loaded

#### Scenario: An unrecognised kind of puzzle is refused, not ignored

- **WHEN** a tutorial declares a kind of puzzle this build does not recognise
- **THEN** the refusal names that kind
- **AND** the task is not loaded

### Requirement: Each kind of puzzle is separately mountable, and only it names its family

The body of each supported kind of tutorial SHALL be usable on its own, given that
tutorial's declared data and nothing else: no task declaration, no screen state, and no
other kind's body. Selecting which body to mount SHALL be separable from the bodies
themselves, so that adding a kind later does not require changing an existing kind's body.

The interaction is the lesson and therefore cannot be data-driven, so a body MAY name the
family it teaches and SHALL name no other. The frame around it — the way a tutorial is
opened, presented, judged, recorded and used as a gate — SHALL name no family at all.

#### Scenario: A body is used directly

- **WHEN** a tutorial's declared data is supplied to that kind's body
- **THEN** the puzzle is posed
- **AND** no task declaration, screen state or other kind's body is required

#### Scenario: Adding a kind leaves existing bodies untouched

- **WHEN** support for a further kind of tutorial is added
- **THEN** the existing kinds' bodies are unchanged
- **AND** the frame is unchanged

#### Scenario: The frame names no family

- **WHEN** the tutorial frame's code is inspected
- **THEN** no family id or family label appears in it
- **AND** nothing branches on which family is being taught

### Requirement: A tutorial that cannot be won is refused at load, naming its cause

A tutorial whose declared data admits no solution that clears its declared pass condition
SHALL be refused at load, naming the family, the tutorial and the cause, and the task
SHALL NOT be loaded. A student locked out by authored data is locked out where no screen
can say why, so this SHALL be refused where every other structural impossibility is: at
load, before the farm opens.

How winnability is decided SHALL belong to each kind of puzzle, since only the kind knows
what a solution is. The frame SHALL require that decision of every kind it recognises, and
SHALL NOT accept a kind that cannot make it.

#### Scenario: An unwinnable tutorial refuses the task

- **WHEN** a tutorial's declared data admits no solution that clears its pass condition
- **THEN** the refusal names that family, that tutorial and the cause
- **AND** the task is not loaded

#### Scenario: A winnable tutorial loads

- **WHEN** a tutorial's declared data admits at least one solution that clears its pass condition
- **THEN** the task loads
- **AND** the tutorial is presented

### Requirement: The tutorial is free and unlimited

Opening a tutorial, attempting it, failing it, retrying it and completing it SHALL each
move no money, append no record to the ledger, and leave the year as it was. There SHALL
be no limit on how many times a tutorial may be attempted, and no cost, delay or penalty
attached to a failed attempt.

None of these SHALL change what is at work: a task worked by the farm's manual labour or
by a model at work SHALL still be worked by it after any number of attempts.

#### Scenario: Attempting costs nothing

- **WHEN** a tutorial is opened, failed and retried any number of times
- **THEN** the balance, the ledger and the year are as they were

#### Scenario: A failed attempt carries no penalty

- **WHEN** an attempt does not clear the pass condition
- **THEN** the tutorial can be attempted again immediately
- **AND** nothing is deducted, delayed or withheld because of the failure

#### Scenario: Attempting leaves the labour alone

- **WHEN** a tutorial is attempted while a model is at work for that task
- **THEN** that task's labour is the model that was put to work

### Requirement: Completion is the whole of the record, and it does not come undone

The only thing recorded about a tutorial SHALL be whether it has been completed. No score,
no attempt count, no timing, no partial progress and no record of what was tried SHALL be
kept, presented or derived. A puzzle that records how well it was solved is a puzzle a
student optimises instead of reads.

Once a tutorial is completed it SHALL stay completed. Reopening it, attempting it again,
and failing it again SHALL leave it completed. Nothing SHALL take completion back except
starting a new farm, which discards the whole farm.

A completed tutorial SHALL remain reachable and readable, so that its theory copy can be
returned to.

#### Scenario: Nothing but completion is recorded

- **WHEN** a tutorial is completed after several failed attempts
- **THEN** what is recorded is that it is complete
- **AND** no score, attempt count or timing is recorded or shown anywhere

#### Scenario: Failing a completed tutorial leaves it completed

- **WHEN** a completed tutorial is reopened and an attempt fails
- **THEN** it is still complete
- **AND** what it opened is still open

#### Scenario: A completed tutorial can be read again

- **WHEN** a completed tutorial is opened
- **THEN** its puzzle and its theory copy are presented
- **AND** nothing bars it because it has already been passed

### Requirement: Completion is recorded once per tutorial, however many families declare it

Completion SHALL be recorded against the tutorial's declared id, not against the family
that declares it and not against the task that family belongs to. A student who completes
a tutorial SHALL have completed it for every family declaring that same tutorial id, so
that meeting one lesson twice is never asked of them.

Two families declaring the same tutorial id SHALL declare the same tutorial. Two that
declare the same id and disagree SHALL be refused at load naming that id, because one
completion cannot stand for two different puzzles.

#### Scenario: One completion covers every family declaring it

- **WHEN** a tutorial is completed for one family and a second family of another task declares the same tutorial id
- **THEN** that second family's tutorial is already complete
- **AND** it is not posed again

#### Scenario: Two tutorials sharing an id must agree

- **WHEN** two families declare tutorials with the same id and different content
- **THEN** the refusal names that id
- **AND** no task is loaded

### Requirement: An incomplete tutorial withholds putting the family to work, and nothing else

While a family's tutorial is incomplete, that family SHALL NOT be put to work for any
task. Everything else about the family SHALL be untouched: it can be bought, it is
selectable in the workshop, its knobs can be set, its model can be made, its training can
be presented, its drawing is shown, and its declared copy is readable.

Where putting it to work would otherwise be offered, what withholds it SHALL be stated as
the tutorial to sit — something to go and do — and SHALL NOT be reported as an error, as a
thing to buy, or as a configuration that cannot be run.

#### Scenario: An owned but untutored family cannot be fielded

- **WHEN** a family whose tutorial is incomplete is owned and its model is made
- **THEN** no control puts that model to work
- **AND** what withholds it is stated as that tutorial

#### Scenario: The workshop is otherwise unaffected

- **WHEN** a family whose tutorial is incomplete is selected in the workshop
- **THEN** its knobs, its drawing, its declared copy and the making of its model are all as they would be with the tutorial complete

#### Scenario: Completing the tutorial opens fielding and nothing else

- **WHEN** a family's tutorial is completed
- **THEN** that family's made model can be put to work
- **AND** no knob value, no catalog item and no other family changes state

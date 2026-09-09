## Purpose

Defines what brings a task's crop in: the labour a task is worked by, what an unfilled slot
means, which tasks are played and therefore hold the year open, and what becomes of a slot
naming a model this build can no longer make. This is the definition of "working the
orchard" that hand sorting is specified against.

## Requirements

### Requirement: One labour per task, and no entry is the farm's own hands

Each task the farm plays SHALL be brought in by exactly one labour: either the farm's own
manual labour, or one model that has been put to work for that task. The labour of a task
that has never had a model put to work SHALL be the farm's manual labour, and that SHALL
follow from the absence of a record rather than from a stored value naming it.

A task the farm plays SHALL therefore always have an answer to who works it. There SHALL be
no state in which a task is played and its labour is undecided, unset, or pending a choice
by the student.

#### Scenario: A farm that has put nothing to work is worked by hand
- **WHEN** the labour of a task is resolved for a farm that has put no model to work
- **THEN** it is the farm's manual labour

#### Scenario: A record for another task does not decide this one
- **WHEN** the labour of a task is resolved for a farm with a model at work for a different task
- **THEN** it is the farm's manual labour

#### Scenario: A model put to work is the labour
- **WHEN** the labour of a task is resolved for a farm with a model at work for that task
- **THEN** it is that model

#### Scenario: A task the stored progress predates is worked by hand
- **WHEN** a task is played that the farm's stored progress holds no record for
- **THEN** it is worked by the farm's manual labour rather than refused or left undecided

### Requirement: What the farm owns does not decide who works

Owning the means to automate a task SHALL NOT make a model the labour of that task. The
labour SHALL follow only from what has been put to work. A farm that owns everything a task
declares its automation to require, and has put no model to work for it, SHALL be worked by
hand.

#### Scenario: Ownership alone leaves the hands at work
- **WHEN** a farm owns what a task declares its automation to require but has put no model to work for it
- **THEN** that task is worked by the farm's manual labour

#### Scenario: Taking a model off leaves the ownership intact
- **WHEN** a task's job is handed back to the manual labour
- **THEN** that task is worked by the farm's manual labour
- **AND** what the farm owns is unchanged

### Requirement: Only a played task carries labour and holds the year open

A task SHALL be played when its declaration states it is available and progress has left at
least one selectable value on every one of its knobs. A task whose declaration only
announces it, and a task on which some knob has no available value at all, SHALL NOT be
played: neither carries labour, and neither has any say in when the year closes.

A year SHALL close when every played task's crop has been brought in, counting no announced
or unreachable task among them. WHEN progress states nothing about a task's values, the task
SHALL be treated as reachable rather than as locked.

#### Scenario: An announced task is not played
- **WHEN** a task's declaration states it is not available
- **THEN** it is not played
- **AND** it carries no labour and does not hold the year open

#### Scenario: A task with no way through is not played
- **WHEN** every value of one of an available task's knobs is unavailable
- **THEN** that task is not played

#### Scenario: An available and reachable task is played
- **WHEN** an available task has at least one selectable value on every knob
- **THEN** it is played
- **AND** it holds the year open until its crop is brought in

#### Scenario: Silence about a task opens it rather than closing it
- **WHEN** progress states nothing about an available task's knob values
- **THEN** that task is played

### Requirement: A slot records the model that was made, not the settings it came from

Putting a model to work SHALL record the model family it was made in together with the
configuration identifier that model was made as. It SHALL NOT record the knob values that
identifier was composed from, so that opening a previously unavailable value extends what
can be put to work and reinterprets no slot already filled.

The family is recorded because an identifier alone no longer names one model: two families
of one task can compose the same identifier string, and each resolves only against its own
family. A slot recording an identifier and no family SHALL NOT be guessed at against the
task's families — it SHALL be treated as a slot this build cannot make.

Which family is *selected* in the workshop SHALL NOT be what a slot records, and selecting a
different family SHALL NOT change what is at work. Looking at one family is not putting it
to work.

#### Scenario: Opening a value does not change what is at work
- **WHEN** a knob value that was unavailable becomes available
- **THEN** every task's labour is the labour it was
- **AND** no slot resolves to a different model than it did before

#### Scenario: A slot names its family
- **WHEN** a model is put to work and the labour of that task is resolved
- **THEN** it is that family's model at that configuration identifier
- **AND** no other family's configuration of the same identifier is resolved

#### Scenario: Selecting a family leaves the slot alone
- **WHEN** a different family is selected in the workshop after a model has been put to work
- **THEN** that task's labour is the model that was put to work
- **AND** it is still the family that model was made in

#### Scenario: A slot recording no family is not guessed at
- **WHEN** restored progress records a configuration identifier with no family
- **THEN** no family is substituted for it
- **AND** that slot is treated as one this build cannot make
### Requirement: Putting a model to work and handing the job back are free and reversible

Both SHALL move no money, append no record to the ledger, and leave the year as it was. Both
SHALL take effect from the next crop brought in, and SHALL NOT alter a year already closed
or a crop already brought in within an open year.

Working on a model SHALL NOT put it to work. Changing knob values, browsing declared data,
or making a different model SHALL leave a task's labour as it was until the student puts
something to work.

#### Scenario: Neither costs anything
- **WHEN** a model is put to work and the job is then handed back
- **THEN** the balance, the ledger and the year are as they were before either

#### Scenario: A closed year is not rewritten
- **WHEN** a task's labour changes after a year has closed
- **THEN** what that closed year recorded is unchanged

#### Scenario: A crop already brought in is not re-worked
- **WHEN** a task's labour changes while a year is open and that task's crop has already been brought in
- **THEN** what that crop brought in is unchanged

#### Scenario: Making a model is not putting it to work
- **WHEN** a different model is made for a task without being put to work
- **THEN** that task's labour is the labour it was

### Requirement: A slot this build cannot make reverts to the hands; a crop that will not come in does not

A slot naming a configuration the task's current declarations can no longer produce SHALL be
dropped when progress is restored, that task SHALL revert to the farm's manual labour, and
the cause SHALL be reported. The rest of the restored progress SHALL be kept.

A model that is at work and whose crop cannot be brought in — its stored predictions cannot
be fetched, or are refused once they are — SHALL NOT be treated that way. Its slot SHALL be
left as it is, the manual labour SHALL NOT be substituted for it, and the task SHALL remain
outstanding with the cause reported. Handing that task's job back SHALL remain available to
the student, and doing so SHALL make the task workable by hand.

#### Scenario: A configuration the declarations can no longer produce is dropped
- **WHEN** restored progress names a configuration the task's knobs can no longer compose
- **THEN** that task is worked by the farm's manual labour
- **AND** the cause is reported and the rest of the progress is kept

#### Scenario: A crop that cannot be fetched keeps its labour
- **WHEN** a task at work by a model cannot have its crop brought in
- **THEN** that task's labour is still that model
- **AND** the manual labour is not substituted for it
- **AND** the task remains outstanding with the cause reported

#### Scenario: Handing back unblocks a crop that would not come in
- **WHEN** the job of a task whose crop could not be brought in is handed back
- **THEN** that task is worked by the farm's manual labour
- **AND** its crop can be brought in by hand

### Requirement: A slot naming a family this build no longer declares reverts to the hands

A slot naming a model family the task's current declarations no longer carry SHALL be
dropped when progress is restored, that task SHALL revert to the farm's manual labour, and
the cause SHALL be reported naming the family. The rest of the restored progress SHALL be
kept, including the knob values recorded for families that are still declared.

This is the family-level counterpart of a slot naming a configuration the declarations can
no longer produce, and it SHALL be treated the same way: dropped and reported, never
silently remapped onto another family that happens to compose the same identifier.

#### Scenario: A withdrawn family's slot reverts to the hands
- **WHEN** restored progress names a family the task no longer declares
- **THEN** that task is worked by the farm's manual labour
- **AND** the cause is reported naming that family and the rest of the progress is kept

#### Scenario: A withdrawn family's slot is not remapped
- **WHEN** restored progress names a withdrawn family whose identifier another declared family could compose
- **THEN** that other family's model is not put to work
- **AND** the task is worked by the farm's manual labour

### Requirement: A family whose tutorial is unfinished cannot be put to work

Putting a model to work SHALL be refused while the family that model was made in has a
declared tutorial that has not been completed. The refusal SHALL name that tutorial, SHALL
move no money, and SHALL leave that task's labour as it was.

A slot naming a family whose tutorial is unfinished SHALL be dropped when progress is
restored, that task SHALL revert to the farm's manual labour, and the cause SHALL be
reported naming the tutorial. The rest of the restored progress SHALL be kept, including
the knob values recorded for that family.

This SHALL be a distinct cause from a slot naming a configuration the declarations can no
longer produce and from a slot naming a family the declarations no longer carry. Those two
report that this build cannot make what was recorded; this one reports something the
student can go and do, and SHALL be worded as such rather than as a fault.

#### Scenario: An untutored family is refused the slot

- **WHEN** a model of a family whose tutorial is incomplete is put to work
- **THEN** the attempt is refused naming that tutorial
- **AND** that task's labour is the labour it was and no money moves

#### Scenario: A restored slot for an untutored family reverts to the hands

- **WHEN** restored progress names a family whose tutorial has not been completed
- **THEN** that task is worked by the farm's manual labour
- **AND** the cause is reported naming that tutorial and the rest of the progress is kept

#### Scenario: The cause is not the cause of a slot this build cannot make

- **WHEN** a slot is dropped because its family's tutorial is unfinished
- **THEN** the cause reported is that tutorial
- **AND** it is not reported as a configuration or a family this build can no longer make

#### Scenario: Completing the tutorial lets the model be fielded

- **WHEN** a family's tutorial is completed and its made model is put to work
- **THEN** that task's labour is that model

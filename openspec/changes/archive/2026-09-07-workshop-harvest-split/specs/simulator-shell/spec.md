## ADDED Requirements

### Requirement: The workshop is where a model is made, and the year is run from the overview

The shell SHALL present a task as a workshop: the task's declared knobs, whatever it
declares to browse, and the making of a model from them. Running the year SHALL NOT be
reachable from the workshop. A student SHALL be able to return from the workshop to the
overview and enter it again without losing the knob values they left there.

The workshop SHALL be enterable and re-enterable as often as a student likes, and every
stage of it SHALL be reachable without a task's crop having been brought in.

#### Scenario: The workshop is reached from the overview and left again
- **WHEN** a student opens a task from the overview and then leaves it
- **THEN** the task's knobs and its declared teaching copy were presented
- **AND** the overview is shown again on leaving

#### Scenario: The year cannot be run from the workshop
- **WHEN** a student is in a task's workshop with a model made
- **THEN** no control there runs the year or brings in a crop
- **AND** no earnings figure and no report of a harvest is shown there

#### Scenario: Knob values survive leaving and returning
- **WHEN** a student changes a knob, returns to the overview, and opens the same task again
- **THEN** the knobs hold the values they were left at

#### Scenario: A configuration can be revised and a model made again
- **WHEN** a student changes a knob after making a model
- **THEN** that model is no longer presented as the model of the current knob values
- **AND** a model can be made again for the new values

### Requirement: The workshop moves no money

No stage of the workshop SHALL credit or debit the balance, append a record for a year, or
advance the year. Entering it, browsing what a task declares, making a model any number of
times, and putting a model to work SHALL all leave the balance and the year exactly as they
were.

Hypotheses have to be cheap or they will not be formed. A workshop that charged for a
model would teach a student to guess once rather than to look.

#### Scenario: Making a model costs nothing
- **WHEN** a student makes a model in the workshop any number of times
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Putting a model to work costs nothing
- **WHEN** a student puts a model to work and hands the job back again
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

### Requirement: Every playable task carries a labour slot

The overview SHALL present, for each task it offers as playable, a slot stating what
brings that task's crop in. The slot SHALL hold either the farm's manual labour or one
model that has been put to work for that task. A slot that has never been filled SHALL
state the manual labour rather than being empty, absent, or presented as a setting the
student still has to make.

A task the shell presents as announced rather than playable SHALL carry no slot.

The slot SHALL be readable from the overview without entering the task.

#### Scenario: A farm that has bought nothing still states its labour
- **WHEN** a farm that has put no model to work is shown on the overview
- **THEN** every playable task's slot states the farm's manual labour
- **AND** no slot is shown as empty or as unset

#### Scenario: A task at work by a model states that instead
- **WHEN** a model has been put to work for a task
- **THEN** that task's slot states that model rather than the manual labour
- **AND** the slots of other tasks are unchanged

#### Scenario: An announced task has no slot
- **WHEN** the overview presents a task as announced rather than playable
- **THEN** that task carries no labour slot

### Requirement: What fills a labour slot is presented from declarations

The slot SHALL present what fills it using an icon and a label taken from declared data,
and SHALL identify neither by anything written into screen code. The manual labour's icon
and label SHALL be read from the farm's declaration, because manual labour is the absence
of a model rather than a model and no model's declaration can supply them. A model's icon
and label SHALL be read from what declares that model.

WHEN a slot's icon or label is not declared, the slot SHALL still state what fills it
rather than being shown as empty.

#### Scenario: The manual labour is named by the farm, not by the screen
- **WHEN** a farm declaring its manual labour's icon and label is opened
- **THEN** the slot presents both of them
- **AND** neither is written into screen code

#### Scenario: A differently declared farm renders through the same slot
- **WHEN** a farm declaring a different icon and a different label for its manual labour is opened
- **THEN** the slot presents those instead
- **AND** no screen code is added or changed for it

### Requirement: A model is put to work from the workshop, and can be handed back

The workshop SHALL offer, beside the making of a model, a control that puts the model just
made to work for that task. That control SHALL be offered only once that model's making has
completed, so that a configuration cannot be put to work without its training having been
presented. Putting a model to work SHALL fill that task's labour slot and SHALL be
reflected on the overview.

A task whose slot holds a model SHALL be able to have the job handed back to the farm's
manual labour. Putting a model to work and handing the job back SHALL both be reversible
and SHALL take effect from the next crop brought in, never retroactively over a year
already closed.

What a student is working on in the workshop SHALL NOT change what is at work. Changing
knob values, browsing declared data, or making a different model SHALL leave the labour
slot as it was until the student puts something to work.

#### Scenario: A model cannot be put to work before it is made
- **WHEN** a student is in the workshop with no model made for the current knob values
- **THEN** no control puts a model to work

#### Scenario: Putting a model to work fills the slot
- **WHEN** a student puts a made model to work and returns to the overview
- **THEN** that task's slot states that model

#### Scenario: The job can be handed back
- **WHEN** a student hands a task's job back from a model at work
- **THEN** that task's slot states the farm's manual labour again

#### Scenario: Tinkering does not change what is at work
- **WHEN** a student changes knob values and makes a different model without putting it to work
- **THEN** the task's labour slot states what it stated before
- **AND** the overview shows no change to what is at work

### Requirement: Running the year is one act, reached from the overview

The overview SHALL offer one control that runs the year for the whole farm, naming the
year it will run. It SHALL be confirmed before it runs. Running the year SHALL bring in
each playable task's crop by whatever that task's labour slot holds: a task at work by a
model SHALL be brought in without the student deciding anything further, and a task whose
slot holds the manual labour SHALL require that labour to be performed.

The control SHALL NOT be conditional on any model having been put to work, because a
labour slot is never empty and every playable task therefore always has labour.

A year already closed SHALL NOT be run again.

#### Scenario: The year is run from the overview
- **WHEN** a student runs the year from the overview and confirms it
- **THEN** the year named on the control is the year that is run

#### Scenario: A farm that has put no model to work can still run its year
- **WHEN** a farm whose every slot holds the manual labour runs its year
- **THEN** the control was available and named no reason it could not be used

#### Scenario: A model at work needs no further decisions
- **WHEN** the year is run for a task whose slot holds a model
- **THEN** that task's crop is brought in without the student deciding anything for it

#### Scenario: Manual labour must be performed
- **WHEN** the year is run for a task whose slot holds the manual labour
- **THEN** that labour is presented to be performed
- **AND** that task's crop is not brought in until it has been

#### Scenario: A closed year is not run twice
- **WHEN** a year has been closed
- **THEN** running the year names the following year, and the closed one cannot be run again

### Requirement: A year in progress states what is outstanding

WHEN the year has been run but not every playable task's crop has been brought in, the
overview SHALL state which tasks are still outstanding. It SHALL NOT present the year as
closed, SHALL NOT show a balance changed by the crops already brought in, and SHALL NOT
offer to run the year again.

WHEN a task at work by a model cannot be brought in — its configuration cannot be fetched
or resolved — the refusal SHALL be presented with the cause the engine named, the year
SHALL stay open, and that task SHALL NOT be brought in by the manual labour in its place.

#### Scenario: An outstanding task is named
- **WHEN** the year has been run and one task's manual labour has not been performed
- **THEN** the overview states that that task is still outstanding
- **AND** the year is not presented as closed

#### Scenario: A year in progress cannot be run again
- **WHEN** the year has been run and a task is still outstanding
- **THEN** no control runs the year again

#### Scenario: A task that cannot be brought in leaves the year open
- **WHEN** a task at work by a model has a configuration that cannot be fetched
- **THEN** the refusal is shown with the cause that was reported
- **AND** the year stays open and no other labour is substituted for that task

### Requirement: A task offers the report of the year it closed

WHEN a year has closed, the overview SHALL offer, for each playable task, the report of
what that task's crop did in that year. The report SHALL be reached from that task rather
than from the workshop, and entering it SHALL neither run anything nor change what is at
work.

The report offered SHALL be the one for the most recently closed year, and SHALL state
which year that is. A farm that has closed no year SHALL offer no report rather than an
empty one.

#### Scenario: A closed year's report is reached from its task
- **WHEN** a year has closed and a student opens a task's report from the overview
- **THEN** that task's report for the closed year is shown, naming the year
- **AND** nothing was run and no labour slot changed

#### Scenario: A farm with no closed year offers no report
- **WHEN** no year has yet closed
- **THEN** no task offers a report

## MODIFIED Requirements

### Requirement: A report identifies the configuration that produced it

Every report of a task brought in by a model SHALL name the configuration identifier it
was produced from, and every report SHALL name the year it belongs to. A report of a task
brought in by the farm's manual labour SHALL identify that labour rather than naming a
configuration.

A report SHALL describe the year it belongs to and SHALL NOT be presented as describing
the current state of the workshop. WHEN knob values change, or a different model is put to
work, a report already shown SHALL continue to describe the year and the configuration it
was produced from, and SHALL NOT be re-presented as the result of the current knob values.

#### Scenario: Report names its configuration
- **WHEN** a report of a task brought in by a model is shown
- **THEN** it displays the configuration identifier that crop was brought in by
- **AND** it displays the year it belongs to

#### Scenario: A stale report is not passed off as current
- **WHEN** a knob value is changed, or a different model is put to work, after a report has been shown
- **THEN** that report still names the configuration and the year it was produced from
- **AND** it is not presented as the result of the current knob values

#### Scenario: A hand-brought crop's report identifies the labour
- **WHEN** a report of a task brought in by the farm's manual labour is shown
- **THEN** it identifies that labour
- **AND** it names no configuration identifier

## REMOVED Requirements

### Requirement: The student moves through overview, configuration, run and report

**Reason**: The four-stage walk conflated two questions the split exists to separate. A
run reached from the configuration screen answers "did the farm make money" in the same
breath as "is my model any good", and it made the harvest repeatable — a number a student
presses again rather than a commitment they defend. The stages are replaced by the year
loop: a workshop that is free and repeatable, a labour slot that says who works, one run
of the year from the overview, and a report of the year that closed.

**Migration**: The overview and the configuration of declared knobs are unchanged and are
now required by *The workshop is where a model is made, and the year is run from the
overview*, which also carries the guarantee that a task stays selected while its
configuration is revised. The run moves to *Running the year is one act, reached from the
overview*. The report moves to *A task offers the report of the year it closed*. The
scenario *A configuration can be revised and re-run* becomes *A configuration can be
revised and a model made again*: revising and re-running within a year is deliberately no
longer possible, and revising and retraining is what the workshop is for.

## ADDED Requirements

### Requirement: The tutorial is reached from the workshop, never sprung in the market

WHEN the selected family declares a tutorial, the workshop SHALL offer it beside that
family's knobs, whether or not it has been completed, so that its theory copy stays
reachable after it is passed. Nothing SHALL open it unbidden while a student is tuning
knobs or making a model.

The market SHALL NOT present a tutorial, SHALL NOT open one on a purchase, and SHALL NOT
condition a purchase on one. Buying a family and being ambushed by a puzzle is the market
telling a student that money was not the key, which is a thing the market has already
promised it will never say.

#### Scenario: The workshop offers the selected family's tutorial

- **WHEN** a family declaring a tutorial is selected in the workshop
- **THEN** that tutorial is offered beside its knobs

#### Scenario: A completed tutorial is still offered

- **WHEN** the selected family's tutorial has been completed
- **THEN** it is still offered from the workshop
- **AND** opening it presents its puzzle and its theory copy

#### Scenario: Buying a family opens no puzzle

- **WHEN** an item that opens a family declaring a tutorial is bought
- **THEN** the market shows the purchase and nothing else
- **AND** no tutorial is presented until the student reaches the workshop

#### Scenario: A family declaring no tutorial offers none

- **WHEN** a family declaring no tutorial is selected in the workshop
- **THEN** no tutorial is offered
- **AND** the workshop is as it was before tutorials existed

## MODIFIED Requirements

### Requirement: The workshop moves no money

No stage of the workshop SHALL credit or debit the balance, append a record for a year, or
advance the year. Entering it, browsing what a task declares, making a model any number of
times, sitting a tutorial any number of times, and putting a model to work SHALL all leave
the balance and the year exactly as they were.

Hypotheses have to be cheap or they will not be formed. A workshop that charged for a
model would teach a student to guess once rather than to look, and a tutorial that charged
for an attempt would teach them to guess at the puzzle rather than read it.

#### Scenario: Making a model costs nothing

- **WHEN** a student makes a model in the workshop any number of times
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Putting a model to work costs nothing

- **WHEN** a student puts a model to work and hands the job back again
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Sitting a tutorial costs nothing

- **WHEN** a student opens a tutorial and attempts it any number of times, passing or failing
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

### Requirement: A model is put to work from the workshop, and can be handed back

The workshop SHALL offer, beside the making of a model, a control that puts the model just
made to work for that task. That control SHALL be offered only once that model's making has
completed, so that a configuration cannot be put to work without its training having been
presented. Putting a model to work SHALL fill that task's labour slot and SHALL be
reflected on the overview.

WHEN the selected family declares a tutorial that has not been completed, that control
SHALL NOT be offered however complete the model's making is, and what withholds it SHALL be
stated as that tutorial to sit. That statement SHALL name the tutorial and SHALL offer the
way to it, and SHALL NOT be presented as an error, as a thing to buy, or as a configuration
that cannot be run. Completing the tutorial SHALL make the control available without the
model having to be made again.

A task whose slot holds a model SHALL be able to have the job handed back to the farm's
manual labour. Putting a model to work and handing the job back SHALL both be reversible
and SHALL take effect from the next crop brought in, never retroactively over a year
already closed. Handing a job back SHALL never be withheld by a tutorial, so that a
tutorial can never leave a task stuck with a model on it.

What a student is working on in the workshop SHALL NOT change what is at work. Changing
knob values, browsing declared data, sitting a tutorial, or making a different model SHALL
leave the labour slot as it was until the student puts something to work.

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

#### Scenario: An unfinished tutorial withholds the control and says so

- **WHEN** a model is made for a family whose declared tutorial is incomplete
- **THEN** no control puts it to work
- **AND** the tutorial to sit is named and the way to it is offered

#### Scenario: Completing the tutorial offers the control without remaking the model

- **WHEN** the tutorial is completed with a model already made
- **THEN** the control that puts that model to work is offered
- **AND** the model does not have to be made again

#### Scenario: A tutorial never traps a model on a task

- **WHEN** a task worked by a model has that family's tutorial made incomplete
- **THEN** handing the job back to the farm's manual labour is still offered

### Requirement: The shell contains no task-specific code paths

No task id, category id, action id or knob id declared by a task SHALL appear in screen
code, and no screen SHALL branch on one. A task's screens SHALL be produced from its
declaration alone. This SHALL hold for every stage the shell presents, including stages that
belong to the farm rather than to a task run and that render a task's images, labels or
actions.

The same rule SHALL hold over what a model family declares: no family id, family label,
shipped form, slot icon, slot label or history axis label SHALL appear in screen code, and
no screen SHALL branch on one. The workshop, the family picker, the labour slot and the
report SHALL be produced from the declared families and the facts they are supplied. A
family's own drawing and a family's own tutorial body MAY each name that family and SHALL
name no other; every other screen, the tutorial frame included, SHALL name none.

The same rule SHALL hold over what the farm declares: no farm name, no currency label and
no summary fact's label SHALL appear in screen code, and no screen SHALL branch on one.
The persistent bar SHALL be produced from the farm declaration and the facts it is
supplied, and SHALL name nothing of its own.

The same rule SHALL hold over what the catalog declares: no item id, item label, group id,
group label or shop copy SHALL appear in screen code, and no screen SHALL branch on one.
No screen SHALL name an unlock condition — which item opens which thing SHALL be read from
the catalog, never written into a screen, so that a market for an entirely different farm
renders through the same screens.

#### Scenario: An unrelated task renders without screen changes

- **WHEN** a second task declaring unrelated categories and actions is added as a declaration
- **THEN** it renders its overview entry, workshop and report through the same screens
- **AND** every farm stage that presents its images or actions renders them from its declaration through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: An unrelated family renders without screen changes

- **WHEN** a task is declared with a model family whose id, label, knobs and shipped form the shell has never presented
- **THEN** it is offered in the picker, configured in the workshop, shown in the labour slot and named in the report through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: No screen branches on what a family ships

- **WHEN** screen code is inspected
- **THEN** nothing branches on whether a family ships its model or its predictions
- **AND** nothing names a family outside that family's own drawing and that family's own tutorial body

#### Scenario: The tutorial frame names no family

- **WHEN** the code that opens, presents, judges and records a tutorial is inspected
- **THEN** no family id and no family label appears in it
- **AND** nothing branches on which family is being taught

#### Scenario: A farm declaring a different currency renders without screen changes

- **WHEN** the farm declares a different name and a different currency label
- **THEN** the bar shows both of them
- **AND** no screen code is added or changed for it

#### Scenario: An unrelated catalog renders without screen changes

- **WHEN** a catalog declaring different groups, items and prices is loaded
- **THEN** the market renders it, and locked things name the items that open them
- **AND** no screen code is added or changed for it

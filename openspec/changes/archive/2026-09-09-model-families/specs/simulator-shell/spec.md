## MODIFIED Requirements

### Requirement: A report identifies the configuration that produced it

Every report of a task brought in by a model SHALL name the model family and the
configuration identifier it was produced from, and every report SHALL name the year it
belongs to. A report of a task brought in by the farm's manual labour SHALL identify that
labour rather than naming a family or a configuration.

The family is named because an identifier alone no longer identifies a model: two families
of one task can compose the same identifier string. A report naming an identifier without
its family would describe a crop the student cannot trace back to what brought it in.

A report SHALL describe the year it belongs to and SHALL NOT be presented as describing
the current state of the workshop. WHEN knob values change, a different family is selected,
or a different model is put to work, a report already shown SHALL continue to describe the
year, the family and the configuration it was produced from, and SHALL NOT be re-presented
as the result of the current knob values.

#### Scenario: Report names its configuration
- **WHEN** a report of a task brought in by a model is shown
- **THEN** it displays the model family and the configuration identifier that crop was brought in by
- **AND** it displays the year it belongs to

#### Scenario: A stale report is not passed off as current
- **WHEN** a knob value is changed, a different family is selected, or a different model is put to work, after a report has been shown
- **THEN** that report still names the family, the configuration and the year it was produced from
- **AND** it is not presented as the result of the current knob values

#### Scenario: A hand-brought crop's report identifies the labour
- **WHEN** a report of a task brought in by the farm's manual labour is shown
- **THEN** it identifies that labour
- **AND** it names no family and no configuration identifier

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
family's own drawing MAY name that family and SHALL name no other; every other screen SHALL
name none.

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
- **AND** nothing names a family outside that family's own drawing

#### Scenario: A farm declaring a different currency renders without screen changes
- **WHEN** the farm declares a different name and a different currency label
- **THEN** the bar shows both of them
- **AND** no screen code is added or changed for it

#### Scenario: An unrelated catalog renders without screen changes
- **WHEN** a catalog declaring different groups, items and prices is loaded
- **THEN** the market renders it, and locked things name the items that open them
- **AND** no screen code is added or changed for it

## ADDED Requirements

### Requirement: The workshop offers the task's families, and choosing one is not committing it

WHEN a task declares more than one model family, the workshop SHALL present the families it
declares and SHALL let the student select among the ones that are available to them. The
selected family SHALL decide which knobs and which drawing the workshop presents.

Selecting a family SHALL NOT put it to work, SHALL NOT take the model already at work off
the task, and SHALL move no money. Putting a model to work SHALL remain the separate,
deliberate act `farm-labour` specifies, so that opening the picker to look at a family the
student is considering never changes who brings the crop in.

A family the student does not yet have available SHALL be shown with what opens it rather
than hidden, exactly as a locked knob value is, and SHALL NOT be selectable. A task
declaring one family SHALL NOT be made to look like a choice.

#### Scenario: The picker renders the declared families
- **WHEN** a task declaring several families is opened in the workshop
- **THEN** each declared family is presented with its declared label
- **AND** the selected family's knobs and drawing are the ones shown

#### Scenario: Looking at a family does not field it
- **WHEN** a family is selected while a model of another family is at work
- **THEN** the task's labour is still that model
- **AND** no money moves and the year is unchanged

#### Scenario: An unavailable family is shown with what opens it
- **WHEN** a task declares a family the student does not have available
- **THEN** it is shown together with what opens it
- **AND** it cannot be selected

#### Scenario: A single family is not presented as a choice
- **WHEN** a task declaring exactly one family is opened in the workshop
- **THEN** its knobs are presented directly
- **AND** no family choice is offered

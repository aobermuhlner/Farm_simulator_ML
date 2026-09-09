## ADDED Requirements

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

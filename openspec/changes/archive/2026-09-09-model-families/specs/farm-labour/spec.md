## MODIFIED Requirements

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

## ADDED Requirements

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

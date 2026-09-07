## MODIFIED Requirements

### Requirement: A reference this build no longer declares is dropped, not fatal

An owned id the catalog no longer declares, a knob value a task no longer permits, or a
model put to work whose configuration the task's knobs can no longer compose, SHALL be
dropped from the restored farm while the rest of the save is kept. The year, the
balance and the ledger SHALL survive it. A dropped owned id SHALL open nothing, a
dropped knob value SHALL fall back to that knob's declared default, and a dropped model
SHALL leave that task worked by the farm's manual labour.

#### Scenario: An item removed from the catalog is dropped
- **WHEN** a saved farm owns an id the catalog no longer declares
- **THEN** the farm opens with the year, the balance and the ledger it saved
- **AND** the unknown id opens nothing

#### Scenario: A knob value no longer permitted falls back to the default
- **WHEN** a saved knob value is outside what that knob now permits
- **THEN** that knob opens at its declared default
- **AND** the rest of the save is kept

#### Scenario: A model this build cannot make hands its job back
- **WHEN** a saved farm has a model at work whose configuration the task's knobs can no longer compose
- **THEN** that task opens worked by the farm's manual labour
- **AND** the farm opens with the year, the balance and the ledger it saved

#### Scenario: A dropped model is reported rather than silently replaced
- **WHEN** a model at work is dropped on restore
- **THEN** the farm opens reporting that cause
- **AND** no other model is put in its place

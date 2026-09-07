## MODIFIED Requirements

### Requirement: Engine refusals are shown with the cause the engine named

WHEN the engine refuses — an unresolvable configuration, a schema version mismatch, a
malformed stored distribution, or an incomplete declaration — the shell SHALL present the
refusal together with the cause the engine reported. It SHALL NOT show a blank screen, a
partial result, or any earnings figure for a refused run.

WHEN the refusal is a played task's crop that could not be brought in by the model at work
for it, the shell SHALL additionally offer, from where that refusal is shown, a way to hand
that task's job back to the farm's manual labour. The shell SHALL NOT require the student to
enter the task to reach it, and SHALL NOT bring the crop in by hand of its own accord. Once
the job is handed back, that task SHALL be offered to the student as their own labour, so a
year held open by a refused crop can be closed from where the refusal appears.

#### Scenario: A configuration with no precomputed entry is explained
- **WHEN** a student selects a knob combination the prediction artifact has no entry for
- **THEN** the shell reports that this configuration has not been precomputed, naming the configuration identifier
- **AND** no report and no earnings figure are shown

#### Scenario: A version mismatch stops the task rather than degrading it
- **WHEN** a task's declared schema version differs from its prediction artifact's version
- **THEN** the shell reports the mismatch naming both versions
- **AND** the task cannot be run

#### Scenario: A refused crop offers the job back where the refusal is shown
- **WHEN** running the year refuses a played task's crop because the model at work for it could not be brought in
- **THEN** the refusal is shown with its cause
- **AND** a way to hand that task's job back to the manual labour is offered alongside it

#### Scenario: Handing back from the refusal lets the year be closed
- **WHEN** the student hands the job back from where that refusal is shown
- **THEN** that task is offered to them as their own labour
- **AND** bringing its crop in that way closes the year

#### Scenario: The shell substitutes no labour of its own
- **WHEN** a played task's crop is refused and the student has not handed the job back
- **THEN** that task is still shown as at work by that model
- **AND** the shell does not offer its crop to be brought in by hand

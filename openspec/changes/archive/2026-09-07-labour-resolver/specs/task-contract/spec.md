## MODIFIED Requirements

### Requirement: Deterministic configuration identity

An ordered set of knob values SHALL map to a deterministic configuration identifier.
The same knob values SHALL always produce the same identifier, independent of the order
in which the student set them, the session, or the machine.

An identifier SHALL also be readable back: it SHALL name exactly one ordered set of knob
values for the task that composed it. To that end, the character an identifier joins its
parts with SHALL NOT appear in any knob id, nor in the written form of any value a knob
permits — which excludes a string value containing it and a numeric value whose written form
does, such as a negative number. A declaration carrying that character in either place SHALL
be refused at load, naming the knob and the offending id or value, rather than loaded into a
task whose identifiers cannot be read back.

#### Scenario: Same selection yields the same identifier
- **WHEN** two students independently select identical knob values for the same task
- **THEN** both configurations resolve to the same configuration identifier

#### Scenario: An identifier names the values it was composed from
- **WHEN** an identifier composed from a task's knob values is read back against that task
- **THEN** it yields exactly the knob values it was composed from

#### Scenario: A separator inside a knob id is refused
- **WHEN** a task declares a knob whose id contains the identifier's separator
- **THEN** the declaration is refused naming that knob and its id
- **AND** the task is not loaded

#### Scenario: A separator inside a declared string value is refused
- **WHEN** a task declares a choice knob one of whose string values contains the identifier's separator
- **THEN** the declaration is refused naming that knob and that value
- **AND** the task is not loaded

#### Scenario: A knob permitting a negative value is refused
- **WHEN** a task declares a knob permitting a negative number, whose written form carries the identifier's separator
- **THEN** the declaration is refused naming that knob and that value
- **AND** the task is not loaded

A configuration identifier the prediction artifact has no entry for, and an artifact
declaring a different task than the one being resolved, SHALL be refused rather than
resolved.

#### Scenario: Identifier keys the precomputed lookups
- **WHEN** a configuration identifier is resolved
- **THEN** it selects that configuration's prediction entries and its training history
- **AND** both lookups refer to the same configuration

#### Scenario: Unknown configuration is refused
- **WHEN** a configuration identifier has no entry in the task's prediction artifact
- **THEN** the lookup is refused naming that identifier
- **AND** no run is scored from it

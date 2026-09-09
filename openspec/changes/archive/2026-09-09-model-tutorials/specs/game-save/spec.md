## ADDED Requirements

### Requirement: Which tutorials are complete is progress; the tutorials themselves are not

The save SHALL record which tutorials have been completed, because completing one is
something play changed. It SHALL record them as a set of tutorial ids and SHALL record
nothing else about them: no score, no attempt count, no timing, no partial progress and no
record of what was tried.

A tutorial's id, title, theory copy, kind of puzzle and puzzle data SHALL be read from the
declarations on every open and SHALL NOT be read from the save, exactly as every other
declared thing is. Rewriting a tutorial's copy or its puzzle SHALL reach a restored farm,
and SHALL NOT reset what that farm had completed.

A save recording no completed tutorials SHALL open with none complete rather than
refusing, since a save written before tutorials existed had completed none.

#### Scenario: A completed tutorial survives the page being closed

- **WHEN** a tutorial is completed and the page is closed and opened again
- **THEN** that tutorial is still complete
- **AND** the family it gates can still be put to work

#### Scenario: Only completion is recorded

- **WHEN** a tutorial is completed after several failed attempts and the save is inspected
- **THEN** the save records that tutorial's id among the completed
- **AND** it records no score, no attempt count and no timing

#### Scenario: Rewritten tutorial copy reaches a restored farm

- **WHEN** a tutorial's declared title or theory copy is changed and a saved farm is restored
- **THEN** the new title and copy are shown
- **AND** that tutorial is still complete

#### Scenario: A save recording no tutorials opens with none complete

- **WHEN** a save that records no completed tutorials is restored
- **THEN** no tutorial is complete
- **AND** the rest of the save is kept

## MODIFIED Requirements

### Requirement: A reference this build no longer declares is dropped, not fatal

An owned id the catalog no longer declares, an owned id recorded more times than the
catalog now permits it to be bought, a knob value a task no longer permits, or a model put
to work whose configuration the task's knobs can no longer compose, SHALL be dropped or
trimmed on the restored farm while the rest of the save is kept. The year, the balance and
the ledger SHALL survive it. A dropped owned id SHALL open nothing, an over-recorded owned
id SHALL be trimmed to the count the catalog now permits, a dropped knob value SHALL fall
back to that knob's declared default, and a dropped model SHALL leave that task worked by
the farm's manual labour.

Trimming a count SHALL NOT take back what the purchases already gave. Land the farm holds
is recorded as land rather than as a tally of purchases, so a catalog whose repeat limit was
lowered leaves a farm holding land it can no longer buy — which is the same promise "there
SHALL be no way to sell, refund or return a bought item" already makes, kept across a
redeclaration.

A completed tutorial id that no declaration now carries SHALL be the one exception: it
SHALL be kept rather than dropped. An unknown completion gates nothing while it is
unknown, so dropping it costs the student a lesson they have already passed and buys
nothing; keeping it means a declaration that names that id again finds it already
satisfied. Keeping it SHALL NOT make it visible: nothing SHALL present a tutorial no
declaration carries.

#### Scenario: An item removed from the catalog is dropped

- **WHEN** a saved farm owns an id the catalog no longer declares
- **THEN** the farm opens with the year, the balance and the ledger it saved
- **AND** the unknown id opens nothing

#### Scenario: A count the catalog no longer permits is trimmed

- **WHEN** a saved farm records an item five times and the catalog now permits three
- **THEN** the farm opens owning that item three times
- **AND** the year, the balance and the ledger it saved survive

#### Scenario: Trimming a count does not take back the land

- **WHEN** a saved farm's record of an item that grows the farm is trimmed on restore
- **THEN** the land the farm holds is the land it saved
- **AND** nothing is refunded

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

#### Scenario: A completion no declaration carries is kept, not dropped

- **WHEN** a saved farm records a completed tutorial id no declaration now carries
- **THEN** the farm opens with that id still recorded as complete
- **AND** nothing presents a tutorial for it

#### Scenario: A returning declaration finds its completion intact

- **WHEN** a tutorial id that had left the declarations is declared again and a farm that had completed it is restored
- **THEN** that tutorial is complete
- **AND** the family it gates can be put to work without sitting it again

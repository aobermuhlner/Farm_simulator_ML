## MODIFIED Requirements

### Requirement: The save records progress, never declarations

The save SHALL record only what play has changed. The farm's name, its currency, its
precision, its opening balance, its opening year, the land its orchard opens with, what a
unit of that land bears, and every catalog id, price, label, shop copy, repeat limit and
unlock rule SHALL be read from the declarations on every open and SHALL NOT be read from
the save. Amounts SHALL be recorded in the form the declarations state amounts in, and
SHALL cross into the farm's whole units through the one conversion the declared currency
already defines.

The land the farm now holds SHALL be recorded, because buying it is something play changed.
The size of the crop that land bears SHALL NOT be recorded: it is the product of a saved
figure and a declared one, and recording it as well would let a restored farm carry a crop
size that its own land and yield contradict. A save recording no land SHALL open at the
declared opening land rather than refusing, since a save written before land was bought has
bought none.

#### Scenario: A redeclared currency reaches a restored farm
- **WHEN** the farm declaration's currency label is changed and a saved farm is restored
- **THEN** the restored farm's amounts are shown with the new label

#### Scenario: A repriced item reaches a restored farm
- **WHEN** an item's declared price is changed and a saved farm is restored
- **THEN** the market shows the new price

#### Scenario: A restored balance is exact
- **WHEN** a balance is written and read back
- **THEN** it is the same figure to the declared precision, with no residue of its own storage

#### Scenario: Bought land is restored
- **WHEN** a farm that has bought land is saved and restored
- **THEN** it holds the land it had bought
- **AND** its crop is the crop that land bears

#### Scenario: A redeclared yield reaches a restored farm
- **WHEN** what a unit of land bears is changed in the declaration and a saved farm is restored
- **THEN** the restored farm's crop is its saved land times the new yield

#### Scenario: A save recording no land opens at the declared opening
- **WHEN** a save that records no land is restored
- **THEN** the farm opens holding the declared opening land
- **AND** the rest of the save is kept

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

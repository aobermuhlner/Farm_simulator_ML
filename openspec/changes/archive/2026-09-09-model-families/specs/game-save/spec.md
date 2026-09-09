## MODIFIED Requirements

### Requirement: The save records progress, never declarations

The save SHALL record only what play has changed. The farm's name, its currency, its
precision, its opening balance, its opening year, the land its orchard opens with, what a
unit of that land bears, every catalog id, price, label, shop copy, repeat limit and unlock
rule, and every model family a task declares — its id, label, knobs, defaults, help copy,
shipped form, icon and short label — SHALL be read from the declarations on every open and
SHALL NOT be read from the save. Amounts SHALL be recorded in the form the declarations
state amounts in, and SHALL cross into the farm's whole units through the one conversion the
declared currency already defines.

Which family a task has selected SHALL be recorded, because selecting one is something play
changed. The knob values a student set SHALL be recorded per family, so that tuning one
family does not lose another's. A save recording no selection for a task SHALL open at that
task's first declared family, and a save recording no values for a family SHALL open that
family at its declared defaults; neither SHALL refuse.

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

#### Scenario: A relabelled family reaches a restored farm
- **WHEN** a model family's declared label or help copy is changed and a saved farm is restored
- **THEN** the workshop shows the new label and copy
- **AND** the save carried neither

#### Scenario: Each family's knob values are restored separately
- **WHEN** a farm that tuned two families is saved and restored
- **THEN** each family's knobs hold the values that family last held

#### Scenario: A save recording no selection opens at the first declared family
- **WHEN** a save that records no selected family for a task is restored
- **THEN** that task opens with its first declared family selected
- **AND** the rest of the save is kept

#### Scenario: A save recording no values for a family opens at its defaults
- **WHEN** a family is selected for which the restored save records no knob values
- **THEN** its knobs sit at their declared defaults
- **AND** nothing is reported as missing

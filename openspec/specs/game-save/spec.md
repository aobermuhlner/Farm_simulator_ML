## Purpose

Keeps a farm between visits: the versioned record of the year, the money, the ledger, what
has been bought and how the knobs were left, written to the browser as it changes — and
the limits deliberately placed on it, so that a save which cannot be read resets rather
than migrating wrongly, and nothing is spent defending a teaching tool against its own
student.

## Requirements

### Requirement: Progress is kept in the browser and restored on return

The farm's year, its balance, the movements of the year in progress, its ledger, the items
it owns and the knob values last chosen SHALL be written to the browser's storage at the
point each of them changes, and SHALL be restored when the student returns. Returning
after the page is closed SHALL open the farm the student left rather than a new one. No
part of keeping progress SHALL depend on a server.

#### Scenario: A purchase survives the page being closed
- **WHEN** an item is bought and the page is closed and opened again
- **THEN** the item is still owned
- **AND** the balance is the one the purchase left

#### Scenario: A closed year survives the page being closed
- **WHEN** a harvest closes a year and the page is opened again
- **THEN** the year, the balance and the ledger are the ones the harvest left

#### Scenario: A browser with nothing stored opens a new farm
- **WHEN** the farm is opened where nothing has been stored before
- **THEN** the balance, the year and the owned items are the declared opening state
- **AND** the ledger is empty

#### Scenario: Knob values are where the student left them
- **WHEN** a student sets a task's knobs and returns in a later session
- **THEN** that task's knobs carry the values they set

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
### Requirement: A save that cannot be read resets rather than migrating wrongly

The save SHALL carry the schema version it was written at. A save whose version is not the
version this build reads, which cannot be parsed, or whose recorded values are not of the
shape the schema states SHALL be discarded whole and replaced by a new farm at the
declared opening state. The student SHALL be told that earlier progress could not be read
and has been reset. No part of a save that is discarded SHALL be adopted, and no value
SHALL be guessed, migrated or repaired.

#### Scenario: An older schema version resets with a warning
- **WHEN** a save written at an earlier schema version is found
- **THEN** a new farm is opened at the declared opening state
- **AND** the student is told that earlier progress could not be read and was reset

#### Scenario: Unparseable text resets with a warning
- **WHEN** what is stored is not readable as a save
- **THEN** a new farm is opened and the student is told it was reset

#### Scenario: Nothing is adopted from a discarded save
- **WHEN** a save carries a usable balance and a ledger of the wrong shape
- **THEN** neither the balance nor the ledger is adopted
- **AND** the farm opens at the declared opening state

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


### Requirement: A farm that cannot be stored is still playable and says so

WHEN the browser will not store — no storage available, or a write that fails — the farm
SHALL remain playable for that session and SHALL state that progress is not being kept.
Nothing SHALL claim progress is saved when it is not, and no purchase, harvest or other
act SHALL be blocked because storage is unavailable.

#### Scenario: Storage unavailable is disclosed, not fatal
- **WHEN** the browser provides no storage
- **THEN** the farm opens at the declared opening state and can be played
- **AND** it states that progress is not being kept this session

#### Scenario: A failed write is disclosed
- **WHEN** a write to storage fails
- **THEN** the change stands for the session
- **AND** the student is told progress is not being kept

### Requirement: The save is plain, and nothing is spent defending it

The save SHALL be stored as readable text a student can inspect and edit. Nothing SHALL
sign, obfuscate, checksum or otherwise attempt to detect that it has been edited, and a
save that fits the schema SHALL be played as it is given, however it came to say what it
says. Nothing SHALL accuse the student of tampering.

#### Scenario: An edited save is played as given
- **WHEN** a stored balance is edited by hand to a larger figure and the farm is opened
- **THEN** the farm opens with that balance

#### Scenario: A hand-written save opens
- **WHEN** a save written by hand fits the schema
- **THEN** the farm opens from it

#### Scenario: Nothing reports tampering
- **WHEN** a save is edited in any way that still fits the schema
- **THEN** no warning, accusation or reset follows from the edit alone

### Requirement: A farm is one seed drawn once, and starting again draws another

A new farm SHALL draw a seed once and keep it for the life of that farm, so that anything
derived from it is the same on every visit. Reopening a farm SHALL NOT redraw its seed.

Starting a new farm SHALL be offered, SHALL state that the current farm's money, purchases
and history are discarded, and SHALL require confirmation before discarding them. A new
farm SHALL draw a new seed, and abandoning the confirmation SHALL change nothing.

#### Scenario: The seed survives a return
- **WHEN** a farm is opened, closed and opened again
- **THEN** its seed is the seed it was created with

#### Scenario: A new farm is a new seed
- **WHEN** a new farm is started
- **THEN** it draws a seed of its own rather than inheriting the discarded farm's

#### Scenario: Starting again is confirmed before anything is discarded
- **WHEN** starting a new farm is offered
- **THEN** what will be discarded is stated
- **AND** nothing is discarded until it is confirmed

#### Scenario: Abandoning the confirmation keeps the farm
- **WHEN** starting a new farm is abandoned at the confirmation
- **THEN** the money, the purchases, the ledger and the seed are unchanged

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

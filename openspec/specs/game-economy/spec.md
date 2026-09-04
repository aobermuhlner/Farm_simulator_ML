## Purpose

Holds the farm's money and its years: the declared currency and opening balance, every
movement of money together with the reason for it, the year counter that only a harvest
advances, and the record of what each closed year paid — so that price, pacing and payout
have somewhere to live that is arithmetic rather than screen state.

## Requirements

### Requirement: The currency, the opening balance and the opening year are declared

The farm SHALL declare the label its money is shown with, the precision money is counted
to, the balance play opens at, and the year play opens at. No currency label, no opening
amount and no opening year SHALL be written into engine or screen code. A farm declaration
that omits a required field, or carries one of the wrong shape, SHALL be refused with the
field named, and the farm SHALL NOT open.

#### Scenario: The declared label is the only one shown
- **WHEN** the farm declares a currency label
- **THEN** every amount presented is presented with that label
- **AND** no other currency label appears anywhere

#### Scenario: Play opens at the declared state
- **WHEN** the farm opens
- **THEN** the balance is the declared opening balance
- **AND** the year is the declared opening year

#### Scenario: An incomplete farm declaration refuses rather than assumes
- **WHEN** the farm declaration omits its currency
- **THEN** the refusal names the missing field
- **AND** no balance and no year are shown

### Requirement: Amounts are exact at the declared precision

Money SHALL be counted in whole units of the declared precision, so that a total is exact
however many movements it is the sum of, and a presented figure never carries a residue of
its own arithmetic. An amount finer than the declared precision SHALL be rounded to that
precision once, where it enters the farm's money, and SHALL NOT be rounded a second time
afterwards.

#### Scenario: A long sum stays exact
- **WHEN** eighteen thousand credits of 0.40 are recorded in a currency counted to two decimals
- **THEN** the balance is exactly 7 200.00
- **AND** the presented figure carries no residue

#### Scenario: A finer amount is rounded where it enters
- **WHEN** an amount of 0.404 is credited in a currency counted to two decimals
- **THEN** 0.40 is what the balance moves by and what the movement records
- **AND** the recorded amount and the presented amount are the same figure

### Requirement: Every movement of money states its reason

A credit or a debit SHALL carry a reason for the money moving, and a movement without one
SHALL NOT be recorded. The movements of the year in progress SHALL be recoverable in the
order they happened, each with its amount and its reason, so that what has been earned and
spent this year can be shown without any screen keeping a second record of it.

#### Scenario: A movement is recoverable with its reason
- **WHEN** two debits with different reasons are recorded in one year
- **THEN** both are recoverable in the order they happened
- **AND** each carries the amount it moved and the reason it was given

#### Scenario: A movement with no reason is not recorded
- **WHEN** a credit is attempted with no reason given for it
- **THEN** it is refused
- **AND** the balance is unchanged

### Requirement: A debit larger than the balance is refused

The farm SHALL refuse a debit that exceeds the balance. The refusal SHALL name the
shortfall, the balance SHALL be unchanged, and no movement SHALL be recorded. The balance
SHALL never be a negative amount.

#### Scenario: Nothing is bought with money the farm does not have
- **WHEN** a debit of 1 200 is attempted against a balance of 800
- **THEN** it is refused and the refusal names the shortfall of 400
- **AND** the balance is still 800

#### Scenario: A refused debit leaves no trace
- **WHEN** a debit is refused for want of funds
- **THEN** the year in progress records no movement for it

### Requirement: A bad year is a bad year, never a failure

There SHALL be no state in which the farm can no longer be played. WHEN a harvest settles
to a loss greater than the balance, the balance SHALL come to rest at zero rather than
below it, and the amount the floor absorbed SHALL be recorded on that year's record rather
than discarded. A balance of zero SHALL NOT bar the student from anything a larger balance
would allow, and SHALL NOT be presented as an ending, a loss, or a game over.

#### Scenario: A ruinous harvest floors at zero and says what it absorbed
- **WHEN** a harvest settling to −500 is recorded against a balance of 200
- **THEN** the balance is zero
- **AND** that year's record shows 300 absorbed by the floor

#### Scenario: The harvest's own figure survives the floor
- **WHEN** a harvest settling to −500 is recorded
- **THEN** that year's record carries −500 as what the harvest paid
- **AND** what the floor absorbed is recorded separately from it

#### Scenario: Zero is not an ending
- **WHEN** the balance is zero
- **THEN** the farm remains playable and the next year can be worked
- **AND** nothing presents the farm as lost or the game as over

### Requirement: Only a harvest closes a year

The year number SHALL advance only as part of recording a harvest. Recording a harvest
SHALL, as one indivisible step, settle what the harvest paid against the balance, append
exactly one record for the year that closed, and advance the year. Credits and debits
outside a harvest SHALL leave the year number untouched.

#### Scenario: A harvest closes one year
- **WHEN** a harvest is recorded in year 3
- **THEN** exactly one record is appended for year 3
- **AND** the year is 4

#### Scenario: Spending does not advance the year
- **WHEN** any number of credits and debits are recorded without a harvest
- **THEN** the year is unchanged
- **AND** no record is appended

#### Scenario: A year never closes half way
- **WHEN** a harvest is recorded
- **THEN** the closing balance on its record is the balance the farm holds after it

### Requirement: The ledger is the history of closed years

The farm SHALL keep one record per closed year, in the order the years closed, each
carrying the year, what its harvest paid, what the floor absorbed if anything, and the
balance the year closed at — enough for the history of the farm to be drawn without
re-deriving it from anything else. A record once appended SHALL NOT change.

#### Scenario: Every closed year is in the ledger, in order
- **WHEN** three harvests have been recorded
- **THEN** the ledger holds three records
- **AND** their years ascend in the order the harvests were recorded

#### Scenario: A record carries enough to draw the history
- **WHEN** the ledger is read back
- **THEN** each record states its year and the balance that year closed at

#### Scenario: The year in progress is not in the ledger
- **WHEN** a year has been opened and no harvest recorded for it yet
- **THEN** the ledger holds no record for that year

### Requirement: The farm's state is not presented as saved

The farm's money, its year and its ledger SHALL last for the session they were made in.
Until persistence is specified, nothing SHALL claim the farm is saved, offer to save,
restore or reset it, or present a previous session's state as recoverable.

#### Scenario: A session opens at the declared opening state
- **WHEN** the farm is opened afresh
- **THEN** the balance, the year and an empty ledger are the declared opening state

#### Scenario: Nothing claims to save
- **WHEN** money and the year are shown
- **THEN** no control offers to save, load, restore or reset the farm
- **AND** nothing states that progress is kept

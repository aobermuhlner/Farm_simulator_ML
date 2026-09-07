## MODIFIED Requirements

### Requirement: Only a harvest closes a year

The year number SHALL advance only as part of recording a harvest. Recording a harvest
SHALL, as one indivisible step, settle what the harvest paid against the balance, append
exactly one record for the year that closed, and advance the year. Credits and debits
outside a harvest SHALL leave the year number untouched.

A harvest is the whole farm's, not one task's. WHEN a farm has more than one task bringing
a crop in, the year SHALL close once, on the total of what every one of those crops paid,
with exactly one record appended — never once per task, because two tasks of one farm
cannot stand at different years.

A farm MAY therefore be in a year whose crops are partly brought in. While a year is in
progress, what the crops already brought in earned SHALL NOT be settled against the
balance, no record SHALL be appended, and the year SHALL NOT advance. Nothing is credited
until the year closes, so a year abandoned in progress SHALL leave the balance, the ledger
and the year exactly as they were before it was run.

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

#### Scenario: Several crops close one year between them
- **WHEN** a farm with three crops brings all three in for year 3
- **THEN** exactly one record is appended for year 3, for the total of what the three paid
- **AND** the year is 4

#### Scenario: A crop brought in is not credited before the year closes
- **WHEN** one of a farm's crops has been brought in and another has not
- **THEN** the balance is unchanged, no record is appended, and the year is unchanged

#### Scenario: A year abandoned in progress costs nothing and pays nothing
- **WHEN** a year is run, some crops are brought in, and the year is left without closing
- **THEN** the balance, the ledger and the year are as they were before the year was run

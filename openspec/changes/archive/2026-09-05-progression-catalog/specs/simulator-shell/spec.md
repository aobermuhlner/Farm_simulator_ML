## ADDED Requirements

### Requirement: The market is a stage of the farm, not of a task

The shell SHALL present a market, reachable from the farm overview without a task being
selected and leavable back to it. The market SHALL be rendered from the declared catalog
alone: its groups in the order they are declared, each item under its declared group with
its declared label, its shop copy, and its price where it has one, together with which of
owned, buyable now, not yet affordable, or not for sale it currently is. A group with no
items SHALL NOT be shown as an empty section.

The balance SHALL be readable from the market as it is from every other screen, and a
purchase SHALL be reflected in the balance and in that item's state without leaving the
market. WHEN the catalog cannot be loaded, the market SHALL NOT be shown and the refusal
SHALL be presented with its cause instead.

#### Scenario: The market is reached from the overview and left again
- **WHEN** a student opens the market from the farm overview and then leaves it
- **THEN** the market is shown without any task having been selected
- **AND** the overview is shown again on leaving

#### Scenario: Items render under their declared groups, in declared order
- **WHEN** the catalog declares two groups with items in each
- **THEN** both groups are shown in the order declared, each with its own items
- **AND** no group name or item name is written into the screen

#### Scenario: The four states are distinguishable on screen
- **WHEN** the catalog holds an owned item, an affordable one, one beyond the balance and one with no price
- **THEN** each is presented as owned, as buyable, as not yet affordable, or as not for sale
- **AND** no two of those read the same

#### Scenario: Buying is reflected without leaving the market
- **WHEN** a purchase is confirmed in the market
- **THEN** the balance shown falls by the price and the item is shown as owned
- **AND** the student is still in the market

#### Scenario: A catalog that cannot be loaded has no market
- **WHEN** the catalog is missing or refused
- **THEN** the refusal is shown with the cause that was reported
- **AND** no market is shown

## MODIFIED Requirements

### Requirement: The shell contains no task-specific code paths

No task id, category id, action id or knob id declared by a task SHALL appear in screen
code, and no screen SHALL branch on one. A task's screens SHALL be produced from its
declaration alone.

The same rule SHALL hold over what the farm declares: no farm name, no currency label and
no summary fact's label SHALL appear in screen code, and no screen SHALL branch on one.
The persistent bar SHALL be produced from the farm declaration and the facts it is
supplied, and SHALL name nothing of its own.

The same rule SHALL hold over what the catalog declares: no item id, item label, group id,
group label or shop copy SHALL appear in screen code, and no screen SHALL branch on one.
No screen SHALL name an unlock condition — which item opens which thing SHALL be read from
the catalog, never written into a screen, so that a market for an entirely different farm
renders through the same screens.

#### Scenario: An unrelated task renders without screen changes
- **WHEN** a second task declaring unrelated categories and actions is added as a declaration
- **THEN** it renders its overview entry, configuration screen and report through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: A farm declaring a different currency renders without screen changes
- **WHEN** the farm declares a different name and a different currency label
- **THEN** the bar shows both of them
- **AND** no screen code is added or changed for it

#### Scenario: An unrelated catalog renders without screen changes
- **WHEN** a catalog declaring different groups, items and prices is loaded
- **THEN** the market renders it, and locked things name the items that open them
- **AND** no screen code is added or changed for it

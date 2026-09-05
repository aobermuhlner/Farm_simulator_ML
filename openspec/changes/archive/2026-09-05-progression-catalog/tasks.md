## 1. The catalog declaration

- [x] 1.1 Add `declarations/catalog.json` carrying its schema version, its groups in display order, the items a new farm owns, and its items — each with id, group, label, shop copy, what owning it opens, and a price only where it is for sale; ship the three unpriced items `design.md` names (deeper stacks, loss regularization, dropout) with the declared reason each cannot yet be bought, and no priced item; verify a test asserts the file parses and that `sourcePathFor('data/declarations/catalog.json')` resolves to it with no change to `DATA_MOUNTS`
- [x] 1.2 Implement the catalog validator in `src/progression/` returning `ValidationIssue` lists in the house shape, refusing a missing or wrongly-shaped field, a repeated item id, an item in an undeclared group, and an unknown id in the opening-ownership list, each with the field named; verify tests cover a complete catalog and one refusal per rule, and that a refused catalog yields no items rather than a partial list
- [x] 1.3 Reject a price that is not a non-negative amount at the farm's declared precision, reusing the currency's single conversion boundary rather than a second one; verify tests assert a negative price, a non-numeric price and a price finer than the declared precision are each refused with the item named

## 2. The catalog checked against what it opens

- [x] 2.1 Implement the cross-check of every unlock against the loaded tasks — the task exists, the knob exists, named values are values that knob permits, at least one thing is opened, no knob's declared default is opened, no two items open the same thing, and an unrecognised unlock kind is refused naming the kind; verify one test per rule asserts the item and the defect are both named and that the farm does not open
- [x] 2.2 Implement the coverage check over priced items only — enumerate the configurations reachable when every priced item is owned and refuse the catalog if any is outside the artifact's declared coverage, naming the item and one uncovered identifier; verify tests assert a priced item opening untrained ground refuses, that the same item unpriced is accepted with its values left locked, and that the enumeration is driven by the artifact's coverage rather than by a hard-coded grid
- [x] 2.3 Assert the shipped combination: verify a test loads the shipped task, the shipped artifact and the shipped catalog together and asserts that every configuration selectable under any ownership the shipped catalog permits is covered — so no student of this build can reach the untrained refusal

## 3. Availability

- [x] 3.1 Implement `src/progression/` availability — owned ids and the catalog in, and out one value stating, per task and knob, which declared values are available and, for each locked one, the item that opens it — with default-open semantics for anything the catalog does not mention, per `design.md`; verify tests assert an unmentioned value is available from the start, a mentioned value is locked until its item is owned, buying opens exactly what the item declares and nothing else, and that the module imports neither React nor any storage API
- [x] 3.2 Confirm ownership is the only input: verify a test asserts two farms differing only in year, balance, ledger and knob history produce identical availability, and that the availability function takes no argument beyond the catalog, the tasks and the owned ids

## 4. Buying

- [x] 4.1 Implement the purchase in `src/progression/` over `game-economy`'s `debit` — the price debited once with the item as the reason, the id appended to what is owned, and a new value returned; verify tests assert the balance falls by exactly the price, that one movement is recorded carrying the item as its reason, and that the returned value is new rather than a mutation
- [x] 4.2 Refuse buying an item already owned, an item with no price, and an id the catalog does not declare, each as a `ValidationIssue` naming the item, moving no money; verify one test per refusal asserts the balance and the owned set are untouched
- [x] 4.3 Pass the insufficient-funds refusal through unchanged so the shortfall the economy names reaches the screen; verify a test buys beyond the balance and asserts the refusal names the shortfall and that the item is not owned
- [x] 4.4 Confirm there is no way back: verify a test asserts the module exposes no sell, refund or un-own operation, and that nothing removes an id from the owned set

## 5. The save codec

- [x] 5.1 Implement `src/save/` as a pure codec — a farm, its owned ids, its seed and its per-task knob values to a plain versioned object and back — recording amounts the way the declarations state them and copying no declared value into the save, per `design.md`; verify tests assert a round trip preserves the year, balance, movements, ledger, owned ids, seed and knob values, that the encoded object carries no currency label, name or price, and that the module touches no storage API
- [x] 5.2 Discard a save whole when its schema version is not this build's, when it cannot be parsed, or when any recorded value is not of the schema's shape, returning a reset outcome carrying the cause; verify tests assert an older version, unparseable text and a ledger of the wrong shape each reset, and that no field of a discarded save reaches the opened farm
- [x] 5.3 Drop a reference the current declarations no longer carry — an owned id the catalog no longer declares, a knob value a task no longer permits — keeping the rest of the save and falling back to that knob's declared default; verify tests assert the year, balance and ledger survive both cases and that a dropped id opens nothing
- [x] 5.4 Draw the farm's seed once for a new farm and never on restore, with the source of randomness injectable for tests; verify tests assert a restored farm keeps its seed, that two new farms draw different seeds, and that opening the same save twice yields the same seed

## 6. The storage edge and opening the farm

- [x] 6.1 Implement `web/src/data/save.ts` over `localStorage` under a key namespaced to this app, reading and writing inside try/catch and returning storage failure as a value rather than throwing, per `design.md`'s note on the shared GitHub Pages origin; verify tests cover a successful read and write, absent storage, a read that throws, and a write that throws
- [x] 6.2 Open the farm from the save in `App` — restored state when there is one, the declared opening state and the catalog's opening ownership when there is not — and write through on every change to the year, balance, movements, ledger, owned ids or knob values; verify tests assert a purchase and a closed year are both readable back from storage immediately after they happen, and that no write waits on page unload
- [x] 6.3 Show the reset warning when a save could not be read, and the "progress is not being kept" disclosure when storage is unavailable or a write failed, through the existing refusal rendering; verify tests assert each message appears with its cause and that the farm remains playable in both cases
- [x] 6.4 Implement starting a new farm: a control that states what is discarded, requires confirmation, discards the stored save, draws a new seed and opens at the declared opening state; verify tests assert the confirmation names what is lost, that abandoning it leaves money, purchases, ledger and seed unchanged, and that confirming yields a different seed
- [x] 6.5 Confirm nothing defends the save: verify a test asserts a hand-edited balance opens as given, that a hand-written save fitting the schema opens, and that no code path hashes, signs or reports on the save's contents

## 7. Locked knobs and the three refusals

- [x] 7.1 Render a locked knob value in `KnobControl` as shown-but-not-selectable, naming the item that opens it and that item's price where it has one, with a fully locked knob shown at its declared default; verify tests assert a locked option is present and cannot be selected, that the opening item is named, and that the same knobs and values are on screen before and after a purchase
- [x] 7.2 Implement the locked check in `src/progression/` over a resolved configuration, leaving `resolveConfiguration` untouched, and order the refusals invalid, then locked, then untrained per `design.md`; verify tests assert a locked value refuses with its own code naming what opens it, that an available but uncovered configuration still refuses as untrained, that an out-of-range value refuses as invalid, and that the three codes are distinct
- [x] 7.3 Wire the check into the configuration screen ahead of the artifact lookup so no locked configuration reaches one; verify tests assert no prediction fetch is made for a locked configuration and that no report, earnings figure or training history is produced from any of the three refusals
- [x] 7.4 Confirm identity is unchanged: verify tests assert the shipped defaults still resolve to `blocks2-channels16-regularization1-dropout0`, that a locked knob contributes its default to the identifier, and that owning an item adds identifiers without changing any identifier that was selectable before it

## 8. The market

- [x] 8.1 Implement the market screen in `web/src/screens/` rendering the catalog's groups in declared order with their items, each shown as owned, buyable, not yet affordable, or not for sale with its declared reason, skipping a group with no items; verify tests assert the four states read differently from one another, that groups render in declared order, and that a catalog with different groups and items renders through the same screen unchanged
- [x] 8.2 Reach the market from the farm overview with no task selected and leave it back to the overview; verify a test walks overview to market and back and asserts no task was selected on the way
- [x] 8.3 Confirm a purchase in the market before money moves, naming the item and its price, and reflect the result in the balance and the item's state without leaving the market; verify tests assert an abandoned confirmation costs nothing, that a confirmed purchase updates the bar's balance and the item's state in place, and that a refusal is shown with the cause the engine named
- [x] 8.4 Refuse the market when the catalog cannot be loaded, through `Issues` with the cause reported and no market rendered; verify tests cover an unreachable catalog file and one the validator refuses

## 9. The invariant and honesty

- [x] 9.1 Extend `web/src/no-task-specific-code.test.tsx` to the catalog's declared vocabulary — item ids, item labels, group ids and group labels, matched whole per `design.md` — so no screen may name one; verify the extended test passes and fails when an item label is pasted into a screen
- [x] 9.2 Confirm no screen names an unlock condition: verify a test asserts no screen source pairs an item id with a knob id, and that what opens a locked thing is read from the catalog value in every place it is shown
- [x] 9.3 Confirm the honesty rules hold on screen: verify tests assert an unaffordable item is never presented as barred or as requiring another item, that an unpriced item shows its declared reason and offers no purchase, and that nothing claims progress is saved while storage is unavailable

## 10. Verification

- [x] 10.1 Confirm the change ships no retraining and no artifact change: verify `git status` shows nothing under `artifacts/` or `pools/`, that the artifact index's three identifiers are byte-for-byte unchanged, and that the existing artifact and pool tests pass untouched
- [x] 10.2 Confirm the engine stays framework-free with the two new modules in it: verify the existing engine-purity test covers `src/progression/` and `src/save/` and still passes, and that neither imports React or a storage API
- [x] 10.3 Confirm `npm test` and `npm run typecheck` pass, and that a student who buys nothing sees the same four stages with three knobs now greyed and `channels` still turnable across its three covered values
- [x] 10.4 Re-read the five delta specs against the implementation and record every requirement neither covered by a test nor deliberately deferred; verify the resulting list is empty or handed to `/opsx:update` as findings

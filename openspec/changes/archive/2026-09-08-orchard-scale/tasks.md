## 1. The declared orchard

- [x] 1.1 Add `orchard: { label, unit, opening, piecesPerUnit }` to the farm declaration types in `src/economy/declaration.ts`, as a required field, and remove `openingCrop` from the types and from `REQUIRED_FARM_FIELDS` — verify the types compile with no reference to `openingCrop` remaining
- [x] 1.2 Validate the orchard: `opening` and `piecesPerUnit` whole numbers of one or more, `label` and `unit` non-empty strings, and the whole field present — verify each refusal names its own field (`orchard.opening`, `orchard.piecesPerUnit`, …) and that a farm declaring no orchard is refused naming the missing field, in `test/farm-declaration.test.ts`
- [x] 1.3 Point `checkYearVariation`'s crowd-out check at `orchard.opening × orchard.piecesPerUnit` instead of `openingCrop` — verify the existing crowd-out refusal still fires on the same declared ranges, and that its message names the derived crop it measured against
- [x] 1.4 Verify no declared field states the size of the crop, by asserting the farm declaration's required and optional field lists carry no crop-size field

## 2. The land as state, the crop as a function

- [x] 2.1 Rename `Farm.cropSize` to `Farm.land` in `src/economy/farm.ts`, set it from `declaration.orchard.opening` in `openFarm`, and carry it unchanged through `recordHarvest` — verify a newly opened farm holds the declared opening land, in `test/farm-money.test.ts`
- [x] 2.2 Add `cropSize(farm)` returning `land × declaration.orchard.piecesPerUnit`, and export it from `src/economy/index.ts` — verify a farm of 100 units at 60 pieces reports a crop of 6 000
- [x] 2.3 Change `drawCrop` in `src/sorting/crop.ts` to read `cropSize(farm)` rather than `farm.cropSize`, leaving its unusable-size refusal and every other code path untouched — verify the refusal still fires with a named cause and the size it found, in `test/sorting-crop.test.ts`
- [x] 2.4 Verify `SavedHarvest.cropSize` is unchanged and a closed year still reports the size it closed with after the orchard has grown, in `test/save-codec.test.ts`
- [x] 2.5 Update `web/src/test-support/farm.ts` and `web/src/test-support/pool.ts` to build farms from land rather than a crop size, keeping `farmSorting(cropSize?)`'s callers working by converting at the boundary — verify the existing suites pass unchanged

## 3. Repeatable purchases

- [x] 3.1 Add an optional `repeat` limit to the catalog item declaration in `src/progression/catalog.ts`, validated as a whole number of one or more — verify a limit of zero, a fraction or a negative is refused naming the item and the field, in `test/catalog-declaration.test.ts`
- [x] 3.2 Add `countOwned(owned, id)` and replace `buyItem`'s `ALREADY_OWNED` membership test in `src/progression/purchase.ts` with a count test against the declared limit, defaulting to 1 — verify an item declaring no limit is still refused on a second purchase with no money moved, in `test/progression-purchase.test.ts`
- [x] 3.3 Verify a repeatable item bought twice debits its price twice, records two movements each carrying the item id as its reason, and appends the id to `owned` twice
- [x] 3.4 Verify a purchase one past the declared limit is refused with the limit named and moves no money
- [x] 3.5 Report how many of an item are held and how many the catalog still permits from `src/progression/market.ts`, and give an item at its limit the `owned` state rather than `saving` — verify a five-limit item bought twice is `buyable` and reports 2 of 5, and that at five it is `owned` and offers no purchase, in `test/progression-purchase.test.ts` or a market unit test
- [x] 3.6 Verify availability is unchanged by a repeated id: a farm owning an item twice reports exactly the availability of a farm owning it once, in `test/progression-availability.test.ts`

## 4. Growing the farm

- [x] 4.1 Add `'farm-land'` to `UNLOCK_KINDS` with a `{ kind, units }` shape, validated as a whole number of one or more — verify growth of zero, a fraction or no amount is refused naming the item and the field, and that an unrecognised kind is still refused, in `test/catalog-declaration.test.ts`
- [x] 4.2 Exempt land unlocks from the "no two items open the same thing" check in `src/progression/catalog.ts` — verify two items that each grow the farm are accepted, in `test/catalog-check.test.ts`
- [x] 4.3 Verify a land unlock satisfies "an item opens at least one thing" and is not subject to the knob-default or artifact-coverage checks, since it names no knob
- [x] 4.4 Apply growth inside `buyItem`: for each land unlock on the item bought, return a farm whose `land` is raised by that many units — verify the returned farm's land and derived crop size both rise, and that buying the same item again raises them again
- [x] 4.5 Add `maxLand(catalog, declaration)` returning `opening + Σ (repeat × units)` over **priced** land items — verify an unpriced land item is excluded and that the figure does not change as the item is bought
- [x] 4.6 Verify nothing outside `src/progression/` branches on an unlock kind: `web/src/App.tsx` stores the farm and ownership `buyItem` returned and names no kind

## 5. The save

- [x] 5.1 Record the land held in the save in place of `cropSize`, and stop reading a saved crop size — verify a farm that has bought land is restored holding it, with its crop the crop that land bears, in `test/save-codec.test.ts`
- [x] 5.2 Verify a save recording no land opens at the declared opening land with the rest of the save kept, and that a save carrying the old `cropSize` field loses nothing it could have bought
- [x] 5.3 Verify a redeclared `piecesPerUnit` reaches a restored farm: the crop is the saved land times the new yield
- [x] 5.4 Replace the dedupe at `src/save/index.ts:651` with a per-id count clamped to the catalog's declared limit — verify an item recorded five times against a limit of three restores as three, with the year, balance and ledger kept
- [x] 5.5 Verify trimming a count does not take back the land: a farm whose land-item record is trimmed keeps the land it saved and is refunded nothing

## 6. What the game shows

- [x] 6.1 Supply the orchard as the persistent bar's first summary fact from `web/src/App.tsx` — `{ label: orchard.label, value: "<held> / <max> <unit>" }`, or `"<held> <unit>"` where no catalog gives a maximum — verify it appears on the overview, the market, a run and a report, in `web/src/App.farm.test.tsx`
- [x] 6.2 Verify the fact's figures follow a purchase — the land shown rises, the maximum does not — and that a farm with no catalog shows no maximum
- [x] 6.3 Verify no screen source names a unit of land or the word for the orchard, by extending `web/src/no-task-specific-code.test.tsx` to the declared orchard vocabulary
- [x] 6.4 Show how many of a repeatable item are held and how many remain on the market row, and offer no purchase at the limit — verify both in `web/src/screens/Market.test.tsx`

## 7. Prices and the shipped declarations

- [x] 7.1 Replace `openingCrop: 6000` in `declarations/farm.json` with `orchard: { label, unit: "trees", opening: 100, piecesPerUnit: 60 }` — verify the shipped farm loads and its opening crop is 6 000, in `test/farm-declaration.test.ts`
- [x] 7.2 Add the expansion to `declarations/catalog.json` under the declared `orchard` group: priced at 1 000, `repeat: 5`, opening `{ kind: 'farm-land', units: 100 }`, with shop copy that states what it multiplies and claims nothing about how well a model performs — verify the shipped catalog validates against the shipped farm, in `test/catalog-declaration.test.ts`
- [x] 7.3 Verify the shipped catalog's derived maximum orchard is 600 units and 36 000 pieces
- [x] 7.4 Verify the shipped copy for the orchard and the expansion names no error, accuracy, risk, noise or variance, per the claim the spec forbids

## 8. Acceptance: what growth does and does not do

- [x] 8.1 Assert proportionality in `test/delivery-guards.test.ts`: for each shipped configuration, holding the farm's seed and year, scaling the land by a whole factor scales the money by that factor and leaves the delivery's measured share and the drawn shares where they were
- [x] 8.2 Assert payback: for each shipped configuration, in the wettest declared year, one expansion's added pieces earn more than its price within the year — recording the measured multiple so a later retune sees the margin it is spending
- [x] 8.3 Assert the tolerance is not breached by growth alone: a configuration whose delivery is accepted at 100 units is accepted at 600 units in the same year
- [x] 8.4 Assert a budget on the draw at the largest reachable orchard, so a 36 000-piece crop that stops being cheap fails loudly, in `test/crop-draw.test.ts`
- [x] 8.5 Verify the whole suite passes and `openspec validate orchard-scale --strict` reports no issues

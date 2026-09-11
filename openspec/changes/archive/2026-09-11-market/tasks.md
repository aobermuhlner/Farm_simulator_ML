**Precondition.** Written against a working tree with `fitted-tree` applied and unarchived.
Before starting, confirm `model-family` is in `UNLOCK_KINDS` (`src/progression/catalog.ts`),
that `availability.ts` fills `FamilyAvailability.openedBy`, and that
`declarations/catalog.json` sells `sorting-tree`, `tree-four-questions` and
`tree-six-questions`. If `fitted-tree` has been archived meanwhile, task 2.1's requirement may
already be in `openspec/specs/progression-catalog/spec.md` — check before writing it twice.

**Already built, do not rebuild.** The family unlock kind and its reader, family availability
from the catalog, the unknown-family refusal, the one-item-per-family refusal, and the
per-family coverage walk. This change writes them down and changes exactly one of them (2.2).

## 1. The catalog declaration

- [x] 1.1 Add `soldAt` (`market` | `bench`) and optional `task` to `GroupDeclaration` in
      `src/progression/catalog.ts`, reading and refusing both in `readGroups`; verify with
      cases in `test/catalog-declaration.test.ts` for a missing `soldAt`, an unrecognised one,
      and a group carrying a task id, each naming the group in the issue.
- [x] 1.2 Refuse an item in a `bench` group that opens anything but knob values of exactly one
      family — land, a family, or knobs of two families; verify each of those three shapes is
      refused naming the item and what it opens.
- [x] 1.3 Verify the group's declared task is checked against the loaded tasks in
      `src/progression/check.ts` and refused by name, alongside the checks already there.

## 2. Writing down and adjusting what fitted-tree built

- [x] 2.1 Read `src/progression/catalog.ts:232`, `availability.ts:86` and `check.ts:71` against
      this change's `progression-catalog` delta and confirm the ADDED family requirement
      describes them exactly; correct the delta, not the code, wherever they differ.
- [x] 2.2 Make the unknown-family refusal in `check.ts:71` conditional on the item carrying a
      price, and add its counterpart — pricing an item whose family is undeclared is refused;
      verify in `test/catalog-check.test.ts` that an unpriced item naming an undeclared family
      is accepted, that pricing it is refused naming the item and the family, and that an
      unpriced item naming an undeclared *task* is still refused.
- [x] 2.3 Verify the existing coverage walk already requires a priced family item's declared
      defaults to be covered — `reachableConfigurations` enumerates from the defaults — and add
      the case only if it does not.

## 3. Ownership and the floor

- [x] 3.1 Apply `ownedAtStart` as a floor when a save is loaded in `src/save/index.ts`, not only
      when a farm is created; verify in `test/save-codec.test.ts` that a save with an empty
      `owned` list opens owning every owned-at-start item, that a repeatable item already bought
      twice still reads as bought twice, and that a save naming an owned-at-start item once is
      not credited with it twice.

## 4. The two counters

- [x] 4.1 Split `src/progression/market.ts` so `viewOf` is shared and `marketView` returns
      sections — task-titled sections in declared-group order, then the farm-wide section —
      filtered to `market` groups with empty groups and empty sections dropped; verify the
      ordering, the dropping, and that no bench item appears.
- [x] 4.2 Add `benchView(task, catalog, owned, balanceUnits)` returning every declared family in
      order, each with its lock state and `openedBy`, and under it only the knobs that bench
      items open, each with those items in `viewOf` form; verify a knob no bench item opens is
      absent, that a family with no bench items comes back marked as having nothing for sale,
      and that an item is never returned under a family whose knob it does not open.
- [x] 4.3 Verify with a test that buying one item through the market view and through the bench
      view leaves identical state — same debit, same reason, same owned list — so the counters
      cannot drift into two purchase paths.

## 5. Selecting a family when some are locked

- [x] 5.1 Make silence and a stale record both select the first *available* family in
      `src/task/families.ts:39` and `selectedFamilyFor` in `src/save/index.ts:952`, threading
      availability in; verify a locked first family is passed over and a recorded-but-now-locked
      family falls back. This is live today: `sorting-tree` is priced, so the tree family is
      locked on a new farm.
- [x] 5.2 Present a task with no available family as having none selected, no knobs and every
      family shown with what opens it; verify the workshop renders it without reporting a
      failure and that the task's labour is unaffected.

## 6. The shipped catalog

- [x] 6.1 Rewrite `declarations/catalog.json`: `orchard` and `data` gain
      `task: "apple-harvest"` and `soldAt: "market"`; `labour` and a farm-wide `models` group
      stand at the market; a new `capacity` group stands at the bench and takes
      `deeper-stacks`, `stronger-regularization`, `dropout-layers`, `tree-four-questions` and
      `tree-six-questions` unchanged but for their group. Verify the shipped catalog validates
      and `test/helpers/catalog.ts` is updated with it.
- [x] 6.2 Add to the models shelf, beside `sorting-tree`: the convolutional family, priced
      nowhere and listed in `ownedAtStart`; a linear regression and a dense network, each
      unpriced with its declared reason. Verify the catalog validates and that no copy claims a
      model that is not built.
- [x] 6.3 Pin the unpriced family ids in a test so a family rename that should have updated the
      shelf fails loudly rather than leaving an entry that never unlocks.

## 7. The screens

- [x] 7.1 Render sections in `web/src/screens/Market.tsx` from the new view — task title as the
      section heading, group label as the shelf heading; verify in `App.market.test.tsx` that a
      fixture catalog naming a second task renders that task's section with no screen change,
      and that no heading text is written into the screen.
- [x] 7.2 Add `web/src/screens/UpgradeBench.tsx` and reach it from `ConfigureTask.tsx`,
      rendering families, their lock state, their knobs and the items under them, with buy
      controls in the four states; verify the bench renders from a fixture task the shell has
      never seen.
- [x] 7.3 Wire purchase at the bench through the same confirmation and `purchase()` the market
      uses, reflecting balance and state without leaving the bench; verify a confirmed buy, an
      abandoned one, a shortfall refusal and a limit refusal.
- [x] 7.4 Verify that buying at the bench changes no knob value, invalidates no made model and
      takes no model off a task, and that the year never advances there.
- [x] 7.5 Verify `web/src/no-task-specific-code.test.tsx` still passes with the bench in place —
      it now also forbids naming a model family — and extend it to cover the new screen.

## 8. Nothing selectable changed

- [x] 8.1 Verify that the configurations selectable before this change are selectable after it
      and resolve to the same identifiers, for both families, by replaying the shipped catalog
      and task through the availability walk and comparing against the covered identifiers.
- [x] 8.2 Run the full suite and the build; verify `test/artifacts-untouched.test.ts` still
      passes, that the shipped trees and predictions are byte-identical, and that
      `openspec validate market --strict` passes.

## Context

See `proposal.md` — *Why*. What matters for the approach is what already exists.

Written against a working tree with `fitted-tree` applied and unarchived.

`src/progression/` is one catalog with four pieces around it: `catalog.ts` validates the
declaration, `check.ts` checks what items open against the loaded tasks and the artifact,
`availability.ts` inverts ownership into what may be selected, `purchase.ts` moves the money,
and `market.ts` turns the catalog and a balance into the four states a screen renders. Only
the last of those is about a shop. Everything else is about a catalog, and a second counter
therefore needs a second view, not a second system.

Three facts shape the design. The `model-family` unlock already exists and already works —
`catalog.ts:32` knows the kind, `availability.ts:86` fills the `FamilyAvailability.openedBy`
that had sat empty since `progression-catalog` landed, and `check.ts:71` refuses an unknown
family and two items opening one. The `models` group now holds one family purchase and five
capacity purchases side by side, which is the shelf this change splits. And the `dataset`
knob is a knob of the convolutional family just as `blocks` is, so *which counter sells this*
cannot be derived from what an item opens.

## Goals / Non-Goals

**Goals:**

- One catalog, one purchase path, two views onto it.
- The market's sections come from the task declarations, so a second task's shelf costs no
  screen code.
- The bench reads as a shop for one model at a time, laid out by the knob a price moves.
- Every configuration selectable before this change is selectable after it, resolving to the
  same identifier and the same artifact.

**Non-Goals:**

- Any new family. `fitted-tree` put the second one on the shelf; the third and fourth arrive
  with their own changes.
- Any change to what a purchase does, costs, or opens. The counter is where, not what.
- A price on the convolutional family. See the proposal's *Not in this change*.

## Decisions

### The counter is declared on the group, not derived from the unlock

An item's counter cannot be read off what it opens: `bulk-photos` and `deeper-stacks` are both
`knob-values` unlocks of the same family, and one belongs in the market's Data shelf while the
other belongs at the bench. So the group declares it — `soldAt: "market" | "bench"` — and the
item inherits it from the group it is already required to name.

*Alternative rejected:* an item with no group is a bench item. It needs no new field, but it
makes absence the signal, and a required field accidentally omitted would silently move an item
to another shop rather than being refused. The catalog's whole style is that a missing field is
a refusal.

*Alternative rejected:* the counter on the item. It reads more directly, but then two items of
one group could stand at different counters, and the group heading would mean nothing. Putting
it on the group keeps a group a shelf, which is what a group is.

### A section is a task, and its heading is the task's own title

A group may name a task; the market heads that section with `task.title`. The parts of the farm
are the tasks — that is already true of the overview, the labour slots and the harvest — and a
catalog that declared its own places would name the apple orchard twice, in two files, with
nothing able to say which is right when one is edited.

*Alternative rejected:* the catalog declares a `places` list with its own labels. More freedom
(a place need not be a task) at the cost of the one thing the repo consistently refuses: two
statements about one fact. Nothing queued needs a shelf for a part of the farm that is not a
task; if something ever does, it will want its own declaration anyway.

### The `model-family` unlock keeps the task scope it was built with

`fitted-tree` shipped `{ kind: 'model-family', task, family }`, and this change writes that
shape down rather than moving it. Owning the item opens that family in that task; a second
task declaring a family of the same id is a second purchase.

The alternative — keying on the family id alone, so one purchase owns the model everywhere —
has the better slogan and the wrong economy. `CLAUDE.md` has the farmer buying *a robot for
the next task*, and a field that arrives already equipped with every model the orchard owns
has nothing left to earn towards but its land. Keeping the scope also means one item's
coverage is one task's artifact, which is what `check.ts` already walks.

*Consequence to accept:* the Models shelf is farm-wide as a shelf while its items are
per-task. With one task the distinction is invisible; with two, the shelf either grows a
task-named section like the others or the items disambiguate themselves in their labels.
That is a presentation decision for whatever adds the second task, and the sectioning
specified here is what gives it somewhere to go.

*Consequence to record:* `openspec/specs/progression-catalog/spec.md` does not describe this
unlock kind at all — `fitted-tree` built it without a delta. The `ADDED` requirement here is
therefore documenting shipped behaviour as much as specifying new behaviour, and it should
read as a description of `catalog.ts`, `availability.ts` and `check.ts` as they stand. The
one thing it genuinely changes is the unpriced latitude below.

### An unpriced item may name a family that does not exist

The models shelf shows the ladder from the first day, which is `Game_design.md` §5.5's explicit
intent and this game's whole motivation system. Two of the four rungs are built — the network
and the tree — so the shelf either names the two that are not declared or it stops halfway up
the ladder it exists to show.

The latitude is bounded exactly where the existing one is: an unpriced item can never be bought,
so it can never open anything, and pricing it is refused until the family it names is declared.
The cost is that a mistyped family id on an unpriced item is not caught at load. The mitigation
is a test in the shipped catalog's own suite pinning the unpriced family ids, so a rename that
should have updated the shelf shows up as a failing expectation rather than as a shelf entry
that quietly never unlocks.

### The bench lists every family, not the selected one

A locked family cannot be selected (`simulator-shell`), and the bench is where a student reads
what buying one would give them — so a bench tied to the selection could never show the thing it
exists to sell. It lists all of a task's families in declared order, each with its own upgrades
under it, and the family picker keeps its separate job: selection is free and commits nothing,
purchase is deliberate and cannot be undone.

### Upgrades for a family you do not own are buyable

`progression-catalog` is unambiguous: *an item SHALL be purchasable whenever the farm's balance
covers its price ... and SHALL NOT be gated on owning any other item*. A family is an item, so
barring dropout until the network is bought would break the promise the market makes on every
screen. The bench therefore sells it, and the honest presentation is structural: the family's own
state — owned, or the item and price that opens it — sits above its upgrades, so a student
reading a price for dropout is reading it under a heading that says whether they own the model.

*Alternative rejected:* grey out a locked family's upgrades. It reads more sensibly and it is
precisely the "you are not allowed this" that the four market states were designed to never say.

### Owned-at-start becomes a floor

The convolutional family becomes an item so the models shelf can show it as owned beside the
tree it is sold against. A farm saved before this change has `owned: []` or a list without it,
and `game-save` refuses to migrate saves on principle — so without a rule, returning players
would find their only free model locked and unbuyable.

Reading `ownedAtStart` as *what every farm owns* rather than *what a new farm starts with* fixes
it once and permanently, for every future item as well as this one. It is the same direction
`game-save` already faces: what the declarations say now decides what the farm has now.

*Alternative rejected:* a save migration. `game-save` says *a save that cannot be read resets
rather than migrating wrongly*; adding a migration for the first time to avoid a one-line rule is
the expensive way round.

### Where the code goes

- `catalog.ts`: `GroupDeclaration` gains `soldAt` and optional `task`. `UNLOCK_KINDS` and
  `readOpens` need nothing — the family kind is already there. The bench-group constraint
  (knob values of exactly one family) is checked where the groups are read against the items.
- `check.ts`: the existing unknown-family refusal at line 71 becomes conditional on the item
  carrying a price, and gains its counterpart — pricing an item whose family is undeclared is
  refused. The coverage walk is already per family and already enumerates from the defaults.
- `availability.ts`: nothing. It already answers families from the catalog.
- `market.ts` becomes `counters.ts` in effect: `viewOf` is unchanged and shared, `marketView`
  filters to market groups and gathers them into sections, and a new `benchView(task, catalog,
  owned, balanceUnits)` returns families, each with knobs, each with the items opening that
  knob's values. Both call the same `viewOf`, so the four states can never diverge between the
  two counters.
- `purchase.ts` is untouched. Both counters call it.
- `web/src/screens/Market.tsx` renders sections; a new `UpgradeBench.tsx` renders the bench and
  is reached from `ConfigureTask.tsx`. Both are covered by `no-task-specific-code.test.tsx`.

## Risks / Trade-offs

- **A student buys an upgrade for a model they do not own.** → Not barred, by rule. The family's
  ownership sits directly above its upgrades, and the purchase is confirmed with the item named,
  so it takes two deliberate steps under a heading that says what is missing.
- **A mistyped family id on an unpriced item is invisible.** → A pinned test on the shipped
  catalog's unpriced family ids. Pricing is refused until the family is declared, so the failure
  can never reach a farm that can buy it.
- **Two counters could drift into two purchase paths.** → One `purchase()`, one `viewOf()`, and a
  requirement that the counter changes nothing about the purchase. Worth a test that buys the
  same item through both views and compares the resulting state.
- **A second task colliding on a family id unlocks something unintended.** → Recorded as a
  declaration rule, not checkable. The blast radius is one family becoming available early, which
  the coverage check still bounds.
- **`fitted-tree` is applied but not archived.** → This change edits two of its catalog entries
  (`tree-four-questions`, `tree-six-questions` move to the bench group) and leaves
  `sorting-tree` in the market. Its trees, artifacts, evaluator and tests are untouched. If it
  is archived first the main spec gains its deltas and this one still applies; if this change
  archives first, the `model-family` requirement it adds is the one that lands.

## Migration Plan

The catalog declaration is edited in place and the shipped configurations are unchanged, so there
is nothing to roll forward. Existing saves keep their `owned` list and gain the owned-at-start
floor on load. Rollback is reverting the declaration and the code together; a save written after
this change carries only item ids the older build either knows or drops, which `game-save`
already handles.

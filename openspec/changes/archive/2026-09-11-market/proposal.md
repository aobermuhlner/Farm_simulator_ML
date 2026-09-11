# Market

Where a thing is bought becomes a fact about the thing. The market sections by the part of
the farm a purchase belongs to, the models shelf keeps the family purchases and gives up the
capacity ones, and those move to a bench in the workshop beside the knobs they open. One
catalog, two counters.

Written against a working tree with `fitted-tree` applied and not yet archived: the tree
family, its node budgets and the `model-family` unlock are all in the code this change edits.

## Why

The catalog is sound and the shop window is not. Three problems, in the order they bite.

**The market has no places in it.** Its groups — Orchard, Labour, Data, Models — are
farm-wide headings, which reads fine while the farm is one orchard and stops reading the
moment it is not. The heirloom block and the livestock task are both queued, and each brings
its own trees, its own photographs and its own robot. "Data" will then be a heading that
cannot answer *whose photographs*, and the fix at that point is a market rewrite under
deadline. The parts of the farm already exist as declared data: they are the tasks.

**Capacity is sold in the wrong shop, and the models shelf now proves it.** Six items sit
under Models: one of them buys a model — `sorting-tree`, a decision tree for 600 — and five
buy a hyperparameter for a model you may or may not own. `deeper-stacks` and
`tree-four-questions` are on the same shelf as though they were the same kind of thing, and
neither of them is the same kind of thing as the tree itself. A capacity item means nothing
on its own: each opens values of one knob of one family, and a student reads it against that
knob, which is on a different screen. Selling them where the knobs are is not a tidier
arrangement; it is the arrangement that lets a student see *this dial does not go past 2 yet,
and here is what going past 2 costs*.

**The family unlock is built but unspecified.** `fitted-tree` added `model-family` to
`UNLOCK_KINDS`, taught `availability.ts` to fill the `FamilyAvailability.openedBy` that had
sat empty since `progression-catalog` landed, and taught `check.ts` to refuse an unknown
family and two items opening one — and carries no `progression-catalog` delta for any of it.
`openspec/specs/progression-catalog/spec.md` still knows two kinds of unlock. Archiving
`fitted-tree` as it stands would leave the mechanism the whole model ladder is sold through
described nowhere. This change writes it down, in the shape it was built.

## What Changes

- **A group declares the part of the farm it belongs to.** A group may name a task; the
  market then heads that section with the task's own declared title and shows its groups
  under it. A group naming no task is farm-wide and sections after the tasks. The heading
  comes from the task declaration, so a second task's shelf appears without a screen change
  and without the farm's parts being named twice.
- **The family unlock is specified as built.** An item opens a model family by naming the
  task and the family, and owning it opens that family in that task and no other. A family
  declared by a second task under the same id is a second purchase: each field is equipped
  separately, which is the reading `CLAUDE.md` already gives the economy — *money buys the
  robot for the next task*. The two refusals `check.ts` already makes — an unknown family, and
  two items opening one family — are written down with it.
- **An unpriced item may name a family its task does not declare.** Exactly the latitude the
  catalog already grants an unpriced item that names untrained ground, for exactly the same
  reason: it can never be bought, so it can never open anything, and showing the rungs above
  you is the motivation system. It is what lets the models shelf carry the linear regression
  and the dense network beside the network and the tree, each with the declared reason it is
  not yet for sale. The task it names must still exist, and pricing it stays refused until its
  family is declared.
- **Model upgrades move to a bench in the workshop.** A new stage listing every family the
  task declares, each with the upgrades sold for its knobs: what each opens, its price, what it
  has given already, and a control to buy it. `deeper-stacks`, `stronger-regularization`,
  `dropout-layers`, `tree-four-questions` and `tree-six-questions` move there; `sorting-tree`
  stays in the market. Nothing is sold at both counters.
- **The workshop's no-money rule gains one exception, and only one.** Making a model,
  browsing, sitting a tutorial and putting a model to work all stay free and unlimited,
  because that is what keeps hypotheses cheap. Buying an upgrade is a deliberate,
  irreversible purchase, confirmed and debited exactly as the market's are.
- **A locked family is no longer selected by default.** Selection is *first declared*
  (`src/task/families.ts:39`), which was sound while nothing could lock a family and is now
  one priced item away from opening a task on a model the student cannot use. It becomes the
  first declared family that is *available*, and a task with none available selects none and
  says what opens each.
- **Owned-at-start becomes a floor rather than an opening state.** Every farm owns the items
  the catalog declares owned at start, not only a new one — so a farm saved before a catalog
  gained an item does not find the model it has been using locked. `game-save` already drops
  references this build no longer declares; this is the same idea pointing the other way.
- **The shipped catalog is regrouped, and nothing a student can select changes.** Trees and
  photographs go under the apple task; the farm-wide Models shelf keeps `sorting-tree`, gains
  the convolutional family owned at start and two unpriced entries; the five capacity items
  move to the bench. The configurations reachable today are the configurations reachable
  afterwards.

## Not in this change

- **The two unbuilt families.** Declaring a linear regression or a dense network is a change
  each, with its own fitting, artifact and drawing. This change gives them a shelf to appear
  on and a reason for the shelf to be honest about them meanwhile.
- **Pricing the convolutional family.** It is owned at start here, so no existing farm loses
  its model and no shipped artifact changes hands. Charging for the first robot is the Year 1
  hand-sorting economy, which is `manual-sorting`'s ground and a decision about money rather
  than about shelving. The frame is left able to carry it: a task all of whose families are
  locked has none selected, and its workshop says what opens each.
- **Anything `fitted-tree` deferred.** Its placeholder trees stay placeholders and its
  deferred fitting stays deferred. This change moves where its budgets are sold and writes
  down the unlock it introduced; it touches nothing about the trees themselves.
- **Selling anything for a second task.** There is one task. The sectioning is specified so
  that a second one needs no screen change; proving that is a test with a fixture, not a
  second task.

## Capabilities

### New Capabilities
- `model-upgrades`: the workshop's upgrade bench — which families it lists, how an upgrade
  is presented under the knob it opens, that buying there is the market's purchase under
  another roof, and that buying an upgrade selects nothing.

### Modified Capabilities
- `progression-catalog`: the `model-family` unlock kind written down as built; a group naming
  the task it belongs to and the counter it stands at; an item being sold at exactly one
  counter; an unpriced item being allowed to name an undeclared family; owned-at-start read as
  a floor.
- `simulator-shell`: the market sectioned by part of the farm; the bench reached from the
  workshop; the no-money rule's single exception.
- `model-families`: which family is selected when the first declared one is locked, and what
  a task with no available family presents.

## Impact

`src/progression/catalog.ts` (the group fields and the counter check),
`src/progression/check.ts` (the unpriced latitude, which today refuses every unknown family
whatever its price), `src/progression/market.ts` (sections, and the market's half of the
split) plus a bench view beside it, `src/task/families.ts` and `src/save/index.ts` (first
*available* family, and the owned-at-start floor), `declarations/catalog.json`,
`web/src/screens/Market.tsx`, `web/src/screens/ConfigureTask.tsx` and a new bench screen.
`availability.ts` needs nothing: it already answers families from the catalog.

Every `Market.test.tsx`, `test/catalog-*.test.ts` and `test/progression-*.test.ts`
expectation about flat groups is rewritten. `fitted-tree` is applied but not archived; this
change edits two of its catalog entries and none of its trees, artifacts or tests.

## Context

See `proposal.md` — Why. Requirements are in `specs/progression-catalog/spec.md`,
`specs/game-save/spec.md`, `specs/task-contract/spec.md`, `specs/simulator-shell/spec.md`
and `specs/game-economy/spec.md`; this document covers only how they are met.

Six facts decide most of what follows.

**Coverage is three configurations.** `artifacts/apple-harvest/predictions/index.json`
covers `blocks2-channels8/16/32-regularization1-dropout0` and nothing else, while the
declaration's four knobs span 108 combinations. So the three things `CLAUDE.md` wants sold
— deeper stacks, loss regularization, dropout — are all untrained ground today, and the
105 refusals the proposal complains about are exactly the ones outside those three.

**Retraining is already booked, and artifacts are bound to their pool.**
`prediction-artifacts` requires an artifact to name the pool that produced it, and
`Pipeline.md` puts `colour-accessibility` first precisely because it regenerates the pool
and retrains every shipped configuration. Anything trained during this change would be
trained against a pool that is about to be replaced.

**Declarations are runtime data with no build step.** `web/src/data/paths.ts` mounts the
whole `declarations/` directory in the dev middleware and in `closeBundle`, so
`catalog.json` is served with no build change — `farm.json` proved that one change ago.

**Refusals have a house shape.** A `ValidationIssue` list with a code, a message and the
field, rendered by `components/Issues.tsx`; never a throw, never a partial screen. The
economy added the convention that a student's legitimate attempt returns a refusal while a
caller's mistake throws.

**Configuration identity is composed, not hashed.** `src/task/configId.ts` joins knob id
and value in the declaration's knob order, and `resolveConfiguration` is the only producer
of a `ResolvedConfiguration` — an out-of-range value cannot reach a run today.

**The invariant is a list, not a test to write.**
`web/src/no-task-specific-code.test.tsx` reads the screen sources and looks for declared
ids and declared vocabulary; the farm's words were added to it last change by extending an
array.

## Goals / Non-Goals

**Goals:**
- One gating mechanism, in data, that the four changes queued behind this one can extend
  without inventing a second: `dataset-tiers`, `model-families`, `orchard-scale` and
  `manual-sorting` all need to sell something.
- A shipped build in which no configuration a student can select is untrained — without
  removing the untrained refusal, which stays specified and stays reachable.
- Progress that survives a refresh from the first purchase onwards, because the first
  irreversible spend and the first lost session must not be the same afternoon.
- A save whose failure mode is a warned reset, never a wrong migration and never a partial
  adoption.

**Non-Goals:**
- Training anything. Coverage is unchanged by this change, and the item that would need it
  ships unpriced rather than untrained. See the decision below.
- Prices anyone should trust. `Game_design.md` §4.5's table prices robots, trees and data;
  it prices no knob, and nothing earns money yet, so the numbers here are placeholders and
  labelled as such.
- Prerequisites between items. Money is the only key; the robot-gates-expansion exception
  belongs to whichever of `orchard-scale` and `manual-sorting` wins the argument they are
  currently having.
- Selling, refunding, or any economy beyond the debit `game-economy` already exposes.
- A menu, a settings screen, or anything else §5.1's mockup implies beyond the one control
  that starts a new farm.

## Decisions

**The catalog names what it opens; task declarations are untouched.**
The alternative — a `requires` field on each knob value — was the shape `knob-availability`
implied, and it fails the proposal's own test that the progression module be "the only
place unlock rules live": with per-knob requirements the rules are spread across every
task file, and adding an item edits both files. So `catalog.json` names the task, the knob
and the values an item opens, and availability is the inversion of that map. The rule is
default-open: **anything the catalog does not mention is available, and anything it does
mention is available exactly when an owning item is owned.** Three consequences make this
the cheaper direction. Shipped declarations do not change, so no artifact is reinterpreted
and no validator field is added to `task-contract`. A build with no catalog entries is a
playable farm with everything open, which is what "money is the only key" means in the
absence of a shop. And the presentation requirement — a locked value names the item that
opens it — is a lookup in the map we already have, rather than a second search.

The cost is that `catalog.json` references ids inside task declarations, so a typo is a
cross-file error. That is why the catalog is checked against the tasks at load and refuses
with both named, rather than silently locking nothing.

**An item may declare no price, and is then not for sale.**
This is the decision the coverage arithmetic forces, and it is worth being blunt about.
The three items `CLAUDE.md` wants — deeper stacks, regularization, dropout — all open
untrained ground. Selling them would buy a student a refusal, which is worse than today's
situation rather than better. Training them instead means training against a pool
`colour-accessibility` is about to regenerate, and `training/README.md` is explicit that
the three-configuration scope exists so someone can look at each curve and decide it
teaches what it should — 105 curves is a change, not a task.

So an item without a price is shown, greyed, with the declared reason it cannot be bought
yet, and the ground it names stays locked. The shipped catalog is therefore three unpriced
items, and the visible win is not the shop: it is that the configuration screen stops
offering 108 combinations of which 105 refuse. Whoever runs the retrain flips these
entries to priced, which is a data edit and no code — the best available evidence that
this design is the right shape.

Alternatives rejected: shipping an empty catalog (the mechanism would have no shipped
instance, and the greying — the actual point — would not happen); locking `channels`
instead, whose three values *are* covered, so that something is buyable (it buys back the
one knob `CLAUDE.md` says the lesson opens with, and reverses a product decision this
change has no mandate to reverse).

**What is for sale is checked against coverage at load.**
The catalog is refused if the configurations reachable with every priced item owned are
not all covered, naming the item and one uncovered identifier. This is what makes "buying
never buys a refusal" a load-time property rather than an intention someone has to keep.
Checking the full-ownership product is sufficient: every partial ownership reaches a
subset of it. Cost is the product of the priced knobs' value counts — zero entries today,
108 at the absolute maximum for this task — and only priced items multiply, which is the
reason to check the priced set rather than the catalog.

Note what this does *not* do: it does not require every uncovered configuration to be
locked. A build may still leave untrained ground selectable, and `prediction-artifacts`
still refuses it as untrained. The spec asserts separately that the *shipped* catalog
leaves none, which is a fact about this build rather than a rule about all of them.

**Availability is computed once, in `src/progression/`, and screens receive the answer.**
Owned ids plus the catalog give one value — which knob values of which task are open, and
for each locked one, the item that opens it. The screens take that value and render; they
never ask "is this unlocked" by consulting a rule. This keeps the progression module the
single place unlock rules live and keeps the invariant test's job possible: a screen that
never names a knob cannot branch on one.

**The locked check sits outside `resolveConfiguration`, and the three refusals are
ordered.** `src/task/` knows nothing about ownership and should keep it that way, so
`resolveConfiguration` stays exactly as it is and a second, progression-aware check runs
over the configuration it produced. Order is invalid, then locked, then untrained: a value
outside the declared values is a caller's error whatever is owned, a locked value never
reaches an artifact lookup, and untrained is what remains. Each carries its own code, so
`Issues` renders three distinguishable causes with no screen deciding which.

**The save splits: a pure codec in `src/save/`, the browser edge in `web/src/data/`.**
`Game_design.md` §6.3 calls `src/save/` "the only impure module". This repo already
answers that differently and better: `src/task/validate.ts` validates while
`web/src/data/load.ts` fetches, and the same split makes the save's serialization,
version check, shape check and reference-dropping testable with no DOM at all. So
`src/save/` is a codec over a plain object and `web/src/data/save.ts` is the twenty lines
that touch `localStorage` inside try/catch. Storage failure is a value returned from that
edge, not an exception crossing it, because "playable and says so" is a rendering decision.

The storage key is namespaced to this app. GitHub Pages serves every project of a user
from one origin, so an unprefixed key would collide with any other page that user hosts.

**The save records progress, never declarations, and amounts in declared form.**
Copying the currency, the prices or the labels into the save would let a stale copy
disagree with the file that defines it — the second-source problem `game-economy` already
argued against for the currency. So the save holds the seed, the year, the balance, the
year's movements, the ledger, the owned ids and the knob values per task, and everything
else is re-read on open. Amounts are written the way `farm.json` writes them — decimal
amounts, not the economy's whole units — so the one conversion boundary that already
exists stays the only one, and a hand-edited balance reads the way a student expects.

**A version mismatch discards everything; an unresolvable reference is dropped.**
These look inconsistent and are not. A schema the build does not read means the *shape* is
unknown, so no field in it can be trusted and adopting any of it is a guess — reset, with
a warning. An owned id the catalog no longer declares is a known shape carrying a stale
reference, and the build that removed the item is the one at fault; resetting a student's
farm because we renamed an entry would be the worse failure. So the reference is dropped,
it opens nothing, and the money and the years survive.

**The seed ships now, though nothing reads it yet.**
`harvest-scoring` needs a per-farm seed so a year's crop is the same on every visit, and
§10.6 asks whether it is fixed per player or fresh per game. This change answers: drawn
once per farm, kept for that farm's life, redrawn when a student starts a new one — which
is reproducible within a playthrough and different between them. It ships now because
adding a field to the save later means a schema bump, and a schema bump resets every
student's farm. One unused field is a much smaller cost than that, and it is named here
rather than discovered as dead code in review.

**Progression state joins the farm in `App`'s `useState`, written through on change.**
`game-economy` put the farm there and predicted this change would move it into a save;
what actually happens is that the same state gains `owned` and gets written to storage in
one effect keyed on the values that must survive. No context, no store library: the market
and the configuration screen are both rendered by `App`, so the state is one prop away
from both. The spec's "at the point each changes" is satisfied by writing after every
state change rather than on unload, because `beforeunload` does not fire reliably and a
lost purchase is exactly what this change must not ship.

**No prerequisite mechanism, deliberately.**
§4.5 has the robot gating expansion; `manual-sorting`'s proposal argues the opposite, that
the plateau does that work and no gate is needed. Building the mechanism now would be
building for a decision two later changes are still arguing about, and the spec would have
to describe a presentation ("requires the robot") that nothing uses. So purchasability
depends on the balance alone, and the change that wins the argument adds the field it
needs.

**The market is an added farm stage, not a rewrite of the four task stages.**
`workshop-harvest-split` is queued to rewrite *The student moves through overview,
configuration, run and report* into the year loop, and `manual-sorting` also wants
farm-level stages. Touching that requirement here would put three changes in conflict over
one block of text for no benefit, so this change adds a requirement for the market and
leaves the four-stage walk alone.

**`game-economy`'s *The farm's state is not presented as saved* is removed, not modified.**
The proposal's capability list did not name `game-economy`, but that requirement forbids
offering to reset the farm and forbids claiming progress is kept — both of which this
change now does. Its intent survives inside `game-save`, so the delta removes it with the
migration pointing at the three requirements that carry its parts, rather than leaving a
contradiction in the specs for an archive to trip over.

## Risks / Trade-offs

- **The market ships with nothing for sale, one change after an economy that moved no
  money.** Two inert-looking ships in a row invites the reading that the game is stalled.
  → The visible change is on the configuration screen, not in the market: three knobs go
  from freely turnable-into-refusal to greyed with a reason. The market itself fills up
  two changes later, when `manual-sorting` and `orchard-scale` sell a robot and trees —
  neither of which touches configuration identity, so neither is bound by the coverage
  rule that silences this one.
- **The purchase path ships exercised only by tests.** Nothing in the shipped catalog can
  be bought, so a bug in the debit-and-own path would not be found by playing. → The tests
  drive it through a test catalog with prices, including the refusals; and `game-economy`
  already tested the debit underneath it. Named rather than mitigated further.
- **Schema resets will bite during development.** Every shape change to the save wipes the
  author's own farm, repeatedly, and it is tempting to make the reset quiet. → The warning
  is required, and the version is a constant that is only bumped deliberately. A quiet
  reset is the failure mode this whole requirement exists to prevent.
- **The coverage check is a product and products grow.** Four knobs are 108 today; a fifth
  knob with three values makes it 324, and `dataset-tiers` may multiply it again. → Only
  *priced* items multiply, and the check enumerates identifiers that already have to exist
  as artifact keys, so the check cannot outgrow the artifact it checks against. If it ever
  does, that is `dataset-tiers` discovering that tiers do not belong in configuration
  identity, which is a finding rather than a problem.
- **A greyed knob reads as a broken knob.** → Every locked value names the item that opens
  it, and an item that is not for sale states why in declared copy. A student who reads
  the screen learns the model is bought, which is the lesson.
- **The invariant test gains a third vocabulary, and shop copy is prose.** A group label
  like "Models" or an item label like "Dropout" could collide with an ordinary word in a
  screen, or with a knob label already checked. → Labels are matched whole, the way the
  farm's name is; shop copy is not matched at all, because a sentence cannot be pasted
  into a screen without a label going with it.
- **Prices are placeholders and there is no income.** A student who could spend would spend
  the opening balance once and never earn it back until `harvest-scoring`. → Nothing is
  purchasable yet, so the exposure is zero this change; the item that removes it also
  brings the harvest that pays. Starting a new farm is the escape hatch either way.
- **A student can edit the save and give themselves anything.** → Deliberate, specified,
  and not one line is spent on it. §6.4: it is a teaching tool, not a competitive game.

## Migration Plan

Additive, with one ordering constraint: `declarations/catalog.json` lands in the same
change as the loader that reads it, because a missing catalog refuses to open the farm —
the same rule `farm.json` established. No pool, artifact or task declaration changes, so
no regeneration and no retraining; the shipped artifact's three identifiers keep resolving
byte for byte, which is a test rather than an intention.

Students have nothing stored, so the first open of the new build writes the first save.
There is no migration path to write and none to test.

Rollback is deleting `declarations/catalog.json`, `src/progression/`, `src/save/`,
`web/src/data/save.ts`, the market screen and its entry on the overview, reverting the
knob control's locked rendering, and removing the catalog vocabulary from the invariant
test. A save left in a student's browser by the rolled-back build is orphaned data under
one key; nothing reads it and nothing breaks.

The forward step this change is shaped around: when a later change extends coverage,
pricing an item is an edit to `catalog.json` alone. If that turns out to need code, this
design was wrong and the review should say so.

## Open Questions

Deferrable: none of these changes the specs, the approach, or the task breakdown.

- **What the three knob unlocks cost.** Unanswerable until coverage exists and a harvest
  pays; §4.5 prices no knob. The placeholder prices ship as unpriced entries, which is the
  honest form of not knowing.
- **Whether the market wants sections or one list on a narrow viewport.** Laptop-first per
  the project definition, and more interesting once there are more than three rows.
- **Where "start a new farm" hangs.** §5.1's mockup has a `[ menu ]`; until there is a
  second thing to put in a menu, one control somewhere unambiguous is enough.
- **Whether a class wants more than one farm per browser.** One key today. Multiple saves
  is a key prefix and a picker, and nothing about this design forecloses it.

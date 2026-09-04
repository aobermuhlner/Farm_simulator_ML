## Context

See `proposal.md` — Why. Requirements are in `specs/game-economy/spec.md` and
`specs/simulator-shell/spec.md`; this document covers only how they are met.

Five facts about the code as it stands decide most of what follows. There is no farm-level
declaration: `declarations/` holds one file per *task*, and everything the app knows about
itself it learns from a task. The shell has no router — stages are view state in
`web/src/App.tsx`, which already holds the loaded tasks and the selected task, so it is the
only place a farm-wide value can live without inventing a store. `web/src/data/paths.ts`
mounts the whole `declarations/` directory, both in the dev middleware and in
`closeBundle`, so a second declaration file is served with no build change. Refusals have
a house shape: a `ValidationIssue` list with a code, a message and the field, rendered by
`components/Issues.tsx`, never a throw and never a partial screen. And
`web/src/no-task-specific-code.test.tsx` enforces the invariant by reading the screen
sources and looking for declared ids and declared vocabulary — extending it is editing a
list, not writing a new test.

One more constraint, from outside the code: nothing in the app can move money yet. The
market is `progression-catalog`, hand sorting is `manual-sorting`, and the harvest is
`harvest-scoring` and `workshop-harvest-split`. This change is deliberately first in
`Game_design.md` §11 because everything else needs somewhere to put a price, which means it
ships a mechanism ahead of its callers.

## Goals / Non-Goals

**Goals:**
- Money arithmetic that cannot drift, in a module with no React and no storage in it.
- One entry point for "a harvest happened", so the year advancing at a harvest is
  structural rather than a convention later callers have to remember.
- A bar that shows year, money and the state of the farm without knowing what a tree, a
  cultivar or a dataset is.
- Currency and opening state as declared data, refusing the way everything else refuses.

**Non-Goals:**
- Persistence. The save, its schema version and its reset are `progression-catalog`; this
  change's spec instead forbids *claiming* to save, which is the honest version of shipping
  without one.
- Prices, payoffs and the bank advance. `Game_design.md` §4.5's table is untuned
  illustration and this change ships none of it.
- Any screen that spends money, and any wiring of the existing run to pay out. See the
  decision below on why the seam stays unattached.
- Drawing the ledger as a curve. The records carry what a curve needs; the chart belongs
  with a screen that has a reason to show it.

## Decisions

**The farm is declared in `declarations/farm.json`, not in the task declaration.**
Money is farm-wide: one balance, one year, one ledger across every task. Putting the
currency on `apple-harvest.json` would make it a per-task field that must agree between
tasks with nothing able to say which is right when they disagree — the same second-source
problem `types.ts` already argues against for diagram output counts. A farm-level
declaration also matches the architecture `Game_design.md` §6.1 draws, where `catalog.json`
and `progression.json` sit beside the task declarations, so `progression-catalog` extends a
pattern instead of introducing one. The file carries the farm's name, the currency label,
the precision, the opening balance and the opening year — nothing else, because everything
else that will eventually belong to the farm is owned by a later change.

**Money is counted in whole units of the declared precision.**
The payoff table is in fractions — 0.40 a red apple — and a harvest sums tens of thousands
of them. Accumulating that in a float gives a balance of 4 279.999999999 and comparisons
against zero that are true by luck; the spec's "the balance comes to rest at zero" then
depends on floating dust. So `src/economy/` works in the smallest declared unit as an
integer, refuses a non-integer amount loudly, and exposes one conversion at its edge that
rounds an amount to the declared precision. The alternative — floats everywhere with
rounding at display time — is fewer lines and puts the rounding in the one place that
cannot fix the arithmetic. The cost of this decision is a conversion boundary that could be
applied twice; refusing non-integers is what makes a double conversion fail immediately
rather than quietly halve a number.

**Recording a harvest is one indivisible operation, not credit-then-advance.**
The spec requires that the year advances only at a harvest. Exposing `credit` and
`advanceYear` separately would leave that requirement resting on every future caller
remembering to do both, in the right order, and the one caller that forgets produces a farm
whose ledger and year disagree with each other. A single `recordHarvest` that settles the
payment, appends the year record and advances the year makes the requirement true by
construction and gives `harvest-scoring` exactly one call site to attach to.

**The floor and the refusal are two different mechanisms, and both are required.**
A debit larger than the balance is refused — you cannot buy what you cannot afford, and the
refusal names the shortfall so a market screen can say why the button did nothing. A
harvest that settles to a loss is *not* refused: it happened, and it floors the balance at
zero. Collapsing these into one rule would either let a bad year be declined (which is
nonsense) or let a purchase overdraw. Because flooding a loss silently would hide the
year's real figure, the year record carries both what the harvest paid and what the floor
absorbed. That is what lets `harvest-scoring`'s report show gross minus downgrade minus
upkeep honestly while the balance still never goes negative.

**No bank advance in this change.**
`Game_design.md` §4.4 rule 3 pairs the floor with a bank advance for a stuck player. A
player can only be stuck if there is something they must buy to progress, and nothing is
buyable until `progression-catalog`. Shipping the advance now would mean pricing a loan
against prices that do not exist, and it would be dead code with no way to reach it. What
anti-grind rule 3 actually needs today is the floor and the absence of a failure state,
both of which are specified here. The advance belongs to the change that introduces
spending, and this change leaves it a stated deferral rather than an omission.

**The bar renders a supplied list of `{label, value}` facts and owns none of them.**
§5.1's third line reads "300 trees · model: hand-built tree (5 nodes) · data: 1 000
photos", and every noun in it belongs to a change that does not exist. A bar with `trees`,
`model` and `data` fields would hard-code three nouns and break the invariant the same
change is extending. So the bar takes an ordered list of label-and-value pairs, and
`orchard-scale`, `model-families` and `dataset-tiers` each supply their own without
touching the component. Today nothing supplies any, which is why the spec requires the bar
to render correctly — and without an empty row — when the list is empty.

**Economy state lives in `App`'s `useState`; no context, no reducer library.**
The bar is one component and `App` already renders every stage, so the state is one prop
away from where it is needed. React context would add indirection for a single consumer,
and it would have to be unpicked when `progression-catalog` moves this state into the save
anyway. The economy value is immutable — every operation returns a new farm value — so the
React side is a `setState` with the result and the module stays testable without a renderer.

**Runtime refusals are result values; programming errors throw.**
A debit that overdraws is a legitimate thing for a student to attempt, so it returns a
refusal carrying a `ValidationIssue` with the shortfall named — the same shape the loader
and the pool reader already return, so the bar's screen can hand it to `Issues` unchanged.
A movement with no reason, or an amount that is not a whole unit, is a mistake in the code
calling the module; those throw, the way `scoreRun` already throws for a payoff table with
a hole in it. Mixing the two would make a student's empty wallet indistinguishable from a
bug.

**The seam stays unattached: nothing in the app moves money in this change.**
The tempting shortcut is to credit the existing report's earnings and advance the year when
a run finishes. That is exactly the slot machine `CLAUDE.md` and `workshop-harvest-split`
set out to kill — money moving on a button the student presses repeatedly from the knobs —
and it would have to be torn out again two changes later. So the farm opens at its declared
state, the bar shows it, and only tests move it. This is the price of taking the cheapest
change first and it is worth naming rather than smuggling in a temporary payout.

## Risks / Trade-offs

- **The bar ships inert: a year counter that never advances and a balance that never
  moves.** A student could reasonably read that as broken. → Nothing on screen claims
  otherwise, the opening balance is declared (so it can be non-zero and legible), and the
  three changes that move it are next in the sequence. Not mitigated further; ordering
  chose this.
- **Session-only state will eventually lose a student's farm.** → Nothing costs money yet,
  so nothing can be lost yet, and the spec forbids claiming a save exists. The moment
  spending ships, `progression-catalog` ships the save with it — that dependency is already
  recorded in §11.
- **The minor-unit boundary is easy to apply twice**, halving or squaring a figure in a way
  a screen would render without complaint. → Non-integer amounts are refused at the module
  edge, so a second conversion throws rather than rounds; the conversion lives in exactly
  one function and is tested against the payoff table's fractions.
- **A second declaration file is a second thing that can be missing**, and a farm that will
  not open is worse than one with a hard-coded currency. → It refuses through the existing
  `Issues` path with the field named, and it is one small file added in the same change as
  the code that reads it. There is no version where the code ships without it.
- **The facts row invites later changes to reach into the bar for their nouns.** → The
  props type carries only labels and values, so a noun cannot enter the component without a
  deliberate type change, and the invariant test fails if one does.
- **The floor could bury a catastrophic year** behind a balance that merely stopped at
  zero. → The absorbed amount is on the year record, and `harvest-scoring`'s report is
  required to show the arithmetic rather than the outcome.

## Migration Plan

Additive, with one ordering constraint: `declarations/farm.json` must land in the same
change as the loader that reads it, because a missing farm declaration refuses to open the
farm. No pool, artifact or task declaration changes, so no retraining and no regeneration.
Rollback is deleting `src/economy/`, the bar, the farm declaration and its loader, and
reverting the two lines that extend the invariant test's vocabulary; nothing else consumes
any of it.

## Open Questions

Deferrable: none of these changes the specs, the approach, or the task breakdown.

- **Where the bank advance lives and what it costs.** Belongs with the first change that
  can strand a player, which is the first change that sells something.
- **Where the ledger is drawn.** The records carry what a curve needs; whether it hangs off
  the harvest report or the farm overview is a question for a screen that has one.
- **Grouping separator, and whether the currency label leads or trails the number.**
  Cosmetic, and only interesting the day a second currency exists. One formatter, one
  declared label until then.
- **How the bar behaves on a narrow viewport.** Laptop-first, per the project definition;
  the summary row is the part that will want to wrap or collapse, and that is worth
  deciding with real facts in it rather than with an empty row.

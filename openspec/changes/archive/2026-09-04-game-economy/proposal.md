# Game economy: currency, the year counter, the ledger and the persistent bar

Authored 2026-09-04 from `Game_design.md` §4.4, §4.5, §5.1 and §6.3. Depends on nothing.
Read `openspec/specs/simulator-shell/spec.md` alongside it — the four stages it requires
are what the persistent bar sits on top of, and *The shell contains no task-specific code
paths* is the rule the bar has to obey.

## Why

`CLAUDE.md` opens with it: the money loop *is* the progression system. Tasks are unlocked
by understanding, and money is the pacing device that stops a student skipping to the
end. Today nothing in the simulator holds money, and nothing counts years — so there is
no pacing device, and every change that wants to sell something has nowhere to put the
price.

This is the cheapest change on the list and almost everything else waits on it. It also
introduces no machine learning at all: a currency, a year counter, a record of what each
harvest paid, and a bar that makes the state of the farm legible without navigating.

## What Changes

- A pure economy module: balance, credits and debits with a stated reason, year advance,
  and a `YearRecord` appended per harvest so the ledger can later be drawn as a curve.
  Pure arithmetic, trivially testable, no React and no storage.
- The persistent bar (§5.1) on every screen: year, cash, and a summary line of what the
  farm currently is. It renders from declared data and names no task, item or cultivar —
  the shell invariant extends to it. The summary line is an ordered list of label-and-value
  pairs that later changes supply; nothing supplies one yet, so the bar must read correctly
  with none.
- Anti-grind rule 3 (§4.4) as a requirement rather than a hope: money floors at zero, a
  bad year is narrated as a bad year and never as a game over. **The bank advance is
  deferred**, and `design.md` says why: a player can only be stuck if something must be
  bought, and nothing is buyable until `progression-catalog`. What rule 3 needs today is
  the floor and the absence of any failure state, and both are specified here.
- Two distinct rules, not one: a debit larger than the balance is *refused* with the
  shortfall named, while a harvest that settles to a loss *happens* and floors the balance
  at zero, with the amount the floor absorbed recorded on the year rather than swallowed.
- Currency is declared and cosmetic. CHF is a placeholder and the code does not care.
  It is declared **farm-level**, in a new `declarations/farm.json` beside the task
  declarations, because one balance and one year span every task; the same file carries the
  farm's name, the precision money is counted to, and the state play opens at.
- The year counter advances only when a harvest is run, and that is structural rather than
  a convention: recording a harvest settles the payment, closes the year and advances the
  counter as one operation. Nothing here runs a harvest — that is `harvest-scoring` — so
  this change ships the counter and the ledger with a single seam where the harvest
  attaches, and deliberately does not attach the existing run to it.

## Capabilities

### New Capabilities
- `game-economy`: currency, balance, the year counter, the harvest ledger, and the rules
  that keep a bad year from becoming a failure.

### Modified Capabilities
- `simulator-shell`: the stages gain a persistent bar, and the no-task-specific-code rule
  is restated over the farm's declared vocabulary as well as a task's.

## Impact

New `declarations/farm.json`, new `src/economy/` (declaration validator, amount conversion
and formatting, the farm's money, the year and the ledger), a bar component in
`web/src/components/` rendered above the stage switch in `App`, a farm fetch in
`web/src/data/`, and two lines of vocabulary added to
`web/src/no-task-specific-code.test.tsx`.

No pool, no artifact, no task declaration and no training touched, so nothing is
regenerated and nothing is retrained. The whole `declarations/` directory is already served
and copied by `vite.config.ts`, so the new file needs no build change.

Persistence is deliberately *not* here — the ledger is state in memory until
`progression-catalog` introduces the save, which is also where §10.3 gets settled. In its
place the spec forbids *claiming* to save, which is the honest way to ship without one.
Nothing in the app moves money in this change; the market, hand sorting and the harvest are
the next three changes in §11's sequence and each brings its own caller.

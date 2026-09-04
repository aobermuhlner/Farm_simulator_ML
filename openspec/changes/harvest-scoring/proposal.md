# STUB — not yet authored

Scaffolded during the 2026-09-02 exploration session; rewritten 2026-09-04 against
`Game_design.md` §3, §4.1, §4.2 and §5.6, which answer several of the questions the
original stub left open. Depends on `game-economy`, `three-action-sorting` and
`workshop-harvest-split`. Read `openspec/specs/decision-policy/spec.md` — *Earnings are
the sum of payoff entries* is the requirement this change breaks — and the completed
`task-abstraction` change's `design.md`.

## Why

Running the year is where the lesson lands. `decision-policy` already requires that a
report counts per category-and-action combination alongside total earnings; this change
defines the run itself — what it samples, what it pays, and how the report is read.

It is also the change that makes a single headline number *insufficient by construction*,
which is the guard `CLAUDE.md` asks for. An over-selective configuration scores
beautifully on wormy apples for entirely the wrong reason: it rejects nearly everything. A
lone earnings figure lets a student conclude "low regularization detects worms well", and
that is a claim they would repeat wrongly in a lecture.

## What Changes

- The harvest runs the whole farm over the evaluation pool, and **each year draws a
  different sample**. This settles the original stub's open question — fixed seed versus
  fresh sample — in favour of leaning in, but reframed: do not sell it as evaluation
  noise, sell it as *some years are wormier than others*. A wet spring, more worms. That
  is a distribution shift with a story attached, it is the honest reason a model that
  worked last year underperforms this year, and it gives the year counter a reason to
  exist beyond counting. The original constraint stands: the year-to-year spread must stay
  visibly smaller than the gap between a good and a bad configuration, or the student
  learns that the game is random. That is a numbers question, answerable once the payoffs
  are fixed.
- **The co-op contract** (§4.2), as a declared batch-level delivery term: the co-op buys
  the delivery only if fewer than 2% of crated apples are wormy; above that the whole
  delivery downgrades to juice price. This makes a rare class dominate the value of
  everything else — the real lesson of imbalanced classification, and one that cannot be
  taught with a linear payoff sum. It also has no degenerate optimum: discard everything
  and you satisfy the contract and earn nothing.
- Settling §10.1 that way costs a spec modification, and this proposal should own that
  honestly. `decision-policy` requires earnings to be the sum of payoff entries; a
  threshold over the whole delivery is not a sum of per-apple entries and needs a new
  declared concept. The cheap fallback — wormy crated at a flat penalty — fits today's
  spec unchanged and teaches asymmetric cost but not threshold effects. Choose in this
  change's `design.md`, not by default.
- The report (§5.6): the confusion matrix with money attached, always broken down per
  category and per action, the contract line made visible, and the arithmetic shown as
  gross minus downgrade minus upkeep. The point is the contrast — the earnings figure
  alone reads "1 260, a decent year"; the breakdown says "you lost 3 100 to 300 apples
  out of 18 000". The diagnosis trap defused on screen rather than in a help text.
- **Warn before you punish.** The year before the tolerance is breached, the report says
  how close it came. That free line of text is what turns the bad year from "the game
  cheated me" into "I was told and I did not act".
- Set the payoff values for the apple task, and check the resulting money curve against
  §4.6's playthrough table. Prices and payoffs are data, so tuning them should cost an
  afternoon rather than a change.
- The harvest pays into the ledger and advances the year.
- Whether "inspect the offending apples" (§8.5) ships here or later is this change's
  decision — it is a second line of defence against the diagnosis trap and it is cheap
  for artifact-backed families, which already store a distribution per image.

## Capabilities

### New Capabilities
- `harvest-run`: provisional. How a year's harvest is sampled, scored, and reported, how
  year-to-year variation is presented, and how the delivery term is applied.

### Modified Capabilities
- `decision-policy`: provisional. *Earnings are the sum of payoff entries* no longer
  holds if the contract ships; earnings gain a declared batch-level term over the whole
  delivery.
- `simulator-shell`: provisional. *The report is the payoff table filled with counts*
  gains money, the contract line, and the warning.

## Impact

To be determined. New scoring work for the delivery term, the sampling, and the year
record. Consumes the payoff table and policy from `task-abstraction`, the distributions
from `prediction-artifacts`, the pool from `dataset-generation`, and the ledger from
`game-economy`. Touches the declaration schema and validator if the delivery term is
declared data, which it should be. No retraining and no pool change.

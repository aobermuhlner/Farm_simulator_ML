# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §4.3, §4.5 and §2. Depends on `game-economy`
and `harvest-scoring`. Read `Game_design.md` §4.3 carefully before filling this in — it
is the section most easily got backwards, and getting it backwards teaches something
false.

## Why

The farm has to keep outgrowing the model the student is standing on, or there is no
reason to climb the ladder. Buying trees multiplies apples, which multiplies income
**and** multiplies mistakes: at 100 trees a sloppy model costs pocket change, at 600 the
same sloppiness costs six times as much, in money the student can feel. *The cost of a
model's errors scales with how widely you deploy it* is both the truest sentence in the
design document and the reason a player who only ever buys trees ends up staring at a
large number in the "wrongly crated" column.

Expansion is also the one purchase that always pays off on its own. That matters: the
player is never punished for growing, it just quietly raises the bar the model has to
clear. The intended rhythm is expand, earn more immediately, notice the model is now the
bottleneck, upgrade the model, tune it.

## What Changes

- Tree count as owned, purchasable state, with apples per tree per year declared. The
  harvest volume derives from the orchard rather than from a fixed fraction of the pool,
  which is a modification to whatever `harvest-scoring` specifies.
- **The robot gates expansion, not accuracy** (§4.5). Trees cannot be bought before the
  robot is owned, because the player physically could not hand-sort a bigger orchard.
  That is anti-grind rule 2 made concrete, and it is why hand sorting caps at one year's
  wage forever instead of scaling. It is also the one declared exception to
  `progression-catalog`'s "money is the only key".
- **Be precise about what scale does.** Error *rates* do not change when the orchard
  grows — 9% wrong on 6 000 apples is 9% wrong on 36 000 — so a percentage rule like the
  co-op's tolerance is *not* breached by growth alone. Growth multiplies the money, not
  the ratio. No screen may imply otherwise: a student who leaves believing "more data
  breaks a model" has a false claim, which §1.1 forbids. What breaks a model is the crop
  *changing*, and that is `heirloom-cultivars`.
- Prices: +100 trees at 1 200, five times to 600, each paying back within the year
  (anti-grind rule 1, §4.4). Check against §4.6's Years 4–7, which are meant to be a
  clean upward run — that stretch is what teaches the player to trust that upgrading is
  worth it, and it is what makes the later pivot land.
- Settles §10.7: is the step down acceptable — the first bought model earning slightly
  *less* than the player's own hands, paid back by scale the following year? It is the
  honest version and it sets up "you bought scale, not accuracy", but it risks the robot
  feeling like a bad purchase for one year. The alternative is tuning hand-sorting
  accuracy down until the first model is an immediate win.

## Capabilities

### New Capabilities
- `orchard-scale`: provisional. Orchard size as owned state, how harvest volume derives
  from it, the robot's gate on expansion, and what the game may and may not claim about
  scale.

### Modified Capabilities
- `harvest-run`: provisional. Volume derives from the orchard, and the money in the
  report scales with it while the rates do not.

## Impact

To be determined. Catalog entries for trees and the robot, orchard state in the save,
volume arithmetic in the scoring module, and the farm overview's orchard card (§5.2). No
pool change and no retraining — the evaluation pool is sampled with replacement or scaled
arithmetically rather than grown, and which of those it is is a decision for this change.

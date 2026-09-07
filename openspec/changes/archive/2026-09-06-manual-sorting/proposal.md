# Sort the first harvests by hand

## Why

Rung 0 of the ladder (`Game_design.md` §2, §5.3): before anything is automated, the student
does the robot's job by hand. Two things come out of it and both are worth a screen.

They have personally made the calls. Every error in every later harvest report is one they can
judge on sight, because they sat there making the same judgement. Without this, a confusion
matrix is a table of numbers about a task the student never performed.

And they learn how slow they are. The first crop is about ten apples and sorting it is easy.
The first few purchases are more trees, so the next crop is bigger, and the one after that
bigger again — and every one of those apples is one the student clicks. The pile growing under
their own hands is the argument for a robot, and it is an argument they feel rather than one
the game makes in a paragraph.

## What Changes

- A sorting screen (§5.3): one pool image, the task's three declared actions as buttons,
  keyboard-driven, and a swipe on mobile. The brief defers mobile, but this is the one screen
  genuinely better with a thumb than a laptop, so it is worth designing thumb-first from the
  start.
- **The crop is sorted, not sampled.** The student sees the year's actual apples, starting at
  about ten and growing with the orchard, and the wage is the declared payoff table over the
  decisions they actually made. Nothing is extrapolated and nothing needs disclosing as an
  estimate, because nothing is being simplified.
- One person can only get through so much. Past a declared number of apples per harvest, the
  rest of the crop goes unsorted, earns nothing, and is counted on screen. That is the plateau
  (anti-grind rule 2, §4.4) and it is also the motivation: every tree bought after that point
  pays nothing until a robot is on the orchard.
- The apples come from the **evaluation split** — the crop is what the camera sees, not the
  bought photos — and the mix follows the crop's declared composition rather than the pool's
  own, because the pool over-represents wormy apples on purpose and an orchard that was a
  quarter wormy would make nonsense of every later worm-tolerance rule.
- The summary breaks down per category and action like every other report in this game, states
  what a faultless sort of the same apples would have paid, and does the throughput arithmetic
  out loud: how long it took, apples a minute, and how long the whole crop would take at that
  rate — including the part that went unsorted. Time is measured and reported, never priced.
- The price of putting a robot on the orchard is shown against the wage — only when the farm
  actually declares such a purchase, never invented here.
- **This produces no training set.** Datasets are bought pre-labelled and the player's clicks
  are not kept. The label-noise lesson therefore lives in `dataset-tiers` instead, which is the
  better version anyway because it is authored rather than dependent on how carefully one
  student clicked.
- Settles §10.4: hand sorting is **the labour whenever no robot is working the orchard**. Not a
  one-time prologue, and not an option kept alongside the robot — put a robot on the orchard
  and it does the job; take it off and the student is sorting again. A crop is brought in once,
  so a year is never paid twice.
- A completed sort is that year's harvest: it *records a harvest* in `game-economy`'s sense —
  the wage is settled, one record is appended for the year that closed, and the year advances,
  as one indivisible step. Hand sorting is the first thing in the game to do so.

## Capabilities

### New Capabilities
- `manual-sorting`: how a year's crop is drawn and presented, what the player's decisions are
  measured against, what the sort pays, what happens to the apples one person cannot reach,
  and what is deliberately not kept.

### Modified Capabilities
- `simulator-shell`: the shell gains stages that belong to the farm rather than to a task
  run — reachable from the overview, leavable, and not enterable when the farm does not offer
  them. The four task stages are unchanged. *The shell contains no task-specific code paths* is
  restated over those stages, since this one renders a task's images and actions.

## Impact

- New `src/sorting/`: the crop draw, the tally and the wage. Pure arithmetic over declared
  data, no React and no clock of its own.
- New screens under `web/src/screens/` for the sort and its summary, plus an entry point on
  `FarmOverview`. Images are read through the pool's declared atlas delivery and the manifest's
  labels — the same access the training browser has, and bound by the same prohibition on
  showing generation attributes.
- `declarations/apple-harvest.json` and `src/task/validate.ts` gain how many apples one person
  can sort in a harvest and the per-apple time cap.
- `declarations/farm.json` gains the crop's opening size and category composition, validated
  by `src/economy/declaration.ts` the way the currency and the opening balance already are.
  Hand sorting is the first thing to *record a harvest*, so the ledger gains its first writer.
- `web/src/no-task-specific-code.test.tsx` extends to the new stage.
- No artifact, no training, no pool change — a fact worth asserting rather than assuming.
- **Debt this creates, named rather than discovered later:** there are now two answers to what
  the crop contains — the declared composition and what the evaluation pool holds.
  `harvest-scoring` must draw its yearly harvest from the declared composition too, or its
  report and this screen will describe different orchards.
- **Contradicts `orchard-scale`'s stub, deliberately.** That stub carries §4.5's rule that the
  robot gates expansion — trees cannot be bought until the robot is owned. The early game this
  change assumes is the reverse: trees are the first purchases, the crop grows with them, and
  the growing crop is what makes the robot worth buying. The plateau does the work a gate was
  going to do, without an exception to §2's *money is the only key*. Whoever authors
  `orchard-scale` inherits this rather than discovering it.
- **Depends on** `game-economy` — landed and archived, and this change pays through its
  *recording a harvest* step — and `three-action-sorting`, still open, which owns the third
  action and the payoff table this screen prices with. The
  wage is only as honest as that table; this change deliberately ships no correction of its
  own, so a degenerate table fails loudly here instead of being papered over.

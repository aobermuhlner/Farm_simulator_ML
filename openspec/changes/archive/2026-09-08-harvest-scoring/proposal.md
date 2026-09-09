## Why

The robot does not harvest the farm. It harvests the pool.

`workshop-harvest-split` shipped the ritual — the confirmed control on the overview, the
year that stays open until every crop is in, the per-task report of the year that closed.
`manual-sorting` shipped the crop: a year's apples, sized by the orchard, composed as the
farm declares, drawn from the evaluation split and keyed on the farm's own seed and the
year. But the model path never learned about any of it. `runFielded` scores all 1 000
evaluation images, every year, identically. Nothing it returns depends on the orchard, the
crop composition, or the year.

So two labours working one farm harvest two different things, and the year counter counts
nothing. That is the hole. This change closes it with one sentence — **one crop, two
labours** — and then does the two things that only become possible once it is closed: it
makes a year's harvest a year's harvest, and it makes a single headline number
insufficient by construction, which is the guard `CLAUDE.md` asks for.

## What Changes

- **The crop becomes the farm's, and both labours bring in the same one.** The crop
  requirement moves out of `manual-sorting` into a capability of its own, because it was
  never about sorting by hand. A model at work is scored against the year's crop; hand
  sorting presents as much of that same crop as one person reaches. What a person is shown
  keeps its distinctness guarantee. The crop itself loses it — see the next point.

- **A crop larger than the pool repeats photographs, and says so.** Against this pool the
  distinctness rule caps a crop at **714 apples** — green binds first, at 250 images for a
  35 % share. Every money figure in `Game_design.md` §4.5 assumes 6 000 apples at the
  opening orchard, so the ceiling is not an edge case, it is eight times below the
  baseline. Photographs therefore recur inside a large crop, and the report states that
  they do. Under §1.1 this is a mechanism, not a claim, and the rider applies: a
  simplification visible to a student reading the source is stated on screen.

- **Some years are wormier than others, as a declared range rather than as noise.** The
  farm declares a per-year variation range for one or more categories; the year's
  composition is drawn from it deterministically from the farm's seed and the year, so a
  student who leaves and returns finds the same year, and no year can be rerolled by
  abandoning it. A wet spring means more worms. That is a distribution shift with a story
  attached and it is the honest reason a model that worked last year underperforms.

- **The delivery term** — §4.2's co-op contract — as declared batch-level data: a set of
  categories, measured as a share of what a declared set of actions delivered, a tolerance
  above which the whole delivery is paid at a downgraded per-item value, and a warning band
  below it. Earnings stop being a sum of per-apple entries. This is the mechanic that makes
  a rare class dominate the value of everything else, which is the real lesson of imbalanced
  classification and cannot be taught with a linear payoff sum.

- **The tolerance ships disarmed, and the warning ships armed.** Measured against every
  shipped configuration, §4.2's 2 % tolerance is unreachable: the three trained models
  crate 4.6 %–10.9 % wormy across the declared weather, three to five times over. Armed at
  2 % every delivery downgrades every year forever, the robot earns less than a pair of
  hands, and the ladder inverts in money. So the tolerance is declared at **12 %**, which
  no shipped configuration crosses in any declared year, and the warning band at **9 %**,
  which a weak model crosses in roughly one wet year in four. The mechanic is built, spec'd
  and exercised; arming it is one number in a declaration, in the change that fixes worm
  recall. This is deliberate, not an oversight — see `design.md`.

- **The wormy row of the payoff table drops from −1.50 to −0.50.** The flat penalty was the
  cheap fallback for the contract; with the contract shipping, keeping it at −1.50 punishes
  the same mistake twice. It stays negative rather than following §4.2's illustrative
  +0.40, because `decision-policy` requires a category's declared action to be its
  best-paying one, and — measured — a positive entry there makes crating every worm outearn
  perfect play in any year milder than the tolerance.

- **The report gains money, the delivery line, the warning, and the year's condition.** The
  confusion matrix keeps every cell it has. It gains per-row and total earnings, the
  measured share against the tolerance, the arithmetic shown as gross minus downgrade, the
  drawn composition of the year, and the note that photographs recur. The earnings figure
  alone reads "a decent year"; the breakdown says which 300 apples cost you what.

- **Payoffs are set from measurement, and the acceptance figures are recorded.** Per-year
  earnings for all three shipped configurations, at the mildest and wettest declared year,
  become acceptance criteria rather than illustrations.

Out of scope, deliberately: shop prices, the robot's cost and hand-sorting throughput
(§4.5's numbers do not reconcile with the shipped 60-apple cap, and reconciling them
belongs with `orchard-scale` and the market); robot upkeep, which §8.8 recommends
deferring and which §5.6's mock shows anyway; and "inspect the offending apples" (§8.5),
which is interpretability work and wants the change that gives a tree a path to show.

## Capabilities

### New Capabilities
- `harvest-run`: what a year's crop is — its size, the composition drawn for that year, and
  how photographs are drawn for it — and how a delivery is valued: the payoff sum, the
  declared delivery term applied over the whole batch, the warning band, and what the year
  records.

### Modified Capabilities
- `decision-policy`: *Earnings are the sum of payoff entries* becomes the gross of a
  delivery, which a declared delivery term may then downgrade. A task declaring no term
  keeps today's behaviour exactly.
- `task-contract`: declaration completeness gains the optional delivery term, and the term
  is validated against the categories and actions the task declares.
- `manual-sorting`: the crop requirement moves to `harvest-run`; distinctness is scoped to
  the apples a person is shown rather than to the crop; the wage becomes the value of what
  was delivered rather than the raw payoff sum, so the co-op applies to a person's crates
  as it does to a robot's.
- `simulator-shell`: *The report is the payoff table filled with counts* gains money, the
  delivery line against the tolerance, the warning, the year's drawn composition, and the
  disclosure that photographs recur.

## Impact

New scoring work for the delivery term and for drawing a year's crop against a composition
that varies; `src/sorting/crop.ts` becomes the farm's crop rather than hand sorting's and
grows a with-replacement path; `src/scoring/` grows a delivery valuation over a run
outcome; `web/src/model/run.ts` stops scoring the pool and starts scoring a crop. The
declaration schema and validator gain the delivery term and the year-variation range, so
`declarations/apple-harvest.json` and `declarations/farm.json` both change, as does the
wormy row of the payoff table — which moves every earnings figure in the existing tests and
fixtures. No retraining, no new prediction artifact, and no pool change. Consumes the payoff
table and policy from `task-contract`, the distributions from `prediction-artifacts`, the
pool from `image-pool`, the crop from `manual-sorting`, and the ledger and year from
`game-economy`.

## Context

See `proposal.md` — Why. What matters here is what is already in place and what it forces.

`src/sorting/crop.ts` already draws a year's crop: size from `farm.cropSize`, composition
from `farm.declaration.cropComposition`, photographs from the evaluation split, all keyed on
`streamFor(seed, year)`. It refuses with named causes and never returns a partial crop.
`web/src/model/run.ts` ignores every word of that and calls `scoreEntry(..., 'pool', ...)`.
`src/scoring/index.ts` sums the payoff table and counts per cell, and `RunOutcome` is the
shape the report is built from. The pool holds 1 000 evaluation images: 500 red, 250 green,
250 wormy.

Three shipped configurations exist — `blocks2-channels{8,16,32}-regularization1-dropout0` —
and everything below was measured against them rather than reasoned about. Their worm
recall under the declared highest-probability policy is 33.2 %, 34.4 % and 40.8 %. That
narrow spread is the binding constraint on this whole design, and it is not a defect of
this change: `blocks`, `regularization` and `dropout` all have exactly one trained value,
so channel width at two blocks is the entire selectable space today.

## Goals / Non-Goals

**Goals:**
- One crop per task per year, whatever labour brings it in.
- A year that is a year: its own composition, drawn once, deterministic, attributable.
- The delivery term as declared data, general over categories and actions, with its
  punishing branch reachable in play and not only in tests.
- Every number in the declarations derived from measurement, and the measurements recorded
  here so the next change does not re-derive them.

**Non-Goals:**
- Shop prices, the robot's cost, hand-sorting throughput. See `proposal.md`.
- Any load-time validation that requires scoring a configuration. The weather guard is a
  build-time check; see Decision 8.
- Widening the trained coverage. Every constraint below that traces to "the three shipped
  configurations are nearly identical" is loosened by `model-families` and by training more
  configurations, not by anything here.

## Decisions

### 1. The crop moves to `harvest-run`, and the model path is scored over it

`drawCrop` keeps its name and its file but stops belonging to hand sorting. `runFielded`
takes a crop and scores the distributions of the images in it, instead of taking a split
name. Hand sorting keeps calling the same draw and keeps presenting
`min(cropSize, handSorting.perHarvest)` of it.

*Alternative considered:* give the automated harvest its own sample and leave
`manual-sorting` alone. Rejected — it is two definitions of one crop, and the first time
they disagree the student's hand-sorted year and their robot's year stop being comparable,
which is exactly the comparison Year 3 of `Game_design.md` §4.6 is built on.

### 2. A crop larger than the pool repeats photographs

The distinctness rule caps a crop at **714 apples** against this pool — green binds, at 250
images for a 35 % share (red allows 909, wormy 2 500). §4.5's opening orchard is 6 000
apples. So the ceiling is eight times below the baseline, not an edge case.

Draw per category: with `n` apples wanted and `m` photographs held, every photograph
appears `floor(n/m)` times, then `n mod m` more are taken from a shuffle. No photograph
appears more than `ceil(n/m)` times and none appears twice while another appears once,
which is what the spec's *whole split before it repeats* requires. At 6 000 apples and a
10 % worm year that is 6 full passes of red, 8 of green, 2 of wormy.

*Alternatives considered:*
- *Cap the crop at 714.* Fails this change's own draw guard (Decision 7) and walls in
  `orchard-scale` permanently — a spec sentence forbidding repeats cannot be unsaid cheaply.
- *Score 714 distinct images and scale earnings to the crop.* Honest as a test-set estimate,
  and §1.1 explicitly permits "sorting 30 apples and extrapolating to 6 000". Rejected
  because the report's per-cell counts then become either sample counts (which contradict
  the crop size printed above them) or scaled counts (which are fictional counts of real
  apples). The report is the one screen that must not be arguable.
- *Score the whole pool and scale.* Cheapest and perfectly stable, but there is then no
  year-to-year variation of any kind and the wormier-years mechanic is impossible.

### 3. Weather is a declared range on the farm, not a task

`cropComposition` already lives on the farm rather than on the task, so the variation range
lives beside it:

```json
"cropComposition": { "red": 0.55, "green": 0.35, "wormy": 0.10 },
"yearVariation":   { "wormy": { "min": 0.07, "max": 0.14 } }
```

The year's share for a varying category is `min + next() * (max - min)`; the categories with
no range keep their declared ratio to one another and absorb the remainder. Whole-apple
allocation reuses the existing `allocate`.

The composition draw consumes from the same `streamFor(seed, year)` stream *before* the image
shuffles, which moves every existing crop. That is acceptable — no saved farm in the wild —
but it means the hand-sorting fixtures change with this work rather than after it.

### 4. The delivery term is declared task data, general over categories and actions

```json
"delivery": {
  "measures":        ["wormy"],
  "delivering":      ["crate-red", "crate-green"],
  "tolerance":       0.12,
  "warnAbove":       0.09,
  "downgradedValue": 0.05
}
```

Valuation, over a `RunOutcome` rather than inside it, so scoring stays the payoff sum and
the term is a second, testable step:

```
  gross      = sum of payoff entries over the crop
  delivered  = apples given a delivering action
  share      = (delivered apples of a measured category) / delivered
  paid       = share >= tolerance
                 ? sum of payoff entries over NOT-delivered
                     + delivered * downgradedValue
                 : gross
  downgrade  = gross - paid
```

Discarded apples keep their entries when the delivery is downgraded, because the co-op is
buying crates; what was never delivered was never part of the deal. With apples that is
0.00 either way, but the rule has to be stated for a task whose non-delivering action is
priced.

The term is optional, and a task without one is valued exactly as today. That is what keeps
the `decision-policy` modification a strict extension rather than a break.

### 5. Wormy crated is −0.50: negative, but not −1.50, and not +0.40

§4.2's illustrative table pays **+0.40** for a wormy apple crated as red. Two things rule it
out:

- `decision-policy` requires a category's declared action to be its best-paying action, and
  refuses the declaration outright. That is a validator, not an opinion.
- Measured, it is also wrong on its own terms. With a positive entry there, "sort red and
  green correctly and crate every worm" pays **0.33/apple** against perfect play's
  **0.29/apple**, and its measured share equals the year's worm share — so it beats perfect
  play in every year milder than the tolerance. The existing scenario *treating every image
  correctly is the best-paying outcome* would fail. A positive entry is only safe if the
  tolerance sits below the *minimum* declared worm share, and no tolerance that low is
  survivable by the shipped models.

So the entry stays negative. Dropping it from −1.50 to −0.50 is because the batch term now
carries the lesson the flat fine was standing in for; leaving it at −1.50 fines the same
mistake twice. Measured, per 6 000-apple crop:

| wormy crated | channels8 | channels16 | channels32 | perfect | share of perfect |
|---|---:|---:|---:|---:|---:|
| −1.50 (today) | 962 | 960 | 1 033 | 1 740 | 55–59 % |
| **−0.50** | **1 363** | **1 353** | **1 388** | 1 740 | **78–80 %** |
| −0.30 | 1 443 | 1 432 | 1 459 | 1 740 | 82–84 % |

−0.50 leaves visible headroom for a better model to earn without making the current ones
look broken. The choice does not affect any guard: the ratio between the weather swing and
the configuration gap is 7.5 at all three values, because both scale with the same quantity.

**Measured against what shipped.** The figures above were simulated before the code
existed. What the shipped build actually pays, per 6 000-piece crop, is asserted in
`test/delivery-guards.test.ts` and is:

| year | channels8 | channels16 | channels32 |
|---|---:|---:|---:|
| mildest declared (7 % worms) | 1 476 | 1 465 | 1 495 |
| the farm's own year 1 (10.9 % worms, drawn) | 1 333 | 1 325 | 1 360 |
| wettest declared (14 % worms) | 1 215 | 1 207 | 1 250 |

The shipped configurations sit at 77–79 % of perfect play over the same crop, which is the
band the simulation predicted, reached by the shipped code. The simulated year-one figures
(1 363 / 1 353 / 1 388) assumed a flat 10 % worm year; the farm's first drawn year is
wetter than that at 10.9 %, which is the whole of the difference.

### 6. The tolerance is 12 % and the warning 9 %, and this is not a fudge

Measured wormy-in-crates share, exactly, across the declared weather range:

| config | mild (7 %) | declared (10 %) | wet (14 %) | worm recall |
|---|---:|---:|---:|---:|
| channels8 | 5.19 % | 7.48 % | 10.59 % | 33.2 % |
| channels16 | 5.14 % | 7.40 % | 10.48 % | 34.4 % |
| channels32 | 4.62 % | 6.68 % | 9.49 % | 40.8 % |
| *a careful hand sort* | — | ~1.5 % | — | — |
| *a hand that crates everything* | 7 % | 10 % | 14 % | 0 % |

Over 400 simulated years at 6 000 apples the highest share seen anywhere was **10.88 %**.
So 12 % is above every shipped configuration in every declared year, with a 1.1-point
margin against a within-year draw spread on the share of about 0.15 points.

**Measured against what shipped.** Twenty-one compositions across the declared range,
scored over every shipped configuration, put the highest share at **10.57 %**
(`blocks2-channels8-regularization1-dropout0`), leaving 1.43 points below the declared
12 %. The warning band at 9 % is reached within the range, so it is a live sentence rather
than dead code. Both are asserted in `test/delivery-guards.test.ts`, which is where a
future retune finds out what margin it is spending.

§4.2's 2 % would downgrade every delivery of every configuration, every year, forever: a
robot earning 31 CHF where a careless pair of hands earns more, and the ladder inverted in
money. That is not a hard lesson, it is a broken game.

But 12 % is not merely "disarmed", and this is the part worth keeping straight. The share is
a function of *behaviour*, and the two labours have very different reach:

```
  a CNN's share is bounded by its worm recall     4.6 % .. 10.9 %   never breaches
  a person's share is bounded by nothing          0 % .. 14 %       breaches when careless
```

A student who crates everything breaches in any year wormier than 12 %, which is 2 years in
7 of the declared range. A student who discards the worms never breaches. So one declared
number punishes carelessness at the rung where carelessness is a choice, and spares the
models at the rung where worm recall is not yet something the student can buy. Arming it
against the models is then a single edit to `tolerance` in the change that raises worm
recall — and the spec, the report, the warning and the arithmetic are all already built and
exercised by then.

The warning at 9 % fires for channels8/16 in roughly one wet year in four, and for
channels32 in about one in ten. It is a live sentence, not dead code.

### 7. The stub's noise constraint splits in two, because measurement says it must

The stub required: *the year-to-year spread must stay visibly smaller than the gap between a
good and a bad configuration.* Measured at 6 000 apples with the payoffs above, that
requirement conflates two sources that behave nothing alike:

```
  same-year gap, best vs worst config      mean  35.9   min 18.0   CHF
  spread across draws, weather held        sd     9.6              CHF   -> 3.7x under the mean gap,
                                                                            1.9x under the worst
  spread across the declared weather       sd    70.6              CHF   -> 2x OVER the gap
```

The image draw is comfortably inside the constraint. The weather is 7× outside it, and no
weather range wide enough to be a story is inside it: earnings move about **76 CHF per
percentage point** of worm share, so matching the 36 CHF configuration gap would mean a
range of ±0.23 points — 9.8 % to 10.2 %, which is not a wet spring, it is a rounding error.

The root cause is Decision 6's table: the selectable configurations differ by 7.6 points of
worm recall, while the weather moves the worm population by 100 % of itself. Weather is
therefore about nine times the lever that the only available knob is.

So the two are held to different standards, and the spec says so:

- **The draw is bounded** — a student cannot see or act on which photographs were drawn, so
  it must not decide their year. Holds, measured, at 3.7× the mean gap and 1.9× the worst.
  Best beat worst in **400 of 400** simulated years.
- **The weather is not bounded, it is named** — the report states the crop's size and each
  category's share for that year, in declared labels. A leaner year is attributable, which
  is the defence the stub actually wanted; a small swing was only a proxy for it. §3 of
  `Game_design.md` asks for exactly this: a distribution shift with a story attached.

This is a deliberate, measured relaxation of the stub, not a quiet one. It also loosens on
its own as trained coverage widens: the gap term grows with every configuration that is
genuinely better at worms.

**A floor falls out of this.** The draw spread scales as `sqrt(S)` and the gap as `S`, so
the guard sets a minimum crop size: `0.00598·S ≥ 3 × 0.124·√S` gives **S ≥ ~3 900**. The
declared `openingCrop` is 10 today, which is a development placeholder; this change sets it
to **6 000** (§4.5's 100 trees × 60 apples), which clears the floor at 3.7×. Anything below
about 4 000 fails the guard, which is worth knowing before `orchard-scale` picks tree counts.

### 8. The weather guard is a build-time check, not a load-time validator

*No year the farm can draw crosses the tolerance by itself* requires scoring every
selectable configuration over the extreme compositions. That is 3 configurations × 2
extremes today, but it means fetching and scoring prediction artifacts before the farm will
open, in a browser, to validate a declaration. Rejected: the cost is unbounded in the number
of shipped configurations, and the failure it catches is an authoring mistake, not a runtime
condition.

It becomes a test over the shipped declarations and artifacts instead — the same place the
`progression-catalog` check *nothing for sale opens a configuration no model was trained
for* lives. The spec states it as a property that holds, with a scenario that reads as the
test it is.

### 9. What the harvest records, and where

`RunOutcome` grows a delivery valuation alongside it rather than inside it: gross, share,
tolerance, warned, downgrade, paid, plus the crop's size, its drawn composition, and whether
photographs recurred. `game-economy`'s year record already carries what the harvest paid and
what the floor absorbed; the report's figures ride with the per-task outcome the overview
already keeps for *A task offers the report of the year it closed*. No new persistence
concept, and `game-save`'s "the save records progress, never declarations" means the
tolerance and the payoffs are read from the declaration at load, never stored.

## Risks / Trade-offs

- **A 12 % tolerance reads oddly against a real co-op's 2 %.** → It is declared data and the
  screen states the co-op's terms as declared, so no copy claims 2 %. Recorded here so the
  next change does not read 12 % as a typo.
- **The downgrade branch never fires for a model in normal play.** → It fires for a careless
  hand sort in a wet year (Decision 6), and it is covered by tests against a fixture
  declaration with a low tolerance. It is exercised, not hypothetical.
- **Weather swamps configuration by 2×.** → Accepted and mitigated by attribution rather
  than by narrowing; see Decision 7. The honest risk that remains is a student who reads a
  wet year as their own fault. The report naming the year's composition is the whole defence,
  so its copy matters more than its arithmetic.
- **Repeats inflate the report's absolute counts.** At 6 000 apples the per-cell counts are
  six passes of the same photographs. → Disclosed on the report, per §1.1's rider. The counts
  are true of the crop, which is what the report is about.
- **Dropping the wormy penalty to −0.50 weakens the per-apple worm lesson while the
  tolerance is unreachable.** → Deliberate: the flat fine was the fallback *instead of* the
  contract, and the contract is what teaches the batch lesson. The interim state is a mild
  per-apple cost, which is honest about what a worm in a crate actually costs a farm.
- **Every earnings figure in the tests and fixtures moves**, from the payoff change, the
  crop-based scoring, and the stream shift in Decision 3. → Expected and large. Fixtures
  should derive expected earnings from the declaration wherever they can, so the next payoff
  tuning is not another sweep.
- **`openingCrop` jumping from 10 to 6 000 makes hand sorting pay ~14 CHF against the
  robot's ~1 380.** → Correct per §4.4's rule 2 and harmless today, because nothing is
  purchasable and putting a model to work is free. It becomes a pacing problem the moment the
  market has a robot in it, which is `orchard-scale`'s to solve with prices.

## Migration Plan

No data migration: no saved farm predates this, and `game-save` already drops references a
build no longer declares. The declaration edits (`farm.json`: `openingCrop`, `yearVariation`;
`apple-harvest.json`: `delivery`, the wormy payoff row) land with the validator that accepts
them, so no intermediate state has a declaration the build refuses. Rollback is reverting the
declarations and the `runFielded` call site; the crop draw is additive.

## Open Questions

- The exact copy for the year's condition on the report. It carries the whole weight of
  Decision 7's mitigation, and it is worth writing against a screen rather than in a spec.
  It changes no requirement.
- Whether `yearVariation` should eventually move from the farm to the task, as
  `cropComposition` probably should once a second task exists. Nothing here depends on which
  side it lands, and moving it is a declaration change.

## Context

See `proposal.md` — Why. What that section does not carry is the arithmetic, and the arithmetic
is most of this change: every price in the catalog was calibrated against a farm that opened
with 2 000 francs and six thousand apples, and this change moves both ends of that. The numbers
below are the design, in the same sense that the payoff table is the design of the harvest.

Three figures are fixed by the existing build and constrain everything else:

- **The evaluation split holds 500 red, 250 green and 250 wormy photographs.** Deliberately not
  the orchard's composition — it oversamples worms so that a large crop can still draw them.
- **`allocate()` forces every declared category to appear at least once**, taking a whole piece
  from the largest count to do it. At small crops this dominates the declared shares.
- **`openingBalance` already admits zero**; `handSorting.perHarvest` is a required field and its
  removal is a validator change.

## Goals / Non-Goals

**Goals:**

- Every capability on the farm is bought with apples the student sorted.
- The first purchase that ends the clicking is the model that can be read, not the one that
  cannot, and the gap between their prices says so loudly.
- The throughput argument for automating arrives as a number the student produced, at the moment
  they are deciding whether to go on clicking.
- The orchard ladder terminates, so the land it could reach stays a real figure.

**Non-Goals:**

- Re-fitting, re-shaping or re-measuring any prediction artifact. No model gets better or worse
  here; only what it costs and how widely it is deployed changes.
- The bank advance from the design document's anti-grind rule 3. A farm at zero with nothing
  owned can always hand-sort, so there is no dead end to rescue yet.
- Balancing the *mid*-game against measured model accuracy. The prices below assume a working
  model earns about 85% of perfect play; that is an estimate, and tuning it is cheap later.

## Decisions

### The payoff table triples rather than the orchard growing to 1 200 trees

At the old 0.29 a piece, a 10 000 eye needs roughly 5 900 apples a harvest to land in a handful
of years — about 1 200 trees, or eleven repeats of the `+100` rung. An unbounded repeat would
also leave `orchard-scale`'s "the land it could reach" with nothing to show.

Tripling what apples pay puts the same eye within reach of a 400-tree orchard, which the ladder
can enumerate:

```
              crate-red   crate-green   discard          delivery
  red           1.20         0.60          0             downgraded
  green        -0.90         0.60          0             value 0.05 -> 0.15
  wormy        -1.50        -1.50          0

  perfect play = 0.55(1.20) + 0.35(0.60) + 0.10(0) = 0.87 a piece
```

Every entry scales by the same factor, so no relationship between mistakes moves: a green sold
as red still costs three quarters of what a correct red earns, a worm still costs more than any
apple is worth, and the ratio the delivery downgrade represents is unchanged.

*Alternative considered:* keeping 0.29 and letting the ladder run to ~1 200 trees. Rejected
because it breaks the reachable-land figure and makes the endgame eleven identical purchases.
*Alternative considered:* dropping the eye to ~2 000. Rejected by the user — the eye should read
as the expensive black box.

A pleasing check falls out of it: 400 trees at five apples each is 2 000 apples, which pays
1 740 at perfect play — exactly the "Perfect-play income, Year 1" figure `Game_design.md` §4.5
gives the *old opening* orchard. The endgame arrives where the game used to begin.

### The ladder is five items, not one repeatable one with a rising price

`progression-catalog` requires that money be the only key to a purchase and that nothing be
gated on owning anything else. A rung whose price rises with how many times it has been bought
would need a new declaration shape and a new rule about ordering. Five separately declared items
need neither: the prices ascend, so the ladder orders itself, and a student who somehow has the
money for a later rung first may simply buy it.

```
  item              land   price   reached at     harvests to afford
  ----------------  ----   -----   ------------   ------------------------------
  (opening)            1       -    5 apples
  expansion-1         +4      15    25 apples      ~4 at 1 tree   (4.35/harvest)
  expansion-2         +5      55    50 apples      ~2.5 at 5      (21.75)
  expansion-3        +10     110   100 apples      ~2.5 at 10     (43.50)
  expansion-4        +30     220   250 apples      ~2.5 at 20     (87.00)
  expansion-5        +50     550   500 apples      ~2.5 at 50     (217.50)
  expansion-6       +100    1100   x3, to 400      ~2.5 at 100    (435.00)
                                    2 000 apples
```

Maximum land is 1 + 4 + 5 + 10 + 30 + 50 + 3x100 = **400 trees**, so the market can state it.
The totals read 1, 5, 10, 20, 50, 100, 200, 300, 400 — round numbers on screen, at the cost of
the first two deltas not being the round ones.

### Where the models sit on that ladder

```
  sorting tree        100    affordable ~2.5 harvests into a 10-tree orchard,
                             where the crop is 50 apples and clicking has begun to hurt.
                             It competes head-on with expansion-3 at 110: buy more work,
                             or buy the thing that does the work.
  two more questions  150    ~2 harvests at 20 trees with the tree working
  two more again      400    ~2 harvests at 50 trees
  the robot's eye   10000    ~7 harvests at 400 trees with the tree working
```

The tree at 100 against the eye at 10 000 is the point of the whole re-pricing, and it is a
hundredfold rather than a near-miss on purpose.

### The hand-sorting plateau is carried by the split, not by a declared number

Removing `handSorting.perHarvest` removes the mechanism `orchard-scale` cited for anti-grind rule
2. The replacement is already in the build: hand sorting may only show distinct photographs, and
the split holds 500 / 250 / 250. Green runs out first.

```
  crop 2 000 apples at 400 trees, drawn ~1 100 red / 700 green / 200 wormy

    green photographs available   250
    the crop's green share        0.35
    apples presentable            250 / 0.35 = ~714

  so about 714 apples, in the crop's own proportions, for a perfect-play
  ceiling near 620 a harvest -- against the robot's 1 740 on the same orchard,
  and 714 clicks to get it.
```

That is the plateau, and nothing declares it. It binds from roughly 143 trees onward and never
lifts, so 10 000 is about sixteen maximum-patience harvests of seven hundred clicks each. Rule 2
holds.

**The presented portion keeps the crop's composition** rather than being filled out with
whichever categories still have photographs. Filling it out would give a hand sorter a crop
richer in worms than the one the robot faces, and the student's whole reason to sort by hand is
to compare their own result against the robot's on the same orchard. A distorted portion makes
that a different task rather than a smaller one.

### The remainder figure is priced from the declaration, never from the apples

The offer to stop must say roughly what the student is leaving, or the choice is uninformed. But
those apples are still on screen, and their true categories are exactly what the student is
being paid to work out one picture at a time. Computing the figure from the drawn crop would
answer that question in aggregate — "the 350 you are leaving are worth 91" tells a careful reader
how many of them are wormy.

So the figure is `remaining x declared composition x each category's own payoff` — what the
orchard *bears* on that many apples, not what these ones hold. It is presented in those words.
It is an estimate, it is allowed to be wrong for this particular crop, and it leaks nothing.

*Alternative considered:* showing no figure at all and only the count and the time. Rejected —
the count alone does not make the automation argument, and the time alone makes it about
boredom rather than about money.

### A five-apple crop is 2/2/1 and the spec says so

At the opening orchard the declared 55/35/10 yields three, two and none; the one-of-each rule
then moves an apple from red to wormy, and the crop is 2/2/1. It is 2/2/1 in *every* year — the
`yearVariation` band for wormy (0.07 to 0.14) yields the same counts across its whole range at
this size, which is worth checking rather than assuming:

```
  w = 0.07  ideal 2.842 / 1.808 / 0.350  ->  3/2/0  ->  forced  2/2/1
  w = 0.14  ideal 2.628 / 1.672 / 0.700  ->  2/2/1            2/2/1
```

Kept, because a first crop containing all three kinds of apple is the right first crop. Written
down, because the declaration then describes something the game does not draw, and a screen
printing the declared shares beside that crop would be stating something untrue at the moment a
student is learning whether to trust the numbers. `harvest-run`'s new requirement forbids it and
requires the drawn counts instead.

## Risks / Trade-offs

- **Every fixture carrying 2 000 / 100 trees / 60 apples / 60-per-harvest / a payoff figure
  breaks at once.** → This is the bulk of the work and it is mechanical. Do the declarations
  first, run the suite, and treat the failure list as the task list. Nothing here changes what a
  model predicts, so artifact and prediction fixtures should be untouched — if one moves, that is
  a real finding, not a fixture to update.

- **Saved farms carry the old balance, land and ownership.** → `game-save` already reads a
  reference the build no longer declares as "what the declarations say now decides what the farm
  has now", and `ownedAtStart` is specified as a floor rather than an opening state. A farm saved
  owning `robot-eye` therefore keeps it, free, forever. That is the specified behaviour and it is
  correct — nobody's purchase is revoked — but it means the change cannot be verified against an
  existing save. Verify on a new farm.

- **A first harvest of five apples pays 4.35 and the first purchase costs 15.** → About four
  harvests of five clicks. That is the intended onramp, but it is also the thinnest part of the
  curve: if playtesting says the opening drags, the lever is `expansion-1`'s price, not the
  orchard.

- **The mid-game prices assume a working model earns ~85% of perfect play.** → Unmeasured. If the
  shipped trees do materially better or worse, the `+30` and `+50` rungs are the ones that drift
  first. Cheap to retune; nothing structural depends on the figure.

- **The hand-sorted portion shrinks as a share of the crop while staying the same size.** → This
  is the lesson, but the screen must state the remainder as a count and not as a percentage of a
  crop the student never saw, or it reads as a punishment rather than as a reason to automate.

- **Delivering early with a small, clean portion can beat sorting the whole crop into a
  downgraded delivery.** → True, and left alone: "a small careful delivery beats a large
  contaminated one" is a correct thing for this game to teach, and the tolerance is measured over
  the apples decided in both cases.

## Migration Plan

1. Declarations first — `farm.json`, `apple-harvest.json`, `catalog.json` — so the whole suite
   fails against the new numbers at once and the failure list becomes the work.
2. Validator: `handSorting.perHarvest` stops being required and stops being read.
3. Engine: the crop presented for hand sorting is no longer clamped to a declared number; the
   per-category split bound and the composition-preserving portion take its place.
4. Screens: the deliver control, its confirmation, and the panel of figures beside it.
5. Fixtures and tests last, in one pass.

Rollback is reverting the declarations: nothing in the engine or the screens is meaningful
without them, and no artifact, pool or save format changes.

## Open Questions

- What `expansion-1` should actually cost once someone has played the first four harvests. 15 is
  derived, not observed, and it is a one-line change that touches no spec.

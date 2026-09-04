# Design

## Context

See `proposal.md` — Why. Four facts about the ground this change lands on shape the approach.

**The orchard starts tiny.** The first crop is about ten apples, and the first few purchases
are more trees, so the crop grows harvest by harvest. Hand sorting is therefore not a token
sample of a huge harvest — it is the whole job, and it stays the whole job until the orchard
outgrows one pair of hands. That growing pile is what makes a robot worth buying.

**`game-economy` has landed; `three-action-sorting` has not.** The economy ships
`declarations/farm.json`, `src/economy/`, the persistent bar, and the vocabulary this change
pays in: *recording a harvest* is one indivisible step that settles what the harvest paid,
appends exactly one record for the year that closed, and advances the year. Hand sorting is
simply the first thing to record one. `three-action-sorting` still owns the third action and
the payoff table a sort is priced with; this change consumes that table and adds no arithmetic
of its own to it, which is what keeps the wage a statement about the declared payoffs rather
than about this screen.

**The pool reader already delivers what a sorting screen needs.** `src/pool/` validates the
manifest, refuses rather than half-loading, and `TrainingBrowser` is a working example of
cropping images out of an atlas. The one new thing here is the split: this screen reads the
*evaluation* split, which the training browser is explicitly forbidden to show.

**The evaluation split's composition is a training-data decision, not a crop.** It holds 500
red, 250 green and 250 wormy images — a rare class deliberately over-represented so a model
can learn it. An orchard that was one quarter wormy would make nonsense of `Game_design.md`
§4.2's 2% worm tolerance before that rule is ever written. So "what the crop is" and "what
pictures exist" have to be two different questions.

## Goals / Non-Goals

**Goals:**

- One pure module holds the crop draw, the tally and the wage — no React, no storage, no clock
  of its own — so the arithmetic that pays the player is testable in isolation.
- Every number on the summary traces to a declared value: a payoff entry, a crop figure, a
  declared limit, or something the student did.
- The screen is thumb-first, and its input bindings come from the declared action order.
- Hand sorting scales with the orchard until one person cannot keep up, and then visibly stops
  scaling. That is the whole motivation for the robot, and it is a fact on screen rather than
  a line of copy.

**Non-Goals:**

- Buying trees. `orchard-scale` owns orchard size; this change reads a crop size from farm
  state and works for any value of it, ten or ten thousand.
- Delivery terms. The co-op contract (§4.2) is a batch-level term over a harvest and belongs
  to `harvest-scoring`; the wage here is payoff entries only.
- The market. Nothing is bought on this screen; the price of a robot is displayed only if the
  farm already declares one.
- Persistence. The crop and the decisions are session state, as the balance and the ledger
  already are — `game-economy` requires the farm's state not be presented as saved, and
  `progression-catalog` introduces the save and settles §10.3.
- Palette and colour safety — `colour-accessibility` owns that.
- The automated harvest. This change is the labour for a farm with no robot; the model run
  that replaces it is `harvest-scoring`.

## Decisions

### The crop is sorted, not sampled — and what is not sorted earns nothing

Every apple the student is paid for is an apple they decided. While the crop is within the
declared number one person can sort in a harvest, that is the entire crop; beyond it, the rest
is simply left on the ground, earns nothing, and is counted on screen.

*Alternative considered, and rejected:* sort a fixed sample of about 30 and extrapolate the
measured rates onto the whole crop, which is what §5.3 sketches. It removes the pressure this
change exists to create. If thirty clicks pay for a crop of any size, a student never needs a
robot — the bigger the orchard, the better that deal gets. Extrapolation also has to be
disclosed as an estimate (§1.1), where sorting the actual apples needs no disclosure at all
because nothing is being simplified.

*Consequence, accepted:* a stubborn student with a large orchard and no robot has a bad year
rather than a blocked one. Money floors at zero and never goes backwards (anti-grind rule 3),
they keep what one person's work is worth, and the summary tells them exactly how many apples
they never got to.

### The apples come from the evaluation split

Rung 0 is the harvest, not the dataset. The training split is bought, pre-labelled photos that
a player in Year 1 does not own, and the crop is what the camera on the pole sees.

*Alternative considered:* sort the training split, since it is the set already wired to a
screen. Rejected twice over — it would imply the player is labelling the dataset, which is the
one thing this change refuses to produce, and it would put the model's fitted images in front
of the student as though they were the crop.

*Consequence, accepted:* the student sees harvest apples — out-of-band reds, subtle worms —
before any model has. That is teaching value rather than a leak. `training-browser`'s
prohibition is on *generation attributes*, and it is carried over here verbatim; showing the
apples themselves was never what it guarded.

### The crop's composition is declared; the pool only supplies pictures

The categories in a crop follow the crop's declared composition, and the images for each
category are drawn from the evaluation split.

*Alternative considered:* let the crop look like the evaluation split, which needs no new
declared data. Rejected — it pins the game's orchard to a training-data design choice, and it
makes a wormy rate of 25% the fact every later rule has to live with.

*Consequence, flagged:* there are now two answers to "what is in the crop" — the declared
composition and what the evaluation pool contains. `harvest-scoring` must draw its yearly
harvest from the declared composition too, or its report and this screen will describe
different orchards. That is a real debt and it is named in the proposal's Impact rather than
left to be discovered.

### Hand sorting is the labour when no robot is on the orchard

Not a permanently available alternative, and not a one-time prologue: it is what happens when
nothing else is doing the job. Put a robot on the orchard and the robot does it; take the robot
off and the student is sorting again.

*Alternatives considered:* keep it available beside the robot — rejected, it invites a player
to hand-sort a crop the robot already brought in, and a harvest paid twice breaks the ledger's
one-record-per-year shape. A one-time prologue — rejected, §4.6 needs a second and third
hand-sorted harvest to fund the first purchases at all.

### Speed is measured and reported, never priced

Time drives the throughput line and nothing else. A wage that paid for speed would turn a
screen about judgement into a reflex game, and it would punish the student who looks carefully
at a faint worm — the exact behaviour the rest of the game is trying to teach.

The projected time covers the *whole* crop, including the part left unsorted, because that is
the sentence that sells the robot: *forty apples took you three minutes; this year's four
hundred would take half an hour.* The per-apple contribution is capped at a declared maximum so
that one interrupted apple does not make the projection absurd.

### No feedback until the crop is sorted

*Alternative considered:* reveal the true label after each decision, which is friendlier.
Rejected — it turns the measurement into a training exercise, and the wage is what the student
earned unaided. The mistakes are worth seeing, so they are shown afterwards, in the same spirit
as §5.4's *see mistakes* and §5.6's *inspect those 300*.

### A completed sort is the year's harvest

It credits once, appends the year's record and advances the year, through the seam
`game-economy` leaves for a harvest to attach to.

*Alternative considered:* hand sorting as a side activity with a separate *run the harvest*
that pays. Rejected — before the robot there is no model to run, so the second button would
have nothing behind it.

### Where the numbers live

| Declared where | Values |
| --- | --- |
| `declarations/apple-harvest.json`, validated by `src/task/validate.ts` | how many apples one person can sort in a harvest, the per-apple time cap |
| `declarations/farm.json`, validated by `src/economy/declaration.ts` | the crop's opening size, the crop's category composition |

The split follows what changes: what one person can get through is a property of the lesson and
adding one stays a data change; the crop belongs to the farm and moves as it grows, which is
why it sits beside the opening balance and the opening year rather than beside the knobs. Both
files already refuse a missing or misshapen field with the field named, so neither half needs a
validator of its own.

*Alternative considered:* a third declaration file for the sorting parameters. Rejected — it
forks the validator for a single screen when two existing ones already cover the split.

### First-pass numbers

Placeholders, and data rather than code. The user has a numbers pass in mind; these exist only
so the loop can be played and are expected to move.

| Value | First pass |
| --- | --- |
| Starting crop | 10 apples |
| Crop after the first few tree purchases | tens, then low hundreds |
| What one person can sort in a harvest | 60 apples |
| Per-apple time cap | 60 s |

The shape those numbers have to produce: the first two or three harvests are sorted whole and
feel like the job; growth keeps paying for a few more; then the crop passes sixty and every
extra tree stops paying until a robot arrives. If the plateau bites before a robot is
affordable, the robot's price is wrong — a data change, not a change.

### Gestures follow the declared order, and only where they fit

Three declared actions map to left, down and right in declared order. Beyond three, pointer and
keyboard stay complete and no gesture is invented.

*Alternative considered:* declare a gesture per action. Rejected as premature — nothing in the
declaration speaks about input today, and the shell invariant only needs the *order*, not a
name.

## Risks / Trade-offs

- **A ten-apple crop at a 10% wormy composition is one wormy apple, and some years none of a
  category if the composition is rounded differently.** → Every declared category is required
  to appear at least once, so the first harvest always shows the student what each category
  looks like; the rarity of the wormy one is the class-imbalance lesson arriving early and
  without a name attached.
- **Sixty apples a harvest is sixty clicks, every year, for as long as the student has no
  robot.** → That is the intended pressure, and it is bounded: sixty is the ceiling, not a
  number that grows. The moment it becomes tedious is the moment the robot is worth its price,
  which is the design working rather than failing.
- **The wage is only as honest as the payoff table it prices.** If the shipped table pays for
  crating a wormy apple, the optimal sort is one key pressed sixty times. → Not corrected here;
  a correction on this screen would hide the defect from every other screen.
  `three-action-sorting` owns the table, and a task below checks the degenerate sort explicitly
  so a bad table fails loudly rather than quietly paying well.
- **Two answers to what the crop contains.** → Named above and in the proposal's Impact, for
  `harvest-scoring` to reconcile. Until it lands, this is the only screen that speaks about a
  crop at all.
- **`orchard-scale`'s stub says the robot gates expansion — this change assumes the reverse.**
  → Named in the proposal's Impact. Trees are the early purchases and the growing crop is what
  motivates the robot; a gate would make the first few harvests unbuyable and would contradict
  §2's *money is the only key*. Whoever authors `orchard-scale` inherits this, not a surprise.
- **No save: a reload before the last apple loses the sort.** → The same apples are redrawn,
  because the draw is a function of the farm's identity and the year, and no money is lost. The
  "pays once" guarantee holds for as long as the ledger does, which today is the session.

## Migration Plan

1. `game-economy` has landed. Land this after `three-action-sorting`; the first task below
   verifies the payoff table is there rather than assuming it.
2. The pure module and its tests first, against the committed pool and the shipped declaration.
3. The screen and its tests, including the shell invariant over a second, unrelated task.
4. Play the first several harvests — ten apples, then a bigger crop, then a crop past the limit
   — and record what each paid. Adjusting the numbers afterwards is a data change.

Rollback is removing the stage and the module: the four task stages are untouched by
construction, and no pool, artifact or training run is involved anywhere in this change.

## Open Questions

- Whether a crop past the limit should let the student choose *which* apples they spend their
  effort on, or simply hand them the first sixty. The first sixty is what this change builds;
  choosing is a screen affordance that can be added later without touching a requirement.
- Whether a hand-sorted delivery should be subject to the delivery terms `harvest-scoring` may
  introduce. Pricing with the payoff table alone is correct until such a term exists, and adding
  one later is a change to that capability rather than to this one.

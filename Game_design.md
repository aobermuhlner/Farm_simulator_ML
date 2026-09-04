# Farm Simulator ML — Game & Architecture Design

**Status: brainstorm.** This is a thinking document, not a contract. `openspec/specs/`
holds what is actually specified; this file holds where we might take it and what that
would cost. Nothing here is binding until it becomes a change under `openspec/changes/`.
Section 11 proposes how to cut it into changes.

It is written against what exists today: a convolutional apple-harvest task with frozen
prediction artifacts, a declaration-driven shell, and three open change stubs
(`harvest-scoring`, `knob-availability`, `training-simulation`). Where an idea below
would contradict something already specified, that is called out rather than glossed.

---

## 1. The shape of the game in one page

You inherit a small orchard. You are broke. Nobody is going to sort your apples for you.

```
   YEAR N
   ---------------------------------------------------------------------

     WORKSHOP                MARKET                  HARVEST
     (free, unlimited)       (spend)                 (commit, once)
     +--------------+        +--------------+        +--------------+
     | look at data |        | more trees   |        | every apple  |
     | build / tune |------->| more data    |------->| on the farm  |
     |   the model  |        | better model |        | gets sorted  |
     | read curves  |        | more capacity|        | money lands  |
     +--------------+        +--------------+        +------+-------+
            ^                                               |
            |                  REPORT: what it actually did |
            +-----------------------------------------------+
                              YEAR N+1
```

Three things move: **money**, **the year counter**, and **what you understand**. The
third is the only one that actually unlocks anything — money is just the pacing device
that keeps you from skipping to the end.

The progression is a ladder of model families, and each rung exists to teach exactly one
thing. You do not climb because the last rung "ran out of levels"; you climb because you
have watched the last rung fail at something specific.

### 1.1 The honesty line — what we simplify, and what must stay true

The audience is high-school students. Simplification is not a compromise here, it is the job:
a mechanism nobody can follow teaches nothing. But simplification has a boundary, and it is
worth stating once so that later decisions can be checked against a rule instead of argued
from scratch each time.

**The test:** *if a student repeats this sentence in a first-year ML lecture, does it embarrass
them?*

- **If yes, it must be true.** These are the **claims** — what the game asserts about machine
  learning in general. Overfitting. The train/test gap. Capacity. Class imbalance. Asymmetric
  error cost. Why more data helps. Why a model's mistakes get more expensive the wider you
  deploy it. A student who leaves with one of these wrong is worse off than one who never played.
- **If no, simplify freely.** These are the **mechanisms** — how this particular game produces
  its numbers. Pretrained artifacts replayed as "training". A tree you write by hand instead of
  one that is fitted. Sorting 30 apples and extrapolating to 6 000. Authored gaps between splits.
  Prices tuned until the pacing feels right. None of that is a claim about ML; it is stagecraft,
  and stagecraft is allowed.

One rider, which `CLAUDE.md` already commits to for the training replay: **where a simplification
would be visible to a student reading the source, say so on screen.** "Replaying this
configuration's training run" costs nothing and survives inspection. A student who catches the
game lying about a mechanism will stop trusting the claims too, and the claims are the whole point.

The practical value of this rule is that it settles arguments cheaply. A node budget on the
decision tree is a *mechanism*: keep it — it is comprehensible, it is a purchase, and limiting
tree depth is a genuine capacity limit. Saying *the node budget is why the network beats the tree*
is a *claim*, and it is false, so the game must not say it (§2).

---

## 2. The learning ladder

| Rung | You operate | It teaches | Costs |
|---|---|---|---|
| 0 | **Your own eyes** — sort apples by hand | What the job actually is, and how slow a human is at it. You do the robot's work once, by hand. | free, but capped |
| 1 | **A tree you write yourself** | A model is a decision rule over features. Rules you did not think of are errors you will pay for. | robot + tree |
| 2 | **A tree fitted to the dataset** | Fitting beats hand-tuning. Depth is capacity. The train/test gap appears for the first time. | money + a dataset |
| 3 | **A forest** | Ensembling buys accuracy but not *new* features. The ceiling is the feature set, not the node count. | money |
| 4 | **A convolutional network** | Learned features beat hand features — but only once you tune it, and it is hungrier for data than anything below it. | money |

Rung 4 is the simulator that exists today. Everything else in this document is scaffolding
built *underneath* it, so that a student arrives at the CNN already knowing why they want one.

### What actually makes a player climb

**No hard gates.** Nothing on the ladder is locked behind owning something else. Money is the only
key. In particular the CNN does **not** require the big dataset — it runs perfectly well on the
starter set, it is simply *worse* on it, and the workshop shows you exactly how much worse. Pull
rather than push: a player who has seen the train/held-out gap open up on 200 photos does not need
to be told to buy more.

So two forces do the work instead, and a rung becomes attractive when they meet:

- **A floor: every rung is genuinely a bit better than the one below.** Not dramatically. Enough
  that the upgrade visibly pays back, which is what keeps the player buying.
- **A ceiling: the farm keeps outgrowing the rung you are standing on.** More trees mean more
  apples mean more mistakes (§4.3), and a heirloom block means apples the feature models cannot
  read at all (§2). You never hit a wall that says *stop*; you hit a year where the money stops
  going up as fast as the orchard did, and that is a much better prompt than a locked button.

The intended rhythm is therefore: **expand → earn more immediately → notice the model is now the
bottleneck → upgrade the model → tune it.** Expansion always pays off on its own, so the player is
never punished for growing; it just quietly raises the bar the model has to clear.

**One caution about how the ceiling is built.** It is tempting to say the forest simply *cannot run*
on a big orchard. That one fails the §1.1 test in an awkward direction: a random forest is
genuinely *cheaper* to run per image than a convolutional network, so a student who later learns
that will find we had it backwards, and it is the kind of thing a curious student checks. The good
news is the honest version produces exactly the same pressure at exactly the same moment — the
forest does not stop *working* at 400 trees, it stops being *good enough*, because the same 9%
error rate that was harmless at 100 trees now pushes wormy apples past the co-op's tolerance and
the delivery downgrade eats the expansion profit (§4.2, §4.3). Same wall, same year, and it is
true. Use that one.

### Rung 0 — sorting by hand

The camera on the pole photographs every apple. There is no robot yet, so you look at the
photo and say: crate as red, crate as green, or discard.

**This does not produce a training set.** Datasets are bought, pre-labelled, in the market. Rung 0
exists so the player understands the task before anything automates it — nothing more, and that
is already enough. Two things come out of it:

- **You have personally done the robot's job.** Every later error in the harvest report is one you
  can judge on sight, because you sat there making the same calls. Without this, a confusion matrix
  is a table of numbers about a task you never performed.
- **You learn how slow you are.** The screen does the arithmetic out loud: *you sorted 30 apples in
  4 minutes; that is 7 a minute; the harvest is 6 000 apples; you would be here for 14 hours.* The
  throughput gap **is** the argument for automation. Make the player feel it exactly once.

**It must not be a grind.** You do not sort 6 000 apples. You sort a *sample* — 30 or so — and your
measured accuracy on that sample is extrapolated to the crop. That extrapolation is stagecraft, and
by §1.1 it is fine, but the screen should say plainly that it is estimating your wage from a sample
rather than pretending you sorted the lot.

Since the player's clicks are not kept, the label-noise lesson has to come from somewhere else. Put
it in the *price of data*: the cheap dataset was labelled quickly and has some wrong labels in it;
the expensive one was labelled carefully and is clean. Same lesson, authored rather than emergent,
and it makes the price difference mean something beyond "bigger number" (§8).

### Rung 1 — the tree you write yourself

Not a fitted tree. You pick a feature, pick a threshold, hang two branches off it. The robot
then executes exactly what you wrote, on every apple, all year.

This is where the game earns the word "educative". It is the one moment in the progression
where the model is fully transparent *and* fully yours, which is what makes the CNN's opacity
later feel like a trade you made rather than a black box you were handed.

Design notes:

- The tree runs **live in the browser** over per-image feature vectors. No artifact, no
  training, nothing precomputed. Architecturally this is a gift: rung 1 costs zero training
  compute and zero download, and it sits beside the artifact-backed CNN without disturbing it.
- The features must be **measured from the pixels** — noisy and imperfect — *not* the
  generator's parameters. The pool already records generation attributes per image, and
  `training-browser` already forbids displaying them. Handing those to the tree would let a
  student build a rule that reads the answer sheet. Measured features are the honest version,
  and the noise in them is itself the lesson.
- **Node budget is a purchase.** You start with three splits; more cost money. This is the same
  "capacity is bought, not given" mechanic `CLAUDE.md` already commits to for the CNN's blocks —
  reusing it across families makes the economy feel like one system rather than two.

### Rungs 2–3 — fitted tree, then forest

Optional middle rungs. Cut these first if scope bites.

The fitted tree is where the game first says *the data can find a better threshold than you did* —
and immediately after, *and it will happily find one that only works on the 200 photos it was shown*.
That is the cleanest possible introduction to the train/test gap, and it lands before any
neural-network vocabulary is on screen. It is also the first purchase that makes the dataset you
bought visibly matter, which is why it should come before the CNN rather than being cut for scope.

The forest is there for the pun — you have an orchard, now your model gets a forest — and to
make one point: more trees buys accuracy, never a feature you did not measure.

### Rung 4 — the network

The engine for this is already built; what is new is where it sits in the arc. Three things about
how it should feel:

- **It buys in cheap and starts unimpressive.** Straight out of the box, at the default knob
  values, the network should be *around* as good as the forest it replaced — better on heirlooms,
  possibly worse on ordinary apples. This is not a trick; an untuned network with the wrong
  regularization genuinely does lose to a well-fitted forest. And it is the right feeling: the
  network is not a better model you *bought*, it is a better model you now have to *find*.
- **The small dataset is a real handicap, not a locked door.** On 200 photos the network has enough
  capacity to memorise them, so the workshop's train-versus-held-out gap opens visibly wider than
  it ever did for the tree. That gap is the honest argument for the 1 000- and 5 000-photo sets,
  and it is a claim that survives §1.1: more data helps most exactly when the model has the
  capacity to overfit. Let the player discover it rather than gating on it.
- **Tuning is the endgame, and it is the part that already exists.** Convolutional blocks, patterns
  per block, loss regularization, dropout — the knobs the simulator already ships. Everything in
  this document is scaffolding to get a student to this screen understanding what the knobs are
  *for*, which is the whole point of the exercise.

The heirloom varieties (below) are what make the network necessary in the first place.

### Why the feature-based models must hit a real wall

Per §1.1, the node budget stays as a **mechanism**: it is a purchase, it is comprehensible, and
capping tree depth genuinely does cap capacity. What it must not do is carry the *explanation*.
"You ran out of nodes" is the wrong reason the tree fails on heirlooms, and it is a reason a
student would repeat wrongly later. The real wall — the one that makes the CNN's advantage true
rather than asserted — is **feature expressiveness**, and it is not much harder to say:

> Your tree can only ask questions about the numbers we measured. Nobody measured "the stripes
> run lengthwise", so your tree cannot ask it. The network measures its own.

That sentence is high-school-legible and it is correct, which is the bar §1.1 sets.

Build the wall like this: heirloom cultivars separable by eye but not by any summary statistic we
measure — same mean colour, same size, same roundness, differing only in whether the blush runs in
lengthwise stripes or scattered speckles. An axis-aligned split on `redness`, `size`,
`textureVariance` cannot express a spatial arrangement. A convolution can.

**Green apples get stripes too.** Agreed, and it does more work than it looks like: if only red
cultivars were striped, then "striped" would correlate with "red", and a feature model could hit
the right answer through the wrong door — `stripeStrength > t` becomes a proxy for redness and the
ceiling collapses for a reason we did not intend. Putting stripes on both colours decorrelates
pattern from colour, so the pattern feature carries cultivar information and *nothing else*. That
is the same shortcut-learning problem real datasets have, and here we get to be on the right side
of it by construction.

Two consequences worth writing down now:

- Stripes are therefore **not** the colour-blindness fix. If both colours are striped, the pattern
  cannot also be the cue that distinguishes them. The accessibility answer has to be the palette
  itself (§8).
- The plateau has to be *measured*, not assumed. Feature models around 70% on the heirloom block,
  the CNN in the low 90s — and that gap is **authored on purpose**, exactly as the train/harvest
  distribution gap already is (`image-pool`: *"The distribution gap between the fitted images and
  the harvest is authored"*), and recorded as a deliberate shaping step the same way. If the
  ceiling happens by accident we cannot defend it; if we build it on purpose we can teach from it.

---

## 3. The year loop

`CLAUDE.md` already commits to two separated phases — workshop, then harvest — because pressing
"run a month" straight from the knobs conflates *is my model good* with *did the farm make
money*. The year loop is that split, with a shop wedged in:

```
  +- WORKSHOP ---------------+   free, repeatable, no money moves
  |  browse the training set |   <- exists (training-browser)
  |  tune knobs / build tree |   <- exists (ConfigureTask) + new
  |  replay the training run |   <- stubbed (training-simulation)
  |  see train vs held-out   |   <- exists (held-out-generalization)
  +------------+-------------+
               |
  +- MARKET ---v-------------+   spend, irreversible
  |  trees, data, capacity,  |
  |  the next model family   |
  +------------+-------------+
               |
  +- HARVEST --v-------------+   one commitment per year
  |  the whole farm runs     |
  |  the report pays you     |   <- harvest-scoring, open
  +------------+-------------+
               |  year++
               +-------------->  back to the workshop
```

The commitment matters. If harvest is one click away from the knobs it is a slot machine; if it
is a deliberate end-of-year act it is a decision you defend.

**Each year draws a different harvest.** This answers the open question in `harvest-scoring`
(fixed seed vs. fresh sample) in favour of *lean in* — but reframed. Do not sell it as
"evaluation noise", sell it as **some years are wormier than others**. A wet spring, more worms.
That is a distribution shift with a story attached, it is the honest reason a model that worked
last year underperforms this year, and it gives the year counter a reason to exist beyond
counting. The constraint from that change stub still applies: the year-to-year spread must stay
visibly smaller than the gap between a good and a bad configuration, or the player learns that
the game is random. That is a numbers question, answerable once the payoffs are fixed.

---

## 4. The economy

### 4.1 Three actions, not two

Today the apple task declares two actions (`pick`, `decline`). The brief's sorting phase implies
three: **crate as red**, **crate as green**, **discard**. That is a better design — the payoff
table stops being a yes/no and becomes a real cost matrix, and "sold a green one as red" becomes
a distinct, visible, differently-priced mistake from "threw away a good apple".

**This costs nothing architecturally.** Predictions are stored as distributions over *categories*;
actions, the mapping, and the payoffs are live task data (`task-contract`, `decision-policy`).
Going from two actions to three requires no retraining and no new artifact. Worth stating loudly,
because it is the existing architecture paying off.

First-pass payoff table (illustrative, needs tuning):

|                | crate as red | crate as green | discard |
|----------------|-------------:|---------------:|--------:|
| **red apple**  |       +0.40  |         +0.20  |   0.00  |
| **green apple**|       −0.30  |         +0.20  |   0.00  |
| **wormy apple**|       +0.40 ‼|         +0.20 ‼|   0.00  |

Red sold as green needs no penalty — the lost 0.20 *is* the penalty, and that is a nicer lesson
than an arbitrary fine. Green sold as red is caught by the buyer and fined.

### 4.2 The co-op contract — the single best mechanic here

Look at the wormy row. Crating a wormy apple *pays you*. Under a plain sum-of-payoffs rule the
optimal strategy is to crate everything, which is exactly the "diagnosis trap" `CLAUDE.md` warns
about, inverted.

Fix it with a **batch-level rule** instead of a per-apple fine:

> The co-op buys your delivery only if fewer than **2%** of crated apples are wormy.
> Above that, the whole delivery is downgraded to juice price (0.05/apple).

Why this is worth the trouble:

- It makes a **rare class dominate the value of everything else** — which is the real lesson of
  imbalanced classification, and it cannot be taught with a linear payoff sum.
- It creates a genuine precision/recall tension with no degenerate optimum: discard everything
  and you satisfy the contract but earn nothing.
- It makes the single headline number *insufficient* by construction, which is exactly the guard
  `CLAUDE.md` asks for.

**Spec impact, flagged honestly:** `decision-policy` currently requires *"Earnings are the sum of
payoff entries"*. A contract threshold is a batch-level term over the whole run and does not fit
that requirement. This needs a new declared concept — call it a *delivery term* or *batch
modifier* — and it modifies an existing spec rather than only adding to it. That is a real cost.
The linear alternative (wormy → crate = −1.50 flat) fits today's spec unchanged and is the
fallback if we want to stay cheap; it teaches asymmetric cost but not threshold effects.

### 4.3 Growth multiplies money; changed crops break models

Buying trees multiplies apples, which multiplies income **and** multiplies mistakes. At 100 trees a
sloppy model costs you pocket change; at 600 trees the same sloppiness costs six times as much, in
money you can feel. **The cost of a model's errors scales with how widely you deploy it** — which
is both the truest sentence in this document and the reason a player who only ever buys trees ends
up staring at a large number in the "wrongly crated" column.

But be precise about what scale does and does not do, because it is easy to get this backwards.
Error *rates* do not change when the orchard grows — 9% wrong on 6 000 apples is 9% wrong on
36 000 — so a percentage-based rule like the co-op contract (§4.2) is **not** breached by growth
alone. Growth multiplies the money, not the ratio.

What does break a model is the crop **changing**, not getting bigger. The heirloom block is a new
distribution the old model was never fitted to, and that is where the cliff belongs: the forest
that was comfortably inside the contract on ordinary apples starts pushing wormy heirlooms into
crates, and the delivery is downgraded. Same drama, correct mechanism, and the lesson it teaches —
*models degrade when the data changes, not when there is more of it* — is one of the most useful
things a student can leave with. It is also the lesson the pool already carries, since `image-pool`
authors a deliberate distribution gap between the fitted images and the harvest.

### 4.4 Anti-grind rules

Three rules that keep the pacing honest:

1. **Every purchase is reachable in 2–3 harvests** of the loop that unlocks it. If it takes more,
   the price is wrong or the loop is wrong.
2. **Old loops plateau, they do not scale.** Hand sorting caps at what one person can sort. You
   cannot grind rung 0 into a CNN.
3. **Never hard-fail.** Money floors at zero and a bad year is narrated as a bad year, not a game
   over. If the player is stuck, the bank offers an advance. This is a teaching tool; punishing
   exploration is the one thing it must not do.

### 4.5 First-pass numbers

Illustrative only — these exist so the loop can be simulated on paper and tuned, not because
they are right.

| Item | Value |
|---|---|
| Apples per tree per year | 60 |
| Starting orchard | 100 trees → 6 000 apples |
| Crop composition | 55% red, 35% green, 10% wormy |
| Perfect-play income, Year 1 | ~1 740 CHF |
| Realistic hand-sorting (≈87% accurate) | ~1 450 CHF |
| Picking robot | 2 800 CHF (≈2 hand-sorted harvests — matches the brief) |
| Starter set, 200 labelled photos | free, comes with the robot |
| Hand-built tree | free, comes with the robot |
| +100 trees (×5, to 600) | 1 200 CHF each — **requires the robot** |
| 1 000 labelled photos | 800 CHF |
| 5 000 labelled photos | 2 500 CHF |
| +2 decision nodes | 400 CHF |
| Fitted tree | 900 CHF |
| Random forest | 2 200 CHF |
| Heirloom block | 2 000 CHF (apples at 0.90) |
| Convolutional network | 6 000 CHF — **no data requirement** |

Currency is cosmetic; CHF is a placeholder.

Two structural notes hiding in that table. **The robot gates expansion, not accuracy.** You cannot
buy trees before you own it, because you physically cannot hand-sort a bigger orchard — which is
anti-grind rule 2 (§4.4) made concrete, and it is why hand sorting caps at ~1 450 CHF a year
forever instead of scaling. And **the CNN gates on nothing.** Its price is the only barrier; the
starter set runs it. Everything else the player buys for it, they buy because the workshop showed
them why.

### 4.6 A playthrough

The whole game, start to finish, at the numbers above. Money is illustrative and will need tuning;
the **shape** is the thing to check. Ten years to the tuning screen, and only Years 1–2 repeat.

| Yr | Orchard | Model | Bought | Harvest | Cash | The beat |
|---|---|---|---|---|---:|---|
| 1 | 100 | your hands | — | +1 450 | 1 450 | This is the job. You are slow at it. |
| 2 | 100 | your hands | — | +1 450 | 2 900 | Sorting is shortened — you have proved you know it. The robot costs 2 800 and you can see it in the market. |
| 3 | 100 | hand-built tree | robot −2 800 *(starter set + tree free)* | +1 400 | 1 500 | The tree is about as good as you were, and it did the whole orchard in a second. **Trees are now buyable.** |
| 4 | 200 | hand-built tree | +100 trees −1 200 | +2 800 | 3 100 | Growing pays, immediately and without any cleverness. |
| 5 | 300 | hand tree, 5 nodes | +100 trees, +2 nodes −1 600 | +4 500 | 6 000 | A bigger farm *and* a better rule. Both levers work. |
| 6 | 300 | fitted tree | fitted tree −900, 1 000 photos −800 | +4 650 | 8 950 | 96% on the photos, 90% in the field. **The first time two numbers disagree.** |
| 7 | 400 | random forest | forest −2 200, +100 trees −1 200 | +6 300 | 11 850 | Better again. The co-op's note says 1.8% wormy — under the 2.0% line, "watch that". |
| 8 | 400 + heirloom | random forest | heirloom block −2 000 | **+2 400** | 12 250 | The best orchard yet earns the worst year. The forest cannot read the new cultivars, wormy heirlooms reach the crates, and **the delivery is downgraded**. |
| 9 | 400 + heirloom | CNN, untuned | CNN −6 000 | +7 100 | 13 350 | Good on heirlooms, no better than the forest elsewhere. You did not buy a better model — you bought one you now have to *find*. |
| 10+ | → 600 + heirloom | CNN, tuned | trees, 5 000 photos | rising | — | Blocks, patterns per block, regularization, dropout. **This is the screen the whole game exists to hand you.** |

Four things that table is arranged to do:

- **Year 3 is the only moment the player is asked to take a step down.** The hand tree earns
  slightly *less* than their own hands did. That is deliberate and it must be framed honestly on
  screen: you did not buy accuracy, you bought *scale* — and the very next year proves it.
- **Years 4–7 are a clean upward run.** Every purchase pays back within the year, exactly as
  anti-grind rule 1 (§4.4) demands. This is the stretch where the player learns to trust that
  upgrading is worth it, which is what makes Year 8 land.
- **Year 7 telegraphs, Year 8 bites.** The co-op's warning is a free line of text and it turns
  Year 8 from "the game cheated me" into "I was told and I did not act". Never punish without a
  visible warning first.
- **Year 8 is the pivot the whole ladder was built for.** It is not a game-over — cash is at its
  highest — it is the year the player stops asking *what should I buy* and starts asking *what is
  my model actually doing*. Everything from Year 9 on is the existing simulator.

If playtesting says ten years is too long, cut Year 2 (one hand-sorted harvest may be enough) and
merge Years 4–5. The rungs that must survive are: sort by hand, write a tree, watch the fitted
tree disagree with itself, hit the heirloom wall, tune the network.

---

## 5. Screens and mockups

### 5.1 The persistent bar

Present on every screen. Year and money are the two things the brief asks for; the third line is
what makes the state of the farm legible without navigating.

```
+------------------------------------------------------------------------+
|  Obermuehlner Orchard        Year 3         CHF 4 280        [ menu ]   |
|                              ------         ---------                   |
|  300 trees  ·  model: hand-built tree (5 nodes)  ·  data: 1 000 photos  |
+------------------------------------------------------------------------+
```

### 5.2 Farm overview

The existing `FarmOverview` screen, grown a shop-window edge. Locked things are **visible and
greyed**, never hidden — seeing what you cannot yet afford is the whole motivation system, and
`knob-availability` already commits to that for knobs.

```
+---------------------------- THE FARM ------------------------------+
|                                                                    |
|   +-----------------+   +------------------+   +----------------+  |
|   |  APPLE ORCHARD  |   |  HEIRLOOM BLOCK  |   |    LIVESTOCK   |  |
|   |  ~~ ~~ ~~ ~~ ~~ |   |  [locked] 2 000  |   |    [locked]    |  |
|   |  300/600 trees  |   |  4 rare cultivars|   |  opens Year 6  |  |
|   |  [upgrade 1200] |   |  0.90 per apple  |   |                |  |
|   +-----------------+   +------------------+   +----------------+  |
|                                                                    |
|   > Workshop    train and inspect  (free)                          |
|   > Market      spend money                                        |
|                                                                    |
|              +------------------------------+                      |
|              |   >  RUN THE HARVEST (Year 3)|                      |
|              +------------------------------+                      |
+--------------------------------------------------------------------+
```

### 5.3 Sorting by hand (rung 0)

Three buttons, keyboard-driven, and on mobile a swipe. The line at the bottom is the entire point
of the screen.

```
+-------------- HARVEST - YEAR 1 - SORTING BY HAND ---------------+
|  Apple 14 of 30 sampled           crated: red 6  green 5  bin 2 |
|                                                                 |
|                      +-------------+                            |
|                      |             |                            |
|                      |   (photo)   |   128 px, from the pool    |
|                      |             |                            |
|                      +-------------+                            |
|                                                                 |
|    [ crate as RED ]  [ crate as GREEN ]  [ DISCARD ]            |
|         left key          down key        right key             |
|                                                                 |
|  This is the job. In a moment you will hand it to a machine     |
|  and have to explain to it exactly what you just did.           |
+-----------------------------------------------------------------+
```

After the sample, the extrapolation screen. Note the third line: it discloses that the wage was
estimated from a sample rather than implying 6 000 apples were sorted (§1.1).

```
   You sorted 30 apples in 4 min 12 s.        7 apples / minute.
   The harvest is 6 000 apples.               ~14 hours by hand.

   You got 26 of the 30 right.  87%.
   We paid you as if the whole crop went that well:  CHF 1 452
                                (a perfect year is 1 740)

   A robot does 6 000 in under a second. It costs 2 800 CHF.
   You cannot plant more trees until you own one - you would never
   get through the harvest.
```

### 5.4 The tree builder (rung 1)

```
+---------------- WORKSHOP - YOUR DECISION TREE ------------ nodes 4/5 --+
|                                                                        |
|                    +-----------------------+                           |
|                    | dark spot area > 0.06 |                           |
|                    +-------+-------+-------+                           |
|                       yes  |       |  no                               |
|              +-------------+       +------------+                      |
|         +====+====+                +-----------+----------+            |
|         | DISCARD |                |   redness > 0.55     |            |
|         +=========+                +------+---------+-----+            |
|                                     yes   |         |  no              |
|                                    +======+===+ +===+========+         |
|                                    |   RED    | |   GREEN    |         |
|                                    +==========+ +============+         |
|                                                                        |
|  [+ add split]   features:  redness · greenness · size · roundness ·   |
|                             dark spot area · spot count · texture      |
|                                                                        |
|  On your 200 bought photos:  agrees with the labels 87%  [see mistakes]|
|  (i) This tree runs live. Nothing is trained - you wrote the rules.    |
+------------------------------------------------------------------------+
```

"[see mistakes]" opens the photos the tree gets wrong, next to their labels. That is the workshop's
diagnostic for rung 1, the same role the loss curve plays for rung 4 — and it is the moment the
dataset stops being an inventory item and becomes something you look at.

### 5.5 Market

```
+---------------------------- MARKET --------------------- CHF 4 280 ---+
|                                                                       |
|  ORCHARD                                                              |
|   > +100 apple trees ........................... 1 200    [ buy ]     |
|   > Heirloom block (4 rare cultivars) .......... 2 000    [ buy ]     |
|                                                                       |
|  LABOUR                                                               |
|   > Picking robot .............................. owned                |
|                                                                       |
|  DATA                                                                 |
|   > 1 000 photos, labelled in a hurry ......... owned                 |
|     "some of these labels are wrong"                                  |
|   > 5 000 photos, checked twice ............... 2 500     [ buy ]     |
|     "an inspector sorted these the way you did in Year 1 - for a fee" |
|                                                                       |
|  MODELS                                                               |
|   > Hand-built tree ............................ owned                |
|   > +2 decision nodes .......................... 400      [ buy ]     |
|   > Fitted tree (learns from your photos) ...... 900      [ buy ]     |
|   > Random forest .............................. 2 200    [ buy ]     |
|   > Convolutional network ...................... 6 000    [ saving ]  |
|     "runs on any dataset you own - it just does better with more"     |
+-----------------------------------------------------------------------+
```

Nothing in the models column is locked behind owning anything else; `[ saving ]` means you cannot
afford it yet, not that it is barred. That is the §2 rule — money is the only key — rendered
literally, and it is why the market can show every rung of the ladder from Year 3 onwards. Seeing
the network you cannot afford for five years is the point.

### 5.6 The harvest report

This is the most important screen in the game. It is the existing confusion-matrix report with
money attached and the contract rule made visible.

```
+-------------- YEAR 3 HARVEST REPORT --- config: tree-d3-n5 ------------+
|  18 000 apples went past the camera.                                   |
|                                                                        |
|                      what the robot did                                |
|                 crate red   crate green    discard                     |
|   what it     +--------------------------------------+                 |
|   really was  |                                      |                 |
|      red      |   8 410        1 190         290     |  CHF  +3 602    |
|      green    |     760 (!)    5 020         180     |  CHF    +776    |
|      wormy    |     210 (!!)      90       1 850     |  CHF    +102    |
|               +--------------------------------------+                 |
|                                                                        |
|   (!!) 300 wormy apples reached a crate = 2.1% of the delivery.        |
|        The co-op tolerates 2.0%.   DELIVERY DOWNGRADED TO JUICE.       |
|                                                                        |
|   Gross 4 480  ·  downgrade -3 100  ·  upkeep -120   ->  CHF +1 260    |
|                                                                        |
|   [ inspect those 300 ]   [ back to the workshop ]   [ next year > ]   |
+------------------------------------------------------------------------+
```

Note what this does: the earnings number alone would say "1 260, a decent year". The breakdown
says "you lost 3 100 CHF to 300 apples out of 18 000". That is the diagnosis trap defused on
screen, not in a help text.

**[inspect those 300]** opens the offending images with the model's reasoning — the tree path it
took, or for the CNN its probability distribution. Interpretability as a game verb.

---

## 6. Architecture

### 6.1 The layering that already exists, extended

The existing separation is good and should not be disturbed: data in `declarations/`, a pure
engine in `src/`, React screens in `web/src/`, frozen `artifacts/` and `pools/`. Everything below
slots into that shape.

```
  declarations/  (data)          src/  (pure TS, no React)         web/src/  (React)
  -------------                  --------------------------        -----------------
  apple-harvest.json ---+        +--------------------------+
  families/*.json    ---+        | task/        validate,   |
  catalog.json       ---+--load->|              configId    |----> screens/
  progression.json   ---+        | features/    measured    |        HUD
                                 |              vectors     |        farm overview
  artifacts/  (frozen)           | families/    cnn | tree  |        hand sorting
  pools/      (frozen)           | policy/      dist->action|        tree builder
                                 | scoring/     payoff +    |        workshop
                                 |              delivery    |        market
                                 | economy/     ledger      |        report
                                 | progression/ owns ->     |
                                 |              available   |
                                 +-------------+------------+
                                               ^
                                       save (localStorage)
```

### 6.2 The one big change: a model family becomes a first-class declared thing

Today a task declares *one* architecture family (`model-architecture`: *"A task declares an
architecture family"*), one knob list, one diagram, one prediction artifact.

The ladder needs a task to declare *several* families, each with:

- its own knobs (CNN: blocks/channels/regularization/dropout; tree: node budget, depth),
- its own diagram (`network-diagram` already supports per-family drawings and requires each to be
  *"separately mountable"* — this generalization is already anticipated),
- its own **prediction source**: `artifact` (frozen, keyed by config id) or `live` (evaluated in
  the browser over features),
- its own unlock condition.

That last distinction — artifact-backed versus live-evaluated — is the load-bearing abstraction.
It lets the hand-built tree and the CNN sit behind one interface:

```ts
interface ModelFamily {
  id: string
  predict(image: ImageRef, config: Configuration): Distribution
  // artifact-backed: look up frozen probabilities by config id
  // live: evaluate the player's tree over the image's measured features
}
```

Everything downstream — policy, scoring, report — consumes a `Distribution` and neither knows nor
cares which kind produced it. The report screen, the payoff table and the decision policy are
written once and serve the whole ladder.

### 6.3 New engine modules

| Module | Holds | Why it is separate |
|---|---|---|
| `src/features/` | measured feature vectors per image, read from the pool manifest | the tree's only input; must never touch generation attributes |
| `src/families/` | the family registry and the two evaluators | the abstraction above |
| `src/economy/` | prices, ledger, year advance, delivery terms | pure arithmetic, trivially testable |
| `src/progression/` | owned items → what is available | feeds `knob-availability`; the only place unlock rules live |
| `src/save/` | versioned `localStorage` state, migration, reset | the only impure module |

### 6.4 Game state

```ts
type GameState = {
  schema: string          // versioned; a mismatch resets with a warning, never silently migrates wrong
  seed: string            // the farm's identity; reproducible harvests
  year: number
  cash: number
  owned: string[]         // catalog item ids: 'robot', 'trees-200', 'data-1000', 'family-cnn', ...
  configs: Record<FamilyId, KnobValues>   // your tuning per family, remembered
  tree: TreeSpec | null                   // the decision tree you wrote, if you own that family
  ledger: YearRecord[]                    // every harvest, for a progress chart
}
```

Two rules on this:

- **The save and the artifacts stay independent.** A save records what you own; artifacts record
  what was trained. Unlocking must never reinterpret a shipped artifact — `prediction-artifacts`
  already requires that a locked knob sits at its default and still contributes to the config id,
  so unlocking *extends* coverage rather than changing the meaning of existing ids.
- **No backend, so no cheating prevention.** The save is in the browser and editable. That is
  fine — it is a teaching tool, not a competitive game. Do not spend a line of code on it.

### 6.5 The invariant, extended

`web/src/no-task-specific-code.test.tsx` enforces that no screen names a particular lesson. Extend
the same rule to the new nouns:

> No screen names a catalog item, a model family, an apple cultivar, or an unlock condition.
> The market renders from `catalog.json`; the family picker renders from the task's declared
> families; the tree builder renders from the declared feature list.

If that test still passes at the end, the modularity ask in the brief is satisfied — not by
intention, but by a test.

---

## 7. What this changes about what is already built

Honest reconciliation, because most of this document is *additive* and it is worth being clear
about which parts are not.

**Survives untouched:** the pool and its atlases; prediction artifacts and config identity; the
CNN family and its diagram; the training browser; the declaration/validator split; the confusion
matrix report; the no-task-specific-code invariant.

**Extended, not broken:**

| Existing thing | Extension |
|---|---|
| `task-contract` — one architecture per task | a task declares several families, one active |
| `knob-availability` (stub) | becomes a special case of a general progression/catalog system |
| `harvest-scoring` (stub) | gains the year loop, the fresh yearly sample, and delivery terms |
| `simulator-shell` — overview/configure/run/report | gains HUD, market, hand-sorting; the four stages stay |
| `network-diagram` | a tree diagram is one more separately-mountable family drawing |

**Genuinely modified (costs a spec change):**

- `decision-policy`'s *"Earnings are the sum of payoff entries"* — the co-op contract is a
  batch-level term and does not fit. Section 4.2 gives the cheap alternative if we do not want
  to pay this.
- The apple task's two actions become three. Free at the artifact level, but the declaration,
  the payoff table and the report labels all change.
- The pool must gain measured per-image features, a colour-blind-safe palette, stripes on green
  as well as red, and later the heirloom cultivars. Every one of those is a regeneration, and any
  that changes pixels means **retraining every shipped CNN configuration** — the single most
  expensive item in this document. Batch them: decide the palette and the striping *before* the
  generator is rewritten, so the pool is regenerated once rather than three times.

---

## 8. Suggestions worth stealing

Ranked by value-per-effort. The first three I would build; the rest are here to be argued with.

1. **What you buy is label quality, not just label count.** The cheap dataset was labelled in a
   hurry and some labels are wrong; the expensive one was checked. Since the player's own sorting
   is no longer kept, this is where label noise has to live — and it is the better version anyway,
   because it is authored and therefore reliably teachable rather than dependent on how carefully
   the player clicked in Year 1. Same slot can carry composition: the cheap set is skewed (few
   wormy), the expensive one is balanced. Both are declaration changes if the pool has the images.
2. **The co-op contract.** §4.2. The best single mechanic available, and the only one that makes
   a rare class matter the way it does in reality.
3. **Colour-blind safety — and it is not optional.** The entire game is red versus green. Roughly
   1 in 12 men has a red/green deficiency, and this is aimed at high-school students. Stripes
   cannot be the fix, since both colours are striped now (§2) — so the answer is **the palette
   itself**: pick hues that stay distinct under simulated deuteranopia and protanopia (shifting
   "green" toward yellow-green and "red" toward a warmer crimson usually does it), and verify with
   a simulator rather than by eye. That keeps the task a genuine colour judgement instead of
   handing the player a shortcut cue, and it costs nothing except deciding *before* the pool
   generator is rewritten. Cheapest to fix now, most embarrassing to fix later.
4. **A per-year contract goal instead of pure profit maximization.** "The co-op will renew only
   if you deliver 5 000 crates at under 2% worm." A constraint teaches precision/recall better
   than an unbounded score does, and it gives each year a shape.
5. **"Why did it decide that?"** Click any apple in the report and see the tree path or the
   probability distribution. Interpretability as a verb, and a second line of defence against
   the diagnosis trap.
6. **A lesson log instead of achievements.** "You discovered overfitting in Year 4." It records
   what was *understood* rather than what was *bought*, it is the artefact a teacher would want,
   and it costs almost nothing.
7. **A neighbour who gives hints.** One NPC line per year, in character, that nudges without
   lecturing. Keeps the tone light for the age group. Low cost, easy to cut.
8. **Robot upkeep per 1 000 apples.** Realistic (a deployed model has a running cost) but it adds
   bookkeeping to every screen. I would skip it initially.
9. **A shareable seed / end-of-run summary** for classroom use. Out of scope, but worth not
   designing ourselves out of — a teacher with thirty students will want it.

**Mobile note:** hand sorting as a swipe is genuinely better on a phone than on a laptop. The
brief defers mobile, but this one screen is worth designing thumb-first from the start.

---

## 9. Risks

- **Scope.** This is 3–4× the current project. §11 exists to make that survivable; the ladder is
  designed so rungs 2 and 3 can be dropped without breaking the story.
- **Retraining cost.** Heirloom cultivars mean a new pool and a full retrain of every shipped CNN
  configuration. Do it once, late, and never twice.
- **Grind.** Every economy design fails this way. The rule in §4.4 — every purchase within 2–3
  harvests — is the tripwire. Simulate the loop on paper before building the shop.
- **The ceiling must be real.** If the tree accidentally does well on heirlooms, the CNN purchase
  has no motivation and the lesson collapses. This has to be validated with numbers before the
  heirloom block ships.
- **Fun versus honesty.** The models are pretrained and "training" is a replay. `CLAUDE.md`
  already commits to saying so. Every new mechanic here must survive a student reading the
  source; the tree builder is safe because it genuinely runs live, and the hand-sorting phase is
  safe because it genuinely records your clicks.

---

## 10. Decisions this document does not make

1. Linear payoffs (cheap, fits today's spec) or the co-op contract (better lesson, modifies
   `decision-policy`)?
2. Do we ship the middle rungs — fitted tree and forest — or jump hand-tree → CNN?
3. Is progress persisted in `localStorage` from the start, or session-only until the loop is
   proven? (`knob-availability` lists this as its own open question.)
4. Does hand sorting return in later years as a cheap fallback, or is it a one-time prologue?
5. How many heirloom cultivars, and are they a separate pool or an extension of the existing one?
6. Fixed farm seed per player, or a fresh one per new game?
7. Is Year 3's step down acceptable — the hand tree earning slightly *less* than the player's own
   hands, paid back by scale the following year? It is the honest version and it sets up "you
   bought scale, not accuracy", but it risks the robot feeling like a bad purchase for one year.
   The alternative is tuning the hand-sorting accuracy down until the tree is an immediate win.
8. Does the cheap dataset really carry wrong labels, or is "labelled in a hurry" only flavour text?
   Really carrying them is the honest version and the better lesson, but it means the fitted tree
   and every shipped CNN configuration must be trained against the *noisy* labels while being
   scored against the true ones — a real cost in the training pipeline, not a copy change.

---

## 11. Proposed change sequence

Small changes, one per session, dependency-ordered. Each is independently shippable and leaves the
simulator working.

| # | Change | Depends on | Notes |
|---|---|---|---|
| 1 | `colour-accessibility` | — | do first; it constrains the pool generator |
| 2 | `game-economy` | — | currency, year counter, ledger, HUD. No new ML. |
| 3 | `progression-catalog` | 2 | declared catalog, ownership, save. Subsumes `knob-availability`. |
| 4 | `three-action-sorting` | — | 2 actions → 3; declaration + report only, no retraining |
| 5 | `manual-sorting` | 2, 4 | rung 0; comprehension and early income only — produces no dataset |
| 6 | `dataset-tiers` | 3 | what a bought dataset is: size, balance, label quality |
| 7 | `measured-features` | — | per-image feature vectors in the pool manifest |
| 8 | `model-families` | 3 | family as a declared entity; artifact vs. live prediction |
| 9 | `decision-tree-builder` | 6, 7, 8 | rung 1 |
| 10 | `harvest-scoring` *(exists)* | 2, 4 | year loop, yearly sample, delivery terms |
| 11 | `training-simulation` *(exists)* | 8 | unchanged in intent; now explicitly rung 4 |
| 12 | `orchard-scale` | 2, 10 | tree counts, the robot gating expansion, the amplification rule |
| 13 | `fitted-tree`, `random-forest` | 9 | rungs 2–3. Optional, but they carry Years 6–7. |
| 14 | `heirloom-cultivars` | 12 | new pool (both colours striped) + full CNN retrain. Last, and only once. |

Changes 1–9 deliver a complete, playable, teachable game with no neural network in it at all —
Years 1 to 5 of the playthrough. You sort by hand, you buy a robot, you write a tree, you grow the
farm and watch growing pay. That is the checkpoint worth aiming at: if Years 1–5 are not fun on
their own, the CNN will not save them.

**Two sequencing warnings.**

The arc's pivot is its most expensive change. Year 8 — the heirloom block breaking the forest — is
what motivates the CNN purchase, and it is change 14, because new cultivars mean a new pool and a
full retrain of every shipped configuration. Until it lands, the game has a working ladder with a
missing reason to climb its last rung. That is survivable (Years 1–7 stand alone and the CNN is
still buyable) but it should be a known gap rather than a surprise.

And §4.6 is the acceptance test for the whole sequence, not decoration. When enough of these
changes exist to play Year 1 through Year 8, play it. If the money curve does not roughly match
that table, the prices are wrong — and prices are data, so fixing them should cost an afternoon,
not a change.

Authored 2026-09-09. Scaffolded 2026-09-08 from an explore session that replaced `Game_design.md` §2's rung 1
with a comprehension gate. Depends on `model-families`, which makes a family the thing a
tutorial can be declared against. Read `openspec/specs/progression-catalog/spec.md`'s
*Ownership is the only input to what is available* — the one shipped requirement this
change contradicts — plus `openspec/specs/network-diagram/spec.md`'s *Each family's drawing
is separately mountable*, which is the pattern to copy, and
`openspec/specs/simulator-shell/spec.md`'s *A model is put to work from the workshop, and
can be handed back*.

## Why

The ladder's rungs are bought with money, and money is a proxy for understanding rather
than the thing itself. `CLAUDE.md` states the ambition plainly — tasks are unlocked by
understanding, not by clicking through — and until now nothing in the game made that
literal. A student can buy a fitted tree with the earnings of a good hand harvest and field
it without ever having been told what a tree is.

This change makes the last step of acquiring a model family a small, free, unlimited puzzle
that has to be solved once: a simplification of how that family works, with the theory
beside it. It is the cheapest place in the whole design to put a lesson, because it is the
one moment the student has already decided they want the thing.

It also recovers something rung 1 was carrying. §2's floor — each rung is genuinely a bit
better than the one below — was pitched on the student having first guessed a threshold by
hand. With the hand-written tree dropped, nobody guesses. The tutorial puts the guess back,
minutes before the fitted answer arrives instead of a year earlier, and at no cost to the
economy, the artifacts, the labour slot or the save.

## What Changes

- **A tutorial becomes a declared entity, keyed to a model family.** Its title, its theory
  copy, its pass condition and whatever data its puzzle needs are declared; a screen must
  not learn which family it is teaching.
- **The gate is free, and it sits between owning and fielding.** Money buys the family, and
  `progression-catalog`'s *Money is the only key to a purchase* is untouched: the market
  never bars a purchase and never states that anything but money would obtain it. What an
  unfinished tutorial withholds is putting that family to work.
- **BREAKING for `progression-catalog`.** *Ownership is the only input to what is available*
  currently forecloses this in as many words: availability is a function of the catalog and
  the items owned and of nothing else, and nothing becomes available through the year
  reached, the balance held, a task having been played, or **any other state of the farm**.
  Tutorial completion is another state of the farm. That requirement has to gain exactly one
  further input and no more, or the sentence stops meaning anything.
- **A deliberate reversal of a stated design principle, recorded as one.** §2 says there are
  no hard gates, that nothing on the ladder is locked behind owning something else, and that
  money is the only key. This is a hard gate. The defence is that §2 was arguing against
  *ownership* gates — do not lock the network behind the big dataset — and that a
  comprehension gate is a different animal. That defence should be written down rather than
  assumed, because the next change that wants a gate will cite this one.
- **Completion is save state, and it is the whole of it.** No score, no attempt count, no
  timing. A puzzle that records how well you did is a puzzle a student optimises instead of
  reads.
- **Free and unlimited, like the workshop.** `simulator-shell`'s *The workshop moves no
  money* extends to this: retrying costs nothing, moves no money, appends nothing to the
  ledger, and does not touch the year.
- **The frame is generic; the body is not, and that is the honest position.** A modal, a
  completion record, a test affordance, declared theory copy and the gate wiring are shared.
  The interaction is not shareable — nothing can data-drive the difference between dragging
  apples into a tree and whatever eventually teaches convolution, because in a tutorial the
  interaction *is* the lesson. `network-diagram` already settled this shape once for
  drawings: a convolutional stack is drawn as feature-map volumes, a tree as branches, and
  *Each family's drawing is separately mountable* is the requirement that keeps both honest.
  A tutorial is the second per-family mountable thing and should follow it exactly.
- **The invariant extends, one clause.** No screen names a model family; a family's diagram
  and a family's tutorial each name exactly their own family and nothing else.
- **A tutorial declares a pass condition, and an unwinnable one is refused at load.** If the
  declared data admits no solution that clears the mark, the student is locked out by
  authored data and no screen can say why. Refuse it where every other structural
  impossibility in this repo is refused — at load, naming the cause, the way `task-contract`
  refuses a block count the input resolution cannot express. *How* winnability is computed is
  the puzzle's business and belongs to each instance change.
- **An owned but untutored family cannot fill a labour slot.** `farm-labour` already knows
  how to leave a task with the farm's hands, but its existing case is a configuration *the
  declarations* can no longer produce. This is a different cause and probably wants naming as
  its own, since it is reported to the student as something to go and do rather than as
  something that went wrong.
- **The tutorial is reached from the workshop, not the market.** *A model is put to work from
  the workshop* is where the gate bites, so that is where the puzzle belongs. Buying a family
  in the market and being ambushed by a modal there would fight a requirement that already
  exists.

## Resolved questions

- **Is completion recorded per family, or per family per task?** **Once, globally.** A
  student meets each lesson exactly once. Family ids are only unique within a task and so
  cannot be that key, which is why the tutorial carries a stable id of its own and
  completion is a set of those ids. Two families declaring the same tutorial id share one
  completion, and two that declare the same id and disagree are refused at load naming it —
  one completion cannot stand for two different puzzles. `design.md` records the alternative
  considered.

## Capabilities

### New Capabilities
- `model-tutorials`: provisional. A tutorial as declared data keyed to a family, the free
  gate between owning and fielding, completion as the only record, the generic frame and the
  separately-mountable body, and the load-time refusal of an unwinnable one.

### Modified Capabilities
- `progression-catalog`: provisional. *Ownership is the only input to what is available*
  gains exactly one further input. *Money is the only key to a purchase* is deliberately
  untouched, and saying so is part of the change.
- `farm-labour`: provisional. An owned but untutored family is a cause a slot can be
  unfillable for, distinct from a configuration this build can no longer make.
- `game-save`: provisional. Completion is progress and belongs in the save; *The save records
  progress, never declarations* is the requirement it has to fit inside.
- `simulator-shell`: provisional. The workshop holds a tutorial as well as a knob panel, the
  gate is presented where a model is put to work, and *The shell contains no task-specific
  code paths* gains the family clause.

## Impact

An optional `tutorial` on `ModelFamilyDeclaration` beside `diagram` and `history`, with its
envelope validated in `src/task/validate.ts`; a new `src/tutorials/` holding the engine
registry keyed by kind — each kind's own checker, its winnability decision and its judge; a
fieldability computation beside `computeAvailability` in `src/progression/`, which keeps its
three arguments and its meaning; a refusal in `putToWork` and a new restore cause in
`src/save/`, whose schema goes to `4.0.0` for the completed-tutorial ids; and on the screen
side a `TutorialBody` that dispatches on kind and does nothing else, plus the frame and the
withheld control in the workshop.

No artifact is touched and nothing is retrained. `model-families` landed first, because a
tutorial has nothing to be keyed to until a family is a declared entity.

`fitted-tree-tutorial` supplies the first body. This change ships the frame and adds no
tutorial to `declarations/apple-harvest.json`, so the gate is inert and the shipped game
plays exactly as it does today — a gate with no puzzle behind it would be a wall, and the
frame is exercised by a fixture kind in tests until that body lands.

# Workshop, then harvest

Authored 2026-09-07 from `Game_design.md` §3 and §5.2, and from `CLAUDE.md`'s "Two
separated phases: workshop, then harvest". Read
`openspec/specs/simulator-shell/spec.md`'s *The student moves through overview,
configuration, run and report* — the requirement this change rewrites — and
`openspec/specs/game-economy/spec.md`'s *Only a harvest closes a year*, which most of
this change turns out to be a consequence of.

## Why

Today a student presses *Run a month* from inside the task screen, two clicks from the
knobs. That conflates two different questions — *is my model any good* and *did the farm
make money* — and it makes the harvest feel like a slot machine: a button you press again
when you do not like the number.

Half the fix already shipped. `ConfigureTask` will not let a month be run until the
configuration has been trained and its replay watched, so the curve is read before the
earnings are. What is left is that the second half is in the wrong place. Running the year
belongs to the farm, because what it consumes belongs to the farm: every card's labour at
once, not one task's model.

The move needs one new idea, and the rest falls out of it. **Every card has a labour
slot.** It holds hand sorting by default and a trained model once one is put to work.
There is no empty state, so there is nothing to gate on and nothing to wait for: the
harvest is always runnable, and the pressure to visit the workshop is that hand sorting
plateaus while the orchard does not — `Game_design.md` §4.4's anti-grind rule made
mechanical rather than enforced by a locked button.

## What Changes

- **A labour slot per task card.** It holds either hand sorting or one trained
  configuration of one model family. Hand sorting is what an unfilled slot means, not a
  missing value, so a farm that has bought nothing still has a complete labour
  assignment for every card it can play.
- **The slot is shown on the card** with the icon and hover label of whatever fills it,
  both read from declarations. A farm that has bought no model shows the hand.
- **The slot is set from the task screen**, by a control beside *Train model* that puts
  the configuration just trained to work. Only a configuration whose replay has been
  watched can be put to work, so the diagnostic the workshop exists for cannot be
  skipped.
- **Putting a model to work is free and reversible.** A slot can be handed back to the
  hands. That is not a courtesy: it is how a student compares their model against
  themselves across two ledger rows, and `manual-sorting` already requires that *a robot
  taken off the orchard hands the job back*.
- **Running the year moves to the farm overview** and is renamed from *Run a month*,
  which never matched an economy that counts and pays in years. It leaves the task screen
  entirely.
- **A card whose slot holds a model is brought in without the student**, and a card whose
  slot holds the hands sends them to sort. Running the year is one deliberate act; what it
  costs in attention depends on what each card is set to.
- **The year closes once, when every playable card has been brought in.** `game-economy`
  requires a harvest to be one indivisible step settling one total and appending one
  record. With more than one card that can no longer happen per card, so a year gains an
  in-progress state and the overview shows what is still outstanding.
- **Each card offers the closed year's report.** The report stops being a child of the
  configuration screen and becomes the record of a year that happened, reached from the
  card it belongs to.
- **The workshop is named as what it is:** free, unlimited, and a place where no money
  moves. That is currently true by accident — nothing on the task screen costs anything —
  and this change makes it a requirement, so a later change cannot quietly price it.
- Fixes a defect the current shell would ship the moment a robot enters the catalog:
  `web/src/App.tsx` decides hand sorting is unavailable from **ownership** of the farm's
  declared automation item, where `manual-sorting` specifies it from what is *working the
  orchard*. A farm that owned a robot without putting it to work would lose hand sorting
  and have no labour at all.
- Deliberately **not** here:
  - What the harvest samples, what it pays, and what the report says — `harvest-scoring`.
    This change moves money at the harvest and nowhere else, but does not change how much.
  - Which model families exist, the picker that swaps the settings panel to a family's
    own knobs, and per-family knob memory — `model-families`. That change already owns
    *which family is active*; this one owns *which configuration is at work*, which is a
    different thing and must not be folded into it.

## Capabilities

### New Capabilities
<!-- None. The labour slot and the year loop are the shell's stages relating to each
     other differently, plus one economy consequence; both capabilities exist. -->

### Modified Capabilities
- `simulator-shell`: *The student moves through overview, configuration, run and report*
  becomes the year loop — the run leaves the task screen, the workshop is named and
  required to be free, the card carries a labour slot, and the report becomes a closed
  year's record reached from its card. *A report identifies the configuration that
  produced it* moves with it. *The shell contains no task-specific code paths* extends
  over the slot's icon and label.
- `game-economy`: *Only a harvest closes a year* gains the multi-card case — the year
  closes on the total across every playable card, once, and a year in progress is a state
  the farm can be in.

## Impact

`web/src/App.tsx` holds the stage state and is where the year in progress and the labour
slots land. `web/src/screens/FarmOverview.tsx` grows the slot on each card, the run
control, and the per-card report entry; `web/src/screens/ConfigureTask.tsx` loses *Run a
month* and its `Report` child, and gains the control that puts a configuration to work.
`web/src/screens/Report.tsx` is unchanged but remounted from the overview.
`src/save/index.ts` gains the slots and the year in progress, which is a schema bump and
therefore resets existing farms. `src/economy/farm.ts`'s `recordHarvest` keeps its
signature — one total, one record — and gains a caller that accumulates across cards
rather than one that settles a single task.

No pool change, no artifact change, no retraining. `manual-sorting`'s requirements are
unchanged: this change defines *working the orchard*, the term that spec already leans on.

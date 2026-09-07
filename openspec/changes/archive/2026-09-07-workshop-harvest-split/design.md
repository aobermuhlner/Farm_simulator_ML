# Design — workshop, then harvest

## Context

See `proposal.md` — *Why*. Three facts about what is already built shape everything below.

The train-then-run split **already exists**, inside `web/src/screens/ConfigureTask.tsx`,
as a stage machine: `untrained -> fetching -> training -> trained`, with *Run a month*
appearing only at `trained`. So this change is a move, not an invention.

`src/economy/farm.ts`'s `recordHarvest` already does the whole indivisible step
`game-economy` requires — settle one total, append one record, advance the year — and it
is already called from hand sorting. Its signature does not need to change; what needs to
change is who calls it and with what.

And `openspec/specs/manual-sorting/spec.md` is already written in the vocabulary this
change needs. It does not say "no robot owned"; it says hand sorting is the labour
"whenever no robot is **working the orchard**", and that "a robot **taken off the
orchard** hands the job back". That spec has been waiting for something to define *working
the orchard*. This change is that definition, which is why `manual-sorting` needs no
delta.

The current shell reads it the other way — `web/src/App.tsx` computes
`automated = owned.includes(declaration.automation.item)` and drops hand sorting on
ownership. That is inert only because `declarations/farm.json` declares no `automation`.

## Goals / Non-Goals

**Goals:**

- One place that answers "who brings in this card's crop", readable on the card and
  writable from the task screen.
- The year closes exactly once however many cards the farm has, with one ledger record.
- A model cannot be put to work without its replay having been watched.
- Nothing about a model family, an icon or a label written into a screen.

**Non-Goals:**

- Any change to what a harvest pays. `harvest-scoring` owns sampling, payoffs and the
  report's contents. This change decides *when* money moves, not *how much*.
- The family picker and per-family knobs. `model-families` owns those; see *Decision 2*
  for why they must stay separate from the slot.
- Multiple farms. The cards are the apple orchard, the heirloom block and the livestock
  of one farm — one name, one balance, one year, as `Game_design.md` §5.2 draws it.
- Deciding whether the workshop itself is a purchase. See *Open Questions*.

## Decisions

### 1. The slot is per card, and hand sorting is what an unset slot means

Saved as a per-task map from task id to a fielded model, where absence means the hands,
rather than an explicit `hand` sentinel.

*Why:* the default has to be right for a save that has never heard of the field. A farm
restored from an older save, or a card added by a declaration the save predates, has no
entry — and the correct reading of "no entry" is the one that is always true: nobody has
bought anything, so a person does the work. A sentinel would need writing at farm creation
for every card, and would need writing again whenever a card appears, which is two places
that can disagree about what an empty farm means.

*Alternative considered:* an explicit three-state enum on the card — hand, model, or
unassigned — with unassigned blocking the year. Rejected: that is the empty state this
whole design exists to avoid, and it reintroduces the gate the proposal deletes.

### 2. Which family is *active* and which configuration is *at work* are different state

`model-families` already owns "which family is active is saved state" and "a family picker
on the configuration screen". Those must not be the same field as the slot.

```
  ACTIVE FAMILY  (model-families)     AT WORK  (this change)
  scratch                             commitment
  swaps the settings panel            decides who brings in the crop
  flip it freely, no consequence      free and reversible, but the year reads it
  one per task                        one per task
```

*Why:* if opening the picker to look at a decision tree silently took the convolutional
network off the orchard, the workshop would stop being free — browsing would have
consequences. The student must be able to tinker with one family while another is at work,
and the slot on the card is what makes that legible. The same argument separates the slot
from the existing per-task knob values, which are where the workshop's unsubmitted
settings live: that is a scratchpad, and the slot is a decision.

### 3. The slot stores a configuration identifier, not knob values

*Why:* the identifier is what was trained and what the artifact is keyed by, so it is the
only thing that can honestly claim a model was put to work. Knob values would have to be
re-resolved to an identifier at harvest time, and `progression-catalog` guarantees that
unlocking *extends* what can be selected and reinterprets nothing — a guarantee about
identifiers, which knob values would launder away.

Once `model-families` lands the slot carries a family identifier alongside it, because
that change scopes configuration identity per family. Shipping the field as a small record
rather than a bare string leaves room for that without a second schema bump.

### 4. Putting a model to work requires a watched replay; being at work does not

The control beside *Train model* is offered only at the trained stage. But once written,
the slot persists in the save and survives a reload, a purchase and a year.

*Why:* the diagnostic has to be unskippable at the moment of the decision, which is what
gating on the trained stage buys. Requiring it *continuously* would mean the slot emptied
on every reload — the trap noted during exploration, where a student returns to a farm
whose orchard has nobody working it.

### 5. An unresolvable fielded configuration hands the job back to the hands

On load, a slot naming a configuration that no longer resolves — a changed artifact, a
schema bump — is dropped, the card reverts to hand sorting, and the farm opens with a
notice saying so.

*Why:* `Game_design.md` §4.4 rule 3, never hard-fail. Refusing the whole farm over a
stale slot would lose a student's money and years to a model they can simply retrain.
This is the same shape the save restore already uses for dropped knob values.

Distinct from a configuration that fails to *fetch* at harvest time: that is not a stale
slot, it is a card that cannot be brought in, and it leaves the year open with the cause
shown rather than silently downgrading the labour to a person who is not there.

### 6. A year in progress accumulates outside the balance, then closes once

```
  [ Run the year (Year 3) ]  -- confirmed --> year 3 opens as in-progress
             |
     for each playable card, per its slot:
             |
     +-------+---------------------------+
     | model at work                     | hands
     v                                   v
   resolved without the student       student sorts; wage is held,
   outcome held pending               not credited
     |                                   |
     +-----------------+-----------------+
                       |
        every playable card brought in?  --no--> year 3 stays open,
                       |                         overview shows what is outstanding
                       v yes
        record the harvest of the total  -- one settle, one record, year 4
```

*Why not settle each card as it is brought in:* `game-economy` requires the harvest to
settle its total, append its record and advance the year as one indivisible step.
Crediting card by card would move money before any harvest was recorded, and the record's
paid figure would then describe something other than what moved.

*Why bother, with one card:* it is not speculative. §5.2 draws three cards, and the
alternative — each card closing its own year — gives the heirloom block a different year
number from the orchard beside it, which is unrecoverable. Doing it now costs the pending
structure; doing it later costs a second schema bump and a rewrite of what recording a
harvest means.

With exactly one playable card the in-progress state exists for the duration of one
settlement and is invisible, which is the correct amount of ceremony for a one-card farm.

### 7. Playable cards hold the year open; announced ones do not

A card counts if its declaration says it is available and progression has unlocked it. An
announced card — `FarmOverview` already renders "Announced — not ready to play yet" — has
no slot, no labour and no say in when the year closes.

### 8. The closed year's per-card summary is stored; per-image decisions are not

The card's report entry needs what that card's harvest did, and it cannot be recomputed:
a hand-sorted card's decisions are the student's, and `manual-sorting` forbids persisting
them. So the save keeps, for the most recent closed year, each card's per-category and
per-action counts and what it paid — the aggregate the report already renders, and nothing
finer.

*Why only the most recent:* it is what the card offers, and a per-year history of every
card's grid would grow the save without anything reading it. The ledger keeps the money
history, which is what `game-economy` asked for.

### 9. The slot's icon and label are given to the screen, never chosen by it

`no-task-specific-code.test.tsx` forbids a screen naming a family, so the slot renders an
icon reference and a label it is handed. A model's come from its declaration —
`model-families`' business. The hand's come from the farm declaration, because the hands
are the absence of a family rather than a family, so no family declaration can supply
them.

## Risks / Trade-offs

- **The save schema bump resets every existing farm.** -> Unavoidable; the slot and the
  pending year are both new state. `progression-catalog` set the precedent and the game is
  pre-release. Restoring a save already reports a reset with its cause.
- **A new way for the save to be self-inconsistent:** a pending year whose number is not
  the farm's current year. -> Validated on load like everything else; a mismatched pending
  year is dropped and the year re-opens. Nothing has been credited, so nothing is lost.
- **Three steps where there was one, on a one-card farm:** run the year, confirm, then
  sort. -> The confirmation is the entry to sorting rather than an extra screen in front
  of it; do not ask twice for the same commitment.
- **The slot could be read as "the model" rather than "who works".** -> It is the labour
  slot, and the hand is a first-class occupant of it, not a placeholder for a model the
  student has not bought. The hover label carries that; §5.2's greyed-and-visible
  convention carries the rest.
- **`harvest-scoring` will change what the year pays,** and this change wires the year to
  pay whatever it currently computes. -> The seam is recording a harvest of one total,
  which already exists and does not change. What produces that total is the part
  `harvest-scoring` replaces.

## Migration Plan

One schema bump in the save adding the labour slots, the pending year and the last closed
year's per-card summaries. Existing saves reset with the cause reported, which is the path
the save restore already implements and tests. No pool, artifact or prediction
regeneration; `declarations/farm.json` gains the hand's icon and label, which is additive.

Rollback is reverting the change: a save written by it will not parse against the previous
schema and resets, which is the same disclosed reset in the other direction.

## Open Questions

- **Does the workshop itself open with a purchase?** §4.5 has the starter photos and the
  hand-built tree "coming with the robot", which suggests the task screen is not
  enterable until something is bought. That is a catalog entry and a rendering of a locked
  card, both of which `progression-catalog` already specifies; it changes no requirement
  and no task here.
- **Does an outstanding hand-sorted card block the market?** Leaving the year half brought
  in to go shopping is odd but harmless, since no money has moved. Answerable once there
  is a second card to feel it with.

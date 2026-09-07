# Who works a card is behaviour, not an implementation detail

## Why

`workshop-harvest-split` built the answer to "who brings this card's crop in" —
`src/labour/` — and specified it as *screen presentation*: every requirement about a
labour slot lives in `openspec/specs/simulator-shell/spec.md`, phrased as what the
overview SHALL present. But the resolver decides three things no screen decides: who works
a card, which cards hold the year open, and which slots survive a restore. `manual-sorting`
has been waiting on a definition of "working the orchard" since it was written; that
definition is now code with no requirement behind it.

Reading it turned up two defects that a specification would have caught, both of which
cost a student their model or their year:

- **A makeable configuration can report itself unresolvable.** `configurationId` joins knob
  ids and values with `-`, and `configurationResolves` parses on that separator, but
  `src/task/validate.ts` places no character constraint on a knob id or a declared choice
  value. A hyphen inside a choice value makes the parse bind the wrong value and fail —
  and a slot that fails to resolve is dropped on restore, so an author adding a
  well-formed value silently takes every student's model off the orchard.
- **A card that cannot be brought in has no reachable remedy.** When `runYear` cannot fetch
  a fielded configuration's artifact the card stays outstanding and the refusal is shown on
  the overview. That is deliberate — a robot that cannot work is not a person who is not
  there — but handing the job back is offered only inside the workshop, so the overview
  states a problem next to no way out and the year cannot be closed from where the student
  is standing.

## What Changes

- A new `farm-labour` capability states the resolver's own rules: a slot holds the farm's
  manual labour or one model put to work, absence of an entry *is* the manual labour, which
  cards are playable and therefore hold the year open, and what happens to a slot naming a
  configuration this build can no longer make. These are engine rules; `simulator-shell`
  keeps its requirements about presenting them and gains no duplicate.
- Configuration identity gains the constraint that makes it parseable: the separator SHALL
  appear in no knob id and no declared string value, refused at load with the offending
  declaration named. Every knob id declared today is already hyphen-free, so no declaration
  changes.
- A stale labour slot joins the dropped-reference rule in `game-save` alongside the owned
  id and the knob value it already covers, so reverting a card to the hands on restore is
  required rather than incidental.
- Where a card's refusal is shown, handing that card's job back to the manual labour is
  reachable, so a year blocked by an unfetchable artifact can be closed without the student
  deducing that the workshop is the way out.

## Capabilities

### New Capabilities
- `farm-labour`: what brings a task's crop in — the slot and what absence means, which
  cards are playable, putting a model to work and handing the job back, and the difference
  between a slot this build cannot make and a card that cannot be brought in.

### Modified Capabilities
- `task-contract`: configuration identity gains a constraint on the characters a knob id
  and a declared string value may carry, so an identifier parses back to exactly one
  configuration.
- `game-save`: *A reference this build no longer declares is dropped, not fatal* extends to
  a labour slot naming a configuration the task can no longer produce.
- `simulator-shell`: *Engine refusals are shown with the cause the engine named* extends so
  that a refused card's job can be handed back from where the refusal appears.

## Impact

- `src/labour/index.ts` — no behaviour change expected; it becomes the implementation of a
  stated capability, and `configurationResolves` may drop defensive parsing the new
  constraint makes unnecessary.
- `src/task/validate.ts` — a new issue code for a separator inside a knob id or a declared
  string value, with tests.
- `web/src/App.tsx`, `web/src/screens/FarmOverview.tsx` — a refused card carries a hand-back
  control, which is the existing `handBack` operation wired to a second call site.
- No pool, artifact or prediction regeneration. No save schema bump: the slot's shape does
  not change.
- Deliberately not in scope: family-scoped configuration identity and playability across
  several families. `model-families` owns identity scoping and is still an unauthored stub;
  reshaping the resolver ahead of it would pre-empt its decisions.

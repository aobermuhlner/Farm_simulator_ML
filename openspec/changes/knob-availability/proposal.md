# STUB — not yet authored

Scaffolded 2026-09-03, when the apple task's opening lesson was cut to one turnable knob.
Depends on `task-abstraction` (complete) and on `prediction-artifacts`, which decides
which configurations exist to be unlocked into: read its `design.md` — "Coverage is the
set the opening lesson can select" — before filling this in.

## Why

The farmer is broke. He can afford the smallest convolutional stack and nothing else, so
the apple task opens at `blocks` = 2 with `regularization` and `dropout` fixed at their
defaults, and `channels` as the only knob a student turns. Deeper stacks and the two
regularization knobs are things to be earned, not options to be picked — which is what
makes the money loop a progression system rather than a score.

Today `knobs[].values` is a fixed list and every declared value is selectable, so the
locked knobs are locked only in intent: the configuration screen offers all 108
combinations and 105 of them refuse as untrained. That refusal is honest but it is not
the lesson — a student meeting it learns that the simulator is incomplete, not that the
model is something he has to buy.

## What Changes

- Define availability as declared data. A locked knob, or a locked value within a knob,
  must be expressible in the declaration; a screen must not learn the word "blocks" or
  the word "unlocked" for a particular lesson.
- Decide what a locked knob shows. It is greyed out rather than hidden — seeing the
  deeper stack you cannot yet afford is the point — which means deciding what it says
  about *why* it is locked and whether it names a price.
- Decide where progress lives. Availability is a function of game progress, and there is
  no backend; whether progress is session state, persisted locally, or not yet persisted
  at all is a decision this change has to make rather than inherit.
- Settle what a locked knob contributes to the configuration identifier. Per
  `prediction-artifacts`, a locked knob sits at its declared default and still appears in
  the id, so unlocking extends coverage rather than reinterpreting shipped artifacts.
- Keep the untrained refusal. Gating narrows what can be selected; it does not replace
  the refusal for a configuration no model was trained for, and the two must stay
  distinguishable from each other and from an invalid configuration.

## Capabilities

### New Capabilities
- `knob-availability`: provisional. How a task declares which knobs and which values are
  currently available, how progress opens them, and how a locked one is presented.

### Modified Capabilities
<!-- To be determined. Likely task-contract, for the declared shape of availability. -->

## Impact

To be determined. Touches the declaration schema and its validator, the configuration
screen, and whatever holds progress. Reads nothing new from `prediction-artifacts` but
should not let a student select a configuration it does not cover.

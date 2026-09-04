# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §4.1. Depends on nothing. Read
`openspec/specs/decision-policy/spec.md` in full — every policy requirement there is
written against today's two actions — and `openspec/specs/task-contract/spec.md`'s
*Categories and actions are task-declared* before filling this in.

## Why

The apple task declares two actions, `pick` and `decline`, which makes the payoff table a
yes/no and the report a two-column affair. The brief's sorting phase implies three:
**crate as red**, **crate as green**, **discard**. That is the better design, and not for
realism — with three actions the payoff table becomes a genuine cost matrix, and "sold a
green one as red" becomes a distinct, visible, differently-priced mistake from "threw
away a good apple". The report gains the resolution it needs to defuse the diagnosis trap
`CLAUDE.md` warns about, because there are now wrong answers that are wrong in different
directions.

It is also nearly free, and that is worth saying loudly because it is the existing
architecture paying off. Predictions are stored as distributions over *categories*;
actions, the category-to-action mapping and the payoffs are live task data
(`task-contract`, `decision-policy`). Going from two actions to three requires no
retraining and no new artifact.

## What Changes

- The apple-harvest declaration gains a third action and a full 3×3 payoff table.
- The declared payoff table must not have a degenerate optimum. §4.1's first-pass table
  pays for crating a wormy apple, which under *Earnings are the sum of payoff entries*
  makes "crate everything" optimal — the diagnosis trap inverted. This change ships a
  table that is honest on its own terms; `harvest-scoring` may later replace the
  correction with the co-op contract (§4.2), which is the better lesson but costs a spec
  modification. Which correction ships here is this change's decision.
- Payoff-table completeness validation now requires an entry for every
  category-and-action pair of a three-action space, with the cause named.
- Each declared policy is re-examined against more than two actions. *Threshold policy*
  in particular is written as an accept/reject rule and either gains a declared meaning
  over three actions or is declared inapplicable, with the refusal naming why.
- The report renders three action columns from the declaration, naming none of them.
- No pool change, no retraining, no new artifact.

## Capabilities

### New Capabilities
<!-- None expected. This changes what existing capabilities require of the action set. -->

### Modified Capabilities
- `decision-policy`: provisional. The policies and the completeness rule are stated for
  an action set of arbitrary size rather than for a binary one; *Threshold policy* is the
  one that genuinely has to change or be bounded.
- `simulator-shell`: provisional, if *The report is the payoff table filled with counts*
  needs anything said about a matrix wider than two columns.

## Impact

To be determined. Touches `declarations/apple-harvest.json`, the payoff and policy code
under `src/`, the validator, and the report screen. Artifacts and pools are untouched by
construction — a check worth asserting rather than assuming.

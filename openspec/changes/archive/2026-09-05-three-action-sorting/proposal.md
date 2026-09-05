# Three actions, not two

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

- The apple-harvest declaration gains a third action and a full 3×3 payoff table, and its
  category-to-action mapping becomes a bijection. Its teaching copy — the only prose in
  the repository that spells out the two-action framing — is rewritten with it.
- The declared payoff table must not have a degenerate optimum. §4.1's first-pass table
  pays for crating a wormy apple, which under *Earnings are the sum of payoff entries*
  makes "crate everything" optimal — the diagnosis trap inverted. **This change ships the
  linear correction** (a worm in a crate costs 1.50 whichever crate it is in) and stays
  inside today's earnings requirement; `harvest-scoring` may later add the co-op contract
  (§4.2) on top of an honest table, which is the better lesson but costs a spec
  modification it is the right change to buy.
- Degeneracy stops being a matter of taste. A new requirement makes the two declared
  fields agree: the action a category is mapped to must strictly outpay every other action
  in that category's row, refused at load with the category and both actions named. Both
  declarations that exist today already satisfy it.
- *Threshold policy* gains a declared meaning over more than two actions. Its text was
  already written over categories; the binary assumption hid in its tie-break, which with
  three distinct actions silently decides *which* action. It gains a declared priority
  order over categories, because the declared category order is bound to the artifact's
  probability-vector indexing and so cannot express priority.
- The report renders three action columns from the declaration, naming none of them, and
  is forbidden from collapsing a wider matrix into a combined error figure.
- Payoff-table completeness needs no change: it was already written over every declared
  category-and-action combination, and already names the missing one.
- No pool change, no retraining, no new artifact.

## Capabilities

### New Capabilities
<!-- None. This changes what existing capabilities require of the action set. -->

### Modified Capabilities
- `decision-policy`: adds the requirement that a category's declared action is its
  best-paying action, and restates *Threshold policy* over an action set of any size with
  a declared priority order.
- `simulator-shell`: restates *The report is the payoff table filled with counts* so that
  every declared action gets its own column however many there are, and no cell is
  collapsed or dropped.

## Impact

- `declarations/apple-harvest.json` — actions, mapping, payoffs, teaching copy.
- `src/task/types.ts`, `src/task/validate.ts` — the priority order, and the two new
  refusals.
- `src/policy/index.ts` — the threshold branch only.
- `src/scoring/index.ts`, `web/src/screens/Report.tsx`, `src/task/configId.ts` —
  unchanged, and asserted to be.
- `test/apple-harvest.declaration.test.ts`, `test/policy.test.ts`,
  `test/artifact-contract.test.ts`, `test/artifact-index.test.ts`,
  `test/validate-declaration.test.ts`, `web/src/screens/Report.test.tsx` — rewritten
  against three actions and the new figures. This is most of the diff.
- `artifacts/` and `pools/` — untouched by construction, asserted rather than assumed.

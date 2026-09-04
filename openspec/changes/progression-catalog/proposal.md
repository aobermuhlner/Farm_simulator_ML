# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §5.5, §6.3 and §6.4. Depends on
`game-economy`. **Replaces the `knob-availability` change stub**, which this change
subsumes (§11): read that stub in git history — `git show
24ff3d4:openspec/changes/knob-availability/proposal.md` — because its reasoning and its
five
requirements carry over intact and are the hardest part of this change. Read
`openspec/specs/prediction-artifacts/spec.md`'s *Coverage is declared, and an uncovered
configuration refuses as untrained* as well.

## Why

`CLAUDE.md` commits to capacity being bought rather than given, and the design document
extends the same mechanic to trees, datasets, decision nodes, orchard blocks and whole
model families. Built once per noun that would be five near-identical gating systems;
built once as a catalog it is one.

The knob case is the urgent one and is already written up. Today `knobs[].values` is a
fixed list and every declared value is selectable, so the configuration screen offers all
108 combinations and 105 of them refuse as untrained. That refusal is honest but it is
not the lesson — a student who meets it learns that the simulator is incomplete, not that
a deeper stack is something to earn.

## What Changes

- A declared catalog: every purchasable thing as data — id, price, what owning it opens,
  and its shop copy. Nothing about it is code.
- A progression module: owned items in, availability out. The only place unlock rules
  live, and the thing `knob-availability` was going to be.
- The market screen (§5.5), rendering from the catalog and naming nothing in it.
- Locked things are visible and greyed with their price, never hidden. Seeing the network
  you cannot afford for five years is the motivation system, so `[ saving ]` means you
  cannot afford it, not that it is barred.
- Money is the only key (§2). Nothing is gated behind owning something else, with one
  declared exception: the robot gates expansion, because you could not hand-sort a bigger
  orchard (`orchard-scale`). No model requires a dataset — the CNN runs on the starter
  set and is simply worse, which the workshop shows.
- Versioned save state in `localStorage` (§6.4): schema version, farm seed, year, cash,
  owned ids, per-family knob values, ledger. A schema mismatch resets with a warning
  rather than migrating wrongly, and the save is editable by anyone who opens the
  console — that is fine, and not one line of code goes on preventing it.
- A locked knob sits at its declared default and still contributes to the configuration
  identifier, so unlocking *extends* trained coverage instead of reinterpreting shipped
  artifacts. Three refusals stay distinguishable from one another: locked, untrained, and
  invalid.
- The shell invariant extends: no screen names a catalog item or an unlock condition.
- Settles §10.3 (is progress persisted from the start?) and §10.6 (fixed farm seed per
  player, or a fresh one per new game?).

## Capabilities

### New Capabilities
- `progression-catalog`: provisional. The declared catalog, ownership, the availability
  rules, and how a locked thing is presented.
- `game-save`: provisional. Versioned local persistence, schema-mismatch reset, and the
  deliberate absence of tamper protection.

### Modified Capabilities
- `task-contract`: provisional. The declared shape of a knob gains availability, so
  *Knob declarations drive the configuration screen* has to say what a locked value does.
- `simulator-shell`: provisional. A market stage, and the invariant over catalog nouns.

## Impact

To be determined. New `declarations/catalog.json`, `src/progression/`, `src/save/`, and a
market screen. Touches the knob declaration schema, its validator and the configuration
screen. Reads nothing new from `prediction-artifacts` but must not let a student select a
configuration it does not cover. Deletes `openspec/changes/knob-availability/`.

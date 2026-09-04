# The change pipeline

Working order for the 16 queued changes under `openspec/changes/`. Each one is a stub
holding only `proposal.md`; the pipeline turns it into specs, design, tasks, code, and
then an archive entry. Dependency-ordered — do not reorder without checking the
`Depends on` line at the top of each proposal.

Source of the plan: `Game_design.md` §11.

## Setup, once per shell

The `openspec` CLI does not run on this machine's default Node 18:

```bash
export PATH="$LOCALAPPDATA/Temp/os-node/node-v24.20.0-win-x64:$PATH"
openspec --version
```

That Node lives under `Temp` and will not survive a disk cleanup. If `openspec --version`
fails, reinstall Node 24 somewhere durable and update this line.

## The loop, per change

Three sessions per change. Clear context between them — a change is sized to be authored
in one session, and carrying the last one's context in costs more than it helps.

```
1.  /clear
    author the specs, design and tasks for <change>

2.  /clear
    /openspec-apply-change <change>

3.  /openspec-archive-change <change>
```

Step 1 runs `openspec status --change <change> --json`, then
`openspec instructions specs|design|tasks --change <change> --json` for each artifact in
order, then `openspec validate <change> --type change`. Run it by hand with `!` if you
prefer:

```bash
openspec status --change <change>
openspec instructions specs  --change <change>
openspec instructions design --change <change>
openspec instructions tasks  --change <change>
openspec validate <change> --type change
```

Step 3 syncs the delta specs into `openspec/specs/` and moves the change into
`openspec/changes/archive/`. `/openspec-sync-specs` syncs without archiving, for the rare
case where a delta should land before the change is finished.

A stub fails `openspec validate` with "no deltas found" until step 1 writes its specs.
That is the expected state, not a problem.

## Where it will stop and ask

Each proposal names the decisions its own session has to settle; those are the questions
to expect. The ones that will take real thinking rather than a preference:

- `three-action-sorting` — the payoff table must not make "crate everything" optimal.
- `harvest-scoring` — co-op contract or flat penalty (§10.1). The contract is the better
  lesson and breaks `decision-policy`.
- `dataset-tiers` — whether a dataset tier joins the configuration identity. If it does,
  every shipped artifact triples.
- `fitted-tree` — artifact-backed or fitted live in the browser. `random-forest` must
  answer this the same way.
- `heirloom-cultivars` — the feature ceiling has to be measured before it ships. If the
  tree does well on heirlooms, the network purchase loses its motivation.

## Order

### Phase 1 — ground rules, before any pixel moves

- [ ] 1. `colour-accessibility` — regenerates the pool and retrains everything
- [ ] 2. `three-action-sorting`

### Phase 2 — the farm becomes a game

- [ ] 3. `game-economy`
- [ ] 4. `progression-catalog`

### Phase 3 — a playable year with no model in it

- [ ] 5. `manual-sorting`
- [ ] 6. `workshop-harvest-split`
- [ ] 7. `harvest-scoring`
- [ ] 8. `orchard-scale`

### Phase 4 — models as things you buy

- [ ] 9. `measured-features`
- [ ] 10. `model-families` — the big one (§6.2)
- [ ] 11. `dataset-tiers`
- [ ] 12. `decision-tree-builder`

### Phase 5 — up the ladder

- [ ] 13. `fitted-tree`
- [ ] 14. `random-forest`
- [ ] 15. `training-simulation`

### Phase 6 — the pivot

- [ ] 16. `heirloom-cultivars` — new pool, full retrain, and only once

## Checkpoints

**After 12.** Years 1–5 of §4.6's playthrough are playable with no neural network in the
game at all: sort by hand, buy a robot, write a tree, grow the farm, watch growing pay.
Play it. If that is not fun on its own, the network will not save it.

**After 16.** Play Year 1 through Year 8 against §4.6's table. If the money curve does not
roughly match, the prices are wrong — and prices are data, so fixing them is an afternoon,
not a change.

## Two costs to keep in view

Changes 1 and 16 both regenerate the pool and retrain every shipped configuration. Nothing
else may touch a pixel: anything that needs one gets batched into 16 (§7). Change 11 may
need a bigger pool for its 5 000-image tier — if it does, that regeneration belongs in 16
as well.

Until 16 lands the game has a working ladder with no reason to climb its last rung. Years
1–7 stand alone and the network is still buyable, so this is survivable, but it is a known
gap rather than a surprise.

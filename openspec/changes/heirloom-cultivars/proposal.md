# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §2 ("Why the feature-based models must hit a
real wall"), §4.3 and §9. **Last in the sequence, and it happens once.** Depends on
`orchard-scale`, `random-forest` and `colour-accessibility`, whose decorrelation rule this
change is bound by. Read `openspec/specs/image-pool/spec.md` and
`openspec/specs/prediction-artifacts/spec.md`'s *Deliberate shaping is a recorded step*
before filling this in.

## Why

This is the pivot the whole ladder was built for. Until it lands, the game has a working
ladder with a missing reason to climb its last rung: the feature models are good enough,
so the network is a purchase with no argument behind it.

The heirloom block supplies the argument. It is a new distribution the old model was never
fitted to, and it is where the cliff belongs — the forest that sat comfortably inside the
co-op's tolerance on ordinary apples starts pushing wormy heirlooms into crates, and the
delivery is downgraded. The best orchard yet earns the worst year, cash is at its highest,
and nothing is lost except the belief that buying more was the answer.

The lesson it carries is one of the most useful a student can leave with: **models degrade
when the data changes, not when there is more of it.** That is also the correction §4.3
insists on — growth multiplies the money, not the error rate.

It is last because it is the most expensive change in the project. New cultivars mean new
pixels, which mean a new pool and a full retrain of every shipped configuration. §9 says
do it once and never twice; anything else that needs pixels should be batched into it.

## What Changes

- Heirloom cultivars separable by eye but not by any summary statistic we measure: the
  same mean colour, size and roundness, differing only in whether the blush runs in
  lengthwise stripes or scattered speckles. An axis-aligned split on redness, size or
  texture variance cannot express a spatial arrangement. A convolution can.
- **Green apples get stripes too**, and that does more work than it looks like. If only
  the red cultivars were striped, "striped" would correlate with "red", a feature model
  could reach the right answer through the wrong door, and the ceiling would collapse for
  a reason nobody intended. Striping both colours decorrelates pattern from colour, so the
  pattern feature carries cultivar information and *nothing else*. That is the same
  shortcut-learning problem real datasets have, and here we get to be on the right side of
  it by construction. It is also why stripes cannot be the colour-blindness fix
  (`colour-accessibility`).
- The heirloom block is a purchased orchard block with a higher price per apple, so
  buying it is attractive on the numbers before it is instructive.
- **The wall is stated as feature expressiveness, never as node budget.** "You ran out of
  nodes" is the wrong reason and a student would repeat it wrongly. The right sentence is
  high-school-legible and correct: *your tree can only ask questions about the numbers we
  measured; nobody measured "the stripes run lengthwise", so your tree cannot ask it — the
  network measures its own.* The node budget stays a purchase; it just does not carry the
  explanation.
- **The plateau is measured, not assumed.** Feature models around 70% on the heirloom
  block, the network in the low 90s, and that gap authored on purpose and recorded as a
  deliberate shaping step exactly as the fitted/harvest gap already is. If the tree
  accidentally does well on heirlooms the network purchase has no motivation and the
  lesson collapses, so this has to be validated with numbers *before* it ships. If the
  measured gap is narrower than intended, the response is to reshape the cultivars
  deliberately and record it — not to ship a ceiling we cannot defend.
- Settles §10.5: how many cultivars, and are they a separate pool or an extension of the
  existing one?
- Regenerate the pool under a new seed and retrain every shipped configuration.

## Capabilities

### New Capabilities
- `heirloom-block`: provisional. The block as a purchasable orchard extension, the
  cultivars it introduces, the measured ceiling the feature families hit on it, and how
  that ceiling is explained on screen.

### Modified Capabilities
- `image-pool`: provisional. New cultivars, the pattern attribute, and the requirement
  that pattern is decorrelated from colour.
- `prediction-artifacts`: provisional. A new pool means every artifact rebinds, and the
  authored feature ceiling is a shaping step that has to be recorded.
- `measured-features`: provisional, if the feature set gains anything to keep it honest —
  the ceiling must come from what a summary statistic *cannot* express, not from having
  deliberately measured too little.

## Impact

To be determined, and expected to be the largest in the project. `tools/pool/` gains
cultivars and pattern generation; `pools/apple-harvest/` regenerates under a new seed;
every configuration in `artifacts/apple-harvest/predictions/` retrains, for the
convolutional family and for whichever of the tree families turned out to be
artifact-backed. Pool tests, `training/tests/`, and `training/README.md`'s measured
findings all move. Catalog entries for the block. Batch anything else that needs pixels
into this change.

**Acceptance test for the whole sequence** (§11): once this lands, play Year 1 through
Year 8 against §4.6's table. If the money curve does not roughly match it, the prices are
wrong — and prices are data, so fixing them should cost an afternoon rather than a change.

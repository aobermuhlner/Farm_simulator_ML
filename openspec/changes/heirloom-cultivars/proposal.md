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

## The wall is already gone, and it was measured — 2026-09-09

Recorded during the `fitted-tree-tutorial` explore session, because that change had to know
whether the feature set behaves the way the copy says it does. It does not. This is the
number this change now has to aim at, and it is much harder than the one
`test/features-ladder.test.ts` records.

**`spotCount > 0` separates wormy apples perfectly.** Every wormy apple in
`pools/apple-harvest/manifest.json` has at least one off-colour patch — 15 with one, 35 with
two on the browsable split; 116 and 134 on the evaluation pool. No red or green apple has
any. So the two-split chain `spotCount > 0.5 -> discard; redness > 0.4513 -> crate-red;
otherwise crate-green` scores:

```
  rule                                           fitted(160)   pool(1000)
  ---------------------------------------------  -----------   ----------
  pinned "best rule" in features-ladder.test.ts     1.000         0.825
  darkSpotArea > 0.0205 / redness > 0.4513          1.000         0.892
  spotCount    > 0.5    / redness > 0.4513          1.000         0.986
  widest shipped network (blocks2-channels32)         -           0.786
```

Measured by replaying the shipped manifest against the same semantics `scoreActions` uses;
the replication reproduces the pinned `0.825 / 0.972 / 1.000 / 0.356` exactly, which is what
makes the other two rows trustworthy.

Four consequences, in the order they matter:

- **§2's "why the feature-based models must hit a real wall" has no wall.** A two-split hand
  rule at 98.6% leaves nothing for the fitted tree, the forest or the network to be better
  at. The plateau this change is supposed to author does not need creating on top of a 0.825
  baseline; it needs creating against a feature that is currently flawless.
- **`bestRule`'s tie-break decides between rules that differ by sixteen points.** All three
  rows above score 1.000 on the fitted 160, so the search's answer is settled by
  depth-first discovery order, which favours the earliest declared feature — `redness`. Its
  own doc comment claims *"ties break towards the rule found first, which is the shortest"*,
  and it returned a three-split rule while a two-split rule tied. Whatever this change does
  to the pool, the recording is measuring an arbitrary member of a tie.
- **The recorded ladder position understates the rule by an order of magnitude.** *The best
  hand rule is ahead of every shipped network* is true, but the honest gap is 0.986 against
  0.786, not 0.825 against 0.786.
- **`spotCount`'s declared help copy is not supported by the data.** It says *"a worm that is
  the same colour as the apple around it is not counted either"*. No wormy apple in the pool
  is ever uncounted. Under §1.1 that is the game describing a contamination it does not have.

Whether this is one change or several is not decided here. It is recorded on this stub
because this is the change §2 names as the one that fixes the wall, and none of the four can
be fixed without touching pixels.

## What Changes

- **The wall has to be authored against `spotCount`, not just against colour and shape.** See
  the section above: the current feature set contains a flawless wormy detector, so a
  heirloom ceiling authored around redness and texture would leave the tree at 98.6% on
  ordinary apples and prove nothing. Either the cultivars have to make patch-counting
  genuinely unreliable, or `spotCount` has to become the contaminated measurement its own
  help copy already claims it is.
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

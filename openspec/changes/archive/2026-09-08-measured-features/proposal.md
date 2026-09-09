## Why

A decision tree needs numbers to split on, and where those numbers come from decides
whether rung 1 teaches anything. Rung 1 (`decision-tree-builder`) is blocked on this
change and on nothing else, so it lands early and it has to land cheap.

The obvious framing is that generation attributes would be cheating and measured features
are honest. That framing is half right, and the half that is wrong matters. `draw.ts` is
deliberately a one-attribute-one-part mapping — a decision made for testability — which
makes the drawing very nearly invertible. Measured over the shipped atlas, silhouette area
recovers `roundness` at r = 0.999 and mean redness recovers `hue` at r = 0.994. A feature
measured from the pixels is not prevented from reading the answer sheet; it reads it
through a PNG.

What measurement actually buys is better than what it was advertised to buy. Restricted to
non-green apples, measured redness correlates 0.77 with `lighting` and only 0.23 with
`hue`: a red apple in shadow measures less red, and a glossy one measures washed out. The
recorded attribute `hue` carries no such contamination. So a measured feature is not a
noisy copy of an attribute — it answers a different question, and the difference is the
lesson: *the rule you wrote is only as good as the measurement it is written over.* That is
also what makes the later wall true, because a tree can only ask about numbers somebody
measured, and nobody measured "the stripes run lengthwise".

Two traps were found by measuring the real pool rather than reasoning about it, and both
would teach a student something false. They are why this change needs requirements and not
just a feature list.

**A feature's usefulness can reverse across the authored gap.** Counting bright blobs
separates wormy apples in the evaluation pool 200 times in 250, and in the fitted split
only 8 times in 40 — because fitted worms carry visibility 0.7–1.0, are drawn large, and
merge with the specular highlight. A student picking thresholds against their own 200
photos sees a feature that looks useless, discards it, and leaves on the table the one
feature that would have worked on the harvest. Every real distribution-shift lesson runs
the other way. This trap is real, it is cheap to guard against, and the guard passes.

**The ladder inverts, and it cannot be un-inverted from here.** This is the finding that
changed between this proposal's first draft and its second, and it is worth stating in full
because the first draft got it wrong in a way that looked reassuring.

That draft measured the best hand-writable rule at 70–74% against networks at 76–79% and
concluded the ordering held. Its rule figures came from spot detectors swamped by the shade
ellipse and the gloss highlight — the same detectors the draft then rules out as dishonest.
Measured properly, overlays masked, thresholds fitted on the 160 images a student can browse
and scored on the evaluation split:

| | overall | red | green | wormy |
|---|---|---|---|---|
| best 3-split hand rule | **0.825** | **0.972** | 1.000 | 0.356 |
| `blocks2-channels16` (weakest shipped) | 0.764 | 0.856 | 1.000 | 0.344 |
| `blocks2-channels32` (best shipped) | 0.786 | 0.868 | 1.000 | 0.408 |

Since that draft, `harvest-scoring` and `orchard-scale` have made the ladder measurable in
the currency a student actually reads, and every mechanism they added makes the inversion
worse rather than better.

*The basis moved.* A harvest is no longer the evaluation pool. `harvest-run` draws a year's
crop composed as the farm declares — 55 / 35 / 10, wormy varying 7–14% by year — against the
pool's 50 / 25 / 25. Re-weighting to the crop demotes worms, where the networks are
relatively competitive, and promotes red, where measurement is overwhelming: the overall gap
widens from 0.061 to 0.084.

*The currency arrived, and the delivery term does not save it.* Searching the same
three-split budget for **earnings** rather than for accuracy finds `redness > 0.4964 →
crate-red; spotCount > 0.5 → discard; redness > 0.4588 → crate-red; otherwise crate-green` —
red 0.960 and wormy **0.588**, better than any shipped network on both. At the opening
orchard of 6 000 apples:

| CHF per year | mild (7% wormy) | base (10%) | wet (14%) | wormy share of delivery |
|---|---|---|---|---|
| best hand rule | **1 684** | **1 590** | **1 464** | 3.0 – 6.3% |
| `blocks2-channels32` | 1 494 | 1 388 | 1 248 | 4.6 – 9.5% |
| `blocks2-channels8` | 1 475 | 1 363 | 1 213 | 5.2 – 10.6% |
| `blocks2-channels16` | 1 464 | 1 353 | 1 206 | 5.1 – 10.5% |

The hand rule out-earns every shipped configuration in every declared year by 13–17%, and it
does so at roughly *half* the networks' wormy share — further from the co-op's 12% tolerance
and further from its 9% warning. The one lever `harvest-scoring` built that could have
re-ordered the ladder never fires. The rule wins on every figure the harvest report puts on
screen, and `orchard-scale` multiplies the margin: at 600 trees the ~200 CHF gap becomes
~1 200 CHF a year, more than an orchard expansion, every year. It is also honest in the
direction the other guard cares about — it plays perfectly on the fitted 160 and gives back
9% of its value on the harvest.

*No feature set fixes this.* The margin is carried by `redness` on red apples — 0.96 against
the networks' 0.86 — and `redness` masks nothing by design, so no declared sensitivity
lowers it. Weakening the comparator does not help either: the *best* shipped configuration
loses too. The cause is the pool. Flat-coloured synthetic apples make measurement
near-perfect, and the shipped networks are deliberately weak because `CLAUDE.md` requires
the opening model to be genuinely small so that capacity has somewhere to be bought.

The rest of the project already knows this. `Game_design.md` §2 says rung 4 "buys in cheap
and starts unimpressive… better on heirlooms, **possibly worse on ordinary apples**", and
that "the heirloom varieties are what make the network necessary in the first place".
`heirloom-cultivars` opens by saying that until it lands "the feature models are good enough,
so the network is a purchase with no argument behind it". The answer the design has chosen
is new pixels, authored on purpose, in the last and most expensive change in the sequence.

So a requirement refusing the feature set whenever a hand rule out-scores a network asks
this change to prevent a state the design deliberately creates and deliberately fixes
elsewhere. It cannot pass, and it should not: it is stricter than §2's floor asks for, and
it points the remedy at the wrong artifact. What survives is what that requirement was
really protecting — **the game must not tell a student that the network is better at what a
hand rule can already do.** That is refusable today, in the shape `orchard-scale` used for a
claim it could not let a screen make.

## What Changes

- The pool manifest gains a measured feature vector per image, for both splits, computed by
  the pool tools from the delivered atlas and recorded in the manifest — so nothing is
  measured in the browser and every model sees the same numbers.
- **Five features are declared, not §5.4's seven.** `greenness` is `-redness` exactly
  (r = -1.0000: one number under two names), and `size` cannot vary in this pool at all,
  because `bodyPath` fixes `rx` at 40 and moves only `ry`. Declaring either would teach a
  student something false about what a feature is. The declared set is `redness`,
  `roundness`, `darkSpotArea`, `spotCount` and `textureVar`. `size` becomes available only
  if a later change varies the silhouette's width.
- **The separation from generation attributes is a provenance requirement, and it is stated
  as one.** A feature is computed from the atlas and from declared drawing geometry; it
  reads no per-image generation attribute, and one that does is refused with the feature
  named. The rule is worth keeping — it is what makes the numbers identical for every model
  and keeps the manifest's recorded attributes out of the student's reach — but it is not
  what makes a feature honest, and the spec should not claim that it is.
- **The extractor may exclude declared overlay regions.** The shade ellipse and the
  specular highlight are drawing geometry, not per-image data, so masking them is
  permitted. Without it `spotCount` measures whether a shadow edge crosses a light-coloured
  body — green apples register more dark spots than wormy ones — and it is a worm feature
  in name only.
- **The inversion guard stays as first drafted**, and passes: no declared feature separates
  categories better on the fitted images than on the evaluation split, beyond a declared
  tolerance. Its wording moves from "the harvest" to "the evaluation split", because
  `harvest-run` has since given "harvest" a narrower meaning — a year's crop, drawn with
  replacement under a composition that varies by year — and a guard about the authored
  train/harvest gap is about the fixed split, not about one year's draw.
- **The ladder guard is replaced, because as written it cannot pass and asks the wrong
  artifact to change.** Two requirements take its place, both checkable now:
  - *The ladder position is measured and recorded, not refused.* The best rule within the
    declared node budget, fitted on the fitted images, is scored against every shipped
    configuration — in accuracy on the evaluation split and in earnings over a declared
    year's crop — and those figures become acceptance criteria, in the same discipline
    `harvest-scoring` applied to its per-year earnings. A change that means to move the
    ladder then has a number to move it against. `heirloom-cultivars`, `fitted-tree` and
    `model-families` all need that number, and none of them can produce it.
  - *Nothing may present a learned model as better at what a hand rule already does.*
    Measured, on ordinary apples, it is not. No screen, no teaching copy and no market entry
    may claim that buying the network improves accuracy or earnings on the crop as it stands;
    what the network is bought for is expressiveness the feature set does not have, and that
    argument arrives with `heirloom-cultivars`. This mirrors `orchard-scale`'s rule that
    nothing may present growth as changing a rate — a requirement about what may be claimed,
    refusable before the change that makes the claim true.
- **The declared node budget is meant to be the maximum the task will ever offer, and its
  value contradicts that.** `ruleBudget.maxNodes` is declared at 3 so the recorded ladder
  position says something about the budget a student eventually reaches. But
  `decision-tree-builder` plans to *sell* node budget — "three splits to start, more cost
  money" — which makes 3 the opening budget rather than the ceiling, and a bought five-node
  rule scores above anything recorded here. Either this change declares the real ceiling, or
  `decision-tree-builder` may not sell past 3 without re-recording the ladder. Both changes
  read the one declared number; the contradiction is named here so it is not discovered later
  by a student holding five splits.
- **The feature set's difficulty is a recorded shaping step.** Each detector's sensitivity
  is declared data with a stated reason, because that difficulty is authored whether or not
  anyone admits it — the alternative is that it gets decided by whoever writes the
  extractor first. `prediction-artifacts` already requires deliberate shaping to be
  recorded and already ships a `shaping` field, so this change inherits a mechanism rather
  than inventing one.
- Feature names, units, ranges and teaching copy are declared, because a student picks a
  threshold on them and has to know what 0.06 means. The tree builder renders the list from
  the declaration and names no feature itself.
- **No pixel moves, so no model changes.** `SEED` is derived from `AUTHORED_SEED` and
  `RENDER_PARAMETERS` — tone, shade, gloss, cell size — so a manifest-only addition leaves
  the seed alone, which `image-pool` already has a scenario for. The manifest's
  `schemaVersion` does move, because a required field is a schema change and
  `artifacts/apple-harvest/predictions/index.json` binds `pool.schemaVersion`. There is no
  export step separate from training, so the three shipped configurations are re-run from
  their recorded seeds — a minute of CPU each, over byte-identical pixels, producing the
  same probabilities under the new schema version. Re-running is the right move rather than
  editing the stamp by hand, because `prediction-artifacts` requires artifact values to be
  produced by training and not authored.

## Capabilities

### New Capabilities
- `measured-features`: what a measured feature is, how it is computed and declared, why it
  may not read a generation attribute, the inversion guard that keeps it from teaching the
  reverse of a distribution-shift lesson, the recorded ladder position and the claim it
  forbids, and how its authored difficulty is recorded.

### Modified Capabilities
- `image-pool`: *Pool manifest completeness* gains the feature vector, and the manifest's
  role as the only source of ground truth has to accommodate numbers that are neither
  ground truth nor generation parameters. *The pool is reproducible from its seed* gains
  the statement that a manifest-only addition moves `schemaVersion` and leaves the seed
  alone.
- `training-browser`: *Generation attributes are not displayed* currently forbids the
  attributes and any statistic derived from them. Measured features are derived from the
  pixels rather than from the attributes but correlate with them almost perfectly, so the
  requirement has to say which of the two it is about, and what the browser may show.

## Impact

- `tools/pool/`: a new feature-measurement step, run over the rasterized atlas after
  drawing, plus the declared sensitivities and the overlay geometry it masks with. It needs
  the atlas pixels, which the generator already has in hand.
- `pools/apple-harvest/manifest.json`: regenerated with the feature vector and a bumped
  `schemaVersion`. Pixel-identical atlases.
- `declarations/apple-harvest.json`: the declared feature list with labels, units, ranges
  and teaching copy, the node budget, and its `schemaVersion` in step with the pool's.
- `artifacts/apple-harvest/predictions/index.json` and its three prediction files:
  regenerated by re-running `farm_training.train` at the recorded seeds, so the new pool
  schema version is stamped by the pipeline rather than by hand. Same probabilities.
- `src/features/`: reading the vectors out of the manifest, and the bounded rule search the
  recorded ladder position is measured with. The tree's only input.
- `src/task/validate.ts`: validating the declared feature list and the node budget.
- Tests: the inversion guard as a real per-feature separation comparison between the fitted
  images and the evaluation split; the ladder position as recorded figures over both bases —
  accuracy on the evaluation split, and earnings over a declared year's crop through
  `src/scoring/` and its delivery term — rather than as a refusal this pool cannot satisfy.
- `web/src/`: the claim requirement is a test over the screens and the declared teaching and
  market copy, alongside the existing `no-task-specific-code` assertions.

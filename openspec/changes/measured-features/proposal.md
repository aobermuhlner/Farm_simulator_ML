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

**The ladder can invert.** The shipped networks score 76–79% on the harvest and 33–41% on
wormy apples. The best tree hand-writable within a three-split budget, thresholds chosen on
the fitted 160, reaches 70–74% and 27–36%. The ordering holds — but only because the spot
detectors that produced those numbers are swamped by the shade ellipse and the gloss
highlight. A narrower detector, restricted to where worms are drawn, catches 27 of 30 worms
with no false positives. Whether rung 1 out-earns rung 4 is therefore a property of how
somebody chose to measure, not a property of the pool, and a game where the hand-written
rule beats the network teaches the reverse of the truth.

**A feature's usefulness can reverse across the authored gap.** Counting bright blobs
separates wormy apples in the evaluation pool 200 times in 250, and in the fitted split
only 8 times in 40 — because fitted worms carry visibility 0.7–1.0, are drawn large, and
merge with the specular highlight. A student picking thresholds against their own 200
photos sees a feature that looks useless, discards it, and leaves on the table the one
feature that would have worked on the harvest. Every real distribution-shift lesson runs
the other way.

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
- **Two guard requirements**, both checkable from the manifest and the shipped artifacts:
  no tree hand-writable within the declared node budget out-scores the weakest shipped
  network on the harvest, and no declared feature separates categories better on the fitted
  images than on the evaluation pool. The first protects the ladder; the second rules out
  the inversion by construction.
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
  may not read a generation attribute, the two guards that keep it from teaching something
  false, and how its authored difficulty is recorded.

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
  and teaching copy, and its `schemaVersion` in step with the pool's.
- `artifacts/apple-harvest/predictions/index.json` and its three prediction files:
  regenerated by re-running `farm_training.train` at the recorded seeds, so the new pool
  schema version is stamped by the pipeline rather than by hand. Same probabilities.
- `src/features/`: reading the vectors out of the manifest. The tree's only input.
- `src/task/validate.ts`: validating the declared feature list.
- Tests: the guards need real checks rather than weak ones — a brute-forced best tree
  within the node budget against the weakest shipped artifact, and a per-feature separation
  comparison between the fitted images and the evaluation pool.

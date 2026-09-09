## Context

See `proposal.md` — *Why* for the motivation and for the measurements behind it. What
matters here is the shape of the pipeline the features have to fit into.

The generator draws each apple as SVG from an attribute vector, rasterizes 128px cells into
2048px atlases, and writes a manifest keyed by image id. `SEED` is derived from
`AUTHORED_SEED` plus a fingerprint of `RENDER_PARAMETERS`, so pool identity already
distinguishes "the pixels changed" from "the recording changed" — which is what makes a
manifest-only addition possible at all.

Three constraints shape every decision below.

- **The atlas is the only honest input.** Everything else the generator holds at
  measurement time is the answer sheet.
- **The highlight's size is per-image.** `gloss` drives the highlight ellipse's radii, so a
  mask fitted to the actual highlight would be reading a generation attribute. Only a
  pool-wide mask is available.
- **The guards must be cheap.** They run in the test suite, so they cannot rasterize. Once
  features live in the manifest they are pure arithmetic over 1 200 rows, which is what
  makes a brute-force tree search affordable as a test.

## Goals / Non-Goals

**Goals:**

- One measurement pass in the generator, recorded in the manifest, consumed everywhere.
- Feature definitions whose failure modes are chosen deliberately and written down.
- The inversion guard and the recorded ladder position both executable in the normal test
  run, at a bounded cost.
- Atlases byte-identical before and after, proven rather than asserted.

**Non-Goals:**

- The tree builder, the node budget as a purchasable item, and the "see mistakes" view.
  Those are `decision-tree-builder`. This change declares the numbers and the budget the
  ladder position is recorded at, and stops.
- Changing any pixel. `size` stays undeclared rather than being made real.
- A general feature-extraction framework. Five features, measured one way, for one pool.
- Live measurement in the browser, now or later.

## Decisions

### Measurement runs over the rasterized atlas, inside the generator

The atlas is rasterized before the manifest is assembled, so the measurement pass slots
between them: rasterize, measure each cell, then write the manifest with attributes and
features side by side.

*Alternatives considered.* Measuring from `appleParts` or the SVG markup would be faster and
needs no raster decode — and it is exactly the answer sheet, since `appleParts` is a pure
function of the attribute vector. Measuring in the browser was rejected on two counts: the
same apple would measure differently on different devices, and the manifest is meant to be
the one place a pool's facts live.

### Overlay masking is per-feature, declared, and sized to the worst case

The shade ellipse and the highlight ellipse move into `params.ts` as declared geometry, read
by both the drawing code and the measurement code, with a test asserting both read the same
constants. The highlight's mask uses its radii **at `gloss = 1`** — the largest it can ever
be — so the masked region is identical for every image and reads no per-image value. The
shadow's position and radii are already constant; only its opacity varies.

Masking is declared **per feature**, not globally, and that is the load-bearing part:

- `redness` and `textureVar` mask **nothing**. Their contamination by `lighting` and `gloss`
  is the honest lesson — a red apple in shadow measures less red — and masking it away
  would leave `redness` a clean read of `hue`, which the spec refuses as a duplicate of an
  attribute.
- `darkSpotArea` and `spotCount` mask **both overlays**. Unmasked they measure whether a
  shadow edge crosses a light-coloured body, which is why green apples currently register
  more dark spots than wormy ones.
- `roundness` measures the silhouette, which no overlay touches, and masks nothing.

Checked against the geometry: at maximum size neither mask reaches where worms are drawn, so
masking the overlays does not also mask the thing the spot features exist to find.

### The five features, and the two that were dropped

| Feature | Measured as | Nominally about | Declared contamination |
|---|---|---|---|
| `redness` | mean red-minus-green over the body, no mask | hue | `lighting`, `gloss` |
| `roundness` | silhouette bounding-box width over height | roundness | — see below |
| `darkSpotArea` | masked area darker than the body's modal colour | worm size | `hue`, `lighting` |
| `spotCount` | masked dark blobs above the minimum size | worm presence | `hue`, `lighting` |
| `textureVar` | luminance standard deviation over the body | surface texture | `gloss`, `lighting` |

`greenness` is dropped: measured, it is `-redness` at r = -1.0000. `size` is dropped: with
`rx` fixed at 40 the silhouette's width never moves, so a size feature would be a constant,
which the spec refuses.

`roundness` is the awkward one and worth naming rather than hiding. It recovers the
`roundness` attribute at r = 0.999 and has no meaningful contaminant, because the silhouette
is drawn cleanly and nothing overlays it. It is therefore exactly the "attribute under a
different name" the contamination requirement refuses. Two ways out: drop it, leaving four
features; or admit quantization as its contaminant, which is real but tiny and would make
the contamination requirement toothless. **Decision: keep it and declare it contaminated by
the raster grid, with the recorded reason that the pool offers no honest fifth feature and a
four-feature tree builder is thin.** This is the weakest point in the change and the design
says so; if it does not sit right, dropping to four features is a one-line declaration edit
and no code change. Settled under Resolved Questions — it stays, with the reservation intact.

### Sensitivity parameters are declared with reasons, and the choice is recorded as shaping

Every threshold that decides what a measurement can detect — the dark-spot cut as a fraction
of the body's modal luminance, the minimum blob size in pixels, the colour-distance cut, the
channel each comparison runs on — becomes declared data carrying a recorded reason.

This is not ceremony. Two defensible spot detectors over these same pixels differ by more
than a factor of two in how many worms they find: a luminance cut at 0.55 of the body median
finds none at all on a dark red apple, while a colour-distance blob counter finds 27 of 30.
The sensitivity *is* the teaching decision, and `prediction-artifacts` already established
the discipline for a teaching decision that shapes results — record it. The recorded reason
for each value is what a reviewer disagrees with.

### Guards are tests over the manifest, not over pixels

Both read the recorded feature vectors and the shipped artifact index. No rasterizing,
so both are ordinary fast tests.

**Separation metric.** For a `(feature, category)` pair, the best single-threshold balanced
accuracy for that category one-vs-rest; a feature's separation for a set of images is the
maximum over categories. Chosen because it is the same operation a student performs — put a
threshold on one number — so a guard stated in it means something a student could verify,
and because balanced accuracy is comparable between the 160 fitted images and the 1 000
evaluation images despite their different class balance. Rejected: AUC, which is a better
statistic but measures a ranking a student never sees.

**Ladder position.** Brute-force the best rule within the declared node budget over the five
features, thresholds chosen on the fitted images. Candidate thresholds are the midpoints
between adjacent observed values, subsampled to a declared cap per feature, which is what
keeps a depth-3 exhaustive search bounded. Score it two ways: category scores over the
evaluation split, and earnings over a year's crop at the extremes of the declared
composition, through `src/scoring/` and its delivery term. `test/delivery-guards.test.ts`
already assembles exactly that second measurement for the shipped configurations, so the
earnings side reuses machinery rather than growing a second definition of what a year earns.

**Decision: the figures are recorded and pinned, not refused on direction.** The first draft
refused any feature set over which a hand rule out-scored the weakest shipped model. That
requirement cannot pass — see `proposal.md`, where the measurements are — and it should not.
Three reasons, in order of weight:

- *It fixes a moving number in a `SHALL`.* The comparison legitimately changes when the pool
  changes, when a configuration is added, when the node budget grows, and it is designed to
  reverse when `heirloom-cultivars` lands. A requirement stating its direction has to be
  rewritten on every one of those, and it broke within days of first being written.
- *It demands the remedy from the wrong capability.* The margin is carried by `redness` on
  red apples, and `redness` masks nothing by design. No declared sensitivity moves it. The
  cause is the pool — flat synthetic apples measure almost perfectly while the opening
  networks are deliberately small, because `CLAUDE.md` requires capacity to be bought rather
  than given. A feature-set requirement cannot reach either half of that.
- *It belongs to a capability that does not exist yet.* Whether rung 1 out-scores rung 4 is a
  fact about the ladder, and `model-families` is the change that declares rungs. This
  capability owns the feature set. It supplies the measurement; the ordering rule, if anyone
  wants one, is written where the rungs are.

What replaces the refusal is a *pin*: the figures are recorded as acceptance criteria and a
change that moves them fails until it re-records them. That is the same discipline the pool
already uses for byte-identical atlases and `harvest-scoring` uses for per-year earnings —
movement is allowed, silent movement is not. Paired with the claim requirement it keeps
everything the refusal was actually protecting, and it needs no rewrite when the numbers
legitimately reverse.

*Alternative considered:* restate the guard in earnings, or on the crop's composition rather
than the pool's, in the hope that the delivery term re-orders the ladder. Measured, it does
not — the best hand rule out-earns every shipped configuration in every declared year while
sitting at roughly half their wormy delivery share, so the tolerance never fires. Rejected on
measurement, not on taste.

**The node budget is a coupling, not a number.** The figures are recorded at the largest node
budget the task offers for hand-written rules, and a change offering more re-records them.
Stating it that way rather than declaring a ceiling resolves a live contradiction:
`design.md` previously called the declared budget "the maximum the task will ever offer",
while `decision-tree-builder` plans to *sell* budget — three splits to start, more cost money
— which makes the declared 3 an opening budget. Under the coupling, `decision-tree-builder`
may sell whatever it likes provided it re-measures, and neither change has to guess the other's
ceiling. Both read the one declared number rather than introducing a second.

### Versioning: features are required, the schema version moves, the seed does not

Features are a **required** manifest field, so the manifest schema version goes to `1.1.0`
and the task declaration's `schemaVersion` moves with it. The three shipped configurations
are then re-run from their recorded seeds over byte-identical pixels.

*Alternative considered:* make the feature vector optional, so no version moves and nothing
is re-run. Rejected — an optional field means every consumer has to handle its absence, and
`image-pool`'s completeness requirement, which refuses a partial manifest rather than
loading it, is the thing that makes the manifest trustworthy. Buying a smaller diff by
weakening that is the wrong trade.

Re-running rather than editing `pool.schemaVersion` in place matters: `prediction-artifacts`
requires artifact values to be produced by training and not authored by hand, and a
hand-stamped provenance field is the beginning of an artifact nobody can reproduce.

### `src/features/` is a reader, nothing more

A typed accessor over the manifest's feature vectors, plus validation of the declared list
against what the manifest records. No measurement code ships to the browser. `tools/pool/`
holds the measurement; `src/features/` holds the reading; the declared parameters and
overlay geometry in `params.ts` are the only thing they share.

## Risks / Trade-offs

**`roundness` is very nearly a clean read of its attribute** → Declared as contaminated by
the raster grid, which is honest but thin. Mitigation is that dropping it costs one
declaration edit and no code; the design names it rather than letting it pass quietly.

**The recorded ladder position couples this capability's tests to the shipped artifacts** →
Accepted deliberately. The measurement has to be against something real, and
`prediction-artifacts` already ships an enumerable index. The coupling tightens on its own as
configurations are added, which is the behaviour we want — a new configuration moves a pinned
figure and has to say so.

**Nothing now forces the ladder to be fixed** → The real cost of dropping the refusal, and
worth stating rather than burying. A refusal would have held the project hostage until the
hand rule lost; the pin only makes the position visible. Accepted on three grounds: the fix
is `heirloom-cultivars`', which already owns it and now has a concrete number to aim at; the
claim requirement stops the dishonesty in the meantime, which is the part that would actually
have reached a student; and a hostage-taking guard aimed at a capability that cannot pay the
ransom does not get the ladder fixed, it gets the guard deleted.

**The pin will be noisy while the pool and the artifacts are still moving** → Every change
that touches pixels or retrains re-records these figures, which is friction on exactly the
changes that are already expensive. Mitigated by recording few figures rather than many —
per-category scores against each configuration, and earnings at the two declared extremes,
not a table per year — and by the figures living in one test rather than being scattered.

**The claim requirement has little to bite on today** → Every model item in the catalog
carries a `notForSaleReason`, so there is no live comparative claim to catch, and its test is
trivially green. That is the requirement arriving before the copy rather than after it, which
is the order that works: `model-families` and `decision-tree-builder` write market copy for
rungs, and they inherit the rule instead of discovering it in review.

**The inversion guard may reject a feature we like** → `spotCount` is the likely casualty,
since bright-blob counting inverts sharply across the splits. The remedy is to retune its
declared sensitivity until it does not invert, or drop it — either way the decision gets
recorded as shaping rather than discovered later by a student.

**Brute-force search cost grows with the budget** → Bounded by the declared threshold cap
per feature and by depth. If the maximum budget ever grows past what exhaustive search can
carry, the guard becomes a sampled search and stops being a proof; that trade would need
revisiting then, not now.

**Measurement code and drawing code must agree about overlay geometry** → Shared declared
constants in `params.ts` with a test asserting both read them, rather than two copies of the
same ellipse.

**Contamination could be satisfied on paper** → The spec checks each declared contamination
against the pool, so a declaration naming an attribute that does not move the feature is
refused. The check is the point; without it the requirement is a comment.

## Migration Plan

1. Extract overlay geometry into declared constants; assert the atlases are unchanged.
2. Add the measurement pass and the declared sensitivities; regenerate the pool.
3. **Assert the atlases are byte-identical to the committed ones.** If they are not, the
   change has moved a pixel and the seed reasoning is void — stop rather than proceed.
4. Bump the manifest and declaration schema versions together.
5. Re-run the three shipped configurations; confirm the probabilities are unchanged and only
   the pool schema version differs.
6. Land the reader, the validation and both guards.

Rollback is reverting the manifest, the declaration and the artifacts together — they move
as one unit, and the atlases never move at all.

## Resolved Questions

- **Does `roundness` stay?** Yes. Measured, its declared contamination holds against the
  pool, and the five-feature set is what ships. The reservation above stands — it is the
  weakest of the five — and dropping it remains a one-line declaration edit.
- **What tolerance does the inversion guard use?** `INVERSION_TOLERANCE = 0.02`, fitted to
  the measured pool. Every declared feature passes against it.
- **What replaces the ladder guard?** A pinned recording plus a claim requirement — see
  *Ladder position* above. The refusal is gone deliberately, and its cost is in Risks.

## Open Questions

- **Where does the rung-ordering rule live, if anywhere?** This change stops at supplying the
  measurement. `model-families` declares rungs and is the natural home for a requirement that
  one rung out-scores the one below; whether such a rule is even wanted, given `Game_design.md`
  §2 expects rung 4 to be "possibly worse on ordinary apples" until `heirloom-cultivars`, is
  that change's question rather than this one's.

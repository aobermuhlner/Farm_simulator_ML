## Context

See `proposal.md` — Why. Requirements are in `specs/image-pool/spec.md`; this document
covers only how they are met.

Three constraints shape everything below. There is no backend, so the pool is static
files served from GitHub Pages. The engine, its specs and a playable shell already exist
and read a ten-image fixture through `web/src/data/load.ts`, so the pool has a consumer
with a settled shape to fit. And — the constraint that decides the most here — no model
ever looks at these pixels. Predictions are authored by `prediction-artifacts` against the
manifest's attributes, so an image needs to be *legible to a student*, not realistic to a
convolutional network.

## Goals / Non-Goals

**Goals:**
- Attribute control precise enough that the split gap is set by numbers, not by eye.
- A pool whose spec-level distribution properties are enforced by tests over the manifest.
- Delivery that costs a fixed handful of requests at any pool size.
- Regeneration that is safe to run: same seed in, same bytes and same image ids out.

**Non-Goals:**
- The probability distributions over these images, and the shaping that produces them.
  That is `prediction-artifacts`, which consumes this manifest.
- The browsing screen, the harvest sample, and how images are laid out on screen.
  Those are the shell and `harvest-scoring`.
- Art direction beyond legibility. These are stylized apples, not illustration work.
- A second pool for the later screening lesson. The contract generalizes; the assets
  do not, and nothing is built for them here.

## Decisions

**Apples are drawn from a parameter vector as SVG, then rasterized at generation time.**
The alternative of a generative image model was rejected outright: it cannot hit a
specified hue and worm visibility on demand, which is the one thing this change exists to
do, and it makes regeneration non-reproducible. Rasterizing rather than shipping the SVG
keeps the browser out of the drawing business — 1200 live SVG renders is real work on a
laptop, and CSS background positioning against an atlas is nearly free. SVG stays the
authoring format because a parameter vector maps to flat fills and path curvature
declaratively, so the attribute-to-pixels function is readable and reviewable in one
place.

Rasterization uses a prebuilt-binary renderer (`@resvg/resvg-js`) rather than `sharp` or
`node-canvas`: it needs no `node-gyp` toolchain, which matters because this repository is
developed on Windows. It is a dev dependency of the generator only; nothing ships to the
browser.

**One atlas per 256 images, with cell position derived rather than stored.**

```
  cell             128 x 128 px
  atlas            2048 x 2048 px = 256 cells
  training split   200 images   -> 1 atlas
  evaluation pool  1000 images  -> 4 atlases
  requests         5 atlases + 1 manifest, independent of pool size
  bytes            PNG, measured 3.15 MB for the five atlases
  manifest         1200 entries of readable JSON, measured 338 KB (~40 KB gzipped)
```

Atlases are PNG rather than WebP. `@resvg/resvg-js` writes PNG only, and the alternative
was a second image dependency — `sharp` and its build toolchain, which the rasterizer
choice above rejects for the same reason.

**Shading is flat, not gradient — for size, not for taste.**
Measured at a 128 px cell, smooth radial gradients cost 5.92 MB against 3.15 MB for flat
overlays at quantized opacities: a gradient turns each apple into hundreds of distinct
colours, which is the one thing PNG encodes badly. The alternative ways to reach the same
budget were all worse. A 96 px cell with gradients still measured 3.96 MB, and a 64 px
cell reached 2.22 MB only by shrinking a low-visibility worm — and finding that worm is
the lesson, so cell size is the wrong dial to turn. Gloss and lighting still drive the
highlight and the shadow, so no attribute lost its visible effect; the apples simply read
as flat vector art, which is what a stylized apple wanted to be.

An atlas declares its cell size and grid dimensions once; an image stores its atlas and
its cell index. Storing explicit x/y per image would be four times the bytes and four
more chances for a wrong number, and the spec's out-of-bounds refusal reduces to
`cell < capacity` when position is derived. 2048 rather than one 4096-wide sheet keeps
each decode inside the texture limits older mobile GPUs have, which costs three extra
requests and buys the mobile-later goal cheaply.

**The manifest stays a readable JSON object keyed by image id.**
A column-oriented encoding would roughly halve it, but `task-abstraction` already
established that authored data in this project stays greppable and hand-adjustable —
config ids are readable strings for exactly this reason. 40 KB gzipped is not worth
trading that away, and `prediction-artifacts` authors against these attributes by hand.

**The category mix is 50% red, 25% green, 25% wormy in both splits.**

```
  training split  200 =  100 red /  50 green /  50 wormy
  evaluation pool 1000 =  500 red / 250 green / 250 wormy
  20% harvest    ~200 = ~100 red / ~50 green / ~50 wormy
```

Green holds the same share in both splits, which is what the spec requires of it. Equal
shares also mean a ~200-apple harvest fills every cell of a three-by-two report with a
two-digit count, so an over-selective configuration is diagnosable from the counts rather
than only from the earnings total — the trap `harvest-scoring` names.

**The gap is specified as attribute intervals, not as prose.**

```
  attribute        training red        pool red          note
  hue (deg)        355-5               348-14            past the band, still red
  roundness        0.90-1.00           0.60-1.00
  gloss            0.60-0.80           0.20-0.95
  lighting         0.40-0.60           0.25-0.85

  worm visibility  training wormy 0.70-1.00    obvious
                   pool wormy     0.15-1.00    100 of 250 below 0.35, and those 100
                                               sit inside the training red band on
                                               every other attribute
```

Those 100 subtle worms on otherwise-perfect reds are the entire over-regularization
lesson: a model that learned "is it reddish" picks them and the farm loses money on
apples it should have trashed. The 300-odd pool reds outside the training band are the
entire under-regularization lesson. Both are now numbers a test can assert, which is why
the spec could require them at all.

**Green is drawn well away from the red band and never carries a worm.**
Hue 90-140 in both splits, and worm visibility fixed at zero. Green exists so students
see a category the model gets right in every configuration; giving it variance or worms
would add a second thing moving while they are trying to read the first.

**Image ids are derived from split and index; the seed is fixed and recorded.**
Ids follow the fixture's shape — `t-001` for training, `p-0001` for the pool — assigned
in generation order, which is itself a function of the seed. A hash of the attribute
vector would also be stable but is unreadable in a prediction artifact a human is
shaping by hand. The generator inlines a small seeded PRNG rather than taking a
dependency, and the seed lives in the generator's parameter file next to the intervals
above, so regeneration is a checked-in fact rather than a command someone has to remember
the arguments for.

**Atlases and manifest are committed, not built on deploy.**
Committing binary output to git is the cost. In exchange the Pages build stays a plain
static build with no native rasterizer in it, reviewers see the actual apples in the
diff, and deployment cannot produce images that differ from the ones the predictions were
shaped against. Determinism means a regeneration with unchanged parameters produces an
empty diff, so the binary churn is bounded by real parameter changes.

**The spec's distribution requirements become tests over the manifest.**
Counts, split disjointness, green's equal share, the red band containment, the presence
of out-of-band pool reds, and the 100 subtle worms are each a check that reads the
committed manifest. This is the point of recording attributes per image: without it those
requirements could only be asserted in prose and would rot the first time an interval was
nudged. The ten-image `test/fixtures/apple-pool.json` stays as the engine's test double —
it is faster and it exercises refusal paths the real pool must never hit.

## Risks / Trade-offs

- **Images and authored predictions can visibly disagree.** A student who sees a flawless
  red apple the model rejected, with nothing in the picture to explain it, learns that the
  tool is arbitrary. → The manifest's attributes are the only input `prediction-artifacts`
  is allowed to shape against, so every prediction has a visible cause in the image.
- **Stylized apples may read as too synthetic to feel like a real ML problem.** → Accepted
  deliberately: legibility beats realism when the worm has to be findable at thumbnail
  size, and the shell already requires fixture-backed results to be disclosed as such, so
  the honesty burden sits where it belongs.
- **Regeneration that reassigns ids would silently invalidate every prediction artifact.**
  → Ids derive from split and index under a fixed seed, and a test asserts the id set
  against the committed manifest, so a reshuffle fails in CI rather than in class.
- **A PNG encoder can embed nondeterministic metadata**, which would make "same seed,
  same bytes" false. → resvg writes no timestamp or producer chunk, and a test compares
  atlas checksums across two renders, turning a silent encoder change into a failed build.
- **3.15 MB leaves little headroom** under the 3.5 MB the tests assert. → Flat shading at
  a 96 px cell measures 2.29 MB, so the escape hatch is one number away. Anything that
  grows the pool substantially should re-measure before committing.
- **A renderer can fail silently on colour.** resvg paints a colour it cannot parse as
  black, and it rejects the space-separated `hsl()` form with a fractional hue — which
  produced a first atlas of almost entirely black apples while every markup-level test
  passed. → Colours are converted to hex in the generator rather than handed to the
  renderer as CSS, and `test/pool-drawing.test.ts` asserts against rendered pixels, not
  against the markup that requested them.
- **Committed binaries grow the repository over the project's life.** → Only parameter
  changes produce churn, and regenerating at build time stays available as a fallback if
  the history ever becomes a problem.

**The pool ships and is checked here; the app keeps reading the fixture.**
Pointing the running app at the real manifest in this change would break it. `runHarvest`
drives iteration from the artifact side and looks each image's truth up in the pool, and
the shipped ten-image prediction fixture uses pool ids (`p-001`) the real manifest does
not declare, so every image would refuse with `missing-ground-truth`. The manifest and
atlases are therefore delivered and verified by tests here, and `prediction-artifacts`
performs the switch when it generates predictions over the real image ids. The reader and
its refusals live engine-side in `src/pool/` so they are testable without the shell, which
also keeps `src/` free of a browser dependency as `vitest.config.ts` requires.

## Migration Plan

Nothing to preserve, and nothing user-visible changes in this change.

There is no `web/public` in this project: `vite.config.ts` serves and copies task data
from the `DATA_MOUNTS` table in `web/src/data/paths.ts`. The pool follows that pattern —
generated output lands in a repo-root `pools/apple-harvest/` directory mounted as
`data/pools`, the way `declarations/` already is. Two consequences: the dev middleware
sets `Content-Type: application/json` for every mounted file and must derive the type
from the extension before it can serve an atlas, and the build's `closeBundle` copy needs
to carry binary files, not just JSON.

`DATA_URLS.applePool` stays on `data/fixtures/apple-pool.json` until
`prediction-artifacts` switches it, per the decision above. Rollback of this change is
deleting `pools/` and its mount; the app is unaffected either way.

## Open Questions

Deferrable: none of these changes the specs, the approach, or the task breakdown.

- **Art direction within the attribute space** — silhouette shape, leaf and stem
  treatment, how the worm is drawn. The parameter vector is fixed; what it draws can be
  made prettier at any time by regenerating.
- **Whether a 2x atlas is wanted later** for the browse screen on high-density displays.
  It is a second output of the same generator run, decided when the screen exists.
- **Whether the pool eventually needs a held-out third split.** Nothing in the current two
  lessons asks for one, and adding it later is a generator parameter plus a manifest field.

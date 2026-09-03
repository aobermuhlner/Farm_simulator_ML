## Why

The apple task's two teaching points only appear if the data is engineered to produce
them. An under-regularized model becomes over-selective because the training reds were
uniform; an over-regularized model eats the wormy apples because it learned only
"is it reddish". Neither emerges by accident — the gap between the training split and
the evaluation pool has to be authored.

Why now: the engine, its two specs and a playable shell already exist, but they run on a
ten-image fixture. Every remaining change needs a real pool first — `prediction-artifacts`
has nothing to shape distributions over, `harvest-scoring` has no population to sample
20% of, and the browsable training split the project definition asks for has no images to
browse. The pool is the last unauthored input.

## What Changes

- **Images are generated, not collected.** Each apple is drawn procedurally from a
  parameter vector, then augmented, both deterministically from a seed. The repository
  ships a generator alongside its output rather than a photo dataset — a collected set
  cannot give per-attribute control, and control is the whole point here.
- **Declare the controllable attributes** the lessons depend on: hue, roundness, gloss,
  lighting, worm presence and worm *subtlety* as a graded attribute rather than a flag.
  These are the dials the distribution gap is authored with.
- **Author the split gap deliberately.** Training reds sit in a narrow band of hue,
  roundness and gloss; pool reds spread across it. Training worms are obvious; the pool
  includes subtle worms on otherwise-perfect reds. This is precisely what makes a
  low-regularization configuration over-selective and a high one worm-blind.
- **Fix the split sizes: 200 browsable training images and 1000 evaluation pool images.**
  That meets the ~1200-image budget `task-abstraction/design.md` costed its artifact
  against, and a ~20% harvest is then ~200 apples per run — enough that per-cell counts
  in the report are readable and that sampling spread has a chance of staying below the
  gap between configurations, which is the number `harvest-scoring` is waiting on.
- **Green is a stable baseline, not a lesson.** Green appears in both splits at the same
  modest share and is deliberately easy: well separated in hue, never wormy. Both
  teaching points are red-versus-wormy, so green earns its place by staying boring; the
  authored gap is spent entirely on red and wormy.
- **Define the pool manifest**: one static file declaring the pool id, its schema
  version, and per image its split, its true category, and where its pixels are.
  Ground truth lives here and nowhere else — the prediction artifact stores
  distributions only, which is what lets it be checked for storing no labels.
- **Define image delivery**: sprite atlases plus per-image coordinates, so a 1200-image
  pool costs a handful of requests on GitHub Pages instead of 1200.
- **Make the training split browsable** as the project definition requires. This change
  owes the shell a manifest and atlas a browsing screen can render from; the screen
  itself belongs to the shell.

## Capabilities

### New Capabilities
- `image-pool`: what an image pool declares — id, schema version, splits, and per image
  its true category and pixel location — how its two splits are required to differ, and
  how images and ground truth are delivered to a static client.

### Modified Capabilities

None. `task-contract` already carries the `pool` reference and already forbids labels in
the prediction artifact, so the manifest's shape, its version stamp and its coherence
with the task declaration are all requirements of `image-pool` itself.

`simulator-shell` was the one candidate, because it enumerates the causes it must surface
a refusal for and pool-side refusals were not among them. It needs no delta: its
governing clause requires the shell to present whatever the engine refuses with the cause
the engine named, and the shell renders any refusal generically rather than branching per
cause. Pool refusals reach the student through the existing path.

## Impact

- New spec `image-pool`. New generator script plus its committed output — atlases and
  manifest — served as static data.
- The manifest and atlases ship and are verified here, but the running app keeps reading
  `test/fixtures/apple-pool.json`. The engine drives a harvest from the prediction side
  and looks truth up per image, and the ten-image prediction fixture names pool ids the
  real manifest does not, so switching before real predictions exist would refuse every
  image. `prediction-artifacts` performs the switch; the fixture stays afterwards as a
  test double.
- A new served mount for the pool directory in `web/src/data/paths.ts`, and the dev
  middleware in `vite.config.ts` learns to serve a non-JSON file.
- Unblocks `prediction-artifacts`, which needs the frozen image id list and per-image
  attributes to shape distributions against, and `harvest-scoring`, which needs the pool
  size for its sample and variance question.
- No change to the engine's configuration, policy or scoring code.
- Repository size is a live constraint but not expected to bind: 1200 stylized apples,
  atlased, should stay well under a few megabytes. Because generation is deterministic,
  regenerating at build time instead of committing images remains available if it does —
  that trade-off is design's to make.

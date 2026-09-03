# Design: ship real prediction artifacts, trained

## Context

See `proposal.md` — Why. What matters for the approach:

- The reading contract already exists. `src/task/artifact.ts` resolves a configuration id
  to `{ history, predictions: { training, pool } }`, and `src/task/configId.ts` builds the
  id (`blocks3-channels16-regularization1-dropout0`). `task-contract` is not modified by
  this change, so those shapes are fixed input to the design, not choices.
- The pool exists and is committed: `pools/apple-harvest/manifest.json` (338 KB, 1200
  entries, ground truth and drawing attributes per image) plus five 2048px PNG atlases.
  An image's pixels are a 128px cell resolved from `atlas`, `cell` and `grid` — the rule
  `src/pool/index.ts::regionFor` and `tools/pool/manifest.ts::regionOf` both already apply.
- The architecture is specified, not inferred: `openspec/specs/model-architecture/spec.md`
  fixes the block form, and `src/task/cnn.ts` holds the halving and channel-doubling
  arithmetic that `validate.ts` refuses against and `diagram.ts` draws from.
- The training workspace is already scaffolded (`training/`: uv project, CPython 3.12,
  CPU-only torch, measured at well under a minute per 40-epoch run — though that table
  was measured across depths at a fixed width, and this change varies width instead).
  What it does not yet have is a trainer, an encoding to write, or a gate that decides
  what is shippable.
- The app still reads `test/fixtures/apple-predictions.json` and `apple-pool.json`, wired
  in `web/src/data/paths.ts` and `web/src/data/load.ts`.

## Goals / Non-Goals

**Goals:**

- One on-disk encoding, versioned and pool-bound, that a browser can resolve one
  configuration from in a bounded number of requests.
- A producing pipeline whose output a reviewer can repeat from the artifact alone.
- A single place where the Python trainer and the TypeScript app are forced to agree
  about the architecture, so the two cannot drift silently.
- The shipped apple task browsing and scoring one pool.

**Non-Goals:**

- Anything the student sees while a configuration "trains" — the epoch replay and the
  loss curve are `training-simulation`.
- The remaining 105 configurations. The layout must not make that run a redesign, but it
  is not this change.
- Model weights in the browser. Nothing ships a checkpoint; inference is precomputed.
- A CI job that trains. Production is run by hand; what CI checks is the committed
  artifact.

## Decisions

### Coverage is the set the opening lesson can select

`blocks` = 2, `channels` ∈ {8, 16, 32}, `regularization` = 1, `dropout` = 0 — three
configurations, and the three a student can reach on day one. Depth and the two
regularization knobs are shown but locked until the farm can afford them, so the first
lesson is width alone on the smallest stack: capacity bought with patterns per block,
with nothing else to hide behind. `blocks` moves its declared default from 3 to 2, which
is what keeps the requirement "the shipped artifact covers the identifier the task's
declared knob defaults resolve to" true.

A locked knob sits at its declared default and still contributes to the identifier, so
ids stay `blocks2-channels8-regularization1-dropout0` — full knob set, in declared order,
exactly as `configId.ts` composes them. Unlocking a knob later therefore extends coverage
with new ids rather than reinterpreting the ones already shipped, and the artifacts
trained here stay valid when the grid grows.

Locking itself is not built here. The declaration keeps its full value lists — per the
game design, what a student may turn is a function of progress, and gating must stay
declared data rather than a narrowed list that loses what the value even was. Until
`knob-availability` lands, the configuration screen still offers all 108 combinations and
105 of them refuse as untrained, which is the refusal this change specifies rather than a
gap in it.

*Alternative considered.* Narrowing `knobs[].values` to `blocks: [2]` now would make every
offered configuration trained immediately and needs no new mechanism. It was rejected
because it deletes the thing the money loop sells: a student cannot see that a deeper
stack exists to be earned, and re-adding values later silently changes what the knob
means.

### File layout: one index, one file per configuration

Under the path the declaration already names (`artifacts/apple-harvest/predictions/`):

```
index.json                                          coverage, binding, provenance, encoding
blocks2-channels8-regularization1-dropout0.json     history + predictions for that id
blocks2-channels16-regularization1-dropout0.json
blocks2-channels32-regularization1-dropout0.json
```

Resolving a configuration is two requests — the index, then that configuration's file —
independent of the pool's 1200 images and of how many configurations are covered. A
configuration file is ~40 KB at the encoding below; the index is a few KB at three
configurations and stays small at 108 because it carries no predictions.

*Alternatives.* One file holding every configuration (today's fixture shape) transfers
105 configurations a student did not choose, and at the full grid is several megabytes.
One file per image is bounded in bytes but unbounded in requests. Both are refused by
`prediction-artifacts` — "One configuration is retrievable without the others".

The file name is the configuration id plus `.json`. Ids can contain a dot
(`dropout0.2`), which is a legal path segment, so no escaping rule is introduced — a
second identity for a configuration is exactly the thing `configId.ts` avoids. The
producer refuses an id containing a path separator or a leading dot rather than writing
it, since the id is composed from declaration-controlled values.

Each configuration file repeats `schemaVersion`, `taskId` and its own `configurationId`.
A file fetched on its own is then self-identifying, and an index that has drifted from
the files beside it refuses instead of scoring one configuration's predictions under
another's name.

### Probabilities: three decimal places, JSON numbers, renormalized

`encoding: { "decimals": 3, "sumTolerance": 0.0015 }` in the index; each image is a
JSON array of three numbers in the declared category order, keyed by image id — the
`SplitPredictions` shape the contract already has.

Rounding three components to 3 dp can move the sum by at most 3 × 0.0005 = 0.0015, which
is the declared tolerance and satisfies "the declared precision can meet the declared
tolerance". The producer goes further and repairs the residual on the largest component
(largest-remainder), so shipped vectors sum to exactly 1.000 and the tolerance is
headroom rather than the normal case.

*Alternatives.* uint8 quantization in base64 is ~4× smaller and completely opaque: it
cannot be grepped for an image id, cannot be diffed when a configuration is retrained,
and cannot be read by the person deciding whether a lesson lands. At 40 KB per
configuration the saving buys nothing. Full float64 makes every retrain a large diff of
noise digits, and 3 dp is already finer than any decision the policy or the scoring makes.

### Validation roles live in the manifest, drawn from their own stream

`tools/pool/manifest.ts` gains, per training image, `"role": "fitted" | "heldOut"`, and
`splits.training.roles: { "fitted": { "count": 160 }, "heldOut": { "count": 40 } }`.
Evaluation-pool entries carry no role.

Assignment is stratified by category — red 20, green 10, wormy 10 held out of 100/50/50 —
which is what makes "every category appears in both roles" structural rather than lucky,
and keeps the validation loss measured over the same categories the fitted images cover.

The assignment draws from a **separate** `createRandom` instance seeded
`ROLE_SEED = SEED ^ 0x726f6c65`, run after sampling over the per-category training id
lists in manifest order. This is the load-bearing part: drawing from the existing stream
would shift every subsequent attribute draw, which renumbers nothing but redraws
everything — new pixels under the same ids, and every prediction artifact keyed to those
ids silently wrong. With its own stream, regenerating the pool reproduces the existing
1200 images byte-identically and adds fields. Role assignment is then a pure function of
the seed and the id lists, and the id lists are themselves a pure function of the seed,
which is what "the same seed reproduces the roles" and "regeneration does not reassign
roles" reduce to.

20% held out is a compromise: 40 images is enough for a validation loss that moves
legibly per epoch, and 160 fitted images is what the cost table in `training/README.md`
was measured against.

**Measured, after the first three runs:** the held-out loss tracks the fitted loss almost
exactly, and sits slightly *below* it at every width (0.408 against 0.410 at channels 8,
0.140 against 0.149 at 16, 0.024 against 0.032 at 32). That is structural rather than
surprising: the held-out 40 are drawn from the same authored band as the fitted 160, so
they are unseen images of an entirely seen distribution. The split gap this pool was built
around is between the training split and the evaluation pool, and it is there that the
lesson shows — 100% on training worms against 14% on the pool's subtle ones.

So the roles buy an honest validation loss and a curve that says *how well the model fit*,
and they do not buy a workshop-visible generalization gap. Generalization is the harvest
report's story, per category and action. `training-simulation` inherits that: whatever it
says about the curves it draws must not promise a gap these curves do not contain.

`src/pool/index.ts` reads the roles, refuses a role on an evaluation image and a training
image without one, and exposes them as a `roles` lookup beside `order` — deliberately not
as extra keys *inside* `order`, which is keyed by split and whose keys a reader must be
able to enumerate as the two splits. `POOL_SPLITS` stays `['training', 'pool']`, and a
manifest declaring a third split is now refused naming it, which nothing checked before. It also begins exposing the manifest's `seed`, which
it currently reads past, because the artifact binding below needs it.

### The trainer reads the declaration; the architecture is checked against `cnn.ts`

The trainer takes knob values, categories, and the 128px input size from
`declarations/apple-harvest.json` rather than restating them, so a declaration change
cannot leave a trained artifact describing a model the app no longer offers.

The block arithmetic, however, is genuinely duplicated: `src/task/cnn.ts` in TypeScript,
`torch.nn` in Python. There is no shared runtime to put it in, and a code generator or a
Node subprocess in the training loop buys agreement at the cost of a build step nobody
would run. Instead the duplication is made checkable: each configuration's provenance
records the architecture the run actually built —

```json
"architecture": { "blocks": 2, "channels": [16, 32], "spatial": [64, 32], "parameters": 16755 }
```

— and a Vitest case recomputes `blockChannels`/`blockSizes` from the declaration and
asserts equality against the committed artifact. Drift then fails a test naming the
configuration, instead of shipping a model whose diagram lies about it.

### Knob semantics and every unrecorded choice, recorded

`regularization` (slider 0–3) is weight decay: `{0: 0.0, 1: 1e-4, 2: 1e-3, 3: 1e-2}`.
`dropout` is the head's dropout probability, applied after global average pooling, which
is where `model-architecture` says the apple task's dropout acts.

Everything else the run depends on is fixed and written into provenance rather than left
in an operator's head: optimizer and learning rate (Adam, 1e-3), batch size 32, 40
epochs, cross-entropy loss, no augmentation, pixels scaled to [0,1] by a constant (never
by statistics derived from the data, which would make the run depend on the split), the
run seed, and the pipeline revision — the git commit the trainer ran at, plus whether the
tree was dirty.

The two regularization knobs stay two knobs, closing `task-abstraction/design.md`'s open
question — settled now even though both are locked for the opening lesson, because the
mapping above is what a run records and an artifact trained against one shape cannot be
reinterpreted under another. They act at different places — one in the optimizer's update, one as a stage in
the architecture — and `model-architecture` requires a dropout knob to have a stage to
act in. A single composite slider would name two mechanisms with one word at exactly the
moment the lesson is about telling them apart.

### The whole pool is read before anything is trained

The trainer resolves all 1200 regions up front — atlas present, `cell < capacity`, region
inside the atlas bounds — and refuses naming the image id before a single epoch runs.
This is how "no artifact file is written from a partially readable pool" is guaranteed by
construction rather than by an exception handler that has to remember to delete a
half-written file. Decoded cells are cached in one array for the run, which also removes
per-epoch PNG decoding.

### Shaping is a separate pass or it does not exist

The trainer has no shaping parameters at all — no temperature, no per-category nudge, no
"make the curve look right" constant. If a lesson does not land, the first response is to
change something recorded (epochs, the weight-decay mapping, the pool) and retrain.

If shaping is ever genuinely needed, it is a distinct pass over a written artifact that
records `shaping: [{ "step": "<name>", "configurations": [...] }]` in that artifact's
provenance, in the same operation that alters values. Because only that pass can write
the field and only that pass can alter values, "hidden shaping" has no code path. The
first run ships `shaping: []`, and the ship gate treats an absent record as the claim
that the figures are as measured.

### The ship gate is a test over the committed artifact

`prediction-artifacts` says things are "not shippable". That is made real by a Vitest
suite over the committed artifact and the committed manifest, run in the normal test
command: pool binding matches; coverage is non-empty and contains the identifier the
declared knob defaults resolve to; every covered configuration has exactly one
distribution for each of the 1200 manifest images in the right split, and a history whose
epochs are contiguous; every vector decodes to a distribution within the declared
tolerance; no entry carries a category, label or action field; every configuration has
provenance and a clean-tree revision; and the recorded architecture matches `cnn.ts`.

A dirty-tree run is refused at this gate but not by the trainer, so authoring iterations
stay cheap and only the committed result has to be reproducible from history.

### The app reads the artifact index, and one pool

`DATA_MOUNTS` gains `'data/artifacts': 'artifacts'`. The predictions URL stops being a
constant and is derived from the loaded declaration's `predictions` field joined to that
mount — the declaration already names the path, and a second copy in `paths.ts` is a
mismatch waiting to happen. Order permits it: `loadTask` already fetches the declaration
first.

`TaskDataPaths` collapses `pool` and `generatedPool` into one `pool: PoolPaths`. Two
entries can point at different data; one cannot, which is "the shipped task scores the
pool it shows" enforced by the type rather than by care. Truth then comes from
`readPool()` over the real manifest instead of `readTruth()` over the fixture, so the
manifest's 338 KB moves from a lazy browser fetch to the task load — accepted, because
the alternative is a second file restating ground truth, and ground truth having two
homes is the one thing the pool reader exists to prevent. The training browser's "not the
images your run scored" notice is deleted with the condition that motivated it.

Coverage is read from the index before any file is fetched. A valid configuration outside
it refuses with a distinct code — `untrained-configuration`, naming the identifier and
reporting that no model was trained for it — separate from the invalid-configuration
path, and with no fallback, nearest-neighbour or interpolation anywhere on it. The
fixtures stay exactly where they are, as fixtures for the tests that exercise refusals.

## Risks / Trade-offs

- **Until `knob-availability` lands, 105 of the 108 offered combinations refuse.** → The
  refusal is honest and distinguishable, and the default configuration is covered so the
  first thing a student sees always resolves. It is still a poor interim: the intended
  end state is that the three trained configurations are the three a student can select,
  which is a gating change and not another two hours of training. Whichever lands first,
  the layout above needs no change for it.
- **Width alone may be a thin first lesson.** With depth and both regularization knobs
  locked, `channels` is the only thing a student turns, and if 8 through 32 at two blocks
  all behave much the same the opening lesson has nothing in it. → This is precisely what
  the review step in step 2 answers, and it answers it before any screen is built on top.
  If the three curves do not separate, the response is a recorded change — more epochs, a
  wider spread of permitted widths, or unlocking regularization earlier — decided on
  measured curves rather than on the assumption that they will separate.
- **The Python and TypeScript architectures can drift.** → The recorded `architecture`
  block and the test that checks it against `cnn.ts` turn a silent divergence into a
  named test failure. It checks shape, not weights, which is the part the diagram claims.
- **Bit-exact reruns are not guaranteed across machines.** CPU kernels, thread counts and
  torch versions all move the last digits. → Seeds, versions and hyperparameters are
  recorded and the environment is pinned by `uv.lock`, which is what the requirement
  actually asks for: a reviewer needs no input the artifact does not record. Curves will
  reproduce; the third decimal may not.
- **Regenerating the pool to add roles could disturb the committed images.** → The
  separate random stream is designed so it cannot, and the migration step verifies it by
  diffing the regenerated atlases and manifest against the committed ones: only the new
  role fields may appear.
- **The lessons may not appear in the measured curves.** Width alone at 40 epochs may not
  overfit the authored training band visibly. → That is the point of training before
  writing any more of the game: the review step reports what the curves do. If they do
  not teach, the response is a recorded change (epochs, the weight-decay mapping, the
  authored band) or a recorded shaping step — not a quiet constant.
- **Task load grows by ~338 KB of manifest.** → It is fetched once, compresses well, and
  the alternative duplicates ground truth. Revisit only if first paint suffers.

## Migration Plan

1. Add roles to `tools/pool/params.ts` and `manifest.ts`; regenerate; confirm the atlases
   and every existing manifest field are unchanged. Teach `src/pool/index.ts` the roles
   and the seed.
2. Move the `blocks` default to 2. Write the trainer; run the three configurations;
   re-measure `training/README.md`'s cost table across widths rather than depths; review
   the curves and the resulting distributions against the intended lessons before
   anything is committed.
3. Commit the artifact; add the ship-gate suite.
4. Switch `paths.ts` and `load.ts` to the generated pool and the artifact index; drop the
   training browser's mismatch notice.

Rollback is step 4 alone: the fixtures remain in the repo and the fixture-backed paths are
one revert away. Steps 1–3 add files and fields and break nothing that reads today's
manifest.

## Open Questions

- Whether the full-grid run keeps per-configuration review at 108 curves, or reviews a
  sampled subset with the rest checked by assertion. It changes neither the encoding nor
  the pipeline, so it can be answered when that run is scheduled.
- Whether artifacts eventually need a content hash for cache-busting on Pages. The
  schema version covers the incompatible case; the compatible retrain is a stale-cache
  question that only shows up once the site is actually deployed and updated.

## Context

See `proposal.md` — Why. Requirements are in `specs/model-architecture/spec.md`,
`specs/network-diagram/spec.md` and `specs/task-contract/spec.md`; this document covers
only how they are met.

Five facts about the current code decide most of what follows.

`pools/apple-harvest/manifest.json` declares `cellSize: 128`, so the images are 128x128
and that is the input resolution this architecture is designed against. The example stack
this change came from assumed a 256px input (its first block emitted 128x128x16); at 128px
the same four blocks run 128 -> 64 -> 32 -> 16 -> 8. Nothing in the design depends on the
number 128 except a declared field, so a later pool regeneration at 256 is a one-line
declaration change plus new artifacts.

`DIAGRAM_KINDS` in `src/task/types.ts` is already a one-element `as const` union and
`DiagramDeclaration` is already a type alias positioned to become a real union, so
`checkDiagram` in `src/task/validate.ts` and `resolveArchitecture` in
`src/task/diagram.ts` are the two places that gain a dispatch. The extension point was
built; this is the first use of it.

`web/src/no-task-specific-code.test.tsx` fails any screen file naming a declared knob id.
The existing `NetworkDiagram.tsx` docblock records the resulting trap: one apple knob id
is also a CSS sizing property, so an inline style object setting it fails that test. That
trap survives into this change unless the knob ids move.

No prediction artifacts exist — `prediction-artifacts` is still an unauthored stub — so
knob ids, knob values and therefore every configuration identifier can change at zero
cost right now, and at very high cost after that change lands.

`resolveArchitecture` already takes `(declaration, values)` and returns a plain shape, and
already returns nothing for a configuration that does not resolve. It has no dependency on
the configuration screen. The modularity this change asks for is mostly a matter of not
losing that property while adding a second kind.

## Goals / Non-Goals

**Goals:**
- An architecture that can actually learn from 128px images, so that the regularization
  knobs act on the failure the lesson names.
- Both families first-class: `cnn` added, `feedforward` kept specified, tested and
  separately mountable rather than left as vestigial code.
- Every abstraction in the convolutional drawing disclosed, and everything that can be
  stated exactly stated exactly — which for a CNN is the spatial sizes, the opposite of
  the feedforward case.
- The block count validated against the input resolution at load, so an unbuildable stack
  is a refused declaration rather than a drawing of a model that cannot exist.

**Non-Goals:**
- Actually training the models. Weights and per-configuration outputs remain
  `prediction-artifacts`' business; this change decides the architecture those artifacts
  are generated against, not how they are generated.
- Regenerating the pool at a higher resolution. Recorded as a possible follow-up, priced
  below, and deliberately not done here.
- Batch normalization, residual connections, augmentation, or any other modern addition.
  Each is a further teaching claim and a further knob; the stack stays the plain textbook
  form the lesson can explain.
- Drawing activations, feature maps or anything that changes during training. The diagram
  is of an architecture, as it was before.
- Changing the pool, the payoffs, the policy, or the report.

## Decisions

**The architecture is declared against the pool's 128px input, with the resolution as a
declared and cross-checked field.**
`inputSize` lives in the diagram declaration and `task-contract` requires it to match the
pool manifest's cell size. The alternative — deriving it from the manifest and declaring
nothing — is tempting because it cannot disagree, but the manifest loads asynchronously in
the browser while the declaration is validated at load, so deriving it would move a
structural check from load time into render time. Declaring it and cross-checking gets both:
a refusal at load for a malformed value, and a refusal at pool load for a value that
disagrees with the images. This is the same shape as the existing `poolId` and
`schemaVersion` cross-checks in `image-pool`.

**The knobs keep their roles and lose their names: `depth`/`width` become `blocks`/`channels`.**
`depth: 2 | 3 | 4` blocks, `channels: 8 | 16 | 32` base channels doubling per block. Three
reasons to rename rather than reinterpret in place. A knob id called `width` on a
convolutional task is actively misleading in the artifact filenames a future author will
hand-edit, which is the whole reason `configId.ts` uses full knob ids. `width` is also the
CSS collision the existing component docblock warns about, and renaming removes a live trap
instead of documenting it a second time. And configuration ids change regardless — the
permitted values change, so `depth8` disappears either way — so the rename is free exactly
now.

The resulting capacity span, at 128px input:

```
             blocks=2      blocks=3      blocks=4      final spatial
  channels=8    ~4.3k        ~18.2k        ~73.6k       32² / 16² /  8²
  channels=16  ~16.7k        ~72.1k       ~293.5k
  channels=32  ~65.6k       ~287.0k        ~1.17M

  compare: current fully-connected model at depth 4, width 64 = ~3.15M
           of which 3.15M is the first layer alone
```

~270x from the smallest configuration to the largest, monotone in both knobs, and the
largest is still smaller than the model being replaced. That is the range the
overfitting lesson has to work in.

**The head is `GAP -> Dropout -> Dense(categories) -> Softmax`.**
This is a correction to what I floated while exploring, which added a hidden dense layer
so the dropout knob would have a classic placement. Dropout applied to the pooled
channel vector is itself a standard and honest placement: it forces the classifier not to
rely on any single channel detector, which is a teachable claim in its own right and a
better fit for the app's copy than a hidden layer that exists only to host a knob. It also
keeps the stack the plain form it was proposed as. The hidden-layer variant remains
available if `prediction-artifacts` finds the dropout knob has too little visible effect —
that is a numbers question, and it can only be answered once outputs are generated.

The head keeps the invariant the archived `network-diagram` design established: the output
count is the declared category count, never a separately declared number, so nothing can
disagree with `categories`.

**`ResolvedArchitecture` becomes a discriminated union, and stays engine-side.**
`src/task/diagram.ts` gains `ResolvedFeedforward` and `ResolvedCnn`, both carrying `kind`,
and `resolveArchitecture` returns `ResolvedArchitecture | undefined` as before. The
resolved CNN carries the per-block channel counts and the per-block spatial sizes already
computed — the component receives arithmetic-free data, as `layersOf` does today. The
alternative, giving the component the input size and the block count and letting it halve,
puts a derivation the validator guarantees into the one place that cannot report a failure.

**The drawing splits into two leaves and a dispatcher.**

```
  web/src/components/architecture/
    ArchitectureDiagram.tsx   dispatch on architecture.kind; nothing else
    FeedforwardDiagram.tsx    ResolvedFeedforward -> circles + full connections
    CnnDiagram.tsx            ResolvedCnn -> shrinking, deepening volumes
```

Each leaf takes a resolved architecture of its own kind and nothing else — no declaration,
no knob values, no screen state — which is what makes "mountable on another page" a
property of the code rather than an intention. Keeping one component with a branch inside
it was rejected because a page wanting only the plain network would then carry the
convolutional drawing with it, and because adding a third family later would mean editing
the file that draws the first two. `ConfigureTask` imports the dispatcher and is otherwise
unchanged.

**In the convolutional drawing, spatial size is stated exactly and drawn compressively;
channel depth is the stand-in.**
The sizes 128, 64, 32, 16, 8 are exact and appear as text. Drawing them to linear scale
would make the last volume a sixteenth of the first — around four pixels beside a
sixty-four pixel input — so the drawn box size uses a compressive scale that preserves
strict monotonicity without preserving ratio. That is why the spec requires the stated
size to be exact and requires only that each drawn volume be *smaller* than the one before
it. Channel depth is the declared stand-in, seeded by `channelsShown` and incremented per
block, and is disclosed as an abstraction exactly as `unitsShown` is today.

**Locality is drawn as one receptive-field patch, not as connections.**
Between adjacent volumes the drawing shows a small square region on the earlier volume
with lines converging to a single position on the later one — the textbook portrayal. Full
connectivity between volumes is the one thing the drawing must not do: it would state that
every pixel feeds every next-layer position, which is precisely the property the
convolutional architecture gives up and precisely why it works on images. That is a
requirement rather than a style choice, so it is in the spec.

## Risks / Trade-offs

**Global average pooling is itself a strong regularizer, which could flatten the lesson's
contrast.** The head has a few hundred parameters, so "memorises one perfect red apple"
now has to come from the convolutional stack rather than from a fat classifier. →
Mitigated by the ~270x capacity span above, and bounded by the fact that outputs are
generated and shaped per configuration. But it is a real dependency: `prediction-artifacts`
must verify that the smallest and largest configurations actually behave differently
enough to teach, and report back here if they do not. The hidden-layer head variant is the
recorded fallback.

**Four blocks on a 128px input ends at 8x8, which is a shallow stack by modern standards.**
→ Accepted: this is a teaching model, not a benchmark, and three apple categories
distinguished by colour and a surface defect do not need more. If it proves too coarse, the
fix is regenerating the pool at 256px, which touches `image-pool` and the atlas tool
(atlases go from 2048² to 4096², or multiply in number) and changes one declared field
here. Priced, not chosen.

**The depth knob now has a hard ceiling, which is a new class of declaration error.** A
future author raising `blocks` to 5 or 6 without noticing the resolution silently gets an
architecture with a sub-pixel feature map. → That is exactly why the resolution bound is a
load-time refusal that names the resolution, the count and the knob, rather than a comment.

**Re-scoping requirements in `network-diagram` from "all diagrams" to "fully-connected
diagrams" risks losing detail at archive time.** → Every re-scoped requirement is carried
in the delta as a full MODIFIED block copied from the main spec, not as a partial edit.

**The knob rename invalidates every configuration identifier for the apple task.** → No
artifacts are keyed by them yet, and nothing persists a student's configuration. This risk
is real only if this change lands after `prediction-artifacts`, so it should land before.

## Migration Plan

No data migration: nothing is keyed by the identifiers that change. Order matters only
against `prediction-artifacts`, which must be authored after this change so it generates
against the convolutional architecture and the new knob values. `harvest-scoring` and
`training-simulation` are unaffected — neither reads the architecture.

Rollback is reverting the commit; there is no persisted state to unwind.

## Open Questions

- The exact compressive scale for the drawn volume sizes, and whether the receptive-field
  patch is drawn on every adjacent pair or once as an exemplar. Both are visual tuning
  against a real drawing; neither changes a requirement or a task.
- Whether the `regularization` slider maps to weight decay, an L2 penalty coefficient, or
  a label over both. It has to be settled before outputs are generated, but it is
  `prediction-artifacts`' question and this change does not constrain the answer.
- Whether the later "typical NN" task is genuinely tabular. It decides whether the
  fully-connected declaration ever needs a non-image input description, and it can be
  answered when that task is designed — the family stays supported either way.

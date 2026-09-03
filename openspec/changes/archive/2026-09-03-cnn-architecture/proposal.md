# Convolutional architecture for the apple harvest task

## Why

The apple task currently declares a fully-connected network over a 128px image: `depth`
selects 2, 4 or 8 hidden layers and `width` selects 16, 64 or 256 units per layer. On a
128x128x3 input that is 49,152 input features, so the first hidden layer alone carries
about 3.1M weights at `width: 64` — and the architecture has no notion of locality, so an
apple two pixels to the left is a different input vector.

That breaks the lesson, not just the engineering. A student turning `regularization` on
this model is regularizing the wrong failure: the network's problem is that it cannot see
shape or texture *anywhere in the frame*, not that it has too much freedom. The teaching
claim the whole app rests on — "too little restraint and it memorises the training apples"
— is not the claim this architecture actually demonstrates.

The sign is already in the declaration: `diagram.inputsShown` is `3`, standing in for
49,152 real inputs. The drawing is working that hard because the model underneath is
wrong for image data.

A convolutional stack is the honest architecture for this task, and the timing is free:
no prediction artifacts exist yet, so changing what the knobs mean costs nothing today
and would invalidate every precomputed configuration later.

## What Changes

- **BREAKING** The apple task declares a convolutional architecture instead of a
  fully-connected one: repeated `Conv 3x3 -> ReLU -> Conv 3x3 -> ReLU -> MaxPool 2x2`
  blocks with the channel count doubling per block, then global average pooling and a
  dense classifier head over the declared categories.
- **BREAKING** The apple task's `depth` and `width` knobs are re-interpreted. `depth`
  becomes the number of convolutional blocks and `width` becomes the base channel count
  that doubles per block. Their permitted values change, so every configuration
  identifier for the apple task changes. This is safe now only because
  `prediction-artifacts` has not been authored.
- A task's architecture declaration becomes discriminated by kind. `feedforward` remains
  fully supported and specified; `cnn` is added alongside it. A task declares which family
  it belongs to and what its knobs mean within that family.
- The number of blocks is bounded by the input resolution: a stack that would pool the
  feature map below 1x1 is refused at load, naming the input size and the block count.
  Depth is no longer an unbounded knob, which is itself a teaching point.
- The architecture drawing gains a convolutional portrayal — stacked feature-map volumes
  that shrink spatially and grow in channel depth. Fully-connected lines between
  convolutional blocks are not drawn, because local receptive fields and weight sharing
  are the point of the architecture rather than an incidental detail of it.
- The abstraction inverts for the convolutional kind. Spatial sizes are small enough to
  state exactly; the channel depth becomes the declared stand-in. In the feedforward kind
  the layer count is exact and the width is the stand-in. Each kind discloses its own
  abstraction rather than inheriting the other's.
- The feedforward architecture — its declaration, its resolution and its drawing — is kept
  as an independently mountable module rather than something reachable only from the
  configuration screen, so a later page can present a plain network without depending on
  the apple task or on the screen it currently lives in.
- The apple task's knob help copy and teaching copy are rewritten to describe
  convolutional capacity, since the current copy explains hidden layers and neurons per
  layer.

## Capabilities

### New Capabilities
- `model-architecture`: what architecture family a task declares, what its knobs mean
  within that family, the constraints that make a declared architecture expressible at the
  task's input resolution, and the requirement that each family stays usable independently
  of any one screen.

### Modified Capabilities
- `network-diagram`: requirements currently stated for all diagrams describe a
  fully-connected drawing — full connection between adjacent layers, and unit counts as
  the declared stand-in. These become scoped to the feedforward kind, and the
  convolutional kind gains its own drawing and disclosure requirements.
- `task-contract`: the diagram declaration is currently specified as a single shape naming
  a layers knob, a units knob, a per-value drawn count and an input count. It becomes
  discriminated by kind, with per-kind required fields and per-kind validation, including
  the resolution bound on block count.

## Impact

- `declarations/apple-harvest.json` — architecture block, `depth` and `width` values,
  knob help copy, teaching copy.
- `src/task/types.ts` — `DIAGRAM_KINDS` gains `cnn`; `DiagramDeclaration` becomes a real
  discriminated union; `ResolvedArchitecture` becomes per-kind.
- `src/task/validate.ts` — `checkDiagram` dispatches on kind and gains the resolution bound.
- `src/task/diagram.ts` — `resolveArchitecture` returns a discriminated result.
- `web/src/components/NetworkDiagram.tsx` — dispatches on kind; the feedforward drawing is
  separated from the dispatcher so either can be mounted alone.
- `pools/apple-harvest/manifest.json` is read, not changed: its `cellSize` of 128 is the
  input resolution the architecture is declared against.
- Downstream, `prediction-artifacts` must generate against the convolutional architecture
  and the new knob values. It is still a stub, so this change removes work rather than
  adding it.

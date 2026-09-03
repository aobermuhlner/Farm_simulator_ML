## 1. Declaration shapes and validation

- [x] 1.1 In `src/task/types.ts` add `'cnn'` to `DIAGRAM_KINDS`, add a `CnnDiagram`
      interface (`kind`, `blocksKnob`, `channelsKnob`, `inputSize`, `channelsShown`) and
      make `DiagramDeclaration` a real union of it and `FeedforwardDiagram`; verify
      `npm run typecheck` passes and that reading a `cnn`-only field off a
      `DiagramDeclaration` without narrowing is a type error.
- [x] 1.2 Split `checkDiagram` in `src/task/validate.ts` into a kind dispatch: an unknown
      or missing kind is refused naming the kind and the supported kinds, and the existing
      feedforward checks move into a feedforward branch unchanged; verify
      `test/diagram-declaration.test.ts` and `test/validate-declaration.test.ts` still
      pass untouched.
- [x] 1.3 Add the `cnn` validation branch to `src/task/validate.ts`: required fields
      present, both named knobs declared by the task, every value of the blocks knob a
      whole number at least 1, every value of the channels knob mapped to a positive whole
      drawn depth, `inputSize` a positive whole number, and any permitted block count that
      would pool `inputSize` below one spatial position refused naming the resolution, the
      count and the knob — with no field of the feedforward kind required of it; verify new
      cases in `test/diagram-declaration.test.ts` covering each refusal scenario in
      `specs/task-contract/spec.md`.
- [x] 1.4 Cross-check the declared input resolution against the pool in `readPool`
      (`src/pool/index.ts`): a `cnn` task whose `diagram.inputSize` differs from its
      atlases' `cellSize` is refused naming both sizes, and a matching one is accepted;
      verify new cases in `test/pool-reader.test.ts`.

## 2. Architecture resolution

- [x] 2.1 In `src/task/diagram.ts` make `ResolvedArchitecture` a union of
      `ResolvedFeedforward` (today's shape plus `kind`) and `ResolvedCnn`, and dispatch
      `resolveArchitecture` on the declared kind; `layersOf` becomes
      `ResolvedFeedforward`-only; verify `test/diagram-resolve.test.ts` still passes with
      only the feedforward task retargeting.
- [x] 2.2 Resolve a `cnn` declaration into arithmetic-free data: per block the true channel
      count (base doubling per block), the exact spatial size derived from `inputSize` and
      the block's position, and the drawn depth seeded from `channelsShown`; plus the head
      (global average pooling, a dropout stage, and a dense classifier whose output count
      is `declaration.categories.length`), the declared channels value and both knob
      labels; return `undefined` for values the knobs do not permit, as the feedforward
      path does; verify new cases in `test/diagram-resolve.test.ts` asserting channel
      doubling, halving spatial sizes at every permitted block count, outputs tracking the
      declared categories, and refusal of an unpermitted value.

## 3. The apple task's declaration

- [x] 3.1 Rewrite the apple task's capacity knobs in `declarations/apple-harvest.json`:
      `depth` becomes `blocks` (values 2, 3, 4; default 3) and `width` becomes `channels`
      (values 8, 16, 32; default 16), each with a label and help copy describing
      convolutional capacity rather than hidden layers and neurons, and the diagram block
      becomes `kind: "cnn"` with `inputSize: 128` and a `channelsShown` entry per channel
      value; verify the declaration validates and `test/apple-harvest.declaration.test.ts`
      asserts the new knob ids, values and diagram kind.
- [x] 3.2 Rewrite the apple task's `teaching.theory` copy so it describes what the
      convolutional stack and its head can memorise, since the current copy explains hidden
      layers and neurons per layer; verify the declaration test asserts the copy names
      neither hidden layers nor neurons per layer.
- [x] 3.3 Re-key the shipped prediction fixture `test/fixtures/apple-predictions.json` to
      the configuration identifiers the new knob ids and values produce, and update the
      `OVER_REGULARIZED` and `OVER_SELECTIVE` constants in `test/helpers/apple.ts` to the
      new extremes; verify `test/fixture-coverage.test.ts`, `test/config-identity.test.ts`,
      `test/artifact-contract.test.ts` and `test/scoring.test.ts` pass against the new ids.

## 4. Drawing

- [x] 4.1 Move `web/src/components/NetworkDiagram.tsx` to
      `web/src/components/architecture/FeedforwardDiagram.tsx` taking `ResolvedFeedforward`
      and otherwise unchanged, and add
      `web/src/components/architecture/ArchitectureDiagram.tsx` that dispatches on
      `architecture.kind` and does nothing else; verify the feedforward drawing tests pass
      against the moved component mounted directly, with no declaration or screen state.
- [x] 4.2 Add `web/src/components/architecture/CnnDiagram.tsx` drawing one feature-map
      volume per block after the input volume, each drawn spatially smaller and deeper than
      the one before it on a compressive scale, with each block's exact spatial size and
      true channel count as text; verify new tests assert one volume per block at every
      permitted block count and strict monotonicity of drawn size and depth.
- [x] 4.3 Draw locality rather than connectivity in `CnnDiagram.tsx`: a receptive-field
      patch on the earlier volume converging to a single position on the later one, and no
      full connectivity between volumes; verify a test asserts no set of lines between two
      volumes equals the product of their drawn positions and that a patch is present.
- [x] 4.4 Draw the classifier head in `CnnDiagram.tsx` — the global pooling stage, the
      dropout stage and the dense classifier — between the last volume and the outputs,
      with one output per declared category; verify a test asserts all three stages are
      shown and that the drawn output count follows a task with a different category count.
- [x] 4.5 Give `CnnDiagram.tsx` its disclosure copy and text alternative: the channel depth
      stated as the abstraction with the configuration's real channel value alongside it,
      the spatial sizes stated exactly and never disclaimed, and an `aria-label` naming the
      block count, each block's channel count and the spatial size the stack reduces the
      input to; verify tests assert the disclosure, the absence of any disclaimer over the
      spatial sizes, and that the label follows a knob change.
- [x] 4.6 Point `web/src/screens/ConfigureTask.tsx` at `ArchitectureDiagram` and delete the
      old import; verify `web/src/screens/ConfigureTask.diagram.test.tsx` passes with the
      apple task drawing a convolutional architecture and a task declaring no diagram still
      drawing none.

## 5. Both families kept first-class

- [x] 5.1 Add a `cnn`-declaring test task to `web/src/test-support/declarations.ts`,
      sharing no vocabulary with the apple task and declaring its own input resolution and
      channel values, and keep `diagrammedDeclaration()` as the feedforward one; verify
      both validate through the real validator.
- [x] 5.2 Retarget the feedforward suites (`FeedforwardDiagram`'s tests and the
      feedforward cases in `test/diagram-resolve.test.ts` and
      `test/diagram-declaration.test.ts`) at the feedforward test task rather than the
      apple task, which is no longer feedforward; verify every requirement in
      `specs/network-diagram/spec.md` scoped to the fully-connected family still has a
      passing test.
- [x] 5.3 Verify no page names a task, knob or family: `npm test` including
      `web/src/no-task-specific-code.test.tsx`, with the knob rename having removed the CSS
      sizing-property collision the old component docblock warned about.

## 6. Verification

- [x] 6.1 Run `npm test` and `npm run typecheck` clean, and
      `openspec validate cnn-architecture --strict`.

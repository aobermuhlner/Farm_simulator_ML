## 1. The declaration contract

- [x] 1.1 Add the optional `diagram` block to `src/task/types.ts` — its kind, the knob setting the depth, the knob setting the width, the drawn count per width value, and the input count — with no output field, per `design.md`; verify `npm run typecheck` passes and a test asserts a declaration carrying no block still validates
- [x] 1.2 Implement `checkDiagram` in `src/task/validate.ts`, run only when the block is present and reading `input.knobs` for the declarations it needs, staying silent when the knobs are themselves malformed so their issues stay the cause; verify tests cover a complete block accepted, a block missing a required field refused naming it, and a block on a declaration whose knobs are already malformed adding no issues of its own
- [x] 1.3 Refuse a diagram that names a knob the task does not declare, names a depth knob permitting a value that is not a whole number, leaves a permitted width value without a drawn count, or maps one to a count that is not a positive whole number; verify one test per refusal asserting the field or value at fault is named in the issue
- [x] 1.4 Add the block to `declarations/apple-harvest.json` — depth from the layers knob, widths 16→2, 64→4, 256→8, an abstracted input count; verify the shipped declaration still validates and a test asserts every value its width knob permits has a drawn count

## 2. Resolving the architecture

- [x] 2.1 Implement `src/task/diagram.ts` resolving a declaration and its current knob values to an input count, a list of hidden-layer unit counts, an output count, the declared width value and the two knob labels the disclosure needs, per `design.md`; verify tests assert the hidden-layer count equals the depth value for every value that knob permits, and the units per layer equal the declared mapping for every width it permits
- [x] 2.2 Derive the output count from the task's declared categories rather than from the block; verify a test asserts a three-category task resolves three outputs and a two-category task resolves two
- [x] 2.3 Resolve nothing when the current knob values are not permitted by their knobs, so no diagram is drawn beside a configuration the engine has refused; verify a test passes a value outside a knob's declared values and asserts no architecture comes back

## 3. Drawing it

- [x] 3.1 Implement a `NetworkDiagram` component under `web/src/components/` rendering inline SVG whose `viewBox` is computed from the layer count and the widest layer, sized by SVG attributes and the stylesheet rather than by inline style objects per `design.md`'s note on the knob-id test; verify a test renders every depth the knob permits and asserts the number of hidden layers drawn, and that `web/src/no-task-specific-code.test.tsx` still passes
- [x] 3.2 Connect every unit of each layer to every unit of the next and to nothing else; verify tests assert the number of connections equals the sum over adjacent pairs of the product of their unit counts, and that no connection joins two units within one layer or across layers that are not adjacent
- [x] 3.3 Draw the input and output layers either side of the hidden ones, the outputs one per declared category; verify a test asserts the output units equal the declared category count and that the input units are the declared number
- [x] 3.4 Expose the whole drawing as one labelled graphic whose accessible name states the hidden-layer count and the declared units per layer; verify a test queries it by role, asserts the name names both, and asserts the name changes when a knob it depends on changes
- [x] 3.5 State the abstraction beside the drawing using the knobs' declared labels and the current width value, leaving the layer count undisclaimed, per `design.md`; verify tests assert the declared width value appears on screen, the wording marks the drawn widths as stand-ins, and that no knob id appears in the component's source

## 4. Seating it on the configuration screen

- [x] 4.1 Lay the settings fieldset and the diagram out as two columns inside `ConfigureTask`, collapsing to one column under the breakpoint, per `design.md`'s reason for not widening `main`; verify a test asserts the diagram is present alongside every declared knob control with no run scored
- [x] 4.2 Drive the drawing from the knob values already in `ConfigureTask`'s state, adding none of its own; verify a test changes the depth knob and asserts the drawn layer count follows, then changes the width knob and asserts the drawn units follow, with no run in between
- [x] 4.3 Draw nothing for a task that declares no diagram, and nothing beside a configuration that does not resolve; verify tests cover a declaration without the block — no diagram, screen otherwise unchanged, task still runs — and an unresolvable configuration showing the existing refusal and no drawing
- [x] 4.4 Confirm the drawing is declared rather than assumed: verify a test gives the second test declaration its own knobs and its own width mapping and asserts the layers and units drawn come from that declaration, with no screen code added for it

## 5. Verification

- [x] 5.1 Look at the diagram at both extremes — the fewest layers of the narrowest width and the most layers of the widest — and confirm it fits its column, reads as the conventional network picture, and stays legible at the dense end; verify by capturing it once and inspecting it, since jsdom asserts the counts but not the layout
- [x] 5.2 Confirm the change is additive: verify `npm test` and `npm run typecheck` pass, the existing shell, engine and declaration tests are unchanged, and a task declaring no diagram behaves exactly as before
- [x] 5.3 Re-read `specs/network-diagram/spec.md` and `specs/task-contract/spec.md` against the implementation and record every requirement neither covered by a test nor deliberately deferred; verify the resulting list is empty or handed to `/opsx:update` as findings

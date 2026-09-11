**Precondition.** `measured-features`, `model-families` and `model-tutorials` are archived;
verify all three are in `openspec/specs/` before starting. `decision-tree-builder` is
withdrawn and is *not* a precondition — the node budget this change sells is declared here.

**Scope reminder.** Placeholder trees, not fitted ones. Anything that measures how good a
tree is belongs to the deferred work in `proposal.md`, not to a task below.

## 1. Generalize the artifact contract without touching the shipped artifacts

- [x] 1.1 Apply the `prediction-artifacts` delta's step vocabulary to the artifact types: a history entry is a step, and what a step is comes from the family. Verify the three shipped convolutional artifacts still load and every existing artifact test passes unchanged.
- [x] 1.2 Teach the reader the `step` key with an `epoch` fallback, and record the fallback's removal condition (the `heirloom-cultivars` retrain) in a comment at the branch. Verify a fixture using `step` and a fixture using `epoch` both load, and that `artifacts/apple-harvest/predictions/*.json` are byte-identical on disk after the change.
- [x] 1.3 Extend provenance so an entry that records no history is valid, keeping `epochs` readable for the convolutional entries. Verify the existing provenance test passes and a new test accepts a history-less entry while refusing one whose recorded step count disagrees with its history length.
- [x] 1.4 Scope the pixel-delivery requirement in code: a family evaluated from manifest-recorded values reads no delivered resource. Verify a test refuses an evaluator that opens an atlas, and one that refuses a value the manifest does not declare for every image of the split being read.
- [x] 1.5 Split completeness into the two forms the delta describes — enumerated for stored distributions, structural for a stored model. Verify the existing "missing image refuses" test passes, and a new test refuses a model that leaves an image with no outcome or more than one.

## 2. Author the placeholder trees

- [x] 2.1 Author one tree per purchasable node budget, by hand, in the shape `src/families/model.ts` already reads. Verify each validates against that shape, that every leaf is a distribution over the declared categories summing to one, and that no leaf carries an action or a true category.
- [x] 2.2 Mark each shipped tree as a placeholder in its own provenance, so nothing downstream has to infer it. Verify a test refuses a tree that claims to have been fitted without recording what fitted it.
- [x] 2.3 Write the artifact — one file per configuration plus an index carrying coverage and pool binding, mirroring `artifacts/apple-harvest/predictions/`. Verify the index's pool binding matches the committed manifest and that resolving one configuration transfers no other.

## 3. Read and evaluate the tree in the app

- [x] 3.1 Add the tree artifact reader, refusing per the new capability's spec: an undeclared feature, a threshold outside its declared range or not finite, a non-terminating path, or a leaf that is not a distribution. Verify one test per refusal, each asserting the configuration and defect are named.
- [x] 3.2 Add the tree evaluator in `src/families/`, reading `src/features/` only. Verify every manifest image of both splits reaches exactly one leaf, and that the module cannot reach a generation attribute or an atlas — asserted structurally, not by convention.
- [x] 3.3 Produce a configuration entry from the shipped tree so `runPool` scores it unchanged. Verify a harvest run over the evaluation pool scores from the tree and that the decision policy, not the leaf, chooses the action.
- [x] 3.4 Draw the family's tree from the shipped structure, with a specific apple's path through it traceable. Verify the drawn tree and the scoring tree read the same structure, and that the drawing names no feature of its own.

## 4. Declare the family, bind the puzzle, sell the budgets

- [x] 4.1 Declare the tree family: its id, label, teaching copy, slot appearance, prediction source, diagram, and the node budget as its only knob. Verify the declaration validates, that no separate depth knob exists, and that it declares no history.
- [x] 4.2 Declare `tutorial: first-tree-leaves` on the family. Verify the archived puzzle is reachable, that owning the family without solving it withholds putting it to work and nothing else, and that solving it is recorded once.
- [x] 4.3 Bind the node budget to the family's configuration identity, scoped to the family. Verify a tree budget's identifier cannot collide with a convolutional identifier and that the three shipped convolutional ids resolve unchanged.
- [x] 4.4 Add catalog entries for the family and its purchasable budgets. Verify `progression-catalog`'s check that nothing for sale opens an untrained configuration passes, and that the budget owned before any purchase is covered.
- [x] 4.5 Confirm a budget outside coverage refuses as untrained and not as invalid, and that nothing is fitted at run time or served from a nearby budget. Verify with a test per refusal path.

## 5. Take the step label out of the screen

- [x] 5.1 Add the history step label to the family declaration, required exactly of a family that records a history. Verify a history-declaring family omitting the label is refused naming the family and the field, and that a history-less family declaring no label loads.
- [x] 5.2 Replace the literal `epoch <n>` in `web/src/screens/TrainingRun.tsx:154` with the declared label. Verify the convolutional family still reads "epoch" on screen.
- [x] 5.3 Extend `web/src/no-task-specific-code.test.tsx` so no screen may name a model family or a family's step vocabulary. Verify the test fails against the pre-change screen and passes after.

## 6. Verify the frame carries two families

- [x] 6.1 Run the full suite. Verify the three shipped convolutional artifacts are byte-identical to their committed versions and every pre-existing test passes.
- [x] 6.2 Play the whole loop: buy the family, meet the puzzle, solve it, select the family, set its budget, put it to work, run a year, read the report. Verify each step works from declared data alone.
- [x] 6.3 Confirm the workshop presents a family that records no history without a curve, an empty axis, or an error. Verify against `model-families`' *A family without a history shows none*.
- [x] 6.4 Confirm the honesty wording on screen claims no fit that did not happen. Verify the copy is declared data and that nothing tells a student the tree was fitted to their photos.

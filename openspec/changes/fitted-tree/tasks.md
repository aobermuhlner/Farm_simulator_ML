**Precondition.** `model-families` must have landed with a third prediction source — ship the
fitted model, evaluate in the browser — and a family interface returning a configuration entry
rather than a per-image distribution. `measured-features` must have landed with the manifest's
feature vectors, and `decision-tree-builder` with the node budget as a purchasable item and a
tree shape. Verify all three before starting group 2; see `proposal.md` — What Changes.

## 1. Generalize the artifact contract without touching the shipped artifacts

- [ ] 1.1 Apply the `prediction-artifacts` delta's step vocabulary to the artifact types: a history entry is a step, and what a step is comes from the family. Verify the three shipped convolutional artifacts still load and every existing artifact test passes unchanged.
- [ ] 1.2 Teach the reader the `step` key with an `epoch` fallback, and record the fallback's removal condition (the `heirloom-cultivars` retrain) in a comment at the branch. Verify a fixture using `step` and a fixture using `epoch` both load, and that `artifacts/apple-harvest/predictions/*.json` are byte-identical on disk after the change.
- [ ] 1.3 Extend provenance to record a step count whose meaning the family declares, keeping `epochs` readable for the convolutional entries. Verify the existing provenance test passes and a new test refuses an entry whose recorded step count disagrees with its history length.
- [ ] 1.4 Scope the pixel-delivery requirement in code: a pipeline fitting on manifest-recorded values reads no delivered resource. Verify a test refuses a fitting run that opens an atlas, and one that refuses a value the manifest does not declare for every image of the split being fitted.
- [ ] 1.5 Split completeness into the two forms the delta describes — enumerated for stored distributions, structural for a stored model. Verify the existing "missing image refuses" test passes, and a new test refuses a model that leaves an image with no outcome or more than one.

## 2. Fit the tree offline

- [ ] 2.1 Add a fitting step under `training/` that reads the pool manifest's measured feature vectors for the training split and fits `DecisionTreeClassifier` best-first to a leaf budget. Verify it refuses to run when a requested feature is absent from any image, and that it opens no atlas file.
- [ ] 2.2 Fix the tie-breaking rule — earliest declared feature, then lowest threshold — and record the seed. Verify two runs with the same recorded fields produce an identical tree, asserted by comparing serialized structures.
- [ ] 2.3 Emit the growth history: one entry per split, each describing the tree holding the first *k* splits. Verify a test asserts the tree at *k* is a prefix of the tree at *k+1* — every earlier split present with the same feature and threshold, exactly one split added.
- [ ] 2.4 Laplace-smooth leaf class counts and emit each leaf as a distribution over the declared categories. Verify a test shows no leaf carries a zero probability, that every leaf sums to one within the declared tolerance, and that no leaf carries an action, a label or a true category.
- [ ] 2.5 Measure per-step training and validation log loss and accuracy over the 160 fitted and 40 held-out images. Verify a test asserts no held-out image influenced any split or leaf, and that the loss is finite at every step for every covered budget.
- [ ] 2.6 Write the artifact — one file per configuration plus an index carrying coverage, pool binding, provenance and encoding, mirroring `artifacts/apple-harvest/predictions/`. Verify the index's pool binding matches the committed manifest and that resolving one configuration transfers no other.

## 3. Measure the gap and the floor, and gate the ship on them

- [ ] 3.1 Declare the reference hand tree alongside the family, in the tree shape rung 1 produces, seeded from `Game_design.md` §5.4. Verify it validates against that shape and that the pipeline reads it rather than naming any feature itself.
- [ ] 3.2 Measure the reference tree and each fitted tree over the evaluation pool and record the margin and the declared band. Verify the recorded margin is positive, and that a non-positive or out-of-band margin is reported as a named finding rather than silently accepted.
- [ ] 3.3 Add the ship gate refusing an artifact whose recorded fitted-versus-held-out gaps do not widen across covered budgets in increasing order. Verify a fixture with inverted gaps is refused naming both budgets, and that the shipped artifact passes.
- [ ] 3.4 Record the measured figures in `training/README.md` beside the convolutional tables — per budget: final fitted and held-out accuracy, their difference, and the floor margin. Verify the numbers in the document are read out of the committed artifact, not from a run of their own.
- [ ] 3.5 **Decision point.** If the measured gap across the covered budgets is narrower than about two held-out images, stop and escalate per `design.md` — Risks, rather than pricing the catalog against a lesson that will not reproduce. Verify by recording the measured widths and the decision taken.

## 4. Read and evaluate the tree in the app

- [ ] 4.1 Add the tree artifact reader, refusing per the new capability's spec: an undeclared feature, a threshold outside its declared range or not finite, a node without exactly two children, a non-terminating path, or a leaf that is not a distribution. Verify one test per refusal, each asserting the configuration and defect are named.
- [ ] 4.2 Add the tree evaluator in `src/families/`, reading `src/features/` only. Verify every manifest image of both splits reaches exactly one leaf, and that the module cannot reach a generation attribute or an atlas — asserted structurally, not by convention.
- [ ] 4.3 Produce a configuration entry from the shipped tree so `runPool` scores it unchanged. Verify a harvest run over the evaluation pool scores from the tree and that the decision policy, not the leaf, chooses the action.
- [ ] 4.4 Draw the family's tree from the shipped structure, with a specific apple's path through it traceable. Verify the drawn tree and the scoring tree read the same structure, and that the drawing names no feature of its own.

## 5. Declare the family and sell the budgets

- [ ] 5.1 Declare the fitted-tree family: its id, its teaching copy, its prediction source, its diagram, and the node budget as its capacity. Verify the declaration validates and that no separate depth knob exists.
- [ ] 5.2 Bind the node budget to the family's configuration identity, scoped to the family. Verify a tree budget's identifier cannot collide with a convolutional identifier and that the three shipped convolutional ids resolve unchanged.
- [ ] 5.3 Add catalog entries for the purchasable budgets, priced from the measurements of group 3. Verify `progression-catalog`'s check that nothing for sale opens an untrained configuration passes, and that the budget owned before any purchase is covered.
- [ ] 5.4 Confirm a budget outside coverage refuses as untrained and not as invalid, and that nothing is fitted at run time or served from a nearby budget. Verify with a test per refusal path.

## 6. Take the step label out of the screen

- [ ] 6.1 Add the history step label to the family declaration and refuse a declaration omitting it. Verify a declaration without the label is refused naming the family and the field.
- [ ] 6.2 Replace the literal `epoch <n>` in `web/src/screens/TrainingRun.tsx:154` with the declared label. Verify the convolutional family still reads "epoch" on screen and the tree family reads its own label.
- [ ] 6.3 Extend `web/src/no-task-specific-code.test.tsx` so no screen may name a model family or a family's step vocabulary. Verify the test fails against the pre-change screen and passes after.

## 7. Verify the whole change

- [ ] 7.1 Run the full suite and the ship gate. Verify the three shipped convolutional artifacts are byte-identical to their committed versions and every pre-existing test passes.
- [ ] 7.2 Play the workshop at each covered budget. Verify the growth curve draws, the fitted and held-out figures are shown side by side, and the gap visibly widens as the budget rises.
- [ ] 7.3 Confirm the honesty wording on screen describes what actually happened — this tree was fitted to the starter set's photos and the run is a replay of that fit, not a fit happening now. Verify the copy is declared data and survives a student reading the source.

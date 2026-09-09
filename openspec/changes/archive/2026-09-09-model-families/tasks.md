Read `proposal.md`, `design.md` and the seven delta specs under `specs/` first. The standing
gate for the whole change is task 8.1: every currently shipped configuration resolves to the
same distributions and the same training history at the end as at the start. Nothing here
retrains anything.

Design's open questions — whether the picker is tabs or a select, and whether a history axis
label needs a plural form — change no task below and are deliberately left for when two real
families exist.

## 1. The declared family

- [x] 1.1 Add a model family declaration type carrying id, label, knobs, what it ships, teaching copy, slot icon, slot label, optional diagram and optional history axis, and verify the type compiles with `knobs`, `predictions` and `diagram` removed from `TaskDeclaration`
- [x] 1.2 Move `knobs`, `predictions` and `diagram` off `TaskDeclaration` onto the family type, leaving categories, actions, `categoryActions`, policy, payoffs, delivery, pool, `features`, `ruleBudget` and `handSorting` on the task, and verify the compiler finds every reader of the moved fields
- [x] 1.3 Require at least one family in `validate.ts` and verify a declaration carrying none is refused naming the omission
- [x] 1.4 Refuse duplicate family ids within a task and verify the refusal names the offending id
- [x] 1.5 Refuse knobs or a predictions reference declared at the task level, naming where they now belong, and verify both refusals fire separately
- [x] 1.6 Validate `ships` against the two supported forms and verify a family declaring neither, or an unsupported form, is refused naming what it declared
- [x] 1.7 Scope knob id uniqueness to the family and verify two families of one task may each declare a knob with the same id
- [x] 1.8 Run the separator checks per family and verify the refusals name the family as well as the knob and the offending id or value
- [x] 1.9 Resolve a diagram's knob references against its own family's knobs and verify a diagram naming another family's knob is refused naming both
- [x] 1.10 Require a declared axis label wherever a family declares a history, and verify a family declaring no history is accepted without one

## 2. The apple task, reshaped

- [x] 2.1 Reshape `declarations/apple-harvest.json` so its knobs, predictions reference and diagram sit under one declared convolutional family, and verify no knob id, value, default or help string differs from before
- [x] 2.2 Declare that family's slot icon, short label and history axis, and verify the declaration validates
- [x] 2.3 Add a fixture task declaring two families — one prediction-shipping, one model-shipping — to the test helpers, and verify it validates and is usable by the tests in groups 3 to 7

## 3. Identity and the artifact binding

- [x] 3.1 Scope configuration identity to the family composing it, leaving the composed string byte-identical, and verify the identifiers the apple family composes are exactly those the artifacts already ship
- [x] 3.2 Resolve an identifier only against the family that composed it and verify the same string composed by two families of the fixture task resolves to each family's own entry and never the other's
- [x] 3.3 Record the family id in the prediction artifact shape and refuse an artifact recording none, and verify the refusal names the omission
- [x] 3.4 Refuse an artifact whose recorded family is not the one being resolved, and verify the refusal names the recorded and the requested family
- [x] 3.5 Re-emit the shipped artifacts with their family id recorded, changing nothing else, and verify by diff that no probability, configuration key or history entry moved
- [x] 3.6 Verify a declaration deliberately pointing one family at another family's artifact is refused rather than answering with a plausible distribution

## 4. The registry and the two evaluators

- [x] 4.1 Define the family entry a resolution yields — optional history, the distribution for one image of one split, and the image ids a split holds — and verify it compiles against both evaluators
- [x] 4.2 Implement the prediction-shipping evaluator over the existing artifact reader and verify it returns the history and distributions the current code returns for a shipped configuration
- [x] 4.3 Implement the model-shipping evaluator reading `src/features/` and the pool manifest's split membership, and verify it yields a valid distribution for every image of both splits without fetching a prediction table
- [x] 4.4 Add the family registry resolving a declared family to its evaluator from `ships` alone, and verify nothing branches on a family id
- [x] 4.5 Refuse a resolution whose family has no entry for a configuration and verify the refusal names the family and the identifier
- [x] 4.6 Refuse a distribution that is not valid over the task's declared categories and verify the refusal names the image and the cause
- [x] 4.7 Verify a family declaring no history resolves successfully and that nothing reports the absent history as a failure
- [x] 4.8 Verify no family yields an action, a label or an outcome, and that converting a distribution to an action still happens only in `src/policy/`

## 5. Scoring and labour

- [x] 5.1 Move `scoreEntry` and `scoreCrop` onto the family entry's accessors instead of a materialized predictions record, and verify the existing scoring and harvest tests pass unchanged
- [x] 5.2 Verify the farm's hands still score on their own path in `src/sorting/tally.ts` and that `src/policy/` and `decision-policy`'s requirements are untouched by this change
- [x] 5.3 Record the family alongside the configuration identifier in a labour slot and verify the labour of a task resolves to that family's model
- [x] 5.4 Verify selecting a different family leaves a filled slot at the model that was put to work
- [x] 5.5 Treat a slot recording an identifier with no family as one this build cannot make, and verify no family is substituted for it
- [x] 5.6 Drop a slot naming a family the declarations no longer carry, revert that task to the hands and report the cause naming the family, and verify the rest of the restored progress is kept
- [x] 5.7 Verify a withdrawn family's slot is not remapped onto another declared family that could compose the same identifier

## 6. Progress

- [x] 6.1 Record knob values per family in the save and verify tuning one family leaves another's values as they were
- [x] 6.2 Record each task's selected family and verify a save recording none opens at the task's first declared family with the rest of the save kept
- [x] 6.3 Verify a family for which the save records no values opens at its declared defaults with nothing reported missing
- [x] 6.4 Verify no family id, label, knob, default, help string, shipped form, icon or axis label is read from the save rather than the declarations, including that a relabelled family reaches a restored farm
- [x] 6.5 Bump the save schema version so existing saves reset rather than migrate, and verify the declared reset path runs and reports itself

## 7. The workshop, the report and the invariant

- [x] 7.1 Present the task's declared families in the workshop with the selected family's knobs and drawing, and verify the fixture task's two families both render from their declarations alone
- [x] 7.2 Verify selecting a family moves no money, appends no ledger record, leaves the year unchanged and does not put that family to work
- [x] 7.3 Show a family the student does not have available together with what opens it, not hidden and not selectable, and verify it matches how a locked knob value is presented
- [x] 7.4 Verify a task declaring exactly one family presents its knobs directly and offers no family choice, so the shipped apple task looks as it did
- [x] 7.5 Name the family alongside the configuration identifier in a report, and verify a hand-brought crop's report still names neither
- [x] 7.6 Verify a report already shown keeps naming the family, configuration and year it was produced from after a different family is selected
- [x] 7.7 Replace the literal `epoch <n>` in `web/src/screens/TrainingRun.tsx` with the family's declared axis label and verify the apple family still reads as epochs
- [x] 7.8 Extend `web/src/no-task-specific-code.test.tsx` to family ids, labels, shipped forms, slot icons, slot labels and axis labels, and verify it fails when a family id is written into a screen
- [x] 7.9 Verify no screen branches on whether a family ships its model or its predictions, and that nothing names a family outside that family's own drawing

## 8. Standing gates

- [x] 8.1 Verify every currently shipped configuration resolves to the same distributions and the same training history as before the change, and that no retraining was performed
- [x] 8.2 Verify each family's drawing is still separately mountable from a family declaration and knob values alone, confirming `network-diagram` needed no change
- [x] 8.3 Verify the fixture task declaring two families is offered, configured, put to work and reported through the same screens with no screen code added for it
- [x] 8.4 Run the full suite and `openspec validate model-families --strict`, and record in the change any figure or behaviour that moved

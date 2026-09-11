## 1. The frame amendment

Three narrownesses in the shipped `model-tutorials` contract, landed first so the kind and the
body are built against the contract they need. No declaration carries a tutorial yet, so
nothing on screen changes in this group and the game stays behaviourally identical.

- [x] 1.1 Add the declared statement of what a tutorial simplifies to the tutorial declaration type as a required field, and require it in the envelope validator; verify a tutorial omitting it is refused at load naming the family and the missing field, and that the existing "missing required field" refusal still names the theory copy.
- [x] 1.2 Update every tutorial fixture and test declaration to carry the new field; verify the whole suite passes and that no shipped declaration gained a tutorial.
- [x] 1.3 Render the statement in plain view beneath the mounted puzzle in the frame; verify it is readable without operating any control, that the theory copy is still behind its disclosure, and that theory being there does not satisfy it.
- [x] 1.4 Pass the task declaration to a kind's puzzle checker; verify with a fixture kind that a puzzle naming an undeclared category and a puzzle naming an undeclared feature are each refused at load naming the family and the undeclared name.
- [x] 1.5 Verify the frame still names no family after 1.3 and 1.4 — no family id or label in the frame, nothing branching on which family is taught, and the task declaration reaching only the checker.
- [x] 1.6 Add the optional browsable-split image source to the body contract and pass it through the dispatcher unread; verify a body declaring no need for it is still posed from declared data alone, and that the engine-registry and body-registry key sets still match.

## 2. The engine kind

Pure functions of declared data, no React, no pool. This is what makes the load-time refusal
computable at the point the validator asks for it.

- [x] 2.1 Declare the puzzle's shape — an ordered list of questions as feature-and-threshold pairs, the apples, and the mark — reusing the existing rule-split type for a question; verify the type checker passes and that a question means the same thing here as in the rule search.
- [x] 2.2 Implement the checker; verify each refusal separately: no questions declared, a question naming an undeclared feature, a threshold that is not a number, an apple naming an undeclared category, an apple missing a value a question reads, and a declared value for a feature no question asks about.
- [x] 2.3 Implement the routing — which leaf one apple reaches — and verify an apple above the first threshold stops at that leaf, an apple below every threshold reaches the final leaf, and every declared apple reaches exactly one leaf.
- [x] 2.4 Implement the best-labelling computation as the per-leaf argmax over the apples reaching each leaf; verify it is independent of leaf order and returns both the labelling and the count it files correctly.
- [x] 2.5 Implement the winnability decision on top of 2.4; verify a puzzle whose best labelling falls short of its mark is refused naming the family, the tutorial, the achievable count and the mark, a puzzle whose best labelling files every apple correctly is refused naming the family and the tutorial, and a puzzle that clears its mark while misfiling at least one apple loads.
- [x] 2.6 Implement the judgement — pass when the submitted labelling files at least the mark correctly, fail below, a boolean and nothing else; verify a passing labelling, a failing one, and that no count leaves the function.
- [x] 2.7 Register the kind in the engine registry; verify the registry lookup finds it and that a declaration carrying this kind now reaches the checker rather than being refused as unrecognised.

## 3. The puzzle's declared data

- [x] 3.1 Author the puzzle block — the two questions (dark patch area above 0.0205, then redness above 0.4513) and the nine apples with only those two measured values each, copied from the shipped manifest; verify the checker accepts it and the winnability decision reports it winnable with one apple misfiled.
- [x] 3.2 Add the pinning test comparing every declared apple's declared values against `pools/apple-harvest/manifest.json`; verify it passes as authored and fails naming the image, the feature, the declared value and the recorded value when one declared value is edited.
- [x] 3.3 Add a test asserting the declared set still exhibits the lesson — the best labelling is wormy/red/green, it files eight of nine, and the apple it misfiles is a wormy one reaching the redness leaf; verify it fails if an apple is swapped for one that removes the misfile.
- [x] 3.4 Author the title, the summary, the theory copy and the statement of what the puzzle simplifies; verify the statement says the questions were given and that the model this introduces chooses its own, and that no copy claims the puzzle is the model.

## 4. The body

The only new screen. It may name the family it teaches and no other.

- [x] 4.1 Draw the tree from the declared questions — each question on its branch, one empty leaf at every exit, one more leaf than questions; verify the drawing is posed from declared puzzle data alone with no task declaration or screen state.
- [x] 4.2 Render the tray with one apple per declared category, each carrying its category's declared label as text beside its picture; verify the label text is present for every tray apple and for every filled leaf, and that the categories are distinguishable without relying on the apples' colour.
- [x] 4.3 Implement labelling by pointer drag; verify an apple dragged into a leaf labels it with that category, a second drag replaces the label, and a leaf holds at most one.
- [x] 4.4 Implement labelling by click-an-apple-then-click-a-leaf, producing the same labelling; verify the puzzle can be solved end to end with no pointer drag, using keyboard activation only.
- [x] 4.5 Implement the test affordance: file every declared apple and show each one in the leaf it reached; verify it shows per-apple placement, shows no distribution, range, average or count of a measured feature for either split, leaves the labelling untouched, and neither passes nor fails the tutorial.
- [x] 4.6 Offer the labelling for judgement through the frame's single route; verify the engine's registered kind is what decides, that the body decides nothing, and that a labelling read off the test affordance is judged on its merits with nothing marking it as such.
- [x] 4.7 Implement the loading and refusal states over the injected image source; verify the puzzle states it is loading and offers no answer while pictures are outstanding, states the cause and offers no answer when they cannot be fetched, and can be opened again afterwards.
- [x] 4.8 Verify judgement does not depend on the pictures: the same labelling passes or fails identically whether the images loaded or failed.
- [x] 4.9 Register the body in the screen registry; verify the two registries' key sets match and that mounting by kind reaches this body.

## 5. Wiring

- [x] 5.1 Forward the workshop's existing browsable-split loader to the mounted tutorial; verify the workshop passes it, the frame does not read it, and no measured feature value or generation attribute crosses that boundary with the pictures.
- [x] 5.2 Verify the task-specific-code invariant still holds: the body names its own family and no other, the frame and the workshop name none, and the invariant test covers a family's tutorial the way it covers a family's drawing.
- [x] 5.3 Verify nothing about the puzzle touches money, the ledger, the year or what is at work — opening it, failing it and passing it repeatedly leave all four as they were.

## 6. Turning the gate live — after `fitted-tree` lands

**Not done: waiting on `fitted-tree`.** No fitted-tree family exists in
`declarations/apple-harvest.json`, so there is nothing to hang the block on and the fallback
below is what landed. The authored block is committed at
`declarations/tutorials/label-the-leaves.json` and played end to end through the real
registries, the real validator and the committed pool by
`web/src/screens/ConfigureTask.leaves.test.tsx`, which hangs it on a family *in the test*.
6.2 and 6.3 are covered there and in `web/src/App.tutorial.test.tsx` for everything that is
kind-independent — the gate, the save, the reload and starting again — and are left unticked
because neither has been seen on the family this lesson is about.

**Spec sync on archiving, 2026-09-10.** Both deltas were merged into the main specs and this
change was archived with 6.1–6.3 outstanding. `openspec/specs/model-tutorials/spec.md` carries
the three amendments, which are shipped and reachable.
`openspec/specs/fitted-tree-tutorial/spec.md` carries all nine requirements of the puzzle —
which are built and tested but **not reachable in a running build**, because no declaration
carries the tutorial. Whoever adds the fitted-tree family owes the one thing that closes the
gap: the `tutorial` block from `declarations/tutorials/label-the-leaves.json` on that family.
Until then the main spec asserts a lesson a student cannot open.

This group is the only one that changes what a student sees, and it waits on the fitted-tree
family existing to attach to. Everything above can be completed and verified before it.

- [ ] 6.1 Add the tutorial block to the fitted-tree family's declaration in `declarations/apple-harvest.json`; verify the task loads, the puzzle is presented for that family, and no other family gained a tutorial.
- [ ] 6.2 Verify the gate end to end: the fitted-tree family can be bought, selected, its knobs set and its model made while the tutorial is incomplete; no control puts it to work; what withholds it is stated as the tutorial; and completing the puzzle opens fielding and changes nothing else.
- [ ] 6.3 Verify completion survives a reload and stays complete after a later failed attempt, and that starting a new farm clears it.

**Fallback if `fitted-tree` slips:** land groups 1–5 and 3.1–3.4 with the puzzle data committed and exercised end to end by tests, and leave 6.1 as the one line `fitted-tree` adds. The gate is inert until then, which is the state `model-tutorials` already ships in.

## 7. Verification sweep

- [x] 7.1 Run the full test suite, the type checker and the production build; verify all three pass.
- [x] 7.2 Verify the shipped prediction artifacts are untouched and the recorded ladder figures have not moved — this change reads no pixels, trains nothing and must move no measured figure.
- [x] 7.3 Verify the colour-vision check still passes over the declared category colours, with the puzzle's screen included in whatever it covers.

Read `proposal.md`, `design.md` and the five delta specs under `specs/` first.

The standing gate for the whole change is task 8.1: the shipped game plays exactly as it
does today. No family in `declarations/apple-harvest.json` declares a tutorial when this
change lands, so the gate is inert and nothing is retrained. `fitted-tree-tutorial` is the
change that makes it live.

Design's decisions that the tasks below depend on: the tutorial hangs off
`ModelFamilyDeclaration` beside `diagram` and `history`; completion is keyed by the
tutorial's own declared id, globally; fieldability is computed beside `computeAvailability`
rather than inside it; and there are two registries, one engine and one screen.

## 1. The declared tutorial

- [x] 1.1 Add an optional `tutorial` to `ModelFamilyDeclaration` carrying a stable id, a title, teaching copy and a kind-discriminated puzzle blob, and verify the type compiles with every existing declaration and fixture untouched
- [x] 1.2 Validate the tutorial envelope in `src/task/validate.ts` — id, title, teaching copy present and of the right shape — and verify each missing field is refused naming the family and that field
- [x] 1.3 Refuse a tutorial whose `kind` the engine registry does not carry, naming the kind, and verify the refusal fires rather than the tutorial being ignored
- [x] 1.4 Accept a family declaring no tutorial without complaint, and verify the shipped apple declaration and every existing fixture still validate unchanged
- [x] 1.5 Refuse two families that declare the same tutorial id with content that differs, naming the id, and verify two families declaring the identical tutorial are accepted
- [x] 1.6 Add a fixture kind and a tutored fixture task — `test/helpers/tutorials.ts` beside the existing `families.ts` builder rather than `test/fixtures`, which holds JSON data files, plus `web/src/test-support` — declaring one family with a tutorial and one without, and verify it validates and is usable by groups 3 to 7

## 2. The engine registry and winnability

- [x] 2.1 Create `src/tutorials/` with a registry mapping a kind to its checker, winnability decision and judge, keyed by kind and never by family id, and verify the module imports nothing from `web/`
- [x] 2.2 Register a fixture kind used only by tests, and verify a declaration carrying it validates while one carrying an unregistered kind is refused naming the kind
- [x] 2.3 Run each kind's own check over its puzzle blob at load and verify a malformed blob is refused naming the family, the tutorial and the defect
- [x] 2.4 Refuse at load a tutorial whose kind reports that no solution clears its pass condition, naming the family, the tutorial and the cause, and verify the task is not loaded
- [x] 2.5 Verify a winnable fixture tutorial loads and is presented, so that 2.4 is a real check rather than a refusal of everything
- [x] 2.6 Expose a judge that answers whether one attempt clears the pass condition, returning nothing but that, and verify it yields no score, count or partial credit

## 3. The gate

- [x] 3.1 Add a fieldability computation in `src/progression/` taking the loaded tasks and the completed tutorial ids, leaving `computeAvailability`'s three arguments and its meaning untouched, and verify the availability tests still pass unchanged
- [x] 3.2 Verify a family whose tutorial is incomplete is reported available for selection and not fieldable, and a family declaring no tutorial is both
- [x] 3.3 Refuse `putToWork` in `src/labour/` for a family whose declared tutorial is not completed, naming that tutorial, and verify the slots, the balance, the ledger and the year are unchanged by the refusal
- [x] 3.4 Leave `handBack` unconditional and verify a task worked by a model whose family's tutorial is incomplete can still have its job handed back
- [x] 3.5 Verify completing a tutorial makes `putToWork` succeed for that family with no other state changed — no knob value, no catalog item and no other family moves

## 4. The save

- [x] 4.1 Add the completed tutorial ids to `SavedFarm` as a set of ids and nothing more, bump `SAVE_SCHEMA_VERSION` to `4.0.0`, and verify a save written at `3.0.0` resets with the disclosure `game-save` already requires
- [x] 4.2 Write completion at the point it changes and restore it on open, and verify a completed tutorial survives the page being closed and the family it gates is still fieldable
- [x] 4.3 Verify the written save records no score, no attempt count and no timing however many attempts preceded the pass
- [x] 4.4 Read a tutorial's id, title, copy, kind and puzzle data from the declarations on every open, and verify rewriting the declared title or copy reaches a restored farm without resetting its completion
- [x] 4.5 Open a save recording no completed tutorials with none complete rather than refusing, and verify the rest of that save is kept
- [x] 4.6 Keep a completed id no declaration now carries rather than dropping it, present no tutorial for it, and verify a declaration that names that id again finds it already satisfied
- [x] 4.7 Add a distinct restore cause for a slot naming a family whose tutorial is unfinished, drop the slot and revert that task to the hands, and verify the reported cause names the tutorial and is not the cause used for a configuration or a family this build cannot make

## 5. The screen registry and the body

- [x] 5.1 Create `web/src/components/tutorial/TutorialBody.tsx` dispatching on kind and doing nothing else, in the shape of `ArchitectureDiagram.tsx`, and verify it imports no task declaration and no screen state
- [x] 5.2 Add a fixture body for the fixture kind, mounted from its declared puzzle data alone, and verify it renders given that data and nothing else
- [x] 5.3 Verify the two registries carry the same set of kinds, so a kind added to one and not the other fails at build rather than rendering an empty frame
- [x] 5.4 Verify adding a second fixture kind leaves the first kind's body and the frame unchanged

## 6. The workshop

- [x] 6.1 Offer the selected family's tutorial from the workshop beside its knobs whenever the family declares one, and verify a family declaring none offers nothing and the workshop is otherwise as it was
- [x] 6.2 Present the tutorial in a frame that names no family — title, theory copy, the mounted body, and a way to submit an attempt — and verify the frame renders the fixture family's tutorial and an unrelated one through the same code
- [x] 6.3 Record completion when an attempt clears the pass condition, and verify a failing attempt records nothing and can be retried immediately with nothing deducted, delayed or withheld
- [x] 6.4 Keep a completed tutorial open, readable and re-attemptable, and verify a failed attempt on a completed tutorial leaves it completed and what it opened open
- [x] 6.5 Withhold the control that puts a model to work while the selected family's tutorial is incomplete, stating the tutorial to sit and offering the way to it, and verify it is worded as something to do rather than as an error, a purchase or an unrunnable configuration
- [x] 6.6 Verify completing the tutorial offers that control for a model already made, without the model having to be made again
- [x] 6.7 Verify sitting a tutorial any number of times leaves the balance, the ledger, the year and every task's labour exactly as they were

## 7. The invariants

- [x] 7.1 Verify the market presents no tutorial, opens none on a purchase, and bars no purchase on one — every item the balance covers still offers to be bought to a farm that has completed nothing
- [x] 7.2 Extend `web/src/no-task-specific-code.test.tsx` over the tutorial frame and verify it names no family id and no family label, while a body may name its own family and no other
- [x] 7.3 Verify the frame, the registry and the gate branch on no family id anywhere in `src/tutorials/`, `src/progression/` or `src/labour/`
- [x] 7.4 Verify a task declaring a family with a tutorial the shell has never presented is offered, configured, gated and fielded through the same screens with no screen code added or changed for it

## 8. The standing gate

- [x] 8.1 Leave `declarations/apple-harvest.json` without a tutorial on any family and verify the shipped game's configurations, artifacts, distributions and training histories are byte-identical to what they were before this change
- [x] 8.2 Run the full test suite and the type check and verify both pass — this project configures no linter, so there is none to run

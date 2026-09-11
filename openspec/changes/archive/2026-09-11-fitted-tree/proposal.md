# Fitted tree

The apple task gains a second model family: a decision tree the student buys, unlocks by
passing the puzzle that already exists, selects, tunes and puts to work. Depends on
`measured-features` (the feature vectors it reads), `model-families` (the family
abstraction it registers through) and `model-tutorials` (the gate it sits behind), all
three archived.

**Framework first.** Per `CLAUDE.md` — *This is a prototype: build the frame before the
contents* — this change ships the family with placeholder trees. Fitting them for real is
deferred; see *Deferred* below.

## Why

The game has one model family and the frame around it is untested. Everything the
architecture promises — that a task offers several families, that one is bought, gated
behind a comprehension puzzle, selected, tuned, drawn and fielded, all from declared data
— is a promise nothing has yet been asked to keep. A second family is what asks.

The pieces are further along than they look, and one of them is already stranded.
`fitted-tree-tutorial` archived a working puzzle — a tree whose questions are given and
whose leaves are empty, labelled by dropping one apple per category into each. It is a
lock with no door: `declarations/tutorials/label-the-leaves.json` exists, and no family
declares it, because the family it gates does not exist. This change is the door.

A tree is the right second family for reasons that survive the placeholder. It is the one
model in the game a student can read end to end, so it is where the vocabulary of *fitting*
can be introduced before any neural-network vocabulary is on screen. And it evaluates in
the browser over the manifest's measured features, so it needs no download and no training
compute — the frame gets exercised at close to zero cost.

**Rung 1 is withdrawn.** `Game_design.md` §2 and §5.4 planned a tree the student writes by
hand and ships as their model. `decision-tree-builder` held that plan and is deleted. The
comprehension it existed to produce is what the puzzle now produces, at a fraction of the
cost and without a student-authored model source the architecture has nowhere to put — see
`src/task/types.ts:331`, which records that gap deliberately. What survives of rung 1 is the
node budget as a purchase, which moves onto this family as its capacity.

## What Changes

- **A tree family, declared.** Its id, label, teaching copy, slot appearance, diagram and
  knobs, alongside the convolutional family in `declarations/apple-harvest.json`. Nothing in
  any screen learns the word "tree".
- **It declares the puzzle.** `tutorial: first-tree-leaves`, which `model-tutorials` then
  enforces unchanged: owned but unsolved withholds putting the family to work and nothing
  else. The stranded declaration becomes reachable, and the mechanism gets its first real
  use.
- **The node budget is its capacity, bought through the catalog.** The same "capacity is
  bought, not given" mechanic the convolutional blocks use, so the economy reads as one
  system across two families. Coverage is one-dimensional: one tree per purchasable budget.
- **It ships its model, not a table of predictions.** `model-families` already carries
  `ships: 'model'` and `src/families/model.ts` already evaluates a chain of feature
  thresholds in the browser. A tree is a few dozen `(feature, threshold)` pairs and ships
  smaller than its own predictions, and the structure has to ship regardless so the family's
  drawing can be drawn from it and one apple's path through it traced.
- **The shipped trees are placeholders, and they say so.** Authored by hand rather than
  fitted, one per covered budget, in the shape a real fit will later produce — so that
  replacing them with fitted output is a data change and not a change to this one. Honesty
  is not deferred with them: no declared copy and no screen may claim a fit that did not
  happen. A placeholder that presents itself as "fitted to your photos" would break
  `CLAUDE.md`'s honesty line, and prototypes are read by the people building them.
- **The family records no history yet.** A growth curve needs a growth, and nothing is
  grown here. `model-families` already covers this — *a family that records no history
  SHALL declare none, and SHALL NOT be presented with an empty curve or a zero-length axis*
  — so the workshop showing a tree without a curve is the frame working, not a gap. The
  history arrives with the fitting.
- **Leaves carry a distribution over categories, never an action.** `model-families`
  requires it, and it is the lesson too: the family says how sure it is, the declared
  decision policy turns that into an action, exactly as it does for the network.
- **The artifact contract is generalized to admit a shipped model.** Four requirements in
  `prediction-artifacts` are written against a family that trains for epochs and emits one
  distribution per image. A shipped tree satisfies neither shape. The three shipped
  convolutional artifacts must resolve byte-identically afterwards — a test, not an
  intention.
- **The step label comes out of the screen.** `web/src/screens/TrainingRun.tsx` renders the
  literal string `epoch <n>`, which is one family's vocabulary hardcoded in a screen. It
  becomes declared data, and `no-task-specific-code` gains something to catch.

## Deferred

Split out when the frame is complete, not before:

- Fitting the tree offline (`training/`, best-first growth to a leaf budget) and emitting a
  real growth history indexed by splits added.
- Measuring the fitted-versus-held-out gap and gating the ship on it widening with the
  budget.
- Measuring the fitted tree against a declared reference tree and recording the margin.

`design.md` keeps the thinking behind all three; the decisions it records about tie-breaking,
log loss, smoothing and the history axis stand and should be honoured when the fitting lands.
This is the deferral `CLAUDE.md` asks for: none of it can be judged until the frame it is
measured through exists, and all of it is cheap to redo and expensive to keep re-deciding.

## Capabilities

### New Capabilities
- `fitted-tree`: the family, the node budget as its capacity, the shipped-model artifact and
  what it must contain, leaves as distributions, and the placeholder's honesty condition.

### Modified Capabilities
- `prediction-artifacts`: the four requirements written against an epoch-trained,
  per-image-distribution family, generalized to admit a shipped model.

## Impact

A family declaration and catalog entries binding each purchasable node budget to a covered
configuration, which `progression-catalog`'s *Nothing for sale opens a configuration no model
was trained for* then checks unchanged; placeholder tree artifacts and their reader; a tree
evaluator in `src/families/` reading `src/features/` and nothing else; the family's drawing;
the step label out of `TrainingRun.tsx`. The convolutional artifacts are untouched.

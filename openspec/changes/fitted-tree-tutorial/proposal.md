# Fitted tree tutorial

Authored 2026-09-09. Scaffolded 2026-09-08 from the same explore session as
`model-tutorials`, which is the frame this fills — and which has since landed: the frame,
both registries, the gate, the save field and the workshop affordance are all in the build,
with no kind registered and no `tutorial` block in any declaration. This change supplies the
first and only body either change plans.

Read `openspec/specs/model-tutorials/spec.md` before anything else — that change is archived
under `openspec/changes/archive/2026-09-09-model-tutorials/` and its spec is now shipped —
then `Game_design.md` §1.1 on where a simplification has to be disclosed, and
`openspec/specs/measured-features/spec.md` on what a measured feature is allowed to be
contaminated by. `fitted-tree` is the model this introduces and is not yet built; this change
is sequenced after it so that it lands playable rather than inert — see *Impact*.

## Why

The puzzle a student solves once, for free, between buying the fitted tree and putting it to
work. Until it lands the gate has no body, so `model-tutorials` ships inert by design.

The tree's questions are given, printed on the branches. The leaves are empty. A tray holds
one apple per declared category, and the student says what each bucket is *for* by dropping
an apple into it. A test affordance then runs nine real apples out of the browsable set
through the given splits and shows where each one actually landed.

```
                 dark patch > 0.0205 ?
                    /             \
                 yes               no
                 /                   \
         [ drop an apple ]      redness > 0.4513 ?
          t-006 t-013 t-134       /            \
                               yes              no
                               /                  \
                      [ drop an apple ]      [ drop an apple ]
                       t-025 t-163 t-043       t-016 t-193
                       t-074  <-- wormy

  TRAY:  (wormy)  (red)  (green)              [ TEST THE TREE ]
```

That teaches one claim, and it is a true one: a tree asks a question, follows one branch or
the other, and every apple ends up in exactly one leaf, which carries the outcome. A student
can trace a single apple all the way down, which is the property that makes this family
worth standing on before the network's opacity arrives.

The stub's illustrative thresholds were wrong and are corrected above. Over the shipped
pool, `darkSpotArea > 0.06` catches **one apple in two hundred** — the declared range tops
out at 0.07. The honest cut is 0.0205, which is also the one the exhaustive search in
`src/features/rules.ts` finds. Numbers a spec carries as examples should be the real ones.

## What Changes

- **The apple is the label.** Dropping a red apple into a leaf means *this leaf says red*.
  There is no separate outcome vocabulary on screen, which is what keeps the puzzle small —
  and it names a **category**, never an action. The task's declared `categoryActions` turns
  that into crating or discarding exactly as it does everywhere else, so the puzzle reads
  from declarations the task already carries and the no-task-specific-code invariant
  survives without special pleading.

- **Every apple carries its declared category label beside its picture.**
  `colour-vision-safety`'s *Colour is never a category's only cue on a screen* applies as
  directly here as anywhere in the build: the tray holds a red apple and a green one, and
  choosing between them is the entire interaction. So each tray item and each filled leaf
  shows the category's declared label as text, and the drop is never a colour judgement. It
  is worth stating rather than assuming, because the puzzle's central conceit — the apple *is*
  the label — is exactly what tempts an author to drop the words.

- **Nine real apples, not drawings.** Each is declared by its pool image id, its true
  category and the measured values of the two features the tree asks about, copied from the
  manifest and pinned by a test the way `test/features-ladder.test.ts` pins its figures. Real
  images cost a dependency on the browsable split; drawings could only *depict* the failure
  that real apples **are**, and a depicted failure is one a student can dismiss as staging.

- **The perfect labelling still misfiles an apple, and that apple is the lesson.** `t-074` is
  a wormy apple whose measured dark-patch area is **exactly 0**, so the given tree sends it
  down the red branch and no labelling can save it. That is `measured-features`'
  `contaminatedBy` delivered in one photograph, in the one place a student is looking closely
  at a single apple, for free.

- **The escapee has to be drawn from the held-out images, because that is the only place one
  exists.** All four wormy apples that escape this tree on the browsable set — `t-027`,
  `t-074`, `t-092`, `t-107` — carry `role: heldOut`. Not one is among the fitted 160, which is
  why the searched rule scores 1.000 there. The train/held-out gap this whole rung exists to
  teach is, on these two splits, four named apples; the puzzle must take one of them or show
  nothing.

- **The mark is the labelling, not the classification.** The stub's open question — perfect
  labelling or a share? — conflated two things. A *perfect labelling* gives each leaf the
  category that is most of what lands in it; it always exists, is unique here, and is
  reachable however contaminated the features are. *Perfect classification* is not reachable
  and must not be. The pass condition is therefore a declared minimum number of apples filed
  correctly, which at eight of nine is the perfect labelling and needs no share nobody can
  justify. The residual misfiled apple is the lesson rather than a failure the student is
  graded on.

- **MODIFIED for `model-tutorials`, in three places.** The stub expected none and said that
  finding one would be a signal worth raising rather than absorbing. It is that signal, and
  all three are narrownesses in the body contract rather than mistakes in the gate:
  1. `TutorialKind.check(puzzle, at)` is handed no task declaration, so no kind can refuse a
     puzzle that names a category or a feature the task does not declare. It gains the
     declaration.
  2. `TutorialBodyProps` carries `puzzle` and `onAttempt` and nothing else, so no body can
     draw a pool image. It gains the browsable split the workshop already loads for the
     training browser, and a tutorial whose images cannot be fetched is refused **on screen
     with the cause** — the one refusal in this area that cannot happen at load, because the
     pool is fetched per screen and the validator never sees it.
  3. Nothing obliges a tutorial to say what it withholds. §1.1's rider does, so the frame
     should require it of every kind rather than leave it to each body's copy.

- **What the tutorial withholds is stated in plain view.** It gives the questions. Choosing
  the questions is what fitting *is*, and it is what the student just paid for. A puzzle that
  let a student believe a tree's splits are handed down would teach the wrong half and fail
  §1.1 in the direction that matters. **This departs from the stub**, which put the whole of
  the theory copy under the tree: theory stays behind the help disclosure, where every other
  screen in this build puts it, and the *disclosure* becomes a declared field of its own that
  the frame renders under the puzzle, always visible. One sentence that lands beats three
  paragraphs that are scrolled past whether they are collapsed or not.

- **The simplification is the one the real model removes, on purpose.** A dropped apple is a
  leaf that says *red* — a degenerate one-hot. `fitted-tree`'s leaves say *70% red, 30%
  wormy*, and the declared policy turns that into an action. The student holds the simplified
  version minutes before meeting the honest one, with a concrete contrast instead of a
  paragraph. That sequencing is the point of putting the puzzle here rather than in the
  market.

- **The tutorial does not put the guess back, and `model-tutorials` should stop saying it
  does.** That proposal justifies itself partly on the tutorial restoring the hand-guessed
  threshold the dropped rung 1 was carrying. This puzzle gives the questions, so nobody
  guesses a threshold, and §2's floor — *genuinely a bit better than the one below* — is left
  with no anchor in the game. Recorded here as a known gap rather than quietly not done:
  `fitted-tree`'s floor story needs a different anchor, and the surviving stub
  `decision-tree-builder` needs a decision about whether it is live, superseded, or reduced
  to the thing that sells the node budget.

- **Only the two features the tree asks about are shown.** A tree asks about what it asks
  about, so showing all five would invite a question the puzzle cannot answer — and one of
  the five, `spotCount`, would answer it far too well. See the note added to
  `heirloom-cultivars`, which is where that finding belongs.

- **Nine apples rather than the whole split, deliberately.** `training-browser`'s *No
  per-split summary of a measured feature* forbids any distribution, range, average or count
  of a measured feature for either split. A test affordance tallying "46 apples landed here"
  over two hundred images is such a distribution; nine named apples are nine apples. Small
  also keeps the reveal concrete — *this* apple went *there* — which is the reading the
  lesson wants anyway.

- **The puzzle's split count is its own declared list, not `ruleBudget.maxNodes`.** They are
  neighbours and will be confused. `ruleBudget` sizes the *reference rule* the exhaustive
  search finds, which `fitted-tree` measures its floor against; this is a fixed authored
  puzzle. One is searched, one is written. Declaring them separately is what stops a change
  that resizes the puzzle from silently re-recording a measured figure. `src/task/types.ts`
  still documents `ruleBudget.maxNodes` as the largest hand-written rule the task *will ever
  offer*, which is now true of nothing; `fitted-tree` owns that correction and has not made
  it.

- **A load-time winnability check for this puzzle's shape.** The best achievable agreement
  under the declared splits over the declared apples, compared against the declared mark. Bad
  authored data is refused at load with the cause named, not discovered on screen.

- **Retries are free and unlimited, and nothing about the attempt is recorded.** Only
  completion, per `model-tutorials`. This change adds nothing here and must not.

## Resolved questions

- **Real pool images, or authored drawings?** **Real, nine of them.** The measurement decided
  it: the contamination the lesson needs is present, specific and nameable in the shipped
  pool, and a drawing of it is a claim rather than a demonstration. The cost is the second
  amendment above.
- **Does the mark require a perfect labelling, or a share?** **Neither, as posed.** A declared
  minimum count, which at eight of nine *is* the perfect labelling — see *The mark is the
  labelling*.
- **Does the puzzle also ask for a threshold?** **No.** Leaves only. The alternative grows the
  puzzle towards the rung-1 builder that was dropped, and the cost is recorded above as the
  unanchored floor rather than absorbed.

## Capabilities

### New Capabilities
- `fitted-tree-tutorial`: the puzzle's declared data and what refuses it, the apple-as-label
  interaction, the test affordance and what it is required to reveal, the disclosure the
  puzzle must make, the mark and the winnability check for this shape, the declared category
  label every apple carries beside its picture, and what happens while its images load or fail
  to.

### Modified Capabilities
- `model-tutorials`: three narrownesses in the body contract. A kind's checker gains the task
  declaration, so a puzzle naming an undeclared category or feature is refused at load. A body
  may be handed the task's browsable images, and a tutorial whose images cannot be fetched is
  refused on screen with the cause — the one refusal here that cannot happen at load. And a
  tutorial states what it simplifies in plain view, which makes §1.1's rider structural rather
  than a property of one body's copy.

## Impact

A puzzle declaration on the fitted-tree family in `declarations/apple-harvest.json` and its
copied feature values, pinned against the manifest by a test. One entry in each registry: `src/tutorials/`
gains the kind — its checker, its winnability decision and its judge, all pure — and
`web/src/components/tutorial/TutorialBody.tsx` gains the body, which is the only new screen.
`TutorialBodyProps` and `TutorialKind.check` widen by one field each, `TutorialDeclaration`
gains the disclosure, and `Tutorial.tsx` renders it under the puzzle. `ConfigureTask.tsx`
forwards the `loadSplit` it already holds. Reads `src/features/` for nothing but the
`RuleSplit` shape; reads no pixels and no generation attribute.

No artifact is touched and nothing is retrained. **It lands after `fitted-tree`**, and
`design.md` records why: attaching the puzzle to the shipped convolutional family would gate
the only model the game currently has behind a lesson about a different one, and shipping a
kind no declaration references would leave two changes in a row that cannot be played
through. `fitted-tree` ships its family with no tutorial — which the frame supports outright —
and this change adds the block that turns the gate live for that family alone. Authoring does
not depend on that order, which is why the specs can be written before it lands. If
`fitted-tree` slips, the fallback is to land the kind, the body and the puzzle data with a
test that plays it end to end, and let `fitted-tree` add one line to a declaration.

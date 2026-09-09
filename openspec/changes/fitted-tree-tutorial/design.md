# Design

## Context

See `proposal.md` — *Why*. What is already built and constrains the approach:

- **`model-tutorials` has landed.** `src/tutorials/index.ts` holds `TutorialKind`
  (`check` / `winnable` / `judge`) and an empty `TUTORIAL_KINDS`;
  `web/src/components/tutorial/TutorialBody.tsx` holds an empty `TUTORIAL_BODIES` and a
  dispatcher that does nothing else; `Tutorial.tsx` is the frame; a test asserts the two key
  sets are equal. `src/task/validate.ts` calls `check` and then `winnable` at load.
- **Three seams are narrower than this puzzle needs**, all discovered by reading the shipped
  code rather than the spec: `check(puzzle, at)` receives no task declaration;
  `TutorialBodyProps` is `{ puzzle, onAttempt }`; `TeachingCopy` is `{ summary, theory }` and
  the frame renders `theory` inside a `HelpDisclosure` above the body.
- **The pool is fetched per screen, not at startup.** `web/src/data/pool.ts` explains why: the
  manifest is 338 KB and one atlas 544 KB, for a view a student may never open. So
  `validateDeclaration` never sees a pool, and load-time winnability cannot read a measured
  feature out of one.
- **`ConfigureTask` already holds `loadSplit`**, the injected loader that gives
  `TrainingBrowser` its images. `SplitImageView` carries id, category, declared label, atlas
  URL and cell region — and deliberately drops both the generation attributes and the measured
  feature values.
- **`src/features/rules.ts`** defines `RuleSplit` as `{ feature, threshold }` and `applyRule`
  as a chain of such questions with an action at every exit. The puzzle's tree is exactly that
  chain shape, with categories where the actions are.
- **The measured facts this design rests on**, taken from `pools/apple-harvest/manifest.json`
  over the 200 browsable images, under `darkSpotArea > 0.0205` then `redness > 0.4513`:

  ```
    leaf 1  dark patch      46 wormy                          pure
    leaf 2  red             100 red + 4 wormy                 96%
    leaf 3  otherwise       50 green                           pure

    the four:  t-027  t-074  t-092  t-107      all role: heldOut
               t-074's darkSpotArea is exactly 0
  ```

## Goals / Non-Goals

**Goals:**

- A kind whose `check`, `winnable` and `judge` are pure functions of declared data, so the
  load-time refusal `model-tutorials` requires is actually computable.
- Real photographs on screen without the engine ever depending on a fetched pool.
- Amendments to `model-tutorials` that are the smallest ones that work, each argued against
  the alternative, so the next body does not have to widen the contract again.
- A puzzle whose reveal is one named apple rather than a statistic.

**Non-Goals:**

- Anything the frame already owns: the modal, the gate, the completion record, the free and
  unlimited retries. This change adds nothing there and must not.
- A second kind of tutorial. The registry exists so the next one is a leaf.
- Any change to `src/features/rules.ts`, the pool, or any artifact.
- Choosing the questions. That is `fitted-tree`'s subject, and withholding it here is
  deliberate and disclosed.

## Decisions

### The puzzle declares its apples, with the feature values copied from the manifest

**Chosen:** each apple is `{ image, category, features }` — the pool image id, the true
category, and the measured values of *only* the features the declared splits ask about,
copied from `pools/apple-harvest/manifest.json`. A test pins the copies against the manifest,
the way `test/features-ladder.test.ts` pins its measured figures.

This is what makes `winnable(puzzle)` computable at the moment `validateDeclaration` calls it.
Everything the load-time check needs — the splits, the routing, the categories, the mark — is
in the declaration, and the pool is needed for pixels alone.

**Alternatives considered.** *Read the features live from the pool:* the honest version, and
impossible where it is needed — the validator has no pool and acquiring one there would put a
900 KB fetch in front of the farm's first paint, which `web/src/data/pool.ts` exists to avoid.
*Generate the puzzle block at build time from the manifest:* removes the drift, and removes
the property that a lesson is a data change a person can read; the pinning test buys the same
protection without a generator. *Authored drawings, no pool at all:* rejected in the proposal
— a drawn escapee is a claim, and the shipped pool contains a real one.

### Only the features the splits ask about are declared, and only those are shown

Two features, not five. A tree asks about what it asks about, and a panel of five numbers per
apple invites the question *why not that one instead* — which this puzzle cannot answer,
because it does not choose questions, and which the shipped feature set answers far too well
(see the note on `heirloom-cultivars`).

It also shrinks the copied data to eighteen numbers, which is the difference between a pinning
test that reads and one that is skimmed.

**Alternative considered:** declare the whole vector per apple, show the two. Rejected —
copying data nothing reads is the drift risk without the benefit.

### The mark is a declared minimum count of correctly filed apples

`judge` files each apple by walking the declared splits, applies the submitted labelling, and
passes when the number of apples whose leaf label equals their true category reaches the
declared mark. `winnable` computes the *best achievable* count — for each leaf independently,
the category that is most of what lands in it — and refuses at load when that maximum is below
the mark, naming both numbers.

This dissolves the stub's open question rather than answering it. At nine apples and a mark of
eight, the mark *is* the perfect labelling; the number is declared data, so a later puzzle can
sit anywhere between without the kind changing. And per-leaf independence is what makes the
maximum cheap: a rule's leaves partition the apples, so the best label for one leaf does not
depend on any other — the same argument `bestRule` makes for not searching leaves.

**Alternative considered:** hard-code *the perfect labelling is required*. Rejected — it puts
a policy in code that the frame already asked to be declared, and the two numbers a refusal
needs to name would have nowhere to come from.

### The splits reuse `RuleSplit`; the routing is written in the kind

The declared splits are `readonly RuleSplit[]` from `src/features/rules.ts`, so a threshold
means the same thing in the puzzle that it means in the search and in whatever
`decision-tree-builder` becomes. The walk itself — which leaf index an apple reaches — is a
three-line loop in the kind rather than a call to `applyRule`.

`applyRule` returns an `ActionId`. This puzzle's leaves carry **categories**, deliberately and
as its central claim, so routing through it would mean labelling leaves with actions and
mapping back — inverting the thing the puzzle exists to teach.

**Alternative considered:** extract a shared `leafOf(splits, features): number` from
`applyRule` and have both use it. Genuinely the better factoring, and premature: one caller
today, and the second (`decision-tree-builder`) has not been decided as live. Recorded here so
that change can do it with a reason rather than discovering it.

### `TutorialKind.check` gains the task declaration

`check(puzzle, at, declaration)`. Without it no kind can refuse a puzzle naming a category the
task does not declare or a feature it does not measure — and this puzzle's whole claim is that
its apples name *declared categories*, which `categoryActions` then turns into actions. A
claim the validator cannot check is a claim that will drift.

The frame stays family-agnostic: a task declaration is not a family, and nothing in the frame
branches on which family is being taught.

**Alternative considered:** a cross-declaration checker beside `tutorialAgreementIssues`,
which is the existing precedent for a check the per-declaration validator cannot make.
Rejected — that function is generic over tutorials by design, and teaching it one puzzle's
shape would put the puzzle's data model in the frame, which is the one thing the registry
exists to prevent.

### The body is handed the browsable split the workshop already loads

`TutorialBodyProps` gains one optional field: the same `() => Promise<Loaded<TrainingSplitView>>`
that `ConfigureTask` already passes to `TrainingBrowser`. `ConfigureTask` forwards it; the frame
passes it through and does not read it.

No new fetch path, no new projection, and no measured feature crosses the boundary
`web/src/data/pool.ts` closed — the body needs `SplitImageView` for the atlas region and
nothing else, because the numbers are in the puzzle.

Loading and refusal are states of the *body*, exactly as they are states of `TrainingBrowser`
rather than of the app. A body whose images will not load shows the cause and offers no
attempt, which is the one refusal in this area that cannot be made at load.

**Alternatives considered.** *React context:* the body would read ambient state, which is
precisely what *a body is used directly* forbids in spirit even where it does not name it, and
it would make the body untestable without a provider. *The body fetches for itself from
`taskDataPaths`:* puts app wiring in a leaf and breaks the injection pattern every other
loader in `web/` follows. *Hand the body a whole `LoadedPool`:* hands it the generation
attributes, which `measured-features` made structurally unreachable in the browser and which
must stay that way.

### The disclosure is its own declared field, rendered in plain view; theory stays behind the button

`TutorialDeclaration` gains a required `disclosure: string`. The frame renders it under the
body, always visible, unstyled as an aside. `teaching.theory` stays inside the
`HelpDisclosure` where it is today.

This departs from the stub, which put the theory copy itself under the tree. Two reasons.
Every screen in this build puts theory behind a help button, and the project's own constraint
says so; moving one screen's theory out makes the tutorial the exception without making it
better, because three paragraphs under a puzzle are scrolled past exactly like three
collapsed ones. And §1.1's rider is about **one sentence** — *the real thing picks the
questions too* — which is a different object from theory: it is the tutorial telling the truth
about itself. Giving it a field of its own makes the obligation structural for every kind that
is ever added, rather than a property of one body's prose that a later author can quietly drop.

**Alternatives considered.** *Render `teaching.theory` open, below the body:* the stub's
version; one line of code and it makes every future tutorial's theory a wall under its puzzle.
*Let the body render its own copy out of `puzzle`:* no frame change at all, and teaching copy
would then be declared in two places with nothing holding them to the same standard.

### Testing is not attempting, and testing first is not cheating

The test affordance belongs to the body and calls nothing. `onAttempt` is the only route to a
judgement, and `judgeAttempt` in the engine is the only judge — so what the screen calls
passing and what the gate calls passing stay one decision, which is why `Tutorial.tsx` judges
rather than the body.

A student can test before submitting, watch where the apples land, and read the answer off the
leaves. That is the intended path, not a hole: completion is the only thing recorded, retries
are free and unlimited, and the reveal *is* the lesson — including that the label they can now
read off leaf 2 still misfiles `t-074`. A puzzle that hid the routing until after judgement
would be a quiz, and `model-tutorials` was explicit that a tutorial is not one.

### Nine apples, named, with the escapee taken from the held-out role

```
  leaf 1   dark patch > 0.0205     t-006 (fitted)  t-013 (fitted)  t-134 (heldOut)   wormy
  leaf 2   redness   > 0.4513      t-025 (fitted)  t-163 (fitted)  t-043 (heldOut)   red
                                   t-074 (heldOut) ................................ wormy
  leaf 3   otherwise               t-016 (fitted)  t-193 (fitted)                    green

  best achievable labelling: wormy / red / green = 8 of 9, and it is unique
```

Six fitted, three held-out — mixed on purpose, so the set does not read as a special case. The
escapee has to be one of `t-027`, `t-074`, `t-092`, `t-107` because those are the only apples
in the browsable set this tree gets wrong, and all four are held out. `t-074` is chosen among
them for measuring **exactly 0** dark patch while being wormy: the strongest single statement
of `contaminatedBy` the pool contains.

**Alternative considered:** an escapee from the fitted 160. There is none. That is not a
constraint to work around, it is the train/held-out gap, and it is the reason this puzzle can
show one at all.

### Each tray apple carries its declared category label

`colour-vision-safety`'s *Colour is never a category's only cue on a screen* applies directly:
the tray's apples are a red one and a green one, and the whole interaction is choosing between
them. So each tray item and each filled leaf shows the category's declared label as text
beside the picture, and the drop is never a colour judgement. This is a requirement to write
down rather than a detail, because the puzzle's central conceit — the apple *is* the label —
is exactly the thing that tempts an author to drop the words.

### Both gestures put an apple in a leaf

**Chosen:** pointer dragging *and* click-an-apple-then-click-a-leaf, both live at once, both
producing the same labelling.

Dragging is the gesture the puzzle's own language implies and the one a student reaches for
with a tray of apples on screen. It is also the one that has no keyboard story, so it cannot
be the only one: the click path is what makes the puzzle reachable without a pointer, and
building it second — after the drag works — is how a keyboard fallback ends up not being
built. Both from the start, and the tests cover the labelling through each.

The cost is two interactions to hold correct instead of one. It is bounded: they converge on
one operation — *this category, that leaf* — so only the gesture layer differs, and the
judgement never sees which one was used.

**Alternatives considered.** *Click-to-assign only:* accessible by construction and one thing
to build; rejected because the drag is the affordance that makes the tray legible as a tray.
*Drag only:* rejected outright — it would ship a puzzle a student cannot solve with a keyboard,
in the one screen of the build that is a required gate.

### The change lands after `fitted-tree`, so it lands playable

`model-tutorials` shipped inert deliberately: a gate with no puzzle is a wall. Shipping a kind
no declaration references would be the mirror of that — a puzzle with no gate — and it would
leave two changes in a row that cannot be played through.

So the sequence is `fitted-tree`, then this. `fitted-tree` ships its family with no tutorial,
which the frame supports outright (*a family declaring no tutorial is gated by nothing*), and
this change adds the `tutorial` block to that family and turns the gate live for it alone.
Authoring is independent of that order, which is why the specs can be written now.

**Alternative considered:** land it first and attach the puzzle to the shipped convolutional
family. Rejected — it would gate the only model the game currently has behind a lesson about a
different family, which is a wall with the wrong sign on it. *Fallback if `fitted-tree` slips:*
land the kind, the body and the puzzle data with a test that plays it end to end, and let
`fitted-tree` add one line to a declaration. Worse, and available.

## Risks / Trade-offs

- **This is the second time `model-tutorials`' contract moves, and the next body will cite
  it** → the three amendments are each argued above against their alternatives, and two of
  them make the frame *stricter* rather than looser (a checker that can refuse more, a
  disclosure every kind must carry). The one that loosens — the body may be handed images —
  is stated as an optional field a body declares it needs, so a body that needs nothing still
  satisfies *used directly* with its declared data alone.

- **The copied feature values drift when the pool is regenerated, and `heirloom-cultivars`
  will regenerate it** → the pinning test fails loudly and names the values, which is the
  cheap half. The expensive half is real: a new seed can dissolve the four escapees
  altogether, at which point `winnable` refuses the task at load and someone has to pick nine
  new apples by measuring. Named here so that change can budget for it rather than discover
  it, and it is one more reason §9 says regenerate once.

- **A student could read "worms always have big spots" off nine apples** → `t-074` sitting in
  leaf 2 is the counterexample, in the leaf, on the same screen, and the disclosure under the
  puzzle is about what the tree does not choose rather than about what worms look like. The
  per-category breakdown the harvest report already owes is where the general version of this
  guard lives.

- **A sharp student asks why the tree does not use off-colour patches** → and today the honest
  answer undoes the lesson, because that feature separates wormy apples perfectly on both
  splits. Showing only the two features the tree asks about keeps the question from being
  posed by the screen; it does not stop a student who has opened the training browser. The fix
  is not in this change — see the note on `heirloom-cultivars`.

- **Held-out images appear on screen before anything is trained** → they already do; the
  training browser shows the whole browsable split, and the roles are a property of the
  fitting pipeline rather than a secret. Worth stating because the escapee's provenance is
  load-bearing, and a later change that hides held-out images would break this puzzle.

- **Nine apples is a sample, and the test affordance is close to a tally** → nine named apples
  with their two numbers is not a distribution, range, average or count of a measured feature
  for a split, which is what `training-browser` forbids. Keeping the set small is what keeps
  that true; a puzzle over the whole split would not be.

## Migration Plan

1. Amend the frame: `check` gains the declaration, `TutorialBodyProps` gains the optional
   image loader, `TutorialDeclaration` gains `disclosure`, `Tutorial.tsx` renders it under the
   body. Existing tests and the fixture kind move with it; no declaration carries a tutorial
   yet, so nothing on screen changes.
2. Land the kind in `src/tutorials/` — `check`, `winnable`, `judge`, all pure — with the nine
   apples' data and its pinning test against the manifest.
3. Land the body in `web/src/components/tutorial/`, its loading and refusal states, and the
   `loadSplit` forwarding in `ConfigureTask`.
4. Add the `tutorial` block to the fitted-tree family's declaration. The gate goes live for
   that family and for nothing else.

Rollback is removing the block: the gate is inert again with no code reverted, exactly as
`model-tutorials` arranged.

## Open Questions

- **The wording of the disclosure sentence.** It has to say that the real thing picks the
  questions too, in one sentence a high-school student reads without stopping. Declared data,
  changeable without touching code, and it does not move the specs or the tasks.
The tray's interaction was one of these and is now decided — see *Both gestures put an apple
in a leaf* above.

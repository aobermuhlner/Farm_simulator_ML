# Tasks — workshop, then harvest

Read `design.md` before starting; the ordering below follows its decisions and several
tasks only make sense against them. Both of `design.md`'s open questions are deliberately
deferred — neither changes what is built here.

**One decision taken while writing this list, not in `design.md`:** the harvest **banks
what is currently computed**. A model-worked card is scored by today's `runPool` over the
evaluation pool and its earnings reach the balance, so the loop is playable and the
picking robot becomes a purchase that leads somewhere. The figure is wrong — it is the
whole pool rather than a year's crop — and replacing it is `harvest-scoring`'s job. The
seam is `recordHarvest(farm, total)`, which does not change either way, so paying nothing
instead would cost the same work and ship a farm where fielding a model earns zero.

## 1. Labour: who works a card

- [x] 1.1 Add `src/labour/` with a fielded-model record (configuration id, and a family id
      field reserved per `design.md` decision 3) and a resolver that answers, for one task
      and one farm's slots, whether the crop is brought in by a model or by the farm's
      manual labour — absence of a slot resolving to manual labour. Verify with unit tests
      covering: no slots at all, a slot for a different task, and a filled slot.
- [x] 1.2 Add a resolver for which tasks are playable — declaration `available` and
      unlocked by progression — and verify an announced task and a locked task are both
      excluded while an available unlocked one is included.
- [x] 1.3 Replace the ownership reading of automation in `web/src/App.tsx`
      (`automated = owned.includes(declaration.automation.item)`) with the labour resolver,
      so hand sorting is offered from what is *working the orchard* and not from what is
      owned. Verify with a test that a farm owning the automation item but with no model at
      work still gets manual labour, which is the defect the proposal names.

## 2. The save

- [x] 2.1 Bump the save schema and add the labour slots per task to `GameState` and the
      serialized farm, with round-trip tests in `test/save-codec.test.ts`.
- [x] 2.2 Add the year-in-progress record — the year it belongs to, and what each card has
      brought in so far — to the save, and verify it round-trips and that a save written
      without it restores as a year not yet run.
- [x] 2.3 Add the most recently closed year's per-card summary — per-category and
      per-action counts and what that card paid, nothing finer, per `design.md` decision 8
      — and verify it round-trips and that no per-image decision is written.
- [x] 2.4 On restore, drop a labour slot naming a configuration that no longer resolves,
      revert that card to manual labour, and report it as a dropped-progress notice the way
      dropped knob values already are. Verify in `test/save-codec.test.ts` that the farm
      opens, the card is on manual labour, and the cause is reported.
- [x] 2.5 On restore, drop a year-in-progress whose year is not the farm's current year,
      re-opening the year. Verify the balance, ledger and year are untouched and the cause
      is reported.
- [x] 2.6 Verify a save written by the previous schema resets with its cause reported —
      `design.md`'s migration plan — through the existing reset path.

## 3. Closing a year across several cards

- [x] 3.1 Add, beside `src/economy/farm.ts`, the accumulation a year in progress needs:
      record what one card brought in without touching the balance, the ledger or the year.
      Verify with unit tests that any number of accumulations leave all three unchanged.
- [x] 3.2 Add the close: when every playable card has been brought in, call `recordHarvest`
      once with the total. Verify one ledger record is appended for the closing year, the
      total is the sum across cards, and the year advances by one — the `game-economy`
      delta's *Several crops close one year between them*.
- [x] 3.3 Verify a year left in progress credits nothing: bring one of two cards in, abandon
      the year, and assert the balance, the ledger and the year are as they were before it
      was run — the delta's *A year abandoned in progress costs nothing and pays nothing*.
- [x] 3.4 Verify a single-playable-card farm closes its year in one step, so the in-progress
      state is invisible at today's card count.

## 4. The workshop loses the run

- [x] 4.1 Remove *Run a month*, the `harvest()` handler and the `Report` child from
      `web/src/screens/ConfigureTask.tsx`, and update `ConfigureTask.test.tsx` so the
      screen is asserted to offer no way to run the year and no earnings figure — the
      spec's *The year cannot be run from the workshop*.
- [x] 4.2 Add a control beside *Train model* that puts the trained configuration to work,
      offered only at the `trained` stage. Verify it is absent when untrained, absent after
      a knob change, and present once the replay has finished.
- [x] 4.3 Wire it through `web/src/App.tsx` to write that task's labour slot, and verify the
      slot persists across a reload of the app in test.
- [x] 4.4 Add a control that hands the job back to manual labour for a card at work, and
      verify the slot returns to manual labour without touching the balance or the year.
- [x] 4.5 Verify that changing knobs and training a different configuration without putting
      it to work leaves the slot as it was — the spec's *Tinkering does not change what is
      at work*, and the distinction `design.md` decision 2 exists to protect.
- [x] 4.6 Verify the workshop moves no money: enter, browse, train repeatedly, put to work
      and hand back, and assert the balance, the year and the ledger are unchanged.

## 5. The card and its slot

- [x] 5.1 Add the manual labour's icon and label to `declarations/farm.json` and its
      validator in `src/task/validate.ts` (or the farm declaration's validator), with tests
      for a declaration that supplies them and one that does not.
- [x] 5.2 Render the labour slot on each playable task card in
      `web/src/screens/FarmOverview.tsx`, presenting the icon and label it is handed, with
      the label reachable on hover and to assistive technology. Verify a playable card shows
      the declared manual labour and an announced card shows no slot.
- [x] 5.3 Verify a farm declaring a different icon and label for its manual labour renders
      through the same screen with no screen change, and extend
      `web/src/no-task-specific-code.test.tsx` so the slot naming a family, an icon or a
      label in screen code fails the suite.
- [x] 5.4 Verify a card at work by a model presents that model in its slot rather than the
      manual labour, and that other cards' slots are unaffected.

## 6. Running the year

- [x] 6.1 Add the run-the-year control to the overview, naming the year it will run, with a
      confirmation before it runs. Verify it is present on a farm with no model at work —
      the spec's *A farm that has put no model to work can still run its year* — and that
      declining the confirmation runs nothing.
- [x] 6.2 On confirmation, bring in every card whose slot holds a model without further
      input, accumulating each into the year in progress. Verify a two-card farm both at
      work resolves both and closes the year in one act.
- [x] 6.3 Route a card whose slot holds manual labour into `HandSort`, and change its
      settlement from calling `recordHarvest` directly to accumulating into the year in
      progress. Verify the wage is shown in the summary while the balance stays unchanged
      until the year closes, and update `test/sorting-tally.test` and
      `web/src/screens/HandSort.test.tsx` accordingly.
- [x] 6.4 Show what is still outstanding on the overview while a year is in progress, and
      verify the year is not presented as closed and the run control is not offered again.
- [x] 6.5 When a card at work by a model cannot be brought in — its configuration will not
      fetch or resolve — present the refusal with the engine's cause, leave the year open,
      and substitute no other labour. Verify with an injected failing `loadEntry`.
- [x] 6.6 Verify a closed year cannot be run again: the control names the following year,
      and re-entering manual labour for the closed year credits nothing, which
      `manual-sorting` already requires.

## 7. The report moves to the card

- [x] 7.1 Offer the most recently closed year's report from each playable card, mounting the
      existing `web/src/screens/Report.tsx` from the overview. Verify entering it runs
      nothing and changes no labour slot.
- [x] 7.2 Have the report name the year it belongs to, alongside the configuration
      identifier for a model-worked card. Verify both are shown, and update
      `web/src/screens/Report.test.tsx`.
- [x] 7.3 Have a manual-labour card's report identify that labour and name no configuration
      identifier. Verify it names neither a configuration nor an invented one.
- [x] 7.4 Verify a farm that has closed no year offers no report from any card, rather than
      an empty one.

## 8. The whole loop

- [x] 8.1 Add an end-to-end test over `web/src/App.tsx`: open a fresh farm, run the year by
      hand, assert one ledger record and the year advanced; then train, put the model to
      work, run the following year, and assert the slot changed, a second record was
      appended, and the balance moved once.
- [x] 8.2 Verify the farm bar still shows the year and the balance on the workshop, the
      market, manual labour and a report, per `simulator-shell`'s existing requirement.
- [x] 8.3 Run `npm run typecheck`, `npm test` and `npm run build`, and fix what the schema
      bump and the moved report broke across the suites the git status already lists as
      touching these files.
- [x] 8.4 Re-read the `simulator-shell` and `game-economy` deltas against what was built and
      correct either the specs or the code where they disagree, then run
      `openspec validate workshop-harvest-split --strict`.

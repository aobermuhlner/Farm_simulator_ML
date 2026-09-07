# Tasks — the labour resolver as stated behaviour

Read `design.md` first. Most of what the specs require is already implemented in
`src/labour/index.ts`; the work is two fixes plus giving each stated requirement a test that
names it. `design.md`'s two open questions are deliberately deferred — the first is a
message-quality choice inside one task, the second needs a second refusable card to answer,
and neither changes what is built.

Order matters only between groups 1 and 2 in one place: the separator refusal must land with
its tests before `configurationResolves` is touched, so nothing relaxes the parser while the
declaration contract is still permissive.

## 1. The separator cannot enter an identifier

- [x] 1.1 Add the identifier separator as a named constant beside `configurationId` in
      `src/task/configId.ts` and compose from it, so the validator and the composer cannot
      disagree about what the separator is. Verify existing `configurationId` tests still
      pass unchanged.
- [x] 1.2 Refuse, in `checkKnob` in `src/task/validate.ts`, a knob whose id contains the
      separator, with a new issue code naming the knob and its id. Verify with a
      `test/validate-declaration.test.ts` case asserting the code, the field and that the
      message names the offending id.
- [x] 1.3 Refuse a knob permitting a value whose written form contains the separator —
      covering both a hyphenated string value and a negative number — naming the knob and
      that value. Check the values the knob actually permits, walking a slider's range as
      `declaredValues` does, so a negative bound is caught by the value it produces. Verify
      with cases for a hyphenated choice value and for a slider with a negative minimum,
      each asserting the named knob and value. (`design.md` open question 1 is the choice of
      whether to name the bound or the walked value in the message; either satisfies the
      spec.)
- [x] 1.4 Verify every declaration in `declarations/` still loads: run the existing
      declaration tests (`test/apple-harvest.declaration.test.ts`,
      `test/farm-declaration.test.ts`, `test/catalog-declaration.test.ts`) and confirm no
      new refusal appears — `design.md`'s claim that the constraint is already satisfied.
- [x] 1.5 Now that the separator cannot appear in an id or a value, simplify
      `configurationResolves` where it was defending against that ambiguity, and verify
      `test/labour.test.ts` still passes plus a case asserting a well-formed identifier for
      every declared configuration of `apple-harvest` reads back to the values it was
      composed from.

## 2. A refused crop can have its job handed back

- [x] 2.1 Extend `web/src/App.tsx`'s harvest refusal state so a refusal is attributable to
      the task it refused, rather than a flat issue list. Verify with a test that two
      refused cards report separately.
- [x] 2.2 Pass, to `FarmOverview`, the refused tasks and a hand-back callback, and render a
      control per refused card that hands that card's job back. Verify in
      `web/src/screens/FarmOverview.test.tsx` that the control appears only for a refused
      card and carries wording that says what it does to the labour.
- [x] 2.3 Wire the control to the existing `handBack` in `web/src/App.tsx` — the same
      operation the workshop uses, at a second call site and with no new behaviour. Verify
      the slot returns to manual labour without touching the balance, the ledger or the
      year.
- [x] 2.4 Verify the end-to-end unblock in `web/src/App.farm.test.tsx`: a card at work whose
      artifact will not fetch refuses, the job is handed back from the overview, the card is
      then offered to be sorted by hand, and bringing it in closes the year — the
      `simulator-shell` delta's *Handing back from the refusal lets the year be closed*.
- [x] 2.5 Verify the engine substitutes nothing on its own: with a refused card and no hand
      back, the card is still shown at work by that model and is not offered to be sorted by
      hand — the delta's *The shell substitutes no labour of its own*.

## 3. Every stated rule has a test that names it

Extend the existing files rather than adding new ones; several of these are already covered
and the task is to confirm the coverage and name the requirement it serves.

- [x] 3.1 In `test/labour.test.ts`, add the `putToWork` cases the file lacks — filling an
      empty slot, replacing a filled one, and leaving other cards alone — and confirm the
      three `labourFor` cases already there cover *One labour per task*.
- [x] 3.2 Add a case for a task the stored progress holds no record for resolving to manual
      labour, so *A task the stored progress predates is worked by hand* is asserted at the
      resolver rather than only at the save.
- [x] 3.3 Confirm or add, in `web/src/App.farm.test.tsx`, the assertion that a farm owning
      everything a task's automation requires but with no model at work is worked by hand —
      `farm-labour`'s *What the farm owns does not decide who works*, and the defect most
      likely to regress.
- [x] 3.4 Confirm the four playability cases in `test/labour.test.ts` cover the delta's
      scenarios, and add the missing *silence opens rather than closes* case if
      availability-undefined is not already asserted distinctly from availability-present.
- [x] 3.5 Add a case asserting that opening a previously unavailable knob value leaves every
      slot resolving to the model it did — *A slot records the model that was made, not the
      settings it came from*.
- [x] 3.6 Confirm or add, beside the existing farm tests, that putting to work and handing
      back leave the balance, the ledger and the year untouched, and that neither alters a
      closed year or a crop already brought in within an open year.
- [x] 3.7 Confirm the stale-slot restore case in `test/save-codec.test.ts` asserts the cause
      is reported and no other model is substituted — the `game-save` delta's two new
      scenarios.

## 4. Verification

- [x] 4.1 Run the full test suite and the type check, and confirm no existing test was
      changed to accommodate this work other than the refusal-shape change in 2.1.
- [x] 4.2 Confirm `web/src/no-task-specific-code.test.tsx` still passes — the hand-back
      control added in group 2 must name no task and no model family.
- [x] 4.3 Run `openspec validate labour-resolver --strict` and confirm the change is valid.

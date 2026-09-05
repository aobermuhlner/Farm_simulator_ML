## Context

See `proposal.md` — Why. The requirements are in `specs/decision-policy/spec.md` and
`specs/simulator-shell/spec.md`; this document covers only how they are met and which of
the choices they left open were taken.

Five facts decide most of what follows.

**An action never enters an artifact.** `prediction-artifacts` stores a distribution over
*categories*, and `test/artifact-index.test.ts` asserts that an entry carrying a chosen
action is refused as `artifact-states-truth`. `src/task/configId.ts` composes knob ids and
values and nothing else. So adding an action, renaming one, or repricing the whole table
changes no configuration identifier and invalidates no artifact — the claim the proposal
makes loudly, and the reason this change is cheap.

**The screens already render actions rather than know them.** `Report.tsx` maps
`declaration.actions` into columns, and `web/src/no-task-specific-code.test.tsx` builds its
forbidden vocabulary out of the declaration itself, so a third action is caught by that
test automatically the moment a screen names one.

**The payoff table has exactly two consumers.** `scoreRun` sums its entries and the
cost-optimal policy weighs them; both already loop over the declared actions. Widening the
table is arithmetic over one more column, not a new code path.

**One policy hides a binary assumption, and it hides in the tie-break, not in the text.**
*Threshold policy* is already written over categories: each has a threshold, each maps to
an action. What was harmless with two actions is that ties resolve by declared category
order — with two actions every category that is not the fallback's points at the same
action, so the order could never pick the wrong one. With three distinct actions the
tie-break silently becomes the rule that decides *which* action, and declared category
order is the one order a task cannot change: `prediction-artifacts` binds it to the order
the stored probability vectors are indexed by.

**§4.1's table is degenerate and §4.2's fix is not ours to buy.** Paying +0.20 for crating
a wormy apple makes "crate everything" optimal under *Earnings are the sum of payoff
entries*. The co-op contract that fixes it properly is a batch-level term that breaks that
requirement, and `harvest-scoring` is the change that owns breaking it.

## Goals / Non-Goals

**Goals:**
- Three declared actions on the apple task, with a payoff table whose best-paying play is
  the play the task teaches — no correction deferred to a later change, no known-wrong
  numbers shipped as a placeholder.
- A general rule that catches a degenerate table at load, so the next task's author is not
  relying on taste to notice one.
- A threshold policy with a stated meaning over any number of actions, rather than one that
  happens to work for two.
- Proof, not assumption, that no artifact and no pool byte moves.

**Non-Goals:**
- The co-op contract, batch terms, or anything that makes earnings more than a sum. That is
  `harvest-scoring`, and this change deliberately stays inside today's requirement.
- Paying the farm. Nothing credits `game-economy` from a run yet; earnings remain a figure
  on a report.
- Retraining, repooling, or touching the artifact schema.
- Exposing the policy to the student. Knobs stay model-side; the threshold policy is
  declared data no screen offers to change.

## Decisions

### The shipped payoff table

Per apple, in the farm's declared currency:

|                 | crate as red | crate as green | discard |
|-----------------|-------------:|---------------:|--------:|
| **red apple**   |       +0.40  |         +0.20  |   0.00  |
| **green apple** |       −0.30  |         +0.20  |   0.00  |
| **wormy apple** |       −1.50  |         −1.50  |   0.00  |

Three things are being said at once.

*Red sold as green is not fined.* The +0.20 it earns instead of +0.40 is the whole penalty,
and a lost margin is a nicer thing for a student to discover than an arbitrary fine — it is
the mistake that costs you money without anyone telling you off, which is most mistakes.

*Green sold as red is fined,* because the buyer opens the crate. −0.30 is worse than
discarding the apple, so a model that cannot tell red from green is better off crating it
as green than gambling on red: exactly the hedging behaviour the cost-optimal policy should
discover.

*A worm in a crate costs the same whichever crate it is in.* The complaint is about the
worm, not the label, so both crating cells carry −1.50 — the linear fallback §4.2 names.
This is what keeps the two axes of the matrix independent: which crate an apple went into
is one kind of mistake, and whether it should have been crated at all is another.

The numbers are §4.1's and they tie to §4.5's economy rather than floating free: at 55%
red, 35% green, 10% wormy, perfect play is 0.29 per apple, which is the ~1 740 CHF on 6 000
apples §4.5 quotes for year one. The blanket strategies are the check that matters:
always-crate-as-red earns −0.035 per apple, always-discard earns 0.00, and
always-crate-as-green earns +0.030 — a tenth of perfect play, and positive only because
green apples are worth something. Under §4.1's uncorrected table the same blanket strategy
earned 65% of perfect play while never once discarding a worm, which is the trap inverted.

The current table's scale (+1.00 for a picked red) is dropped rather than rescaled. Nothing
consumes earnings yet, so nothing breaks, and matching §4.5 now means `harvest-scoring`
will not have to renumber a shipped declaration later.

### Degeneracy is refused by a declared rule, not caught by taste

The new requirement is that a category's declared action must strictly outpay every other
action in that category's row. Two weaker rules were considered and rejected: *no action
may weakly dominate all others* misses §4.1's table entirely (crate-as-red does not
dominate crate-as-green there), and *every declared action must be some row's best* catches
that table but says nothing about which action a row's best should be, so a table paying
best for the wrong treatment of one category still passes.

Agreement is the sharper statement because it is a claim about two declared fields
contradicting each other. `categoryActions` says what is correct; `payoffs` says what is
paid. When they disagree the declaration is not merely badly tuned, it is internally
inconsistent, and the consequences all point the same way: hill-climbing earnings stops
agreeing with learning the lesson, and the report labels as correct a cell the run pays
less for. Under agreement, treating every image as its true category calls for is provably
the best-paying outcome available — the property the whole game rests on, and until now
only a convention.

Both existing declarations already satisfy it (the apple task's `wormy: decline = 0` beats
`pick = −2.00`; the screening fixture's `diseased: flag = −5` beats `pass = −500`), so the
rule is a formalisation, not a repair. An action no category calls for stays legal: a
"send it to a human" action that is never the right answer to a certain image but is the
right answer to an uncertain one is a design worth keeping available, and `discard` is
close to being one already.

**The cost this hands forward, stated plainly.** §4.2's co-op table pays +0.20 for crating
a wormy apple and would be refused by this rule, naming `wormy`. That is the intended
behaviour — a batch term should make an honest table dramatic, not make a dishonest one
survivable — but it means `harvest-scoring` must either keep the per-apple table agreeing
and let the contract threshold do its work on top of it, or explicitly modify this
requirement to exempt a task declaring a batch term. The first is better and is what this
change expects; the second is available and is a spec modification, not a silent exception.

### Threshold policy gains a declared priority order

The policy keeps its shape and gains a third declared field: an order over the task's
categories, naming each exactly once, which resolves the case where several clear their
thresholds.

Three alternatives were rejected.

*Keep declared category order.* It cannot be changed without invalidating the artifact
whose vectors are indexed by it, so priority would be unexpressible for any task that has
already shipped predictions — and it would make the decision rule an accident of the
artifact, which is the coupling `decision-policy` exists to prevent.

*Most probable among those clearing.* This defeats the only reason to declare a low
threshold. Given thresholds of 0.50 for red and 0.03 for wormy and a distribution of
(0.55, 0.40, 0.05), most-probable-wins crates the apple: the student set the worm threshold
to 0.03 to catch exactly this image, and the policy ignores it. The screening lesson the
brief promises — false positives cheaper than false negatives — is unbuildable under that
rule.

*Infer priority from the thresholds, lowest first.* Compact and wrong: it fuses two
independent declarations, so a student tuning a threshold silently reorders the policy.

The order is required of every threshold task, not only of tasks declaring more than two
actions. A rule that changes shape with the action count is the same hidden binary
assumption this change exists to remove, one level up.

*Highest-probability* keeps its earliest-declared-category tie-break unchanged. A tie there
is two equal probabilities, an accident of the numbers rather than a declared intent, and
the rule only has to be deterministic. *Cost-optimal* needs nothing either: it already
ranks every declared action by expected payoff, and its earliest-declared-action tie-break
is likewise only a determinism rule. The new table does give it something to show — at
(0.45, 0.45, 0.10) crating as green is worth +0.03 against −0.105 for crating as red and
0.00 for discarding, so the policy hedges into the cheaper crate rather than risking the
fine.

### Ids, labels and copy

Actions become `crate-red` ("Crate as red"), `crate-green` ("Crate as green") and `discard`
("Throw it away"), with `categoryActions` mapping `red → crate-red`, `green → crate-green`,
`wormy → discard` — a bijection, for the first time, which is why the report's diagonal now
reads as a confusion matrix without needing to be explained as one.

The third label is "Throw it away" rather than the obvious "Discard", and that is the
implementation reporting back rather than a preference. `simulator-shell` forbids a screen
carrying any word a task declares, and `no-task-specific-code.test.tsx` enforces it by
searching the screens for every declared label. `FarmOverview` renders "Discard this farm and
start again", which is the farm's word for throwing away a save and has nothing to do with
apples — so declaring "Discard" as an action label would have made a task's vocabulary
collide with a screen's, and the only honest resolutions were to rename the action or to
reword the shell. Renaming the action costs nothing and the shell's wording is not this
change's to move.

The declared teaching copy currently describes a take-it-or-leave-it picking robot and has
to be rewritten; it is the only place in the repository where the two-action framing is
spelled out in words a student reads. The rewrite says what the sorter does and what each
mistake costs, and keeps `CLAUDE.md`'s honesty line — it describes sorting, and claims
nothing about training.

### What did not need to change

Worth recording, because it is the architecture paying off and because a reviewer will
otherwise go looking for the missing work. *Payoff table completeness* was already written
over "every combination of declared category and declared action" and already requires the
missing combination to be named, so it needs no modification — only a test that nine cells
are now demanded where six were. `scoreRun`, `expectedPayoff`, `emptyCounts`, `Report.tsx`,
`configId.ts` and every artifact reader are unchanged. The pool is untouched by
construction, and that gets asserted rather than assumed.

### What the implementation reported back

Three things the run showed that the plan had stated more narrowly than the code turned out
to behave. Recorded here rather than folded away, because each is a place a reader would
otherwise find the code and the artifacts disagreeing.

**The two-action toy task could not be left alone.** `test/diagram-resolve.test.ts` builds its
two-category task by overriding `categories`, `categoryActions` and `payoffs` on top of the
shipped declaration — and inheriting its `actions`. That made it a two-*category* task, never
a two-action one, and the moment the shipped task declared three actions its hand-written
mapping named actions the task no longer had. It now declares two actions of its own
(`take` / `leave`), which is what the plan meant by keeping a two-action task working and what
it was already claiming to test. The same shape holds for `web/src/test-support/declarations.ts`,
whose `unrelatedDeclaration` genuinely does declare its own two actions and is left at two on
purpose.

**A priority order the validator refuses still has to resolve.** *Threshold policy* says a
priority order omitting a category is rejected, and it is. `chooseAction` is nevertheless
handed hand-built policy values by tests and could in principle be handed one by a caller that
skipped validation, so a category the order does not name ranks last there rather than being
dropped: a clearing category still acts. That is defensive behaviour on an input the
requirement already refuses, not a second rule.

**A row can disagree twice.** The agreement requirement is written per offending action, and
the implementation reports one issue per action that matches or outpays the declared one — so
§4.1's `wormy` row is refused twice, once for each crate. The requirement neither asks for
that nor forbids it; the tests pin it, because a refusal that named only the first offender
would leave an author fixing one cell at a time.

## Risks / Trade-offs

**Test churn is the real cost.** `test/policy.test.ts` is written against `pick`/`decline`
and against 1.00 / −0.20 / −2.00 arithmetic in its comments;
`test/apple-harvest.declaration.test.ts` asserts six cells; `web/src/screens/Report.test.tsx`
reads `red:decline` and `wormy:decline` cells. All of it is shallow rewriting, but it is
most of the diff, and the numbers in the comments must be recomputed rather than left
stale — a comment claiming arithmetic that no longer holds is worse than no comment.

**A hand-made declaration can still be degenerate.** `policy.test.ts` builds its tie-break
case by spreading a flat payoff table over an already-validated declaration, so it never
passes through the validator. That stays legitimate — a tie-break test needs a tie — but it
has to read as a hand-built value for a determinism test, not as a declaration anyone
claims would load.

**Three columns on a laptop.** The report goes from 3×2 to 3×3. Laptop-first, so this is
comfortable; the mobile question belongs to the sorting screen (`manual-sorting`), and the
spec now forbids answering it by collapsing cells.

**A rule written before its second user.** Agreement is being specified with two
declarations to check it against. The forward cost is named above and is confined to
`harvest-scoring`; the alternative — leaving degeneracy to review — is what produced §4.1's
table in the first place.

## Migration Plan

There is no data migration to do: no artifact, no pool file and no persisted state carries
an action id today, and there is no save yet (`progression-catalog` stores owned ids and
knob values when it lands, so this rename stays free then too).

Order of work, each step leaving the suite green:

1. The validator gains the agreement rule and the priority-order rule, with the existing
   two-action declarations proving the first is a formalisation rather than a repair.
2. `chooseAction`'s threshold branch resolves by declared priority.
3. The apple declaration gains its third action, its 3×3 table, its bijective mapping and
   its rewritten copy — in one step, because a declaration between the two shapes is
   incoherent rather than half-migrated.
4. Tests keyed to the old ids and the old numbers are rewritten.
5. The untouched-artifact assertion goes in last, where it can fail honestly.

## Open Questions

- Whether green-sold-as-red should stay a per-apple fine or become the buyer rejecting a
  delivery. It is the same batch-shaped mechanic as the co-op contract and belongs to the
  same conversation; −0.30 is the honest linear stand-in until then.
- Whether a later task should expose its threshold priority to the student. Knobs are
  model-side today and the screening lesson is the first that might want otherwise; it is
  not this change's question, but the priority order is declared data, so nothing here
  forecloses it.

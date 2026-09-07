# Design — the labour resolver as stated behaviour

## Context

See `proposal.md` — *Why*. Four facts about what is already built shape everything below.

`src/labour/index.ts` exists and works. Every rule this change states is already
implemented there, and the two defects are at its edges rather than in its middle. So this
is mostly a change of *where the rules are written down*, plus two small fixes — not a
rewrite. The resolver's shape is deliberately not being touched.

The rules currently live in `openspec/specs/simulator-shell/spec.md`, requirements *Every
playable task carries a labour slot*, *What fills a labour slot is presented from
declarations* and *A model is put to work from the workshop, and can be handed back*. All
three are phrased as what the overview or the workshop SHALL **present**. None of them says
what the labour *is*, which is why `manual-sorting`'s "whenever no robot is working the
orchard" still has no referent.

`configurationId` joins with `-` and `configurationResolves` parses on it, walking
`declaration.knobs` left to right. Every knob id declared today is hyphen-free and every
declared choice value is a non-negative number, so the constraint this change adds is
already satisfied by the data in the repository.

`handBack` already exists and is already wired — from `ConfigureTask` only. Defect B is a
missing second call site, not a missing operation.

## Goals / Non-Goals

**Goals:**

- The engine's answer to "who works this card" is a requirement, testable without a screen.
- An identifier that can be composed can be read back, guaranteed by the declaration
  contract rather than by the parser's care.
- A year held open by a crop that will not come in can be closed from where the refusal is.

**Non-Goals:**

- Any change to the save's shape or schema version. Nothing new is stored.
- Any change to what a labour slot holds or how it is presented. `simulator-shell` keeps
  the presentation requirements untouched, including the icon-and-label rule.
- Family-scoped identity and multi-family playability. See *Decision 4*.
- Making `configurationResolves` tolerant of the ambiguity instead of forbidding it. See
  *Decision 2*.

## Decisions

### 1. A new capability rather than more requirements in `simulator-shell`

`farm-labour` is created, and `simulator-shell`'s three labour requirements are left exactly
where they are.

*Why:* the split is presentation versus rule, and it is already the project's split
elsewhere — `decision-policy` and `game-economy` state rules that `simulator-shell` states
the rendering of. Three of the things the resolver decides are not presentation at all:
which tasks hold the year open (an economy consequence), what a restore does to a stale slot
(a save consequence), and that ownership does not decide who works (the defect
`workshop-harvest-split` was written to fix, and the one thing most likely to regress).

*Alternative considered:* extending `simulator-shell` with engine-flavoured requirements.
Rejected — it would make a screen capability the authority on when a year may close, and it
gives `manual-sorting` nothing better to point at than it has now.

*Alternative considered:* moving the three presentation requirements into `farm-labour` so
all labour talk sits together. Rejected — churn with no behaviour change, and it would strand
the icon-and-label rule away from the `no-task-specific-code` invariant it exists to serve.

```
   BEFORE                              AFTER

   simulator-shell                     farm-labour        (new)
     presents a slot          -->        what the labour IS
     presents icon + label               which tasks are played
     offers put-to-work                  free and reversible
     ...and, by omission,                stale slot -> the hands
        defines all of it                        |
                                                 | pointed at by
   manual-sorting                       simulator-shell   (unchanged)
     "whenever no robot is                presents a slot
      working the orchard"  ---?--->      presents icon + label
      (no referent)                       offers put-to-work
```

### 2. The separator is forbidden in declarations, not escaped in the identifier

`checkKnob` gains a refusal for the separator appearing in a knob id or in the written form
of any value the knob permits. `configurationId` and `configurationResolves` are unchanged.

*Why:* the identifier's whole reason for not being a content hash is that an author can read
it, grep it inside an artifact and hand-adjust one configuration's data — `src/task/configId.ts`
says so. Escaping would keep the parse honest and destroy that property: `channels1%2D6` is
not something anyone hand-edits. Forbidding costs one validation rule, is satisfied by every
declaration in the repository today, and fails at *authoring* time rather than at a
student's restore.

*Why include negative numbers:* a slider declaring `min: -1` composes `regularization-1`,
which reads back as knob `regularization` with a value that then runs into the next knob id.
This is the more likely of the two cases to be authored by accident — a regularization or a
bias knob crossing zero is an entirely reasonable thing to want — and it is invisible until
a student's slot is silently emptied. Any future need for negative values is then a
deliberate conversation about the identifier's grammar, which is the right place to have it.

*Alternative considered:* leaving the parser to disambiguate by trying every split. Rejected
— it turns a validation rule into a backtracking parser, and two declared values can still
be genuinely ambiguous, so it would trade a clear refusal for a silent wrong answer.

### 3. Hand-back at the refusal is a second call site, and refuses to guess

The refusal already rendered on the overview gains, per refused task, the same `handBack`
the workshop offers. It does not bring the crop in, does not switch the labour by itself,
and does not retry the fetch.

```
  run the year
      |
      v
  card at work, artifact will not fetch
      |
      +--> refusal shown with its cause        (today: ends here)
      |
      +--> "hand this job back"                (this change)
               |
               v
        card is on manual labour
               |
               v
        "Sort this year's crop by hand"        (already exists)
               |
               v
        year closes
```

*Why not substitute the labour automatically:* `farm-labour` states, and
`workshop-harvest-split` decided, that a robot that cannot work is not a person who is not
there. Silently handing the job to the student would present a wage they did not choose to
earn and would hide a broken artifact behind a worked year. The student takes the model off;
the engine never does.

*Why not retry:* a fetch that failed for a missing artifact entry will fail again, and a
retry button on a refusal invites the slot-machine reading the workshop/harvest split exists
to remove. If the cause is transient the student can run the year again, which is already
offered.

### 4. Nothing is generalized for `model-families`

`configurationResolves` keeps its single-`knobs` signature, and *Only a played task carries
labour and holds the year open* keeps its per-knob quantifier.

*Why:* `model-families` is an unauthored stub that explicitly owns "configuration identity
stays scoped to its family". Guessing that shape here means either building an abstraction
that change then has to bend, or writing a requirement it has to modify on arrival. The
quantifier in particular will need to become *some owned family has a way through* — but
what a family *is* has to exist before that sentence can be written truthfully.

*Recorded for that change:* two forward references it will need to pick up, both named in
`proposal.md` — the per-knob quantifier in *Only a played task carries labour*, and the
separator constraint, which will have to cover family ids once they enter an identifier.

## Risks / Trade-offs

- **A new capability that mostly writes down existing behaviour reads as churn.** ->
  It is not zero-behaviour: the ownership rule and the stale-slot rule are both currently
  unspecified and both are load-bearing. The presentation requirements stay put, so the
  diff to existing specs is three small deltas rather than a migration.
- **The separator refusal could reject a declaration an author considers valid.** -> It
  rejects nothing in the repository today, and it fails at load with the knob and value
  named, which is the project's existing shape for a bad declaration. The cost lands on the
  author who writes it, at the moment they write it.
- **Forbidding negative values narrows what a knob can express.** -> Accepted knowingly.
  No declared knob wants one today, and the alternative is a student losing a model with no
  message. Widening the grammar later is a deliberate change to `configId`, not a silent
  edge.
- **The hand-back control appears at a moment of failure, where a student is least likely
  to read carefully.** -> Its label has to say what it does to the labour, not just "fix
  this". The spec requires only that it is reachable and that nothing is substituted; the
  wording is a task.
- **`farm-labour` and `simulator-shell` could drift** about what a slot means. -> The
  presentation requirements state what is *shown*; `farm-labour` states what is *true*. The
  overlap is one sentence each about absence meaning the hands, which is the fact both need.

## Migration Plan

No data migration and no save schema bump. Nothing stored changes shape, so an existing
farm restores unchanged and the labour slots it holds keep resolving.

The one deployment ordering constraint is that the separator refusal must land together
with its tests against the current declarations, so that a declaration edit cannot slip in
between and turn a green build into a refused task at load.

Rollback is reverting the change. A save written after it parses identically before it, so
no farm is lost in either direction — the only thing lost is the refusal, and any
declaration authored against it stays valid.

## Open Questions

- **Should the separator constraint be enforced for slider bounds as well as for the values
  a slider walks to?** A slider with `min: 0` and a negative `step` cannot produce a value
  the walk reaches, so checking the walked values is sufficient today. Checking the declared
  bounds too would refuse earlier and name a better field. Either passes the spec's
  scenarios; it is a message-quality choice inside `checkKnob`.
- **Does the refused-crop hand-back belong on the card or beside the refusal text?** The
  spec requires only that it is reachable without entering the task. With one refusable card
  the two are adjacent on screen; the question is worth answering once there is a second.

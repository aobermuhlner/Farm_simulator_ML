# Dataset tiers — design

## Context

See `proposal.md` — Why. What follows is the state this has to land on.

The catalog, ownership and availability machinery is landed (`progression-catalog`), and
already carries three items with a `notForSaleReason` and no price — the pattern this change
reuses rather than invents. Knobs live under `families[]` since `model-families`, and a
configuration identifier is `knobId + value` joined by `-` in declared knob order
(`src/task/configId.ts`). The pool is 200 training / 1 000 evaluation at schema 1.1.0, with
fitted/held-out roles declared per training image. Three artifacts ship, covering
`blocks2-channels{8,16,32}-regularization1-dropout0`.

Two landed sentences do most of the deciding here. `progression-catalog`: *"Buying an item
SHALL only add identifiers a student can select; it SHALL NOT change what any identifier
means."* And `fitted-tree`'s proposal, on why the larger tiers cannot be faked out of
today's pool: *"a 1 000-photo tier would have to be drawn from the evaluation pool — the
model would be fitted on the harvest, and the gap this rung exists to show would collapse."*

## Goals / Non-Goals

**Goals:**

- Land the tier as part of configuration identity now, while re-keying the artifacts costs
  three minutes rather than an afternoon.
- Put the two-label path — fit against the tier's labels, score against the manifest's truth
  — all the way through the pipeline, the artifact and the browser, so that authoring the
  noise later is a pool change and touches no code.
- Leave `bulk` and `checked` fully declared, fully explained and completely unreachable, so
  that pricing them later is a catalog edit.

**Non-Goals:**

- Any new image. The pool keeps its 200 training and 1 000 evaluation images, byte for byte.
- Any authored label noise. The mechanism ships; every label the one real tier files is
  correct, and the noise arrives with the images.
- Anything about what `training-browser` becomes when a split is 2 000 images rather than
  200. Named in the proposal's Impact, deliberately unanswered.
- Re-tuning `training/README.md`'s recorded gap figures. `starter` is the tier they were
  measured on and they are unchanged by this.

## Decisions

### The tier is a knob value, not ambient ownership

Three homes were possible for "which data was this fitted on":

| Where | Identity | Verdict |
|---|---|---|
| A knob value | `...-dropout0-datasetstarter` | chosen |
| Read off what is owned | unchanged string, changing meaning | forbidden |
| A separate pool per tier | artifact bound to a different pool id | rejected |

Ownership-as-input fails the landed sentence quoted in Context: the day a student buys
photos, `blocks2-channels16-regularization1-dropout0` would start resolving to a different
model. A pool per tier fails the same way at one remove, and triples the atlases.

The knob is also the better game. Owning two tiers and being able to hold the architecture
still while moving only the data is the comparison the tiers exist to teach; an ambient tier
would silently always fit on the best set owned and there would be nothing to compare it
against. It costs the workshop a fifth control, which is a real price on a screen the brief
wants sparse — see Risks.

### Tier ids are names, not sizes

`starter` / `bulk` / `checked`, not `200` / `1000` / `2000`. `data200` reads better in an
identifier, but it welds the identifier to a number this change explicitly calls provisional:
the top tier is 2 000 today because of the byte and minute arithmetic below, and if the pool
regeneration lands on a different figure, every artifact key would move. A name survives its
tier being resized.

The names say what the thing is rather than how big it is, which is also what the market
copy has to say: the free one, the cheap big one, the checked one.

### The dataset knob is declared last

`configurationId` joins in declared knob order, so putting `dataset` after `dropout` makes
the change a pure suffix append: `blocks2-channels16-regularization1-dropout0` becomes
`blocks2-channels16-regularization1-dropout0-datasetstarter`. Every existing part keeps its
position and its spelling, which makes the re-emission a mechanical re-key that a reviewer
can eyeball, and makes a `grep` for the old prefix still find the right rows.

### A family names its dataset knob explicitly

`family.datasetKnob: "dataset"`, not "the knob called `dataset`" and not "the knob whose
values happen to be tier ids". This mirrors `model-families`' own rule for `ships` — *"What
a family ships SHALL be declared rather than inferred from the family's id, its knobs, its
architecture"* — and it means a family may call the knob whatever its teaching copy wants.

Every family must declare one. A model is always fitted on something, and letting a family
omit it would put a silent default in the one place this change exists to make explicit.

### The manifest carries the tier columns now, with one tier and no noise

The alternative was to add `tier` and the per-tier labels only when the images that need
them arrive. Rejected: it would leave the pipeline fitting against `image.category` and mean
the later pool change also has to change the training code, the artifact schema and the
browser — three moving parts under one commit instead of a data drop.

With one tier the columns are degenerate (`tier: "starter"`, one label equal to the true
category) and the manifest grows by about 30 bytes an image. What it buys is that fitting
already reads a label column and scoring already reads the category column, so the day the
two differ, nothing has to learn how.

Cost of doing it: pool schema 1.1.0 → 1.2.0. Regenerated from the same seed and parameters
the images are identical — `image-pool` guarantees that — so only `manifest.json` changes.

### The workshop is measured against the tier's labels; the harvest against the truth

The tempting alternative is to measure the training curves against truth so the workshop
tells a student the "real" story. It is the wrong call, and not only on honesty grounds: a
practitioner holding a cheaply labelled set has exactly those labels to judge their model
by, and nothing else.

It also produces the best lesson available in this change for free. Fit on `bulk`, and the
workshop's curves look respectable while the harvest report disagrees — because the harvest
is real apples and the labels were not. That divergence has no other source in the game, so
it reads as exactly what it is.

### An artifact covers its tier's training images, not the whole split

`prediction-artifacts` used to require a distribution for every training image. Under tiers
that would make a `starter`-fitted configuration in a 2 000-image split carry 1 800
distributions for images its student cannot browse and its workshop never reports on.
Restricting coverage to the configuration's own tier costs nothing today (`starter` is the
whole split) and is what keeps the artifact directory sane once the pool grows.

### Roles stay tier-independent; each tier's yardstick is the restriction

Fitted/held-out is declared once per image. A tier's held-out set is simply its own images
that carry the held-out role, which means the yardstick grows with the tier.

The alternative — one fixed held-out set shared by every tier — makes gaps across tiers
comparable to the last decimal, but pins a 2 000-image fit to a 40-image yardstick, where
the measurement noise would be a large fraction of the effect being taught. Growing
yardsticks drawn from one distribution are comparable in expectation, which is what the
lesson needs, and each is as precise as its tier deserves. The cost is a constraint the
generator must satisfy: every tier needs both roles non-empty in every category, which is
now a spec'd refusal rather than an accident waiting for the regeneration.

### The top tier is 2 000

At 128px in 2048×2048 atlases of 256 cells, images cost about 2.9 KB each and manifest
entries about 440 bytes. `training/README.md` measures 40 epochs over 160 fitted images at
~24 s / ~43 s / ~108 s for the three shipped widths.

| Top tier | Atlases | Atlas bytes | Manifest | Widest config, 40 epochs |
|---|---|---|---|---|
| 1 000 | 8 | ~5 MB | ~0.9 MB | ~9 min |
| 2 000 | 12 | ~7 MB | ~1.4 MB | ~18 min |
| 5 000 (§4.5) | 24 | ~16 MB | ~2.6 MB | ~45 min |

`training-browser` currently requires every image of the browsed split to be shown, so the
atlas column is a download a school laptop takes on static hosting. 2 000 roughly halves
§4.5's bill, and the curve the tier exists to draw — the gap closing as data grows — has the
same shape at either size. §4.5 calls its numbers illustrative; this is the illustration
being taken up on.

### Re-emission is a pipeline re-run, not an edit

The three artifacts are regenerated by running `farm_training.train` again against the same
pool and the same seeds. Hand-editing the coverage keys would be faster and would violate
*"Values SHALL NOT be authored by hand"* in spirit if not in letter, and the ship gate
refuses a dirty-tree artifact anyway. Three minutes of CPU buys an artifact whose provenance
is true.

## Risks / Trade-offs

- **Every shipped identifier changes.** → The re-run above, plus the ship gate, plus the
  landed rule that a catalog may not price ground no artifact covers. A missed key surfaces
  as an untrained refusal at load, which is loud and specific, not as a wrong number.

- **A saved farm may lose the model it had at work.** `game-save` already answers this:
  *"a model put to work whose configuration the task's knobs can no longer compose SHALL be
  dropped"*, and a saved knob set with no dataset value falls to the declared default, which
  is `starter` — the same model. → Accept the existing behaviour; verify in a task that a
  pre-change save reopens on `starter` with its money and purchases intact.

- **Two variables move per purchase — size and label quality.** That is the diagnosis trap
  one level up: a student could conclude "more data is bad" from `bulk` alone. → The
  per-category breakdown the report already requires, and the fact that the arc is authored
  to resolve it: `checked` is bigger *and* correct, so the student who follows the money
  arrives at the right conclusion. Recorded as a live risk for whoever authors the noise, not
  as a solved problem.

- **`bulk` may genuinely be a bad buy.** Intended — a cheap dataset that disappoints is the
  lesson — but the market copy must not oversell it, and §4.6's playthrough must be replayed
  once it is priced to check the year it lands in survives it.

- **A fifth knob on the workshop screen**, on a brief that asks for few options per screen.
  → It is the only knob that is not an architecture dial, so it can sit apart from the other
  four rather than adding to a row of them; a screen-layout question for whoever builds it,
  not a reason to make the tier ambient.

- **The convolutional family's declared theory copy is now false.** It currently reads that
  the knobs "do not change the apples, only how much freedom the model has". A dataset knob
  changes exactly the apples. → It is declared data; rewriting it is a task in this change,
  not a follow-up.

- **A student can hold different tiers on different families.** Knob values are remembered
  per family, so the fitted tree could sit on `starter` while the network sits on `checked`.
  → Correct rather than confusing — each model really was fitted on what its knob says — but
  the workshop must name the set the model in front of the student uses, which the browser
  requirement covers.

## Migration Plan

Order matters; each step leaves the build green.

1. Pool manifest gains `tier` and the per-tier labels, schema → 1.2.0, regenerated from the
   unchanged seed. Verify the atlases are byte-identical.
2. Declarations: tiers block on `apple-harvest`, `dataset` knob declared last on the
   convolutional family, `datasetKnob` naming it, teaching copy corrected.
3. Validation and pool reading learn the new fields and the new refusals.
4. Pipeline fits against the label column and scores against the category column; records
   the tier per covered configuration.
5. Re-run the three shipped configurations; commit the pipeline before the artifacts, as
   `training/README.md` requires.
6. Catalog: two unpriced items in the `data` group with their `notForSaleReason`.
7. Browser: show the selected tier, its labels, its composition, its disclosure copy.

Rollback is a revert of the declarations and the artifacts together; the pool manifest may
be left at 1.2.0 or reverted with them, since an artifact records the schema it was produced
against and a mismatch refuses loudly rather than scoring wrongly.

## Open Questions

- What the two large tiers cost in CHF. §4.5 proposes 800 and 2 500, but both items ship
  unpriced here and the figures want checking against §4.6's playthrough once the images
  exist. Deferrable: pricing is a catalog edit and changes nothing in these specs.
- What share of `bulk`'s labels are wrong, and which categories the errors favour. Authored
  with the images; the specs constrain only that a mislabelling tier declares itself as one.
- Whether `checked` should also rebalance composition (§8.1 suggests the cheap set is skewed
  towards red). Declared per tier already, so this is a number in a declaration, not a
  question the approach depends on.

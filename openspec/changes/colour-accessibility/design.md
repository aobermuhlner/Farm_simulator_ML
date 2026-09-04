# Design

## Context

See `proposal.md` — Why. The proposal asserts the palette is unreadable for a red/green
deficiency; this design measured it, and the measurement changed what the fix has to be.

The pool's colour comes from three places in `tools/pool/`. `params.ts` declares the hue
bands — fitted red `-5..5`, pool red `-12..14`, green `90..140`. `draw.ts` holds a single
`BODY_SATURATION`/`BODY_LIGHTNESS` pair for every apple in the pool and converts hue to a
hex fill. The same file applies two flat achromatic overlays over that fill: a shadow whose
opacity falls with `lighting` (0.40 down to 0.145) and a specular highlight whose opacity
rises with `gloss` (0.22 up to 0.67). So an apple's body shows two colours — the fill, and
the fill under the shadow — and the pair a student compares is one apple's body against
another's, under whatever lighting each was drawn with.

That last fact is what the measurement turns on. Simulating deuteranopia and protanopia with
Machado's model at full severity, converting to CIELAB and taking the worst CIEDE2000
distance over every red-versus-green body colour pair the bands can produce:

| | normal | deuteranopia | protanopia | greyscale |
| --- | --- | --- | --- | --- |
| worst red-vs-green ΔE2000 | 50.4 | **0.4** | 8.2 | **0.0** |
| red L\* range | 26–49 | 29–53 | 19–41 | 26–49 |
| green L\* range | 48–74 | 46–72 | 49–75 | 48–74 |
| lightness gap | −1.0 | −6.5 | 8.3 | −1.0 |

A deuteranope looking at this pool sees a brightly lit orange-red apple and a shadowed green
apple as *the same colour* — 0.4 is a quarter of a just-noticeable difference. The reason is
in the last row: the two categories' lightness ranges overlap. Under normal vision hue
carries the distinction and lightness does not need to; under a red/green deficiency hue is
gone and lightness is nearly all that is left, and `lighting` moves lightness by more than
the categories differ.

Three consequences follow, and they set the shape of the whole change.

**Choosing better hues is not sufficient.** Under simulated deuteranopia the entire hue arc
from pure red through orange and yellow to green collapses onto one chromaticity — measured
at (0.55, 0.02) in linear chromaticity for every hue from 0° to 120°. There is no red and no
green on that arc that a dichromat can tell apart chromatically. Shifting red toward crimson
does buy something real, because crimson carries blue and leaves the arc, but by itself it
only takes the worst case from 0.4 to 3.3.

**Choosing better hues is necessary.** Crimson's blue content is what lets the surviving
channel separate the categories at all, and it is what makes protanopia and greyscale
comfortable rather than marginal. §8.3's instinct — green toward yellow-green, red toward a
warmer crimson — is right about the direction; it is only incomplete about the mechanism.

**The palette has to become a tone, not just a hue.** Since separation must come from
lightness, red and green need different lightness, and the constant `BODY_LIGHTNESS` has to
go. It cannot become a per-category constant: `draw.ts` receives an attribute vector and no
category, and keying colour on category would put a signal in the pixels that the manifest's
recorded attributes do not explain — which is precisely the property that makes the authored
distribution gap checkable. So the palette becomes a declared function of hue.

On the web side, `styles.css` has no category colours at all today: the report is a table
with row and column headers, and the training browser labels each cell in text. The one
colour-coded distinction is the training replay's two series, `--accent` against `--warn`,
which measure 10.0 under deuteranopia in the light theme and 5.1 in the dark one. Both
already carry a dash pattern and a text key, so no student is stuck — but 5.1 is a pair of
colours a deuteranope reads as one, and this is the change that gets to fix it cheaply.

## Goals / Non-Goals

**Goals:**

- A student with deuteranopia or protanopia can sort the pool's apples by sight, and the
  claim is backed by a number a test asserts rather than by an author's eye.
- The palette is declared data, checked over the full attribute ranges, so a later parameter
  edit fails loudly instead of quietly removing the lesson.
- Colour stays the *only* thing that distinguishes red from green in the images, so the
  decorrelation `heirloom-cultivars` depends on survives.
- No screen distinguishes anything by colour alone.
- The pool is regenerated once and every shipped configuration retrained once.

**Non-Goals:**

- Stripes, speckles and heirloom cultivars. This change decides the rule they must obey and
  draws no pattern.
- A per-student display option that recolours the images. The measured palette makes it
  unnecessary for the deficiencies in scope; see Open Questions.
- Changing what the lessons are. The band structure, the split gap, the role split, the
  counts and every attribute other than hue keep their values.
- Colour beyond category meaning — focus rings, borders, the issues panel. Contrast for
  those is its own concern and is not what makes this task performable.

## Decisions

### The palette becomes a declared tone ramp over hue

`params.ts` gains `BODY_TONE`: control points mapping hue to the saturation and lightness the
body is filled with, interpolated linearly between them and clamped outside. `draw.ts` reads
it instead of holding two constants.

| hue | saturation | lightness |
| --- | --- | --- |
| −30 | 0.88 | 0.35 |
| −6 | 0.86 | 0.36 |
| 75 | 0.66 | 0.59 |
| 120 | 0.64 | 0.60 |

Because the bands are disjoint in hue, a ramp gives the two categories different tones
without the drawing knowing that categories exist: `body.fill` stays a function of `hue`
alone, and `test/pool-drawing.test.ts`'s assertion that hue moves only `body.fill` keeps
holding. The interpolation across the unused stretch between −6 and 75 is defined but never
drawn from.

*Alternative considered:* pass the category into `appleParts` and key saturation and lightness
on it. Rejected — it breaks the one-attribute-one-part decomposition that file is built
around, and it makes the pixels carry a category signal the manifest cannot account for.

*Alternative considered:* keep one tone and reduce the overlays' amplitude instead, so that
lightness stays a category cue. Measured: flattening the shadow to 0.23–0.31 and the highlight
to 0.37–0.52 reaches 10.4 under deuteranopia — as good as the ramp — but it costs two of the
four appearance attributes most of their visible range, and `gloss` and `lighting` are two of
the four the out-of-band pool reds are pushed out along. Paying for accessibility out of the
overfitting lesson's budget is the wrong account.

*Alternative considered:* narrow green's `lighting` band instead of raising its lightness, so
green apples are always brightly lit. Measured at 10.6 — fine, and it leaves the drawing
untouched — but the 0.05 opacity quantization floors green's shadow at 0.15, which caps what
narrowing can buy, and it spends green's variety for a result the ramp gets for free.

### The hue bands move to crimson and yellow-green

| band | was | becomes |
| --- | --- | --- |
| fitted red hue | −5 .. 5 | −22 .. −12 |
| pool red hue | −12 .. 14 | −30 .. −6 |
| out-of-band red hue | [−12, −6], [6, 14] | [−30, −23], [−11, −6] |
| green hue | 90 .. 140 | 75 .. 120 |

The band widths, the clearances and the structure are carried over: the fitted band sits
inside the pool spread, the out-of-band regions stay clear of it by more than the 0.1° the
manifest rounds to, and green stays far from red. Only the window moved.

Red moves *away from orange*, which is the direction the measurements demanded — every
worst-case pair in the old palette involved a red at +14 — and it lands on a deep crimson
(`#a90c38` at the middle of the fitted band). Green moves *away from teal*, toward
yellow-green (`#97db54`), because the blue that green picks up past 125° converges with
crimson's blue on the surviving channel and closes the gap the crimson shift opened.

Green's window narrows by 5°. Nothing depends on green's spread — it is the controlled
baseline — and stopping at 120° keeps every green clear of the arc where its chromaticity
starts to bend back toward crimson's.

### What the palette measures, and against what thresholds

The check is defined over the colours two images can actually show: for each hue in a band
and each lighting value it can be drawn with, the fill and the fill under its shadow. Pairs
are taken across categories with no requirement that the lighting match, because a student
compares apples that are lit differently. The specular highlight is excluded — it is a
near-white ellipse covering 15% of the body at most, and it reads as a highlight rather than
as the apple's colour.

Measured over the whole cross product, for the palette above:

| | normal | deuteranopia | protanopia | greyscale | tritanopia |
| --- | --- | --- | --- | --- | --- |
| worst red-vs-green ΔE2000 | 55.0 | **10.2** | 25.5 | 14.9 | 40.2 |
| red L\* range | 20–37 | 23–41 | 14–29 | 20–37 | 22–39 |
| green L\* range | 52–83 | 51–83 | 54–83 | 52–83 | 52–82 |
| lightness gap | 15.9 | 10.5 | 25.3 | 15.9 | 12.7 |

Declared thresholds: ΔE2000 ≥ 8 and a lightness gap ≥ 5 under each of deuteranopia and
protanopia, and ΔE2000 ≥ 30 under normal vision. Each is met with margin rather than exactly,
so a later edit has room to move a control point without tripping a threshold it was tuned
against — and 10.2 against a bar of 8 is the honest statement of how much room this palette
has, which is not much. Deuteranopia is the binding constraint and 10.2 is close to the
ceiling a red-versus-green palette can reach at all.

Greyscale and tritanopia are measured and recorded but not asserted. They pass comfortably as
a side effect of a lightness-separated palette, and making them normative would let a failure
outside this change's remit block a future palette edit.

*On the choice of metric:* CIEDE2000 over Machado's full-severity simulation is the
conservative reading. Anomalous trichromats — deuteranomaly is by far the most common
deficiency — retain part of the red/green channel and see considerably more separation than
these figures. Simulating at full severity means the numbers describe the hardest case rather
than the average one, which is what a threshold should do.

### The declared seed covers the pixels, not just the attributes

`SEED` becomes derived: an authored, date-shaped constant combined with a digest of every
parameter the drawing reads — the tone ramp, the overlay coefficients, the cell size. The
manifest declares the derived value, so it is still one number in one field and no schema
version moves.

This change is what makes the gap worth closing. Until now colour lived in `draw.ts` as two
constants nobody had reason to touch; after it, the palette is declared data that a later
change is invited to tune. Editing a control point changes every pixel while leaving the
manifest's ids, attributes, splits, roles and counts byte-identical — so `prediction-artifacts`'
binding, which compares pool id, schema version and seed, would see nothing wrong and would
score the old pool's predictions against the recoloured images. That is exactly the silent
failure the binding exists to prevent, arriving through the one door it does not watch.

*Alternative considered:* add the render parameters to the manifest as a fourth binding value.
Rejected — it changes the manifest's shape, so the schema version moves, and that version has
to equal the one the task declares, which cascades into `declarations/apple-harvest.json` and
from there into every artifact's recorded schema version. All to signal something that is not
a schema change.

*Alternative considered:* leave it, and rely on remembering to bump the seed by hand. Rejected
— the comment on `SEED` today says it is committed rather than passed in precisely so that
regenerating is a checked-in fact and not a command someone has to remember. A palette whose
staleness has to be remembered is worse than that, not better, because the failure is silent.

*Consequence, accepted:* a palette edit now re-samples every image rather than only
recolouring it, since the sampler draws from the derived seed. A palette edit already means a
new pool and a full retrain, so this costs a larger diff in the committed manifest and nothing
else.

### The training replay's two series stop being a red/green pair

`styles.css` gains `--series-fitted` and `--series-held-out` as the declared pair, and the
held-out series moves off `--warn` to an indigo — `#3d4b9e` in the light theme, `#8f95e8` in
the dark. Measured against `--accent`: 48.6 and 49.0 under deuteranopia, against 10.0 and 5.1
today.

`--warn` stays what it is — the colour of a problem, on the issues panel and its heading, where
it is read against paper and ink and never against `--accent`. Reusing it for "the held-out
curve" was always a slight lie about what the curve means; the held-out loss rising is the
lesson, not an error.

The dash pattern on the held-out polyline and the text key stay. They are what
`colour-vision-safety` requires independently of the palette, and they are why nobody is stuck
today.

### The check lives in `src/`, shared by both sides

`src/colour-vision/` declares the two simulations, the sRGB-to-CIELAB conversion, CIEDE2000,
and the thresholds. `src/` is the only directory both `test/` and `web/` already import from,
and both need the same rule: it would be worse to have the pool tests and the screen tests
disagree about what "distinguishable" means than to have a verification module sitting beside
the engine. Nothing on a screen imports it, so it ships nothing.

Its own correctness is checked against published reference values — Sharma's CIEDE2000 test
pairs, and Machado's matrices as published — because a colour-distance implementation that is
subtly wrong produces confident numbers, and every threshold in this change rests on it.

## Risks / Trade-offs

- **A crimson apple and a yellow-green apple are less like the apples in a photograph.** →
  Accepted. Nothing here is photographic; the pool is flat shapes with one shading overlay
  because the images have to be legible to a student rather than realistic to a network. Deep
  crimson and yellow-green are both ordinary apple colours; `#a90c38` and `#97db54` are the
  measured middles of the two bands and both were looked at before being written down.
- **Red versus green gets easier for everyone.** Worst-case normal-vision separation goes from
  50 to 55, and lightness now separates the categories too. → This was never the hard part.
  What the lessons are measured on is the worm and the out-of-band reds, neither of which
  moves, and §8.3 asks for exactly this trade: keep it a genuine colour judgement rather than
  hand the player a shortcut cue.
- **10.2 leaves little headroom, and no palette choice will leave much.** → Recorded rather
  than papered over. The threshold is 8, the measurement is 10.2, and the design says outright
  that deuteranopia is near its ceiling. If a future change needs more, the answer is a
  display-side option, not a better red.
- **A model could now separate red from green on brightness alone.** → Intended, and harmless:
  brightness is a colour cue and colour is the legitimate feature for this distinction. The
  ceilings the ladder depends on are authored on the worm and on pattern, not on red versus
  green.
- **Regenerating invalidates the committed pool and every artifact at once.** → One ordering,
  below, the same one `held-out-generalization` used. The ship gate refuses an artifact trained
  against a dirty tree, which forces the commits into that order rather than one lump.
- **The measured harvest numbers will move.** → The pool's images all change, so `training/
  README.md`'s findings table is about a pool that no longer exists. Re-measure and restate.
  If the lessons land differently, record what was measured; reshaping the pool until the
  numbers look familiar is the thing `prediction-artifacts` makes a recorded step.

## Migration Plan

1. Land `src/colour-vision/` and its self-check against the published reference values, against
   the existing pool. It fails nothing yet.
2. Land the palette check as a failing test over today's parameters, so the defect is on the
   record as a measurement before it is fixed.
3. Land the tone ramp, the hue bands and the derived seed with their tests, against the
   existing pool. The palette check now passes and the committed pool fails its seed
   assertion, which is the intended intermediate state.
4. Regenerate (`npm run pool:generate`) and commit — new manifest, new atlases, new seed. Every
   artifact refuses.
5. Retrain the three shipped configurations (~3 min measured) and commit them, so the ship gate
   sees a clean tree.
6. Land the stylesheet's series pair and its check.
7. Re-measure and restate `training/README.md`'s findings against the new pool.

Rollback is reverting those commits. Nothing leaves the repository, and no student-facing
deployment happens until `dist/` is rebuilt.

## Open Questions

- Whether a per-student display option that daltonizes the pool images is worth having later.
  It is cheap and honest — nothing trains in the browser, so recolouring what is displayed
  changes no artifact and no lesson — and it is the only answer left for total colour blindness
  or for a display that mangles the palette. The measured figures say it is not needed for the
  deficiencies in scope, so it is recorded here rather than built.
- Whether the same thresholds should govern the crate buttons and the confusion matrix when
  `three-action-sorting` and `manual-sorting` colour them. `colour-vision-safety` says they
  must be checked; it deliberately does not pick their colours, since neither surface exists.

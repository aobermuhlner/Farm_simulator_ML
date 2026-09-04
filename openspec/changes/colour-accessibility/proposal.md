# Colour accessibility

Authored 2026-09-04 from `Game_design.md` §8.3 and §2. First in the proposed sequence
(§11) and depends on nothing. The palette was then measured under simulated deficiency
before the design was written; `design.md` — Context carries the figures, and they changed
what the fix has to be.

## Why

The entire game is red versus green. Roughly 1 in 12 men has a red/green deficiency and
the audience is high-school students, so for some fraction of any classroom the task is
not merely harder — it is unperformable. They cannot sort by hand, cannot judge the
robot's mistakes on sight in the report, and cannot read the training browser. That is
not an accessibility nicety on top of the lesson; it removes the lesson.

Stripes cannot be the fix. §2 reserves pattern — lengthwise stripes versus scattered
speckles — for cultivar identity, and puts stripes on *both* colours precisely so that
pattern carries no colour information. If pattern also distinguished red from green, a
feature model could reach the right answer through the wrong door and the heirloom
ceiling would collapse for a reason nobody intended. So the answer has to be the palette
itself.

This goes first for a second reason, which is cost. Any change to a pixel regenerates the
pool and retrains every shipped configuration — the most expensive operation in the
project. §7 asks that the palette and the striping rule be settled *before* the generator
is rewritten, so the pool is regenerated once rather than three times.

## What Changes

- Pick red and green hues that stay distinct under simulated deuteranopia and
  protanopia. Shifting green toward yellow-green and red toward a warmer crimson is the
  usual answer, but it is verified with a simulator, not by eye — and the measurement says
  the hues alone are not enough. Under simulated deuteranopia the whole arc from red
  through orange to green is one chromaticity, so the separation has to come from
  lightness, and the constant every apple is filled at has to become a declared tone.
- The palette becomes a declared generator parameter — saturation and lightness per hue,
  not per category — with the deficiency check expressed as a test over the full range of
  every attribute the images are drawn from, so a later parameter edit cannot quietly break
  it.
- The declared pool seed comes to cover the parameters the pixels are drawn from, not only
  those the attributes are sampled from. Making the palette editable data is what makes this
  necessary: a recolouring leaves the manifest byte-identical, so `prediction-artifacts`'
  binding would load a stale artifact against new pixels without complaint.
- Extend the rule to every colour on screen that carries category meaning — crate
  buttons, the confusion matrix, the report — and require that colour is never the only
  cue for a category anywhere in the UI. Today only one such pair exists, the training
  replay's two curves, and it measures 5.1 in the dark theme: a pair a deuteranope reads as
  one colour. It moves off the warning colour to an indigo.
- Record the decorrelation rule as a standing constraint for `heirloom-cultivars`:
  pattern is reserved for cultivar identity and must not become a colour cue. Nothing is
  striped yet, so this costs pixels nothing today and saves a regeneration later.
- Regenerate the pool once under a new seed and retrain every shipped configuration.
  Restate `image-pool`'s green-baseline requirement against the new hues.

## Capabilities

### New Capabilities
- `colour-vision-safety`: any colour that carries category meaning, in the pool or on a
  screen, is verified distinguishable under simulated red/green deficiency and is never a
  category's only cue. The check compares what a viewer compares — two images lit
  differently — and requires the categories' simulated lightness ranges not to overlap,
  which is the property that makes the distinction survive an illumination difference.

### Modified Capabilities
- `image-pool`: the body colour becomes a declared function of the hue attribute rather
  than a constant, *Green is a controlled baseline* stops treating a hue gap as evidence of
  distinguishability, and the declared seed comes to cover the parameters the pixels are
  drawn from.

## Impact

`tools/pool/params.ts` gains the tone ramp and moves the hue bands; `tools/pool/draw.ts`
reads the ramp instead of two constants; `SEED` becomes derived and `tools/pool/manifest.ts`
declares the derived value. `src/colour-vision/` is new and shared by both test suites.
`pools/apple-harvest/` is regenerated under the new seed and every configuration in
`artifacts/apple-harvest/predictions/` is retrained — the most expensive operation in the
project, run once. `web/src/styles.css` gains the declared series pair.

No manifest shape changes, so no schema version moves and `declarations/apple-harvest.json`
is untouched. `test/pool-params.test.ts`, `test/pool-drawing.test.ts` and
`test/pool-distribution.test.ts` move with the parameters, `test/pool-palette.test.ts` and
`web/src/palette.test.tsx` are new, and `training/README.md`'s measured findings are
restated against the regenerated pool.

Deliberately out of scope: stripes, speckles and heirloom cultivars, which are
`heirloom-cultivars`; and a per-student display option that recolours the images, which the
measured palette makes unnecessary for the deficiencies in scope. This change decides the
rule the patterns must obey and draws none.

# Farm Simulator ML

Educational web simulator: students tune hyperparameters for the ML models a robot farm
runs on, then live with the consequences. Vite + React + TypeScript, no backend, shipped
as static files to GitHub Pages.

`Project_definiton.md` holds the original brief. `openspec/specs/` holds the behaviour
that is actually specified and built; `openspec/changes/` holds what is proposed. When
those disagree with anything below, they win — this file records intent, not contract.

## This is a prototype: build the frame before the contents

What matters now is that the structure holds — that a task can offer several model
families, that a family is bought, gated behind a comprehension puzzle, selected, tuned
and put to work. Whether any particular model is *good* does not matter yet.

A family whose predictions are placeholders is worth more today than a family with a real
fitting pipeline behind it: the placeholder proves the frame carries a second model, and
the pipeline only proves that one model works. Prefer breadth.

So while any part of the frame is still missing, do not spend a change on measuring one
model against another, on tuning accuracy, or on producing real weights. Those are cheap
to do once the shape is settled and expensive to redo every time it moves.

## How the pieces fit

- A task is **data**, not code: `declarations/*.json`, validated at load by
  `src/task/validate.ts`. Screens render from the declaration's knobs, labels and
  teaching copy, so adding a lesson is a data change. `web/src/no-task-specific-code.test.tsx`
  enforces that no screen names a particular lesson.
- Nothing is trained in the browser. A configuration resolves to a deterministic id
  (`src/task/configId.ts`, e.g. `blocks3-channels16-regularization1-dropout0`) which keys
  into a precomputed prediction artifact: per-image probability distributions for both
  splits, plus a per-epoch training history. The decision policy and the scoring stay
  live computations over that frozen data.
- The image pool (`pools/apple-harvest`, 200 training / 1000 evaluation, 128px, delivered
  as PNG atlases) is generated from a seed by `tools/pool/`. The distribution gap between
  the splits is authored on purpose — that gap is the lesson.

## Game design

Notes on the game the simulator is meant to be. Design intent, largely not built yet.

### The money loop is the progression system

The farmer is broke. He can only afford a robot for the **apple orchard**, so that is the
only task available at the start. Good models earn money; money buys the robot for the
next task (not yet defined — an animal-health task teaching false-positive asymmetry is
the standing candidate from the brief). Tasks are therefore unlocked by *understanding*,
not by clicking through.

### Model capacity is bought, not given

The apple task opens with a genuinely small model and one thing to turn: the two-block
convolutional stack, with patterns per block as the only knob. Deeper stacks, loss
regularization and dropout are all shown but locked — later purchases, not options. This
keeps the first lesson about *what capacity alone does* rather than about picking the
biggest number, and it gives earnings something to buy that the student already
understands the meaning of.

Consequence for the declaration: a knob's available values become a function of game
progress, not a fixed list. Today `knobs[].values` is fixed. Whatever mechanism gates
them must stay declared data — a screen must not learn the words "blocks" or "unlocked".
A locked knob is greyed out rather than hidden, sits at its declared default, and still
contributes to the configuration identifier, so unlocking one extends the trained
coverage instead of reinterpreting the artifacts already shipped.

### Two separated phases: workshop, then harvest

1. **Workshop (per task).** The student picks an architecture and presses *train*. They
   watch epochs progress and a loss curve draw, then read how the model does on the
   fixed seed training set and its held-out test portion — the same small set every time,
   the one they can also browse image by image. This is where hypotheses are formed, and
   it is cheap: no money changes hands, so they can train as often as they like.
2. **Harvest (whole farm).** Only once every available task has a trained model does
   *run a month* become available. The month runs the entire farm over the large
   evaluation pool and pays out. Then the student goes back to the workshop with what
   they learned.

The separation is the point. Today a student presses "run a month" straight from the
knobs, which conflates "is my model any good" with "did the farm make money", and the
loss curve — the better diagnostic — never gets read. Splitting them also makes the
month feel like a commitment rather than a slot machine.

### Honesty about what "train" does

The models are pretrained; pressing *train* replays a stored history for that
configuration. The wording on screen must not claim otherwise — "replaying this
configuration's training run" is accurate and survives a student reading the source.
`openspec/changes/training-simulation/proposal.md` treats this as a deliberate decision,
not a default.

### Guard against the diagnosis trap

An over-selective model scores beautifully on wormy apples for entirely the wrong reason:
it rejects nearly everything. Any single headline number — earnings, accuracy — lets a
student conclude "low regularization detects worms well". The report must always break
results down per category and action, and the workshop's train-versus-test gap is what
makes the real story visible.

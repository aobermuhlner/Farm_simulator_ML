## Why

The project definition promises that students can look at the training set so they
understand what the data looks like. `dataset-generation` shipped that data — 200
committed training apples, each with its true category — and nothing renders it. The pool
is browsable in principle and invisible in practice.

It is not decoration. Both apple lessons are about the *gap* between the training data and
the harvest: an over-selective model memorized uniform reds, an over-regularized one
learned only "is it reddish". A student who has never seen the training apples has no way
to form either hypothesis, and is left reading earnings numbers for a model whose diet
they never saw. Looking at the data is where the lesson starts, not where it decorates.

This is also the last piece that can reach a student without waiting on
`prediction-artifacts`: the images and their labels are already committed and need no
predictions to be worth looking at.

## What Changes

- Add a **training-split browser**: the images of a task's training split, rendered from
  its pool manifest and atlas, each labelled with the category label its task declares.
- Reach it **from the configuration screen**, before a run. That is where a student is
  deciding what to tune, which is the moment the training data is worth seeing.
- Show the **composition of the split** — how many images of each category — so a student
  sees they are looking at 100 reds, 50 greens and 50 wormy apples rather than guessing
  from a grid.
- Render by **cropping cells out of the atlas**, so the whole split costs the atlas
  request plus the manifest, not one request per apple.
- Load the pool through the **existing pool reader**, so a malformed or mismatched
  manifest refuses with its cause named rather than rendering a grid of holes.
- **The browser reads the generated pool while a run still scores the fixture.** The
  browser needs the real 200; the harvest cannot use them until predictions exist over
  their ids. Both are true at once until `prediction-artifacts` lands, so the browser
  says which pool it is showing rather than letting a student assume the 200 apples on
  screen are the ones the report counted.
- **No attribute numbers on screen.** The manifest records hue, gloss and worm visibility
  per image, and printing them would hand over the authored gap that the lessons exist to
  make a student discover. Labels and counts only.
- Stay **task-agnostic**: the browser is driven by a task declaration and its pool, with
  no apple-specific ids in screen code, as `simulator-shell` already requires of every
  screen.

## Capabilities

### New Capabilities
- `training-browser`: what a student can see of a task's training split — which images,
  with which labels, how they are delivered, what the screen says about which pool it is
  showing, and how it refuses when the pool will not load.

### Modified Capabilities

None. `simulator-shell`'s four stages stay literally intact — overview, configuration,
run and report remain the flow, and the browser is a view reached from configuration
rather than a fifth stage. Its rule that no screen carries task-specific code paths, and
its requirement that engine refusals surface with the cause the engine named, both apply
to this screen unchanged and are inherited rather than rewritten.

## Impact

- New spec `training-browser`. A new screen under `web/src/screens/`, and the first
  consumer of `src/pool/` outside its own tests.
- `web/src/data/paths.ts` gains the generated manifest and atlas URLs alongside the
  existing fixture entries; the `data/pools` mount that `dataset-generation` added starts
  serving something real.
- No change to the engine's configuration, policy or scoring code, and no change to what
  a run computes. A student who never opens the browser sees exactly what they see today.
- Unblocks nothing, and is blocked by nothing. It is the only remaining change that does
  not depend on `prediction-artifacts`, which is why it can land next.

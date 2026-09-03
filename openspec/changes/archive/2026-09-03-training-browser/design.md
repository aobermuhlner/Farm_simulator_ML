## Context

See `proposal.md` — Why. Requirements are in `specs/training-browser/spec.md`; this
document covers only how they are met.

Four things about the code as it stands decide most of what follows. The shell has no
router: stages are view state in `web/src/App.tsx`, and a task's knob values live in
`ConfigureTask`'s own `useState`. The pool reader exists — `src/pool/index.ts` validates a
manifest and refuses with named causes — but nothing outside its tests has ever called it.
The generated pool is committed and served under the `data/pools` mount, while
`DATA_URLS.applePool` still points at the ten-image fixture that predictions are keyed to.
And the manifest is one 338 KB file covering both splits, with a 544 KB atlas behind the
training half.

## Goals / Non-Goals

**Goals:**
- The 200 training apples on screen with their declared labels, and nothing about them
  that gives away the authored gap.
- Knob values that survive a trip to the browser and back, without lifting state.
- One atlas request for the whole grid.
- A pool that fails to load producing the same kind of named refusal as everything else.

**Non-Goals:**
- Browsing the evaluation pool. A student inspecting the 1000 apples they are about to be
  scored on is a different feature with a different pedagogical question behind it.
- A per-image detail view, zoom, filtering or sorting.
- Switching what a run scores. `DATA_URLS.applePool` stays on the fixture; that switch is
  `prediction-artifacts`.
- Mobile layout beyond not breaking. Laptop-first, per the project definition.

## Decisions

**The browser is a view inside `ConfigureTask`, not a fifth stage in `App`.**
The spec requires that leaving the browser leaves the knob values selected, and those
values live in `ConfigureTask`'s state. Rendering the browser as a sibling stage in `App`
would unmount `ConfigureTask` and lose them, so it would force knob state up into `App`
— a refactor of the screen this change is otherwise not touching, made to satisfy a
requirement that a local view toggle satisfies by construction. `ConfigureTask` gains one
piece of view state and renders either its knobs or the browser.

**The pool is fetched when the browser is opened, not when the farm loads.**
Adding it to `loadShippedTasks` would be less code — the loader already fetches three
files and hands back a `LoadedTask`. It would also put 338 KB of manifest and 544 KB of
atlas in front of the first paint of the farm overview, for a view a student opens once
and may not open at all. Lazy loading keeps `App`'s startup path exactly as it is, and the
grid's own loading and refusal states are then local to the browser, which is where the
spec puts them anyway.

**Cells are cropped with CSS, not with a canvas.**
Each cell is an element whose background is the atlas, scaled and offset:

```
  scale            = displayPx / atlas.cellSize
  background-size  = atlas.width * scale  x  atlas.height * scale
  background-position = -(x * scale)  -(y * scale)      // x, y from the pool reader
```

The alternative — drawing each cell into a `<canvas>` — gives pixel control nobody needs
here and costs 200 canvases plus a decode dance. Background positioning is one image
decode for the whole grid, and `regionFor` in the pool reader already returns the `x`, `y`
and `size` this arithmetic needs, so the screen does no geometry of its own.

**The mismatch notice reuses the `fixtureBacked` flag the shell already carries.**
`App` passes `fixtureBacked` into `ConfigureTask` today, and it is exactly the condition
the spec's notice describes: while runs are scored from fixture predictions, the browsed
generated pool is not what the report counted. Inventing a second flag to say the same
thing would leave two sources of truth to drift apart, and when `prediction-artifacts`
switches the app to real predictions the flag goes false and the notice disappears on its
own — which is the behaviour the spec's second scenario asks for.

**Labels and counts come from the declaration joined to the pool's truth.**
The pool gives an image's category id; the declaration gives that category's display
label. Neither is hard-coded, so the browser renders a second task's unrelated categories
with no change — the rule `simulator-shell` already imposes on every screen. Counts are
computed from the same join rather than read from the manifest's `splits` block, so a
count on screen is a count of images actually rendered.

**Attributes are dropped at the boundary, not merely left unrendered.**
The screen receives image ids, categories and regions. The attribute values never enter
the component's props at all, so displaying one is not an oversight away — it would take
a deliberate change to the data the screen is given. This is worth the extra mapping step
because the spec's prohibition is pedagogical: a visible worm-visibility number is the
lesson, printed.

**Each cell is an `img`-roled element carrying its label as its accessible name.**
A cropped background has no intrinsic alternative text, so a screen reader would meet 200
unlabelled boxes. `role="img"` with the declared category label as `aria-label` gives each
apple the same name a sighted student reads underneath it, and gives the tests something
to query by that is not a CSS selector.

## Risks / Trade-offs

- **The manifest is one file covering both splits**, so browsing 200 images downloads
  entries for 1200. → 338 KB uncompressed and roughly 40 KB over the wire, fetched only
  when the browser is opened. Splitting the manifest per split would be a change to
  `image-pool`'s contract and is not worth it at this size; revisit if the pool grows.
- **jsdom cannot tell whether cropping actually shows the right apple.** Tests can assert
  the computed `background-position` for an image against the region the reader resolves,
  which is the arithmetic, not the pixels. → The remaining visual risk is checked once by
  eye against the real atlas, and the arithmetic is pinned by tests afterwards.
- **The mismatch notice risks reading as "this data is fake"**, which would undercut the
  training set a student is being asked to study. → Word it as what it is: these are the
  training apples, and the current run scored stand-in predictions instead of them.
- **A 2048x2048 PNG decodes on open**, a visible pause on a slow laptop. → One decode for
  200 apples is still far better than 200 requests, and the grid has a loading state while
  the manifest and atlas arrive.
- **This is the first non-test consumer of `src/pool/`.** If its shape turns out awkward
  for a screen, the temptation will be to work around it in the component. → Any shape
  problem is fixed in `src/pool/` where the refusals already live, not by parsing the
  manifest a second time in `web/`.

## Migration Plan

Nothing to migrate and nothing to roll back beyond deleting the screen. The browser is
additive: a student who never opens it sees exactly what they see today, no run changes,
and `DATA_URLS.applePool` is untouched. Rollback is removing the toggle from
`ConfigureTask`.

## Open Questions

Deferrable: none of these changes the specs, the approach, or the task breakdown.

- **How large a thumbnail, and how dense a grid.** The cell is 128 px; whether it displays
  at 64, 96 or 128 is a layout choice to make with the grid in front of us. It matters
  most for whether a subtle worm is findable, so it is worth looking at rather than
  deciding here.
- **Whether clicking an apple should enlarge it.** Probably wanted eventually, and it
  needs no new data — the region is already known at full cell resolution.
- **Whether 200 cells want pagination.** Not expected at this size; a decision for the
  first time the grid feels long.

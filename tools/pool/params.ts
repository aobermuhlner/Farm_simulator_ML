/**
 * Every number the apple pool is generated from.
 *
 * `openspec/changes/dataset-generation/design.md` — the split gap is specified as
 * attribute intervals rather than prose precisely so it can live in one file and be
 * asserted by tests. Nothing here is derived at generation time: change a number, run
 * `npm run pool:generate`, and the committed pool moves with it.
 *
 * Hue is degrees from pure red in the range (-180, 180], written without the wrap around
 * 360 so band containment is a plain numeric comparison instead of modular arithmetic
 * that a test would have to repeat.
 *
 * The red window sits at -30..-6 and the green one at 75..120 because
 * `openspec/changes/colour-accessibility/design.md` measured them there. Red moved away
 * from orange onto a deep crimson, whose blue content is the only thing a dichromat's
 * surviving channel has to separate the categories with; green moved away from teal
 * toward yellow-green, because the blue green picks up past 125 degrees converges with
 * crimson's on that same channel.
 *
 * Both windows were then rendered and looked at. The fitted band and the middle of the
 * spread read as ripe red apples; at -30 and -26, the far edge of the lower out-of-band
 * region, an apple reads as a plum rather than as an apple, and every one of them is
 * still labelled "ripe red apple" in the ground truth a student is scored against. That
 * is the same character the old palette's +14 orange had and it is deliberate: the
 * out-of-band population exists to be the apples the fitted band does not cover. It is
 * recorded here rather than corrected by narrowing the window, because the window is
 * where the deficiency measurement put it.
 */

/** The categories this pool declares, matching `declarations/apple-harvest.json`. */
export type PoolCategory = 'red' | 'green' | 'wormy'

/** The two splits, named as `src/task/artifact.ts` already names them. */
export type SplitName = 'training' | 'pool'

/** An inclusive range a sampled attribute is drawn from. */
export interface Range {
  readonly min: number
  readonly max: number
}

/** The four appearance attributes. Worm visibility is sampled separately. */
export interface Band {
  readonly hue: Range
  readonly roundness: Range
  readonly gloss: Range
  readonly lighting: Range
}

/** Attribute names in the order the manifest records them. */
export const BAND_ATTRIBUTES = ['hue', 'roundness', 'gloss', 'lighting'] as const

/** The saturation and lightness a body is filled at, at one declared hue. */
export interface TonePoint {
  readonly hue: number
  readonly saturation: number
  readonly lightness: number
}

/**
 * The tone a body is filled at, as a function of the hue it was drawn from.
 *
 * `openspec/changes/colour-accessibility/design.md` — under simulated deuteranopia the
 * whole hue arc from red through orange to green collapses onto one chromaticity, so no
 * choice of red and green is chromatically distinguishable to a dichromat and the
 * separation has to come from lightness instead. A single `BODY_LIGHTNESS` for every
 * apple made that impossible: `lighting` moved apparent lightness further than the
 * categories differed from each other, and a brightly lit red and a shadowed green
 * measured 0.4 apart — a quarter of a just-noticeable difference.
 *
 * A function of hue rather than of category, deliberately. `draw.ts` receives an
 * attribute vector and no category, and keying colour on category would put a signal in
 * the pixels that the manifest's recorded attributes do not explain — which is precisely
 * the property that makes the authored distribution gap checkable. The bands are disjoint
 * in hue, so a ramp gives the two categories different tones without the drawing knowing
 * that categories exist.
 *
 * The stretch between -6 and 75 is defined and never drawn from; `test/pool-params.test.ts`
 * holds every drawable hue inside the range these points cover.
 */
export const BODY_TONE: readonly TonePoint[] = [
  { hue: -30, saturation: 0.88, lightness: 0.35 },
  { hue: -6, saturation: 0.86, lightness: 0.36 },
  { hue: 75, saturation: 0.66, lightness: 0.59 },
  { hue: 120, saturation: 0.64, lightness: 0.6 },
]

/** The tone one hue is filled at: linear between the control points, clamped outside. */
export function bodyTone(hue: number): { readonly saturation: number; readonly lightness: number } {
  const first = BODY_TONE[0] as TonePoint
  const last = BODY_TONE[BODY_TONE.length - 1] as TonePoint
  if (hue <= first.hue) return { saturation: first.saturation, lightness: first.lightness }
  if (hue >= last.hue) return { saturation: last.saturation, lightness: last.lightness }

  for (let i = 1; i < BODY_TONE.length; i += 1) {
    const low = BODY_TONE[i - 1] as TonePoint
    const high = BODY_TONE[i] as TonePoint
    if (hue <= high.hue) {
      const t = (hue - low.hue) / (high.hue - low.hue)
      return {
        saturation: low.saturation + t * (high.saturation - low.saturation),
        lightness: low.lightness + t * (high.lightness - low.lightness),
      }
    }
  }
  /* c8 ignore next */
  throw new Error(`no tone declared for hue ${hue}`)
}

/**
 * The flat shadow `lighting` draws, as an opacity falling with the light.
 *
 * Declared here rather than written into `draw.ts` so that the seed below can digest it.
 * Everything a pixel depends on has to be reachable from one place for that to work.
 */
export interface ShadeCoefficients {
  readonly base: number
  readonly perLighting: number
}

export const SHADE_COEFFICIENTS: ShadeCoefficients = { base: 0.5, perLighting: -0.42 }

/** The flat specular highlight `gloss` draws: an opacity and an ellipse that grow with it. */
export interface GlossCoefficients {
  readonly opacityBase: number
  readonly opacityPerGloss: number
  readonly rxBase: number
  readonly rxPerGloss: number
  readonly ryBase: number
  readonly ryPerGloss: number
}

export const GLOSS_COEFFICIENTS: GlossCoefficients = {
  opacityBase: 0.1,
  opacityPerGloss: 0.6,
  rxBase: 7,
  rxPerGloss: 7,
  ryBase: 10,
  ryPerGloss: 9,
}


/** The role a training image plays: fitted on, or held out to measure validation loss. */
export const TRAINING_ROLES = ['fitted', 'heldOut'] as const
export type TrainingRole = (typeof TRAINING_ROLES)[number]

/**
 * How many training images of each category are held out.
 *
 * 40 of 200, stratified: enough held out for a validation loss that moves legibly per
 * epoch, and enough of every category in both roles that the loss is measured over the
 * same categories the fitted images cover — which the spec requires structurally rather
 * than by luck of the draw.
 */
export const HELD_OUT_COUNTS: Readonly<Record<PoolCategory, number>> = {
  red: 20,
  green: 10,
  wormy: 10,
}

/** One held-out population: a count, and the evaluation-pool distribution it is drawn from. */
export interface HeldOutPopulation {
  readonly category: PoolCategory
  readonly count: number
}

/**
 * How each category's held-out images divide across the populations the evaluation pool
 * is drawn from.
 *
 * Proportional to the pool rather than left to the draw, for the same reason the pool's
 * own populations are authored by partition: a held-out set that happens to contain no
 * subtle worm this seed is a diagnosis that quietly stops working. The proportions are
 * the pool's, rounded to whole images:
 *
 * | | evaluation pool | held out |
 * | --- | --- | --- |
 * | red, in band | 200 | 8 |
 * | red, out of band | 300 | 12 |
 * | green | 250 | 10 |
 * | wormy, subtle | 100 | 4 |
 * | wormy, obvious | 150 | 6 |
 *
 * These are populations of the *training* split. The fitted groups take whatever each
 * category has left over, so changing a number here moves images between the roles
 * rather than changing either split's size.
 */
export const HELD_OUT_POPULATIONS: Readonly<Record<string, HeldOutPopulation>> = {
  redInBand: { category: 'red', count: 8 },
  redOutOfBand: { category: 'red', count: 12 },
  green: { category: 'green', count: 10 },
  wormySubtle: { category: 'wormy', count: 4 },
  wormyObvious: { category: 'wormy', count: 6 },
}

/** Rasterization geometry. One atlas holds `CELLS_PER_ATLAS` images. */
export const CELL_PX = 128
export const ATLAS_PX = 2048
export const CELLS_PER_ATLAS = (ATLAS_PX / CELL_PX) ** 2

/**
 * Where the two overlays sit inside a cell.
 *
 * `openspec/changes/measured-features/design.md` — the drawing code and the measurement
 * code both need these ellipses: one to paint them, the other to leave them out of the
 * spot features. Two copies of the same ellipse is the failure this extraction exists to
 * prevent, so both read these constants and `test/pool-overlays.test.ts` asserts that
 * they do.
 *
 * Deliberately *not* part of `RENDER_PARAMETERS`. The fingerprint below digests the
 * values it is given, so folding these in would move `SEED` and resample a pool whose
 * pixels did not change — see `specs/image-pool/spec.md`, which distinguishes a pool
 * whose pixels moved from one whose recording did. These numbers were hard-coded in
 * `draw.ts` before this change and are byte-for-byte the same numbers now.
 */
export interface OverlayEllipse {
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
  /** Degrees, clockwise, about the ellipse's own centre. */
  readonly rotation: number
}

/**
 * The shadow: a flat disc pushed down and right, so only its edge crosses the apple.
 *
 * Position and radii are constant; `lighting` moves only its opacity, which is why one
 * declared ellipse describes the shadow for every image in the pool.
 */
export const SHADE_ELLIPSE: OverlayEllipse = {
  cx: CELL_PX / 2 + 42,
  cy: CELL_PX * 0.86,
  rx: 62,
  ry: 56,
  rotation: 0,
}

/** Where the highlight sits. Only its radii move, and `gloss` is what moves them. */
export const GLOSS_ELLIPSE_CENTRE = {
  cx: CELL_PX / 2 - 10,
  cy: CELL_PX * 0.41,
  rotation: -24,
} as const

/**
 * The largest gloss an apple can be drawn with.
 *
 * Measurement asks for the highlight at this value and nowhere else, so the region a
 * feature excludes is the same for every image and reads nothing about this one.
 */
export const MAX_GLOSS = 1

/** The highlight ellipse at one gloss value. */
export function glossEllipse(gloss: number): OverlayEllipse {
  return {
    cx: GLOSS_ELLIPSE_CENTRE.cx,
    cy: GLOSS_ELLIPSE_CENTRE.cy,
    rx: GLOSS_COEFFICIENTS.rxBase + GLOSS_COEFFICIENTS.rxPerGloss * gloss,
    ry: GLOSS_COEFFICIENTS.ryBase + GLOSS_COEFFICIENTS.ryPerGloss * gloss,
    rotation: GLOSS_ELLIPSE_CENTRE.rotation,
  }
}

/** True when a point in cell coordinates falls inside a declared overlay ellipse. */
export function insideOverlay(ellipse: OverlayEllipse, x: number, y: number): boolean {
  const radians = (ellipse.rotation * Math.PI) / 180
  const dx = x - ellipse.cx
  const dy = y - ellipse.cy
  // The point is rotated into the ellipse's frame rather than the ellipse into the
  // cell's: one pair of multiplications per pixel instead of a shape to re-derive.
  const u = dx * Math.cos(radians) + dy * Math.sin(radians)
  const v = -dx * Math.sin(radians) + dy * Math.cos(radians)
  return (u / ellipse.rx) ** 2 + (v / ellipse.ry) ** 2 <= 1
}


/**
 * The two decorations every apple carries, whatever it was drawn from.
 *
 * Stem and leaf are painted *under* the body, so only the parts outside the silhouette
 * survive. They are the same colour and in the same place in all 1 200 cells, which is
 * what lets the measurement pass leave them out without learning anything about the
 * apple it is looking at — the same argument the overlay ellipses above rest on.
 */
export const STEM_FILL = '#6b4a2b'
export const LEAF_FILL = '#4c8a3f'

/** The features the pool records per image, in the order the manifest writes them. */
export const FEATURE_IDS = [
  'redness',
  'roundness',
  'darkSpotArea',
  'spotCount',
  'textureVar',
] as const
export type FeatureId = (typeof FEATURE_IDS)[number]

/** The overlays a feature may exclude before measuring. */
export const OVERLAY_IDS = ['shade', 'gloss'] as const
export type OverlayId = (typeof OVERLAY_IDS)[number]

/**
 * Which overlays each feature leaves out, and why the answer differs per feature.
 *
 * `openspec/changes/measured-features/design.md` — masking is declared per feature
 * because the two spot features and the two colour features want opposite things from
 * the same two ellipses.
 *
 * `redness` and `textureVar` mask nothing: a red apple in shadow measuring less red is
 * the lesson, and a `redness` with the shadow taken out would be a clean read of `hue`,
 * which the spec refuses as an attribute under another name.
 *
 * `darkSpotArea` and `spotCount` mask both. Unmasked they measure whether a shadow edge
 * crosses a light-coloured body, which makes green apples register more dark spots than
 * wormy ones — a worm feature in name only.
 *
 * `roundness` measures the silhouette, which neither overlay touches, so it has nothing
 * to mask.
 */
export const FEATURE_MASKS: Readonly<Record<FeatureId, readonly OverlayId[]>> = {
  redness: [],
  roundness: [],
  darkSpotArea: ['shade', 'gloss'],
  spotCount: ['shade', 'gloss'],
  textureVar: [],
}

/** The channels a per-pixel comparison can be made on. */
export const COMPARISON_CHANNELS = ['luminance', 'rgb-sum'] as const
export type ComparisonChannel = (typeof COMPARISON_CHANNELS)[number]

/** A measurement parameter: the value, and the reason a reviewer disagrees with. */
export interface DeclaredParameter<T> {
  readonly value: T
  readonly reason: string
}

/**
 * Every number that decides what the measurement pass can and cannot see.
 *
 * `specs/measured-features/spec.md` — the difficulty of a feature set is authored
 * whether or not anyone admits it, so each threshold is declared here with the reason
 * for its value rather than buried in `features.ts` as a literal. Two defensible spot
 * detectors over these same pixels differ by more than a factor of two in how many worms
 * they find; the sensitivity *is* the teaching decision.
 */
export const MEASUREMENT_PARAMETERS: {
  readonly bodyAlpha: DeclaredParameter<number>
  readonly decorationColourCut: DeclaredParameter<number>
  readonly darkSpotLuminanceCut: DeclaredParameter<number>
  readonly darkSpotChannel: DeclaredParameter<ComparisonChannel>
  readonly spotColourCut: DeclaredParameter<number>
  readonly spotChannel: DeclaredParameter<ComparisonChannel>
  readonly minimumBlobPixels: DeclaredParameter<number>
  readonly featureDecimals: DeclaredParameter<number>
} = {
  bodyAlpha: {
    value: 250,
    reason:
      'A cell is drawn over nothing, so the apple is exactly the opaque part of it. 250 rather than 255 keeps the interior while dropping the antialiased rim, whose colour is a blend with the empty background and belongs to no apple.',
  },
  decorationColourCut: {
    value: 24,
    reason:
      'Sum of the absolute channel differences from the declared stem and leaf fills. 24 clears their antialiased edges and stays far below the 140 that separates the stem from the darkest body colour the palette reaches, so no apple loses skin to it.',
  },
  darkSpotLuminanceCut: {
    value: 0.9,
    reason:
      "A dark spot is a patch at most nine tenths as bright as the apple's own modal colour. Measured over the pool, a clean apple's masked skin never falls below 0.94 of its mode, and a worm hole reaches 0.79, so the cut sits in the gap rather than on either population.",
  },
  darkSpotChannel: {
    value: 'luminance',
    reason:
      'Darkness is a brightness question, so the comparison runs on luminance rather than on one primary. The consequence is recorded rather than avoided: a crimson body is dark to begin with, so a worm hole on a deep red apple is barely darker than the skin around it and this feature nearly misses it.',
  },
  spotColourCut: {
    value: 0.55,
    reason:
      "Sum of the absolute channel differences from the modal skin colour, over 255. A worm's pale back reaches 1.18 and its hole 0.54, while masked skin stays under 0.12, so any cut between those separates them — 0.55 is deliberately near the top of that gap. It is the sensitivity the ladder guard is fitted against: a cut of 0.25 finds every worm in the pool and puts a two-node hand rule above every shipped network.",
  },
  spotChannel: {
    value: 'rgb-sum',
    reason:
      'Colour distance runs on all three primaries because the thing that gives a worm away is that it is the wrong colour, not that it is dark. A luminance-only comparison misses a pale worm on a crimson apple entirely.',
  },
  minimumBlobPixels: {
    value: 8,
    reason:
      'Connected runs shorter than this are the two- to four-pixel blends where the stem tip meets the body, measured across the whole pool. Eight drops every one of them and keeps the smallest worm the pool draws, which covers 63 pixels.',
  },
  featureDecimals: {
    value: 4,
    reason:
      'Feature values are rounded before they reach the manifest so that the file is byte-stable and diffable, at a step finer than any threshold a student can pick.',
  },
}

/** Everything a pixel is drawn from, gathered so the seed below can cover all of it. */
export interface RenderParameters {
  readonly tone: readonly TonePoint[]
  readonly shade: ShadeCoefficients
  readonly gloss: GlossCoefficients
  readonly cellPx: number
}

/** The drawing as it stands. */
export const RENDER_PARAMETERS: RenderParameters = {
  tone: BODY_TONE,
  shade: SHADE_COEFFICIENTS,
  gloss: GLOSS_COEFFICIENTS,
  cellPx: CELL_PX,
}

/** The render parameters as one ordered, unambiguous string. */
export function renderFingerprint(render: RenderParameters): string {
  return [
    ...render.tone.flatMap((point) => [point.hue, point.saturation, point.lightness]),
    render.shade.base,
    render.shade.perLighting,
    render.gloss.opacityBase,
    render.gloss.opacityPerGloss,
    render.gloss.rxBase,
    render.gloss.rxPerGloss,
    render.gloss.ryBase,
    render.gloss.ryPerGloss,
    render.cellPx,
  ].join(',')
}

/**
 * FNV-1a, 32 bit, written out here on purpose.
 *
 * A digest that moved with a Node version would silently change the pool identity on a
 * machine that never touched a parameter, so neither `node:crypto` nor a dependency will
 * do. Four lines of arithmetic over the same string produce the same number anywhere.
 */
function fnv1a(text: string, start: number): number {
  let hash = start >>> 0
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0
  }
  return hash >>> 0
}

/**
 * The date the pool was last deliberately republished.
 *
 * Authored, and the only half of the seed a person edits. Moved from 20260902 when the
 * held-out role started drawing from the evaluation pool distributions, and again on
 * 20260904 for the palette. Bumping it forces a new pool identity even when no drawing
 * parameter moved — a resample is sometimes the point.
 */
export const AUTHORED_SEED = 20260904

/**
 * The seed the pool actually derives from, and the one the manifest declares.
 *
 * The authored date combined with a digest of every parameter the pixels are drawn from.
 * `colour-accessibility/design.md` — the palette is declared data now, and a later change
 * is invited to tune it. Editing a control point changes every pixel while leaving the
 * manifest ids, attributes, splits, roles and counts byte-identical, so the binding a
 * prediction artifact relies on — pool id, schema version and seed — would see nothing
 * wrong and would score the old pool predictions against the recoloured images. That is
 * exactly the silent failure the binding exists to prevent, arriving through the one door
 * it did not watch.
 *
 * Deriving rather than adding a fourth binding value keeps the manifest shape and the
 * schema version where they are. One number, one field, as before.
 *
 * Consequence, accepted: a palette edit now re-samples every image rather than only
 * recolouring it, since the sampler draws from this number. A palette edit already means a
 * new pool and a full retrain, so it costs a larger manifest diff and nothing else.
 */
export function derivedSeed(authored: number, render: RenderParameters): number {
  return fnv1a(`${authored}|${renderFingerprint(render)}`, 0x811c9dc5)
}

export const SEED = derivedSeed(AUTHORED_SEED, RENDER_PARAMETERS)

/** Decimal places attributes are rounded to before they reach the manifest. */
export const HUE_DECIMALS = 1
export const UNIT_DECIMALS = 3

/** The authored split sizes. */
export const SPLIT_SIZES: Readonly<Record<SplitName, number>> = {
  training: 200,
  pool: 1000,
}

/** 50% red, 25% green, 25% wormy in both splits. */
export const CATEGORY_COUNTS: Readonly<Record<SplitName, Readonly<Record<PoolCategory, number>>>> = {
  training: { red: 100, green: 50, wormy: 50 },
  pool: { red: 500, green: 250, wormy: 250 },
}

/**
 * One dataset tier this pool authors: how many training images it holds, and how many of
 * them it files under the wrong category.
 *
 * `holds` is cumulative, because membership nests — `specs/dataset-tiers/spec.md` requires
 * every image of a smaller tier to belong to every larger one, so a tier is described by
 * the size of the set it ends up with rather than by what it adds. The manifest then
 * declares membership once, as the smallest tier an image enters at.
 *
 * `mislabels` is how many of those held images this tier files under a category other than
 * their true one. It is a count rather than a share so that the authored figure is the one
 * a declaration can state and a reader can check, with no rounding between them.
 */
export interface DatasetTier {
  readonly id: string
  /** Training images held, counting the ones the smaller tiers hold too. */
  readonly holds: number
  /** How many of them this tier files under another category. */
  readonly mislabels: number
}

/**
 * The tiers this pool authors, smallest first.
 *
 * One tier today, holding the whole training split and filing every apple correctly. The
 * task declares three — `dataset-tiers`' proposal ships `bulk` and `checked` as declared,
 * explained and unreachable — and a tier the pool holds no images for is accepted as a
 * declaration precisely so that this list can grow later without the declaration moving.
 *
 * When it does grow, the numbers here are the whole of what has to change: the assignment
 * in `tiers.ts` deals every (category, role) group across these tiers proportionally, so a
 * new tier arrives with both roles and every category already in it.
 */
export const DATASET_TIERS: readonly DatasetTier[] = [
  { id: 'starter', holds: SPLIT_SIZES.training, mislabels: 0 },
]

/**
 * The narrow band the fitted reds occupy.
 *
 * A property of the fitted role rather than of the training split: the split's held-out
 * images are drawn from the evaluation pool's distributions, so they reach past it.
 */
export const FITTED_RED: Band = {
  hue: { min: -22, max: -12 },
  roundness: { min: 0.9, max: 1 },
  gloss: { min: 0.6, max: 0.8 },
  lighting: { min: 0.4, max: 0.6 },
}

/** The wider spread the evaluation pool's reds are drawn from. */
export const POOL_RED: Band = {
  hue: { min: -30, max: -6 },
  roundness: { min: 0.6, max: 1 },
  gloss: { min: 0.2, max: 0.95 },
  lighting: { min: 0.25, max: 0.85 },
}

/** Green, held well away from the red band in both splits. */
export const GREEN: Band = {
  hue: { min: 75, max: 120 },
  roundness: { min: 0.7, max: 1 },
  gloss: { min: 0.3, max: 0.85 },
  lighting: { min: 0.3, max: 0.8 },
}

/**
 * Where an out-of-band pool red is pushed to.
 *
 * Each region is kept clear of the fitted band by more than the rounding step, so a
 * value drawn here is still outside the band after it is rounded for the manifest.
 */
export const OUT_OF_BAND: Readonly<Record<keyof Band, readonly Range[]>> = {
  hue: [
    { min: -30, max: -23 },
    { min: -11, max: -6 },
  ],
  roundness: [{ min: 0.6, max: 0.89 }],
  gloss: [
    { min: 0.2, max: 0.59 },
    { min: 0.81, max: 0.95 },
  ],
  lighting: [
    { min: 0.25, max: 0.39 },
    { min: 0.61, max: 0.85 },
  ],
}

/** Worm visibility per population. Fitted worms are obvious; pool worms are not all. */
export const WORM_VISIBILITY = {
  fitted: { min: 0.7, max: 1 },
  poolSubtle: { min: 0.15, max: 0.34 },
  poolObvious: { min: 0.35, max: 1 },
} as const

/** The visibility below which a worm counts as subtle, per the spec's scenario. */
export const SUBTLE_WORM_CEILING = 0.35

/** Of the 500 pool reds, how many are drawn deliberately outside the fitted band. */
export const OUT_OF_BAND_POOL_REDS = 300

/**
 * Of the 250 pool wormy apples, how many are subtle worms on otherwise-perfect reds.
 *
 * This population is the whole over-regularization lesson: a model that learned only
 * "is it reddish" picks them, and the farm loses money on apples it should have trashed.
 */
export const SUBTLE_POOL_WORMS = 100

/** How far green's share of the two splits may differ. They are authored equal. */
export const GREEN_SHARE_TOLERANCE = 0.001

/** The pool id, which must equal the `pool` reference in the task declaration. */
export const POOL_ID = 'pools/apple-harvest'

/** Where generated output is written, relative to the repository root. */
export const OUTPUT_DIR = 'pools/apple-harvest'

/** Green never carries a worm, in either split. */
export const GREEN_WORM_VISIBILITY = 0

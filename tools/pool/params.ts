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

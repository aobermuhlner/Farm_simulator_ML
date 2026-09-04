/**
 * Every number the apple pool is generated from.
 *
 * `openspec/changes/dataset-generation/design.md` — the split gap is specified as
 * attribute intervals rather than prose precisely so it can live in one file and be
 * asserted by tests. Nothing here is derived at generation time: change a number, run
 * `npm run pool:generate`, and the committed pool moves with it.
 *
 * Hue is degrees from pure red in the range (-180, 180]. Design writes the fitted red
 * band as 355-5 and the pool spread as 348-14; both are written here without the wrap
 * around 360, so band containment is a plain numeric comparison instead of modular
 * arithmetic that a test would have to repeat.
 *
 * The pool spread stops at -12 and +14 because it was rendered and looked at: by -20 a
 * red apple reads as a magenta plum and by +24 as an orange, and every one of these is
 * labelled "ripe red apple" in the ground truth a student is scored against.
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

/**
 * The one seed the whole pool derives from. Committed rather than passed in, so that
 * regenerating is a checked-in fact and not a command someone has to remember.
 *
 * Moved from 20260902 when the held-out role started drawing from the evaluation pool
 * distributions. The images behind the ids changed, so the pool has to declare an
 * identity the artifacts trained against the old one do not match: `prediction-artifacts`
 * binds an artifact by pool id, schema version and seed, and none of the other two moves
 * when the sampling groups change. Without the bump a stale artifact would load silently
 * and score one pool predictions against another pool images.
 */
export const SEED = 20260904

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
  hue: { min: -5, max: 5 },
  roundness: { min: 0.9, max: 1 },
  gloss: { min: 0.6, max: 0.8 },
  lighting: { min: 0.4, max: 0.6 },
}

/** The wider spread the evaluation pool's reds are drawn from. */
export const POOL_RED: Band = {
  hue: { min: -12, max: 14 },
  roundness: { min: 0.6, max: 1 },
  gloss: { min: 0.2, max: 0.95 },
  lighting: { min: 0.25, max: 0.85 },
}

/** Green, held well away from the red band in both splits. */
export const GREEN: Band = {
  hue: { min: 90, max: 140 },
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
    { min: -12, max: -6 },
    { min: 6, max: 14 },
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

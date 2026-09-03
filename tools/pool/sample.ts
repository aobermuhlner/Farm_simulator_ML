/**
 * Draws the pool's attribute vectors and gives each one an id.
 *
 * `design.md` — the split gap is authored, so the populations that carry it are
 * partitioned explicitly rather than sampled and hoped for: 300 of the 500 pool reds are
 * pushed outside the training band by construction, and exactly 100 of the 250 pool
 * worms are the subtle ones on otherwise-in-band reds. Sampling from a wide range and
 * counting what came out would make the lesson depend on the seed.
 *
 * Ids are assigned after a shuffle, so the browsable training split is a mix rather than
 * a hundred reds followed by fifty greens. The shuffle draws from the same seeded
 * stream, so the id-to-apple mapping is still a pure function of the seed.
 */

import type { ImageAttributes } from './bands.js'
import {
  BAND_ATTRIBUTES,
  CATEGORY_COUNTS,
  GREEN,
  GREEN_WORM_VISIBILITY,
  HUE_DECIMALS,
  OUT_OF_BAND,
  OUT_OF_BAND_POOL_REDS,
  POOL_RED,
  SEED,
  SPLIT_SIZES,
  SUBTLE_POOL_WORMS,
  TRAINING_RED,
  UNIT_DECIMALS,
  WORM_VISIBILITY,
  type Band,
  type PoolCategory,
  type Range,
  type SplitName,
} from './params.js'
import { createRandom, type Random } from './random.js'

/** One generated apple, before it is placed in an atlas. */
export interface SampledImage {
  readonly id: string
  readonly split: SplitName
  readonly category: PoolCategory
  readonly attributes: ImageAttributes
}

function drawBand(random: Random, band: Band, wormVisibility: number): ImageAttributes {
  return {
    hue: random.inRange(band.hue, HUE_DECIMALS),
    roundness: random.inRange(band.roundness, UNIT_DECIMALS),
    gloss: random.inRange(band.gloss, UNIT_DECIMALS),
    lighting: random.inRange(band.lighting, UNIT_DECIMALS),
    wormVisibility,
  }
}

/**
 * An apple guaranteed to sit outside the training band.
 *
 * One attribute is chosen and drawn from a region that excludes the band by more than
 * the rounding step; the rest come from the full pool spread. Choosing the attribute at
 * random is what keeps the out-of-band population varied instead of being a single
 * visual trick a student could learn to spot.
 */
function drawOutOfBand(random: Random, wormVisibility: number): ImageAttributes {
  const pushed = random.pick(BAND_ATTRIBUTES)
  const region: Range = random.pick(OUT_OF_BAND[pushed])
  const decimals = pushed === 'hue' ? HUE_DECIMALS : UNIT_DECIMALS
  return {
    ...drawBand(random, POOL_RED, wormVisibility),
    [pushed]: random.inRange(region, decimals),
  }
}

interface Group {
  readonly category: PoolCategory
  readonly count: number
  readonly draw: (random: Random) => ImageAttributes
}

/**
 * The sampling groups per split, in the order they are drawn.
 *
 * The counts here are the authored gap. Reading this function top to bottom is meant to
 * be the shortest available answer to "how do the two splits differ".
 */
function groupsFor(split: SplitName): readonly Group[] {
  const counts = CATEGORY_COUNTS[split]

  if (split === 'training') {
    return [
      // Uniform reds: the narrow band that leaves an unregularized model over-selective.
      { category: 'red', count: counts.red, draw: (r) => drawBand(r, TRAINING_RED, 0) },
      { category: 'green', count: counts.green, draw: (r) => drawBand(r, GREEN, GREEN_WORM_VISIBILITY) },
      // Worms in training are obvious, and sit on the same red band as the reds do, so
      // the only thing separating the two categories here is the worm itself.
      {
        category: 'wormy',
        count: counts.wormy,
        draw: (r) => drawBand(r, TRAINING_RED, r.inRange(WORM_VISIBILITY.training, UNIT_DECIMALS)),
      },
    ]
  }

  const inBandReds = counts.red - OUT_OF_BAND_POOL_REDS
  const obviousWorms = counts.wormy - SUBTLE_POOL_WORMS

  return [
    // Reds the model has seen the likes of.
    { category: 'red', count: inBandReds, draw: (r) => drawBand(r, TRAINING_RED, 0) },
    // Reds it has not: the under-regularization lesson.
    { category: 'red', count: OUT_OF_BAND_POOL_REDS, draw: (r) => drawOutOfBand(r, 0) },
    { category: 'green', count: counts.green, draw: (r) => drawBand(r, GREEN, GREEN_WORM_VISIBILITY) },
    // Subtle worms on otherwise-perfect reds: the over-regularization lesson.
    {
      category: 'wormy',
      count: SUBTLE_POOL_WORMS,
      draw: (r) => drawBand(r, TRAINING_RED, r.inRange(WORM_VISIBILITY.poolSubtle, UNIT_DECIMALS)),
    },
    {
      category: 'wormy',
      count: obviousWorms,
      draw: (r) => drawBand(r, POOL_RED, r.inRange(WORM_VISIBILITY.poolObvious, UNIT_DECIMALS)),
    },
  ]
}

/** `t-001` for the training split, `p-0001` for the pool. */
export function imageId(split: SplitName, index: number): string {
  const prefix = split === 'training' ? 't' : 'p'
  const width = split === 'training' ? 3 : 4
  return `${prefix}-${String(index + 1).padStart(width, '0')}`
}

function sampleSplit(random: Random, split: SplitName): readonly SampledImage[] {
  const drawn: { category: PoolCategory; attributes: ImageAttributes }[] = []
  for (const group of groupsFor(split)) {
    for (let i = 0; i < group.count; i += 1) {
      drawn.push({ category: group.category, attributes: group.draw(random) })
    }
  }

  return random.shuffle(drawn).map((image, index) => ({
    id: imageId(split, index),
    split,
    category: image.category,
    attributes: image.attributes,
  }))
}

/**
 * The whole pool, training split first, in the order ids were assigned.
 *
 * Callers get one flat list because that is what both consumers want: the atlas packer
 * walks it per split, and the manifest writer keys it by id.
 */
export function samplePool(seed: number = SEED): readonly SampledImage[] {
  const random = createRandom(seed)
  const images = [...sampleSplit(random, 'training'), ...sampleSplit(random, 'pool')]

  const expected = SPLIT_SIZES.training + SPLIT_SIZES.pool
  if (images.length !== expected) {
    throw new Error(`sampled ${images.length} images, expected ${expected}`)
  }
  return images
}

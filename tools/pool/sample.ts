/**
 * Draws the pool's attribute vectors and gives each one an id.
 *
 * `design.md` — the split gap is authored, so the populations that carry it are
 * partitioned explicitly rather than sampled and hoped for: 300 of the 500 pool reds are
 * pushed outside the fitted band by construction, and exactly 100 of the 250 pool
 * worms are the subtle ones on otherwise-in-band reds. Sampling from a wide range and
 * counting what came out would make the lesson depend on the seed.
 *
 * The training split's role is decided here too, because the role determines which
 * distribution an image is drawn from: its fitted 160 come from the narrow authored band,
 * its held-out 40 from the evaluation pool's distributions, so held-out accuracy estimates
 * harvest accuracy. That is what makes the workshop's train-versus-test gap a diagnosis.
 * The price is that roles stop being additive over an existing pool — see `params.ts`,
 * `SEED`, for why the pool has to be republished when they move.
 *
 * Ids are assigned after a shuffle, so the browsable training split is a mix rather than
 * a hundred reds followed by fifty greens. The shuffle draws from the same seeded
 * stream, so the id-to-apple mapping is still a pure function of the seed.
 */

import type { ImageAttributes } from './bands.js'
import {
  BAND_ATTRIBUTES,
  CATEGORY_COUNTS,
  FITTED_RED,
  GREEN,
  GREEN_WORM_VISIBILITY,
  HELD_OUT_COUNTS,
  HELD_OUT_POPULATIONS,
  HUE_DECIMALS,
  OUT_OF_BAND,
  OUT_OF_BAND_POOL_REDS,
  POOL_RED,
  SEED,
  SPLIT_SIZES,
  SUBTLE_POOL_WORMS,
  UNIT_DECIMALS,
  WORM_VISIBILITY,
  type Band,
  type PoolCategory,
  type Range,
  type SplitName,
  type TrainingRole,
} from './params.js'
import { createRandom, type Random } from './random.js'

/**
 * One generated apple, before it is placed in an atlas.
 *
 * `role` is carried by training images only. An evaluation-pool image playing a training
 * role is a contradiction the manifest reader refuses, so it is not expressible here
 * either — the field is absent rather than set to something meaningless.
 */
export interface SampledImage {
  readonly id: string
  readonly split: SplitName
  readonly category: PoolCategory
  readonly attributes: ImageAttributes
  readonly role?: TrainingRole
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
 * An apple guaranteed to sit outside the fitted band.
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
  /** Training groups only: which role every image of this group plays. */
  readonly role?: TrainingRole
}

/**
 * The five populations the harvest is drawn from, one definition each.
 *
 * Both the evaluation pool and the training split's held-out images draw from these. The
 * sharing is the point: "held out from the harvest's distribution" is then a property of
 * the code rather than a resemblance between two literals that could drift apart the next
 * time a band moves.
 */
const HARVEST_DRAWS: Readonly<Record<string, (random: Random) => ImageAttributes>> = {
  redInBand: (r) => drawBand(r, FITTED_RED, 0),
  redOutOfBand: (r) => drawOutOfBand(r, 0),
  green: (r) => drawBand(r, GREEN, GREEN_WORM_VISIBILITY),
  wormySubtle: (r) => drawBand(r, FITTED_RED, r.inRange(WORM_VISIBILITY.poolSubtle, UNIT_DECIMALS)),
  wormyObvious: (r) => drawBand(r, POOL_RED, r.inRange(WORM_VISIBILITY.poolObvious, UNIT_DECIMALS)),
}

/** The draw of one harvest population, refusing a name `params.ts` does not author. */
function harvestDraw(name: string): (random: Random) => ImageAttributes {
  const draw = HARVEST_DRAWS[name]
  if (draw === undefined) throw new Error(`no harvest population named "${name}"`)
  return draw
}

/** The held-out group of one harvest population, at the count `params.ts` authors for it. */
function heldOutGroup(name: string): Group {
  const population = HELD_OUT_POPULATIONS[name]
  if (population === undefined) throw new Error(`no held-out population named "${name}"`)
  return {
    category: population.category,
    count: population.count,
    draw: harvestDraw(name),
    role: 'heldOut',
  }
}

/**
 * The sampling groups per split, in the order they are drawn.
 *
 * The counts here are the authored gap. Reading this function top to bottom is meant to
 * be the shortest available answer to both "how do the two splits differ" and "what does
 * the model never see until the harvest" — which are no longer the same question, because
 * the training split's held-out images come from the harvest's own populations.
 */
function groupsFor(split: SplitName): readonly Group[] {
  const counts = CATEGORY_COUNTS[split]

  if (split === 'training') {
    return [
      // The fitted 160, drawn from the narrow authored band. Uniform reds are what leave
      // an unregularized model over-selective.
      {
        category: 'red',
        count: counts.red - HELD_OUT_COUNTS.red,
        draw: (r) => drawBand(r, FITTED_RED, 0),
        role: 'fitted',
      },
      {
        category: 'green',
        count: counts.green - HELD_OUT_COUNTS.green,
        draw: (r) => drawBand(r, GREEN, GREEN_WORM_VISIBILITY),
        role: 'fitted',
      },
      // Fitted worms are obvious, and sit on the same red band as the fitted reds do, so
      // the only thing separating the two categories here is the worm itself.
      {
        category: 'wormy',
        count: counts.wormy - HELD_OUT_COUNTS.wormy,
        draw: (r) => drawBand(r, FITTED_RED, r.inRange(WORM_VISIBILITY.fitted, UNIT_DECIMALS)),
        role: 'fitted',
      },
      // The held-out 40, drawn from the harvest's populations in the harvest's
      // proportions. This is what makes the fitted-versus-held-out gap a generalization
      // gap rather than the same distribution measured twice.
      heldOutGroup('redInBand'),
      heldOutGroup('redOutOfBand'),
      heldOutGroup('green'),
      heldOutGroup('wormySubtle'),
      heldOutGroup('wormyObvious'),
    ]
  }

  const inBandReds = counts.red - OUT_OF_BAND_POOL_REDS
  const obviousWorms = counts.wormy - SUBTLE_POOL_WORMS

  return [
    // Reds the fitted images showed the likes of.
    { category: 'red', count: inBandReds, draw: harvestDraw('redInBand') },
    // Reds they did not: the under-regularization lesson.
    { category: 'red', count: OUT_OF_BAND_POOL_REDS, draw: harvestDraw('redOutOfBand') },
    { category: 'green', count: counts.green, draw: harvestDraw('green') },
    // Subtle worms on otherwise-perfect reds: the over-regularization lesson.
    { category: 'wormy', count: SUBTLE_POOL_WORMS, draw: harvestDraw('wormySubtle') },
    { category: 'wormy', count: obviousWorms, draw: harvestDraw('wormyObvious') },
  ]
}

/** `t-001` for the training split, `p-0001` for the pool. */
export function imageId(split: SplitName, index: number): string {
  const prefix = split === 'training' ? 't' : 'p'
  const width = split === 'training' ? 3 : 4
  return `${prefix}-${String(index + 1).padStart(width, '0')}`
}

function sampleSplit(random: Random, split: SplitName): readonly SampledImage[] {
  const drawn: { category: PoolCategory; attributes: ImageAttributes; role?: TrainingRole }[] = []
  for (const group of groupsFor(split)) {
    for (let i = 0; i < group.count; i += 1) {
      drawn.push({ category: group.category, attributes: group.draw(random), role: group.role })
    }
  }

  // The role rides through the shuffle with the apple it was drawn for, so the browsable
  // split still mixes the two roles rather than paging the fitted images first.
  return random.shuffle(drawn).map((image, index) => ({
    id: imageId(split, index),
    split,
    category: image.category,
    attributes: image.attributes,
    ...(image.role === undefined ? {} : { role: image.role }),
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

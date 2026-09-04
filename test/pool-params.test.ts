import { describe, expect, it } from 'vitest'
import {
  ATLAS_PX,
  BAND_ATTRIBUTES,
  CATEGORY_COUNTS,
  CELLS_PER_ATLAS,
  CELL_PX,
  GREEN,
  GREEN_SHARE_TOLERANCE,
  HELD_OUT_COUNTS,
  HELD_OUT_POPULATIONS,
  HUE_DECIMALS,
  OUT_OF_BAND,
  OUT_OF_BAND_POOL_REDS,
  POOL_RED,
  SEED,
  SPLIT_SIZES,
  SUBTLE_POOL_WORMS,
  SUBTLE_WORM_CEILING,
  FITTED_RED,
  UNIT_DECIMALS,
  WORM_VISIBILITY,
  type Band,
  type SplitName,
} from '../tools/pool/params.js'
import { committedManifest } from './helpers/pool'

const SPLITS: readonly SplitName[] = ['training', 'pool']

function totalFor(split: SplitName): number {
  return Object.values(CATEGORY_COUNTS[split]).reduce((sum, count) => sum + count, 0)
}

function greenShare(split: SplitName): number {
  return CATEGORY_COUNTS[split].green / SPLIT_SIZES[split]
}

function contains(outer: Band, inner: Band): boolean {
  return BAND_ATTRIBUTES.every(
    (attribute) =>
      inner[attribute].min >= outer[attribute].min && inner[attribute].max <= outer[attribute].max,
  )
}

describe('pool generation parameters', () => {
  it('gives each split a category mix summing to its authored size', () => {
    expect(totalFor('training')).toBe(SPLIT_SIZES.training)
    expect(totalFor('pool')).toBe(SPLIT_SIZES.pool)
    expect(SPLIT_SIZES.training).toBe(200)
    expect(SPLIT_SIZES.pool).toBe(1000)
  })

  it('gives green an identical share of both splits', () => {
    expect(Math.abs(greenShare('training') - greenShare('pool'))).toBeLessThanOrEqual(
      GREEN_SHARE_TOLERANCE,
    )
  })

  it('keeps the fitted red band inside the pool red spread', () => {
    // The gap is one band inside another: everything the fitted reds can be, a pool
    // red can also be, and the pool reaches past it on every attribute.
    expect(contains(POOL_RED, FITTED_RED)).toBe(true)
    for (const attribute of BAND_ATTRIBUTES) {
      const wider =
        POOL_RED[attribute].min < FITTED_RED[attribute].min ||
        POOL_RED[attribute].max > FITTED_RED[attribute].max
      expect(wider).toBe(true)
    }
  })

  it('holds green well away from the red band', () => {
    expect(GREEN.hue.min).toBeGreaterThan(POOL_RED.hue.max)
  })

  it('keeps every out-of-band region clear of the fitted band by more than a rounding step', () => {
    for (const attribute of BAND_ATTRIBUTES) {
      const band = FITTED_RED[attribute]
      const step = 10 ** -(attribute === 'hue' ? HUE_DECIMALS : UNIT_DECIMALS)
      for (const region of OUT_OF_BAND[attribute]) {
        const below = region.max < band.min - step
        const above = region.min > band.max + step
        expect(below || above).toBe(true)
      }
    }
  })

  it('keeps out-of-band regions inside the pool spread', () => {
    for (const attribute of BAND_ATTRIBUTES) {
      for (const region of OUT_OF_BAND[attribute]) {
        expect(region.min).toBeGreaterThanOrEqual(POOL_RED[attribute].min)
        expect(region.max).toBeLessThanOrEqual(POOL_RED[attribute].max)
      }
    }
  })

  it('authors both special pool populations inside the counts they come from', () => {
    expect(OUT_OF_BAND_POOL_REDS).toBeLessThanOrEqual(CATEGORY_COUNTS.pool.red)
    expect(SUBTLE_POOL_WORMS).toBeLessThanOrEqual(CATEGORY_COUNTS.pool.wormy)
    expect(OUT_OF_BAND_POOL_REDS).toBeGreaterThan(0)
    expect(SUBTLE_POOL_WORMS).toBeGreaterThan(0)
  })

  it('separates subtle from obvious worms at the ceiling the spec reads', () => {
    expect(WORM_VISIBILITY.poolSubtle.max).toBeLessThan(SUBTLE_WORM_CEILING)
    expect(WORM_VISIBILITY.poolObvious.min).toBeGreaterThanOrEqual(SUBTLE_WORM_CEILING)
    expect(WORM_VISIBILITY.fitted.min).toBeGreaterThan(SUBTLE_WORM_CEILING)
  })

  it('holds out fewer training images than it fits, in every category', () => {
    let heldOut = 0
    for (const [category, count] of Object.entries(HELD_OUT_COUNTS)) {
      const declared = CATEGORY_COUNTS.training[category as keyof typeof HELD_OUT_COUNTS]
      // Both roles non-empty per category: a category missing from either one makes a
      // validation loss that is not measured over what the fitted images cover.
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(declared)
      heldOut += count
    }
    expect(heldOut).toBeLessThan(SPLIT_SIZES.training - heldOut)
    expect(heldOut).toBe(40)
  })

  it('partitions the held-out count of each category across the pool populations', () => {
    // The populations are what the sampler draws; the counts are what the manifest
    // declares. A disagreement between them would hold out a set of the wrong size in a
    // category, which no downstream check would name.
    const perCategory: Record<string, number> = {}
    for (const population of Object.values(HELD_OUT_POPULATIONS)) {
      expect(population.count).toBeGreaterThan(0)
      perCategory[population.category] = (perCategory[population.category] ?? 0) + population.count
    }
    expect(perCategory).toEqual(HELD_OUT_COUNTS)

    const total = Object.values(HELD_OUT_POPULATIONS).reduce((sum, p) => sum + p.count, 0)
    expect(total).toBe(40)
  })

  it('mirrors the evaluation pool proportions in each held-out category', () => {
    // Proportional rather than seed-dependent: the held-out set is a small sample of the
    // harvest, so the harvest's own partition is what it has to reproduce.
    const outOfBandShare = OUT_OF_BAND_POOL_REDS / CATEGORY_COUNTS.pool.red
    const heldOutOfBandShare =
      (HELD_OUT_POPULATIONS.redOutOfBand?.count ?? 0) / HELD_OUT_COUNTS.red
    expect(heldOutOfBandShare).toBeCloseTo(outOfBandShare, 2)

    const subtleShare = SUBTLE_POOL_WORMS / CATEGORY_COUNTS.pool.wormy
    const heldSubtleShare = (HELD_OUT_POPULATIONS.wormySubtle?.count ?? 0) / HELD_OUT_COUNTS.wormy
    expect(heldSubtleShare).toBeCloseTo(subtleShare, 2)
  })

  it('leaves every category enough fitted images to keep both roles non-empty', () => {
    for (const [category, held] of Object.entries(HELD_OUT_COUNTS)) {
      const fitted = CATEGORY_COUNTS.training[category as keyof typeof HELD_OUT_COUNTS] - held
      expect(fitted).toBeGreaterThan(0)
    }
  })

  it('names every training category in the held-out counts', () => {
    expect(Object.keys(HELD_OUT_COUNTS).sort()).toEqual(
      Object.keys(CATEGORY_COUNTS.training).sort(),
    )
  })

  it('ships a pool generated from the seed declared here', () => {
    // The seed is the pool identity a prediction artifact is bound to. A parameter
    // change that moves the images without moving the seed would let a stale artifact
    // load against new apples under the same ids, so the constant and the committed
    // manifest have to agree before anything downstream can be trusted.
    expect(committedManifest().seed).toBe(SEED)
  })

  it('fits every split into whole atlases of the declared geometry', () => {
    expect(CELLS_PER_ATLAS).toBe(256)
    expect(ATLAS_PX / CELL_PX).toBe(16)
    for (const split of SPLITS) {
      expect(Math.ceil(SPLIT_SIZES[split] / CELLS_PER_ATLAS)).toBeGreaterThan(0)
    }
    expect(Math.ceil(SPLIT_SIZES.training / CELLS_PER_ATLAS)).toBe(1)
    expect(Math.ceil(SPLIT_SIZES.pool / CELLS_PER_ATLAS)).toBe(4)
  })
})

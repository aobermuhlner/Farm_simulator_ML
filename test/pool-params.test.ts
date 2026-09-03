import { describe, expect, it } from 'vitest'
import {
  ATLAS_PX,
  BAND_ATTRIBUTES,
  CATEGORY_COUNTS,
  CELLS_PER_ATLAS,
  CELL_PX,
  GREEN,
  GREEN_SHARE_TOLERANCE,
  HUE_DECIMALS,
  OUT_OF_BAND,
  OUT_OF_BAND_POOL_REDS,
  POOL_RED,
  SPLIT_SIZES,
  SUBTLE_POOL_WORMS,
  SUBTLE_WORM_CEILING,
  TRAINING_RED,
  UNIT_DECIMALS,
  WORM_VISIBILITY,
  type Band,
  type SplitName,
} from '../tools/pool/params.js'

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

  it('keeps the training red band inside the pool red spread', () => {
    // The gap is one band inside another: everything the training reds can be, a pool
    // red can also be, and the pool reaches past it on every attribute.
    expect(contains(POOL_RED, TRAINING_RED)).toBe(true)
    for (const attribute of BAND_ATTRIBUTES) {
      const wider =
        POOL_RED[attribute].min < TRAINING_RED[attribute].min ||
        POOL_RED[attribute].max > TRAINING_RED[attribute].max
      expect(wider).toBe(true)
    }
  })

  it('holds green well away from the red band', () => {
    expect(GREEN.hue.min).toBeGreaterThan(POOL_RED.hue.max)
  })

  it('keeps every out-of-band region clear of the training band by more than a rounding step', () => {
    for (const attribute of BAND_ATTRIBUTES) {
      const band = TRAINING_RED[attribute]
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
    expect(WORM_VISIBILITY.training.min).toBeGreaterThan(SUBTLE_WORM_CEILING)
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

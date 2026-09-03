import { describe, expect, it } from 'vitest'
import { insideTrainingRedBand } from '../tools/pool/bands.js'
import {
  BAND_ATTRIBUTES,
  CATEGORY_COUNTS,
  GREEN,
  OUT_OF_BAND_POOL_REDS,
  SEED,
  SPLIT_SIZES,
  SUBTLE_POOL_WORMS,
  SUBTLE_WORM_CEILING,
  WORM_VISIBILITY,
  type PoolCategory,
  type SplitName,
} from '../tools/pool/params.js'
import { imageId, samplePool, type SampledImage } from '../tools/pool/sample.js'

const pool = samplePool()

function of(split: SplitName, category?: PoolCategory): readonly SampledImage[] {
  return pool.filter(
    (image) => image.split === split && (category === undefined || image.category === category),
  )
}

describe('attribute sampling', () => {
  it('draws exactly the authored counts', () => {
    expect(of('training')).toHaveLength(SPLIT_SIZES.training)
    expect(of('pool')).toHaveLength(SPLIT_SIZES.pool)
    for (const split of ['training', 'pool'] as const) {
      for (const category of ['red', 'green', 'wormy'] as const) {
        expect(of(split, category)).toHaveLength(CATEGORY_COUNTS[split][category])
      }
    }
  })

  it('keeps every training red inside the training band', () => {
    for (const image of of('training', 'red')) {
      expect(insideTrainingRedBand(image.attributes)).toBe(true)
      expect(image.attributes.wormVisibility).toBe(0)
    }
  })

  it('keeps green inside its hue range and never wormy', () => {
    for (const image of pool.filter((i) => i.category === 'green')) {
      expect(image.attributes.hue).toBeGreaterThanOrEqual(GREEN.hue.min)
      expect(image.attributes.hue).toBeLessThanOrEqual(GREEN.hue.max)
      expect(image.attributes.wormVisibility).toBe(0)
    }
  })

  it('makes every training worm obvious', () => {
    for (const image of of('training', 'wormy')) {
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(WORM_VISIBILITY.training.min)
      expect(image.attributes.wormVisibility).toBeLessThanOrEqual(WORM_VISIBILITY.training.max)
    }
  })
})

describe('the authored gap', () => {
  it('pushes the intended number of pool reds outside the training band', () => {
    const outside = of('pool', 'red').filter((image) => !insideTrainingRedBand(image.attributes))
    expect(outside).toHaveLength(OUT_OF_BAND_POOL_REDS)
  })

  it('leaves the remaining pool reds inside it', () => {
    const inside = of('pool', 'red').filter((image) => insideTrainingRedBand(image.attributes))
    expect(inside).toHaveLength(CATEGORY_COUNTS.pool.red - OUT_OF_BAND_POOL_REDS)
  })

  it('hides exactly the authored number of subtle worms on otherwise-perfect reds', () => {
    const subtle = of('pool', 'wormy').filter(
      (image) => image.attributes.wormVisibility < SUBTLE_WORM_CEILING,
    )
    expect(subtle).toHaveLength(SUBTLE_POOL_WORMS)
    for (const image of subtle) {
      // The trap: everything except the worm says "perfect training-grade red".
      expect(insideTrainingRedBand(image.attributes)).toBe(true)
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(WORM_VISIBILITY.poolSubtle.min)
    }
  })

  it('leaves no subtle worm in the training split', () => {
    const subtle = of('training', 'wormy').filter(
      (image) => image.attributes.wormVisibility < SUBTLE_WORM_CEILING,
    )
    expect(subtle).toHaveLength(0)
  })
})

describe('image ids', () => {
  it('numbers each split densely from one, in its own format', () => {
    expect(of('training').map((i) => i.id)).toEqual(
      Array.from({ length: SPLIT_SIZES.training }, (_, i) => imageId('training', i)),
    )
    expect(of('pool')[0]?.id).toBe('p-0001')
    expect(of('pool').at(-1)?.id).toBe('p-1000')
    expect(of('training')[0]?.id).toBe('t-001')
  })

  it('gives every image in the pool a unique id', () => {
    expect(new Set(pool.map((image) => image.id)).size).toBe(pool.length)
  })

  it('reproduces an identical id-to-attribute mapping from the same seed', () => {
    expect(samplePool(SEED)).toEqual(samplePool(SEED))
  })

  it('produces a different pool from a different seed', () => {
    expect(samplePool(SEED + 1)).not.toEqual(samplePool(SEED))
  })

  it('mixes the categories rather than laying them out in blocks', () => {
    // The training split is browsable, so a student paging it should not meet a hundred
    // reds before the first worm.
    const firstWorm = of('training').findIndex((image) => image.category === 'wormy')
    expect(firstWorm).toBeGreaterThanOrEqual(0)
    expect(firstWorm).toBeLessThan(CATEGORY_COUNTS.training.red)
  })

  it('records every attribute on every image', () => {
    for (const image of pool) {
      for (const attribute of BAND_ATTRIBUTES) {
        expect(typeof image.attributes[attribute]).toBe('number')
      }
      expect(typeof image.attributes.wormVisibility).toBe('number')
    }
  })
})

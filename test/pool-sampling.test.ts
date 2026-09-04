import { describe, expect, it } from 'vitest'
import { insideFittedRedBand } from '../tools/pool/bands.js'
import {
  BAND_ATTRIBUTES,
  CATEGORY_COUNTS,
  GREEN,
  HELD_OUT_COUNTS,
  HELD_OUT_POPULATIONS,
  OUT_OF_BAND_POOL_REDS,
  SEED,
  SPLIT_SIZES,
  SUBTLE_POOL_WORMS,
  SUBTLE_WORM_CEILING,
  WORM_VISIBILITY,
  type PoolCategory,
  type SplitName,
  type TrainingRole,
} from '../tools/pool/params.js'
import { imageId, samplePool, type SampledImage } from '../tools/pool/sample.js'

const pool = samplePool()

function of(split: SplitName, category?: PoolCategory): readonly SampledImage[] {
  return pool.filter(
    (image) => image.split === split && (category === undefined || image.category === category),
  )
}

function role(name: TrainingRole, category?: PoolCategory): readonly SampledImage[] {
  return of('training', category).filter((image) => image.role === name)
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

  it('keeps every fitted red inside the fitted band', () => {
    for (const image of role('fitted', 'red')) {
      expect(insideFittedRedBand(image.attributes)).toBe(true)
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

  it('makes every fitted worm obvious', () => {
    for (const image of role('fitted', 'wormy')) {
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(WORM_VISIBILITY.fitted.min)
      expect(image.attributes.wormVisibility).toBeLessThanOrEqual(WORM_VISIBILITY.fitted.max)
    }
  })
})

describe('roles decided at sampling time', () => {
  it('gives every training image a role and no pool image one', () => {
    for (const image of of('training')) {
      expect(['fitted', 'heldOut'], image.id).toContain(image.role)
    }
    for (const image of of('pool')) {
      expect(image.role, image.id).toBeUndefined()
    }
  })

  it('holds out the authored count of every category, and no more', () => {
    for (const [category, held] of Object.entries(HELD_OUT_COUNTS)) {
      const declared = CATEGORY_COUNTS.training[category as PoolCategory]
      expect(role('heldOut', category as PoolCategory)).toHaveLength(held)
      expect(role('fitted', category as PoolCategory)).toHaveLength(declared - held)
    }
    expect(role('heldOut')).toHaveLength(40)
    expect(role('fitted')).toHaveLength(SPLIT_SIZES.training - 40)
  })

  it('draws each held-out group from the pool band its harvest counterpart draws from', () => {
    // The five populations, each asserted by the property that distinguishes it in the
    // evaluation pool. Held-out accuracy only estimates harvest accuracy if these match.
    const heldRed = role('heldOut', 'red')
    const inBand = heldRed.filter((image) => insideFittedRedBand(image.attributes))
    expect(inBand).toHaveLength(HELD_OUT_POPULATIONS.redInBand?.count ?? -1)
    expect(heldRed.length - inBand.length).toBe(HELD_OUT_POPULATIONS.redOutOfBand?.count ?? -1)
    for (const image of heldRed) expect(image.attributes.wormVisibility).toBe(0)

    for (const image of role('heldOut', 'green')) {
      expect(image.attributes.hue).toBeGreaterThanOrEqual(GREEN.hue.min)
      expect(image.attributes.hue).toBeLessThanOrEqual(GREEN.hue.max)
      expect(image.attributes.wormVisibility).toBe(0)
    }

    const heldWormy = role('heldOut', 'wormy')
    const subtle = heldWormy.filter(
      (image) => image.attributes.wormVisibility < SUBTLE_WORM_CEILING,
    )
    expect(subtle).toHaveLength(HELD_OUT_POPULATIONS.wormySubtle?.count ?? -1)
    expect(heldWormy.length - subtle.length).toBe(HELD_OUT_POPULATIONS.wormyObvious?.count ?? -1)
    for (const image of subtle) {
      // The same trap the harvest sets: everything but the worm says perfect fitted red.
      expect(insideFittedRedBand(image.attributes)).toBe(true)
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(
        WORM_VISIBILITY.poolSubtle.min,
      )
    }
  })

  it('shows the held-out images things no fitted image ever showed', () => {
    // The gap, stated as the sampler produces it rather than as the manifest records it.
    const fittedWorms = role('fitted', 'wormy').map((i) => i.attributes.wormVisibility)
    const faintest = Math.min(...fittedWorms)
    expect(
      role('heldOut', 'wormy').some((image) => image.attributes.wormVisibility < faintest),
    ).toBe(true)
    expect(
      role('heldOut', 'red').some((image) => !insideFittedRedBand(image.attributes)),
    ).toBe(true)
  })
})

describe('the authored gap', () => {
  it('pushes the intended number of pool reds outside the fitted band', () => {
    const outside = of('pool', 'red').filter((image) => !insideFittedRedBand(image.attributes))
    expect(outside).toHaveLength(OUT_OF_BAND_POOL_REDS)
  })

  it('leaves the remaining pool reds inside it', () => {
    const inside = of('pool', 'red').filter((image) => insideFittedRedBand(image.attributes))
    expect(inside).toHaveLength(CATEGORY_COUNTS.pool.red - OUT_OF_BAND_POOL_REDS)
  })

  it('hides exactly the authored number of subtle worms on otherwise-perfect reds', () => {
    const subtle = of('pool', 'wormy').filter(
      (image) => image.attributes.wormVisibility < SUBTLE_WORM_CEILING,
    )
    expect(subtle).toHaveLength(SUBTLE_POOL_WORMS)
    for (const image of subtle) {
      // The trap: everything except the worm says "perfect training-grade red".
      expect(insideFittedRedBand(image.attributes)).toBe(true)
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(WORM_VISIBILITY.poolSubtle.min)
    }
  })

  it('leaves no subtle worm among the fitted images', () => {
    // Among the held-out ones there deliberately are some — that is this change.
    const subtle = role('fitted', 'wormy').filter(
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
    // And mixes the roles too, so the browsable split is not fitted images first.
    const firstHeldOut = of('training').findIndex((image) => image.role === 'heldOut')
    expect(firstHeldOut).toBeGreaterThanOrEqual(0)
    expect(firstHeldOut).toBeLessThan(SPLIT_SIZES.training - 40)
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

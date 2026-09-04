/**
 * The authored split gap, asserted against the pool that actually ships.
 *
 * `test/pool-sampling.test.ts` checks the sampler; this file checks the committed
 * manifest. The difference matters: a sampler that is correct and a manifest that was
 * generated before someone edited the parameters would pass the first file and fail this
 * one, which is the failure worth catching — the students see the committed pool.
 *
 * Each `it` here corresponds to a scenario in specs/image-pool/spec.md.
 *
 * The band is a property of the *fitted* role, not of the training split: the split's 40
 * held-out images are drawn from the evaluation pool's populations so that held-out
 * accuracy estimates harvest accuracy. Assertions about "how the training data looks"
 * therefore read `fitted(...)`, and the held-out images get assertions of their own.
 */

import { describe, expect, it } from 'vitest'
import { insideFittedRedBand } from '../tools/pool/bands.js'
import {
  BAND_ATTRIBUTES,
  CATEGORY_COUNTS,
  GREEN,
  GREEN_SHARE_TOLERANCE,
  HELD_OUT_COUNTS,
  HELD_OUT_POPULATIONS,
  OUT_OF_BAND_POOL_REDS,
  SPLIT_SIZES,
  SUBTLE_POOL_WORMS,
  SUBTLE_WORM_CEILING,
  FITTED_RED,
  WORM_VISIBILITY,
  type PoolCategory,
  type SplitName,
  type TrainingRole,
} from '../tools/pool/params.js'
import type { ManifestImage } from '../tools/pool/manifest.js'
import { committedManifest } from './helpers/pool'

const manifest = committedManifest()
const entries = Object.entries(manifest.images)

function imagesIn(split: SplitName, category?: PoolCategory): ManifestImage[] {
  return entries
    .filter(([, image]) => image.split === split && (category === undefined || image.category === category))
    .map(([, image]) => image)
}

/** The training images of one role, as the committed manifest declares them. */
function inRole(role: TrainingRole, category?: PoolCategory): ManifestImage[] {
  return imagesIn('training', category).filter((image) => image.role === role)
}

const fitted = (category?: PoolCategory): ManifestImage[] => inRole('fitted', category)
const heldOut = (category?: PoolCategory): ManifestImage[] => inRole('heldOut', category)

describe('authored sizes and splits', () => {
  it('ships 200 training images and 1000 in the evaluation pool', () => {
    expect(imagesIn('training')).toHaveLength(SPLIT_SIZES.training)
    expect(imagesIn('pool')).toHaveLength(SPLIT_SIZES.pool)
  })

  it('puts every image in exactly one split', () => {
    for (const [, image] of entries) {
      expect(['training', 'pool']).toContain(image.split)
    }
    expect(imagesIn('training').length + imagesIn('pool').length).toBe(entries.length)
  })

  it('declares two splits and no more', () => {
    expect(Object.keys(manifest.splits).sort()).toEqual(['pool', 'training'])
  })
})

describe('the category mix and green', () => {
  it('carries every category in both splits', () => {
    for (const split of ['training', 'pool'] as const) {
      for (const category of ['red', 'green', 'wormy'] as const) {
        expect(imagesIn(split, category).length).toBeGreaterThan(0)
        expect(imagesIn(split, category)).toHaveLength(CATEGORY_COUNTS[split][category])
      }
    }
  })

  it('gives green the same share of both splits', () => {
    const share = (split: SplitName): number => imagesIn(split, 'green').length / SPLIT_SIZES[split]
    expect(Math.abs(share('training') - share('pool'))).toBeLessThanOrEqual(GREEN_SHARE_TOLERANCE)
  })

  it('never puts a worm on a green apple', () => {
    for (const image of [...imagesIn('training', 'green'), ...imagesIn('pool', 'green')]) {
      expect(image.attributes.wormVisibility).toBe(0)
    }
  })

  it('keeps green hue clear of the red band in both splits', () => {
    for (const image of [...imagesIn('training', 'green'), ...imagesIn('pool', 'green')]) {
      expect(image.attributes.hue).toBeGreaterThanOrEqual(GREEN.hue.min)
      expect(image.attributes.hue).toBeLessThanOrEqual(GREEN.hue.max)
      expect(image.attributes.hue).toBeGreaterThan(FITTED_RED.hue.max)
    }
  })
})

describe('the authored distribution gap', () => {
  it('keeps the fitted reds uniform, inside the declared band', () => {
    for (const image of fitted('red')) {
      expect(insideFittedRedBand(image.attributes)).toBe(true)
    }
    expect(fitted('red')).toHaveLength(
      CATEGORY_COUNTS.training.red - HELD_OUT_COUNTS.red,
    )
  })

  it('puts reds in the harvest that the fitted images never showed', () => {
    const outside = imagesIn('pool', 'red').filter((image) => !insideFittedRedBand(image.attributes))
    expect(outside).toHaveLength(OUT_OF_BAND_POOL_REDS)
    // Each of them leaves the band on at least one attribute.
    for (const image of outside) {
      const escaped = BAND_ATTRIBUTES.filter((attribute) => {
        const value = image.attributes[attribute]
        return value < FITTED_RED[attribute].min || value > FITTED_RED[attribute].max
      })
      expect(escaped.length).toBeGreaterThan(0)
    }
  })

  it('makes every fitted worm obvious', () => {
    for (const image of fitted('wormy')) {
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(WORM_VISIBILITY.fitted.min)
    }
    expect(fitted('wormy')).toHaveLength(
      CATEGORY_COUNTS.training.wormy - HELD_OUT_COUNTS.wormy,
    )
  })

  it('hides subtle worms on otherwise-perfect reds in the harvest', () => {
    const subtle = imagesIn('pool', 'wormy').filter(
      (image) => image.attributes.wormVisibility < SUBTLE_WORM_CEILING,
    )
    expect(subtle).toHaveLength(SUBTLE_POOL_WORMS)
    for (const image of subtle) {
      // Everything except the worm says "training-grade red". This population is the
      // over-regularization lesson.
      expect(insideFittedRedBand(image.attributes)).toBe(true)
      expect(image.attributes.wormVisibility).toBeGreaterThan(0)
    }
  })

  it('leaves no subtle worm among the fitted images', () => {
    for (const image of fitted('wormy')) {
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(SUBTLE_WORM_CEILING)
    }
  })
})

describe('the held-out images, drawn from the harvest', () => {
  it('holds out the authored count of every category', () => {
    for (const [category, count] of Object.entries(HELD_OUT_COUNTS)) {
      expect(heldOut(category as PoolCategory)).toHaveLength(count)
    }
    expect(heldOut()).toHaveLength(40)
  })

  it('includes held-out reds outside the fitted band', () => {
    const outside = heldOut('red').filter((image) => !insideFittedRedBand(image.attributes))
    expect(outside.length).toBeGreaterThan(0)
    expect(outside).toHaveLength(HELD_OUT_POPULATIONS.redOutOfBand?.count ?? -1)
    for (const image of outside) {
      const escaped = BAND_ATTRIBUTES.filter((attribute) => {
        const value = image.attributes[attribute]
        return value < FITTED_RED[attribute].min || value > FITTED_RED[attribute].max
      })
      expect(escaped.length).toBeGreaterThan(0)
    }
  })

  it('includes held-out worms fainter than any the model is fitted on', () => {
    const faintestFitted = Math.min(
      ...fitted('wormy').map((image) => image.attributes.wormVisibility),
    )
    const subtler = heldOut('wormy').filter(
      (image) => image.attributes.wormVisibility < faintestFitted,
    )
    // Not a fixed count: the held-out obvious worms are drawn from the pool's obvious
    // range, which reaches below the fitted range, so some of those fall here too. What
    // the scenario asks is that the held-out set reaches past what was fitted at all.
    expect(subtler.length).toBeGreaterThan(0)

    // The subtle population, which is authored: everything except the worm says perfect
    // fitted red. This is the trap the harvest sets, now visible in the workshop.
    const subtle = subtler.filter(
      (image) => image.attributes.wormVisibility < SUBTLE_WORM_CEILING,
    )
    expect(subtle).toHaveLength(HELD_OUT_POPULATIONS.wormySubtle?.count ?? -1)
    for (const image of subtle) {
      expect(insideFittedRedBand(image.attributes)).toBe(true)
      expect(image.attributes.wormVisibility).toBeGreaterThan(0)
    }
  })

  it('draws each held-out category from the population its harvest counterpart uses', () => {
    const inBand = heldOut('red').filter((image) => insideFittedRedBand(image.attributes))
    expect(inBand).toHaveLength(HELD_OUT_POPULATIONS.redInBand?.count ?? -1)

    for (const image of heldOut('green')) {
      expect(image.attributes.hue).toBeGreaterThanOrEqual(GREEN.hue.min)
      expect(image.attributes.hue).toBeLessThanOrEqual(GREEN.hue.max)
      expect(image.attributes.wormVisibility).toBe(0)
    }

    const subtle = heldOut('wormy').filter(
      (image) => image.attributes.wormVisibility < SUBTLE_WORM_CEILING,
    )
    expect(subtle).toHaveLength(HELD_OUT_POPULATIONS.wormySubtle?.count ?? -1)
    for (const image of subtle) {
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(
        WORM_VISIBILITY.poolSubtle.min,
      )
    }
  })

  it('leaves the held-out images inside the training split, not beside it', () => {
    expect(Object.keys(manifest.splits).sort()).toEqual(['pool', 'training'])
    expect(fitted().length + heldOut().length).toBe(SPLIT_SIZES.training)
    for (const image of heldOut()) expect(image.split).toBe('training')
  })
})

describe('recorded attributes', () => {
  it('records every attribute on every image in both splits', () => {
    for (const [id, image] of entries) {
      for (const attribute of BAND_ATTRIBUTES) {
        expect(typeof image.attributes[attribute], `${id}.${attribute}`).toBe('number')
      }
      expect(typeof image.attributes.wormVisibility, `${id}.wormVisibility`).toBe('number')
    }
  })

  it('grades worm visibility rather than flagging it', () => {
    for (const split of ['training', 'pool'] as const) {
      const values = new Set(imagesIn(split, 'wormy').map((image) => image.attributes.wormVisibility))
      // A flag would give one or two values; a graded attribute gives a spread.
      expect(values.size).toBeGreaterThan(10)
    }
    const pool = imagesIn('pool', 'wormy').map((image) => image.attributes.wormVisibility)
    expect(Math.min(...pool)).toBeLessThan(SUBTLE_WORM_CEILING)
    expect(Math.max(...pool)).toBeGreaterThan(0.9)
  })
})

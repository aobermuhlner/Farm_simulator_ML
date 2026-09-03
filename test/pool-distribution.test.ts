/**
 * The authored split gap, asserted against the pool that actually ships.
 *
 * `test/pool-sampling.test.ts` checks the sampler; this file checks the committed
 * manifest. The difference matters: a sampler that is correct and a manifest that was
 * generated before someone edited the parameters would pass the first file and fail this
 * one, which is the failure worth catching — the students see the committed pool.
 *
 * Each `it` here corresponds to a scenario in specs/image-pool/spec.md.
 */

import { describe, expect, it } from 'vitest'
import { insideTrainingRedBand } from '../tools/pool/bands.js'
import {
  BAND_ATTRIBUTES,
  CATEGORY_COUNTS,
  GREEN,
  GREEN_SHARE_TOLERANCE,
  OUT_OF_BAND_POOL_REDS,
  SPLIT_SIZES,
  SUBTLE_POOL_WORMS,
  SUBTLE_WORM_CEILING,
  TRAINING_RED,
  WORM_VISIBILITY,
  type PoolCategory,
  type SplitName,
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
      expect(image.attributes.hue).toBeGreaterThan(TRAINING_RED.hue.max)
    }
  })
})

describe('the authored distribution gap', () => {
  it('keeps the training reds uniform, inside the declared band', () => {
    for (const image of imagesIn('training', 'red')) {
      expect(insideTrainingRedBand(image.attributes)).toBe(true)
    }
  })

  it('puts reds in the harvest that the training split never showed', () => {
    const outside = imagesIn('pool', 'red').filter((image) => !insideTrainingRedBand(image.attributes))
    expect(outside).toHaveLength(OUT_OF_BAND_POOL_REDS)
    // Each of them leaves the band on at least one attribute.
    for (const image of outside) {
      const escaped = BAND_ATTRIBUTES.filter((attribute) => {
        const value = image.attributes[attribute]
        return value < TRAINING_RED[attribute].min || value > TRAINING_RED[attribute].max
      })
      expect(escaped.length).toBeGreaterThan(0)
    }
  })

  it('makes every training worm obvious', () => {
    for (const image of imagesIn('training', 'wormy')) {
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(WORM_VISIBILITY.training.min)
    }
  })

  it('hides subtle worms on otherwise-perfect reds in the harvest', () => {
    const subtle = imagesIn('pool', 'wormy').filter(
      (image) => image.attributes.wormVisibility < SUBTLE_WORM_CEILING,
    )
    expect(subtle).toHaveLength(SUBTLE_POOL_WORMS)
    for (const image of subtle) {
      // Everything except the worm says "training-grade red". This population is the
      // over-regularization lesson.
      expect(insideTrainingRedBand(image.attributes)).toBe(true)
      expect(image.attributes.wormVisibility).toBeGreaterThan(0)
    }
  })

  it('leaves no subtle worm in the training split', () => {
    for (const image of imagesIn('training', 'wormy')) {
      expect(image.attributes.wormVisibility).toBeGreaterThanOrEqual(SUBTLE_WORM_CEILING)
    }
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

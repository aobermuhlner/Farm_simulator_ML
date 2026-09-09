import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planAtlases } from '../tools/pool/atlas.js'
import { buildManifest } from '../tools/pool/manifest.js'
import {
  CATEGORY_COUNTS,
  DATASET_TIERS,
  FEATURE_IDS,
  HELD_OUT_COUNTS,
  SPLIT_SIZES,
  type PoolCategory,
} from '../tools/pool/params.js'
import { tiersHolding } from '../tools/pool/tiers.js'
import { samplePool } from '../tools/pool/sample.js'

const plans = planAtlases(samplePool())

/**
 * Stand-in feature vectors, because this file is about roles.
 *
 * `buildManifest` refuses an image it was given no vector for, and measuring 1 200 real
 * ones means rasterizing five atlases — which `pool-measurement.test.ts` does, over the
 * real pixels, where the numbers are the point. Here they only have to be present.
 */
const placeholderFeatures = Object.fromEntries(
  plans.flatMap((plan) =>
    plan.images.map((image) => [
      image.id,
      Object.fromEntries(FEATURE_IDS.map((id) => [id, 0])) as Record<
        (typeof FEATURE_IDS)[number],
        number
      >,
    ]),
  ),
)

const manifest = buildManifest(plans, '1.0.0', placeholderFeatures)
const entries = Object.entries(manifest.images)

const trainingEntries = entries.filter(([, image]) => image.split === 'training')

describe('manifest role fields', () => {
  it('declares a role for every training image and none for the pool', () => {
    for (const [id, image] of entries) {
      if (image.split === 'training') expect(image.role, id).toBeDefined()
      else expect(image.role, id).toBeUndefined()
    }
    expect(trainingEntries).toHaveLength(SPLIT_SIZES.training)
  })

  it('declares role counts that match the images assigned to them', () => {
    const declared = manifest.splits.training.roles
    for (const role of ['fitted', 'heldOut'] as const) {
      const present = trainingEntries.filter(([, image]) => image.role === role)
      expect(present).toHaveLength(declared[role].count)
    }
    expect(declared.fitted.count + declared.heldOut.count).toBe(manifest.splits.training.count)
  })

  it('holds out the authored share of every category', () => {
    for (const [category, held] of Object.entries(HELD_OUT_COUNTS)) {
      const heldOut = trainingEntries.filter(
        ([, image]) => image.category === (category as PoolCategory) && image.role === 'heldOut',
      )
      const fitted = trainingEntries.filter(
        ([, image]) => image.category === (category as PoolCategory) && image.role === 'fitted',
      )
      expect(heldOut).toHaveLength(held)
      expect(fitted.length).toBeGreaterThan(0)
    }
  })

  it('declares no split beyond the two, whatever the roles do', () => {
    expect(Object.keys(manifest.splits).sort()).toEqual(['pool', 'training'])
  })

  it('keeps the roles out of the images the split browses', () => {
    // All 200 are still described, held-out ones included: holding an image back from
    // training must not hold it back from a student looking at the data.
    expect(trainingEntries).toHaveLength(SPLIT_SIZES.training)
    expect(trainingEntries.some(([, image]) => image.role === 'heldOut')).toBe(true)
  })
})

describe('manifest tier fields', () => {
  const declared = DATASET_TIERS.map((tier) => tier.id)

  it('declares an entry tier for every training image and none for the pool', () => {
    for (const [id, image] of entries) {
      if (image.split === 'training') {
        expect(image.tier, id).toBeDefined()
        expect(declared, id).toContain(image.tier)
      } else {
        expect(image.tier, id).toBeUndefined()
      }
    }
    expect(trainingEntries).toHaveLength(SPLIT_SIZES.training)
  })

  it('declares one label per holding tier, and none for the pool', () => {
    for (const [id, image] of entries) {
      if (image.split !== 'training') {
        expect(image.tierLabels, id).toBeUndefined()
        continue
      }
      expect(Object.keys(image.tierLabels ?? {}), id).toEqual(
        tiersHolding(image.tier as string),
      )
      for (const label of Object.values(image.tierLabels ?? {})) {
        expect(Object.keys(CATEGORY_COUNTS.training), id).toContain(label)
      }
    }
  })

  it('files every apple of the shipped pool under its true category, which authors no mislabels', () => {
    for (const [id, image] of trainingEntries) {
      expect(image.tierLabels, id).toEqual({ starter: image.category })
    }
  })

  it('leaves the split counts counting every training image, whatever tier it enters at', () => {
    expect(manifest.splits.training.count).toBe(SPLIT_SIZES.training)
    expect(trainingEntries.filter(([, image]) => image.tier !== undefined)).toHaveLength(
      manifest.splits.training.count,
    )
    expect(Object.keys(manifest.splits).sort()).toEqual(['pool', 'training'])
  })
})

describe('the generated tiers against the figures the task declares', () => {
  const declared = JSON.parse(
    readFileSync(join(process.cwd(), 'declarations', 'apple-harvest.json'), 'utf8'),
  ) as {
    datasets: readonly {
      id: string
      size: number
      composition: Record<string, number>
    }[]
  }

  it('gives the smallest tier the size and the composition it declares', () => {
    const smallest = declared.datasets[0]!
    const held = trainingEntries.filter(([, image]) => image.tierLabels?.[smallest.id] !== undefined)

    expect(held).toHaveLength(smallest.size)
    for (const [category, count] of Object.entries(smallest.composition)) {
      const filed = held.filter(([, image]) => image.tierLabels?.[smallest.id] === category)
      expect(filed, category).toHaveLength(count)
    }
  })

  it('gives the larger tiers no photographs at all, which is what leaves them unreachable', () => {
    for (const tier of declared.datasets.slice(1)) {
      const held = trainingEntries.filter(([, image]) => image.tierLabels?.[tier.id] !== undefined)
      expect(held, tier.id).toHaveLength(0)
      // Declared and explained all the same, so pricing them later is a catalog edit.
      expect(tier.size, tier.id).toBeGreaterThan(0)
    }
  })
})

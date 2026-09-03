import { describe, expect, it } from 'vitest'
import { planAtlases } from '../tools/pool/atlas.js'
import { buildManifest } from '../tools/pool/manifest.js'
import { HELD_OUT_COUNTS, SPLIT_SIZES, type PoolCategory } from '../tools/pool/params.js'
import { samplePool } from '../tools/pool/sample.js'

const manifest = buildManifest(planAtlases(samplePool()), '1.0.0')
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

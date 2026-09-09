import { describe, expect, it } from 'vitest'
import { insideFittedRedBand } from '../tools/pool/bands.js'
import {
  CATEGORY_COUNTS,
  FITTED_RED,
  HELD_OUT_COUNTS,
  SPLIT_SIZES,
  DATASET_TIERS,
  WORM_VISIBILITY,
  type PoolCategory,
} from '../tools/pool/params.js'
import { assertRolesCanShowTheGap, heldOutBandDefect, roleCounts, rolesOf } from '../tools/pool/roles.js'
import {
  assertTiersAreFittedAndValidated,
  imagesHeldBy,
  tierRoleDefect,
  tiersOf,
} from '../tools/pool/tiers.js'
import { samplePool, type SampledImage } from '../tools/pool/sample.js'

const pool = samplePool()
const roles = rolesOf(pool)

const training = pool.filter((image) => image.split === 'training')

function idsOf(category: PoolCategory, role: 'fitted' | 'heldOut'): readonly string[] {
  return training
    .filter((image) => image.category === category && roles[image.id] === role)
    .map((image) => image.id)
}

describe('training roles', () => {
  it('gives every training image exactly one role', () => {
    expect(Object.keys(roles)).toHaveLength(SPLIT_SIZES.training)
    for (const image of training) {
      expect(['fitted', 'heldOut']).toContain(roles[image.id])
    }
  })

  it('assigns no role to an evaluation-pool image', () => {
    for (const image of pool.filter((candidate) => candidate.split === 'pool')) {
      expect(roles[image.id]).toBeUndefined()
    }
  })

  it('holds out the authored count of every category', () => {
    for (const [category, held] of Object.entries(HELD_OUT_COUNTS)) {
      const declared = CATEGORY_COUNTS.training[category as PoolCategory]
      expect(idsOf(category as PoolCategory, 'heldOut')).toHaveLength(held)
      expect(idsOf(category as PoolCategory, 'fitted')).toHaveLength(declared - held)
    }
  })

  it('puts every category in both roles', () => {
    for (const category of Object.keys(HELD_OUT_COUNTS) as PoolCategory[]) {
      expect(idsOf(category, 'fitted').length).toBeGreaterThan(0)
      expect(idsOf(category, 'heldOut').length).toBeGreaterThan(0)
    }
  })

  it('keeps the held-out role the smaller of the two', () => {
    const counts = roleCounts(roles)
    expect(counts.heldOut).toBeLessThan(counts.fitted)
    expect(counts.fitted + counts.heldOut).toBe(SPLIT_SIZES.training)
  })

  it('reproduces both the roles and the apples behind them from the same seed', () => {
    // The role is drawn with the image now, so reproducibility is one property rather
    // than two: the same seed has to give back the same partition *and* the same pool.
    const again = samplePool()
    expect(rolesOf(again)).toEqual(roles)
    expect(again).toEqual(pool)
  })

  it('refuses a training image the sampler left without a role', () => {
    const roleless = training.map(({ role: _role, ...rest }) => rest as SampledImage)
    expect(() => rolesOf(roleless)).toThrow(/t-001/)
  })
})

describe('a held-out set that cannot show the gap', () => {
  /** The pool with every held-out image of `category` pulled back inside the fitted band. */
  function confined(category: PoolCategory): readonly SampledImage[] {
    const middle = (attribute: 'hue' | 'roundness' | 'gloss' | 'lighting'): number =>
      (FITTED_RED[attribute].min + FITTED_RED[attribute].max) / 2

    return pool.map((image) => {
      if (image.split !== 'training' || image.role !== 'heldOut') return image
      if (image.category !== category) return image
      return {
        ...image,
        attributes: {
          hue: middle('hue'),
          roundness: middle('roundness'),
          gloss: middle('gloss'),
          lighting: middle('lighting'),
          // Obvious, like every fitted worm: nothing here the model has not already seen.
          wormVisibility: image.category === 'wormy' ? WORM_VISIBILITY.fitted.max : 0,
        },
      }
    })
  }

  it('names the red category when every held-out red sits in the fitted band', () => {
    expect(heldOutBandDefect(confined('red'))).toMatch(/"red"/)
    expect(() => assertRolesCanShowTheGap(confined('red'))).toThrow(/"red"/)
  })

  it('names the wormy category when no held-out worm is fainter than the fitted ones', () => {
    expect(heldOutBandDefect(confined('wormy'))).toMatch(/"wormy"/)
    expect(() => assertRolesCanShowTheGap(confined('wormy'))).toThrow(/"wormy"/)
  })

  it('accepts the pool that ships, which spans both', () => {
    expect(heldOutBandDefect(pool)).toBeUndefined()
    expect(() => assertRolesCanShowTheGap(pool)).not.toThrow()

    const heldRed = training.filter((i) => i.role === 'heldOut' && i.category === 'red')
    expect(heldRed.some((image) => !insideFittedRedBand(image.attributes))).toBe(true)
  })

  it('refuses a category holding out a count it does not declare', () => {
    const starved = pool.map((image) =>
      image.split === 'training' && image.category === 'green' && image.role === 'heldOut'
        ? { ...image, role: 'fitted' as const }
        : image,
    )
    expect(() => assertRolesCanShowTheGap(starved)).toThrow(/green/)
  })
})

describe('the roles restricted to a dataset tier', () => {
  const categories = Object.keys(CATEGORY_COUNTS.training) as PoolCategory[]

  it('gives every declared tier both roles in every category', () => {
    const assignment = tiersOf(pool)
    for (const tier of DATASET_TIERS) {
      const ids = new Set(imagesHeldBy(tier.id, assignment))
      for (const category of categories) {
        for (const role of ['fitted', 'heldOut'] as const) {
          const held = idsOf(category, role).filter((id) => ids.has(id))
          expect(held.length, `${tier.id}/${category}/${role}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('refuses a tier missing a role in some category, naming all three', () => {
    // A tier holding two images cannot reach six (category, role) groups, so the
    // arithmetic that spreads a tier across the split cannot rescue it and the generator
    // says which hole it found rather than writing a pool that draws a flat curve.
    const tiny = [
      { id: 'crumb', holds: 2, mislabels: 0 },
      { id: 'whole', holds: SPLIT_SIZES.training, mislabels: 0 },
    ]
    const defect = tierRoleDefect(pool, tiersOf(pool, tiny), categories, tiny)
    expect(defect).toMatch(/"crumb"/)
    expect(defect).toMatch(/role "(fitted|heldOut)"/)
    expect(defect).toMatch(/category "(red|green|wormy)"/)
  })

  it('is checked before a pool is written, from the manifest builder', () => {
    // The guard sits beside the held-out band guard in `buildManifest`, so a pool whose
    // tiers cannot be validated fails the generator run rather than shipping.
    const assignment = tiersOf(pool)
    expect(() => assertTiersAreFittedAndValidated(pool, assignment, categories)).not.toThrow()
  })
})

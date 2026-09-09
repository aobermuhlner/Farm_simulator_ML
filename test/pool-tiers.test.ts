import { describe, expect, it } from 'vitest'
import {
  CATEGORY_COUNTS,
  DATASET_TIERS,
  SEED,
  SPLIT_SIZES,
  type DatasetTier,
  type PoolCategory,
} from '../tools/pool/params.js'
import { samplePool } from '../tools/pool/sample.js'
import {
  assertTiersAreFittedAndValidated,
  imagesHeldBy,
  tierLabelsOf,
  tierRoleDefect,
  tiersHolding,
  tiersOf,
} from '../tools/pool/tiers.js'

const CATEGORIES = Object.keys(CATEGORY_COUNTS.training) as PoolCategory[]

const pool = samplePool()
const training = pool.filter((image) => image.split === 'training')
const assignment = tiersOf(pool)

/**
 * A three-tier ladder over the same 200 images, for the properties one tier cannot show.
 *
 * The shipped pool authors one tier holding the whole training split, so nesting,
 * relabelling and the role restriction are all degenerate on it. These are the tiers
 * `declarations/apple-harvest.json` declares, sized down to what the pool actually holds:
 * the arithmetic being checked is proportional, so the shape of the answer is the same at
 * 200 images as it would be at 2 000.
 */
const LADDER: readonly DatasetTier[] = [
  { id: 'small', holds: 50, mislabels: 0 },
  { id: 'middle', holds: 120, mislabels: 6 },
  { id: 'whole', holds: SPLIT_SIZES.training, mislabels: 0 },
]

describe('the entry tier of a training image', () => {
  it('is declared for every training image and for no evaluation image', () => {
    expect(Object.keys(assignment)).toHaveLength(SPLIT_SIZES.training)
    for (const image of pool) {
      if (image.split === 'training') expect(assignment[image.id], image.id).toBeDefined()
      else expect(assignment[image.id], image.id).toBeUndefined()
    }
  })

  it('names a tier the pool declares', () => {
    const declared = DATASET_TIERS.map((tier) => tier.id)
    for (const [id, tier] of Object.entries(assignment)) {
      expect(declared, id).toContain(tier)
    }
  })

  it('is reproduced by the same seed, and by a second run of the generator', () => {
    expect(tiersOf(samplePool(), DATASET_TIERS, SEED)).toEqual(assignment)
    expect(tiersOf(pool, LADDER)).toEqual(tiersOf(samplePool(), LADDER))
  })

  it('puts every image of the shipped pool in its only tier', () => {
    const only = DATASET_TIERS[0] as DatasetTier
    expect(new Set(Object.values(assignment))).toEqual(new Set([only.id]))
    expect(imagesHeldBy(only.id, assignment)).toHaveLength(SPLIT_SIZES.training)
  })
})

describe('tier membership nests', () => {
  const ladder = tiersOf(pool, LADDER)

  it('holds every image of a smaller tier in every larger one', () => {
    for (let i = 1; i < LADDER.length; i += 1) {
      const smaller = imagesHeldBy((LADDER[i - 1] as DatasetTier).id, ladder, LADDER)
      const larger = new Set(imagesHeldBy((LADDER[i] as DatasetTier).id, ladder, LADDER))
      for (const id of smaller) expect(larger, id).toContain(id)
      expect(larger.size).toBeGreaterThan(smaller.length)
    }
  })

  it('holds each tier to the size it declares, and the largest to the whole split', () => {
    for (const tier of LADDER) {
      expect(imagesHeldBy(tier.id, ladder, LADDER), tier.id).toHaveLength(tier.holds)
    }
  })

  it('names the holding tiers of an image as its own and every larger one', () => {
    expect(tiersHolding('small', LADDER)).toEqual(['small', 'middle', 'whole'])
    expect(tiersHolding('middle', LADDER)).toEqual(['middle', 'whole'])
    expect(tiersHolding('whole', LADDER)).toEqual(['whole'])
  })

  it('refuses a tier the ladder does not declare', () => {
    expect(() => tiersHolding('bought-later', LADDER)).toThrow(/bought-later/)
    expect(() => imagesHeldBy('bought-later', ladder, LADDER)).toThrow(/bought-later/)
  })
})

describe('the label each tier files an image under', () => {
  const labels = tierLabelsOf(assignment, pool, CATEGORIES)

  it('is declared once per tier that holds the image', () => {
    for (const image of training) {
      expect(Object.keys(labels[image.id] ?? {}), image.id).toEqual(
        tiersHolding(assignment[image.id] as string),
      )
    }
  })

  it('is the true category in the shipped pool, which authors no mislabels', () => {
    for (const image of training) {
      expect(labels[image.id], image.id).toEqual({ starter: image.category })
    }
  })

  it('is reproduced by the same seed', () => {
    expect(tierLabelsOf(assignment, pool, CATEGORIES, DATASET_TIERS, SEED)).toEqual(labels)
  })
})

describe('a tier that files some apples wrongly', () => {
  const ladder = tiersOf(pool, LADDER)
  const labels = tierLabelsOf(ladder, pool, CATEGORIES, LADDER)

  function wrong(tierId: string): readonly string[] {
    return imagesHeldBy(tierId, ladder, LADDER).filter((id) => {
      const image = training.find((candidate) => candidate.id === id)
      return labels[id]?.[tierId] !== image?.category
    })
  }

  it('files exactly as many wrongly as it declares', () => {
    expect(wrong('middle')).toHaveLength(6)
    expect(wrong('small')).toHaveLength(0)
    expect(wrong('whole')).toHaveLength(0)
  })

  it('files them under another category the pool declares, never under a made-up one', () => {
    for (const id of wrong('middle')) {
      expect(CATEGORIES, id).toContain(labels[id]?.middle)
    }
  })

  it('leaves the labels of the tiers that checked the same image standing', () => {
    for (const id of wrong('middle')) {
      const image = training.find((candidate) => candidate.id === id)
      expect(labels[id]?.whole, id).toBe(image?.category)
      if (labels[id]?.small !== undefined) expect(labels[id]?.small, id).toBe(image?.category)
    }
  })

  it('is reproduced by the same seed', () => {
    expect(tierLabelsOf(ladder, pool, CATEGORIES, LADDER, SEED)).toEqual(labels)
  })

  it('cannot file more wrongly than it holds', () => {
    const greedy: readonly DatasetTier[] = [
      { id: 'small', holds: 50, mislabels: 80 },
      { id: 'whole', holds: SPLIT_SIZES.training, mislabels: 0 },
    ]
    expect(() => tierLabelsOf(tiersOf(pool, greedy), pool, CATEGORIES, greedy)).toThrow(
      /files 80 images wrongly but holds only 50/,
    )
  })
})

describe('every tier is fitted and validated on every category', () => {
  it('accepts the shipped pool', () => {
    expect(tierRoleDefect(pool, assignment, CATEGORIES)).toBeUndefined()
    expect(() => assertTiersAreFittedAndValidated(pool, assignment, CATEGORIES)).not.toThrow()
  })

  it('accepts a ladder whose smallest tier still reaches every group', () => {
    const ladder = tiersOf(pool, LADDER)
    expect(tierRoleDefect(pool, ladder, CATEGORIES, LADDER)).toBeUndefined()
    for (const tier of LADDER) {
      const ids = imagesHeldBy(tier.id, ladder, LADDER)
      for (const category of CATEGORIES) {
        for (const role of ['fitted', 'heldOut'] as const) {
          const held = ids.filter((id) => {
            const image = training.find((candidate) => candidate.id === id)
            return image?.category === category && image.role === role
          })
          expect(held.length, `${tier.id}/${category}/${role}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('refuses a tier too small to hold one of a group, naming the tier, the role and the category', () => {
    const tiny: readonly DatasetTier[] = [
      { id: 'crumb', holds: 2, mislabels: 0 },
      { id: 'whole', holds: SPLIT_SIZES.training, mislabels: 0 },
    ]
    const defect = tierRoleDefect(pool, tiersOf(pool, tiny), CATEGORIES, tiny)
    expect(defect).toMatch(/crumb/)
    expect(defect).toMatch(/"fitted"|"heldOut"/)
    expect(defect).toMatch(/"red"|"green"|"wormy"/)
    expect(() => assertTiersAreFittedAndValidated(pool, tiersOf(pool, tiny), CATEGORIES, tiny)).toThrow(
      /crumb/,
    )
  })

  it('refuses a ladder whose largest tier does not hold the whole training split', () => {
    const short: readonly DatasetTier[] = [{ id: 'partial', holds: 150, mislabels: 0 }]
    expect(() =>
      assertTiersAreFittedAndValidated(pool, tiersOf(pool, short), CATEGORIES, short),
    ).toThrow(/holds 150 images, but the training split has 200/)
  })
})

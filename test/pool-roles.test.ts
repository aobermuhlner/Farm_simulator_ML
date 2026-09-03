import { describe, expect, it } from 'vitest'
import {
  CATEGORY_COUNTS,
  HELD_OUT_COUNTS,
  SPLIT_SIZES,
  type PoolCategory,
} from '../tools/pool/params.js'
import { assignRoles, roleCounts } from '../tools/pool/roles.js'
import { samplePool } from '../tools/pool/sample.js'

const pool = samplePool()
const roles = assignRoles(pool)

const training = pool.filter((image) => image.split === 'training')

function idsOf(category: PoolCategory, role: 'fitted' | 'heldOut'): readonly string[] {
  return training
    .filter((image) => image.category === category && roles[image.id] === role)
    .map((image) => image.id)
}

describe('training role assignment', () => {
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

  it('reproduces the same assignment from the same seed', () => {
    expect(assignRoles(samplePool())).toEqual(roles)
  })

  it('does not disturb the images it assigns roles to', () => {
    // The separate stream, stated as a test: sampling again after an assignment must
    // produce the identical pool, or every artifact keyed to these ids would move.
    expect(samplePool()).toEqual(pool)
  })

  it('refuses to hold out more of a category than the split has', () => {
    const starved = [
      ...training.filter((image) => image.category !== 'green'),
      ...training.filter((image) => image.category === 'green').slice(0, 1),
    ]
    expect(() => assignRoles(starved)).toThrow(/green/)
  })
})

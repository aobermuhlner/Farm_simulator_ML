import { describe, expect, it } from 'vitest'
import { createRandom } from '../tools/pool/random.js'
import { SEED } from '../tools/pool/params.js'

function sequence(seed: number, length = 100): number[] {
  const random = createRandom(seed)
  return Array.from({ length }, () => random.next())
}

describe('seeded generator', () => {
  it('produces an identical sequence for the same seed', () => {
    expect(sequence(SEED)).toEqual(sequence(SEED))
  })

  it('diverges for a different seed', () => {
    expect(sequence(SEED)).not.toEqual(sequence(SEED + 1))
  })

  it('stays inside the unit interval', () => {
    for (const value of sequence(SEED, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('rounds a ranged draw to the requested precision and stays inside the range', () => {
    const random = createRandom(SEED)
    for (let i = 0; i < 500; i += 1) {
      const value = random.inRange({ min: 0.2, max: 0.95 }, 3)
      expect(value).toBeGreaterThanOrEqual(0.2)
      expect(value).toBeLessThanOrEqual(0.95)
      expect(value).toBe(Math.round(value * 1000) / 1000)
    }
  })

  it('shuffles deterministically and keeps every item', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const first = createRandom(SEED).shuffle(items)
    const second = createRandom(SEED).shuffle(items)
    expect(first).toEqual(second)
    expect([...first].sort((a, b) => a - b)).toEqual(items)
    expect(first).not.toEqual(items)
    expect(items[0]).toBe(0)
  })

  it('draws integers below the exclusive bound', () => {
    const random = createRandom(SEED)
    for (let i = 0; i < 500; i += 1) {
      const value = random.int(7)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(7)
    }
  })
})

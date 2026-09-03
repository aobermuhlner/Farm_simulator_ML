/**
 * The generator's only source of randomness.
 *
 * `design.md` — reproducibility is a spec requirement, so `Math.random` is not an
 * option and neither is a dependency: mulberry32 is four lines and removes a supply-chain
 * question from a build step that writes committed files.
 *
 * Everything the generator varies goes through one instance seeded from
 * `params.SEED`, so the pool is a pure function of that number.
 */

import type { Range } from './params.js'

export interface Random {
  /** Next value in [0, 1). */
  next(): number
  /** A value inside an inclusive range, rounded to `decimals` places. */
  inRange(range: Range, decimals: number): number
  /** An integer in [0, maxExclusive). */
  int(maxExclusive: number): number
  /** One item, chosen uniformly. */
  pick<T>(items: readonly T[]): T
  /** A new array holding the same items in a shuffled order. */
  shuffle<T>(items: readonly T[]): T[]
}

/**
 * Creates a seeded generator. Two generators built from the same seed produce the same
 * sequence, on any machine and any Node version — that is the whole point of it.
 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function int(maxExclusive: number): number {
    return Math.floor(next() * maxExclusive)
  }

  function pick<T>(items: readonly T[]): T {
    const item = items[int(items.length)]
    if (item === undefined) throw new Error('pick() called with an empty list')
    return item
  }

  return {
    next,
    int,
    pick,
    inRange(range, decimals) {
      const raw = range.min + next() * (range.max - range.min)
      const factor = 10 ** decimals
      return Math.round(raw * factor) / factor
    },
    shuffle(items) {
      const copy = [...items]
      // Fisher-Yates, drawing from the same stream so the order is part of the seed.
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(i + 1)
        const a = copy[i]
        const b = copy[j]
        if (a === undefined || b === undefined) continue
        copy[i] = b
        copy[j] = a
      }
      return copy
    },
  }
}

/**
 * The crop draw's only source of randomness.
 *
 * The same four lines of mulberry32 the pool generator uses, and deliberately a second
 * copy rather than an import: `tools/` is a build step that writes committed files and
 * never ships, while this runs in the browser. Sharing the function would make a change
 * made for one of them a change to the other, and the two have entirely different reasons
 * to stay fixed — the generator's stream must not move because the committed pool depends
 * on it, and this one must not move because a student's crop does.
 *
 * A dependency is not an option either, for the reason it is not there: reproducibility
 * is a requirement, and four lines removes a supply-chain question from it.
 */

export interface Stream {
  /** Next value in [0, 1). */
  next(): number
  /** An integer in [0, maxExclusive). */
  int(maxExclusive: number): number
  /** A new array holding the same items in a shuffled order. */
  shuffle<T>(items: readonly T[]): T[]
}

/**
 * A stream for one farm's crop in one year.
 *
 * The seed and the year are mixed rather than added, so year 1 and year 2 of the same
 * farm are unrelated crops instead of neighbouring ones — two farms whose seeds differ by
 * one would otherwise sort nearly the same apples a year apart.
 */
export function streamFor(seed: number, year: number): Stream {
  let mixed = (seed >>> 0) ^ Math.imul(year | 0, 0x9e3779b1)
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad)
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97)
  mixed ^= mixed >>> 15
  return createStream(mixed >>> 0)
}

/** A seeded stream. Two streams from the same seed produce the same sequence. */
export function createStream(seed: number): Stream {
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

  return {
    next,
    int,
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

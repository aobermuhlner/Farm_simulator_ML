/**
 * The year's crop: how large it is, what it is made of that year, and which pictures
 * stand for it.
 *
 * Against the committed pool and the shipped declaration, because the facts this module
 * has to keep apart — what a crop is made of, and what the pool holds pictures of — are
 * only genuinely apart when the pool is the real one. The committed evaluation split is
 * 500 red, 250 green and 250 wormy; a crop of six thousand is eight times that, which is
 * why photographs recur and why the recurrence is something the crop reports rather than
 * something a reader has to work out.
 *
 * `sorting-crop.test.ts` holds the part of this that a person is shown. This file is the
 * crop itself.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Farm, FarmDeclaration, YearVariation } from '../src/economy/index.js'
import { openFarm } from '../src/economy/index.js'
import type { LoadedPool } from '../src/pool/index.js'
import { readPool } from '../src/pool/index.js'
import type { Crop, CropSplit } from '../src/sorting/index.js'
import {
  CROP_SIZE_MISSING,
  drawCrop,
  drawShares,
} from '../src/sorting/index.js'
import { maxLand } from '../src/progression/index.js'
import { appleDeclaration } from './helpers/apple.js'
import { shippedCatalogJson, soundCatalog } from './helpers/catalog.js'
import { shippedFarm } from './helpers/farm.js'

const declaration = appleDeclaration()
const categories = declaration.categories.map((category) => category.id)

/** A farm whose crop varies, so the weather is exercised rather than assumed away. */
const VARYING: YearVariation = { wormy: { min: 0.07, max: 0.14 } }

const base: FarmDeclaration = {
  name: 'Test Farm',
  currency: 'ETB',
  precision: 2,
  openingBalance: 0,
  openingYear: 1,
  orchard: { label: 'Orchard', unit: 'trees', opening: 6000, piecesPerUnit: 1 },
  cropComposition: { red: 0.55, green: 0.35, wormy: 0.1 },
}

function pool(): LoadedPool {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'pools/apple-harvest/manifest.json'), 'utf8'),
  ) as unknown
  const read = readPool(raw, declaration)
  if (!read.ok) throw new Error(`the committed pool must read: ${read.issues[0]?.message}`)
  return read.pool
}

const committed = pool()
const split: CropSplit = { imageIds: committed.order.pool, truth: committed.truth }

function farm(over: Partial<Farm> = {}, over2: Partial<FarmDeclaration> = {}): Farm {
  return { ...openFarm({ ...base, ...over2 }), ...over }
}

function drawn(state: Farm = farm(), seed = 4242, from: CropSplit = split): Crop {
  const draw = drawCrop(declaration, state, from, seed)
  if (!draw.ok) throw new Error(`the crop was meant to draw: ${draw.issues[0]?.message}`)
  return draw.crop
}

/** How many pieces of each category a crop actually holds, counted rather than declared. */
function tally(crop: Crop): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const category of categories) counts[category] = 0
  for (const piece of crop.pieces) counts[piece.category] = (counts[piece.category] ?? 0) + 1
  return counts
}

/** How often each picture appears in a crop. */
function appearances(crop: Crop): Map<string, number> {
  const seen = new Map<string, number>()
  for (const piece of crop.pieces) seen.set(piece.imageId, (seen.get(piece.imageId) ?? 0) + 1)
  return seen
}

describe('some years are wormier than others, within a declared range', () => {
  const varying = () => farm({}, { yearVariation: VARYING })

  it('draws every category’s share from inside the range the farm declares', () => {
    for (let year = 1; year <= 40; year += 1) {
      const crop = drawn(farm({ year }, { yearVariation: VARYING }))
      const share = (crop.composition.wormy ?? 0) / crop.size
      expect(share, `year ${year}`).toBeGreaterThanOrEqual(0.07 - 0.001)
      expect(share, `year ${year}`).toBeLessThanOrEqual(0.14 + 0.001)
    }
  })

  it('draws the same composition for the same farm and year, however often it is asked', () => {
    expect(drawn(varying()).composition).toEqual(drawn(varying()).composition)
  })

  it('draws different compositions for two years of one farm', () => {
    const years = [1, 2, 3, 4, 5].map((year) =>
      drawn(farm({ year }, { yearVariation: VARYING })).composition.wormy,
    )
    expect(new Set(years).size).toBeGreaterThan(1)
  })

  it('draws different compositions for two farms at the same year', () => {
    const one = drawn(varying(), 4242).composition
    const other = drawn(varying(), 9999).composition
    expect(other).not.toEqual(one)
  })

  it('comes to exactly the crop’s size, whatever the year drew', () => {
    for (let year = 1; year <= 12; year += 1) {
      const crop = drawn(farm({ year }, { yearVariation: VARYING }))
      const total = Object.values(crop.composition).reduce((sum, count) => sum + count, 0)
      expect(total, `year ${year}`).toBe(crop.size)
      expect(crop.pieces, `year ${year}`).toHaveLength(crop.size)
      expect(tally(crop), `year ${year}`).toEqual(crop.composition)
    }
  })

  it('leaves the categories declaring no range in the ratio their shares declare', () => {
    // Whichever way the worms went, red and green keep the 55:35 they were declared at.
    for (let year = 1; year <= 12; year += 1) {
      const crop = drawn(farm({ year }, { yearVariation: VARYING }))
      const ratio = (crop.composition.red ?? 0) / (crop.composition.green ?? 1)
      expect(ratio, `year ${year}`).toBeCloseTo(0.55 / 0.35, 2)
    }
  })

  it('leaves proportionally fewer of everything else in a wormier year', () => {
    const wet = drawShares(categories, base.cropComposition, VARYING, () => 1)
    const mild = drawShares(categories, base.cropComposition, VARYING, () => 0)
    expect(wet[2]).toBeGreaterThan(mild[2] as number)
    expect(wet[0]).toBeLessThan(mild[0] as number)
    expect(wet[1]).toBeLessThan(mild[1] as number)
  })

  it('holds the declared composition exactly when the farm declares no range', () => {
    const crop = drawn(farm({ land: 1000 }))
    expect(crop.composition).toEqual({ red: 550, green: 350, wormy: 100 })
  })
})

describe('a crop larger than its pool repeats photographs and says so', () => {
  const big = () => drawn(farm({ land: 6000 }))

  it('draws six thousand pieces against a split of one thousand pictures', () => {
    const crop = big()
    expect(committed.order.pool).toHaveLength(1000)
    expect(crop.size).toBe(6000)
    expect(crop.pieces).toHaveLength(6000)
  })

  it('keeps the year’s composition intact at that size', () => {
    const crop = big()
    expect(tally(crop)).toEqual(crop.composition)
    expect(crop.composition).toEqual({ red: 3300, green: 2100, wormy: 600 })
  })

  it('shows every declared category at least once', () => {
    for (const size of [3, 10, 60, 6000]) {
      const crop = drawn(farm({ land: size }))
      const counts = tally(crop)
      for (const category of categories) {
        expect(counts[category], `"${category}" at ${size}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('uses the whole split of a category before repeating any of it', () => {
    const crop = big()
    const held = crop.held
    const seen = appearances(crop)

    for (const category of categories) {
      const pictures = committed.order.pool.filter((id) => committed.truth[id] === category)
      expect(pictures, `"${category}" is held`).toHaveLength(held[category] as number)
      const used = pictures.map((id) => seen.get(id) ?? 0)
      // Every picture of the category is in the crop, and no two of them differ by more
      // than one appearance — which is the whole of "the whole split before it repeats".
      expect(Math.min(...used), `"${category}" leaves a picture out`).toBeGreaterThanOrEqual(1)
      expect(Math.max(...used) - Math.min(...used), `"${category}" repeats unevenly`).toBeLessThanOrEqual(1)
    }
  })

  it('holds no picture more often than the ceiling of what its category needs', () => {
    const crop = big()
    const seen = appearances(crop)
    for (const category of categories) {
      const wanted = crop.composition[category] ?? 0
      const ceiling = Math.ceil(wanted / (crop.held[category] ?? 1))
      for (const [imageId, count] of seen) {
        if (committed.truth[imageId] !== category) continue
        expect(count, `${imageId} appears ${count} times`).toBeLessThanOrEqual(ceiling)
      }
    }
  })

  it('reports that pictures recurred, and how many the split holds', () => {
    const crop = big()
    expect(crop.recurred).toBe(true)
    expect(crop.held).toEqual({ red: 500, green: 250, wormy: 250 })
    const total = Object.values(crop.held).reduce((sum, count) => sum + count, 0)
    expect(total).toBe(committed.order.pool.length)
  })

  it('reports no recurrence for a crop the split can show outright', () => {
    const crop = drawn(farm({ land: 300 }))
    expect(crop.recurred).toBe(false)
    expect(new Set(crop.pieces.map((piece) => piece.imageId)).size).toBe(crop.pieces.length)
  })

  it('is drawn from the evaluation split alone, at any size', () => {
    const evaluation = new Set(committed.order.pool)
    for (const piece of big().pieces) {
      expect(evaluation.has(piece.imageId), `${piece.imageId} is not an evaluation image`).toBe(true)
    }
  })
})

describe('a crop that cannot be drawn refuses with its cause', () => {
  it('refuses a farm with no usable size, and returns no crop at all', () => {
    for (const land of [0, -1, 2.5, Number.NaN]) {
      const draw = drawCrop(declaration, farm({ land }), split, 4242)
      expect(draw.ok, `a crop of ${String(land)} should refuse`).toBe(false)
      expect(draw.ok ? [] : draw.issues.map((issue) => issue.code)).toContain(CROP_SIZE_MISSING)
      // Nothing partial: the refusal carries issues and no crop of any size.
      expect(draw.ok ? undefined : (draw as { crop?: unknown }).crop).toBeUndefined()
    }
  })
})

describe('the same farm in the same year draws the same crop', () => {
  it('reproduces a large crop piece for piece, in the same order', () => {
    const state = farm({ land: 6000 }, { yearVariation: VARYING })
    expect(drawn(state).pieces).toEqual(drawn(state).pieces)
  })

  it('draws a new crop when the farm advances a year', () => {
    const one = drawn(farm({ year: 1, land: 600 }, { yearVariation: VARYING }))
    const next = drawn(farm({ year: 2, land: 600 }, { yearVariation: VARYING }))
    expect(next.pieces).not.toEqual(one.pieces)
  })

  it('gives a grown orchard more pieces to bring in', () => {
    expect(drawn(farm({ land: 9000 })).pieces.length).toBeGreaterThan(
      drawn(farm({ land: 6000 })).pieces.length,
    )
  })
})

describe('a crop too small for its shares holds every category all the same', () => {
  /** The shipped opening: one tree bearing five apples, at the shipped composition. */
  function opening(variation?: YearVariation, year = 1): Crop {
    const declared = shippedFarm()
    return drawn(
      farm(
        { land: 5, year },
        {
          cropComposition: declared.cropComposition,
          ...(variation === undefined ? {} : { yearVariation: variation }),
        },
      ),
    )
  }

  it('draws two, two and one from five apples at fifty-five, thirty-five and ten', () => {
    // The shares yield three, two and none; a whole apple is then taken from the largest
    // to give the smallest one. Kept on purpose — the first crop a student meets contains
    // all three kinds of apple, which is the first thing they need to see.
    const crop = opening()
    expect(crop.size).toBe(5)
    expect(crop.composition).toEqual({ red: 2, green: 2, wormy: 1 })
    expect(tally(crop)).toEqual({ red: 2, green: 2, wormy: 1 })
  })

  it('draws the same two, two and one across the whole of the declared range', () => {
    // Both ends of the wormy range, and several years inside it. 0.07 of five apples is
    // a third of one and 0.14 is two thirds, so no year this farm ever draws can put a
    // second worm in the crop or take the one away — and nothing may present two such
    // years as differing, or as noise, error or sampling variation.
    const range = shippedFarm().yearVariation?.wormy
    expect(range).toEqual({ min: 0.07, max: 0.14 })
    if (range === undefined) return

    for (const year of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(opening(shippedFarm().yearVariation, year).composition, `year ${year}`).toEqual({
        red: 2,
        green: 2,
        wormy: 1,
      })
    }

    // And the ends of the range pinned, rather than left to whichever years came up.
    for (const wormy of [range.min, range.max]) {
      const pinned = opening({ wormy: { min: wormy, max: wormy } })
      expect(pinned.composition, `a year at ${wormy}`).toEqual({ red: 2, green: 2, wormy: 1 })
    }
  })

  it('records the drawn counts, which are not the shares the crop was drawn at', () => {
    // What is recorded is what was drawn. The declared shares of this crop would be 2.75,
    // 1.75 and 0.5 apples, and no screen may present them as what the year bore.
    const crop = opening()
    const declared = shippedFarm().cropComposition
    for (const category of categories) {
      const share = (crop.composition[category] as number) / crop.size
      expect(share, `"${category}" drew its declared share after all`).not.toBeCloseTo(
        declared[category] as number,
        2,
      )
    }
  })

  it('leaves a crop large enough to express its shares alone', () => {
    // Nothing is moved between categories once whole apples can carry the shares: the
    // one-of-each rule is a floor, not a thumb on the scale.
    const crop = drawn(farm({ land: 100 }, { cropComposition: shippedFarm().cropComposition }))
    expect(crop.composition).toEqual({ red: 55, green: 35, wormy: 10 })
  })
})

describe('the largest orchard the farm can reach is still cheap to draw', () => {
  /** The largest crop the shipped catalog could sell towards, in pieces. */
  const LARGEST = (() => {
    const farmDeclaration = shippedFarm()
    const catalog = soundCatalog(shippedCatalogJson(), farmDeclaration)
    return maxLand(catalog, farmDeclaration) * farmDeclaration.orchard.piecesPerUnit
  })()

  it('is two thousand pieces, which is what the shipped catalog reaches', () => {
    expect(LARGEST).toBe(2000)
  })

  it('draws that crop inside a fixed budget, so a draw that stops being cheap fails loudly', () => {
    // `drawCrop` allocates one object per piece and makes one pass to score them. At the
    // largest reachable orchard that is 36 000 small objects — a few megabytes and a few
    // milliseconds. The budget is generous against a slow machine and still an order of
    // magnitude under anything a student would notice, so the day a larger orchard or a
    // second block makes this false it fails here rather than in the browser.
    const started = performance.now()
    const crop = drawn(farm({ land: LARGEST }))
    const elapsed = performance.now() - started

    expect(crop.pieces).toHaveLength(LARGEST)
    expect(elapsed, `drawing ${LARGEST} pieces took ${elapsed.toFixed(0)}ms`).toBeLessThan(2000)
  })

  it('grows what it draws in proportion to the pieces asked for, not worse', () => {
    // Guards the shape of the cost as well as its size: a draw that went quadratic would
    // pass the budget above at 36 000 and fail a student at the next orchard.
    const time = (pieces: number): number => {
      const started = performance.now()
      drawn(farm({ land: pieces }))
      return performance.now() - started
    }
    time(LARGEST / 4)
    const small = time(LARGEST / 4)
    const large = time(LARGEST)

    // Four times the pieces, generously under thirty times the work.
    expect(large, `${small.toFixed(1)}ms at a quarter, ${large.toFixed(1)}ms at full size`).toBeLessThan(
      Math.max(small, 1) * 30,
    )
  })
})

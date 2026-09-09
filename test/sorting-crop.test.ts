/**
 * Drawing a year's crop.
 *
 * Against the committed pool and the shipped declaration, because the two facts this
 * module has to keep apart — what a crop is made of, and what the pool holds pictures of
 * — are only genuinely apart when the pool is the real one. The committed evaluation
 * split is 500 red, 250 green and 250 wormy; the shipped crop is 55/35/10. A draw that
 * had quietly taken its mix from the pictures would pass against a fixture built to
 * match the declaration and fail here.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Farm, FarmDeclaration } from '../src/economy/index.js'
import { openFarm } from '../src/economy/index.js'
import type { LoadedPool } from '../src/pool/index.js'
import { readPool } from '../src/pool/index.js'
import {
  allocate,
  CROP_COMPOSITION_INCOMPLETE,
  CROP_COMPOSITION_MISSING,
  CROP_IMAGES_EXHAUSTED,
  CROP_SIZE_MISSING,
  CROP_TOO_SMALL,
  drawCrop,
} from '../src/sorting/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple.js'

const declaration = appleDeclaration()
const categories = declaration.categories.map((category) => category.id)

const farmDeclaration: FarmDeclaration = {
  name: 'Test Farm',
  currency: 'ETB',
  precision: 2,
  openingBalance: 0,
  openingYear: 1,
  orchard: { label: 'Orchard', unit: 'trees', opening: 10, piecesPerUnit: 1 },
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

/** The evaluation split, in the shape the crop draw asks for. */
function splitOf(loaded: LoadedPool) {
  return { imageIds: loaded.order.pool, truth: loaded.truth }
}

function farm(over: Partial<Farm> = {}, over2: Partial<FarmDeclaration> = {}): Farm {
  return { ...openFarm({ ...farmDeclaration, ...over2 }), ...over }
}

/** A crop that must draw, so a test about its contents does not restate the refusals. */
function drawn(state: Farm = farm(), seed = 4242, task: TaskDeclaration = declaration) {
  const draw = drawCrop(task, state, splitOf(committed), seed)
  if (!draw.ok) throw new Error(`the crop was meant to draw: ${draw.issues[0]?.message}`)
  return draw.crop
}

function refusalOf(state: Farm, seed = 4242, task: TaskDeclaration = declaration) {
  const draw = drawCrop(task, state, splitOf(committed), seed)
  expect(draw.ok).toBe(false)
  return draw.ok ? [] : [...draw.issues]
}

function countsOf(crop: { presented: readonly { category: string }[] }): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const category of categories) counts[category] = 0
  for (const image of crop.presented) counts[image.category] = (counts[image.category] ?? 0) + 1
  return counts
}

describe('the same farm in the same year sorts the same crop', () => {
  it('reproduces the crop image for image, in the same order', () => {
    expect(drawn().presented).toEqual(drawn().presented)
  })

  it('draws a different crop the following year', () => {
    const first = drawn(farm({ year: 1 }))
    const second = drawn(farm({ year: 2 }))
    expect(second.presented).not.toEqual(first.presented)
  })

  it('draws a different crop for a farm with a different identity', () => {
    expect(drawn(farm(), 4242).presented).not.toEqual(drawn(farm(), 9999).presented)
  })

  it('is drawn from the evaluation split, never from the images a model was fitted on', () => {
    const evaluation = new Set(committed.order.pool)
    for (const image of drawn(farm({ land: 60 })).presented) {
      expect(evaluation.has(image.imageId), `${image.imageId} is not an evaluation image`).toBe(true)
    }
  })

  it('shows no image twice', () => {
    const presented = drawn(farm({ land: 60 })).presented
    expect(new Set(presented.map((image) => image.imageId)).size).toBe(presented.length)
  })
})

describe('the mix on screen is the crop’s mix, not the pool’s', () => {
  it('follows the declared composition rather than the evaluation split’s own', () => {
    // Sixty is what one person is presented with, so these are 55%, 35% and 10% of it.
    const counts = countsOf(drawn(farm({ land: 60 })))
    expect(counts).toEqual({ red: 33, green: 21, wormy: 6 })

    // What the split itself is made of, which is a training-data decision and not a crop.
    const split: Record<string, number> = {}
    for (const imageId of committed.order.pool) {
      const category = committed.truth[imageId] as string
      split[category] = (split[category] ?? 0) + 1
    }
    expect(split).toEqual({ red: 500, green: 250, wormy: 250 })
    expect((counts.wormy as number) / 60).toBeLessThan((split.wormy as number) / committed.order.pool.length)
  })

  it('shows every declared category at least once, even in the first small crop', () => {
    const counts = countsOf(drawn(farm({ land: 10 })))
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(10)
    for (const category of categories) {
      expect(counts[category], `"${category}" is missing from the crop`).toBeGreaterThanOrEqual(1)
    }
  })

  it('mixes the categories rather than presenting them in declared blocks', () => {
    const presented = drawn(farm({ land: 60 })).presented
    const blocks = presented.filter(
      (image, index) => index > 0 && image.category !== presented[index - 1]?.category,
    ).length
    expect(blocks).toBeGreaterThan(categories.length)
  })

  it('follows a different farm’s composition without a code change', () => {
    const other = farm({ land: 50 }, { cropComposition: { red: 0.2, green: 0.2, wormy: 0.6 } })
    expect(countsOf(drawn(other))).toEqual({ red: 10, green: 10, wormy: 30 })
  })
})

describe('the crop follows the orchard', () => {
  it('opens at the declared crop', () => {
    expect(drawn().size).toBe(10)
    expect(drawn().presented).toHaveLength(10)
  })

  it('gives a grown holding more to sort', () => {
    expect(drawn(farm({ land: 40 })).presented.length).toBeGreaterThan(
      drawn(farm({ land: 10 })).presented.length,
    )
  })
})

describe('what one person can get through', () => {
  it('presents a small crop entire and reports nothing unsorted', () => {
    const crop = drawn(farm({ land: 10 }))
    expect(crop.presented).toHaveLength(10)
    expect(crop.unsorted).toBe(0)
  })

  it('presents the declared limit of a large crop and names the shortfall', () => {
    const limit = declaration.handSorting.perHarvest
    const crop = drawn(farm({ land: 400 }))
    expect(crop.presented).toHaveLength(limit)
    expect(crop.size).toBe(400)
    expect(crop.unsorted).toBe(400 - limit)
  })

  it('presents exactly the crop when it comes to the limit itself', () => {
    const limit = declaration.handSorting.perHarvest
    const crop = drawn(farm({ land: limit }))
    expect(crop.presented).toHaveLength(limit)
    expect(crop.unsorted).toBe(0)
  })

  it('presents no more of a bigger crop than of one already past the limit', () => {
    expect(drawn(farm({ land: 4000 })).presented).toHaveLength(
      drawn(farm({ land: 400 })).presented.length,
    )
  })
})

describe('a crop that cannot be presented refuses with its cause', () => {
  it('refuses a crop with no usable size, and returns no crop at all', () => {
    for (const land of [0, -1, 2.5, Number.NaN]) {
      const issues = refusalOf(farm({ land }))
      expect(issues.map((issue) => issue.code)).toContain(CROP_SIZE_MISSING)
    }
  })

  it('refuses a crop with no declared composition rather than taking the pool’s', () => {
    const issues = refusalOf(
      farm({}, { cropComposition: {} as Record<string, number> }),
    )
    const refusal = issues.find((issue) => issue.code === CROP_COMPOSITION_MISSING)
    expect(refusal?.field).toBe('cropComposition')
    expect(refusal?.message).toContain('training set')
  })

  it('refuses a composition that says nothing about a declared category, naming it', () => {
    const issues = refusalOf(farm({}, { cropComposition: { red: 0.6, green: 0.4 } }))
    const refusal = issues.find((issue) => issue.code === CROP_COMPOSITION_INCOMPLETE)
    expect(refusal?.field).toBe('cropComposition.wormy')
    expect(refusal?.message).toContain('wormy')
  })

  it('refuses a crop too small to hold one of every category, naming the one that would go', () => {
    const issues = refusalOf(farm({ land: 2 }))
    const refusal = issues.find((issue) => issue.code === CROP_TOO_SMALL)
    expect(refusal?.message).toContain('wormy')
    expect(refusal?.message).toContain('3')
  })

  it('presents as much as the split holds distinct pictures of, rather than refusing', () => {
    // A composition demanding more distinct pictures of one category than the split holds.
    // The crop is drawn all the same — it repeats pictures — and the sort is shortened to
    // what a person can be shown without meeting the same picture twice.
    const greedy = {
      ...declaration,
      handSorting: { ...declaration.handSorting, perHarvest: 600 },
    }
    const crop = drawn(
      farm({ land: 600 }, { cropComposition: { red: 0.2, green: 0.6, wormy: 0.2 } }),
      4242,
      greedy,
    )
    expect(crop.size).toBe(600)
    expect(new Set(crop.presented.map((piece) => piece.imageId)).size).toBe(crop.presented.length)
    const green = crop.presented.filter((piece) => piece.category === 'green')
    expect(green).toHaveLength(250)
    expect(crop.presented.length).toBeLessThan(600)
    expect(crop.unsorted).toBe(600 - crop.presented.length)
  })

  it('refuses a crop of a category the split holds no picture of, naming it', () => {
    const draw = drawCrop(
      declaration,
      farm({ land: 60 }),
      {
        imageIds: committed.order.pool.filter((id) => committed.truth[id] !== 'green'),
        truth: committed.truth,
      },
      4242,
    )
    expect(draw.ok).toBe(false)
    const refusal = draw.ok
      ? undefined
      : draw.issues.find((issue) => issue.code === CROP_IMAGES_EXHAUSTED)
    expect(refusal?.field).toBe('green')
    expect(refusal?.message).toContain('green')
  })

  it('names every cause at once rather than the first', () => {
    const issues = refusalOf(farm({ land: 0 }, { cropComposition: { red: 1 } }))
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([CROP_SIZE_MISSING, CROP_COMPOSITION_INCOMPLETE]),
    )
  })
})

describe('whole pieces out of declared shares', () => {
  it('comes to the total exactly, however the shares divide', () => {
    for (const total of [3, 7, 10, 13, 60, 97]) {
      const counts = allocate(total, [0.55, 0.35, 0.1])
      expect(counts.reduce((sum, count) => sum + count, 0), `${total} pieces`).toBe(total)
      expect(Math.min(...counts), `${total} pieces`).toBeGreaterThanOrEqual(1)
    }
  })

  it('keeps each category as close to its share as whole pieces allow', () => {
    expect(allocate(100, [0.55, 0.35, 0.1])).toEqual([55, 35, 10])
    expect(allocate(20, [0.5, 0.5])).toEqual([10, 10])
  })

  it('gives a category rounded away to nothing one piece, at the largest’s expense', () => {
    // 0.02 of 10 is a fifth of a piece, which rounds to none at all.
    expect(allocate(10, [0.98, 0.02])).toEqual([9, 1])
  })
})

describe('no picture is shown twice to a person, however often the crop repeats one', () => {
  it('presents distinct pictures from a crop in which pictures recur', () => {
    const crop = drawn(farm({ land: 6000 }))
    expect(crop.recurred).toBe(true)

    const shown = crop.presented.map((piece) => piece.imageId)
    expect(new Set(shown).size).toBe(shown.length)
    expect(shown).toHaveLength(declaration.handSorting.perHarvest)
  })

  it('draws what is presented from the crop itself rather than beside it', () => {
    // Every picture in front of a person is a picture the crop holds, so a person sorts
    // the year's crop rather than a sample standing in for it.
    const crop = drawn(farm({ land: 6000 }))
    const held = new Set(crop.pieces.map((piece) => piece.imageId))
    for (const piece of crop.presented) {
      expect(held.has(piece.imageId), `${piece.imageId} is not part of the crop`).toBe(true)
    }
  })

  it('presents the year’s own mix rather than a slice off the front of the crop', () => {
    // Two crops of very different sizes, one year: what one person is shown is the same
    // mix in both, which is what stops the wage moving when the orchard grows.
    const smaller = countsOf(drawn(farm({ land: 400 })))
    const larger = countsOf(drawn(farm({ land: 6000 })))
    expect(larger).toEqual(smaller)
  })
})

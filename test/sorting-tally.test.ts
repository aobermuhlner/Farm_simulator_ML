/**
 * What a hand sort came to.
 *
 * The crop is drawn from the committed pool, so a tally is measured over the images a
 * student would actually be shown, and the wage is the shipped payoff table over them.
 * Nothing here stands in for either: a wage computed against a hand-typed table would
 * prove nothing about the one that pays.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Farm, FarmDeclaration } from '../src/economy/index.js'
import { openFarm } from '../src/economy/index.js'
import type { LoadedPool } from '../src/pool/index.js'
import { readPool } from '../src/pool/index.js'
import type { Crop, Decision } from '../src/sorting/index.js'
import { drawCrop, measureSort } from '../src/sorting/index.js'
import type { ActionId, CategoryId, TaskDeclaration } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple.js'

const declaration = appleDeclaration()
const limit = declaration.handSorting.perHarvest
const cap = declaration.handSorting.secondsPerImage

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
const truth = committed.truth

/** The evaluation split, in the shape the crop draw asks for. */
function splitOf(loaded: LoadedPool) {
  return { imageIds: loaded.order.pool, truth: loaded.truth }
}

function farm(land: number): Farm {
  return { ...openFarm(farmDeclaration), land }
}

function cropOf(land: number, seed = 4242): Crop {
  const draw = drawCrop(declaration, farm(land), splitOf(committed), seed)
  if (!draw.ok) throw new Error(`the crop was meant to draw: ${draw.issues[0]?.message}`)
  return draw.crop
}

/** The action the task declares an image's true category calls for. */
function calledFor(imageId: string): ActionId {
  const category = truth[imageId] as CategoryId
  return declaration.categoryActions[category] as ActionId
}

/** Every image decided the way the declaration says it should be. */
function faultlessly(crop: Crop, elapsedMs = 2000): Decision[] {
  return crop.presented.map((image) => ({
    imageId: image.imageId,
    action: calledFor(image.imageId),
    elapsedMs,
  }))
}

/** Every image given the same action, whatever it is. */
function blanket(crop: Crop, action: ActionId, elapsedMs = 2000): Decision[] {
  return crop.presented.map((image) => ({ imageId: image.imageId, action, elapsedMs }))
}

const actions = declaration.actions.map((action) => action.id)

describe('a decision is measured against the action its category calls for', () => {
  it('counts a faultless sort correct throughout, and leaves no mistake behind', () => {
    const crop = cropOf(10)
    const outcome = measureSort(declaration, crop, truth, faultlessly(crop))
    expect(outcome.decided).toBe(10)
    expect(outcome.correct).toBe(10)
    expect(outcome.mistakes).toEqual([])
  })

  it('records a mistake against the action actually chosen, not merged with the others', () => {
    const crop = cropOf(10)
    const decisions = faultlessly(crop)
    // One image sent somewhere its category does not call for, chosen from the actions
    // that are wrong for it rather than from a fixed id.
    const first = decisions[0]
    if (first === undefined) throw new Error('the crop must hold an image')
    const wrong = actions.find((action) => action !== calledFor(first.imageId)) as ActionId
    const outcome = measureSort(declaration, crop, truth, [
      { ...first, action: wrong },
      ...decisions.slice(1),
    ])

    const category = truth[first.imageId] as CategoryId
    expect(outcome.correct).toBe(9)
    expect(outcome.mistakes).toEqual([
      { imageId: first.imageId, category, chosen: wrong, called: calledFor(first.imageId) },
    ])
    expect(outcome.counts[category]?.[wrong]).toBe(1)
  })

  it('reports a count for every declared category and action, zeros included', () => {
    const crop = cropOf(10)
    const outcome = measureSort(declaration, crop, truth, faultlessly(crop))
    for (const category of declaration.categories) {
      for (const action of declaration.actions) {
        expect(
          outcome.counts[category.id]?.[action.id],
          `${category.id} × ${action.id} is missing`,
        ).toBeTypeOf('number')
      }
    }
    const total = Object.values(outcome.counts)
      .flatMap((row) => Object.values(row))
      .reduce((sum, count) => sum + count, 0)
    expect(total).toBe(10)
  })

  it('takes the true category from the manifest and refuses an image it says nothing about', () => {
    const crop = cropOf(10)
    expect(() =>
      measureSort(declaration, crop, {}, faultlessly(crop)),
    ).toThrow(/no true category/)
  })
})

describe('the wage is the declared table over the images actually decided', () => {
  it('pays a faultless sort what the table says those images are worth', () => {
    const crop = cropOf(10)
    const outcome = measureSort(declaration, crop, truth, faultlessly(crop))
    const expected = crop.presented.reduce(
      (total, image) =>
        total + (declaration.payoffs[image.category]?.[calledFor(image.imageId)] as number),
      0,
    )
    expect(outcome.wage).toBeCloseTo(expected, 10)
    expect(outcome.faultless).toBeCloseTo(expected, 10)
  })

  it('prices mistakes by kind rather than by count', () => {
    const crop = cropOf(60)
    const oneWay = measureSort(declaration, crop, truth, blanket(crop, actions[0] as ActionId))
    const another = measureSort(declaration, crop, truth, blanket(crop, actions[1] as ActionId))
    expect(oneWay.wage).not.toBeCloseTo(another.wage, 6)
  })

  it('states what a faultless sort of those same images would have paid', () => {
    const crop = cropOf(60)
    const worst = actions.reduce(
      (lowest, action) => {
        const outcome = measureSort(declaration, crop, truth, blanket(crop, action))
        return outcome.wage < lowest.wage ? outcome : lowest
      },
      measureSort(declaration, crop, truth, blanket(crop, actions[0] as ActionId)),
    )
    expect(worst.faultless).toBeGreaterThan(worst.wage)
  })

  it('attributes nothing to an image no decision was made about', () => {
    const crop = cropOf(400)
    const half = faultlessly(crop).slice(0, 20)
    const outcome = measureSort(declaration, crop, truth, half)
    expect(outcome.decided).toBe(20)
    expect(outcome.unsorted).toBe(380)

    const whole = measureSort(declaration, crop, truth, faultlessly(crop))
    expect(outcome.wage).toBeLessThan(whole.wage)
    expect(outcome.wage).toBeCloseTo(
      half.reduce(
        (total, decision) =>
          total +
          (declaration.payoffs[truth[decision.imageId] as CategoryId]?.[decision.action] as number),
        0,
      ),
      10,
    )
  })

  it('changes with the declared table and with nothing else', () => {
    const crop = cropOf(10)
    const decisions = faultlessly(crop)
    const paid = measureSort(declaration, crop, truth, decisions).wage

    const category = crop.presented[0]?.category as CategoryId
    const action = calledFor(crop.presented[0]?.imageId as string)
    const raised: TaskDeclaration = {
      ...declaration,
      payoffs: {
        ...declaration.payoffs,
        [category]: {
          ...declaration.payoffs[category],
          [action]: (declaration.payoffs[category]?.[action] as number) + 1,
        },
      },
    }
    const count = crop.presented.filter((image) => image.category === category).length
    expect(measureSort(raised, crop, truth, decisions).wage).toBeCloseTo(paid + count, 10)
  })
})

describe('growing past what one person can sort stops paying', () => {
  it('pays two crops of different sizes the same for identical decisions', () => {
    const smaller = cropOf(400)
    const larger = cropOf(4000)
    expect(smaller.presented).toHaveLength(limit)
    expect(larger.presented).toHaveLength(limit)

    // The same decision, image for image, over two crops of very different sizes.
    const decisionsFor = (crop: Crop): Decision[] => faultlessly(crop)
    const small = measureSort(declaration, smaller, truth, decisionsFor(smaller))
    const large = measureSort(declaration, larger, truth, decisionsFor(larger))

    // Identical decisions means the same mix decided the same way; the crops differ only
    // in how much was left on the ground.
    expect(small.counts).toEqual(large.counts)
    expect(large.wage).toBeCloseTo(small.wage, 10)
    expect(large.unsorted).toBeGreaterThan(small.unsorted)
  })

  it('leaves the wage flat while the unsorted remainder grows', () => {
    const wages = [100, 200, 400, 800].map((size) => {
      const crop = cropOf(size)
      return measureSort(declaration, crop, truth, faultlessly(crop)).wage
    })
    for (const wage of wages) expect(wage).toBeCloseTo(wages[0] as number, 10)
  })
})

describe('the rate is measured, and the wage never is', () => {
  it('pays two paces the same for the same decisions', () => {
    const crop = cropOf(10)
    const quick = measureSort(declaration, crop, truth, faultlessly(crop, 500))
    const slow = measureSort(declaration, crop, truth, faultlessly(crop, 9000))
    expect(slow.wage).toBeCloseTo(quick.wage, 10)
    expect(slow.throughput.seconds).toBeGreaterThan(quick.throughput.seconds)
  })

  it('states the elapsed time, the rate a minute, and what the whole crop would take', () => {
    const crop = cropOf(10)
    const outcome = measureSort(declaration, crop, truth, faultlessly(crop, 3000))
    expect(outcome.throughput.seconds).toBeCloseTo(30, 10)
    expect(outcome.throughput.perMinute).toBeCloseTo(20, 10)
    expect(outcome.throughput.wholeCropSeconds).toBeCloseTo(30, 10)
  })

  it('projects the whole crop, including the part that went unsorted', () => {
    const crop = cropOf(400)
    const outcome = measureSort(declaration, crop, truth, faultlessly(crop, 3000))
    expect(outcome.throughput.seconds).toBeCloseTo(limit * 3, 10)
    expect(outcome.throughput.wholeCropSeconds).toBeCloseTo(400 * 3, 10)
    expect(outcome.throughput.wholeCropSeconds).toBeGreaterThan(outcome.throughput.seconds)
  })

  it('counts an abandoned screen at the declared cap and no more', () => {
    const crop = cropOf(10)
    const decisions = faultlessly(crop, 1000)
    const first = decisions[0]
    if (first === undefined) throw new Error('the crop must hold an image')
    const interrupted = [{ ...first, elapsedMs: 4 * 60 * 60 * 1000 }, ...decisions.slice(1)]

    const outcome = measureSort(declaration, crop, truth, interrupted)
    expect(outcome.throughput.seconds).toBeCloseTo(cap + 9, 10)
    expect(outcome.throughput.perMinute).toBeCloseTo((10 * 60) / (cap + 9), 10)
    // And the wage is untouched by the interruption.
    expect(outcome.wage).toBeCloseTo(measureSort(declaration, crop, truth, decisions).wage, 10)
  })
})

describe('the shipped table pays for judgement rather than for one key', () => {
  const crop = cropOf(60)
  const careful = measureSort(declaration, crop, truth, faultlessly(crop))

  it('pays every blanket strategy visibly less than a careful sort', () => {
    for (const action of actions) {
      const blank = measureSort(declaration, crop, truth, blanket(crop, action))
      expect(
        blank.wage,
        `choosing "${action}" for every piece must not pay like a careful sort`,
      ).toBeLessThan(careful.wage)
      // Not merely less: a table where the lazy sort came close would make the lesson
      // optional. If this fails the table is what to change, not this screen.
      //
      // Half rather than a quarter, because the per-apple fine is now the milder half of
      // the lesson. In a year wormier than the declared limit the same blanket sort has
      // its whole delivery repriced and pays a fraction of this — which is the punishing
      // branch, and `delivery-guards.test.ts` is where it is held against real years.
      expect(blank.wage).toBeLessThan(careful.wage * 0.5)
    }
  })

  it('leaves a careful sort with a few mistakes still ahead of the best blanket one', () => {
    const decisions = faultlessly(crop)
    const slipped = decisions.map((decision, index) =>
      index % 20 === 0
        ? { ...decision, action: actions.find((a) => a !== decision.action) as ActionId }
        : decision,
    )
    const best = Math.max(
      ...actions.map((action) => measureSort(declaration, crop, truth, blanket(crop, action)).wage),
    )
    expect(measureSort(declaration, crop, truth, slipped).wage).toBeGreaterThan(best)
  })

  it('is the shipped table that says so, not a table this suite made up', () => {
    expect(declaration.payoffs).toStrictEqual(appleDeclaration().payoffs)
    expect(careful.wage).toBeGreaterThan(0)
  })
})

/** A crop of a farm whose year is as wormy as the shipped range allows. */
function wettestCrop(land: number, seed = 4242): Crop {
  const wet: FarmDeclaration = {
    ...farmDeclaration,
    cropComposition: { red: 0.51, green: 0.35, wormy: 0.14 },
  }
  const draw = drawCrop(
    declaration,
    { ...openFarm(wet), land },
    splitOf(committed),
    seed,
  )
  if (!draw.ok) throw new Error(`the crop was meant to draw: ${draw.issues[0]?.message}`)
  return draw.crop
}

describe('a person’s crates face the same buyer a robot’s do', () => {
  const term = declaration.delivery
  if (term === undefined) throw new Error('the shipped task must declare a delivery term')

  /** Which of the declared actions count as sending a piece to the buyer. */
  const delivering = term.delivering

  it('is the shipped term, applied by the same function the automated harvest goes through', () => {
    const crop = cropOf(limit)
    const outcome = measureSort(declaration, crop, truth, faultlessly(crop))
    expect(outcome.delivery.tolerance).toBe(term.tolerance)
    expect(outcome.delivery.gross).toBeCloseTo(outcome.faultless, 10)
  })

  it('pays a careful sort the plain payoff sum, with nothing taken off', () => {
    const crop = cropOf(limit)
    const outcome = measureSort(declaration, crop, truth, faultlessly(crop))

    // Faultless means every measured piece was kept out of the crates, so the share is
    // nothing at all and the buyer has no complaint to make.
    expect(outcome.delivery.share).toBe(0)
    expect(outcome.delivery.downgraded).toBe(false)
    expect(outcome.delivery.downgrade).toBe(0)
    expect(outcome.wage).toBeCloseTo(outcome.delivery.gross, 10)
  })

  it('downgrades a careless sort that reaches the limit, on the buyer’s own terms', () => {
    // A wet year and a student who crates everything: the share is the year's own worm
    // share, which the wettest declared year puts over the limit.
    const crop = wettestCrop(limit)
    const crated = delivering[0] as ActionId
    const outcome = measureSort(declaration, crop, truth, blanket(crop, crated))

    expect(outcome.delivery.share ?? 0).toBeGreaterThanOrEqual(term.tolerance)
    expect(outcome.delivery.downgraded).toBe(true)

    // Every piece sent to the buyer pays the declared reduced value, and nothing else was
    // sent — which is what "the whole delivery" means.
    expect(outcome.wage).toBeCloseTo(outcome.decided * term.downgradedValue, 10)
    expect(outcome.delivery.gross - outcome.delivery.downgrade).toBeCloseTo(outcome.wage, 10)
  })

  it('leaves a careful sort of the same wet year ahead of the careless one', () => {
    const crop = wettestCrop(limit)
    const careless = measureSort(declaration, crop, truth, blanket(crop, delivering[0] as ActionId))
    const careful = measureSort(declaration, crop, truth, faultlessly(crop))

    expect(careful.delivery.downgraded).toBe(false)
    expect(careful.wage).toBeGreaterThan(careless.wage)
  })

  it('values perfect play the same way, so the two figures on screen are comparable', () => {
    // The comparison figure is what these same pieces would have paid sorted faultlessly,
    // and it goes through the term rather than round it. A faultless sort delivers no
    // measured piece, so it is never downgraded — which is the point being made.
    const crop = wettestCrop(limit)
    const careless = measureSort(declaration, crop, truth, blanket(crop, delivering[0] as ActionId))
    const perfect = measureSort(declaration, crop, truth, faultlessly(crop))

    expect(careless.faultless).toBeCloseTo(perfect.wage, 10)
    expect(careless.faultless).toBeGreaterThan(careless.wage)
  })

  it('leaves the unsorted count and the throughput arithmetic exactly as they were', () => {
    // The term prices what was delivered. It says nothing about how many pieces nobody
    // reached, or how fast the ones that were reached went.
    const crop = wettestCrop(400)
    const careless = measureSort(declaration, crop, truth, blanket(crop, delivering[0] as ActionId))

    expect(careless.delivery.downgraded).toBe(true)
    expect(careless.decided).toBe(limit)
    expect(careless.unsorted).toBe(400 - limit)
    expect(careless.throughput.perMinute).toBeCloseTo((careless.decided * 60) / careless.throughput.seconds, 10)
    expect(careless.throughput.wholeCropSeconds).toBeCloseTo(
      (careless.throughput.seconds * 400) / careless.decided,
      10,
    )
  })

  it('measures the share over the pieces the student decided, not over the crop', () => {
    // Four hundred pieces, sixty decided: the denominator is what went to the buyer out of
    // those sixty. Nothing was delivered from the part nobody reached, because nothing was
    // decided about it.
    const crop = wettestCrop(400)
    const outcome = measureSort(declaration, crop, truth, blanket(crop, delivering[0] as ActionId))
    expect(outcome.delivery.delivered).toBe(limit)
    expect(outcome.delivery.delivered).toBeLessThan(crop.size)
  })
})

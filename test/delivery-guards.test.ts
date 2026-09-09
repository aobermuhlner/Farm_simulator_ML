/**
 * The guards on what ships: the declared limit against every configuration a student can
 * select, and the year against the model.
 *
 * These are build-time checks rather than load-time validators, and deliberately so —
 * `harvest-scoring/design.md`, decision 8. Answering *does any year the farm can draw
 * cross the buyer's limit by itself* means scoring every shipped configuration over the
 * extreme compositions, which is a cost the browser should never pay to open a farm, and
 * the failure it catches is an authoring mistake rather than a runtime condition.
 *
 * Everything here runs against the shipped declarations, the shipped pool and the shipped
 * prediction artifacts. A guard measured against a fixture would prove nothing about the
 * numbers a student meets.
 */

import { describe, expect, it } from 'vitest'
import type { Farm, FarmDeclaration } from '../src/economy/index.js'
import { maxLand } from '../src/progression/index.js'
import type { DeliveryValuation } from '../src/scoring/index.js'
import type { Crop } from '../src/sorting/index.js'
import { measureSort } from '../src/sorting/index.js'
import type { ConfigurationEntry } from '../src/task/artifact.js'
import type { ActionId, CategoryId } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple.js'
import {
  committedPool,
  cropFor as cropForShared,
  cropSplit,
  farmAt as openAt,
  harvestOf,
  pinnedAt,
  shippedConfigurations,
} from './helpers/crop.js'
import { shippedFarm } from './helpers/farm.js'
import { shippedCatalogJson, soundCatalog } from './helpers/catalog.js'

const declaration = appleDeclaration()
const term = declaration.delivery
if (term === undefined) throw new Error('the shipped task must declare a delivery term')

const categories = declaration.categories.map((category) => category.id)
/** The actions that count as sending a piece to the buyer, pulled out for the closures. */
const DELIVERING: readonly string[] = term.delivering

const farmDeclaration = shippedFarm()
const committed = committedPool(declaration)
const split = cropSplit(committed)
const LAND = farmDeclaration.orchard.opening
const CROP = LAND * farmDeclaration.orchard.piecesPerUnit

const CONFIGURATIONS = shippedConfigurations(declaration)

/** The composition the declared ranges permit at one end of them — see `helpers/crop.ts`. */
function at(extreme: number): FarmDeclaration {
  return pinnedAt(farmDeclaration, extreme)
}

function farmAt(composition: FarmDeclaration, year = 1, land = LAND): Farm {
  return openAt(composition, year, land)
}

function cropFor(state: Farm, seed = 4242): Crop {
  return cropForShared(declaration, state, split, seed)
}

/** What one configuration makes of one crop, valued under the declared term. */
function harvest(entry: ConfigurationEntry, crop: Crop): DeliveryValuation {
  return harvestOf(declaration, entry, crop)
}

describe('the guards have something real to measure', () => {
  it('runs against every configuration the shipped artifact covers', () => {
    expect(CONFIGURATIONS.length).toBeGreaterThanOrEqual(3)
  })

  it('runs against an orchard above the floor the draw guard sets', () => {
    // Below about four thousand pieces the spread across draws overtakes the gap between
    // the best and worst configuration, and which pictures came up would decide the year.
    expect(CROP).toBeGreaterThanOrEqual(4000)
  })

  it('has a declared range wide enough to be a story', () => {
    const range = farmDeclaration.yearVariation?.wormy
    expect(range).toBeDefined()
    expect((range?.max ?? 0) / (range?.min ?? 1)).toBeGreaterThan(1.5)
  })
})

describe('no year the farm can draw crosses the limit by itself', () => {
  it('puts every configuration on the same side of the limit at both extremes', () => {
    const mildest = cropFor(farmAt(at(0)))
    const wettest = cropFor(farmAt(at(1)))
    expect(wettest.composition.wormy ?? 0).toBeGreaterThan(mildest.composition.wormy ?? 0)

    for (const { id, entry } of CONFIGURATIONS) {
      const mild = harvest(entry, mildest)
      const wet = harvest(entry, wettest)
      expect(
        wet.downgraded,
        `"${id}" is downgraded in the wettest declared year but not in the mildest`,
      ).toBe(mild.downgraded)
      // And that side is the accepted one: a year the student could not have prevented
      // must not be the difference between a delivery accepted and one repriced.
      expect(wet.downgraded, `"${id}" breaches the limit in a year it cannot control`).toBe(false)
    }
  })

  it('keeps every shipped configuration under the limit across the whole range, with room', () => {
    // Twenty steps through the declared range rather than the two ends, because nothing
    // guarantees the share is monotone in the worm share once the policy is in the way.
    let highest = 0
    let worst = ''
    for (let step = 0; step <= 20; step += 1) {
      const crop = cropFor(farmAt(at(step / 20), 1 + step))
      for (const { id, entry } of CONFIGURATIONS) {
        const value = harvest(entry, crop)
        const share = value.share ?? 0
        if (share > highest) {
          highest = share
          worst = id
        }
        expect(share, `"${id}" reaches the limit at step ${step}`).toBeLessThan(term.tolerance)
      }
    }

    // Recorded so a future retune can see the margin it is spending rather than discover
    // it by breaking this test. The highest share seen across the declared weather:
    expect({ highest: Math.round(highest * 10000) / 10000, worst }).toEqual({
      highest: 0.1057,
      worst: 'blocks2-channels8-regularization1-dropout0-datasetstarter',
    })
    expect(term.tolerance - highest).toBeGreaterThan(0.005)
  })

  it('leaves the warning band reachable, so it is a live sentence rather than dead code', () => {
    const warned: string[] = []
    for (let step = 0; step <= 20; step += 1) {
      const crop = cropFor(farmAt(at(step / 20), 1 + step))
      for (const { id, entry } of CONFIGURATIONS) {
        const value = harvest(entry, crop)
        if (value.warned) warned.push(id)
      }
    }
    expect(warned.length).toBeGreaterThan(0)
    expect(term.warnAbove).toBeLessThan(term.tolerance)
  })
})

describe('the draw varies less than the models do', () => {
  it('has the best-earning selectable configuration out-earn the worst within one year', () => {
    for (const year of [1, 2, 3, 4, 5]) {
      const crop = cropFor(farmAt(farmDeclaration, year))
      const paid = CONFIGURATIONS.map(({ entry }) => harvest(entry, crop).paid)
      expect(Math.max(...paid), `year ${year} ranks them flat`).toBeGreaterThan(
        Math.min(...paid),
      )
    }
  })

  it('keeps the spread across draws of one year below the gap between configurations', () => {
    // The year's composition held, and only the pictures redrawn. What a student cannot
    // see or act on must not be what decides their year.
    const held = at(0.5)
    const draws = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((seed) =>
      cropFor(farmAt(held, 1, CROP), seed * 1013),
    )

    const perConfiguration = CONFIGURATIONS.map(({ id, entry }) => ({
      id,
      paid: draws.map((crop) => harvest(entry, crop).paid),
    }))

    const means = perConfiguration.map(
      (row) => row.paid.reduce((sum, value) => sum + value, 0) / row.paid.length,
    )
    const gap = Math.max(...means) - Math.min(...means)
    expect(gap).toBeGreaterThan(0)

    for (const [index, row] of perConfiguration.entries()) {
      const spread = Math.max(...row.paid) - Math.min(...row.paid)
      const distance = Math.min(
        ...means.filter((_, other) => other !== index).map((mean) => Math.abs(mean - (means[index] as number))),
      )
      expect(
        spread,
        `"${row.id}" moves more across draws of one year than it differs from its neighbours`,
      ).toBeLessThan(distance)
    }
  })
})

describe('the punishing branch is reached by play, not only by fixtures', () => {
  /** A sort that puts every piece it is shown into the first delivering action. */
  function crateEverything(crop: Crop): DeliveryValuation {
    const crated = DELIVERING[0] as ActionId
    const truth: Record<string, CategoryId> = {}
    for (const piece of crop.pieces) truth[piece.imageId] = piece.category
    const outcome = measureSort(
      declaration,
      crop,
      truth,
      crop.presented.map((piece) => ({ imageId: piece.imageId, action: crated, elapsedMs: 2000 })),
    )
    return outcome.delivery
  }

  it('downgrades a hand sort that crates everything in the wettest declared year', () => {
    const value = crateEverything(cropFor(farmAt(at(1))))
    expect(value.share ?? 0).toBeGreaterThanOrEqual(term.tolerance)
    expect(value.downgraded).toBe(true)
  })

  it('does not downgrade the same sort in the mildest declared year', () => {
    const value = crateEverything(cropFor(farmAt(at(0))))
    expect(value.share ?? 0).toBeLessThan(term.tolerance)
    expect(value.downgraded).toBe(false)
  })

  it('leaves a careful sort accepted in every year the range permits', () => {
    for (let step = 0; step <= 10; step += 1) {
      const crop = cropFor(farmAt(at(step / 10), 1 + step))
      const truth: Record<string, CategoryId> = {}
      for (const piece of crop.pieces) truth[piece.imageId] = piece.category
      const outcome = measureSort(
        declaration,
        crop,
        truth,
        crop.presented.map((piece) => ({
          imageId: piece.imageId,
          action: declaration.categoryActions[piece.category] as ActionId,
          elapsedMs: 2000,
        })),
      )
      expect(outcome.delivery.downgraded, `a careful sort is downgraded at step ${step}`).toBe(
        false,
      )
    }
  })
})

describe('what a year pays, measured', () => {
  it('pays each shipped configuration what design.md records, at the declared year', () => {
    // The acceptance figures. A change to the payoff table, the crop size or the weather
    // moves these, and this is what says by how much.
    const crop = cropFor(farmAt(farmDeclaration, 1))
    const paid = Object.fromEntries(
      CONFIGURATIONS.map(({ id, entry }) => [id, Math.round(harvest(entry, crop).paid)]),
    )
    expect(paid).toEqual({
      'blocks2-channels8-regularization1-dropout0-datasetstarter': 1333,
      'blocks2-channels16-regularization1-dropout0-datasetstarter': 1325,
      'blocks2-channels32-regularization1-dropout0-datasetstarter': 1360,
    })
  })

  it('pays what design.md records at the mildest and the wettest declared year', () => {
    const paidAt = (extreme: number): Record<string, number> => {
      const crop = cropFor(farmAt(at(extreme), 1))
      return Object.fromEntries(
        CONFIGURATIONS.map(({ id, entry }) => [id, Math.round(harvest(entry, crop).paid)]),
      )
    }

    expect(paidAt(0)).toEqual({
      'blocks2-channels8-regularization1-dropout0-datasetstarter': 1476,
      'blocks2-channels16-regularization1-dropout0-datasetstarter': 1465,
      'blocks2-channels32-regularization1-dropout0-datasetstarter': 1495,
    })
    expect(paidAt(1)).toEqual({
      'blocks2-channels8-regularization1-dropout0-datasetstarter': 1215,
      'blocks2-channels16-regularization1-dropout0-datasetstarter': 1207,
      'blocks2-channels32-regularization1-dropout0-datasetstarter': 1250,
    })
  })

  it('pays more in the mildest declared year than in the wettest, for every configuration', () => {
    const mild = cropFor(farmAt(at(0)))
    const wet = cropFor(farmAt(at(1)))
    for (const { id, entry } of CONFIGURATIONS) {
      expect(
        harvest(entry, mild).paid,
        `"${id}" does not earn more in a mild year than in a wet one`,
      ).toBeGreaterThan(harvest(entry, wet).paid)
    }
  })

  it('leaves every configuration well short of a faultless harvest', () => {
    const crop = cropFor(farmAt(farmDeclaration, 1))
    const perfect = crop.pieces.reduce((sum, piece) => {
      const action = declaration.categoryActions[piece.category] as ActionId
      return sum + (declaration.payoffs[piece.category]?.[action] as number)
    }, 0)

    for (const { id, entry } of CONFIGURATIONS) {
      const paid = harvest(entry, crop).paid
      expect(paid, `"${id}" is within a whisker of perfect play`).toBeLessThan(perfect * 0.95)
      // And not so far short that the shipped models look broken: there is a lesson in
      // the gap, and there is none in a robot that earns nothing.
      expect(paid, `"${id}" earns too little to be worth putting to work`).toBeGreaterThan(
        perfect * 0.6,
      )
    }
    expect(categories.length).toBe(3)
  })
})

describe('growth multiplies the money and leaves every rate where it was', () => {
  /** The price of one expansion, and the land it gives, read from the shipped catalog. */
  const expansion = (() => {
    const catalog = soundCatalog(shippedCatalogJson(), farmDeclaration)
    const item = catalog.items.find((entry) =>
      entry.opens.some((unlock) => unlock.kind === 'farm-land'),
    )
    if (item === undefined) throw new Error('the shipped catalog must sell land')
    const units = item.opens.reduce(
      (sum, unlock) => (unlock.kind === 'farm-land' ? sum + unlock.units : sum),
      0,
    )
    if (item.priceUnits === undefined) throw new Error('the expansion must be priced')
    return { units, price: item.priceUnits / 10 ** farmDeclaration.precision, item }
  })()

  it('scales the size and each category’s count by the factor the land is scaled by', () => {
    // Held at one seed and one year, so the shares drawn are the same shares and the
    // whole difference is how much land they were allocated over. Across years the
    // composition moves, and the earnings move ~76 CHF per point of worm share — nine
    // times the lever the configurations are, which would be measuring the weather.
    //
    // The counts are exact, to the one piece that allocating whole pieces twice can
    // cost: this is the part of proportionality that arithmetic actually delivers.
    for (const factor of [2, 3, 6]) {
      const small = cropFor(farmAt(farmDeclaration, 1, LAND))
      const large = cropFor(farmAt(farmDeclaration, 1, LAND * factor))
      expect(large.size).toBe(small.size * factor)

      for (const category of categories) {
        const scaled = (small.composition[category] ?? 0) * factor
        expect(
          Math.abs((large.composition[category] ?? 0) - scaled),
          `"${category}" is not ${factor} times itself at ${factor} times the land`,
        ).toBeLessThanOrEqual(1)
      }
    }
  })

  it('scales the money by that factor to within a fraction of a percent', () => {
    // Not exactly, and the cause is `deal` in src/sorting/crop.ts: a category is filled
    // with whole passes over the split plus a *random subset* the size of the remainder.
    // `floor(2w/h)` is not `2·floor(w/h)`, so a crop twice the size takes a different
    // number of whole passes and a differently sized partial one — the same count of
    // pieces, a different mix of pictures, and a different score. It is unreachable by
    // reordering: only a `wanted` that is a multiple of `held` scales exactly.
    //
    // The departure is recorded rather than assumed small, so a later change to how a
    // crop is dealt is seen to move it.
    const departures: number[] = []
    for (const factor of [2, 3, 6]) {
      const small = cropFor(farmAt(farmDeclaration, 1, LAND))
      const large = cropFor(farmAt(farmDeclaration, 1, LAND * factor))

      for (const { id, entry } of CONFIGURATIONS) {
        const one = harvest(entry, small)
        const many = harvest(entry, large)
        const ratio = many.paid / (one.paid * factor)
        departures.push(Math.abs(ratio - 1))
        expect(
          ratio,
          `"${id}" does not pay about ${factor} times as much on ${factor} times the land`,
        ).toBeCloseTo(1, 2)
      }
    }

    // The worst departure seen, as a percentage. Two orders of magnitude below the ~9 %
    // that separates the shipped configurations, which is what makes this a rounding
    // rather than something a student could read as a change in the model.
    const worst = Math.max(...departures)
    expect(Math.round(worst * 10000) / 100).toBe(0.26)
    expect(worst).toBeLessThan(0.005)
  })

  it('leaves the delivery’s measured share where it was, to within a fraction of a percent', () => {
    const small = cropFor(farmAt(farmDeclaration, 1, LAND))
    const departures: number[] = []

    for (const factor of [2, 3, 6]) {
      const large = cropFor(farmAt(farmDeclaration, 1, LAND * factor))
      for (const { id, entry } of CONFIGURATIONS) {
        const one = harvest(entry, small)
        const many = harvest(entry, large)
        const share = one.share ?? 0
        expect(share).toBeGreaterThan(0)
        departures.push(Math.abs((many.share ?? 0) / share - 1))
        expect(
          many.share ?? 0,
          `"${id}" moves its measured share when the orchard grows`,
        ).toBeCloseTo(share, 3)

        // What went to the buyer scales with the crop too — and to the same fraction of
        // a percent, not to a whole piece: which pieces are delivered is the model's
        // decision on the particular pictures, so it inherits the mix effect above.
        expect((many.delivered ?? 0) / ((one.delivered ?? 0) * factor)).toBeCloseTo(1, 2)
      }
    }

    // The worst the measured share moves, as a percentage of itself.
    const worst = Math.max(...departures)
    expect(Math.round(worst * 10000) / 100).toBe(0.67)
    expect(worst).toBeLessThan(0.02)
  })

  it('does not breach the tolerance by growth alone, at the largest orchard reachable', () => {
    // 9 % of 6 000 is 9 % of 36 000. A percentage rule falls on the same side of the
    // line at every size the orchard can reach; what breaks a model is the crop
    // *changing*, which is a different mechanism entirely.
    const reach = maxLand(soundCatalog(shippedCatalogJson(), farmDeclaration), farmDeclaration)
    expect(reach).toBeGreaterThan(LAND)

    for (const extreme of [0, 0.5, 1]) {
      const opening = cropFor(farmAt(at(extreme), 1, LAND))
      const largest = cropFor(farmAt(at(extreme), 1, reach))
      for (const { id, entry } of CONFIGURATIONS) {
        const small = harvest(entry, opening)
        const large = harvest(entry, largest)
        expect(small.downgraded, `"${id}" is downgraded at the opening orchard`).toBe(false)
        expect(
          large.downgraded,
          `"${id}" is downgraded at ${reach} units but not at ${LAND}, in the same year`,
        ).toBe(small.downgraded)
      }
    }
  })

  it('pays an expansion back inside the year it was bought, in the wettest declared year', () => {
    // The worst case, so the claim holds everywhere: the wettest year the declaration
    // permits, and every configuration that ships. Recorded as a multiple so a later
    // retune of a payoff sees the margin it is spending rather than breaking this.
    const added = expansion.units * farmDeclaration.orchard.piecesPerUnit
    expect(added).toBe(6000)

    const wettest = at(1)
    const opening = cropFor(farmAt(wettest, 1, LAND))
    const grown = cropFor(farmAt(wettest, 1, LAND + expansion.units))

    const multiples: Record<string, number> = {}
    for (const { id, entry } of CONFIGURATIONS) {
      const gained = harvest(entry, grown).paid - harvest(entry, opening).paid
      expect(gained, `"${id}" does not pay for an expansion within the year`).toBeGreaterThan(
        expansion.price,
      )
      multiples[id] = Math.round((gained / expansion.price) * 100) / 100
    }

    expect(expansion.price).toBe(1000)
    expect(multiples).toEqual({
      'blocks2-channels8-regularization1-dropout0-datasetstarter': 1.21,
      'blocks2-channels16-regularization1-dropout0-datasetstarter': 1.2,
      'blocks2-channels32-regularization1-dropout0-datasetstarter': 1.24,
    })
  })

  it('pays it back in the mildest declared year by more, never by less', () => {
    const mildest = at(0)
    for (const { id, entry } of CONFIGURATIONS) {
      const mildGain =
        harvest(entry, cropFor(farmAt(mildest, 1, LAND + expansion.units))).paid -
        harvest(entry, cropFor(farmAt(mildest, 1, LAND))).paid
      const wetGain =
        harvest(entry, cropFor(farmAt(at(1), 1, LAND + expansion.units))).paid -
        harvest(entry, cropFor(farmAt(at(1), 1, LAND))).paid

      expect(mildGain, `"${id}" gains less from land in a mild year than in a wet one`).toBeGreaterThan(
        wetGain,
      )
      expect(mildGain).toBeGreaterThan(expansion.price)
    }
  })

  it('says nothing in the shipped copy about growth changing how a model performs', () => {
    // §4.3 is the section most easily got backwards. A student who leaves believing that
    // more data breaks a model has been handed a false claim, and that is the one thing
    // the game must not teach — so the copy that sells scale may not reach for the
    // vocabulary of performance at all.
    const copy = `${expansion.item.label} ${expansion.item.copy}`.toLowerCase()
    for (const word of ['error', 'accuracy', 'accurate', 'risk', 'noise', 'variance', 'overfit']) {
      expect(copy, `the expansion's copy reaches for "${word}"`).not.toContain(word)
    }
  })
})

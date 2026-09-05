/**
 * The save codec: a round trip, a version mismatch, a stale reference, and the seed.
 *
 * Every one of these is testable with no DOM because the codec is pure — which is the
 * whole reason the save was split into a codec here and twenty lines of `localStorage` in
 * `web/src/data/save.ts`.
 */

import { describe, expect, it } from 'vitest'
import { credit, debit, openFarm, recordHarvest, toUnits } from '../src/economy/index.js'
import type { Catalog } from '../src/progression/index.js'
import {
  decodeSave,
  encodeSave,
  knobValuesFor,
  newGame,
  parseSave,
  SAVE_SCHEMA_VERSION,
  serializeSave,
  type GameState,
  type SaveContext,
} from '../src/save/index.js'
import { appleDeclaration } from './helpers/apple.js'
import { catalogWith, pricedItem, soundCatalog, testFarm, unpricedItem } from './helpers/catalog.js'

const apple = appleDeclaration()
const catalog: Catalog = soundCatalog(catalogWith([pricedItem(), unpricedItem()]))
const context: SaveContext = { declaration: testFarm, catalog, tasks: [apple] }

/** A farm that has been played: money in, money out, and a year closed behind it. */
function played(): GameState {
  const opened = openFarm({ ...testFarm, openingBalance: 1000 })
  const spent = debit(credit(opened, toUnits(120.5, 2), 'sales'), toUnits(40.25, 2), 'wider-blocks')
  if (!spent.ok) throw new Error('the test farm was meant to afford this')

  return {
    farm: credit(recordHarvest(spent.farm, toUnits(-300, 2)), toUnits(10, 2), 'grant'),
    seed: 12345,
    owned: ['wider-blocks'],
    knobs: { [apple.id]: { channels: 32, blocks: 2 } },
  }
}

function restored(state: GameState, ctx: SaveContext = context): GameState {
  const outcome = parseSave(serializeSave(state), ctx)
  if (outcome.kind !== 'restored') throw new Error(`the save was meant to restore: ${outcome.cause.message}`)
  return outcome.state
}

describe('a save round trip keeps everything play changed', () => {
  it('brings back the year, the balance, the movements and the ledger', () => {
    const state = played()
    const back = restored(state)

    expect(back.farm.year).toBe(state.farm.year)
    expect(back.farm.balance).toBe(state.farm.balance)
    expect(back.farm.movements).toEqual(state.farm.movements)
    expect(back.farm.ledger).toEqual(state.farm.ledger)
  })

  it('brings back the owned ids, the seed and the knob values', () => {
    const state = played()
    const back = restored(state)

    expect(back.owned).toEqual(state.owned)
    expect(back.seed).toBe(state.seed)
    expect(back.knobs).toEqual(state.knobs)
  })

  it('is exact to the declared precision, with no residue of its own storage', () => {
    const state = played()
    expect(encodeSave(state).balance).toBe(790.25)
    expect(restored(state).farm.balance).toBe(toUnits(790.25, 2))
  })

  it('carries no currency label, no farm name and no price', () => {
    const encoded = JSON.stringify(encodeSave(played()))

    expect(encoded).not.toContain(testFarm.currency)
    expect(encoded).not.toContain(testFarm.name)
    expect(encoded).not.toContain('Wider blocks')
    expect(encoded).not.toContain('price')
    expect(encoded).not.toContain('label')
  })

  it('shows an item’s new price after it is repriced, because the save holds none', () => {
    const state = played()
    const repriced = soundCatalog(catalogWith([pricedItem({ price: 250 }), unpricedItem()]))
    const back = parseSave(serializeSave(state), { ...context, catalog: repriced })

    expect(back.kind).toBe('restored')
    if (back.kind !== 'restored') return
    expect(back.state.owned).toEqual(['wider-blocks'])
    expect(repriced.items[0]?.priceUnits).toBe(25000)
    expect(JSON.stringify(encodeSave(state))).not.toContain('25000')
  })

  it('reads the declarations back rather than the save, so a redeclaration reaches it', () => {
    const state = played()
    const renamed = { ...testFarm, name: 'Other Farm', currency: 'XTS' }
    const back = restored(state, { ...context, declaration: renamed })

    expect(back.farm.declaration.currency).toBe('XTS')
    expect(back.farm.declaration.name).toBe('Other Farm')
  })
})

describe('a save that cannot be read resets rather than migrating wrongly', () => {
  it('resets a save written at an earlier schema version, saying so', () => {
    const older = { ...encodeSave(played()), schemaVersion: '0.9.0' }
    const outcome = decodeSave(older, context)

    expect(outcome.kind).toBe('reset')
    if (outcome.kind !== 'reset') return
    expect(outcome.cause.message).toContain('could not be read')
    expect(outcome.cause.message).toContain(SAVE_SCHEMA_VERSION)
  })

  it('resets text that is not readable as a save', () => {
    expect(parseSave('{not json', context).kind).toBe('reset')
    expect(parseSave('"a string"', context).kind).toBe('reset')
  })

  it('resets a save whose ledger is of the wrong shape, adopting no part of it', () => {
    const broken = { ...encodeSave(played()), ledger: [{ year: 'first' }] }
    const outcome = decodeSave(broken, context)

    expect(outcome.kind).toBe('reset')
    if (outcome.kind !== 'reset') return
    expect(outcome.cause.message).toContain('ledger')
    expect('state' in outcome).toBe(false)
  })

  it('adopts neither the balance nor anything else from a discarded save', () => {
    const broken = { ...encodeSave(played()), balance: 99999, movements: 'lots' }
    const outcome = decodeSave(broken, context)
    expect(outcome.kind).toBe('reset')

    const fresh = newGame(testFarm, catalog, () => 7)
    expect(fresh.farm.balance).toBe(toUnits(testFarm.openingBalance, 2))
    expect(fresh.farm.ledger).toEqual([])
    expect(fresh.owned).toEqual([])
  })
})

describe('a reference this build no longer declares is dropped, not fatal', () => {
  it('drops an owned id the catalog no longer declares and keeps the rest', () => {
    const stale = { ...encodeSave(played()), owned: ['wider-blocks', 'heirloom-block'] }
    const outcome = decodeSave(stale, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.owned).toEqual(['wider-blocks'])
    expect(outcome.state.farm.year).toBe(played().farm.year)
    expect(outcome.state.farm.balance).toBe(played().farm.balance)
    expect(outcome.state.farm.ledger).toEqual(played().farm.ledger)
    expect(outcome.dropped.map((issue) => issue.field)).toEqual(['heirloom-block'])
  })

  it('opens a dropped id on nothing', () => {
    const stale = { ...encodeSave(played()), owned: ['heirloom-block'] }
    const outcome = decodeSave(stale, context)
    if (outcome.kind !== 'restored') throw new Error('the save was meant to restore')

    expect(outcome.state.owned).toEqual([])
  })

  it('falls a no-longer-permitted knob value back to the declared default', () => {
    const stale = {
      ...encodeSave(played()),
      knobs: { [apple.id]: { channels: 64, blocks: 3 } },
    }
    const outcome = decodeSave(stale, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.knobs[apple.id]?.channels).toBe(16)
    expect(outcome.state.knobs[apple.id]?.blocks).toBe(3)
    expect(outcome.state.farm.balance).toBe(played().farm.balance)
    expect(outcome.state.farm.ledger).toEqual(played().farm.ledger)
  })

  it('drops a knob and a task the declarations no longer carry', () => {
    const stale = {
      ...encodeSave(played()),
      knobs: { [apple.id]: { momentum: 3 }, 'plum-harvest': { anything: 1 } },
    }
    const outcome = decodeSave(stale, context)
    if (outcome.kind !== 'restored') throw new Error('the save was meant to restore')

    expect(outcome.state.knobs[apple.id]).toEqual({})
    expect(outcome.state.knobs['plum-harvest']).toBeUndefined()
    expect(outcome.dropped).toHaveLength(2)
  })

  it('opens a knob at its declared default when the save holds nothing for it', () => {
    const values = knobValuesFor(restored(played()), apple)
    expect(values.channels).toBe(32)
    expect(values.regularization).toBe(1)
    expect(values.dropout).toBe(0)
  })
})

describe('a farm is one seed drawn once', () => {
  it('draws for a new farm and never on restore', () => {
    let draws = 0
    const fresh = newGame(testFarm, catalog, () => {
      draws += 1
      return 4242
    })
    expect(draws).toBe(1)

    expect(restored(fresh).seed).toBe(4242)
    expect(restored(restored(fresh)).seed).toBe(4242)
    expect(draws).toBe(1)
  })

  it('gives two new farms seeds of their own', () => {
    const seeds = new Set([newGame(testFarm, catalog).seed, newGame(testFarm, catalog).seed])
    expect(seeds.size).toBe(2)
  })

  it('owns what the catalog says a new farm owns, and nothing else', () => {
    const raw = catalogWith([pricedItem(), unpricedItem()])
    raw.ownedAtStart = ['wider-blocks']
    const opening = soundCatalog(raw)

    expect(newGame(testFarm, opening, () => 1).owned).toEqual(['wider-blocks'])
    expect(newGame(testFarm, catalog, () => 1).owned).toEqual([])
  })
})

describe('the save is plain, and nothing is spent defending it', () => {
  it('plays a hand-edited balance as given', () => {
    const edited = { ...encodeSave(played()), balance: 999999 }
    const outcome = decodeSave(edited, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.farm.balance).toBe(toUnits(999999, 2))
    expect(outcome.dropped).toEqual([])
  })

  it('opens a save written by hand that fits the schema', () => {
    const written = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      seed: 1,
      year: 4,
      balance: 12.5,
      movements: [],
      ledger: [],
      owned: ['wider-blocks'],
      knobs: {},
    }
    const outcome = decodeSave(written, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.farm.year).toBe(4)
    expect(outcome.state.farm.balance).toBe(1250)
    expect(outcome.state.owned).toEqual(['wider-blocks'])
  })

  it('stores readable text a student can inspect', () => {
    expect(JSON.parse(serializeSave(played()))).toEqual(encodeSave(played()))
  })
})

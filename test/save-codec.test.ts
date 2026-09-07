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
import type { CropBroughtIn } from '../src/economy/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import {
  decodeSave,
  encodeSave,
  knobValuesFor,
  newGame,
  parseSave,
  SAVE_REFERENCE_DROPPED,
  SAVE_RESET,
  SAVE_SCHEMA_VERSION,
  serializeSave,
  type GameState,
  type SaveContext,
  type SavedFarm,
} from '../src/save/index.js'
import { labourFor } from '../src/labour/index.js'
import { configurationId } from '../src/task/configId.js'
import { defaultConfiguration } from '../src/task/configuration.js'
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
    slots: {},
  }
}

/** A configuration identifier the apple declaration can still make. */
const AT_WORK = configurationId(defaultConfiguration(apple))

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

describe('the crop the farm bears', () => {
  it('is written and read back, so a grown holding stays grown', () => {
    const state = played()
    const grown: GameState = { ...state, farm: { ...state.farm, cropSize: 480 } }
    expect(encodeSave(grown).cropSize).toBe(480)
    expect(restored(grown).farm.cropSize).toBe(480)
  })

  it('opens at the declared crop when a save records none', () => {
    const written = encodeSave(played()) as unknown as Record<string, unknown>
    delete written.cropSize
    const outcome = decodeSave(written, context)
    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.farm.cropSize).toBe(testFarm.openingCrop)
  })

  it('discards a save recording a crop that is not a whole number of one or more', () => {
    for (const cropSize of [0, -3, 2.5, 'ten']) {
      const written = { ...(encodeSave(played()) as unknown as Record<string, unknown>), cropSize }
      expect(decodeSave(written, context).kind, `${JSON.stringify(cropSize)} was accepted`).toBe(
        'reset',
      )
    }
  })
})

/** A card's crop, in the aggregate shape the save keeps and nothing finer. */
function crop(over: Partial<CropBroughtIn> = {}): CropBroughtIn {
  const category = apple.categories[0]?.id ?? ''
  const action = apple.actions[0]?.id ?? ''
  return {
    taskId: apple.id,
    paidUnits: toUnits(31.5, 2),
    evaluated: 4,
    counts: { [category]: { [action]: 4 } },
    ...over,
  }
}

describe('the labour slots', () => {
  it('round-trip, so what was put to work is still at work after a reload', () => {
    const state: GameState = { ...played(), slots: { [apple.id]: { configurationId: AT_WORK } } }

    expect(encodeSave(state).slots).toEqual({ [apple.id]: { configuration: AT_WORK } })
    expect(restored(state).slots).toEqual({ [apple.id]: { configurationId: AT_WORK } })
  })

  it('carry a family alongside the configuration where one is set', () => {
    const state: GameState = {
      ...played(),
      slots: { [apple.id]: { configurationId: AT_WORK, family: 'convolutional' } },
    }

    expect(restored(state).slots).toEqual({
      [apple.id]: { configurationId: AT_WORK, family: 'convolutional' },
    })
  })

  it('open on the farm’s hands for a save that has none, which is every empty farm', () => {
    const written = encodeSave(played()) as unknown as Record<string, unknown>
    delete written.slots
    const outcome = decodeSave(written, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots).toEqual({})
  })

  it('drop a slot naming a configuration this build can no longer make, saying so', () => {
    const stale = {
      ...encodeSave(played()),
      slots: { [apple.id]: { configuration: 'blocks9-channels999-regularization7-dropout4' } },
    }
    const outcome = decodeSave(stale, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    // The farm opens, the card is back on hand work, and the cause is reported.
    expect(outcome.state.slots).toEqual({})
    expect(labourFor(outcome.state.slots, apple.id)).toEqual({ kind: 'manual' })
    expect(outcome.state.farm.balance).toBe(played().farm.balance)
    expect(outcome.state.farm.year).toBe(played().farm.year)
    expect(outcome.state.farm.ledger).toEqual(played().farm.ledger)
    expect(outcome.dropped.map((issue) => issue.code)).toContain(SAVE_REFERENCE_DROPPED)
    expect(outcome.dropped.map((issue) => issue.message).join(' ')).toContain('hand work')
  })

  it('put no other model in a dropped one’s place, and keep the slots that still resolve', () => {
    // A second card, so "the hands" cannot be mistaken for "the farm was emptied": one
    // slot is stale and one is sound, and only the stale one goes.
    const second: TaskDeclaration = { ...apple, id: 'second-card' }
    const stale = {
      ...encodeSave(played()),
      slots: {
        [apple.id]: { configuration: 'blocks9-channels999-regularization7-dropout4' },
        [second.id]: { configuration: AT_WORK },
      },
    }
    const outcome = decodeSave(stale, { ...context, tasks: [apple, second] })

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots).toEqual({ [second.id]: { configurationId: AT_WORK } })
    expect(labourFor(outcome.state.slots, apple.id)).toEqual({ kind: 'manual' })
    expect(labourFor(outcome.state.slots, second.id)).toEqual({
      kind: 'model',
      model: { configurationId: AT_WORK },
    })
    // Exactly one cause, naming the card whose model went, and no substitute for it.
    expect(outcome.dropped).toHaveLength(1)
    expect(outcome.dropped[0]?.field).toBe(apple.id)
  })

  it('drop a slot for a task the declarations no longer carry', () => {
    const stale = { ...encodeSave(played()), slots: { 'gone-task': { configuration: AT_WORK } } }
    const outcome = decodeSave(stale, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots).toEqual({})
    expect(outcome.dropped).toHaveLength(1)
  })

  it('reset a save whose slots are not of the shape a save has', () => {
    for (const slots of [[], 'none', { [apple.id]: { configuration: 4 } }]) {
      const written = { ...(encodeSave(played()) as unknown as Record<string, unknown>), slots }
      expect(decodeSave(written, context).kind, `${JSON.stringify(slots)} was accepted`).toBe(
        'reset',
      )
    }
  })
})

describe('a year part way in', () => {
  it('round-trips what each card has brought in, and none of it is money', () => {
    const base = played()
    const state: GameState = {
      ...base,
      pending: { year: base.farm.year, brought: [crop({ configurationId: AT_WORK })] },
    }
    const back = restored(state)

    expect(back.pending).toEqual(state.pending)
    // Nothing about the year in progress has reached the balance, the ledger or the year.
    expect(back.farm.balance).toBe(base.farm.balance)
    expect(back.farm.ledger).toEqual(base.farm.ledger)
    expect(back.farm.year).toBe(base.farm.year)
  })

  it('reads a save written without one as a year not yet run', () => {
    const written = encodeSave(played()) as unknown as Record<string, unknown>
    expect('pending' in written).toBe(false)

    const outcome = decodeSave(written, context)
    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.pending).toBeUndefined()
  })

  it('is dropped when its year is not the farm’s, leaving the money exactly as it was', () => {
    const base = played()
    const state: GameState = { ...base, pending: { year: base.farm.year - 1, brought: [crop()] } }
    const outcome = decodeSave(encodeSave(state), context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.pending).toBeUndefined()
    expect(outcome.state.farm.balance).toBe(base.farm.balance)
    expect(outcome.state.farm.ledger).toEqual(base.farm.ledger)
    expect(outcome.state.farm.year).toBe(base.farm.year)
    expect(outcome.dropped.map((issue) => issue.field)).toContain('pending')
  })

  it('resets a save whose year in progress is of the wrong shape', () => {
    for (const pending of [{ year: 'third', brought: [] }, { year: 3 }, { year: 3, brought: [{}] }]) {
      const written = { ...(encodeSave(played()) as unknown as Record<string, unknown>), pending }
      expect(decodeSave(written, context).kind, `${JSON.stringify(pending)} was accepted`).toBe(
        'reset',
      )
    }
  })
})

describe('the most recently closed year', () => {
  it('round-trips each card’s counts and what it paid', () => {
    const base = played()
    const state: GameState = {
      ...base,
      lastYear: { year: base.farm.year - 1, brought: [crop({ configurationId: AT_WORK })] },
    }

    expect(restored(state).lastYear).toEqual(state.lastYear)
  })

  it('keeps a hand-brought card without naming a configuration for it', () => {
    const base = played()
    const state: GameState = { ...base, lastYear: { year: base.farm.year - 1, brought: [crop()] } }
    const written = encodeSave(state)

    expect(written.lastYear?.brought[0]?.configuration).toBeUndefined()
    expect(restored(state).lastYear?.brought[0]?.configurationId).toBeUndefined()
  })

  it('writes no per-image decision, only the counts a report renders', () => {
    const base = played()
    const state: GameState = {
      ...base,
      lastYear: { year: base.farm.year - 1, brought: [crop({ configurationId: AT_WORK })] },
    }
    const written: SavedFarm = encodeSave(state)

    expect(Object.keys(written.lastYear?.brought[0] ?? {}).sort()).toEqual([
      'configuration',
      'counts',
      'evaluated',
      'paid',
      'task',
    ])
    expect(JSON.stringify(written)).not.toContain('imageId')
    expect(JSON.stringify(written)).not.toContain('mistakes')
  })

  it('is absent for a farm that has closed no year under this schema', () => {
    expect(encodeSave(played()).lastYear).toBeUndefined()
    expect(restored(played()).lastYear).toBeUndefined()
  })
})

describe('a save written by the previous schema', () => {
  it('resets with its cause reported, which is what a schema bump costs', () => {
    // The migration plan: the slots and the year in progress are both new state, so
    // there is no honest reading of a save written before either existed.
    const previous = {
      schemaVersion: '1.0.0',
      seed: 12345,
      year: 4,
      cropSize: 12,
      balance: 790.25,
      movements: [],
      ledger: [],
      owned: ['wider-blocks'],
      knobs: {},
    }
    const outcome = decodeSave(previous, context)

    expect(outcome.kind).toBe('reset')
    if (outcome.kind !== 'reset') return
    expect(outcome.cause.code).toBe(SAVE_RESET)
    expect(outcome.cause.message).toContain('"1.0.0"')
    expect(outcome.cause.message).toContain(SAVE_SCHEMA_VERSION)
    // Nothing of it is adopted: the farm that opens is the declared opening state.
    const fresh = newGame(testFarm, catalog, () => 7)
    expect(fresh.farm.balance).toBe(toUnits(testFarm.openingBalance, 2))
    expect(fresh.slots).toEqual({})
    expect(fresh.pending).toBeUndefined()
  })
})

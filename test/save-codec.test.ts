/**
 * The save codec: a round trip, a version mismatch, a stale reference, and the seed.
 *
 * Every one of these is testable with no DOM because the codec is pure — which is the
 * whole reason the save was split into a codec here and twenty lines of `localStorage` in
 * `web/src/data/save.ts`.
 */

import { describe, expect, it } from 'vitest'
import {
  credit,
  cropSize,
  debit,
  openFarm,
  recordHarvest,
  toUnits,
} from '../src/economy/index.js'
import type { Catalog } from '../src/progression/index.js'
import type { CropBroughtIn, HarvestFigures } from '../src/economy/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import {
  decodeSave,
  encodeSave,
  knobValuesFor,
  selectedFamilyFor,
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
import { firstFamily } from '../src/task/families.js'
import {
  familyOf,
  SHIPS_MODEL,
  SHIPS_PREDICTIONS,
  twoFamilyTask,
} from './helpers/families.js'
import { appleDeclaration } from './helpers/apple.js'
import {
  catalogWith,
  landItem,
  pricedItem,
  soundCatalog,
  testFarm,
  unpricedItem,
} from './helpers/catalog.js'

const apple = appleDeclaration()
const family = firstFamily(apple)
/** The family every knob value and every slot below belongs to. */
const FAMILY = family.id
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
    knobs: { [apple.id]: { [FAMILY]: { channels: 32, blocks: 2 } } },
    families: {},
    tutorials: [],
    slots: {},
  }
}

/** A configuration identifier the apple declaration can still make. */
const AT_WORK = configurationId(defaultConfiguration(apple, family))

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
      knobs: { [apple.id]: { [FAMILY]: { channels: 64, blocks: 3 } } },
    }
    const outcome = decodeSave(stale, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.knobs[apple.id]?.[FAMILY]?.channels).toBe(16)
    expect(outcome.state.knobs[apple.id]?.[FAMILY]?.blocks).toBe(3)
    expect(outcome.state.farm.balance).toBe(played().farm.balance)
    expect(outcome.state.farm.ledger).toEqual(played().farm.ledger)
  })

  it('drops a knob and a task the declarations no longer carry', () => {
    const stale = {
      ...encodeSave(played()),
      knobs: { [apple.id]: { [FAMILY]: { momentum: 3 } }, 'plum-harvest': { anything: 1 } },
    }
    const outcome = decodeSave(stale, context)
    if (outcome.kind !== 'restored') throw new Error('the save was meant to restore')

    expect(outcome.state.knobs[apple.id]).toEqual({ [FAMILY]: {} })
    expect(outcome.state.knobs['plum-harvest']).toBeUndefined()
    expect(outcome.dropped).toHaveLength(2)
  })

  it('opens a knob at its declared default when the save holds nothing for it', () => {
    const values = knobValuesFor(restored(played()), apple, family)
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

describe('the land the farm holds is recorded and the crop it bears is not', () => {
  it('is written and read back, so a grown holding stays grown', () => {
    const state = played()
    const grown: GameState = { ...state, farm: { ...state.farm, land: 480 } }
    expect(encodeSave(grown).land).toBe(480)
    expect(restored(grown).farm.land).toBe(480)
  })

  it('brings back the crop that land bears rather than a recorded size', () => {
    const state = played()
    const grown: GameState = { ...state, farm: { ...state.farm, land: 40 } }

    expect(cropSize(restored(grown).farm)).toBe(40 * testFarm.orchard.piecesPerUnit)
    // Recording it as well would let a restored farm carry a crop size its own land and
    // yield contradict, so the save carries no such field to disagree with.
    expect(JSON.stringify(encodeSave(grown))).not.toContain('cropSize')
  })

  it('opens at the declared opening land when a save records none', () => {
    const written = encodeSave(played()) as unknown as Record<string, unknown>
    delete written.land
    const outcome = decodeSave(written, context)
    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.farm.land).toBe(testFarm.orchard.opening)
    // The rest of the save is kept: a save written before land could be bought had
    // bought none, so there is nothing to lose by opening it at the opening.
    expect(outcome.state.farm.balance).toBe(played().farm.balance)
    expect(outcome.state.owned).toEqual(['wider-blocks'])
  })

  it('loses nothing a save carrying the old crop-size field could have bought', () => {
    const written: Record<string, unknown> = {
      ...(encodeSave(played()) as unknown as Record<string, unknown>),
      cropSize: 12,
    }
    delete written.land
    const outcome = decodeSave(written, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.farm.land).toBe(testFarm.orchard.opening)
    expect(outcome.state.owned).toEqual(['wider-blocks'])
    expect(outcome.state.farm.ledger).toEqual(played().farm.ledger)
  })

  it('reads what a unit of land bears back from the declaration, not from the save', () => {
    const state = played()
    const grown: GameState = { ...state, farm: { ...state.farm, land: 40 } }
    const richer = {
      ...testFarm,
      orchard: { ...testFarm.orchard, piecesPerUnit: testFarm.orchard.piecesPerUnit * 5 },
    }
    const back = restored(grown, { ...context, declaration: richer })

    expect(back.farm.land).toBe(40)
    expect(cropSize(back.farm)).toBe(40 * richer.orchard.piecesPerUnit)
  })

  it('discards a save recording land that is not a whole number of one or more', () => {
    for (const land of [0, -3, 2.5, 'ten']) {
      const written = { ...(encodeSave(played()) as unknown as Record<string, unknown>), land }
      expect(decodeSave(written, context).kind, `${JSON.stringify(land)} was accepted`).toBe(
        'reset',
      )
    }
  })

  it('keeps a closed year’s recorded crop size, which is that year’s own figure', () => {
    const base = played()
    const state: GameState = {
      ...base,
      farm: { ...base.farm, land: 40 },
      lastYear: {
        year: base.farm.year - 1,
        brought: [crop({ configurationId: AT_WORK, harvest: harvest({ cropSize: 600 }) })],
      },
    }
    const back = restored(state)

    // The farm has grown since; the year that closed keeps the size it closed with,
    // because nothing of a closed year is re-derived from the farm as it now stands.
    expect(back.lastYear?.brought[0]?.harvest?.cropSize).toBe(600)
    expect(cropSize(back.farm)).toBe(40 * testFarm.orchard.piecesPerUnit)
  })
})

describe('an owned id may be recorded more than once', () => {
  const withLand: Catalog = soundCatalog(
    catalogWith([pricedItem(), unpricedItem(), landItem({ repeat: 3 })]),
  )
  const landContext: SaveContext = { declaration: testFarm, catalog: withLand, tasks: [apple] }

  /** A played farm owning `starter-plot` `times` over, on the land those purchases gave. */
  function bought(times: number): GameState {
    const state = played()
    return {
      ...state,
      farm: { ...state.farm, land: testFarm.orchard.opening + 10 * times },
      owned: [...state.owned, ...Array.from({ length: times }, () => 'starter-plot')],
    }
  }

  it('brings back every occurrence the catalog still permits', () => {
    const back = restored(bought(3), landContext)
    expect(back.owned.filter((id) => id === 'starter-plot')).toHaveLength(3)
  })

  it('trims a count the catalog no longer permits, keeping the rest of the save', () => {
    const saved = bought(5)
    const outcome = parseSave(serializeSave(saved), landContext)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.owned.filter((id) => id === 'starter-plot')).toHaveLength(3)
    expect(outcome.state.owned).toContain('wider-blocks')
    expect(outcome.state.farm.year).toBe(saved.farm.year)
    expect(outcome.state.farm.balance).toBe(saved.farm.balance)
    expect(outcome.state.farm.ledger).toEqual(saved.farm.ledger)
    expect(outcome.dropped.map((issue) => issue.code)).toContain(SAVE_REFERENCE_DROPPED)
    expect(outcome.dropped.map((issue) => issue.message).join(' ')).toContain('starter-plot')
  })

  it('does not take back the land when a count is trimmed, and refunds nothing', () => {
    const saved = bought(5)
    const back = restored(saved, landContext)

    // Land is recorded as land, not as a tally of purchases, so lowering a repeat limit
    // leaves a farm holding land it can no longer buy — which is what "no way to sell,
    // refund or return" means when it is kept across a redeclaration.
    expect(back.farm.land).toBe(saved.farm.land)
    expect(back.farm.balance).toBe(saved.farm.balance)
    expect(back.farm.movements).toEqual(saved.farm.movements)
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
    const state: GameState = {
      ...played(),
      slots: { [apple.id]: { configurationId: AT_WORK, family: FAMILY } },
    }

    expect(encodeSave(state).slots).toEqual({
      [apple.id]: { configuration: AT_WORK, family: FAMILY },
    })
    expect(restored(state).slots).toEqual({
      [apple.id]: { configurationId: AT_WORK, family: FAMILY },
    })
  })

  it('are not guessed at when the save names a configuration and no family', () => {
    // An identifier alone names one model per family. Adopting the task's first family
    // here would put a model to work that nobody chose, and it would answer plausibly.
    const stale = {
      ...encodeSave(played()),
      slots: { [apple.id]: { configuration: AT_WORK } },
    }
    const outcome = decodeSave(stale, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots).toEqual({})
    expect(labourFor(outcome.state.slots, apple.id)).toEqual({ kind: 'manual' })
    expect(outcome.dropped.map((issue) => issue.code)).toContain(SAVE_REFERENCE_DROPPED)
  })

  it('drop a slot naming a family this build no longer declares, saying which', () => {
    const stale = {
      ...encodeSave(played()),
      slots: { [apple.id]: { configuration: AT_WORK, family: 'withdrawn-rung' } },
    }
    const outcome = decodeSave(stale, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots).toEqual({})
    expect(labourFor(outcome.state.slots, apple.id)).toEqual({ kind: 'manual' })
    // The rest of the progress is kept, and the cause names the family that went.
    expect(outcome.state.farm.balance).toBe(played().farm.balance)
    expect(outcome.state.knobs[apple.id]?.[FAMILY]?.channels).toBe(32)
    expect(outcome.dropped.map((issue) => issue.message).join(' ')).toContain('withdrawn-rung')
  })

  it('put no declared family in a withdrawn one’s place, however well it would fit', () => {
    // The withdrawn family's identifier is one the surviving family composes too. It is
    // still not remapped: the slot is dropped and the card goes back to the hands.
    const stale = {
      ...encodeSave(played()),
      slots: { [apple.id]: { configuration: AT_WORK, family: 'withdrawn-rung' } },
    }
    const outcome = decodeSave(stale, context)

    if (outcome.kind !== 'restored') throw new Error('the save was meant to restore')
    expect(outcome.state.slots[apple.id]).toBeUndefined()
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
      slots: {
        [apple.id]: {
          configuration: 'blocks9-channels999-regularization7-dropout4',
          family: FAMILY,
        },
      },
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
        [apple.id]: {
          configuration: 'blocks9-channels999-regularization7-dropout4',
          family: FAMILY,
        },
        [second.id]: { configuration: AT_WORK, family: FAMILY },
      },
    }
    const outcome = decodeSave(stale, { ...context, tasks: [apple, second] })

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots).toEqual({
      [second.id]: { configurationId: AT_WORK, family: FAMILY },
    })
    expect(labourFor(outcome.state.slots, apple.id)).toEqual({ kind: 'manual' })
    expect(labourFor(outcome.state.slots, second.id)).toEqual({
      kind: 'model',
      model: { configurationId: AT_WORK, family: FAMILY },
    })
    // Exactly one cause, naming the card whose model went, and no substitute for it.
    expect(outcome.dropped).toHaveLength(1)
    expect(outcome.dropped[0]?.field).toBe(apple.id)
  })

  it('drop a slot for a task the declarations no longer carry', () => {
    const stale = {
      ...encodeSave(played()),
      slots: { 'gone-task': { configuration: AT_WORK, family: FAMILY } },
    }
    const outcome = decodeSave(stale, context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots).toEqual({})
    expect(outcome.dropped).toHaveLength(1)
  })

  it('reset a save whose slots are not of the shape a save has', () => {
    for (const slots of [[], 'none', { [apple.id]: { configuration: 4, family: FAMILY } }]) {
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

/** Everything a harvest records about the year it belongs to. */
function harvest(over: Partial<HarvestFigures> = {}): HarvestFigures {
  return {
    cropSize: 6000,
    composition: { red: 3268, green: 2080, wormy: 652 },
    grossUnits: toUnits(1380.4, 2),
    downgradeUnits: toUnits(1130.4, 2),
    downgraded: true,
    warned: false,
    delivered: 5013,
    measured: 640,
    share: 640 / 5013,
    tolerance: 0.12,
    recurred: true,
    heldPictures: 1000,
    ...over,
  }
}

describe('a harvest records enough to explain itself', () => {
  it('round-trips every figure a closed year’s report is built from', () => {
    const base = played()
    const state: GameState = {
      ...base,
      lastYear: {
        year: base.farm.year - 1,
        brought: [crop({ configurationId: AT_WORK, harvest: harvest() })],
      },
    }

    expect(restored(state).lastYear).toEqual(state.lastYear)
  })

  it('keeps its figures after the farm has advanced several years', () => {
    // The whole point of recording rather than recomputing: the crop has been drawn, the
    // years have moved on, and the closed year still explains its own number.
    const base = played()
    const figures = harvest()
    const closed = {
      year: base.farm.year,
      brought: [
        crop({
          configurationId: AT_WORK,
          // What the card paid is what the arithmetic comes to, which is the claim below.
          paidUnits: figures.grossUnits - figures.downgradeUnits,
          harvest: figures,
        }),
      ],
    }
    let farm = base.farm
    for (let year = 0; year < 5; year += 1) farm = recordHarvest(farm, toUnits(12, 2))

    const later = restored({ ...base, farm, lastYear: closed })
    const read = later.lastYear?.brought[0]?.harvest

    expect(later.farm.year).toBe(base.farm.year + 5)
    expect(read).toEqual(figures)
    // And the arithmetic the report shows still comes out, from what was written down.
    const paid = later.lastYear?.brought[0]?.paidUnits ?? 0
    expect((read?.grossUnits ?? 0) - (read?.downgradeUnits ?? 0)).toBe(paid)
  })

  it('records no share, tolerance or downgrade for a task declaring no term', () => {
    const base = played()
    const plain = harvest({
      downgraded: false,
      downgradeUnits: 0,
      delivered: undefined,
      measured: undefined,
      share: undefined,
      tolerance: undefined,
    })
    const state: GameState = {
      ...base,
      lastYear: { year: base.farm.year - 1, brought: [crop({ harvest: plain })] },
    }
    const written: SavedFarm = encodeSave(state)
    const record = written.lastYear?.brought[0]?.harvest ?? {}

    for (const field of ['delivered', 'measured', 'share', 'tolerance']) {
      expect(Object.keys(record), `"${field}" should not be written`).not.toContain(field)
    }
    expect(restored(state).lastYear?.brought[0]?.harvest).toEqual(plain)
  })

  it('reads back a year written before harvests explained themselves', () => {
    // An older save carries what each card paid and nothing about the year. It must read
    // as the year it was rather than resetting the farm over a figure the report can
    // simply not show.
    const base = played()
    const state: GameState = {
      ...base,
      lastYear: { year: base.farm.year - 1, brought: [crop({ configurationId: AT_WORK })] },
    }
    const written = JSON.parse(serializeSave(state)) as Record<string, unknown>
    const outcome = parseSave(JSON.stringify(written), context)

    expect(outcome.kind).toBe('restored')
    const brought = outcome.kind === 'restored' ? outcome.state.lastYear?.brought[0] : undefined
    expect(brought?.harvest).toBeUndefined()
    expect(brought?.paidUnits).toBe(toUnits(31.5, 2))
  })

  it('drops a harvest whose figures are unreadable rather than the year around it', () => {
    const base = played()
    const state: GameState = {
      ...base,
      lastYear: {
        year: base.farm.year - 1,
        brought: [crop({ configurationId: AT_WORK, harvest: harvest() })],
      },
    }
    const written = JSON.parse(serializeSave(state)) as {
      lastYear: { brought: { harvest: Record<string, unknown> }[] }
    }
    const entry = written.lastYear.brought[0]
    if (entry === undefined) throw new Error('the save must carry the card')
    entry.harvest = { ...entry.harvest, cropSize: 'lots' }

    const outcome = parseSave(JSON.stringify(written), context)
    expect(outcome.kind).toBe('restored')
    const brought = outcome.kind === 'restored' ? outcome.state.lastYear?.brought[0] : undefined
    expect(brought?.harvest).toBeUndefined()
    expect(brought?.paidUnits).toBe(toUnits(31.5, 2))
  })
})

/**
 * A task's families are progress in two ways: which one is selected, and what each one's
 * knobs were left at. Neither may leak into the other, and neither may be read from the
 * save where the declaration already says it.
 */
describe('the families of a task', () => {
  const twoFamily = twoFamilyTask()
  const network = SHIPS_PREDICTIONS.id
  const chain = SHIPS_MODEL.id
  const twoFamilyContext: SaveContext = { ...context, tasks: [twoFamily] }

  /** A played farm whose two families were tuned to different values. */
  function tuned(): GameState {
    return {
      ...played(),
      knobs: { [twoFamily.id]: { [network]: { depth: 2 }, [chain]: { depth: 1 } } },
      families: { [twoFamily.id]: chain },
    }
  }

  it('remember each family’s knob values separately', () => {
    const back = restored(tuned(), twoFamilyContext)

    expect(back.knobs[twoFamily.id]?.[network]).toEqual({ depth: 2 })
    expect(back.knobs[twoFamily.id]?.[chain]).toEqual({ depth: 1 })
  })

  it('leave one family’s values exactly as they were when another is tuned', () => {
    const before = tuned()
    const after: GameState = {
      ...before,
      knobs: {
        ...before.knobs,
        [twoFamily.id]: { ...before.knobs[twoFamily.id], [network]: { depth: 1 } },
      },
    }

    expect(restored(after, twoFamilyContext).knobs[twoFamily.id]?.[chain]).toEqual(
      before.knobs[twoFamily.id]?.[chain],
    )
  })

  it('open a family the save records no values for at its declared defaults', () => {
    const untouched: GameState = {
      ...played(),
      knobs: { [twoFamily.id]: { [network]: { depth: 2 } } },
      families: {},
    }
    const back = restored(untouched, twoFamilyContext)

    // Every knob at its declared default, the dataset knob included: a family the save
    // says nothing about opens on the photographs that came with the robot.
    expect(knobValuesFor(back, twoFamily, familyOf(twoFamily, chain))).toEqual({
      depth: 1,
      dataset: 'starter',
    })
    // Never having tuned a family is not a defect in the save.
    expect(parseSave(serializeSave(untouched), twoFamilyContext)).toMatchObject({ dropped: [] })
  })

  it('record which family a task has selected, because choosing one is progress', () => {
    expect(restored(tuned(), twoFamilyContext).families[twoFamily.id]).toBe(chain)
    expect(selectedFamilyFor(restored(tuned(), twoFamilyContext), twoFamily).id).toBe(chain)
  })

  it('open at the task’s first declared family when the save records none', () => {
    const silent: GameState = { ...tuned(), families: {} }
    const back = restored(silent, twoFamilyContext)

    expect(selectedFamilyFor(back, twoFamily).id).toBe(twoFamily.families[0]?.id)
    // And the rest of the save is kept rather than refused.
    expect(back.knobs[twoFamily.id]?.[network]).toEqual({ depth: 2 })
    expect(back.farm.balance).toBe(played().farm.balance)
  })

  it('drop a selection the task no longer declares and open at the first, keeping the rest', () => {
    const stale = {
      ...encodeSave(tuned()),
      families: { [twoFamily.id]: 'withdrawn-rung' },
    }
    const outcome = decodeSave(stale, twoFamilyContext)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(selectedFamilyFor(outcome.state, twoFamily).id).toBe(twoFamily.families[0]?.id)
    expect(outcome.state.knobs[twoFamily.id]?.[chain]).toEqual({ depth: 1 })
    expect(outcome.dropped.map((issue) => issue.message).join(' ')).toContain('withdrawn-rung')
  })

  it('carry no family id, label, knob, default, help, shipped form, icon or axis', () => {
    const written = JSON.stringify(encodeSave(tuned()))

    for (const family of twoFamily.families) {
      for (const word of [
        family.label,
        family.ships,
        family.slot.icon,
        family.slot.label,
        family.history?.axis,
        ...family.knobs.flatMap((knob) => [knob.label, knob.help]),
      ]) {
        if (word === undefined) continue
        expect(written, `the save carries "${word}"`).not.toContain(word)
      }
    }
    // The ids are there, because a selection and a set of knob values have to name what
    // they belong to. Everything the declaration says about that family is not.
    expect(written).toContain(chain)
  })

  it('let a relabelled family reach a restored farm', () => {
    const relabelled: TaskDeclaration = {
      ...twoFamily,
      families: twoFamily.families.map((family) =>
        family.id === chain
          ? {
              ...family,
              label: 'A quite different name',
              teaching: { summary: 'New copy.', theory: 'New theory.' },
            }
          : family,
      ),
    }

    const back = restored(tuned(), { ...twoFamilyContext, tasks: [relabelled] })
    const selected = selectedFamilyFor(back, relabelled)

    expect(selected.label).toBe('A quite different name')
    expect(selected.teaching.summary).toBe('New copy.')
  })
})

describe('the schema version this build reads', () => {
  it('resets a save written at the version before it, rather than migrating it', () => {
    // Knob values became a map per family and a slot gained one, so there is no honest
    // reading of a save written before either. The bump is what makes that a refusal.
    const previous = { ...encodeSave(played()), schemaVersion: '2.0.0' }
    const outcome = decodeSave(previous, context)

    expect(outcome.kind).toBe('reset')
    if (outcome.kind !== 'reset') return
    expect(outcome.cause.code).toBe(SAVE_RESET)
    expect(outcome.cause.message).toContain('"2.0.0"')
    expect(outcome.cause.message).toContain(SAVE_SCHEMA_VERSION)
  })

  it('is the version this build writes', () => {
    expect(encodeSave(played()).schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(SAVE_SCHEMA_VERSION).toBe('4.0.0')
  })
})

/**
 * A save written before dataset tiers existed, reopened after them.
 *
 * The one migration this change had to answer for. `game-save` already decides both
 * halves — a knob the save says nothing about falls to its declared default, and a model
 * at work whose configuration the knobs can no longer compose is dropped and reported —
 * so what is checked here is that the answers are the ones the design predicted, against
 * a save built the way the old codec built one.
 */
describe('a farm saved before the datasets were declared', () => {
  /** A played farm whose knob values name every knob but the dataset one. */
  function beforeTiers(): GameState {
    const played_ = played()
    const values = { ...played_.knobs[apple.id]?.[FAMILY] }
    delete (values as Record<string, unknown>)[family.datasetKnob]
    return { ...played_, knobs: { [apple.id]: { [FAMILY]: values } } }
  }

  it('reopens with its money, its year and its purchases exactly as they were', () => {
    const state = beforeTiers()
    const back = restored(state)

    expect(back.farm.balance).toBe(state.farm.balance)
    expect(back.farm.year).toBe(state.farm.year)
    expect(back.farm.ledger).toEqual(state.farm.ledger)
    expect(back.owned).toEqual(state.owned)
    expect(back.seed).toBe(state.seed)
  })

  it('opens its dataset knob at the smallest tier, which is the set it was fitted on', () => {
    const values = knobValuesFor(restored(beforeTiers()), apple, family)

    expect(values[family.datasetKnob]).toBe(apple.datasets[0]?.id)
    // Everything the save did record is still where the student left it.
    expect(values.channels).toBe(32)
  })

  it('reports nothing as dropped for the knob it never carried', () => {
    const outcome = parseSave(serializeSave(beforeTiers()), context)

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.dropped).toEqual([])
  })

  it('drops a model at work under the old identifier, naming it rather than crashing', () => {
    // The old spelling carried no tier, so the knobs can no longer compose it. `game-save`
    // drops such a slot and says so; the farm opens, and the student makes the model again.
    const stale = configurationId(defaultConfiguration(apple, family)).replace(
      `-${family.datasetKnob}${apple.datasets[0]?.id ?? ''}`,
      '',
    )
    const outcome = parseSave(
      serializeSave({ ...beforeTiers(), slots: { [apple.id]: { configurationId: stale, family: FAMILY } } }),
      context,
    )

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots).toEqual({})
    expect(outcome.dropped.map((issue) => issue.code)).toContain(SAVE_REFERENCE_DROPPED)
    expect(outcome.dropped.map((issue) => issue.message).join(' ')).toContain(stale)
  })

  it('keeps a model at work whose identifier already carries the tier', () => {
    const outcome = parseSave(
      serializeSave({ ...beforeTiers(), slots: { [apple.id]: { configurationId: AT_WORK, family: FAMILY } } }),
      context,
    )

    expect(outcome.kind).toBe('restored')
    if (outcome.kind !== 'restored') return
    expect(outcome.state.slots[apple.id]).toEqual({ configurationId: AT_WORK, family: FAMILY })
    expect(outcome.dropped).toEqual([])
  })
})

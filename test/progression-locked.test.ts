/**
 * Locked, untrained and invalid: three refusals, in that order, in one another's words
 * never.
 *
 * A student who has not bought something has made no error, and a student who has bought
 * something has not met the limits of what was trained. The three codes are what lets a
 * screen say so without deciding which is which.
 *
 * Also here: unlocking adds identifiers and reinterprets nothing. That is the property
 * every shipped artifact depends on — if buying something could change what an identifier
 * means, every artifact already committed would silently be about a different model.
 */

import { describe, expect, it } from 'vitest'
import { configurationId } from '../src/task/configId.js'
import { defaultConfiguration, resolveConfiguration } from '../src/task/configuration.js'
import { UNTRAINED_CONFIGURATION } from '../src/task/artifactIndex.js'
import {
  computeAvailability,
  declaredValues,
  LOCKED_CONFIGURATION,
  lockedIssues,
  resolveSelectable,
  taskAvailability,
} from '../src/progression/index.js'
import { firstFamily } from '../src/task/families.js'
import { appleDeclaration } from './helpers/apple.js'
import {
  catalogWith,
  pricedItem,
  shippedCatalogJson,
  soundCatalog,
  unpricedItem,
} from './helpers/catalog.js'
import { shippedFarm } from './helpers/farm.js'

const apple = appleDeclaration()
const family = firstFamily(apple)
const tasks = [apple]
const catalog = soundCatalog(catalogWith([pricedItem(), unpricedItem()]))

function availabilityFor(owned: readonly string[]) {
  return taskAvailability(computeAvailability(catalog, tasks, owned), apple.id)
}

/** Every identifier a given ownership can select, over the whole declared grid. */
function selectable(owned: readonly string[]): string[] {
  const availability = availabilityFor(owned)
  let rows: (readonly [string, string | number])[][] = [[]]
  for (const knob of family.knobs) {
    rows = declaredValues(knob).flatMap((value) =>
      rows.map((row) => [...row, [knob.id, value] as const]),
    )
  }
  return rows
    .filter((values) => lockedIssues({ taskId: apple.id, familyId: family.id, values }, availability).length === 0)
    .map((values) => configurationId({ taskId: apple.id, familyId: family.id, values }))
}

describe('the three refusals are distinct', () => {
  it('refuses a locked but declared value as locked, naming what opens it', () => {
    const refused = resolveSelectable(apple, family, { channels: 8 }, availabilityFor([]))

    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0]?.code).toBe(LOCKED_CONFIGURATION)
    expect(refused.issues[0]?.field).toBe('channels')
    expect(refused.issues[0]?.message).toContain('Wider blocks')
    expect(refused.issues[0]?.message).not.toContain('trained')
  })

  it('refuses a value the declaration does not permit as invalid, whatever is owned', () => {
    for (const owned of [[], ['wider-blocks']]) {
      const refused = resolveSelectable(apple, family, { channels: 64 }, availabilityFor(owned))
      expect(refused.ok).toBe(false)
      if (refused.ok) continue
      expect(refused.issues[0]?.code).toBe('knob-value-out-of-range')
      expect(refused.issues[0]?.code).not.toBe(LOCKED_CONFIGURATION)
    }
  })

  it('asks invalid before locked, so an out-of-range value never reads as unowned', () => {
    const refused = resolveSelectable(apple, family, { channels: 64, blocks: 3 }, availabilityFor([]))
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues.map((issue) => issue.code)).not.toContain(LOCKED_CONFIGURATION)
  })

  it('lets an available but uncovered configuration through, to refuse as untrained', () => {
    // `regularization` is named by no item, so 3 is available — and no model was trained
    // for it. That refusal belongs to the artifact, not to the progression module.
    const selectable = resolveSelectable(apple, family, { regularization: 3 }, availabilityFor([]))
    expect(selectable.ok).toBe(true)
    if (!selectable.ok) return
    expect(configurationId(selectable.configuration)).toBe(
      'blocks2-channels16-regularization3-dropout0-datasetstarter',
    )
  })

  it('carries three codes no two of which are the same', () => {
    const codes = new Set([LOCKED_CONFIGURATION, UNTRAINED_CONFIGURATION, 'knob-value-out-of-range'])
    expect(codes.size).toBe(3)
  })

  it('locks nothing when no availability is supplied', () => {
    expect(resolveSelectable(apple, family, { channels: 8 }, undefined).ok).toBe(true)
  })
})

describe('unlocking extends what can be selected and reinterprets nothing', () => {
  it('resolves the shipped defaults to the identifier they have always resolved to', () => {
    expect(configurationId(defaultConfiguration(apple, family))).toBe(
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
    )
  })

  it('carries every knob in the identifier, each locked one at its declared default', () => {
    const opened = resolveSelectable(apple, family, {}, availabilityFor([]))
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    expect(opened.configuration.values.map(([id]) => id)).toEqual(family.knobs.map((knob) => knob.id))
    expect(configurationId(opened.configuration)).toBe(
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
    )
  })

  it('adds identifiers when an item is bought and changes none of the old ones', () => {
    const before = selectable([])
    const after = selectable(['wider-blocks'])

    expect(after.length).toBeGreaterThan(before.length)
    for (const id of before) expect(after, `${id} stopped being selectable`).toContain(id)
  })

  it('leaves what an identifier means exactly where it was', () => {
    // The identifier is composed by `configurationId` from the declaration's knob order,
    // and ownership reaches neither. Resolving the same values twice, under two different
    // ownerships, must give the same string.
    const values = { channels: 16, blocks: 2, regularization: 1, dropout: 0 }
    const owned = resolveConfiguration(apple, family, values)
    expect(owned.ok).toBe(true)
    if (!owned.ok) return

    for (const ownership of [[], ['wider-blocks'], ['wider-blocks', 'deeper-blocks']]) {
      const again = resolveSelectable(apple, family, values, availabilityFor(ownership))
      expect(again.ok).toBe(true)
      if (!again.ok) continue
      expect(configurationId(again.configuration)).toBe(configurationId(owned.configuration))
    }
  })

  it('leaves `resolveConfiguration` unaware of ownership', () => {
    // Same call, same answer, whatever the catalog says: the locked check is a second
    // pass over what this produced, never a change to it.
    expect(resolveConfiguration(apple, family, { channels: 8 })).toEqual(
      resolveConfiguration(apple, family, { channels: 8 }),
    )
    expect(resolveConfiguration(apple, family, { channels: 8 }).ok).toBe(true)
  })
})

describe('an unowned dataset tier refuses as locked, naming the item that opens it', () => {
  const shipped = soundCatalog(shippedCatalogJson(), shippedFarm())

  function shippedAvailability(owned: readonly string[] = []) {
    return taskAvailability(computeAvailability(shipped, tasks, owned), apple.id)
  }

  it('refuses selecting a tier nothing has been bought for, as locked and not as untrained', () => {
    const refused = resolveSelectable(apple, family, { dataset: 'bulk' }, shippedAvailability())

    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0]?.code).toBe(LOCKED_CONFIGURATION)
    expect(refused.issues[0]?.field).toBe('dataset')
    // The item's own label, so the workshop states no condition of its own — and no new
    // kind of refusal was needed for a tier.
    expect(refused.issues[0]?.message).toContain('The job lot')
    expect(refused.issues[0]?.code).not.toBe(UNTRAINED_CONFIGURATION)
  })

  it('lets the tier that came with the robot through, at the default it opens on', () => {
    const opened = resolveSelectable(apple, family, {}, shippedAvailability())
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(configurationId(opened.configuration).endsWith('-datasetstarter')).toBe(true)
  })

  it('lets it through once the item is owned, to be refused as untrained instead', () => {
    const owned = resolveSelectable(
      apple,
      family,
      { dataset: 'bulk' },
      shippedAvailability(['bulk-photos']),
    )
    // Locked no longer applies; whether a model exists for it is the artifact's business.
    expect(owned.ok).toBe(true)
  })
})

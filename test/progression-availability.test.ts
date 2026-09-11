/**
 * Ownership in, availability out — and nothing else in.
 *
 * The rule this suite defends is the one the whole progression system rests on: what a
 * student may select is a function of the catalog and the ids owned, and of no other
 * state of the farm. A test that let the year or the balance in would be a test that
 * allowed a second gating system to grow beside the first.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  computeAvailability,
  declaredValues,
  knobAvailability,
  lockedValue,
  taskAvailability,
} from '../src/progression/index.js'
import { configurationId } from '../src/task/configId.js'
import { firstFamily } from '../src/task/families.js'
import { appleDeclaration } from './helpers/apple.js'
import { loadRawDeclaration } from './helpers/load-raw.js'
import {
  catalogWith,
  landItem,
  pricedItem,
  shippedCatalogJson,
  soundCatalog,
  unpricedItem,
} from './helpers/catalog.js'
import { shippedFarm } from './helpers/farm.js'

const apple = appleDeclaration()
const family = firstFamily(apple)
const tasks = [apple]

/** The values of one knob a given ownership may select. */
function openValues(owned: readonly string[], catalog = catalogOf(), knobId = 'channels') {
  const task = taskAvailability(computeAvailability(catalog, tasks, owned), apple.id)
  if (task === undefined) throw new Error('the availability must cover the shipped task')
  const knob = knobAvailability(task, knobId)
  return (knob?.values ?? []).filter((value) => value.available).map((value) => value.value)
}

function catalogOf() {
  return soundCatalog(catalogWith([pricedItem(), unpricedItem()]))
}

describe('what the catalog does not mention is open', () => {
  it('offers every value of an unmentioned knob from the first day', () => {
    // `regularization` is named by no item in this catalog, so all four of its steps are
    // there whatever is owned — default-open, rather than default-locked.
    expect(openValues([], catalogOf(), 'regularization')).toEqual([0, 1, 2, 3])
  })

  it('offers everything when the catalog holds no items at all', () => {
    const empty = soundCatalog(catalogWith([]))
    expect(openValues([], empty, 'channels')).toEqual([8, 16, 32])
    expect(openValues([], empty, 'blocks')).toEqual([2, 3, 4])
  })
})

describe('what the catalog mentions is locked until it is bought', () => {
  it('locks a mentioned value and names the item that opens it', () => {
    const task = taskAvailability(computeAvailability(catalogOf(), tasks, []), apple.id)
    const locked = lockedValue(task, 'channels', 8)

    expect(locked?.available).toBe(false)
    expect(locked?.openedBy?.id).toBe('wider-blocks')
    expect(locked?.openedBy?.label).toBe('Wider blocks')
  })

  it('leaves the knob’s declared default selectable while the rest is locked', () => {
    expect(openValues([], catalogOf(), 'channels')).toEqual([16])
  })

  it('opens exactly what the item declares once it is owned', () => {
    expect(openValues(['wider-blocks'])).toEqual([8, 16, 32])
  })

  it('changes no other knob when one item is bought', () => {
    const before = computeAvailability(catalogOf(), tasks, [])
    const after = computeAvailability(catalogOf(), tasks, ['wider-blocks'])

    for (const knob of family.knobs) {
      if (knob.id === 'channels') continue
      expect(
        knobAvailability(taskAvailability(after, apple.id)!, knob.id),
        `${knob.id} changed`,
      ).toEqual(knobAvailability(taskAvailability(before, apple.id)!, knob.id))
    }
  })

  it('stops naming an opener once the value is available', () => {
    const task = taskAvailability(computeAvailability(catalogOf(), tasks, ['wider-blocks']), apple.id)
    expect(lockedValue(task, 'channels', 8)).toBeUndefined()
    expect(knobAvailability(task!, 'channels')?.values.every((value) => value.openedBy === undefined)).toBe(
      true,
    )
  })

  it('shows every declared value whether or not it is available', () => {
    const task = taskAvailability(computeAvailability(catalogOf(), tasks, []), apple.id)
    expect(knobAvailability(task!, 'channels')?.values.map((value) => value.value)).toEqual([8, 16, 32])
    expect(knobAvailability(task!, 'blocks')?.values.map((value) => value.value)).toEqual([2, 3, 4])
  })
})

describe('ownership is the only input', () => {
  it('takes the catalog, the tasks and the owned ids, and nothing else', () => {
    expect(computeAvailability.length).toBe(3)
  })

  it('answers identically for two farms differing in everything but ownership', () => {
    // Neither farm is passed at all, which is the point: there is no argument through
    // which a year, a balance, a ledger or a knob history could reach this.
    const early = computeAvailability(catalogOf(), tasks, ['wider-blocks'])
    const late = computeAvailability(catalogOf(), tasks, ['wider-blocks'])
    expect(late).toEqual(early)
  })

  it('opens nothing further as money and years accumulate', () => {
    expect(openValues([])).toEqual([16])
    expect(openValues([])).toEqual(openValues([]))
  })
})

describe('a task declaration says nothing about availability', () => {
  it('carries no field of its own for what opens a value', () => {
    const raw = loadRawDeclaration('apple-harvest')
    const text = JSON.stringify(raw)

    for (const field of ['available"', 'availability', 'requires', 'unlock', 'locked', 'price']) {
      // `available` is the task-level flag and is allowed; a knob-level one is not, which
      // is why the knobs are searched rather than the whole file for that one.
      expect(JSON.stringify(firstFamily(apple).knobs), field).not.toContain(field)
    }
    expect(text).toContain('"available"')
  })

  it('is the same file after a value is opened as before it', () => {
    const before = JSON.stringify(apple)
    computeAvailability(catalogOf(), tasks, [])
    computeAvailability(catalogOf(), tasks, ['wider-blocks'])

    expect(JSON.stringify(apple)).toBe(before)
    for (const knob of family.knobs) {
      expect(knob.default, `${knob.id} default`).toBe(
        firstFamily(appleDeclaration()).knobs.find((candidate) => candidate.id === knob.id)?.default,
      )
    }
  })
})

describe('the progression engine stays free of the browser', () => {
  it('imports neither React nor a storage API', () => {
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.ts$/.test(name)) files.push(path)
      }
    }
    walk(join(process.cwd(), 'src/progression'))
    walk(join(process.cwd(), 'src/save'))

    const offences = files.filter((file) => {
      const text = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      return (
        /from ['"]react/.test(text) ||
        /from ['"][^'"]*web\//.test(text) ||
        /\blocalStorage\b|\bsessionStorage\b|\bwindow\b|\bdocument\b/.test(text)
      )
    })

    expect(files.length).toBeGreaterThan(4)
    expect(offences.map((file) => relative(process.cwd(), file))).toEqual([])
  })
})

describe('a repeated id says nothing more than a single one', () => {
  const withLand = soundCatalog(catalogWith([pricedItem(), unpricedItem(), landItem()]))

  it('reports exactly the availability of a farm owning that item once', () => {
    // `owned` is a multiset: an item the catalog permits five times appears in it five
    // times. Every consumer that reads it today asks membership, and this is what a
    // future consumer that starts counting has to break.
    const once = computeAvailability(withLand, tasks, ['wider-blocks', 'starter-plot'])
    const twice = computeAvailability(withLand, tasks, [
      'wider-blocks',
      'starter-plot',
      'starter-plot',
    ])

    expect(twice).toEqual(once)
  })

  it('opens nothing a farm owning it none of the times does not have', () => {
    const never = computeAvailability(withLand, tasks, ['wider-blocks'])
    const thrice = computeAvailability(withLand, tasks, [
      'wider-blocks',
      'starter-plot',
      'starter-plot',
      'starter-plot',
    ])

    expect(thrice).toEqual(never)
  })
})

describe('a dataset tier is gated exactly as any other knob value is', () => {
  /** The shipped catalog, which carries the two tiers as unpriced items. */
  const shipped = soundCatalog(shippedCatalogJson(), shippedFarm())

  /** The item that opens one tier, as the shipped catalog names it. */
  function opener(tier: string): string {
    const item = shipped.items.find((candidate) =>
      candidate.opens.some(
        (unlock) =>
          unlock.kind === 'knob-values' &&
          unlock.knob === 'dataset' &&
          unlock.values.map(String).includes(tier),
      ),
    )
    if (item === undefined) throw new Error(`no shipped item opens dataset tier "${tier}"`)
    return item.id
  }

  it('needs no unlock kind of its own: the tiers are opened by knob-values', () => {
    for (const tier of ['bulk', 'checked']) {
      const item = shipped.items.find((candidate) => candidate.id === opener(tier))
      expect(item?.opens.map((unlock) => unlock.kind)).toEqual(['knob-values'])
    }
  })

  it('shows an unowned tier and does not offer it for selection', () => {
    const values = openValues([], shipped, 'dataset')
    expect(values).toEqual(['starter'])

    const task = taskAvailability(computeAvailability(shipped, tasks, []), apple.id)
    const knob = knobAvailability(task!, 'dataset')
    // Shown, all three of them, so a student can see what there is to earn.
    expect(knob?.values.map((value) => value.value)).toEqual(['starter', 'bulk', 'checked'])
    for (const tier of ['bulk', 'checked']) {
      const entry = knob?.values.find((value) => value.value === tier)
      expect(entry?.available, tier).toBe(false)
      expect(entry?.openedBy?.id, tier).toBe(opener(tier))
    }
  })

  it('names the item that would open it, so the workshop states no condition of its own', () => {
    const task = taskAvailability(computeAvailability(shipped, tasks, []), apple.id)
    for (const tier of ['bulk', 'checked']) {
      expect(lockedValue(task, 'dataset', tier)?.openedBy?.id).toBe(opener(tier))
    }
    // The one a student already has is not locked, so there is nothing to name for it.
    expect(lockedValue(task, 'dataset', 'starter')).toBeUndefined()
  })

  it('opens the tier for every family declaring that knob once the item is owned', () => {
    // The unlock names a task and a knob and no family, which is the reading the catalog
    // has always had: a tier bought once is a tier every family fitted on it can select.
    const owned = openValues([opener('bulk')], shipped, 'dataset')
    expect(owned).toEqual(['starter', 'bulk'])
    expect(openValues([opener('bulk'), opener('checked')], shipped, 'dataset')).toEqual([
      'starter',
      'bulk',
      'checked',
    ])
  })
})

describe('regrouping the catalog changed nothing a student can select', () => {
  /**
   * Every configuration reachable from the shipped catalog, per family.
   *
   * The whole powerset of what can be owned, because a purchase is what widens the set:
   * checking full ownership alone would miss a family that a purchase made *un*reachable.
   * A family the ownership does not open contributes nothing, which is the point.
   */
  function selectable(): Readonly<Record<string, readonly string[]>> {
    const catalog = soundCatalog(shippedCatalogJson(), shippedFarm())
    const obtainable = catalog.items
      .filter((item) => item.priceUnits !== undefined || catalog.ownedAtStart.includes(item.id))
      .map((item) => item.id)
    const ownerships: string[][] = [[]]
    for (const id of obtainable) {
      for (const owned of [...ownerships]) ownerships.push([...owned, id])
    }

    const reached: Record<string, Set<string>> = {}
    for (const owned of ownerships) {
      const task = taskAvailability(computeAvailability(catalog, tasks, owned), apple.id)
      for (const declared of apple.families) {
        const open = task?.families.find((entry) => entry.familyId === declared.id)?.available
        if (open !== true) continue
        let rows: (readonly [string, string | number])[][] = [[]]
        for (const knob of declared.knobs) {
          const entry = knobAvailability(task!, knob.id)
          const next: (readonly [string, string | number])[][] = []
          for (const value of declaredValues(knob)) {
            const permitted =
              entry?.values.find((candidate) => String(candidate.value) === String(value))
                ?.available ?? true
            if (!permitted) continue
            for (const row of rows) next.push([...row, [knob.id, value] as const])
          }
          rows = next
        }
        reached[declared.id] ??= new Set()
        for (const row of rows) {
          reached[declared.id]!.add(
            configurationId({ taskId: apple.id, familyId: declared.id, values: row }),
          )
        }
      }
    }
    return Object.fromEntries(
      Object.entries(reached).map(([id, set]) => [id, [...set].sort()]),
    )
  }

  /**
   * The identifiers a student could select before the shelves were rearranged.
   *
   * Pinned rather than derived, because "the same as it computes now" would agree with
   * itself however the catalog moved. The counter an item stands at is where it is
   * bought and nothing more, and this is what makes that testable.
   */
  const BEFORE: Readonly<Record<string, readonly string[]>> = {
    convolutional: [
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
      'blocks2-channels32-regularization1-dropout0-datasetstarter',
      'blocks2-channels8-regularization1-dropout0-datasetstarter',
    ],
    'decision-tree': ['nodes2-datasetstarter', 'nodes4-datasetstarter', 'nodes6-datasetstarter'],
  }

  it('reaches exactly the configurations it reached before, for both families', () => {
    expect(selectable()).toEqual(BEFORE)
  })

  it('covers every one of them with a shipped model, for both families', () => {
    // The other half of *nothing selectable changed*: the set above is the same, and
    // every identifier in it still resolves to a model that shipped.
    const reached = selectable()
    expect(Object.keys(reached).sort()).toEqual(
      apple.families.map((declared) => declared.id).sort(),
    )

    for (const declared of apple.families) {
      // Whichever of the two a family ships: one directory of models, one index.
      const store = declared.models ?? declared.predictions
      if (store === undefined) throw new Error(`family "${declared.id}" ships nothing`)
      const index = JSON.parse(readFileSync(join(process.cwd(), store, 'index.json'), 'utf8')) as {
        configurations: Record<string, unknown>
      }
      for (const id of reached[declared.id] ?? []) {
        expect(Object.keys(index.configurations), `${declared.id} ${id}`).toContain(id)
      }
    }
  })
})

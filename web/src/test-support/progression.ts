/**
 * Catalogs, availability and storage for the screen tests.
 *
 * The shipped catalog is read from disk and validated, for the same reason the shipped
 * declaration is. The built ones are for what it deliberately cannot show: it has nothing
 * for sale, so a market with a buyable row, an unaffordable one and an owned one has to
 * be declared here.
 *
 * The storage is an object in memory rather than jsdom's `localStorage`, so one test's
 * farm cannot be restored into the next one's — which is exactly the bug the save is
 * meant to have, and exactly the confusion it would cause in a suite.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FarmDeclaration } from '../../../src/economy/index.js'
import type { Catalog } from '../../../src/progression/index.js'
import { validateCatalog } from '../../../src/progression/index.js'
import type { LoadedTask } from '../data/load.js'
import { SHIPPED_CATALOG, sourcePathFor } from '../data/paths.js'
import type { SaveStorage } from '../data/save.js'
import { clearStoredSave, readStoredSave, writeStoredSave } from '../data/save.js'
import { farmDeclaration } from './farm.js'

type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly { code: string; message: string; field?: string }[] }

/** Validates a candidate catalog, failing loudly when a test meant it to be sound. */
export function soundCatalog(
  input: unknown,
  farm: FarmDeclaration = farmDeclaration(),
): Catalog {
  const validated = validateCatalog(input, farm)
  if (!validated.ok) {
    throw new Error(
      `the catalog was meant to validate: ${validated.issues.map((issue) => issue.message).join(' ')}`,
    )
  }
  return validated.catalog
}

/** The shipped catalog, validated against the shipped farm. */
export function shippedCatalog(): Catalog {
  const source = sourcePathFor(SHIPPED_CATALOG)
  if (source === undefined) throw new Error(`no mount serves ${SHIPPED_CATALOG}`)
  return soundCatalog(JSON.parse(readFileSync(join(process.cwd(), source), 'utf8')) as unknown)
}

/** A catalog with nothing in it — a playable farm with everything open. */
export function emptyCatalog(): Catalog {
  return soundCatalog({ schemaVersion: '1.0.0', groups: [], ownedAtStart: [], items: [] })
}

/**
 * A catalog whose rows cover all four states a market row can be in.
 *
 * Its ids, labels and groups share nothing with the shipped catalog, which is what makes
 * a test over it a test of the screen rather than of the lesson.
 */
export function shopCatalog(farm: FarmDeclaration = farmDeclaration()): Catalog {
  return soundCatalog(
    {
      schemaVersion: '1.0.0',
      groups: [
        { id: 'planting', label: 'Planting' },
        { id: 'sheds', label: 'Sheds' },
        { id: 'quiet', label: 'Quiet corner' },
      ],
      ownedAtStart: ['starter-plot'],
      items: [
        {
          id: 'starter-plot',
          group: 'planting',
          label: 'Starter plot',
          copy: 'The ground you began with.',
          price: 0,
          opens: [{ kind: 'knob-values', task: 'skin-screening', knob: 'sensitivity', values: ['high'] }],
        },
        {
          id: 'second-row',
          group: 'planting',
          label: 'Second row',
          copy: 'One more row along the fence.',
          price: 10,
          opens: [{ kind: 'knob-values', task: 'skin-screening-drawn', knob: 'stack', values: [3] }],
        },
        {
          id: 'stone-shed',
          group: 'sheds',
          label: 'Stone shed',
          copy: 'Somewhere dry to keep the crates.',
          price: 999999,
          opens: [{ kind: 'knob-values', task: 'skin-screening-drawn', knob: 'breadth', values: ['wide'] }],
        },
        {
          id: 'weather-station',
          group: 'sheds',
          label: 'Weather station',
          copy: 'It would tell you when the frost is coming.',
          notForSaleReason: 'Nobody in the valley builds these yet.',
          opens: [{ kind: 'knob-values', task: 'skin-screening-convolutional', knob: 'stages', values: [4] }],
        },
      ],
    },
    farm,
  )
}

/** A `loadShop` for the shell, standing in for the fetch. */
export function loadsCatalog(catalog: Catalog = emptyCatalog()) {
  return (_farm: FarmDeclaration, _tasks: readonly LoadedTask[]): Promise<Loaded<Catalog>> =>
    Promise.resolve({ ok: true as const, value: catalog })
}

/** A `loadShop` that refuses, for the shell's own refusal path. */
export function refusesCatalog(message: string, code = 'data-unreachable') {
  return (): Promise<Loaded<Catalog>> =>
    Promise.resolve({ ok: false as const, issues: [{ code, message }] })
}

/** Storage that keeps what it is given, for as long as the test holds it. */
export function memoryStorage(initial?: Record<string, string>): SaveStorage {
  const held = new Map<string, string>(Object.entries(initial ?? {}))
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      held.set(key, value)
    },
    removeItem: (key) => {
      held.delete(key)
    },
  }
}

/** The three save props the shell takes, over one storage a test can look inside. */
export function savesTo(storage: SaveStorage) {
  return {
    readSave: () => readStoredSave(storage),
    writeSave: (text: string) => writeStoredSave(text, storage),
    clearSave: () => clearStoredSave(storage),
  }
}

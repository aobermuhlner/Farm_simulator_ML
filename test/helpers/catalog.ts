/**
 * Catalogs for the progression tests.
 *
 * The shipped catalog is read from disk and put through the real validator, for the same
 * reason the shipped declaration is: a test that passed against a hand-typed stand-in
 * would prove nothing about the file a student is given.
 *
 * The built catalogs are for everything the shipped one deliberately cannot show. Nothing
 * in the shipped catalog is for sale, so the purchase path, the refusals and the coverage
 * check all need a catalog with prices in it.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FarmDeclaration } from '../../src/economy/index.js'
import type { Catalog } from '../../src/progression/index.js'
import { validateCatalog } from '../../src/progression/index.js'
import { SHIPPED_CATALOG, sourcePathFor } from '../../web/src/data/paths.js'

const repoRoot = process.cwd()

/** A farm to price test catalogs in. Its own currency, so nothing leans on the shipped one. */
export const testFarm: FarmDeclaration = {
  name: 'Test Farm',
  currency: 'ETB',
  precision: 2,
  openingBalance: 1000,
  openingYear: 1,
}

/** The shipped catalog file, unvalidated, as a test that reads raw shape needs it. */
export function shippedCatalogJson(): unknown {
  const source = sourcePathFor(SHIPPED_CATALOG)
  if (source === undefined) throw new Error(`no mount serves ${SHIPPED_CATALOG}`)
  return JSON.parse(readFileSync(join(repoRoot, source), 'utf8')) as unknown
}

/** Validates a candidate catalog, failing loudly when a test meant it to be sound. */
export function soundCatalog(input: unknown, farm: FarmDeclaration = testFarm): Catalog {
  const validated = validateCatalog(input, farm)
  if (!validated.ok) {
    throw new Error(
      `the catalog was meant to validate: ${validated.issues.map((issue) => issue.message).join(' ')}`,
    )
  }
  return validated.catalog
}

/** The raw shape of a catalog that validates, as the base for changing one field. */
export function catalogWith(items: readonly Record<string, unknown>[]): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    groups: [
      { id: 'models', label: 'Models' },
      { id: 'orchard', label: 'Orchard' },
    ],
    ownedAtStart: [],
    items,
  }
}

/** One priced item opening knob values, as the base for changing one field. */
export function pricedItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'wider-blocks',
    group: 'models',
    label: 'Wider blocks',
    copy: 'More patterns per block.',
    price: 100,
    opens: [{ kind: 'knob-values', task: 'apple-harvest', knob: 'channels', values: [8, 32] }],
    ...overrides,
  }
}

/** One unpriced item, which is shown and greyed rather than sold. */
export function unpricedItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'deeper-blocks',
    group: 'models',
    label: 'Deeper blocks',
    copy: 'More blocks in the stack.',
    notForSaleReason: 'Nothing has been trained for it yet.',
    opens: [{ kind: 'knob-values', task: 'apple-harvest', knob: 'blocks', values: [3, 4] }],
    ...overrides,
  }
}

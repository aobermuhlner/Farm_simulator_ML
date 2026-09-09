/**
 * The shipped farm declaration, read off disk and put through the real validator.
 *
 * Shared rather than repeated, because the figures the guards are set against — the land
 * the orchard opens with and what a unit of it bears — now live in one nested field, and
 * two copies of the reader would be two places to update when it moves.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FarmDeclaration } from '../../src/economy/index.js'
import { validateFarmDeclaration } from '../../src/economy/index.js'

/** The shipped farm, validated. Throws loudly, because every caller depends on it. */
export function shippedFarm(): FarmDeclaration {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'declarations/farm.json'), 'utf8'),
  ) as unknown
  const validated = validateFarmDeclaration(raw)
  if (!validated.ok) {
    throw new Error(`the shipped farm must validate: ${validated.issues[0]?.message}`)
  }
  return validated.declaration
}

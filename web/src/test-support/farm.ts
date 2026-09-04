/**
 * The farm declaration for screen tests.
 *
 * The shipped file, read from disk and put through the real validator — a bar test that
 * passed against a hand-typed stand-in would prove nothing about the farm students get.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FarmDeclaration } from '../../../src/economy/index.js'
import { validateFarmDeclaration } from '../../../src/economy/index.js'
import type { Loaded } from '../data/load.js'
import { SHIPPED_FARM, sourcePathFor } from '../data/paths.js'

/** The shipped farm declaration, validated. */
export function farmDeclaration(): FarmDeclaration {
  const source = sourcePathFor(SHIPPED_FARM)
  if (source === undefined) throw new Error(`no mount serves ${SHIPPED_FARM}`)
  const validated = validateFarmDeclaration(
    JSON.parse(readFileSync(join(process.cwd(), source), 'utf8')) as unknown,
  )
  if (!validated.ok) {
    throw new Error(
      `The shipped farm declaration does not validate: ${validated.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return validated.declaration
}

/** A farm loader for the shell, standing in for the fetch. */
export function loadsFarm(
  declaration: FarmDeclaration = farmDeclaration(),
): () => Promise<Loaded<FarmDeclaration>> {
  return () => Promise.resolve({ ok: true as const, value: declaration })
}

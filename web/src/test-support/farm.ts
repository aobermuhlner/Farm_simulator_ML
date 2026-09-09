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
import type { TaskDeclaration } from '../../../src/task/types.js'
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

/**
 * The shipped farm, with a share of its crop declared for every category the given tasks
 * declare.
 *
 * A farm composes its crop from what it declares, so a farm carrying a second card has to
 * say what that card's crop is made of — there is no reading of "nothing declared" that
 * is not a guess. The shipped file describes the one lesson that ships; a test farm
 * carrying a task the farm has never heard of has to describe that one too, and this is
 * the smallest honest way to do it: the shipped shares keep their proportions and the
 * unheard-of categories divide a small share evenly between them.
 */
export function farmCarrying(
  tasks: readonly TaskDeclaration[],
  declaration: FarmDeclaration = farmDeclaration(),
): FarmDeclaration {
  const declared = declaration.cropComposition
  const missing = [
    ...new Set(
      tasks.flatMap((task) =>
        task.categories.map((category) => category.id).filter((id) => declared[id] === undefined),
      ),
    ),
  ]
  if (missing.length === 0) return declaration

  // A fifth of the crop between them, so the shipped shares stay recognisably themselves.
  const share = 0.2 / missing.length
  const composition: Record<string, number> = {}
  for (const [category, value] of Object.entries(declared)) composition[category] = value * 0.8
  for (const category of missing) composition[category] = share

  return { ...declaration, cropComposition: composition }
}

/**
 * The shipped farm, declared to bear exactly `pieces` of crop.
 *
 * A screen test asks for a crop of a size, not for an amount of land: sixty is what one
 * pair of hands reaches and four hundred is what a projection is checked against, and
 * neither is a whole number of the shipped trees. So the conversion happens here, at the
 * boundary — the farm holds `pieces` units of land each bearing one piece — and the crop
 * the farm bears is exactly the size the caller asked for, with no rounding to argue
 * about. Everything else about the shipped orchard, its own name and its unit's, is kept.
 */
export function farmBearing(
  pieces: number,
  declaration: FarmDeclaration = farmDeclaration(),
): FarmDeclaration {
  return {
    ...declaration,
    orchard: { ...declaration.orchard, opening: pieces, piecesPerUnit: 1 },
  }
}

/** A farm loader for the shell, standing in for the fetch. */
export function loadsFarm(
  declaration: FarmDeclaration = farmDeclaration(),
): () => Promise<Loaded<FarmDeclaration>> {
  return () => Promise.resolve({ ok: true as const, value: declaration })
}

/**
 * The authored leaf-labelling tutorial, read from the file it is declared in.
 *
 * It lives at `declarations/tutorials/label-the-leaves.json` rather than inside a family in
 * `declarations/apple-harvest.json`, because the family it teaches — the fitted tree — is
 * not built yet. `openspec/changes/fitted-tree-tutorial/tasks.md` §6 records the
 * arrangement: the puzzle, its copy and its measured values are authored, committed and
 * exercised end to end here, and the change that ships the family moves this block onto it,
 * which is the point at which the gate goes live for that family and for nothing else.
 *
 * Read from disk rather than imported, for the reason every other declaration is: the
 * runtime validator is what decides whether declared data is sound, and a block that only
 * type-checks has not been checked.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TutorialDeclaration } from '../../src/task/types.js'
import type { LabelTheLeavesPuzzle } from '../../src/tutorials/index.js'

/** Where the authored block is committed. */
export const LEAF_TUTORIAL_PATH = 'declarations/tutorials/label-the-leaves.json'

/** The authored block, as declared. */
export function leafTutorial(): TutorialDeclaration {
  return JSON.parse(
    readFileSync(join(process.cwd(), LEAF_TUTORIAL_PATH), 'utf8'),
  ) as TutorialDeclaration
}

/** Just its puzzle, for the engine functions that take one. */
export function leafPuzzle(): LabelTheLeavesPuzzle {
  return leafTutorial().puzzle as LabelTheLeavesPuzzle
}

/**
 * The authored leaf-labelling tutorial, read from the family that declares it.
 *
 * It used to live on its own at `declarations/tutorials/label-the-leaves.json`, because
 * the family it teaches — the fitted tree — did not exist yet, and a puzzle gating
 * nothing had nowhere to sit. `fitted-tree` ships that family, so the block moved onto
 * it: `openspec/changes/fitted-tree-tutorial/tasks.md` §6 recorded the arrangement and
 * this is the move it planned. There is one copy of the puzzle and it is the one the
 * game gates on, which is what keeps the exercised puzzle and the played puzzle the same
 * puzzle.
 *
 * Read off the shipped declaration rather than imported as a literal, for the reason
 * every other declaration is: the runtime validator is what decides whether declared
 * data is sound, and a block that only type-checks has not been checked.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TutorialDeclaration } from '../../src/task/types.js'
import type { LabelTheLeavesPuzzle } from '../../src/tutorials/index.js'

/** Which declaration the block is committed in, and under which family. */
export const LEAF_TUTORIAL_PATH = 'declarations/apple-harvest.json'
export const LEAF_TUTORIAL_FAMILY = 'decision-tree'

/**
 * The authored block, as the family declares it.
 *
 * Read off the raw file rather than through a validated declaration, because the shell
 * tests that import this run under jsdom and a helper that only worked in one of the two
 * environments would push the puzzle back into a copy of its own.
 */
export function leafTutorial(): TutorialDeclaration {
  const declaration = JSON.parse(
    readFileSync(join(process.cwd(), LEAF_TUTORIAL_PATH), 'utf8'),
  ) as { readonly families: readonly { readonly id: string; readonly tutorial?: TutorialDeclaration }[] }
  const tutorial = declaration.families.find(
    (candidate) => candidate.id === LEAF_TUTORIAL_FAMILY,
  )?.tutorial
  if (tutorial === undefined) {
    throw new Error(`family "${LEAF_TUTORIAL_FAMILY}" declares no tutorial`)
  }
  return tutorial
}

/** Just its puzzle, for the engine functions that take one. */
export function leafPuzzle(): LabelTheLeavesPuzzle {
  return leafTutorial().puzzle as LabelTheLeavesPuzzle
}

/**
 * Which training images a model is fitted on, and which are held back to measure it.
 *
 * `openspec/changes/prediction-artifacts/design.md` — the assignment runs *after*
 * sampling, from `ROLE_SEED`'s own generator, and never touches the stream the images
 * were drawn from. That is what makes adding roles additive: the same seed still
 * produces the same 1200 apples under the same ids, and a prediction artifact trained
 * against those ids stays interpretable.
 *
 * Stratified per category, because a validation loss measured over images whose
 * categories the fitted set does not cover measures nothing the training did.
 *
 * The roles are not a split. Both roles stay inside the training split, all 200 images
 * stay browsable, and `src/pool/index.ts` still knows exactly two splits.
 */

import { HELD_OUT_COUNTS, ROLE_SEED, type PoolCategory, type TrainingRole } from './params.js'
import { createRandom } from './random.js'
import type { SampledImage } from './sample.js'

/** Role per training image id. Evaluation-pool images are absent, not `fitted`. */
export type RoleAssignment = Readonly<Record<string, TrainingRole>>

/**
 * Categories in a fixed order, so the draw does not depend on the order a literal
 * happens to be written in. Sorted rather than declared: a category renamed or added
 * moves the assignment, which is a regeneration decision, not a silent one.
 */
function categoriesInOrder(): readonly PoolCategory[] {
  return (Object.keys(HELD_OUT_COUNTS) as PoolCategory[]).slice().sort()
}

/**
 * Assigns every training image a role, holding out `HELD_OUT_COUNTS` of each category.
 *
 * Ids are taken in the order they arrive — manifest order — and shuffled per category,
 * so the assignment is a pure function of the seed and the sampled ids.
 */
export function assignRoles(
  images: readonly SampledImage[],
  seed: number = ROLE_SEED,
): RoleAssignment {
  const random = createRandom(seed)
  const roles: Record<string, TrainingRole> = {}

  for (const category of categoriesInOrder()) {
    const ids = images
      .filter((image) => image.split === 'training' && image.category === category)
      .map((image) => image.id)

    const heldOut = HELD_OUT_COUNTS[category]
    if (ids.length <= heldOut) {
      throw new Error(
        `cannot hold out ${heldOut} of category "${category}": the training split has ${ids.length}`,
      )
    }

    const shuffled = random.shuffle(ids)
    shuffled.forEach((id, index) => {
      roles[id] = index < heldOut ? 'heldOut' : 'fitted'
    })
  }

  return roles
}

/** How many images each role holds, for the counts the manifest declares. */
export function roleCounts(roles: RoleAssignment): Readonly<Record<TrainingRole, number>> {
  let fitted = 0
  let heldOut = 0
  for (const role of Object.values(roles)) {
    if (role === 'fitted') fitted += 1
    else heldOut += 1
  }
  return { fitted, heldOut }
}

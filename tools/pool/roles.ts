/**
 * Which training images a model is fitted on, and which are held back to measure it.
 *
 * `openspec/changes/held-out-generalization/design.md` — the role is decided when an
 * image is sampled, not assigned afterwards, because the role determines which
 * distribution the image is drawn from: the fitted 160 come from the narrow authored
 * band, the held-out 40 from the evaluation pool's populations. There is therefore no
 * assignment step here to disagree with `sample.ts` about what a held-out apple looks
 * like — this file only reads what the sampler decided and checks it.
 *
 * The cost, accepted deliberately: roles are no longer additive over an existing pool.
 * Regenerating from the same seed and parameters reproduces the same roles and the same
 * apples, but moving what a role draws from produces a *new* pool, which is why `SEED`
 * moves with it and stale prediction artifacts refuse rather than resolve.
 *
 * The roles are not a split. Both roles stay inside the training split, all 200 images
 * stay browsable, and `src/pool/index.ts` still knows exactly two splits.
 */

import { insideFittedRedBand } from './bands.js'
import { HELD_OUT_COUNTS, type PoolCategory, type TrainingRole } from './params.js'
import type { SampledImage } from './sample.js'

/** Role per training image id. Evaluation-pool images are absent, not `fitted`. */
export type RoleAssignment = Readonly<Record<string, TrainingRole>>

/**
 * The roles the sampler decided, keyed by image id.
 *
 * Refuses a training image the sampler left without one: a manifest declaring no role for
 * a training image is refused at load, and finding that out at generation time names the
 * cause instead of the symptom.
 */
export function rolesOf(images: readonly SampledImage[]): RoleAssignment {
  const roles: Record<string, TrainingRole> = {}
  for (const image of images) {
    if (image.split !== 'training') continue
    if (image.role === undefined) {
      throw new Error(`training image "${image.id}" was sampled without a role`)
    }
    roles[image.id] = image.role
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

/**
 * Why the held-out images cannot show a generalization gap, or `undefined` if they can.
 *
 * `specs/image-pool/spec.md` — a held-out set confined to the band the fitted images
 * occupy is the defect this whole change exists to remove: it measures the distribution
 * the model was fitted on, reads 100%, and tells a student their model is sound right
 * before the robot picks wormy apples. Checked here rather than trusted, because the
 * failure is silent everywhere downstream — the numbers still look like numbers.
 *
 * "Inside the fitted band" is read per category as the property that distinguishes that
 * category's harvest populations: reds by the band itself, wormy apples by the worm
 * visibility the fitted worms never go below. Green is drawn from one population in both
 * splits and has no gap to spend, so it is not checked.
 */
export function heldOutBandDefect(images: readonly SampledImage[]): string | undefined {
  const training = images.filter((image) => image.split === 'training')
  const of = (role: TrainingRole, category: PoolCategory): readonly SampledImage[] =>
    training.filter((image) => image.role === role && image.category === category)

  const heldRed = of('heldOut', 'red')
  if (heldRed.length > 0 && heldRed.every((image) => insideFittedRedBand(image.attributes))) {
    return `every held-out image of category "red" falls inside the fitted band, so held-out accuracy cannot measure generalization`
  }

  const fittedWorms = of('fitted', 'wormy')
  const heldWorms = of('heldOut', 'wormy')
  if (fittedWorms.length > 0 && heldWorms.length > 0) {
    const faintestFitted = Math.min(
      ...fittedWorms.map((image) => image.attributes.wormVisibility),
    )
    const subtler = heldWorms.filter(
      (image) => image.attributes.wormVisibility < faintestFitted,
    )
    if (subtler.length === 0) {
      return `every held-out image of category "wormy" is at least as obvious as the fitted worms, so held-out accuracy cannot measure generalization`
    }
  }

  return undefined
}

/**
 * Refuses a sample whose roles cannot carry the lesson.
 *
 * Called by the manifest builder, so a pool that would ship a meaningless held-out slice
 * fails the generator run rather than reaching students as a curve that says 100%.
 */
export function assertRolesCanShowTheGap(images: readonly SampledImage[]): void {
  const roles = rolesOf(images)
  for (const [category, held] of Object.entries(HELD_OUT_COUNTS)) {
    const present = images.filter(
      (image) =>
        image.split === 'training' &&
        image.category === (category as PoolCategory) &&
        roles[image.id] === 'heldOut',
    ).length
    if (present !== held) {
      throw new Error(
        `category "${category}" holds out ${present} images, but ${held} are declared`,
      )
    }
  }

  const defect = heldOutBandDefect(images)
  if (defect !== undefined) throw new Error(defect)
}

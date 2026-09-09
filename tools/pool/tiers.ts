/**
 * Which dataset tier each training image enters at, and what each tier calls it.
 *
 * `specs/dataset-tiers/spec.md` — a tier is a nested portion of the training split, so
 * membership is declared once as the smallest tier that holds an image and every larger
 * tier holds it by construction. That is the only shape in which "buying photos adds to
 * the set a student holds and removes nothing from it" is true by encoding rather than by
 * a check somebody has to remember to run.
 *
 * Labels do not nest. A tier may file an image under a category other than its true one,
 * and a larger, checked tier may correct what a hurried one filed wrongly — which is why
 * a label is per tier and the manifest's `category` stays the only ground truth.
 *
 * Assignment is one stratified order over the training split, with each tier taking a
 * prefix of it. A prefix is what makes nesting and the declared sizes structural rather
 * than arithmetic a rounding rule could get wrong: a tier holds exactly its declared
 * count, and every smaller tier holds a prefix of that prefix.
 *
 * The order interleaves the (category, role) groups by relative position rather than
 * concatenating them, so any prefix carries each group in roughly its share of the split.
 * A flat shuffle would leave whether a small tier holds a held-out green apple to the
 * seed, and `specs/image-pool/spec.md` requires every tier to have both roles in every
 * category structurally. `assertTiersAreFittedAndValidated` then refuses the case the
 * interleaving cannot reach — a tier too small to receive one image of some group.
 */

import {
  DATASET_TIERS,
  SEED,
  SPLIT_SIZES,
  TRAINING_ROLES,
  type DatasetTier,
  type PoolCategory,
} from './params.js'
import { createRandom } from './random.js'
import type { SampledImage } from './sample.js'

/** The smallest tier that holds each training image, keyed by image id. */
export type TierAssignment = Readonly<Record<string, string>>

/** What each tier holding one image files it under, keyed by tier id. */
export type TierLabels = Readonly<Record<string, PoolCategory>>

/** The tiers that hold an image entering at `entryTier`: that one and every larger one. */
export function tiersHolding(
  entryTier: string,
  tiers: readonly DatasetTier[] = DATASET_TIERS,
): readonly string[] {
  const entry = tiers.findIndex((tier) => tier.id === entryTier)
  if (entry === -1) throw new Error(`no dataset tier named "${entryTier}"`)
  return tiers.slice(entry).map((tier) => tier.id)
}

/** Every training image a tier holds: the ones entering at it, and at every smaller tier. */
export function imagesHeldBy(
  tierId: string,
  assignment: TierAssignment,
  tiers: readonly DatasetTier[] = DATASET_TIERS,
): readonly string[] {
  const upTo = tiers.findIndex((tier) => tier.id === tierId)
  if (upTo === -1) throw new Error(`no dataset tier named "${tierId}"`)
  const entering = new Set(tiers.slice(0, upTo + 1).map((tier) => tier.id))
  return Object.keys(assignment)
    .filter((id) => entering.has(assignment[id] as string))
    .sort()
}

/** The (category, role) group one training image belongs to, as one key. */
function groupKey(image: SampledImage): string {
  return `${image.category}/${String(image.role)}`
}

/**
 * The entry tier of every training image, derived from the pool seed.
 *
 * Evaluation-pool images are absent rather than assigned a tier: a tier is a portion of
 * the training split and a model fitted on the harvest cannot show the gap the splits
 * exist to teach, so the manifest has nothing to write for them.
 *
 * The stream is a fresh generator over the same seed rather than the sampler's, so that
 * the tiers are a pure function of the seed without the assignment order depending on how
 * many values the sampler happened to draw.
 */
export function tiersOf(
  images: readonly SampledImage[],
  tiers: readonly DatasetTier[] = DATASET_TIERS,
  seed: number = SEED,
): TierAssignment {
  const largest = tiers[tiers.length - 1]
  if (largest === undefined) throw new Error('no dataset tier is declared')

  const random = createRandom(seed)
  const groups = new Map<string, string[]>()
  for (const image of images) {
    if (image.split !== 'training') continue
    if (image.role === undefined) {
      throw new Error(`training image "${image.id}" was sampled without a role`)
    }
    const key = groupKey(image)
    const group = groups.get(key) ?? []
    group.push(image.id)
    groups.set(key, group)
  }

  // One stratified order over the whole training split, and each tier takes a prefix of
  // it. A prefix is what makes nesting and the declared sizes structural rather than
  // arithmetic a rounding rule could get wrong: tier k holds exactly its declared count,
  // and every smaller tier holds a prefix of that prefix.
  //
  // The order interleaves the groups by relative position rather than concatenating them,
  // so any prefix carries each group in roughly its share of the split — which is what
  // leaves a small tier with both roles in every category instead of 50 fitted reds.
  const ordered: { readonly id: string; readonly key: number; readonly group: string }[] = []
  // Groups are walked in sorted key order so the draw does not depend on the order the
  // sampler happened to emit its populations in.
  for (const key of [...groups.keys()].sort()) {
    const members = random.shuffle(groups.get(key) as string[])
    members.forEach((id, index) => {
      ordered.push({ id, key: (index + 0.5) / members.length, group: key })
    })
  }
  ordered.sort((a, b) => a.key - b.key || (a.group < b.group ? -1 : a.group > b.group ? 1 : 0))

  const assignment: Record<string, string> = {}
  let taken = 0
  for (const tier of tiers) {
    for (let i = taken; i < Math.min(tier.holds, ordered.length); i += 1) {
      assignment[(ordered[i] as { id: string }).id] = tier.id
    }
    taken = Math.max(taken, Math.min(tier.holds, ordered.length))
  }
  // Anything the declared tiers do not reach belongs to the largest of them, so that no
  // training image is left without an entry tier while a ladder is being authored.
  for (let i = taken; i < ordered.length; i += 1) {
    assignment[(ordered[i] as { id: string }).id] = largest.id
  }

  return assignment
}

/**
 * What each tier holding one image files it under.
 *
 * Every tier files every image correctly today, because `DATASET_TIERS` authors no
 * mislabels — the noise arrives with the images the larger tiers need, and
 * `dataset-tiers`' design records why the mechanism lands first: fitting already reads a
 * label column and scoring already reads the category column, so the day the two differ
 * nothing has to learn how.
 *
 * Which images a mislabelling tier files wrongly is derived from the seed, so the same
 * seed and the same parameters yield the same labels. The wrong category is drawn from the
 * declared categories other than the true one, so a mislabel is a plausible mistake rather
 * than a marker a student could learn to recognise.
 */
export function tierLabelsOf(
  assignment: TierAssignment,
  images: readonly SampledImage[],
  categories: readonly PoolCategory[],
  tiers: readonly DatasetTier[] = DATASET_TIERS,
  seed: number = SEED,
): Readonly<Record<string, TierLabels>> {
  const truth = new Map<string, PoolCategory>()
  for (const image of images) truth.set(image.id, image.category)

  const labels: Record<string, Record<string, PoolCategory>> = {}
  for (const id of Object.keys(assignment)) {
    const category = truth.get(id)
    if (category === undefined) throw new Error(`no sampled image named "${id}"`)
    labels[id] = {}
    for (const tierId of tiersHolding(assignment[id] as string, tiers)) {
      labels[id][tierId] = category
    }
  }

  const random = createRandom(seed)
  for (const tier of tiers) {
    if (tier.mislabels === 0) continue
    const held = random.shuffle(imagesHeldBy(tier.id, assignment, tiers))
    if (tier.mislabels > held.length) {
      throw new Error(
        `tier "${tier.id}" files ${tier.mislabels} images wrongly but holds only ${held.length}`,
      )
    }
    for (const id of held.slice(0, tier.mislabels)) {
      const category = truth.get(id) as PoolCategory
      const others = categories.filter((other) => other !== category)
      const wrong = random.pick(others)
      ;(labels[id] as Record<string, PoolCategory>)[tier.id] = wrong
    }
  }

  return labels
}

/**
 * Why a tier cannot be fitted and validated on the same footing as the others, or
 * `undefined` if every tier can.
 *
 * `specs/image-pool/spec.md` — a tier's fitted and held-out portions are the restriction
 * of the declared roles to the images it holds, and both must be non-empty in every
 * declared category, so that each tier's validation loss is measured over the categories
 * its fitted images cover. A tier missing one of them reads as a curve rather than as a
 * mistake, which is why this refuses at generation time and names the three things that
 * identify the hole.
 */
export function tierRoleDefect(
  images: readonly SampledImage[],
  assignment: TierAssignment,
  categories: readonly PoolCategory[],
  tiers: readonly DatasetTier[] = DATASET_TIERS,
): string | undefined {
  const held = new Map<string, SampledImage>()
  for (const image of images) held.set(image.id, image)

  for (const tier of tiers) {
    const ids = imagesHeldBy(tier.id, assignment, tiers)
    for (const role of TRAINING_ROLES) {
      for (const category of categories) {
        const present = ids.some((id) => {
          const image = held.get(id)
          return image !== undefined && image.role === role && image.category === category
        })
        if (!present) {
          return `dataset tier "${tier.id}" holds no image in role "${role}" of category "${category}", so it cannot be fitted and validated on the same footing as the others`
        }
      }
    }
  }

  return undefined
}

/**
 * Refuses a tier assignment a pool must not ship.
 *
 * Called by the manifest builder, next to the role guard it mirrors, so a pool whose
 * smallest tier could never draw a validation curve fails the generator run rather than
 * reaching a student as a flat line.
 */
export function assertTiersAreFittedAndValidated(
  images: readonly SampledImage[],
  assignment: TierAssignment,
  categories: readonly PoolCategory[],
  tiers: readonly DatasetTier[] = DATASET_TIERS,
): void {
  const largest = tiers[tiers.length - 1]
  if (largest === undefined) throw new Error('no dataset tier is declared')
  if (largest.holds !== SPLIT_SIZES.training) {
    throw new Error(
      `the largest dataset tier "${largest.id}" holds ${largest.holds} images, but the training split has ${SPLIT_SIZES.training}`,
    )
  }

  const defect = tierRoleDefect(images, assignment, categories, tiers)
  if (defect !== undefined) throw new Error(defect)
}

/**
 * Drawing the year's crop.
 *
 * Two questions are kept apart here, and keeping them apart is the whole point of the
 * module. *What is in the crop* is the farm's declared composition; *which pictures show
 * it* is the evaluation split of the task's pool. The pool over-represents a rare
 * category on purpose so a model can learn it, and a crop shaped like a training set
 * would make nonsense of every later rule about what a harvest contains.
 *
 * The draw is a pure function of the farm's identity, the year, and the declared numbers.
 * A student who abandons a sort and comes back is shown the same pictures in the same
 * order, so leaving is never a way to redraw a crop one does not like.
 *
 * The composition is allocated over the images *presented*, not over the whole crop.
 * Those are the same thing whenever one person can get through the crop, which is the
 * case the first harvests are. Past that point the allocation still has to guarantee one
 * image of every declared category — the requirement holds of any crop that is drawn —
 * and it must not need a distinct picture for an image nobody will ever see: a crop of
 * ten thousand would otherwise exhaust the pool over apples left on the ground.
 *
 * Every failure refuses and names its cause. There is no partial crop: half a harvest
 * scored as a whole one is exactly the plausible-looking wrong number the refusals in
 * `src/task/validate.ts` and `src/pool/` exist to prevent.
 */

import type { Farm } from '../economy/index.js'
import type { LoadedPool } from '../pool/index.js'
import type { CategoryId, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import { streamFor } from './random.js'

/** The crop holds no usable number of pieces. */
export const CROP_SIZE_MISSING = 'crop-size-missing'
/** The farm declares no share for a category the task declares. */
export const CROP_COMPOSITION_INCOMPLETE = 'crop-composition-incomplete'
/** The farm declares no composition at all. */
export const CROP_COMPOSITION_MISSING = 'crop-composition-missing'
/** The crop cannot hold one piece of every declared category. */
export const CROP_TOO_SMALL = 'crop-too-small'
/** The evaluation split holds too few images of a category to show the crop. */
export const CROP_IMAGES_EXHAUSTED = 'crop-images-exhausted'

/** One piece of the crop: a picture, and what it really is. */
export interface CropImage {
  readonly imageId: string
  readonly category: CategoryId
}

export interface Crop {
  /** How many pieces the year's crop holds, whether or not anyone reaches them. */
  readonly size: number
  /** The images presented for a decision, in the order they are presented. */
  readonly presented: readonly CropImage[]
  /** Pieces of the crop nobody gets to. Zero when the crop was sorted entire. */
  readonly unsorted: number
}

export type CropDraw =
  | { readonly ok: true; readonly crop: Crop }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

/**
 * Whole counts per category for `total` pieces, in declared order.
 *
 * Largest remainder, so the counts sum to the total exactly and each category is as close
 * to its declared share as whole pieces allow. A category that rounds away to nothing is
 * then given one piece at the expense of the largest count, because a harvest that never
 * shows a student what a rare category looks like teaches them nothing about it — and the
 * rarity is still visible in the one.
 */
export function allocate(total: number, shares: readonly number[]): number[] {
  const weight = shares.reduce((sum, share) => sum + share, 0)
  const ideal = shares.map((share) => (total * share) / weight)
  const counts = ideal.map((value) => Math.floor(value))

  let remaining = total - counts.reduce((sum, count) => sum + count, 0)
  const byRemainder = ideal
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const entry of byRemainder) {
    if (remaining <= 0) break
    counts[entry.index] = (counts[entry.index] ?? 0) + 1
    remaining -= 1
  }

  // Every declared category appears at least once. Callers guarantee there are enough
  // pieces to go round, so the largest count is always above one when this runs.
  for (let index = 0; index < counts.length; index += 1) {
    if ((counts[index] ?? 0) > 0) continue
    let largest = 0
    for (let other = 1; other < counts.length; other += 1) {
      if ((counts[other] ?? 0) > (counts[largest] ?? 0)) largest = other
    }
    counts[largest] = (counts[largest] ?? 0) - 1
    counts[index] = 1
  }

  return counts
}

/**
 * The year's crop for one task, or the reasons it cannot be drawn.
 *
 * `seed` is the farm's own, drawn once when the farm was opened and kept for its life;
 * together with the year it is the whole of what varies between crops.
 */
export function drawCrop(
  declaration: TaskDeclaration,
  farm: Farm,
  pool: LoadedPool,
  seed: number,
): CropDraw {
  const issues: ValidationIssue[] = []

  const size = farm.cropSize
  if (!Number.isInteger(size) || size < 1) {
    issues.push(
      issue(
        CROP_SIZE_MISSING,
        `The farm records no usable size for this year's crop; found ${JSON.stringify(size)}.`,
        'cropSize',
      ),
    )
  }

  const composition = farm.declaration.cropComposition
  const categories = declaration.categories.map((category) => category.id)
  if (
    composition === undefined ||
    composition === null ||
    Object.keys(composition).length === 0
  ) {
    issues.push(
      issue(
        CROP_COMPOSITION_MISSING,
        'The farm declares nothing about what its crop is made of, and the pool the pictures come from is a training set rather than an orchard, so its own composition cannot stand in for one.',
        'cropComposition',
      ),
    )
  } else {
    for (const category of categories) {
      const share = composition[category]
      if (typeof share !== 'number' || !Number.isFinite(share) || share <= 0) {
        issues.push(
          issue(
            CROP_COMPOSITION_INCOMPLETE,
            `The farm declares no share of its crop for "${category}", which this task declares as a category.`,
            `cropComposition.${category}`,
          ),
        )
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues }

  const perHarvest = declaration.handSorting.perHarvest
  const presentedCount = Math.min(size, perHarvest)

  if (presentedCount < categories.length) {
    // Which category goes missing is not arbitrary: the smallest share is the one whole
    // pieces run out on, and naming it says what the crop would have to hold to be shown.
    const absent = [...categories].sort(
      (a, b) => (composition[a] ?? 0) - (composition[b] ?? 0) || categories.indexOf(a) - categories.indexOf(b),
    )[0]
    return {
      ok: false,
      issues: [
        issue(
          CROP_TOO_SMALL,
          `A crop of ${presentedCount} cannot hold one of each of the ${categories.length} categories this task declares, so "${String(absent)}" would be absent from it.`,
          'cropSize',
        ),
      ],
    }
  }

  const counts = allocate(
    presentedCount,
    categories.map((category) => composition[category] as number),
  )

  const stream = streamFor(seed, farm.year)
  const available = new Map<CategoryId, string[]>()
  for (const category of categories) available.set(category, [])
  for (const imageId of pool.order.pool) {
    available.get(pool.truth[imageId] ?? '')?.push(imageId)
  }

  const drawn: CropImage[] = []
  categories.forEach((category, index) => {
    const wanted = counts[index] ?? 0
    const held = available.get(category) ?? []
    if (held.length < wanted) {
      issues.push(
        issue(
          CROP_IMAGES_EXHAUSTED,
          `The evaluation split holds ${held.length} images of "${category}", and this crop needs ${wanted}.`,
          category,
        ),
      )
      return
    }
    // Shuffled and taken from the front, so no image appears twice in one crop.
    for (const imageId of stream.shuffle(held).slice(0, wanted)) {
      drawn.push({ imageId, category })
    }
  })

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    crop: {
      size,
      // Shuffled again so the categories arrive mixed rather than in declared blocks.
      presented: stream.shuffle(drawn),
      unsorted: size - presentedCount,
    },
  }
}

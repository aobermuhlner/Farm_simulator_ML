/**
 * Drawing the year's crop.
 *
 * Three questions are kept apart here, and keeping them apart is the whole point of the
 * module. *How much* is the farm's, and grows as the land does. *What is in it* is the
 * farm's declared composition, moved for that one year by whatever ranges the farm
 * declares it varies within. *Which pictures show it* is the evaluation split of the
 * task's pool. The pool over-represents a rare category on purpose so a model can learn
 * it, and a crop shaped like a training set would make nonsense of every later rule about
 * what a harvest contains.
 *
 * The draw is a pure function of the farm's identity, the year, and the declared numbers.
 * A student who abandons a year and comes back is given the same crop, so leaving is
 * never a way to redraw a year one does not like — and neither is it a way to reroll the
 * weather, because the year's composition comes off the same stream before any picture
 * does.
 *
 * The crop is the whole year's, not the part of it one person reaches: a model at work is
 * scored over all of it. That is why photographs recur. A crop of six thousand cannot be
 * drawn from a thousand distinct pictures, so each category's pictures are dealt out in
 * whole passes and the remainder is taken from a shuffle — every picture used before any
 * is used again. `presented` is the separate, smaller question of what one pair of hands
 * is shown, and that stays distinct, because the same picture returning asks a person
 * whether they remember what they answered rather than what the apple is.
 *
 * Every failure refuses and names its cause. There is no partial crop: half a harvest
 * scored as a whole one is exactly the plausible-looking wrong number the refusals in
 * `src/task/validate.ts` and `src/pool/` exist to prevent.
 */

import type { Farm } from '../economy/index.js'
import { cropSize } from '../economy/index.js'
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
/** The evaluation split holds no picture at all of a category the crop needs. */
export const CROP_IMAGES_EXHAUSTED = 'crop-images-exhausted'

/**
 * The pictures a crop may be drawn from: the evaluation split, and what each one is.
 *
 * Narrower than a loaded pool on purpose. Drawing a crop needs the split's image ids and
 * their true categories and nothing else — no atlases, no geometry, no manifest — and the
 * shell already holds exactly that per task. Asking for a whole pool here would make the
 * automated harvest fetch a manifest it has no other use for.
 */
export interface CropSplit {
  /** Image ids of the evaluation split, in the order the manifest enumerates them. */
  readonly imageIds: readonly string[]
  /** True category per image id. */
  readonly truth: Readonly<Record<string, CategoryId>>
}

/** One piece of the crop: a picture, and what it really is. */
export interface CropImage {
  readonly imageId: string
  readonly category: CategoryId
}

export interface Crop {
  /** How many pieces the year's crop holds, whether or not anyone reaches them. */
  readonly size: number
  /** Every piece of the year's crop, mixed. A picture may appear more than once. */
  readonly pieces: readonly CropImage[]
  /** The pieces presented for a decision by hand, in the order they are presented. */
  readonly presented: readonly CropImage[]
  /** Pieces of the crop nobody gets to. Zero when the crop was sorted entire. */
  readonly unsorted: number
  /** How many pieces of each declared category this year drew, in declared order. */
  readonly composition: Readonly<Record<CategoryId, number>>
  /** True when some picture stands for more than one piece of the crop. */
  readonly recurred: boolean
  /** How many distinct pictures the evaluation split holds, per declared category. */
  readonly held: Readonly<Record<CategoryId, number>>
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
 * The share of the crop each category holds this year, in declared order.
 *
 * A category the farm declares a range for takes its share from inside that range. The
 * rest keep the ratio their declared shares have to one another and divide whatever is
 * left, so a wetter year leaves proportionally less of everything else rather than taking
 * it all out of one neighbour.
 *
 * Drawn from the year's own stream, and drawn *first*, before any picture is chosen: the
 * weather is a property of the year rather than of which photographs happened to come up.
 */
export function drawShares(
  categories: readonly CategoryId[],
  composition: Readonly<Record<string, number>>,
  variation: Readonly<Record<string, { readonly min: number; readonly max: number }>> | undefined,
  next: () => number,
): number[] {
  const shares = categories.map((category) => {
    const range = variation?.[category]
    if (range === undefined) return undefined
    return range.min + next() * (range.max - range.min)
  })

  const taken = shares.reduce((sum: number, share) => sum + (share ?? 0), 0)
  const holdingWeight = categories.reduce(
    (sum, category, index) => (shares[index] === undefined ? sum + (composition[category] ?? 0) : sum),
    0,
  )
  const remainder = Math.max(1 - taken, 0)

  return categories.map((category, index) => {
    const drawn = shares[index]
    if (drawn !== undefined) return drawn
    // Nothing left over, or nothing to divide it by: fall back on the declared share, and
    // let `allocate` normalise. The farm's validator refuses the declarations that get
    // here, so this is the belt to that braces rather than a case play reaches.
    if (holdingWeight <= 0 || remainder <= 0) return composition[category] ?? 0
    return (remainder * (composition[category] ?? 0)) / holdingWeight
  })
}

/**
 * `wanted` pieces drawn from `held` pictures, using every picture before reusing any.
 *
 * Each picture appears `floor(wanted / held)` times, and the `wanted mod held` left over
 * are taken from a shuffle. So no picture appears more than `ceil(wanted / held)` times,
 * and none appears twice while another appears once — which is what *the whole split
 * before it repeats* asks for, stated as an invariant rather than as an intention.
 */
function deal(held: readonly string[], wanted: number, shuffle: (of: readonly string[]) => string[]): string[] {
  const passes = Math.floor(wanted / held.length)
  const remainder = wanted % held.length

  const drawn: string[] = []
  for (let pass = 0; pass < passes; pass += 1) drawn.push(...shuffle(held))
  drawn.push(...shuffle(held).slice(0, remainder))
  return drawn
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
  split: CropSplit,
  seed: number,
): CropDraw {
  const issues: ValidationIssue[] = []

  const size = cropSize(farm)
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

  if (size < categories.length) {
    // Which category goes missing is not arbitrary: the smallest share is the one whole
    // pieces run out on, and naming it says what the crop would have to hold to be shown.
    const absent = [...categories].sort(
      (a, b) =>
        (composition[a] ?? 0) - (composition[b] ?? 0) || categories.indexOf(a) - categories.indexOf(b),
    )[0]
    return {
      ok: false,
      issues: [
        issue(
          CROP_TOO_SMALL,
          `A crop of ${size} cannot hold one of each of the ${categories.length} categories this task declares, so "${String(absent)}" would be absent from it.`,
          'cropSize',
        ),
      ],
    }
  }

  const stream = streamFor(seed, farm.year)
  const shares = drawShares(
    categories,
    composition,
    farm.declaration.yearVariation,
    () => stream.next(),
  )
  const counts = allocate(size, shares)

  // What one pair of hands reaches, as its own allocation of the same year's shares. It
  // has to be the year's mix rather than a slice off the front of the crop, because the
  // wage must not move when the orchard grows past what one person can sort — two crops
  // of different sizes sorted the same way pay the same, and a sampled mix would not.
  const perHarvest = Math.min(size, declaration.handSorting.perHarvest)
  const targets = allocate(perHarvest, shares)

  const available = new Map<CategoryId, string[]>()
  for (const category of categories) available.set(category, [])
  for (const imageId of split.imageIds) {
    available.get(split.truth[imageId] ?? '')?.push(imageId)
  }

  const drawn: CropImage[] = []
  const held: Record<CategoryId, number> = {}
  const composed: Record<CategoryId, number> = {}
  let recurred = false

  categories.forEach((category, index) => {
    const wanted = counts[index] ?? 0
    const pictures = available.get(category) ?? []
    held[category] = pictures.length
    composed[category] = wanted
    // Every declared category has to reach the crop, and a category the split holds no
    // picture of cannot reach it at any size. That is the only count that still refuses:
    // a category the split holds too *few* pictures of no longer does, because the crop
    // repeats them.
    if (pictures.length === 0) {
      issues.push(
        issue(
          CROP_IMAGES_EXHAUSTED,
          `The evaluation split holds no image of "${category}", and this crop needs ${wanted} of them.`,
          category,
        ),
      )
      return
    }
    // What one person is shown must be distinct pictures, so their share of this category
    // is bounded by how many the split holds. That bound is far above what one pair of
    // hands reaches against any real pool; it is here so a small one shortens the sort
    // rather than refusing the crop a model could have brought in perfectly well.
    targets[index] = Math.min(targets[index] ?? 0, pictures.length)
    if (wanted > pictures.length) recurred = true
    for (const imageId of deal(pictures, wanted, (of) => stream.shuffle(of))) {
      drawn.push({ imageId, category })
    }
  })

  if (issues.length > 0) return { ok: false, issues }

  // Shuffled so the categories arrive mixed rather than in declared blocks.
  const pieces = stream.shuffle(drawn)

  // The pieces themselves, in the crop's own order, taken until each category's share of
  // what one person reaches is filled and skipping any picture already put in front of
  // them. So a person sorts the crop rather than a sample standing in for it, and never
  // sees one picture twice however often the crop repeats it.
  const quota = new Map(categories.map((category, index) => [category, targets[index] ?? 0]))
  const reachable = targets.reduce((sum, count) => sum + count, 0)
  const presented: CropImage[] = []
  const shown = new Set<string>()
  for (const piece of pieces) {
    if (presented.length >= reachable) break
    if (shown.has(piece.imageId)) continue
    const left = quota.get(piece.category) ?? 0
    if (left <= 0) continue
    quota.set(piece.category, left - 1)
    shown.add(piece.imageId)
    presented.push(piece)
  }
  // Whole pieces are allocated twice, over the crop and over what one person reaches, and
  // the two roundings can leave a category wanting one more piece than the crop drew of
  // it. The shortfall is made up from the crop in its own order rather than left short:
  // the count presented is what the task declares, and a crop one piece light would be
  // paid as a whole one.
  if (presented.length < reachable) {
    for (const piece of pieces) {
      if (presented.length >= reachable) break
      if (shown.has(piece.imageId)) continue
      shown.add(piece.imageId)
      presented.push(piece)
    }
  }

  return {
    ok: true,
    crop: {
      size,
      pieces,
      presented,
      unsorted: size - presented.length,
      composition: composed,
      recurred,
      held,
    },
  }
}

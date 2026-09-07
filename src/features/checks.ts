/**
 * The checks that keep a feature set from teaching something false.
 *
 * Everything here is arithmetic over the numbers the manifest already records — no
 * pixels, no rasterizing — which is what makes the guards affordable as ordinary tests
 * over 1 200 rows. `test/features-pool.test.ts` runs them against the shipped pool.
 *
 * They are run there rather than at page load on purpose. The pool, the declaration and
 * the artifacts are committed static data, so any of these checks can only start failing
 * when somebody changes one of them — and the suite is where that gets caught, the same
 * reasoning `test/pool-committed.test.ts` already runs on.
 *
 * See openspec/changes/measured-features/specs/measured-features/spec.md.
 */

import type { LoadedPool } from '../pool/index.js'
import type { CategoryId, FeatureId, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import { columnOf } from './index.js'

/**
 * How close to a perfect monotone relationship two features may be.
 *
 * Measured over the shipped pool, `darkSpotArea` and `spotCount` rank together at 0.938:
 * they agree about which apples carry a worm and disagree about how much of one, which is
 * two features. A `greenness` alongside `redness` would come out at exactly -1.0000, one
 * number under two names, which is what this refuses. The gap between 0.938 and 1 is wide
 * enough that the tolerance does not have to be argued to three decimals.
 */
export const DUPLICATE_RANK_TOLERANCE = 0.999

/**
 * How strongly a declared contaminant has to move its feature to count as one.
 *
 * A correlation within one category, so the attribute the feature is nominally about is
 * held roughly still. 0.15 is above what 250 to 600 samples produce by chance and well
 * below every contamination the shipped set actually declares — the weakest is `gloss`
 * against `spotCount` at 0.248, and the strongest is `wormVisibility` against the
 * outline at 0.922. A declaration naming an attribute that moves nothing is the
 * requirement satisfied on paper, which is the failure this number exists to catch.
 */
export const CONTAMINATION_TOLERANCE = 0.15

/**
 * How much better a feature may separate the harvest than the fitted images.
 *
 * Fitted against the measured pool, and the number is the measurement rather than a
 * round figure chosen first: see `test/features-pool.test.ts`, which asserts that no
 * declared feature needs more than this and that the tolerance is no larger than the
 * worst gap. Zero would be the honest ideal, and the reason it is not zero is sampling:
 * 160 fitted images against 1 000 evaluation images put a little noise on both figures.
 */
export const INVERSION_TOLERANCE = 0.02

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Pearson correlation, zero when either side does not vary at all. */
export function correlation(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length < 2) return 0
  const ma = mean(a)
  const mb = mean(b)
  let covariance = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < a.length; i += 1) {
    const da = (a[i] as number) - ma
    const db = (b[i] as number) - mb
    covariance += da * db
    va += da * da
    vb += db * db
  }
  if (va === 0 || vb === 0) return 0
  return covariance / Math.sqrt(va * vb)
}

/** Ranks, averaging ties, so that Spearman treats equal values as equal. */
function ranks(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((x, y) => x.value - y.value)
  const out = new Array<number>(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && (order[j + 1] as { value: number }).value === (order[i] as { value: number }).value) {
      j += 1
    }
    const shared = (i + j) / 2
    for (let k = i; k <= j; k += 1) out[(order[k] as { index: number }).index] = shared
    i = j + 1
  }
  return out
}

/** Spearman rank correlation: how nearly one feature is a monotone function of another. */
export function rankCorrelation(a: readonly number[], b: readonly number[]): number {
  return correlation(ranks(a), ranks(b))
}

/** Every image id in the pool, in manifest order across both splits. */
function allImages(pool: LoadedPool): readonly string[] {
  return [...pool.order.training, ...pool.order.pool]
}

/**
 * Refuses a declared feature whose value never moves across the pool.
 *
 * A student picking a threshold on a number that is the same for every apple learns
 * something false about what a feature is. This is why the apple task declares no `size`:
 * the silhouette's width is fixed by the drawing, so a size feature would be a constant.
 */
export function checkNotConstant(
  declaration: TaskDeclaration,
  pool: LoadedPool,
): readonly ValidationIssue[] {
  const images = allImages(pool)
  const issues: ValidationIssue[] = []
  for (const feature of declaration.features) {
    const values = columnOf(pool, images, feature.id)
    if (new Set(values).size <= 1) {
      issues.push(
        issue(
          'constant-feature',
          `Feature "${feature.id}" takes the value ${String(values[0])} for every image in the pool, so no threshold on it separates anything.`,
          `features.${feature.id}`,
        ),
      )
    }
  }
  return issues
}

/**
 * Refuses two declared features that are the same number under two names.
 *
 * Rank correlation rather than Pearson, because the requirement is about one feature
 * being a *monotone* function of another: a feature and its square separate exactly the
 * same apples at exactly the same thresholds while correlating imperfectly.
 */
export function checkNoDuplicates(
  declaration: TaskDeclaration,
  pool: LoadedPool,
  tolerance: number = DUPLICATE_RANK_TOLERANCE,
): readonly ValidationIssue[] {
  const images = allImages(pool)
  const issues: ValidationIssue[] = []
  const columns = new Map<FeatureId, readonly number[]>()
  for (const feature of declaration.features) columns.set(feature.id, columnOf(pool, images, feature.id))

  const ids = declaration.features.map((feature) => feature.id)
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const left = ids[i] as FeatureId
      const right = ids[j] as FeatureId
      const rho = rankCorrelation(columns.get(left) as readonly number[], columns.get(right) as readonly number[])
      if (Math.abs(rho) >= tolerance) {
        issues.push(
          issue(
            'duplicate-feature',
            `Features "${left}" and "${right}" rank together at ${rho.toFixed(4)}, so one is a monotone function of the other and they are one number under two names.`,
            `features.${left}`,
          ),
        )
      }
    }
  }
  return issues
}

/**
 * Refuses a declared contamination the pool does not bear out.
 *
 * Measured *within a category*, which is the whole point: across the pool a worm feature
 * correlates with everything that distinguishes wormy apples, and the question is whether
 * the named attribute moves the feature among apples that are otherwise alike. A
 * contaminant that clears the tolerance in any one category counts, because some
 * attributes only vary in one — no green apple carries a worm.
 */
export function checkContaminationHolds(
  declaration: TaskDeclaration,
  pool: LoadedPool,
  tolerance: number = CONTAMINATION_TOLERANCE,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const categories = declaration.categories.map((category) => category.id)
  const byCategory = new Map<CategoryId, string[]>()
  for (const category of categories) byCategory.set(category, [])
  for (const id of allImages(pool)) {
    byCategory.get(pool.images[id]?.category ?? '')?.push(id)
  }

  for (const feature of declaration.features) {
    for (const attribute of feature.contaminatedBy) {
      let strongest = 0
      for (const category of categories) {
        const ids = byCategory.get(category) ?? []
        if (ids.length < 2) continue
        const values = columnOf(pool, ids, feature.id)
        const attributes = ids.map(
          (id) => pool.images[id]?.attributes[attribute as 'hue'] ?? Number.NaN,
        )
        const strength = Math.abs(correlation(values, attributes))
        if (strength > strongest) strongest = strength
      }
      if (strongest < tolerance) {
        issues.push(
          issue(
            'contamination-not-measurable',
            `Feature "${feature.id}" declares contamination by "${attribute}", but within every category that attribute moves it by at most ${strongest.toFixed(3)}, under the ${tolerance} a contamination has to clear.`,
            `features.${feature.id}.contaminatedBy`,
          ),
        )
      }
    }
  }
  return issues
}

/** Refuses a measured value the declared range does not contain. */
export function checkRanges(
  declaration: TaskDeclaration,
  pool: LoadedPool,
): readonly ValidationIssue[] {
  const images = allImages(pool)
  const issues: ValidationIssue[] = []
  for (const feature of declaration.features) {
    for (const id of images) {
      const value = pool.images[id]?.features[feature.id]
      if (value === undefined) continue
      if (value < feature.range.min || value > feature.range.max) {
        issues.push(
          issue(
            'value-outside-range',
            `Image "${id}" measures ${value} for feature "${feature.id}", outside the declared range ${feature.range.min}..${feature.range.max}.`,
            `features.${feature.id}.range`,
          ),
        )
        // One image is enough to say the range is wrong; listing 1 200 of them is noise.
        break
      }
    }
  }
  return issues
}

/**
 * The best balanced accuracy a single threshold on one feature reaches for one category,
 * one against the rest.
 *
 * Balanced accuracy rather than plain accuracy, because the 160 fitted images and the
 * 1 000 evaluation images have different class balances and the two figures have to be
 * comparable. Both directions of the threshold are tried, so a feature that is *low* on
 * the category counts as separating it. A set with none of the category, or all of it,
 * scores 0.5 — no separation is measurable, rather than a perfect one by default.
 */
export function bestThresholdAccuracy(
  values: readonly number[],
  isPositive: readonly boolean[],
): number {
  const positives = isPositive.filter(Boolean).length
  const negatives = isPositive.length - positives
  if (positives === 0 || negatives === 0) return 0.5

  const sorted = [...new Set(values)].sort((a, b) => a - b)
  let best = 0.5
  for (let i = 0; i + 1 < sorted.length; i += 1) {
    const cut = ((sorted[i] as number) + (sorted[i + 1] as number)) / 2
    let aboveHit = 0
    let aboveMiss = 0
    for (let j = 0; j < values.length; j += 1) {
      const above = (values[j] as number) > cut
      if (isPositive[j] === true) {
        if (above) aboveHit += 1
      } else if (above) {
        aboveMiss += 1
      }
    }
    // "Above means positive" and "below means positive" are the same cut read two ways,
    // so both are scored here rather than looping the thresholds twice.
    const above = (aboveHit / positives + (negatives - aboveMiss) / negatives) / 2
    const below = ((positives - aboveHit) / positives + aboveMiss / negatives) / 2
    best = Math.max(best, above, below)
  }
  return best
}

/**
 * How well one feature separates any category from the others, over a set of images.
 *
 * The maximum over categories, because the question the guard asks is whether the feature
 * is *useful* on this set, not which category it happens to be useful for.
 */
export function separation(
  declaration: TaskDeclaration,
  pool: LoadedPool,
  imageIds: readonly string[],
  feature: FeatureId,
): number {
  const values = columnOf(pool, imageIds, feature)
  let best = 0.5
  for (const category of declaration.categories) {
    const isPositive = imageIds.map((id) => pool.images[id]?.category === category.id)
    best = Math.max(best, bestThresholdAccuracy(values, isPositive))
  }
  return best
}

/** One feature's separation on the images a student can browse and on the harvest. */
export interface SeparationPair {
  readonly feature: FeatureId
  readonly fitted: number
  readonly harvest: number
}

/** Both separations, per declared feature. */
export function separations(
  declaration: TaskDeclaration,
  pool: LoadedPool,
): readonly SeparationPair[] {
  return declaration.features.map((feature) => ({
    feature: feature.id,
    fitted: separation(declaration, pool, pool.roles.fitted, feature.id),
    harvest: separation(declaration, pool, pool.order.pool, feature.id),
  }))
}

/**
 * Refuses a feature that separates categories better on the harvest than on the images a
 * student can look at.
 *
 * This is the trap the requirement exists to prevent, and it is not symmetric. A feature
 * may be weak everywhere, or weak on the harvest and strong on the fitted images — that
 * is overfitting, and it is the lesson. The other way round punishes a student for
 * reasoning correctly: they inspect their own 200 photos, conclude the feature is
 * useless, discard it, and lose the one feature that would have worked.
 */
export function checkNoInversion(
  declaration: TaskDeclaration,
  pool: LoadedPool,
  tolerance: number,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const pair of separations(declaration, pool)) {
    if (pair.harvest - pair.fitted > tolerance) {
      issues.push(
        issue(
          'separation-inverted',
          `Feature "${pair.feature}" separates categories better on the harvest (${pair.harvest.toFixed(3)}) than on the fitted images (${pair.fitted.toFixed(3)}), by more than the ${tolerance} tolerance.`,
          `features.${pair.feature}`,
        ),
      )
    }
  }
  return issues
}

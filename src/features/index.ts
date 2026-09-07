/**
 * Reading the measured features out of a loaded pool.
 *
 * A reader and nothing else. The measurement lives in `tools/pool/features.ts`, runs once
 * where the pool is produced, and never ships: nothing in this directory touches a pixel,
 * and `test/features-reader.test.ts` asserts that. Two devices measuring the same apple
 * differently is the failure that keeps measurement out of the browser, and a reader that
 * could recompute a value is a reader that will eventually be asked to.
 *
 * See openspec/changes/measured-features/specs/measured-features/spec.md.
 */

import type { LoadedPool } from '../pool/index.js'
import type { FeatureDeclaration, FeatureId, TaskDeclaration } from '../task/types.js'

/** One image's features, keyed by the ids the task declares. */
export type FeatureVector = Readonly<Record<FeatureId, number>>

/**
 * The value one image was measured to have for one feature.
 *
 * `undefined` only where the pool did not record it, which `readPool` already refuses —
 * so a caller reaching this branch is reading a pool that never loaded.
 */
export function featureOf(
  pool: LoadedPool,
  imageId: string,
  feature: FeatureId,
): number | undefined {
  return pool.images[imageId]?.features[feature]
}

/** One image's whole vector, in the order the task declares its features. */
export function vectorOf(
  declaration: TaskDeclaration,
  pool: LoadedPool,
  imageId: string,
): FeatureVector | undefined {
  const image = pool.images[imageId]
  if (image === undefined) return undefined
  const vector: Record<FeatureId, number> = {}
  for (const feature of declaration.features) {
    const value = image.features[feature.id]
    if (value === undefined) return undefined
    vector[feature.id] = value
  }
  return vector
}

/** Every value of one feature over the images named, in the order they are named. */
export function columnOf(
  pool: LoadedPool,
  imageIds: readonly string[],
  feature: FeatureId,
): readonly number[] {
  return imageIds.map((id) => pool.images[id]?.features[feature] ?? Number.NaN)
}

/** The declaration for one feature id, or `undefined` if the task declares no such feature. */
export function declarationOf(
  declaration: TaskDeclaration,
  feature: FeatureId,
): FeatureDeclaration | undefined {
  return declaration.features.find((candidate) => candidate.id === feature)
}

/** The declared feature ids, in declaration order. */
export function featureIds(declaration: TaskDeclaration): readonly FeatureId[] {
  return declaration.features.map((feature) => feature.id)
}

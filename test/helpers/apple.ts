import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { PredictionArtifact } from '../../src/task/artifact.js'
import type { TaskDeclaration } from '../../src/task/types.js'
import { validateDeclaration } from '../../src/task/validate.js'
import { loadRawDeclaration } from './load-raw'

const here = fileURLToPath(new URL('.', import.meta.url))

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(`${here}../fixtures/${name}.json`, 'utf8')) as T
}

/** The shipped apple declaration, validated so tests work with real types. */
export function appleDeclaration(): TaskDeclaration {
  const result = validateDeclaration(loadRawDeclaration('apple-harvest'))
  if (!result.ok) {
    throw new Error(
      `the shipped apple declaration must validate; issues: ${result.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return result.declaration
}

export function applePredictions(): PredictionArtifact {
  return readFixture<PredictionArtifact>('apple-predictions')
}

export interface PoolManifest {
  readonly poolId: string
  readonly images: Readonly<Record<string, { split: string; category: string }>>
}

export function applePool(): PoolManifest {
  return readFixture<PoolManifest>('apple-pool')
}

/** Image ids of one split, in manifest order. */
export function imagesIn(split: 'training' | 'pool'): string[] {
  const { images } = applePool()
  return Object.keys(images).filter((id) => images[id]?.split === split)
}

/** True category of a fixture image. */
export function trueCategory(imageId: string): string {
  const category = applePool().images[imageId]?.category
  if (category === undefined) throw new Error(`no ground truth for image ${imageId}`)
  return category
}

/** The over-regularized configuration: crates wormy apples. */
export const OVER_REGULARIZED = {
  blocks: 2,
  channels: 8,
  regularization: 3,
  dropout: 0.5,
} as const

/** The under-regularized configuration: over-selective, downgrades good reds. */
export const OVER_SELECTIVE = {
  blocks: 4,
  channels: 32,
  regularization: 0,
  dropout: 0,
} as const

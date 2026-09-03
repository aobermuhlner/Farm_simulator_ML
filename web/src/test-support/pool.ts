/**
 * The committed pool, for screen tests.
 *
 * Read off disk and put through the real reader, for the same reason
 * `declarations.ts` reads the shipped declaration: a grid test that passed against a
 * hand-typed manifest would prove nothing about the 200 apples a student actually gets.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LoadedPool } from '../../../src/pool/index.js'
import { readPool } from '../../../src/pool/index.js'
import { DATA_URLS } from '../data/paths.js'
import type { TrainingSplitView } from '../data/pool.js'
import { trainingSplitView } from '../data/pool.js'
import { appleDeclaration } from './declarations.js'

const repoRoot = process.cwd()

/** The committed apple manifest, as fetched JSON would arrive. */
export function appleManifest(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(repoRoot, 'pools/apple-harvest/manifest.json'), 'utf8'),
  ) as Record<string, unknown>
}

/** The committed apple pool, through the real reader. */
export function applePool(): LoadedPool {
  const read = readPool(appleManifest(), appleDeclaration())
  if (!read.ok) {
    throw new Error(
      `The committed apple pool does not read: ${read.issues.map((issue) => issue.message).join(' ')}`,
    )
  }
  return read.pool
}

/** The committed apple pool's training split, as the browser receives it. */
export function appleTrainingSplit(): TrainingSplitView {
  const view = trainingSplitView(applePool(), appleDeclaration(), DATA_URLS.applePoolAtlases)
  if (!view.ok) {
    throw new Error(
      `The committed apple split does not project: ${view.issues.map((issue) => issue.message).join(' ')}`,
    )
  }
  return view.value
}

/**
 * That the pool is reachable from the app's data mounts.
 *
 * The shipped app now reads this pool for both browsing and scoring, so these tests
 * cover the plumbing under that: the mount resolves both ways, and a PNG is not served
 * as JSON.
 */

import { describe, expect, it } from 'vitest'
import {
  contentTypeFor,
  DATA_MOUNTS,
  dataUrlFor,
  SHIPPED_TASKS,
  sourcePathFor,
} from '../web/src/data/paths.js'
import { committedManifest } from './helpers/pool'

describe('the pool data mount', () => {
  it('mounts the pool directory alongside declarations and fixtures', () => {
    expect(DATA_MOUNTS['data/pools']).toBe('pools')
  })

  it('resolves a manifest URL to its file on disk', () => {
    expect(sourcePathFor('data/pools/apple-harvest/manifest.json')).toBe(
      'pools/apple-harvest/manifest.json',
    )
  })

  it('resolves every committed atlas URL to its file on disk', () => {
    for (const atlas of Object.values(committedManifest().atlases)) {
      expect(sourcePathFor(`data/pools/apple-harvest/${atlas.file}`)).toBe(
        `pools/apple-harvest/${atlas.file}`,
      )
    }
  })

  it('leaves the existing mounts alone', () => {
    expect(sourcePathFor(SHIPPED_TASKS[0] ?? '')).toBe('declarations/apple-harvest.json')
  })

  it('resolves a repo path back to the URL it is served at', () => {
    expect(dataUrlFor('pools/apple-harvest')).toBe('data/pools/apple-harvest')
    expect(dataUrlFor('artifacts/apple-harvest/predictions')).toBe(
      'data/artifacts/apple-harvest/predictions',
    )
    expect(dataUrlFor('somewhere/else')).toBeUndefined()
  })
})

describe('content types', () => {
  it('serves JSON as JSON and PNG as PNG', () => {
    expect(contentTypeFor('pools/apple-harvest/manifest.json')).toBe('application/json')
    expect(contentTypeFor('pools/apple-harvest/atlas-training-0.png')).toBe('image/png')
  })

  it('falls back to bytes rather than mislabelling an unknown file', () => {
    expect(contentTypeFor('pools/apple-harvest/atlas.webp')).toBe('application/octet-stream')
  })
})

describe('what a student sees', () => {
  it('reads the generated pool, which is also what a run is scored over', () => {
    // One pool per task, browsed and scored. The fixtures stay in test/ as fixtures.
    expect(Object.values(DATA_MOUNTS)).not.toContain('test/fixtures')
    expect(dataUrlFor('pools/apple-harvest/manifest.json')).toBe(
      'data/pools/apple-harvest/manifest.json',
    )
  })
})

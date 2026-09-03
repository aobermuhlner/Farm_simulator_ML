/**
 * That the pool is reachable from the app's data mounts.
 *
 * Nothing in the shipped app reads the pool yet — `prediction-artifacts` performs that
 * switch, per design.md — so these tests cover the plumbing this change is responsible
 * for: the mount resolves, and a PNG is not served as JSON.
 */

import { describe, expect, it } from 'vitest'
import { contentTypeFor, DATA_MOUNTS, DATA_URLS, sourcePathFor } from '../web/src/data/paths.js'
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
    expect(sourcePathFor(DATA_URLS.appleDeclaration)).toBe('declarations/apple-harvest.json')
    expect(sourcePathFor(DATA_URLS.applePool)).toBe('test/fixtures/apple-pool.json')
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
  it('still reads the fixture pool, not the generated one', () => {
    // Deliberate: the shipped prediction fixture names image ids the real manifest does
    // not declare, so switching before predictions exist would refuse every image.
    expect(DATA_URLS.applePool).toBe('data/fixtures/apple-pool.json')
  })
})

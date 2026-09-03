import { describe, expect, it } from 'vitest'
import { ATLAS_PX, CELLS_PER_ATLAS, CELL_PX, POOL_ID, SEED } from '../tools/pool/params.js'
import { declarationDisagreement, regionOf } from '../tools/pool/manifest.js'
import { committedManifest, poolFile, poolFileSize } from './helpers/pool'
import { loadRawDeclaration } from './helpers/load-raw'

const manifest = committedManifest()
const declaration = loadRawDeclaration('apple-harvest')

/** The 3.5 MB the atlases must stay inside, against a measured 3.15 MB. */
const ATLAS_BUDGET_BYTES = 3.5 * 1024 * 1024

describe('the committed atlases', () => {
  it('ships one atlas per planned file, and nothing else', () => {
    expect(Object.keys(manifest.atlases)).toEqual([
      'atlas-training-0',
      'atlas-pool-0',
      'atlas-pool-1',
      'atlas-pool-2',
      'atlas-pool-3',
    ])
  })

  it('has every atlas file on disk at its declared dimensions', () => {
    for (const atlas of Object.values(manifest.atlases)) {
      const png = poolFile(atlas.file)
      expect(png.toString('ascii', 1, 4)).toBe('PNG')
      expect(png.readUInt32BE(16)).toBe(atlas.width)
      expect(png.readUInt32BE(20)).toBe(atlas.height)
      expect(atlas.width).toBe(ATLAS_PX)
    }
  })

  it('stays inside the atlas byte budget', () => {
    const total = Object.values(manifest.atlases).reduce(
      (sum, atlas) => sum + poolFileSize(atlas.file),
      0,
    )
    expect(total).toBeLessThan(ATLAS_BUDGET_BYTES)
  })

  it('costs a fixed number of requests, independent of how many images there are', () => {
    // Five atlases and one manifest, for 1200 images. The spec's bound.
    expect(Object.keys(manifest.atlases)).toHaveLength(5)
    expect(Object.keys(manifest.images)).toHaveLength(1200)
  })
})

describe('the committed manifest', () => {
  it('declares the pool, its version and the seed it came from', () => {
    expect(manifest.poolId).toBe(POOL_ID)
    expect(manifest.seed).toBe(SEED)
    expect(typeof manifest.schemaVersion).toBe('string')
  })

  it('declares a count per split that matches the images present', () => {
    for (const [split, declared] of Object.entries(manifest.splits)) {
      const present = Object.values(manifest.images).filter((image) => image.split === split)
      expect(present).toHaveLength(declared.count)
    }
  })

  it('describes every atlas with the geometry a client needs to crop a cell', () => {
    for (const atlas of Object.values(manifest.atlases)) {
      expect(atlas.cellSize).toBe(CELL_PX)
      expect(atlas.capacity).toBe(CELLS_PER_ATLAS)
      expect(atlas.grid * atlas.cellSize).toBe(atlas.width)
      expect(atlas.file).toMatch(/^atlas-[a-z]+-\d+\.png$/)
    }
  })

  it('gives every image every field the spec requires', () => {
    for (const [id, image] of Object.entries(manifest.images)) {
      expect(id).toMatch(/^[tp]-\d{3,4}$/)
      expect(['training', 'pool']).toContain(image.split)
      expect(['red', 'green', 'wormy']).toContain(image.category)
      expect(manifest.atlases[image.atlas]).toBeDefined()
      expect(Number.isInteger(image.cell)).toBe(true)
      for (const attribute of ['hue', 'roundness', 'gloss', 'lighting', 'wormVisibility'] as const) {
        expect(typeof image.attributes[attribute]).toBe('number')
        expect(Number.isFinite(image.attributes[attribute])).toBe(true)
      }
    }
  })

  it('places every image in a cell inside its atlas, and never two in one cell', () => {
    const occupied = new Set<string>()
    for (const [id, image] of Object.entries(manifest.images)) {
      const atlas = manifest.atlases[image.atlas]
      expect(atlas, `${id} names an unknown atlas`).toBeDefined()
      expect(image.cell).toBeGreaterThanOrEqual(0)
      expect(image.cell).toBeLessThan(atlas!.capacity)
      // An image's atlas must serve its own split, or a harvest would fetch the
      // training sheet to score the pool.
      expect(atlas!.split).toBe(image.split)
      const key = `${image.atlas}#${image.cell}`
      expect(occupied.has(key), `two images share ${key}`).toBe(false)
      occupied.add(key)
    }
  })

  it('resolves an image to a pixel region inside its atlas', () => {
    const first = regionOf(manifest, 't-001')
    expect(first).toEqual({ x: 0, y: 0, size: CELL_PX })
    for (const id of Object.keys(manifest.images)) {
      const region = regionOf(manifest, id)
      expect(region).toBeDefined()
      expect(region!.x + region!.size).toBeLessThanOrEqual(ATLAS_PX)
      expect(region!.y + region!.size).toBeLessThanOrEqual(ATLAS_PX)
    }
  })
})

describe('agreement with the task declaration', () => {
  it('carries the pool id the declaration references', () => {
    expect(manifest.poolId).toBe(declaration.pool)
  })

  it('carries the schema version the declaration declares', () => {
    expect(manifest.schemaVersion).toBe(declaration.schemaVersion)
  })

  it('uses only categories the declaration declares', () => {
    const declared = new Set(
      (declaration.categories as { id: string }[]).map((category) => category.id),
    )
    for (const image of Object.values(manifest.images)) {
      expect(declared.has(image.category)).toBe(true)
    }
  })

  it('is what the generator refuses to disagree with', () => {
    expect(declarationDisagreement(declaration, POOL_ID)).toBeUndefined()

    const wrongPool = declarationDisagreement({ ...declaration, pool: 'pools/somewhere-else' }, POOL_ID)
    expect(wrongPool).toContain('pools/somewhere-else')
    expect(wrongPool).toContain(POOL_ID)

    const noVersion = declarationDisagreement({ ...declaration, schemaVersion: undefined }, POOL_ID)
    expect(noVersion).toContain('schemaVersion')
  })
})

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ATLAS_GRID, atlasSvg, cellOrigin, planAtlases, renderAtlas } from '../tools/pool/atlas.js'
import { ATLAS_PX, CELLS_PER_ATLAS, CELL_PX, SPLIT_SIZES } from '../tools/pool/params.js'
import { samplePool } from '../tools/pool/sample.js'

const pool = samplePool()
const plans = planAtlases(pool)
const training = plans[0]

/** PNG chunk types, in order, read straight out of the byte stream. */
function chunkTypes(png: Buffer): string[] {
  const types: string[] = []
  let offset = 8
  while (offset + 8 <= png.byteLength) {
    const length = png.readUInt32BE(offset)
    types.push(png.toString('ascii', offset + 4, offset + 8))
    offset += 12 + length
  }
  return types
}

describe('atlas planning', () => {
  it('plans one atlas for the training split and four for the pool', () => {
    expect(plans.map((plan) => plan.id)).toEqual([
      'atlas-training-0',
      'atlas-pool-0',
      'atlas-pool-1',
      'atlas-pool-2',
      'atlas-pool-3',
    ])
  })

  it('never mixes splits inside an atlas', () => {
    for (const plan of plans) {
      expect(new Set(plan.images.map((image) => image.split)).size).toBe(1)
      expect(plan.images.every((image) => image.split === plan.split)).toBe(true)
    }
  })

  it('keeps every atlas inside its cell capacity', () => {
    for (const plan of plans) {
      expect(plan.images.length).toBeLessThanOrEqual(CELLS_PER_ATLAS)
      expect(plan.images.length).toBeGreaterThan(0)
    }
  })

  it('places every image exactly once', () => {
    const placed = plans.flatMap((plan) => plan.images.map((image) => image.id))
    expect(placed).toHaveLength(SPLIT_SIZES.training + SPLIT_SIZES.pool)
    expect(new Set(placed).size).toBe(placed.length)
  })

  it('derives cell origins from the grid', () => {
    expect(ATLAS_GRID).toBe(16)
    expect(cellOrigin(0)).toEqual({ x: 0, y: 0 })
    expect(cellOrigin(1)).toEqual({ x: CELL_PX, y: 0 })
    expect(cellOrigin(ATLAS_GRID)).toEqual({ x: 0, y: CELL_PX })
    expect(cellOrigin(CELLS_PER_ATLAS - 1)).toEqual({
      x: ATLAS_PX - CELL_PX,
      y: ATLAS_PX - CELL_PX,
    })
  })

  it('refuses to compose an atlas beyond its capacity', () => {
    const overfull = {
      id: 'atlas-overfull',
      split: 'pool' as const,
      images: [...pool, ...pool].slice(0, CELLS_PER_ATLAS + 1),
    }
    expect(() => atlasSvg(overfull)).toThrow(/capacity/)
  })
})

describe('atlas composition', () => {
  it('declares the atlas geometry the manifest will describe', () => {
    const svg = atlasSvg(training!)
    expect(svg).toContain(`width="${ATLAS_PX}" height="${ATLAS_PX}"`)
    expect(svg).toContain(`viewBox="0 0 ${ATLAS_PX} ${ATLAS_PX}"`)
  })

  it('gives every cell its own clip id, so one apple cannot clip another', () => {
    const svg = atlasSvg(training!)
    const ids = svg.match(/id="atlas-training-0-clip-\d+"/g) ?? []
    expect(ids).toHaveLength(training!.images.length)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('translates each cell to its own origin', () => {
    const svg = atlasSvg(training!)
    expect(svg).toContain('<g transform="translate(0 0)">')
    const last = cellOrigin(training!.images.length - 1)
    expect(svg).toContain(`<g transform="translate(${last.x} ${last.y})">`)
  })
})

describe('atlas rasterization', () => {
  const png = renderAtlas(training!)

  it('writes a PNG of the declared dimensions', () => {
    expect(png.toString('ascii', 1, 4)).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(ATLAS_PX)
    expect(png.readUInt32BE(20)).toBe(ATLAS_PX)
  })

  it('carries no timestamp or text metadata, which is what keeps runs comparable', () => {
    const types = chunkTypes(png)
    expect(types).toContain('IHDR')
    for (const metadata of ['tIME', 'tEXt', 'iTXt', 'zTXt']) {
      expect(types).not.toContain(metadata)
    }
  })

  it('renders byte-identically on a second run', () => {
    const digest = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex')
    expect(digest(renderAtlas(training!))).toBe(digest(png))
  })
})

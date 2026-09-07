import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { cellPixels, planAtlases, rasterizeAtlas } from '../tools/pool/atlas.js'
import { measureCell, type CellPixels, type FeatureVector } from '../tools/pool/features.js'
import {
  CELL_PX,
  FEATURE_IDS,
  LEAF_FILL,
  MEASUREMENT_PARAMETERS,
  STEM_FILL,
} from '../tools/pool/params.js'
import { samplePool } from '../tools/pool/sample.js'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))

/** A blank cell: fully transparent, which is what a cell is before an apple is drawn. */
function blank(size: number): Uint8Array {
  return new Uint8Array(size * size * 4)
}

/** Paints an opaque rectangle, so a hand-checked cell can be written as a few calls. */
function paint(
  cell: Uint8Array,
  size: number,
  box: { x: number; y: number; w: number; h: number },
  colour: readonly [number, number, number],
): void {
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) {
      const i = (y * size + x) * 4
      cell[i] = colour[0]
      cell[i + 1] = colour[1]
      cell[i + 2] = colour[2]
      cell[i + 3] = 255
    }
  }
}

function rgb(hex: string): readonly [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

/**
 * Hand-checked cells are 32px, and none of the overlay masks reaches into one.
 *
 * Both declared ellipses are placed for a 128px cell and sit entirely outside a 32px
 * one, so these cases exercise the arithmetic of each feature with nothing masked.
 * Masking has its own tests in `pool-overlays.test.ts`, against the geometry it is
 * declared from.
 */
const SIZE = 32
const SKIN = [200, 100, 50] as const

describe('every sensitivity is declared, with the reason for its value', () => {
  it('carries a value and a non-empty reason for each', () => {
    const parameters = Object.entries(MEASUREMENT_PARAMETERS)
    expect(parameters.length).toBeGreaterThan(0)
    for (const [name, parameter] of parameters) {
      expect(parameter, `${name} is not a declared parameter`).toHaveProperty('value')
      expect(typeof parameter.reason, `${name} declares no reason`).toBe('string')
      expect(parameter.reason.trim().length, `${name}'s reason is empty`).toBeGreaterThan(20)
    }
  })

  it('is read by the measuring code, every parameter of it', () => {
    const source = readFileSync(`${repoRoot}tools/pool/features.ts`, 'utf8')
    for (const name of Object.keys(MEASUREMENT_PARAMETERS)) {
      expect(source, `nothing reads the declared parameter ${name}`).toContain(`${name}.value`)
    }
  })

  it('keeps every threshold out of the measuring code, where a reason could not follow it', () => {
    const source = readFileSync(`${repoRoot}tools/pool/features.ts`, 'utf8')
    const comparisons = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
      // Bit shifts pack a colour into one number; they are not thresholds, and their
      // widths are the arithmetic rather than a sensitivity somebody chose.
      .map((line) => line.replace(/<<|>>/g, ' '))
      // The RGBA byte-length guard is arithmetic about the buffer, not a threshold.
      .filter((line) => !line.includes('pixels.length'))
      .filter((line) => /[<>]=?/.test(line))

    for (const [name, parameter] of Object.entries(MEASUREMENT_PARAMETERS)) {
      if (typeof parameter.value !== 'number') continue
      for (const line of comparisons) {
        // The value may only reach a comparison as `MEASUREMENT_PARAMETERS.x.value` —
        // never written out, where a later reader would have no reason to disagree with.
        if (line.includes(name)) continue
        expect(line, `features.ts compares against ${name}'s value ${parameter.value} directly`).not.toMatch(
          new RegExp(`[^\\w.]${parameter.value}[^\\w.]`),
        )
      }
    }
  })
})

describe('what each feature measures, on cells small enough to check by hand', () => {
  it('reads redness as the mean of red minus green over the apple', () => {
    const cell = blank(SIZE)
    paint(cell, SIZE, { x: 4, y: 4, w: 4, h: 4 }, SKIN)
    // (200 - 100) / 255, over sixteen identical pixels.
    expect(measureCell(cell, SIZE).redness).toBeCloseTo(100 / 255, 4)
  })

  it.each([
    [8, 4, 2],
    [4, 8, 0.5],
    [6, 6, 1],
  ])('reads roundness as a %ix%i silhouette being %f wide for its height', (w, h, expected) => {
    const cell = blank(SIZE)
    paint(cell, SIZE, { x: 4, y: 4, w, h }, SKIN)
    expect(measureCell(cell, SIZE).roundness).toBeCloseTo(expected, 4)
  })

  it('reads textureVar as the spread of luminance, and zero on a flat apple', () => {
    const flat = blank(SIZE)
    paint(flat, SIZE, { x: 4, y: 4, w: 4, h: 4 }, SKIN)
    expect(measureCell(flat, SIZE).textureVar).toBe(0)

    const twoTone = blank(SIZE)
    paint(twoTone, SIZE, { x: 4, y: 4, w: 4, h: 4 }, [100, 100, 100])
    paint(twoTone, SIZE, { x: 8, y: 4, w: 4, h: 4 }, [200, 200, 200])
    // Half at 100/255 and half at 200/255: the standard deviation is half the gap.
    expect(measureCell(twoTone, SIZE).textureVar).toBeCloseTo(50 / 255, 4)
  })

  it('reads darkSpotArea as the share of the apple in patches darker than its own colour', () => {
    const cell = blank(SIZE)
    paint(cell, SIZE, { x: 4, y: 4, w: 10, h: 10 }, SKIN)
    // A quarter as bright as the skin, over sixteen of the hundred pixels.
    paint(cell, SIZE, { x: 5, y: 5, w: 4, h: 4 }, [50, 25, 12])
    expect(measureCell(cell, SIZE).darkSpotArea).toBeCloseTo(16 / 100, 4)
  })

  it('reads spotCount as the number of off-colour patches, and ignores the small ones', () => {
    const two = blank(SIZE)
    paint(two, SIZE, { x: 4, y: 4, w: 12, h: 12 }, SKIN)
    paint(two, SIZE, { x: 5, y: 5, w: 3, h: 3 }, [20, 200, 220])
    paint(two, SIZE, { x: 11, y: 11, w: 3, h: 3 }, [20, 200, 220])
    expect(measureCell(two, SIZE).spotCount).toBe(2)

    const tooSmall = blank(SIZE)
    paint(tooSmall, SIZE, { x: 4, y: 4, w: 12, h: 12 }, SKIN)
    // Four pixels, under the declared minimum of eight.
    paint(tooSmall, SIZE, { x: 5, y: 5, w: 2, h: 2 }, [20, 200, 220])
    expect(MEASUREMENT_PARAMETERS.minimumBlobPixels.value).toBeGreaterThan(4)
    expect(measureCell(tooSmall, SIZE).spotCount).toBe(0)
  })

  it('leaves the stem and the leaf out of the apple entirely', () => {
    const withDecorations = blank(SIZE)
    paint(withDecorations, SIZE, { x: 4, y: 8, w: 8, h: 8 }, SKIN)
    paint(withDecorations, SIZE, { x: 4, y: 4, w: 8, h: 4 }, rgb(STEM_FILL))
    paint(withDecorations, SIZE, { x: 12, y: 4, w: 4, h: 4 }, rgb(LEAF_FILL))

    const bare = blank(SIZE)
    paint(bare, SIZE, { x: 4, y: 8, w: 8, h: 8 }, SKIN)

    expect(measureCell(withDecorations, SIZE)).toEqual(measureCell(bare, SIZE))
  })

  it('refuses a cell with no apple in it rather than reporting a number for one', () => {
    expect(() => measureCell(blank(SIZE), SIZE)).toThrow(/no apple/)
  })

  it('refuses a buffer too short to be the cell it is called with', () => {
    expect(() => measureCell(blank(8), SIZE)).toThrow(/RGBA/)
  })
})

describe('what the measurement is not allowed to see', () => {
  it('takes pixels and a cell size, and has no parameter an attribute could arrive through', () => {
    // A type-level statement of the provenance requirement: if `measureCell` ever grew a
    // parameter for the image's category, attributes, split or role, this assignment
    // would stop compiling and `npm run typecheck` would say so.
    const signature: (pixels: CellPixels, size: number) => FeatureVector = measureCell
    expect(signature).toBe(measureCell)
    expect(measureCell.length).toBe(2)
  })

  it('imports nothing that knows what an image is', () => {
    const source = readFileSync(`${repoRoot}tools/pool/features.ts`, 'utf8')
    const imports = [...source.matchAll(/from '(\.[^']+)'/g)].map((match) => match[1])
    // `params.ts` holds pool-wide declared data and nothing per-image. Every other
    // module in `tools/pool/` carries an attribute vector, a category or a split.
    expect(imports).toEqual(['./params.js'])
  })

  it('names no per-image value the manifest records', () => {
    const source = readFileSync(`${repoRoot}tools/pool/features.ts`, 'utf8')
    for (const forbidden of ['category', 'attributes', 'wormVisibility', 'hue', 'lighting', 'split', 'role']) {
      const inCode = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n')
      expect(inCode, `features.ts reads ${forbidden}`).not.toMatch(new RegExp(`\\b${forbidden}\\b`))
    }
  })
})

describe('measuring the same pixels twice gives the same answer', () => {
  const plan = planAtlases(samplePool()).find((candidate) => candidate.split === 'training')
  if (plan === undefined) throw new Error('the pool should plan a training atlas')
  const atlas = rasterizeAtlas(plan)
  const sample = [0, 1, 7, 42, 199]

  it('gives an identical vector for a second pass over the same atlas', () => {
    for (const cell of sample) {
      const pixels = cellPixels(atlas, cell)
      expect(measureCell(pixels, CELL_PX)).toEqual(measureCell(pixels, CELL_PX))
    }
  })

  it('gives an identical vector after the atlas is rasterized again', () => {
    const again = rasterizeAtlas(plan)
    for (const cell of sample) {
      expect(measureCell(cellPixels(again, cell), CELL_PX)).toEqual(
        measureCell(cellPixels(atlas, cell), CELL_PX),
      )
    }
  })

  it('gives an identical vector in a process that shares nothing with this one', () => {
    const imageId = plan.images[0]?.id
    if (imageId === undefined) throw new Error('the training atlas should hold images')
    const printed = execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['vite-node', 'tools/pool/measure.ts', '--', '--image', imageId],
      { cwd: repoRoot, encoding: 'utf8' },
    )
    expect(JSON.parse(printed.trim())).toEqual(measureCell(cellPixels(atlas, 0), CELL_PX))
  }, 120_000)

  it('records every declared feature and nothing else', () => {
    const vector = measureCell(cellPixels(atlas, 0), CELL_PX)
    expect(Object.keys(vector).sort()).toEqual([...FEATURE_IDS].sort())
    for (const id of FEATURE_IDS) expect(Number.isFinite(vector[id])).toBe(true)
  })
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it } from 'vitest'
import type { ImageAttributes } from '../tools/pool/bands.js'
import { toSvg } from '../tools/pool/draw.js'
import { OVERLAY_REGIONS } from '../tools/pool/features.js'
import {
  CELL_PX,
  FEATURE_IDS,
  FEATURE_MASKS,
  GLOSS_COEFFICIENTS,
  MAX_GLOSS,
  MEASUREMENT_PARAMETERS,
  OVERLAY_IDS,
  SHADE_ELLIPSE,
  glossEllipse,
  insideOverlay,
  WORM_VISIBILITY,
} from '../tools/pool/params.js'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const source = (path: string): string => readFileSync(`${repoRoot}${path}`, 'utf8')

const BASE: ImageAttributes = {
  hue: -18,
  roundness: 0.95,
  gloss: 0.7,
  lighting: 0.5,
  wormVisibility: 0,
}

function renderCell(attributes: ImageAttributes): { pixels: Buffer; width: number } {
  const rendered = new Resvg(toSvg(attributes)).render()
  return { pixels: rendered.pixels, width: rendered.width }
}

/**
 * One declared ellipse, painted on its own, as the renderer covers it.
 *
 * The point of comparing against the renderer rather than against arithmetic is that
 * `insideOverlay` and resvg have to agree about what "inside a rotated ellipse" means.
 * A sign error in the rotation would leave both the drawing and the measurement
 * self-consistent and put the mask somewhere the highlight is not.
 */
function paintedEllipse(ellipse: {
  cx: number
  cy: number
  rx: number
  ry: number
  rotation: number
}): Uint8Array {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_PX}" height="${CELL_PX}" viewBox="0 0 ${CELL_PX} ${CELL_PX}">`,
    `<ellipse cx="${ellipse.cx}" cy="${ellipse.cy}" rx="${ellipse.rx}" ry="${ellipse.ry}" fill="#000" transform="rotate(${ellipse.rotation} ${ellipse.cx} ${ellipse.cy})"/>`,
    '</svg>',
  ].join('')
  const rendered = new Resvg(svg).render()
  const covered = new Uint8Array(CELL_PX * CELL_PX)
  for (let p = 0; p < CELL_PX * CELL_PX; p += 1) {
    covered[p] = (rendered.pixels[p * 4 + 3] ?? 0) > 200 ? 1 : 0
  }
  return covered
}

describe('the overlay ellipses are declared once and read twice', () => {
  it('draws the shadow and the highlight at the coordinates the declaration holds', () => {
    const svg = toSvg(BASE)
    expect(svg).toContain(`cx="${SHADE_ELLIPSE.cx}" cy="${SHADE_ELLIPSE.cy}" rx="${SHADE_ELLIPSE.rx}" ry="${SHADE_ELLIPSE.ry}"`)

    // The markup rounds radii to two decimals so the emitted document is byte-stable;
    // the declaration keeps them exact. Same ellipse, one of them written down.
    const two = (value: number): number => Math.round(value * 100) / 100
    const highlight = glossEllipse(BASE.gloss)
    expect(svg).toContain(
      `cx="${highlight.cx}" cy="${highlight.cy}" rx="${two(highlight.rx)}" ry="${two(highlight.ry)}"`,
    )
    expect(svg).toContain(`rotate(${highlight.rotation} ${highlight.cx} ${highlight.cy})`)
  })

  it('leaves the drawing and the measurement no private copy of either ellipse', () => {
    // The literals that used to live in `draw.ts`. Either file naming one again is the
    // drift this extraction exists to prevent: the two would agree until somebody moved
    // one of them.
    const literals = ['42', '62', '56', '0.86', '0.41', '-24', '10']
    for (const path of ['tools/pool/draw.ts', 'tools/pool/features.ts']) {
      const body = source(path)
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n')
      const ellipseLines = body.split('\n').filter((line) => line.includes('ellipse') || line.includes('Ellipse'))
      for (const line of ellipseLines) {
        for (const literal of literals) {
          expect(line, `${path} writes the overlay literal ${literal} beside an ellipse`).not.toMatch(
            new RegExp(`[^\\w.-]${literal}[^\\w.]`),
          )
        }
      }
    }
  })

  it('hands the measurement the very objects the drawing is placed from', () => {
    expect(OVERLAY_REGIONS.shade).toBe(SHADE_ELLIPSE)
    expect(OVERLAY_REGIONS.gloss).toEqual(glossEllipse(MAX_GLOSS))
    expect(Object.keys(OVERLAY_REGIONS).sort()).toEqual([...OVERLAY_IDS].sort())
  })

  it.each([...OVERLAY_IDS])('agrees with the renderer about where the %s overlay is', (overlay) => {
    const ellipse = OVERLAY_REGIONS[overlay]
    const painted = paintedEllipse(ellipse)
    let disagreements = 0
    for (let p = 0; p < CELL_PX * CELL_PX; p += 1) {
      const x = (p % CELL_PX) + 0.5
      const y = Math.floor(p / CELL_PX) + 0.5
      if (insideOverlay(ellipse, x, y) !== (painted[p] === 1)) disagreements += 1
    }
    // Only the antialiased rim may differ, and a rim is O(perimeter) pixels against an
    // area of thousands. A rotation error would put the two shapes hundreds apart.
    expect(disagreements).toBeLessThan(2 * (ellipse.rx + ellipse.ry))
  })
})

describe('which overlays each feature leaves out', () => {
  it('declares a masking rule for every feature, exactly once', () => {
    expect(Object.keys(FEATURE_MASKS).sort()).toEqual([...FEATURE_IDS].sort())
    expect(Object.keys(FEATURE_MASKS)).toHaveLength(FEATURE_IDS.length)
  })

  it('names only overlays the pool declares', () => {
    for (const [feature, overlays] of Object.entries(FEATURE_MASKS)) {
      expect(new Set(overlays).size, `${feature} names an overlay twice`).toBe(overlays.length)
      for (const overlay of overlays) expect(OVERLAY_IDS).toContain(overlay)
    }
  })

  it('masks both overlays for the spot features and neither for the rest', () => {
    // Stated here as well as in `params.ts` because it is the decision the design turns
    // on: masking away the shadow would leave `redness` a clean read of `hue`, and
    // leaving it in makes the spot features measure the shadow's edge.
    expect(FEATURE_MASKS.darkSpotArea).toEqual(['shade', 'gloss'])
    expect(FEATURE_MASKS.spotCount).toEqual(['shade', 'gloss'])
    expect(FEATURE_MASKS.redness).toEqual([])
    expect(FEATURE_MASKS.textureVar).toEqual([])
    expect(FEATURE_MASKS.roundness).toEqual([])
  })
})

describe('the highlight mask reads nothing about the image it masks', () => {
  it('is sized at the largest gloss the pool can draw, so it never varies', () => {
    expect(OVERLAY_REGIONS.gloss.rx).toBe(GLOSS_COEFFICIENTS.rxBase + GLOSS_COEFFICIENTS.rxPerGloss * MAX_GLOSS)
    expect(OVERLAY_REGIONS.gloss.ry).toBe(GLOSS_COEFFICIENTS.ryBase + GLOSS_COEFFICIENTS.ryPerGloss * MAX_GLOSS)
  })

  it('covers the highlight of every gloss the pool draws', () => {
    for (const gloss of [0, 0.2, 0.5, 0.8, 0.95, MAX_GLOSS]) {
      const drawn = glossEllipse(gloss)
      expect(drawn.rx).toBeLessThanOrEqual(OVERLAY_REGIONS.gloss.rx)
      expect(drawn.ry).toBeLessThanOrEqual(OVERLAY_REGIONS.gloss.ry)
      expect(drawn.cx).toBe(OVERLAY_REGIONS.gloss.cx)
      expect(drawn.cy).toBe(OVERLAY_REGIONS.gloss.cy)
      expect(drawn.rotation).toBe(OVERLAY_REGIONS.gloss.rotation)
    }
  })

  it('is the same region whatever the apple, which is what makes masking permitted', () => {
    const shapes = [0.2, 0.6, 0.95].map((gloss) =>
      JSON.stringify(OVERLAY_REGIONS.gloss) + JSON.stringify(glossEllipse(MAX_GLOSS)) + gloss * 0,
    )
    expect(new Set(shapes).size).toBe(1)
  })
})

describe('masking the overlays does not mask what the spot features look for', () => {
  /**
   * The pixels a worm at full visibility changes, over several body colours.
   *
   * Taken from the rendering rather than from the worm's markup: the question is where
   * the worm ends up on the cell, antialiasing included, and the markup would need the
   * same geometry read a second time to answer it.
   */
  function wormPixels(): Set<number> {
    const covered = new Set<number>()
    for (const hue of [-30, -18, -6]) {
      const clean = renderCell({ ...BASE, hue, wormVisibility: 0 })
      const wormy = renderCell({ ...BASE, hue, wormVisibility: 1 })
      for (let p = 0; p < CELL_PX * CELL_PX; p += 1) {
        const i = p * 4
        const differs =
          clean.pixels[i] !== wormy.pixels[i] ||
          clean.pixels[i + 1] !== wormy.pixels[i + 1] ||
          clean.pixels[i + 2] !== wormy.pixels[i + 2] ||
          clean.pixels[i + 3] !== wormy.pixels[i + 3]
        if (differs) covered.add(p)
      }
    }
    return covered
  }

  const worm = wormPixels()

  it('finds a worm to check against at all', () => {
    expect(worm.size).toBeGreaterThan(400)
  })

  function swallowedBy(overlay: (typeof OVERLAY_IDS)[number]): number[] {
    const ellipse = OVERLAY_REGIONS[overlay]
    return [...worm].filter((p) =>
      insideOverlay(ellipse, (p % CELL_PX) + 0.5, Math.floor(p / CELL_PX) + 0.5),
    )
  }

  it('keeps the shadow mask entirely clear of the worm at its largest', () => {
    const swallowed = swallowedBy('shade')
    expect(
      swallowed.map((p) => `(${p % CELL_PX},${Math.floor(p / CELL_PX)})`),
      `the shadow mask covers ${swallowed.length} pixels the worm is drawn on`,
    ).toEqual([])
  })

  /**
   * The highlight mask is *not* entirely clear of the worm, and the number is recorded
   * here rather than rounded off.
   *
   * At `gloss = 1` the highlight ellipse reaches x = 68, and the worm hole's left rim
   * starts at x = 67, so eleven pixels of the worm's outer edge fall inside the mask.
   * `design.md` claimed the geometry left both masks clear; measuring it says otherwise
   * for this one. Measured, it is eleven pixels — 2.3% of the worm. What the requirement
   * is actually for, that masking the overlays does not mask the thing the spot features
   * exist to find, is checked below and holds with room.
   */
  it('lets the highlight mask clip no more than the worm rim it is measured to clip', () => {
    const swallowed = swallowedBy('gloss')
    expect(swallowed.length).toBeLessThanOrEqual(11)
    expect(swallowed.length / worm.size).toBeLessThan(0.03)
  })

  it('leaves a worm at every visibility the pool draws well above the minimum blob', () => {
    const minimum = MEASUREMENT_PARAMETERS.minimumBlobPixels.value
    // The smallest worm the pool contains sits at the bottom of the subtle band.
    for (const visibility of [WORM_VISIBILITY.poolSubtle.min, 0.5, MAX_GLOSS]) {
      const clean = renderCell({ ...BASE, wormVisibility: 0 })
      const wormy = renderCell({ ...BASE, wormVisibility: visibility })
      let survivors = 0
      for (let p = 0; p < CELL_PX * CELL_PX; p += 1) {
        const i = p * 4
        const differs =
          clean.pixels[i] !== wormy.pixels[i] ||
          clean.pixels[i + 1] !== wormy.pixels[i + 1] ||
          clean.pixels[i + 2] !== wormy.pixels[i + 2]
        if (!differs) continue
        const x = (p % CELL_PX) + 0.5
        const y = Math.floor(p / CELL_PX) + 0.5
        if (OVERLAY_IDS.some((overlay) => insideOverlay(OVERLAY_REGIONS[overlay], x, y))) continue
        survivors += 1
      }
      expect(survivors, `a worm at visibility ${visibility} survives masking`).toBeGreaterThan(
        minimum * 4,
      )
    }
  })
})

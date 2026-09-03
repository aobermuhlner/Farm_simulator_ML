/**
 * Packs apples into atlases and rasterizes them.
 *
 * Composition happens in SVG, not in pixels: one atlas is a single SVG document holding
 * up to `CELLS_PER_ATLAS` apple groups at their cell offsets, which resvg rasterizes in
 * one pass. That is why no image-compositing dependency is needed — the alternative,
 * rendering 1200 small PNGs and blitting them together, would have meant `sharp` and a
 * build toolchain, which `design.md` rejected.
 */

import { Resvg } from '@resvg/resvg-js'

import { appleMarkup, SVG_DEFS } from './draw.js'
import { ATLAS_PX, CELLS_PER_ATLAS, CELL_PX, type SplitName } from './params.js'
import type { SampledImage } from './sample.js'

/** Cells across, and down, one atlas. */
export const ATLAS_GRID = ATLAS_PX / CELL_PX

/** One atlas: its id, the split it serves, and the images it holds in cell order. */
export interface AtlasPlan {
  readonly id: string
  readonly split: SplitName
  readonly images: readonly SampledImage[]
}

/** The top-left pixel of a cell, which is all a client needs to crop it. */
export function cellOrigin(cell: number): { readonly x: number; readonly y: number } {
  return {
    x: (cell % ATLAS_GRID) * CELL_PX,
    y: Math.floor(cell / ATLAS_GRID) * CELL_PX,
  }
}

/**
 * Splits the pool into atlases, one split at a time.
 *
 * Atlases never mix splits. It costs a little empty space in the training atlas and buys
 * the ability to fetch only what a screen needs — browsing the training split should not
 * pull the harvest's four megapixels along with it.
 */
export function planAtlases(images: readonly SampledImage[]): readonly AtlasPlan[] {
  const plans: AtlasPlan[] = []
  for (const split of ['training', 'pool'] as const) {
    const forSplit = images.filter((image) => image.split === split)
    for (let start = 0, index = 0; start < forSplit.length; start += CELLS_PER_ATLAS, index += 1) {
      plans.push({
        id: `atlas-${split}-${index}`,
        split,
        images: forSplit.slice(start, start + CELLS_PER_ATLAS),
      })
    }
  }
  return plans
}

/** One atlas as an SVG document. Cell order is the order the images arrive in. */
export function atlasSvg(plan: AtlasPlan): string {
  if (plan.images.length > CELLS_PER_ATLAS) {
    throw new Error(`atlas ${plan.id} holds ${plan.images.length} images, capacity is ${CELLS_PER_ATLAS}`)
  }

  const cells = plan.images.map((image, cell) => {
    const { x, y } = cellOrigin(cell)
    return `<g transform="translate(${x} ${y})">${appleMarkup(image.attributes, `${plan.id}-clip-${cell}`)}</g>`
  })

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS_PX}" height="${ATLAS_PX}" viewBox="0 0 ${ATLAS_PX} ${ATLAS_PX}">`,
    `<defs>${SVG_DEFS}</defs>`,
    ...cells,
    '</svg>',
  ].join('')
}

/**
 * Rasterizes one atlas.
 *
 * resvg writes a minimal PNG with no timestamp or producer chunk, which is what makes
 * "same seed, same bytes" hold across runs and machines. The checksum test in
 * `test/pool-atlas.test.ts` is what keeps that true if the renderer ever changes.
 */
export function renderAtlas(plan: AtlasPlan): Buffer {
  return Buffer.from(new Resvg(atlasSvg(plan)).render().asPng())
}

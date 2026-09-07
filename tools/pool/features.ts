/**
 * Measures the five declared features from one rasterized cell.
 *
 * `specs/measured-features/spec.md` — a feature is computed from an image's delivered
 * pixels and from drawing geometry declared for the pool as a whole. Nothing here can do
 * otherwise, and that is enforced by the signature rather than by review: `measureCell`
 * takes pixels and a cell size, and there is no parameter through which a category, an
 * attribute, a split or a training role could reach it.
 *
 * What the measurement buys is not that it is unable to recover an attribute — `roundness`
 * measured here tracks the `roundness` attribute closely, and `redness` tracks `hue`. It is
 * that it recovers them *through the picture*, so a shadow or a highlight moves the number
 * and the recorded attribute does not. That difference is the lesson: the rule a student
 * writes is only as good as the measurement it is written over.
 *
 * Every threshold below comes from `MEASUREMENT_PARAMETERS` in `params.ts`, with the reason
 * for its value recorded beside it. None of them is a literal here, because the difficulty
 * of a feature set is authored whether or not anyone admits it.
 */

import {
  FEATURE_IDS,
  FEATURE_MASKS,
  GLOSS_ELLIPSE_CENTRE,
  LEAF_FILL,
  MAX_GLOSS,
  MEASUREMENT_PARAMETERS,
  SHADE_ELLIPSE,
  STEM_FILL,
  glossEllipse,
  insideOverlay,
  type FeatureId,
  type OverlayEllipse,
  type ComparisonChannel,
  type OverlayId,
} from './params.js'

/** One image's measured features, as the manifest records them. */
export type FeatureVector = Readonly<Record<FeatureId, number>>

/** A cell's pixels, RGBA, row-major, `size * size * 4` bytes long. */
export type CellPixels = Uint8Array | Uint8ClampedArray | Buffer

function hexToRgb(hex: string): readonly [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

const STEM_RGB = hexToRgb(STEM_FILL)
const LEAF_RGB = hexToRgb(LEAF_FILL)

/**
 * The overlay regions, resolved once.
 *
 * The highlight is taken at `MAX_GLOSS` — the largest it can ever be drawn — so the
 * region excluded is identical for every image in the pool. Fitting the mask to the
 * highlight actually drawn would size it by `gloss`, which is a per-image generation
 * attribute and exactly what the provenance requirement forbids.
 */
export const OVERLAY_REGIONS: Readonly<Record<OverlayId, OverlayEllipse>> = {
  shade: SHADE_ELLIPSE,
  gloss: glossEllipse(MAX_GLOSS),
}

/** Rec. 709 luminance, in the 0..255 the pixels arrive in. */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Sum of the absolute channel differences between two colours, 0..765. */
function channelDistance(
  r: number,
  g: number,
  b: number,
  to: readonly [number, number, number],
): number {
  return Math.abs(r - to[0]) + Math.abs(g - to[1]) + Math.abs(b - to[2])
}

/**
 * How bright a pixel is, on the channel the comparison is declared to run on.
 *
 * Dispatching here rather than calling `luminance` directly is what makes
 * `darkSpotChannel` a declaration and not a comment: changing it changes what the
 * measurement sees, which is the only reason to write it down.
 */
function brightnessOn(channel: ComparisonChannel, r: number, g: number, b: number): number {
  return channel === 'luminance' ? luminance(r, g, b) : (r + g + b) / 3
}

/** How far a pixel is from a reference colour, on the declared channel, scaled to 0..3. */
function distanceOn(
  channel: ComparisonChannel,
  r: number,
  g: number,
  b: number,
  to: readonly [number, number, number],
): number {
  if (channel === 'luminance') {
    return Math.abs(luminance(r, g, b) - luminance(to[0], to[1], to[2])) / 255
  }
  return channelDistance(r, g, b, to) / 255
}

/** True when a pixel centre falls inside every named overlay. */
function masked(overlays: readonly OverlayId[], x: number, y: number): boolean {
  return overlays.some((overlay) =>
    insideOverlay(OVERLAY_REGIONS[overlay], x + 0.5, y + 0.5),
  )
}

/**
 * The apple: the opaque pixels of a cell, less the stem and the leaf.
 *
 * The decorations are painted under the body, so what survives of them lies outside the
 * silhouette — and they are the same shape, the same colour and in the same place in
 * every cell. Removing them by their declared fills reads pool-wide drawing data and
 * nothing about this apple. Leaving them in would peg the silhouette's top edge to the
 * leaf for every image at once, which would make the outline feature a constant.
 */
function bodyMask(pixels: CellPixels, size: number): Uint8Array {
  const { bodyAlpha, decorationColourCut } = MEASUREMENT_PARAMETERS
  const mask = new Uint8Array(size * size)
  for (let p = 0; p < size * size; p += 1) {
    const i = p * 4
    if ((pixels[i + 3] ?? 0) < bodyAlpha.value) continue
    const r = pixels[i] ?? 0
    const g = pixels[i + 1] ?? 0
    const b = pixels[i + 2] ?? 0
    if (channelDistance(r, g, b, STEM_RGB) < decorationColourCut.value) continue
    if (channelDistance(r, g, b, LEAF_RGB) < decorationColourCut.value) continue
    mask[p] = 1
  }
  return mask
}

/** The most common exact colour in a region, which flat fills make a meaningful mode. */
function modalColour(
  pixels: CellPixels,
  region: readonly number[],
): readonly [number, number, number] {
  const counts = new Map<number, number>()
  for (const p of region) {
    const i = p * 4
    const key = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best = -1
  let modal = 0
  for (const [key, count] of counts) {
    // Ties break towards the lower packed value, so the answer does not depend on the
    // iteration order a different engine might give the map.
    if (count > best || (count === best && key < modal)) {
      best = count
      modal = key
    }
  }
  return [(modal >> 16) & 255, (modal >> 8) & 255, modal & 255]
}

/** Sizes of the four-connected runs of flagged pixels, largest first. */
function blobSizes(flags: Uint8Array, size: number): number[] {
  const seen = new Uint8Array(flags.length)
  const sizes: number[] = []
  const stack: number[] = []
  for (let start = 0; start < flags.length; start += 1) {
    if (flags[start] === 0 || seen[start] === 1) continue
    let area = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const p = stack.pop() as number
      area += 1
      const x = p % size
      const y = (p - x) / size
      if (x > 0) push(p - 1)
      if (x < size - 1) push(p + 1)
      if (y > 0) push(p - size)
      if (y < size - 1) push(p + size)
    }
    sizes.push(area)
  }
  return sizes.sort((a, b) => b - a)

  function push(p: number): void {
    if (flags[p] === 1 && seen[p] === 0) {
      seen[p] = 1
      stack.push(p)
    }
  }
}

/** Values are rounded before they reach the manifest, so the file is byte-stable. */
function round(value: number): number {
  const factor = 10 ** MEASUREMENT_PARAMETERS.featureDecimals.value
  return Math.round(value * factor) / factor
}

/**
 * The five declared features of one cell.
 *
 * Pure: the same pixels give the same vector on any machine, in any process, with no
 * randomness, no clock and no state carried between calls.
 */
export function measureCell(pixels: CellPixels, size: number): FeatureVector {
  if (pixels.length < size * size * 4) {
    throw new Error(
      `a ${size}x${size} cell needs ${size * size * 4} bytes of RGBA, received ${pixels.length}`,
    )
  }

  const body = bodyMask(pixels, size)
  const all: number[] = []
  const spotRegion: number[] = []
  let minX = size
  let maxX = -1
  let minY = size
  let maxY = -1

  // `darkSpotArea` and `spotCount` mask the same two overlays, so the masked region is
  // gathered once. `FEATURE_MASKS` is still what decides it, and the assertion below is
  // what keeps that true if a later change gives them different masks.
  const spotMask = FEATURE_MASKS.darkSpotArea
  if (spotMask.join() !== FEATURE_MASKS.spotCount.join()) {
    throw new Error('darkSpotArea and spotCount are declared with different overlay masks')
  }

  for (let p = 0; p < size * size; p += 1) {
    if (body[p] === 0) continue
    all.push(p)
    const x = p % size
    const y = (p - x) / size
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (!masked(spotMask, x, y)) spotRegion.push(p)
  }

  if (all.length === 0 || spotRegion.length === 0) {
    throw new Error('no apple found in this cell: the measurement has nothing to read')
  }

  // redness and textureVar mask nothing, deliberately: a red apple in shadow measuring
  // less red is the contamination the feature exists to carry.
  let rednessSum = 0
  let luminanceSum = 0
  let luminanceSquares = 0
  for (const p of all) {
    const i = p * 4
    const r = pixels[i] ?? 0
    const g = pixels[i + 1] ?? 0
    const b = pixels[i + 2] ?? 0
    rednessSum += (r - g) / 255
    const l = luminance(r, g, b) / 255
    luminanceSum += l
    luminanceSquares += l * l
  }
  const mean = luminanceSum / all.length
  const variance = Math.max(0, luminanceSquares / all.length - mean * mean)

  const [mr, mg, mb] = modalColour(pixels, spotRegion)
  const { darkSpotLuminanceCut, darkSpotChannel, spotColourCut, spotChannel, minimumBlobPixels } =
    MEASUREMENT_PARAMETERS
  const modalBrightness = brightnessOn(darkSpotChannel.value, mr, mg, mb)

  const dark = new Uint8Array(size * size)
  const offColour = new Uint8Array(size * size)
  for (const p of spotRegion) {
    const i = p * 4
    const r = pixels[i] ?? 0
    const g = pixels[i + 1] ?? 0
    const b = pixels[i + 2] ?? 0
    if (brightnessOn(darkSpotChannel.value, r, g, b) < darkSpotLuminanceCut.value * modalBrightness) {
      dark[p] = 1
    }
    if (distanceOn(spotChannel.value, r, g, b, [mr, mg, mb]) > spotColourCut.value) offColour[p] = 1
  }

  const minimum = minimumBlobPixels.value
  const darkArea = blobSizes(dark, size)
    .filter((area) => area >= minimum)
    .reduce((sum, area) => sum + area, 0)
  const spots = blobSizes(offColour, size).filter((area) => area >= minimum).length

  return {
    redness: round(rednessSum / all.length),
    // Width over height of the silhouette's bounding box. A worm breaking the outline
    // widens or heightens that box, which is the contamination this feature carries.
    roundness: round((maxX - minX + 1) / (maxY - minY + 1)),
    darkSpotArea: round(darkArea / spotRegion.length),
    spotCount: spots,
    textureVar: round(Math.sqrt(variance)),
  }
}

/** The features in the declared order, for a caller writing them to the manifest. */
export function featureEntries(vector: FeatureVector): readonly (readonly [FeatureId, number])[] {
  return FEATURE_IDS.map((id) => [id, vector[id]] as const)
}

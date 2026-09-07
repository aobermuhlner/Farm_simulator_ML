/**
 * Turns one attribute vector into one stylized apple.
 *
 * `design.md` — nothing ever runs a model over these pixels, so the apple has to be
 * legible to a student rather than realistic to a network. That is why the drawing is
 * flat shapes with one shading overlay instead of anything photographic.
 *
 * The mapping is deliberately single-valued: each attribute owns one part of the
 * drawing, and `appleParts` exposes those parts so a test can assert that changing one
 * attribute moves one part and nothing else. Without that structure "hue changed the
 * gradient and so did lighting" becomes untestable folklore.
 *
 *   hue             -> body.fill
 *   roundness       -> body.d
 *   lighting        -> shade.opacity
 *   gloss           -> gloss.opacity, gloss.rx, gloss.ry
 *   wormVisibility  -> worm.opacity, worm.scale
 */

import type { ImageAttributes } from './bands.js'
import {
  CELL_PX,
  GLOSS_COEFFICIENTS,
  GLOSS_ELLIPSE_CENTRE,
  LEAF_FILL,
  SHADE_COEFFICIENTS,
  SHADE_ELLIPSE,
  STEM_FILL,
  bodyTone,
} from './params.js'

/** Rounds to two decimals so the emitted SVG is byte-stable and readable. */
function n(value: number): number {
  return Math.round(value * 100) / 100
}

/** Hue as a positive angle on the colour wheel. Attributes carry it signed. */
export function hueDegrees(hue: number): number {
  return n(((hue % 360) + 360) % 360)
}

/**
 * HSL to a hex colour.
 *
 * Colours are converted here rather than emitted as `hsl(...)` because resvg silently
 * renders a colour it cannot parse as black: it rejects the space-separated CSS Color 4
 * form with a fractional hue, and hues here carry one decimal. That produced an atlas of
 * black apples with no error anywhere, so the renderer is no longer trusted with colour
 * syntax at all. `test/pool-drawing.test.ts` asserts against rendered pixels to keep it
 * that way.
 */
export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = hueDegrees(hue) / 60
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const second = chroma * (1 - Math.abs((h % 2) - 1))
  const base = lightness - chroma / 2

  const [r, g, b] =
    h < 1
      ? [chroma, second, 0]
      : h < 2
        ? [second, chroma, 0]
        : h < 3
          ? [0, chroma, second]
          : h < 4
            ? [0, second, chroma]
            : h < 5
              ? [second, 0, chroma]
              : [chroma, 0, second]

  const channel = (value: number): string =>
    Math.round((value + base) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/**
 * The colour one hue is filled with.
 *
 * Saturation and lightness used to be two constants in this file. They are now the
 * `BODY_TONE` ramp in `params.ts`, because a dichromat cannot separate red from green
 * chromatically at all and the separation has to come from lightness instead — see
 * `openspec/changes/colour-accessibility/design.md`. Hue is still the only attribute that
 * moves colour, so the one-attribute-one-part decomposition below is unchanged.
 */
export function bodyFill(hue: number): string {
  const { saturation, lightness } = bodyTone(hue)
  return hslToHex(hue, saturation, lightness)
}

/** The apple silhouette. Rounder apples are taller and have a shallower top notch. */
export function bodyPath(roundness: number): string {
  const cx = CELL_PX / 2
  const cy = CELL_PX * 0.55
  const rx = 40
  const ry = n(34 + 10 * roundness)
  const notch = n(13 - 9 * roundness)
  const lobe = n(7 * (1 - roundness))

  const top = n(cy - ry + notch)
  return [
    `M ${cx} ${top}`,
    `C ${n(cx - lobe - rx * 0.55)} ${n(cy - ry - 2)} ${n(cx - rx)} ${n(cy - ry * 0.35)} ${n(cx - rx)} ${n(cy)}`,
    `C ${n(cx - rx)} ${n(cy + ry * 0.75)} ${n(cx - rx * 0.45)} ${n(cy + ry)} ${cx} ${n(cy + ry)}`,
    `C ${n(cx + rx * 0.45)} ${n(cy + ry)} ${n(cx + rx)} ${n(cy + ry * 0.75)} ${n(cx + rx)} ${n(cy)}`,
    `C ${n(cx + rx)} ${n(cy - ry * 0.35)} ${n(cx + lobe + rx * 0.55)} ${n(cy - ry - 2)} ${cx} ${top}`,
    'Z',
  ].join(' ')
}

/** The drawing, decomposed so each attribute's effect is separately inspectable. */
export interface AppleParts {
  readonly body: { readonly fill: string; readonly d: string }
  readonly shade: { readonly opacity: number }
  readonly gloss: { readonly opacity: number; readonly rx: number; readonly ry: number }
  readonly worm: { readonly opacity: number; readonly scale: number } | undefined
}

/** The parts one attribute vector draws. */
export function appleParts(attributes: ImageAttributes): AppleParts {
  const { hue, roundness, gloss, lighting, wormVisibility } = attributes

  return {
    body: {
      fill: bodyFill(hue),
      d: bodyPath(roundness),
    },
    // Less light means more shadow over the same body colour, which keeps lighting a
    // single opacity rather than a second colour to keep in step with hue.
    shade: {
      opacity: quantize(SHADE_COEFFICIENTS.base + SHADE_COEFFICIENTS.perLighting * lighting),
    },
    gloss: {
      opacity: quantize(
        GLOSS_COEFFICIENTS.opacityBase + GLOSS_COEFFICIENTS.opacityPerGloss * gloss,
      ),
      rx: n(GLOSS_COEFFICIENTS.rxBase + GLOSS_COEFFICIENTS.rxPerGloss * gloss),
      ry: n(GLOSS_COEFFICIENTS.ryBase + GLOSS_COEFFICIENTS.ryPerGloss * gloss),
    },
    // A worm at zero visibility is not drawn at all, which is what green and clean red
    // apples get.
    worm:
      wormVisibility > 0
        ? { opacity: n(0.3 + 0.7 * wormVisibility), scale: n(0.5 + 0.5 * wormVisibility) }
        : undefined,
  }
}

/**
 * No gradients.
 *
 * Smooth radial gradients cost 4 MB of a measured 5.92 MB atlas set, because every apple
 * becomes hundreds of distinct colours for PNG to encode. Flat overlays at quantized
 * opacities keep gloss and lighting visible while leaving each apple a handful of
 * colours, which is what a stylized apple wanted to look like anyway.
 */
export const SVG_DEFS = ''

/** Opacities are quantized so the whole pool shares a small set of blended colours. */
function quantize(value: number): number {
  return Math.round(value * 20) / 20
}

/**
 * One apple as SVG markup, positioned by the caller.
 *
 * `clipId` scopes the body clip path, because an atlas holds hundreds of these in one
 * document and duplicate ids would silently clip every apple with the first one's shape.
 */
export function appleMarkup(attributes: ImageAttributes, clipId: string): string {
  const parts = appleParts(attributes)
  const cx = CELL_PX / 2

  const worm =
    parts.worm === undefined
      ? ''
      : [
          `<g opacity="${parts.worm.opacity}" transform="translate(${n(cx + 12)} ${n(CELL_PX * 0.36)}) scale(${parts.worm.scale})">`,
          // The hole first, so the worm reads as coming out of the apple.
          '<ellipse cx="0" cy="6" rx="9" ry="7" fill="#3b1f14" fill-opacity="0.85"/>',
          '<path d="M 0 6 C 2 -6 12 -8 15 -16 C 16 -20 12 -23 9 -21" fill="none" stroke="#e8d6a0" stroke-width="7" stroke-linecap="round"/>',
          '<circle cx="9" cy="-21" r="4.2" fill="#f2e6c2"/>',
          '<circle cx="10.5" cy="-22.5" r="1.1" fill="#2b1b10"/>',
          '</g>',
        ].join('')

  return [
    `<g>`,
    `<clipPath id="${clipId}"><path d="${parts.body.d}"/></clipPath>`,
    // Stem and leaf are constant: nothing in the lesson depends on them.
    `<path d="M ${cx} ${n(CELL_PX * 0.26)} C ${n(cx + 1)} ${n(CELL_PX * 0.18)} ${n(cx + 3)} ${n(CELL_PX * 0.14)} ${n(cx + 6)} ${n(CELL_PX * 0.11)}" fill="none" stroke="${STEM_FILL}" stroke-width="4.5" stroke-linecap="round"/>`,
    `<path d="M ${n(cx + 5)} ${n(CELL_PX * 0.15)} C ${n(cx + 16)} ${n(CELL_PX * 0.08)} ${n(cx + 26)} ${n(CELL_PX * 0.14)} ${n(cx + 22)} ${n(CELL_PX * 0.22)} C ${n(cx + 16)} ${n(CELL_PX * 0.27)} ${n(cx + 8)} ${n(CELL_PX * 0.22)} ${n(cx + 5)} ${n(CELL_PX * 0.15)} Z" fill="${LEAF_FILL}"/>`,
    `<path d="${parts.body.d}" fill="${parts.body.fill}"/>`,
    `<g clip-path="url(#${clipId})">`,
    // Shadow: a flat disc pushed down and right, so only its edge crosses the apple.
    // Placed by `SHADE_ELLIPSE`, which the feature measurement masks with — one ellipse,
    // not two copies of it.
    `<ellipse cx="${n(SHADE_ELLIPSE.cx)}" cy="${n(SHADE_ELLIPSE.cy)}" rx="${n(SHADE_ELLIPSE.rx)}" ry="${n(SHADE_ELLIPSE.ry)}" fill="#000" opacity="${parts.shade.opacity}"/>`,
    // Highlight: a flat tilted ellipse up and left, sized by gloss.
    `<ellipse cx="${n(GLOSS_ELLIPSE_CENTRE.cx)}" cy="${n(GLOSS_ELLIPSE_CENTRE.cy)}" rx="${parts.gloss.rx}" ry="${parts.gloss.ry}" fill="#fff" opacity="${parts.gloss.opacity}" transform="rotate(${GLOSS_ELLIPSE_CENTRE.rotation} ${n(GLOSS_ELLIPSE_CENTRE.cx)} ${n(GLOSS_ELLIPSE_CENTRE.cy)})"/>`,
    '</g>',
    worm,
    '</g>',
  ].join('')
}

/** One apple as a standalone SVG document, for previews and for tests. */
export function toSvg(attributes: ImageAttributes): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_PX}" height="${CELL_PX}" viewBox="0 0 ${CELL_PX} ${CELL_PX}">`,
    `<defs>${SVG_DEFS}</defs>`,
    appleMarkup(attributes, 'clip-0'),
    '</svg>',
  ].join('')
}

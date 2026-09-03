import { describe, expect, it } from 'vitest'
import type { ImageAttributes } from '../tools/pool/bands.js'
import { Resvg } from '@resvg/resvg-js'
import { appleParts, hslToHex, hueDegrees, toSvg, type AppleParts } from '../tools/pool/draw.js'

const BASE: ImageAttributes = {
  hue: 0,
  roundness: 0.95,
  gloss: 0.7,
  lighting: 0.5,
  wormVisibility: 0.5,
}

/** Leaf paths whose values differ between two decompositions, e.g. `body.fill`. */
function changedParts(before: AppleParts, after: AppleParts): string[] {
  const changed: string[] = []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    const a = (before as unknown as Record<string, unknown>)[key]
    const b = (after as unknown as Record<string, unknown>)[key]
    if (a === undefined || b === undefined) {
      if (a !== b) changed.push(key)
      continue
    }
    for (const field of Object.keys(a as object)) {
      const left = (a as Record<string, unknown>)[field]
      const right = (b as Record<string, unknown>)[field]
      if (left !== right) changed.push(`${key}.${field}`)
    }
  }
  return changed.sort()
}

function withOne(attribute: keyof ImageAttributes, value: number): ImageAttributes {
  return { ...BASE, [attribute]: value }
}

describe('attribute to drawing mapping', () => {
  it.each([
    ['hue', 120, ['body.fill']],
    ['roundness', 0.6, ['body.d']],
    ['lighting', 0.8, ['shade.opacity']],
    ['gloss', 0.2, ['gloss.opacity', 'gloss.rx', 'gloss.ry']],
    ['worm', 0.9, ['worm.opacity', 'worm.scale']],
  ] as const)('changes only its own part of the drawing: %s', (name, value, expected) => {
    const attribute = name === 'worm' ? 'wormVisibility' : (name as keyof ImageAttributes)
    const changed = changedParts(appleParts(BASE), appleParts(withOne(attribute, value)))
    expect(changed).toEqual([...expected].sort())
  })

  it('renders a different document for every attribute that moves', () => {
    const base = toSvg(BASE)
    for (const [attribute, value] of [
      ['hue', 120],
      ['roundness', 0.6],
      ['lighting', 0.8],
      ['gloss', 0.2],
      ['wormVisibility', 0.9],
    ] as const) {
      expect(toSvg(withOne(attribute, value))).not.toBe(base)
    }
  })

  it('is byte-stable for the same attributes', () => {
    expect(toSvg(BASE)).toBe(toSvg({ ...BASE }))
  })

  it('draws no worm at all when worm visibility is zero', () => {
    expect(appleParts({ ...BASE, wormVisibility: 0 }).worm).toBeUndefined()
    expect(toSvg({ ...BASE, wormVisibility: 0 })).not.toContain('#3b1f14')
  })

  it('scales the worm with its visibility, so a subtle worm is drawn smaller and fainter', () => {
    const subtle = appleParts({ ...BASE, wormVisibility: 0.2 }).worm
    const obvious = appleParts({ ...BASE, wormVisibility: 0.95 }).worm
    expect(subtle).toBeDefined()
    expect(obvious).toBeDefined()
    expect(subtle?.opacity).toBeLessThan(obvious?.opacity ?? 0)
    expect(subtle?.scale).toBeLessThan(obvious?.scale ?? 0)
  })

  it('darkens the apple as lighting falls', () => {
    const dim = appleParts({ ...BASE, lighting: 0.25 }).shade.opacity
    const bright = appleParts({ ...BASE, lighting: 0.85 }).shade.opacity
    expect(dim).toBeGreaterThan(bright)
  })

  it('turns a signed hue into a wheel angle', () => {
    expect(hueDegrees(0)).toBe(0)
    expect(hueDegrees(-5)).toBe(355)
    expect(hueDegrees(120)).toBe(120)
  })

  it('gives green a green body and red a red one', () => {
    expect(appleParts({ ...BASE, hue: 120 }).body.fill).toBe(hslToHex(120, 0.72, 0.46))
    expect(appleParts({ ...BASE, hue: -5 }).body.fill).toBe(hslToHex(355, 0.72, 0.46))
    expect(appleParts({ ...BASE, hue: 120 }).body.fill).toMatch(/^#[0-9a-f]{6}$/)
  })
})

/**
 * These assert what the renderer painted, not what the markup said.
 *
 * The distinction is not academic: resvg silently paints an unparseable colour black,
 * and a fractional hue in `hsl(...)` form is unparseable to it, so the first generated
 * atlas came out almost entirely black while every markup-level test passed.
 */
describe('what the rasterizer actually paints', () => {
  /** The colour at the middle of the apple body. */
  function centrePixel(attributes: ImageAttributes): [number, number, number, number] {
    const rendered = new Resvg(toSvg(attributes)).render()
    const { pixels, width } = rendered
    // Just below centre, clear of the stem and inside the body on every roundness.
    const x = Math.floor(width / 2)
    const y = Math.floor(rendered.height * 0.62)
    const at = (y * width + x) * 4
    return [pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0, pixels[at + 3] ?? 0]
  }

  it.each([
    ['integer hue', 0],
    ['fractional red hue', -4.7],
    ['fractional green hue', 118.3],
    ['fractional orange-red hue', 13.9],
  ] as const)('paints an opaque, non-black body for a %s', (_name, hue) => {
    const [r, g, b, a] = centrePixel({ ...BASE, hue, wormVisibility: 0 })
    expect(a).toBeGreaterThan(200)
    expect(r + g + b).toBeGreaterThan(60)
  })

  it('paints a red apple red and a green apple green', () => {
    const [redR, redG] = centrePixel({ ...BASE, hue: -2.3, wormVisibility: 0 })
    const [greenR, greenG] = centrePixel({ ...BASE, hue: 118.3, wormVisibility: 0 })
    expect(redR).toBeGreaterThan(redG)
    expect(greenG).toBeGreaterThan(greenR)
  })
})

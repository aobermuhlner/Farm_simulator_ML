import { describe, expect, it } from 'vitest'
import {
  POOL_THRESHOLDS,
  RED_GREEN_DEFICIENCIES,
  SIMULATIONS,
  compareSets,
  distanceFailure,
  lightnessFailure,
  type NamedColour,
  type Simulation,
} from '../src/colour-vision/index.js'
import { appleParts, bodyPath } from '../tools/pool/draw.js'
import {
  GREEN,
  HUE_DECIMALS,
  POOL_RED,
  UNIT_DECIMALS,
  WORM_VISIBILITY,
  type Band,
} from '../tools/pool/params.js'

/**
 * What a student with a red/green deficiency sees when they look at the pool.
 *
 * `openspec/changes/colour-accessibility/design.md` — the palette is measured rather than
 * looked at, and it is measured over the colours two *images* can show rather than over
 * the two hues at the middle of the bands. A student compares one apple against another,
 * and the two apples were drawn under different lighting; a check that compared only
 * equally-lit apples would pass a palette that is unreadable in practice.
 *
 * The colours come out of `appleParts` rather than being restated here, so this measures
 * the drawing the generator actually performs. Move a control point and the figures below
 * move with it.
 */

/** The two categories whose colours have to stay apart, and the bands they are drawn from. */
const CATEGORIES = { red: POOL_RED, green: GREEN } as const

/** Every value an attribute can be drawn at, at the resolution the manifest rounds to. */
function steps(min: number, max: number, decimals: number): readonly number[] {
  const step = 10 ** -decimals
  const out: number[] = []
  for (let raw = Math.round(min / step); raw <= Math.round(max / step); raw += 1) {
    out.push(Number((raw * step).toFixed(decimals)))
  }
  return out
}

/** Compositing one flat overlay over a colour, the way an SVG renderer does it. */
function over(base: string, overlay: string, alpha: number): string {
  const channel = (at: number): string => {
    const b = parseInt(base.slice(1 + at * 2, 3 + at * 2), 16)
    const o = parseInt(overlay.slice(1 + at * 2, 3 + at * 2), 16)
    return Math.round(b * (1 - alpha) + o * alpha)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(1)}${channel(2)}`
}

/**
 * Every colour a category's body can show, deduplicated by the hex a renderer emits.
 *
 * Two colours per drawn apple: the fill, and the fill under its shadow. The specular
 * highlight is deliberately absent — it is a near-white ellipse that reads as a highlight
 * rather than as the apple's colour, and the test below holds it to the bound that keeps
 * that true.
 */
function bodyColours(band: Band): readonly NamedColour[] {
  const seen = new Map<string, NamedColour>()
  const remember = (hex: string, name: string): void => {
    if (!seen.has(hex)) seen.set(hex, { name, hex })
  }

  for (const hue of steps(band.hue.min, band.hue.max, HUE_DECIMALS)) {
    const fill = appleParts({ hue, roundness: 1, gloss: 0, lighting: 0.5, wormVisibility: 0 }).body
      .fill
    remember(fill, `hue ${hue}, unshadowed`)
    for (const lighting of steps(band.lighting.min, band.lighting.max, UNIT_DECIMALS)) {
      const { shade } = appleParts({ hue, roundness: 1, gloss: 0, lighting, wormVisibility: 0 })
      remember(over(fill, '#000000', shade.opacity), `hue ${hue}, shadowed at ${shade.opacity}`)
    }
  }
  return [...seen.values()]
}

const RED_BODIES = bodyColours(CATEGORIES.red)
const GREEN_BODIES = bodyColours(CATEGORIES.green)

/** The whole cross product, per simulated vision, measured once and read many times. */
const MEASURED = Object.fromEntries(
  SIMULATIONS.map((simulation) => [simulation, compareSets(RED_BODIES, GREEN_BODIES, simulation)]),
) as Record<Simulation, ReturnType<typeof compareSets>>

/** Two decimals, the precision the design records its figures at. */
function round(value: number): number {
  return Math.round(value * 10) / 10
}

describe('the pool palette under simulated colour vision deficiency', () => {
  it('draws each category from more than one colour, so the check is not vacuous', () => {
    expect(RED_BODIES.length).toBeGreaterThan(10)
    expect(GREEN_BODIES.length).toBeGreaterThan(10)
  })

  it.each(RED_GREEN_DEFICIENCIES)(
    'keeps every red-versus-green pair apart under simulated %s',
    (deficiency) => {
      const failure = distanceFailure(MEASURED[deficiency], POOL_THRESHOLDS.deficiency)
      expect(failure).toBeUndefined()
    },
  )

  it.each(RED_GREEN_DEFICIENCIES)(
    "does not let the two categories' lightness ranges meet under simulated %s",
    (deficiency) => {
      // The property that makes the distinction survive an illumination difference. A
      // dichromat has lightness and little else, and per-image lighting moves apparent
      // lightness further than two hues differ.
      const failure = lightnessFailure(MEASURED[deficiency], POOL_THRESHOLDS.lightnessMargin, {
        one: 'red apples',
        two: 'green apples',
      })
      expect(failure).toBeUndefined()
    },
  )

  it('stays a genuine colour judgement under normal vision', () => {
    // Accessibility bought by making the palette drab would be a different lesson.
    expect(distanceFailure(MEASURED.normal, POOL_THRESHOLDS.normal)).toBeUndefined()
  })

  it('records what the palette measures, so a later edit shows what it moved', () => {
    // Recorded rather than asserted tightly: the thresholds above are the contract, and
    // these are the figures `design.md` states. A change to a control point is expected to
    // move them, and is expected to say so here.
    const figures = Object.fromEntries(
      (['normal', 'deuteranopia', 'protanopia'] as const).map((simulation) => [
        simulation,
        {
          worst: round(MEASURED[simulation].worst.distance),
          gap: round(MEASURED[simulation].lightness.gap),
        },
      ]),
    )
    // `design.md` states 55.0 for the normal-vision worst pair; measured here at 54.7.
    // Nothing rests on it — the normal-vision bar is 30 — so the measurement is what is
    // written down rather than the design's rounding of it. Every figure the design names
    // as load-bearing, the four below, reproduces exactly.
    expect(figures).toEqual({
      normal: { worst: 54.7, gap: 15.9 },
      deuteranopia: { worst: 10.2, gap: 10.5 },
      protanopia: { worst: 25.5, gap: 25.3 },
    })
  })
})

/** The area a closed path of cubic Béziers encloses, by the shoelace over a dense sample. */
function pathArea(path: string): number {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g)
  if (numbers === null) throw new Error(`no coordinates in path: ${path}`)
  const values = numbers.map(Number)
  const point = (at: number): readonly [number, number] => [
    values[at] as number,
    values[at + 1] as number,
  ]

  const samples: (readonly [number, number])[] = []
  const start = point(0)
  // "M x y" then four "C x1 y1 x2 y2 x y" segments, each read from the same flat list.
  for (let segment = 0; segment < 4; segment += 1) {
    const from = segment === 0 ? start : point(2 + (segment - 1) * 6 + 4)
    const [c1, c2, to] = [
      point(2 + segment * 6),
      point(2 + segment * 6 + 2),
      point(2 + segment * 6 + 4),
    ]
    for (let i = 1; i <= 200; i += 1) {
      const t = i / 200
      const u = 1 - t
      samples.push([
        u ** 3 * from[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * to[0],
        u ** 3 * from[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * to[1],
      ])
    }
  }

  let twice = 0
  for (let i = 0; i < samples.length; i += 1) {
    const [x1, y1] = samples[i] as readonly [number, number]
    const [x2, y2] = samples[(i + 1) % samples.length] as readonly [number, number]
    twice += x1 * y2 - x2 * y1
  }
  return Math.abs(twice) / 2
}

describe('the specular highlight stays a highlight', () => {
  it.each(Object.entries(CATEGORIES))(
    'covers at most a sixth of the smallest %s body it can sit on',
    (_category, band) => {
      // A highlight allowed past this bound is a second body colour, and would have to be
      // compared as one. The drawing already has the property; the bound is here so a
      // later edit to the gloss coefficients cannot quietly take it away.
      const { gloss } = appleParts({
        hue: band.hue.min,
        roundness: band.roundness.min,
        gloss: band.gloss.max,
        lighting: 0.5,
        wormVisibility: 0,
      })
      const highlight = Math.PI * gloss.rx * gloss.ry
      const body = pathArea(bodyPath(band.roundness.min))
      expect(highlight / body).toBeLessThanOrEqual(1 / 6)
    },
  )
})

/**
 * The worm.
 *
 * `wormy` is carried by a marking drawn over a red body rather than by the body's colour,
 * so the rule that applies to it is the one about markings: at least one element has to
 * stay visible against every body it can be drawn over. Not every element — the bite hole
 * is a dark shadow whose whole job is to sit close to the fruit, and requiring it to clear
 * the distance would forbid the detail that makes the shape read at all.
 */
const WORM_ELEMENTS = {
  'bite hole': { hex: '#3b1f14', opacity: 0.85 },
  'worm body': { hex: '#e8d6a0', opacity: 1 },
  'worm head': { hex: '#f2e6c2', opacity: 1 },
} as const

/** The faintest a pool worm is ever drawn, which is the case the check has to survive. */
const FAINTEST_WORM = 0.3 + 0.7 * WORM_VISIBILITY.poolSubtle.min

function markingColours(element: { readonly hex: string; readonly opacity: number }) {
  return RED_BODIES.map((body) => ({
    name: `${element.hex} over ${body.name}`,
    hex: over(body.hex, element.hex, element.opacity * FAINTEST_WORM),
  }))
}

describe('the worm stays visible against the apple it marks', () => {
  it.each(RED_GREEN_DEFICIENCIES)(
    'keeps at least one element clear of every red body under simulated %s',
    (deficiency) => {
      const clears = Object.entries(WORM_ELEMENTS).filter(([, element]) => {
        const marks = markingColours(element)
        // Each marking colour against the body it was drawn over, not against all of
        // them: an element is visible when it stands out from *its own* background.
        return marks.every(
          (mark, index) =>
            compareSets([mark], [RED_BODIES[index] as NamedColour], deficiency).worst.distance >=
            POOL_THRESHOLDS.deficiency,
        )
      })
      expect(clears.map(([name]) => name)).toContain('worm body')
    },
  )

  it('records that the bite hole alone would not carry the marking', () => {
    // Why the requirement asks for one element rather than all of them. The hole is a
    // shadow; it is the pale worm coming out of it that a student reads.
    const marks = markingColours(WORM_ELEMENTS['bite hole'])
    const worst = Math.min(
      ...marks.map(
        (mark, index) =>
          compareSets([mark], [RED_BODIES[index] as NamedColour], 'deuteranopia').worst.distance,
      ),
    )
    expect(worst).toBeLessThan(POOL_THRESHOLDS.deficiency)
  })
})

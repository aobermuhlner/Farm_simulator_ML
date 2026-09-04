/**
 * Whether two colours stay distinguishable to a viewer with a colour vision deficiency.
 *
 * `openspec/changes/colour-accessibility/design.md` — the whole game is red versus green,
 * so the palette is not a decoration: for a student with a red/green deficiency an
 * unverified palette removes the lesson rather than making it harder. The rule therefore
 * has to be a measurement a test asserts, not a judgement made by looking, because the
 * people it protects are not the people authoring it.
 *
 * This module lives in `src/` because it is the only directory both `test/` (the pool's
 * palette) and `web/` (the stylesheet's palette) already import from, and both need the
 * same rule. Two suites disagreeing about what "distinguishable" means would be worse
 * than a verification module sitting beside the engine. Nothing on a screen imports it,
 * so it ships nothing.
 *
 * Its own correctness is checked against published reference values in
 * `test/colour-vision.test.ts` — Sharma's CIEDE2000 test pairs and Machado's matrices as
 * published — because a colour-distance implementation that is subtly wrong produces
 * confident numbers, and every threshold in the project rests on it.
 */

/** The two red/green deficiencies every category colour is checked against. */
export const RED_GREEN_DEFICIENCIES = ['deuteranopia', 'protanopia'] as const
export type Deficiency = (typeof RED_GREEN_DEFICIENCIES)[number]

/**
 * Everything the module can simulate.
 *
 * `tritanopia` and `greyscale` are measurable but not asserted anywhere: a
 * lightness-separated palette passes both as a side effect, and making them normative
 * would let a failure outside a change's remit block a palette edit.
 */
export const SIMULATIONS = [
  'normal',
  'deuteranopia',
  'protanopia',
  'tritanopia',
  'greyscale',
] as const
export type Simulation = (typeof SIMULATIONS)[number]

/**
 * What a surface's category colours have to clear.
 *
 * Per surface, because the two surfaces have different room to move. The pool's palette
 * is a red and a green that also have to read as apples, and `design.md` measures the
 * best such palette at 10.2 under deuteranopia — close to the ceiling a red-versus-green
 * palette can reach at all — so 8 is a bar met with margin rather than exactly. A
 * stylesheet is free to pick any two colours, so its bar is set where a pair that a
 * deuteranope reads as one colour is refused outright.
 */
export const POOL_THRESHOLDS = {
  /** Under each of deuteranopia and protanopia. */
  deficiency: 8,
  /** Under normal vision, so the palette is not made accessible by becoming drab. */
  normal: 30,
  /**
   * How far the two categories' simulated lightness ranges must stay apart.
   *
   * The property that makes the distinction survive an illumination difference: a
   * dichromat has lightness and little else, and per-image lighting moves apparent
   * lightness further than two hues differ.
   */
  lightnessMargin: 5,
} as const

/**
 * What two colours a screen distinguishes by have to clear.
 *
 * No lightness margin: a screen's distinctions are additionally carried by stroke pattern
 * and by text, which is what `colour-vision-safety` requires of them, so colour is a
 * second cue rather than the only one. The pool's images have no such second cue by
 * construction and that is why only they carry the margin.
 */
export const SCREEN_THRESHOLDS = {
  deficiency: 20,
} as const

/** A colour with the name a failure message should call it by. */
export interface NamedColour {
  readonly name: string
  readonly hex: string
}

/** An inclusive interval of CIELAB lightness. */
export interface LightnessRange {
  readonly min: number
  readonly max: number
}

/** Linear-light RGB in [0, 1], the space the deficiency matrices are defined over. */
interface LinearRgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

/** CIELAB under the D65 white point. */
export interface Lab {
  readonly l: number
  readonly a: number
  readonly b: number
}

/**
 * Machado, Oliveira and Fernandes (2009), table 1, at severity 1.0.
 *
 * Reproduced as published, row-major, and applied to linear-light RGB as the paper
 * defines them. Simulating at full severity rather than at the severity of a typical
 * anomalous trichromat is deliberate: the numbers then describe the hardest case rather
 * than the average one, which is what a threshold should do. Deuteranomaly is by far the
 * most common deficiency and sees considerably more separation than these figures.
 */
const DEFICIENCY_MATRIX: Readonly<Record<Deficiency | 'tritanopia', readonly number[]>> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116,
    1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
}

/** sRGB to linear light, the IEC 61966-2-1 transfer function. */
function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** Linear light back to sRGB, for the hex a failure message quotes. */
function toEncoded(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel))
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
}

/** Parses `#rrggbb` into linear light, refusing anything else rather than guessing. */
function parse(hex: string): LinearRgb {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (match === null) {
    throw new Error(`not a #rrggbb colour: ${JSON.stringify(hex)}`)
  }
  const digits = match[1] as string
  const channel = (at: number): number => toLinear(parseInt(digits.slice(at, at + 2), 16) / 255)
  return { r: channel(0), g: channel(2), b: channel(4) }
}

/** Linear light as `#rrggbb`. */
function format(rgb: LinearRgb): string {
  const channel = (value: number): string =>
    Math.round(toEncoded(value) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`
}

/**
 * Rec. 709 luminance, over the same primaries sRGB is defined against.
 *
 * Used for the greyscale simulation, which stands for the worst a display can inflict
 * rather than for a deficiency anyone has.
 */
function luminance(rgb: LinearRgb): number {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b
}

/** What a viewer with the named vision sees, in linear light. */
function simulateLinear(rgb: LinearRgb, simulation: Simulation): LinearRgb {
  if (simulation === 'normal') return rgb
  if (simulation === 'greyscale') {
    const grey = luminance(rgb)
    return { r: grey, g: grey, b: grey }
  }
  const m = DEFICIENCY_MATRIX[simulation]
  const at = (index: number): number => m[index] as number
  return {
    r: at(0) * rgb.r + at(1) * rgb.g + at(2) * rgb.b,
    g: at(3) * rgb.r + at(4) * rgb.g + at(5) * rgb.b,
    b: at(6) * rgb.r + at(7) * rgb.g + at(8) * rgb.b,
  }
}

/** What a viewer with the named vision sees, as a hex colour. */
export function simulate(hex: string, simulation: Simulation): string {
  return format(simulateLinear(parse(hex), simulation))
}

/** The D65 white point the conversion below is relative to. */
const WHITE = { x: 0.95047, y: 1, z: 1.08883 } as const

/** CIELAB for a colour as the named vision sees it. */
export function toLab(hex: string, simulation: Simulation = 'normal'): Lab {
  const { r, g, b } = simulateLinear(parse(hex), simulation)
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b

  const f = (value: number): number =>
    value > 216 / 24389 ? Math.cbrt(value) : (841 / 108) * value + 4 / 29
  const fx = f(x / WHITE.x)
  const fy = f(y / WHITE.y)
  const fz = f(z / WHITE.z)

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

/** Lightness alone, which is nearly all a dichromat has left. */
export function lightnessOf(hex: string, simulation: Simulation = 'normal'): number {
  return toLab(hex, simulation).l
}

const RAD = Math.PI / 180

/**
 * CIEDE2000, per Sharma, Wu and Dalal (2005).
 *
 * Written out with the paper's variable names rather than simplified, because the
 * hue-rotation and hue-difference branches are exactly where a plausible-looking
 * simplification goes quietly wrong, and the test pairs that catch it are the ones that
 * straddle the 180 and 360 degree discontinuities.
 */
export function deltaE2000(one: Lab, two: Lab): number {
  const kL = 1
  const kC = 1
  const kH = 1

  const c1 = Math.hypot(one.a, one.b)
  const c2 = Math.hypot(two.a, two.b)
  const cBar = (c1 + c2) / 2
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)))

  const a1 = (1 + g) * one.a
  const a2 = (1 + g) * two.a
  const cp1 = Math.hypot(a1, one.b)
  const cp2 = Math.hypot(a2, two.b)

  const hue = (a: number, b: number): number => {
    if (a === 0 && b === 0) return 0
    const degrees = Math.atan2(b, a) / RAD
    return degrees < 0 ? degrees + 360 : degrees
  }
  const hp1 = hue(a1, one.b)
  const hp2 = hue(a2, two.b)

  const dL = two.l - one.l
  const dC = cp2 - cp1

  let dh: number
  if (cp1 * cp2 === 0) {
    dh = 0
  } else if (Math.abs(hp2 - hp1) <= 180) {
    dh = hp2 - hp1
  } else if (hp2 - hp1 > 180) {
    dh = hp2 - hp1 - 360
  } else {
    dh = hp2 - hp1 + 360
  }
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh / 2) * RAD)

  const lBar = (one.l + two.l) / 2
  const cpBar = (cp1 + cp2) / 2

  let hBar: number
  if (cp1 * cp2 === 0) {
    hBar = hp1 + hp2
  } else if (Math.abs(hp1 - hp2) <= 180) {
    hBar = (hp1 + hp2) / 2
  } else if (hp1 + hp2 < 360) {
    hBar = (hp1 + hp2 + 360) / 2
  } else {
    hBar = (hp1 + hp2 - 360) / 2
  }

  const t =
    1 -
    0.17 * Math.cos((hBar - 30) * RAD) +
    0.24 * Math.cos(2 * hBar * RAD) +
    0.32 * Math.cos((3 * hBar + 6) * RAD) -
    0.2 * Math.cos((4 * hBar - 63) * RAD)

  const sL = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2)
  const sC = 1 + 0.045 * cpBar
  const sH = 1 + 0.015 * cpBar * t

  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2))
  const rC = 2 * Math.sqrt(cpBar ** 7 / (cpBar ** 7 + 25 ** 7))
  const rT = -rC * Math.sin(2 * dTheta * RAD)

  return Math.sqrt(
    (dL / (kL * sL)) ** 2 +
      (dC / (kC * sC)) ** 2 +
      (dH / (kH * sH)) ** 2 +
      rT * (dC / (kC * sC)) * (dH / (kH * sH)),
  )
}

/** How far apart two colours are to the named vision. */
export function distance(one: string, two: string, simulation: Simulation): number {
  return deltaE2000(toLab(one, simulation), toLab(two, simulation))
}

/** The closest pair across two sets, which is the one a threshold has to clear. */
export interface WorstPair {
  readonly one: NamedColour
  readonly two: NamedColour
  readonly distance: number
}

/** What two sets of colours look like to one simulated vision. */
export interface SetComparison {
  readonly simulation: Simulation
  readonly worst: WorstPair
  readonly lightness: {
    readonly one: LightnessRange
    readonly two: LightnessRange
    /** Positive when the ranges are disjoint; negative by the amount they overlap. */
    readonly gap: number
  }
}

/** The lightness a set of colours spans to the named vision. */
export function lightnessRange(
  colours: readonly NamedColour[],
  simulation: Simulation,
): LightnessRange {
  if (colours.length === 0) throw new Error('cannot take the lightness range of no colours')
  const values = colours.map((colour) => lightnessOf(colour.hex, simulation))
  return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * The two comparisons every check in the project is built from.
 *
 * Both are taken over the full cross product rather than over a representative pair,
 * because a palette is unreadable as soon as *some* pair of images collides, and the pair
 * that collides is never the one an author would have picked to check.
 */
export function compareSets(
  one: readonly NamedColour[],
  two: readonly NamedColour[],
  simulation: Simulation,
): SetComparison {
  if (one.length === 0 || two.length === 0) {
    throw new Error('both sets need at least one colour to compare')
  }

  let worst: WorstPair | undefined
  for (const a of one) {
    const labA = toLab(a.hex, simulation)
    for (const b of two) {
      const measured = deltaE2000(labA, toLab(b.hex, simulation))
      if (worst === undefined || measured < worst.distance) {
        worst = { one: a, two: b, distance: measured }
      }
    }
  }

  const rangeOne = lightnessRange(one, simulation)
  const rangeTwo = lightnessRange(two, simulation)
  const gap =
    rangeOne.max < rangeTwo.min
      ? rangeTwo.min - rangeOne.max
      : rangeTwo.max < rangeOne.min
        ? rangeOne.min - rangeTwo.max
        : -(Math.min(rangeOne.max, rangeTwo.max) - Math.max(rangeOne.min, rangeTwo.min))

  return {
    simulation,
    worst: worst as WorstPair,
    lightness: { one: rangeOne, two: rangeTwo, gap },
  }
}

/** Two decimals, so a message quotes a figure rather than a float. */
function figure(value: number): string {
  return value.toFixed(2)
}

/**
 * Why the closest pair fails the threshold, or `undefined` if it does not.
 *
 * The message names both colours, the vision simulated and the measured distance,
 * because a check that only says something is wrong leaves the author guessing which
 * colour to move.
 */
export function distanceFailure(comparison: SetComparison, threshold: number): string | undefined {
  const { worst, simulation } = comparison
  if (worst.distance >= threshold) return undefined
  return (
    `under simulated ${simulation}, ${worst.one.name} (${worst.one.hex}) and ` +
    `${worst.two.name} (${worst.two.hex}) measure deltaE2000 ${figure(worst.distance)}, ` +
    `below the declared ${figure(threshold)}`
  )
}

/**
 * Why the two sets' lightness ranges fail the margin, or `undefined` if they do not.
 *
 * Overlapping ranges are reported as an overlap rather than as a small gap: a dichromat
 * has lightness and little else, so two categories whose lightness interleaves are two
 * categories that cannot be told apart however their hues were chosen.
 */
export function lightnessFailure(
  comparison: SetComparison,
  margin: number,
  names: { readonly one: string; readonly two: string },
): string | undefined {
  const { lightness, simulation } = comparison
  if (lightness.gap >= margin) return undefined
  const span = (range: LightnessRange): string => `L* ${figure(range.min)}-${figure(range.max)}`
  const how =
    lightness.gap < 0
      ? `overlap by ${figure(-lightness.gap)}`
      : `are separated by only ${figure(lightness.gap)}`
  return (
    `under simulated ${simulation}, the lightness of ${names.one} (${span(lightness.one)}) ` +
    `and ${names.two} (${span(lightness.two)}) ${how}, ` +
    `below the declared margin of ${figure(margin)}`
  )
}

import { describe, expect, it } from 'vitest'
import {
  compareSets,
  deltaE2000,
  distanceFailure,
  lightnessFailure,
  simulate,
  toLab,
  type Lab,
} from '../src/colour-vision/index.js'

/**
 * Sharma, Wu and Dalal (2005), "The CIEDE2000 color-difference formula", table 1.
 *
 * The published pairs exist because CIEDE2000 has three discontinuities a plausible
 * implementation gets wrong — the hue mean across 360, the hue difference across 180, and
 * the chroma-zero case — and every threshold in this project rests on the answer. Checked
 * to three decimals, which is the precision the paper publishes.
 */
const SHARMA_PAIRS: readonly (readonly [Lab, Lab, number])[] = [
  [{ l: 50, a: 2.6772, b: -79.7751 }, { l: 50, a: 0, b: -82.7485 }, 2.0425],
  [{ l: 50, a: 3.1571, b: -77.2803 }, { l: 50, a: 0, b: -82.7485 }, 2.8615],
  [{ l: 50, a: 2.8361, b: -74.02 }, { l: 50, a: 0, b: -82.7485 }, 3.4412],
  [{ l: 50, a: -1.3802, b: -84.2814 }, { l: 50, a: 0, b: -82.7485 }, 1.0],
  [{ l: 50, a: -1.1848, b: -84.8006 }, { l: 50, a: 0, b: -82.7485 }, 1.0],
  [{ l: 50, a: -0.9009, b: -85.5211 }, { l: 50, a: 0, b: -82.7485 }, 1.0],
  [{ l: 50, a: 0, b: 0 }, { l: 50, a: -1, b: 2 }, 2.3669],
  [{ l: 50, a: -1, b: 2 }, { l: 50, a: 0, b: 0 }, 2.3669],
  [{ l: 50, a: 2.49, b: -0.001 }, { l: 50, a: -2.49, b: 0.0009 }, 7.1792],
  [{ l: 50, a: 2.49, b: -0.001 }, { l: 50, a: -2.49, b: 0.001 }, 7.1792],
  [{ l: 50, a: 2.49, b: -0.001 }, { l: 50, a: -2.49, b: 0.0011 }, 7.2195],
  [{ l: 50, a: 2.49, b: -0.001 }, { l: 50, a: -2.49, b: 0.0012 }, 7.2195],
  [{ l: 50, a: -0.001, b: 2.49 }, { l: 50, a: 0.0009, b: -2.49 }, 4.8045],
  [{ l: 50, a: -0.001, b: 2.49 }, { l: 50, a: 0.001, b: -2.49 }, 4.8045],
  [{ l: 50, a: -0.001, b: 2.49 }, { l: 50, a: 0.0011, b: -2.49 }, 4.7461],
  [{ l: 50, a: 2.5, b: 0 }, { l: 50, a: 0, b: -2.5 }, 4.3065],
  [{ l: 50, a: 2.5, b: 0 }, { l: 73, a: 25, b: -18 }, 27.1492],
  [{ l: 50, a: 2.5, b: 0 }, { l: 61, a: -5, b: 29 }, 22.8977],
  [{ l: 50, a: 2.5, b: 0 }, { l: 56, a: -27, b: -3 }, 31.903],
  [{ l: 50, a: 2.5, b: 0 }, { l: 58, a: 24, b: 15 }, 19.4535],
  [{ l: 50, a: 2.5, b: 0 }, { l: 50, a: 3.1736, b: 0.5854 }, 1.0],
  [{ l: 50, a: 2.5, b: 0 }, { l: 50, a: 3.2972, b: 0 }, 1.0],
  [{ l: 50, a: 2.5, b: 0 }, { l: 50, a: 1.8634, b: 0.5757 }, 1.0],
  [{ l: 50, a: 2.5, b: 0 }, { l: 50, a: 3.2592, b: 0.335 }, 1.0],
  [{ l: 60.2574, a: -34.0099, b: 36.2677 }, { l: 60.4626, a: -34.1751, b: 39.4387 }, 1.2644],
  [{ l: 63.0109, a: -31.0961, b: -5.8663 }, { l: 62.8187, a: -29.7946, b: -4.0864 }, 1.263],
  [{ l: 61.2901, a: 3.7196, b: -5.3901 }, { l: 61.4292, a: 2.248, b: -4.962 }, 1.8731],
  [{ l: 35.0831, a: -44.1164, b: 3.7933 }, { l: 35.0232, a: -40.0716, b: 1.5901 }, 1.8645],
  [{ l: 22.7233, a: 20.0904, b: -46.694 }, { l: 23.0331, a: 14.973, b: -42.5619 }, 2.0373],
  [{ l: 36.4612, a: 47.858, b: 18.3852 }, { l: 36.2715, a: 50.5065, b: 21.2231 }, 1.4146],
  [{ l: 90.8027, a: -2.0831, b: 1.441 }, { l: 91.1528, a: -1.6435, b: 0.0447 }, 1.4441],
  [{ l: 90.9257, a: -0.5406, b: -0.9208 }, { l: 88.6381, a: -0.8985, b: -0.7239 }, 1.5381],
  [{ l: 6.7747, a: -0.2908, b: -2.4247 }, { l: 5.8714, a: -0.0985, b: -2.2286 }, 0.6377],
  [{ l: 2.0776, a: 0.0795, b: -1.135 }, { l: 0.9033, a: -0.0636, b: -0.5514 }, 0.9082],
]

/**
 * Machado, Oliveira and Fernandes (2009), table 1, at severity 1.0.
 *
 * A copy of the published matrices kept deliberately separate from the module's own, so
 * that a transcription slip in one is not repeated in the other. Simulating a linear-light
 * primary reads one column of the matrix straight back out, which is what makes this a
 * check on the wiring and not only on the digits.
 */
const PUBLISHED_MATRIX: Readonly<Record<string, readonly (readonly number[])[]>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
}

/** sRGB to linear light, repeated here so the expectation does not borrow the module's. */
function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** Linear light back to an 8-bit sRGB channel. */
function encoded(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  const gamma = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
  return Math.round(gamma * 255)
}

/** The three primaries, which pick out the three columns of a matrix one at a time. */
const PRIMARIES: readonly (readonly [string, number])[] = [
  ['#ff0000', 0],
  ['#00ff00', 1],
  ['#0000ff', 2],
]

function channels(hex: string): readonly number[] {
  const digits = hex.slice(1)
  return [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16))
}

describe('colour vision simulation and distance', () => {
  it("reproduces Sharma's published CIEDE2000 pairs to three decimals", () => {
    for (const [one, two, published] of SHARMA_PAIRS) {
      expect(deltaE2000(one, two)).toBeCloseTo(published, 3)
    }
  })

  it('is symmetric, as a distance has to be', () => {
    for (const [one, two] of SHARMA_PAIRS) {
      expect(deltaE2000(one, two)).toBeCloseTo(deltaE2000(two, one), 10)
    }
  })

  it('gives a colour zero distance from itself', () => {
    for (const hex of ['#a90c38', '#97db54', '#6a7b3c', '#000000', '#ffffff']) {
      expect(deltaE2000(toLab(hex), toLab(hex))).toBe(0)
    }
  })

  it("reads back Machado's published matrix columns when a primary is simulated", () => {
    for (const [deficiency, matrix] of Object.entries(PUBLISHED_MATRIX)) {
      for (const [hex, column] of PRIMARIES) {
        // A primary is 1.0 in one linear channel and 0 in the others, so the simulated
        // colour is that column of the matrix, gamma-encoded.
        const expected = matrix.map((row) => encoded((row[column] as number) * linear(1)))
        expect(channels(simulate(hex, deficiency as 'protanopia'))).toEqual(expected)
      }
    }
  })

  it('leaves a colour alone under normal vision', () => {
    for (const hex of ['#a90c38', '#97db54', '#3d4b9e']) {
      expect(simulate(hex, 'normal')).toBe(hex)
    }
  })

  it('collapses greyscale to one value in all three channels', () => {
    const grey = channels(simulate('#a90c38', 'greyscale'))
    expect(new Set(grey).size).toBe(1)
  })

  it('puts red and green on one chromaticity under deuteranopia', () => {
    // The measurement `design.md` turns on: there is no red and no green a dichromat can
    // tell apart chromatically, which is why the palette has to separate by lightness.
    const red = toLab(simulate('#cc0000', 'deuteranopia'), 'normal')
    const green = toLab(simulate('#00cc00', 'deuteranopia'), 'normal')
    const hueOf = (lab: Lab): number => Math.atan2(lab.b, lab.a)
    expect(Math.abs(hueOf(red) - hueOf(green))).toBeLessThan(0.05)
  })

  it('refuses a colour it cannot parse rather than guessing one', () => {
    expect(() => toLab('rebeccapurple')).toThrow(/not a #rrggbb colour/)
    expect(() => toLab('#abc')).toThrow(/not a #rrggbb colour/)
  })
})

describe('comparing two sets of colours', () => {
  const reds = [
    { name: 'red body, brightly lit', hex: '#d33a2c' },
    { name: 'red body, shadowed', hex: '#7d2119' },
  ]
  const greens = [
    { name: 'green body, brightly lit', hex: '#6fbf4a' },
    { name: 'green body, shadowed', hex: '#66a844' },
  ]

  it('reports the closest pair across the two sets, not a representative one', () => {
    const comparison = compareSets(reds, greens, 'deuteranopia')
    let closest = Infinity
    for (const red of reds) {
      for (const green of greens) {
        closest = Math.min(closest, deltaE2000(toLab(red.hex, 'deuteranopia'), toLab(green.hex, 'deuteranopia')))
      }
    }
    expect(comparison.worst.distance).toBeCloseTo(closest, 10)
  })

  it('names both colours, the deficiency and the measured distance when a pair fails', () => {
    const comparison = compareSets(reds, greens, 'deuteranopia')
    const message = distanceFailure(comparison, 1000)
    expect(message).toBeDefined()
    expect(message).toContain('deuteranopia')
    expect(message).toContain(comparison.worst.one.name)
    expect(message).toContain(comparison.worst.one.hex)
    expect(message).toContain(comparison.worst.two.name)
    expect(message).toContain(comparison.worst.two.hex)
    expect(message).toContain(comparison.worst.distance.toFixed(2))
  })

  it('says nothing when the closest pair clears the threshold', () => {
    expect(distanceFailure(compareSets(reds, greens, 'normal'), 1)).toBeUndefined()
  })

  it('reports overlapping lightness as an overlap, naming both sets', () => {
    // Deliberately interleaved: the shadowed green is darker than the lit red.
    const overlapping = [
      { name: 'green body, brightly lit', hex: '#6fbf4a' },
      { name: 'green body, deeply shadowed', hex: '#1d3212' },
    ]
    const comparison = compareSets(reds, overlapping, 'deuteranopia')
    expect(comparison.lightness.gap).toBeLessThan(0)
    const message = lightnessFailure(comparison, 5, { one: 'red apples', two: 'green apples' })
    expect(message).toBeDefined()
    expect(message).toContain('deuteranopia')
    expect(message).toContain('red apples')
    expect(message).toContain('green apples')
    expect(message).toContain('overlap by')
  })

  it('measures the gap between disjoint lightness ranges as a positive number', () => {
    const comparison = compareSets(reds, greens, 'deuteranopia')
    expect(comparison.lightness.gap).toBeGreaterThan(0)
    expect(comparison.lightness.gap).toBeCloseTo(
      comparison.lightness.two.min - comparison.lightness.one.max,
      10,
    )
  })

  it('refuses to compare against an empty set rather than passing vacuously', () => {
    expect(() => compareSets(reds, [], 'deuteranopia')).toThrow(/at least one colour/)
  })
})

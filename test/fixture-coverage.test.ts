import { describe, expect, it } from 'vitest'
import { runHarvest } from '../src/scoring/index.js'
import { lookupConfiguration } from '../src/task/artifact.js'
import { defaultConfiguration, resolveConfiguration } from '../src/task/configuration.js'
import { firstFamily } from '../src/task/families.js'
import type { KnobDeclaration } from '../src/task/types.js'
import { appleDeclaration, applePool, applePredictions } from './helpers/apple'

const apple = appleDeclaration()
const family = firstFamily(apple)
const artifact = applePredictions()

/** Knob values as the student would hold them, keyed by knob id. */
function defaults(): Record<string, string | number> {
  return Object.fromEntries(defaultConfiguration(apple, family).values)
}

/** Every value a knob permits, enumerated from its declaration. */
function valuesOf(knob: KnobDeclaration): (string | number)[] {
  if (knob.kind === 'choice') return [...knob.values]
  const values: number[] = []
  for (let value = knob.min; value <= knob.max; value += knob.step) {
    values.push(Number(value.toFixed(6)))
  }
  return values
}

function resolves(values: Record<string, string | number>): boolean {
  const resolved = resolveConfiguration(apple, family, values)
  if (!resolved.ok) return false
  return lookupConfiguration(apple, family, resolved.configuration, artifact).ok
}

describe('the fixture covers a working path from the declared defaults', () => {
  it('resolves the configuration the declaration opens on', () => {
    expect(resolves(defaults())).toBe(true)
  })

  it('resolves at least one configuration one knob away from the default', () => {
    const neighbours = family.knobs.flatMap((knob) =>
      valuesOf(knob)
        .filter((value) => value !== knob.default)
        .map((value) => ({ ...defaults(), [knob.id]: value })),
    )

    expect(neighbours.filter(resolves).length).toBeGreaterThan(0)
  })

  it('reaches a different harvest by moving one knob', () => {
    // The point of the product: a knob move has to change the money. A fixture
    // where every covered configuration paid the same would demo nothing.
    const truth = Object.fromEntries(
      Object.entries(applePool().images).map(([id, image]) => [id, image.category]),
    )
    const earn = (values: Record<string, string | number>): number | undefined => {
      const result = runHarvest(apple, family, values, artifact, 'pool', truth)
      return result.ok ? result.outcome.earnings : undefined
    }

    const fromDefault = earn(defaults())
    const moved = family.knobs
      .flatMap((knob) =>
        valuesOf(knob)
          .filter((value) => value !== knob.default)
          .map((value) => ({ ...defaults(), [knob.id]: value })),
      )
      .map(earn)
      .filter((earnings): earnings is number => earnings !== undefined)

    expect(fromDefault).toBeDefined()
    expect(moved.length).toBeGreaterThan(0)
    expect(moved.some((earnings) => earnings !== fromDefault)).toBe(true)
  })
})

describe('the fixture deliberately leaves most of the cross-product absent', () => {
  it('leaves at least one declared knob combination with no artifact entry', () => {
    const absent = family.knobs.flatMap((knob) =>
      valuesOf(knob)
        .filter((value) => value !== knob.default)
        .map((value) => ({ ...defaults(), [knob.id]: value })),
    )

    expect(absent.some((values) => !resolves(values))).toBe(true)
  })

  it('covers far fewer configurations than the knobs describe', () => {
    // `prediction-artifacts` owns the real cross-product; these stand-ins exist
    // only so the refusal path and the happy path are both reachable.
    const total = family.knobs.reduce((product, knob) => product * valuesOf(knob).length, 1)
    const stored = Object.keys(artifact.configurations).length

    expect(total).toBeGreaterThan(100)
    expect(stored).toBeLessThan(total / 2)
  })
})

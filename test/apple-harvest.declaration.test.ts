import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadRawDeclaration } from './helpers/load-raw'

const declaration = loadRawDeclaration('apple-harvest')

describe('apple-harvest declaration: identity and references', () => {
  it('declares a stable id and a display title', () => {
    expect(declaration.id).toBe('apple-harvest')
    expect(declaration.title).toBeTypeOf('string')
    expect(String(declaration.title).length).toBeGreaterThan(0)
  })

  it('declares the schema version its artifacts were generated against', () => {
    expect(declaration.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('references an image pool and a precomputed prediction artifact', () => {
    expect(declaration.pool).toBeTypeOf('string')
    expect(declaration.predictions).toBeTypeOf('string')
  })
})

describe('apple-harvest declaration: categories, actions and mapping', () => {
  const categories = declaration.categories as { id: string; label: string }[]
  const actions = declaration.actions as { id: string; label: string }[]
  const mapping = declaration.categoryActions as Record<string, string>

  it('declares at least two categories and at least two actions', () => {
    expect(categories.length).toBeGreaterThanOrEqual(2)
    expect(actions.length).toBeGreaterThanOrEqual(2)
  })

  it('declares the three apple categories and the two robot actions', () => {
    expect(categories.map((c) => c.id)).toEqual(['red', 'green', 'wormy'])
    expect(actions.map((a) => a.id)).toEqual(['pick', 'decline'])
  })

  it('gives every category and action a student-facing label', () => {
    for (const entry of [...categories, ...actions]) {
      expect(entry.label).toBeTypeOf('string')
      expect(entry.label.length).toBeGreaterThan(0)
    }
  })

  it('maps every declared category to a declared action', () => {
    const actionIds = new Set(actions.map((a) => a.id))
    for (const category of categories) {
      expect(mapping).toHaveProperty(category.id)
      expect(actionIds).toContain(mapping[category.id])
    }
  })

  it('maps red to pick, and both green and wormy to decline', () => {
    expect(mapping).toEqual({ red: 'pick', green: 'decline', wormy: 'decline' })
  })

  it('maps no category that was not declared', () => {
    const categoryIds = new Set(categories.map((c) => c.id))
    for (const key of Object.keys(mapping)) {
      expect(categoryIds).toContain(key)
    }
  })
})

describe('apple-harvest declaration: knobs', () => {
  type RawKnob = Record<string, unknown>
  const knobs = declaration.knobs as RawKnob[]

  it('declares the knob set design.md budgets its artifact size against', () => {
    expect(knobs.map((k) => k.id)).toEqual(['blocks', 'channels', 'regularization', 'dropout'])
  })

  it('declares the capacity knobs as blocks and channels, not layers and units', () => {
    const blocks = knobs.find((knob) => knob.id === 'blocks')
    const channels = knobs.find((knob) => knob.id === 'channels')

    expect(blocks?.values).toEqual([2, 3, 4])
    // Opens on the smallest stack the farmer can afford: deeper ones are declared so a
    // student can see what there is to earn, but the lesson starts at 2.
    expect(blocks?.default).toBe(2)
    expect(channels?.values).toEqual([8, 16, 32])
    expect(channels?.default).toBe(16)
  })

  it('gives every knob an id, label, kind, default and help copy', () => {
    for (const knob of knobs) {
      for (const field of ['id', 'label', 'kind', 'default', 'help'] as const) {
        expect(knob, `knob ${String(knob.id)} is missing ${field}`).toHaveProperty(field)
      }
      expect(knob.kind === 'choice' || knob.kind === 'slider').toBe(true)
      expect(String(knob.label).length).toBeGreaterThan(0)
      expect(String(knob.help).length).toBeGreaterThan(0)
    }
  })

  it('declares allowed values in the form its kind requires', () => {
    for (const knob of knobs) {
      if (knob.kind === 'choice') {
        expect(Array.isArray(knob.values)).toBe(true)
        expect((knob.values as unknown[]).length).toBeGreaterThan(1)
      } else {
        for (const field of ['min', 'max', 'step'] as const) {
          expect(knob, `slider ${String(knob.id)} is missing ${field}`).toHaveProperty(field)
        }
        expect(knob.max as number).toBeGreaterThan(knob.min as number)
        expect(knob.step as number).toBeGreaterThan(0)
      }
    }
  })

  it('gives every knob a default that its own allowed values permit', () => {
    for (const knob of knobs) {
      if (knob.kind === 'choice') {
        expect(knob.values as unknown[]).toContain(knob.default)
      } else {
        const min = knob.min as number
        const max = knob.max as number
        const step = knob.step as number
        const value = knob.default as number
        expect(value).toBeGreaterThanOrEqual(min)
        expect(value).toBeLessThanOrEqual(max)
        expect(Number.isInteger((value - min) / step)).toBe(true)
      }
    }
  })

  it('exercises both knob kinds, so neither rendering path is untested', () => {
    const kinds = new Set(knobs.map((k) => k.kind))
    expect(kinds).toEqual(new Set(['choice', 'slider']))
  })

  it('stays within the ~10^2 cross-product design.md budgets for', () => {
    const total = knobs.reduce((acc, knob) => {
      if (knob.kind === 'choice') return acc * (knob.values as unknown[]).length
      const min = knob.min as number
      const max = knob.max as number
      const step = knob.step as number
      return acc * (Math.round((max - min) / step) + 1)
    }, 1)
    expect(total).toBe(108)
    expect(total).toBeLessThan(200)
  })
})

describe('apple-harvest declaration: architecture', () => {
  const diagram = declaration.diagram as Record<string, unknown>
  const knobs = declaration.knobs as Record<string, unknown>[]

  it('declares a convolutional architecture, not a fully-connected one', () => {
    // A fully-connected network over a 128px image gives every unit of the first layer
    // 49,152 inputs and no notion of locality: a different failure from the one the
    // regularization knobs exist to teach — `proposal.md`.
    expect(diagram.kind).toBe('cnn')
  })

  it('names the capacity knobs it declares', () => {
    expect(diagram.blocksKnob).toBe('blocks')
    expect(diagram.channelsKnob).toBe('channels')
    expect(knobs.map((knob) => knob.id)).toContain(diagram.blocksKnob)
    expect(knobs.map((knob) => knob.id)).toContain(diagram.channelsKnob)
  })

  it('declares the resolution its pool provides, and no per-block size', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../pools/apple-harvest/manifest.json', import.meta.url), 'utf8'),
    ) as { atlases: Record<string, { cellSize: number }> }
    const sizes = new Set(Object.values(manifest.atlases).map((atlas) => atlas.cellSize))

    expect(diagram.inputSize).toBe(128)
    expect([...sizes]).toEqual([diagram.inputSize])
    expect(Object.keys(diagram).filter((key) => /size/i.test(key))).toEqual(['inputSize'])
  })

  it('gives every channel value a drawn depth, and declares no output count', () => {
    const channels = knobs.find((knob) => knob.id === 'channels')?.values as number[]
    const shown = diagram.channelsShown as Record<string, number>

    for (const value of channels) {
      expect(shown[String(value)], `no drawn depth for ${value}`).toBeGreaterThan(0)
    }
    expect(Object.keys(diagram).filter((key) => /output/i.test(key))).toEqual([])
  })

  it('describes convolutional capacity in its copy rather than layers and neurons', () => {
    const teaching = declaration.teaching as Record<string, string>
    const copy = [...knobs.map((knob) => String(knob.help)), teaching.summary, teaching.theory]
      .join(' ')
      .toLowerCase()

    expect(copy).not.toContain('hidden layer')
    expect(copy).not.toContain('neuron')
    expect(copy).toContain('block')
    expect(copy).toContain('pattern')
  })
})

describe('apple-harvest declaration: payoffs, policy and teaching copy', () => {
  const categories = (declaration.categories as { id: string }[]).map((c) => c.id)
  const actions = (declaration.actions as { id: string }[]).map((a) => a.id)
  const payoffs = declaration.payoffs as Record<string, Record<string, number>>

  it('defines a value for every category-and-action combination', () => {
    const missing: string[] = []
    for (const category of categories) {
      for (const action of actions) {
        if (typeof payoffs[category]?.[action] !== 'number') {
          missing.push(`${category}/${action}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('fills exactly the six cells the three categories and two actions span', () => {
    expect(categories.length * actions.length).toBe(6)
    const cells = Object.values(payoffs).flatMap((row) => Object.keys(row))
    expect(cells).toHaveLength(6)
  })

  it('prices selling a wormy apple as the most expensive mistake', () => {
    const worstCell = Math.min(
      ...Object.values(payoffs).flatMap((row) => Object.values(row)),
    )
    expect(payoffs.wormy?.pick).toBe(worstCell)
    expect(payoffs.wormy?.pick).toBeLessThan(payoffs.green?.pick as number)
  })

  it('pays for picking a ripe red apple', () => {
    expect(payoffs.red?.pick as number).toBeGreaterThan(0)
  })

  it('declares a decision policy of a kind decision-policy defines', () => {
    const policy = declaration.policy as { kind: string }
    expect(['highest-probability', 'threshold', 'cost-optimal']).toContain(policy.kind)
  })

  it('declares teaching copy at the task level', () => {
    const teaching = declaration.teaching as Record<string, string>
    for (const field of ['summary', 'theory'] as const) {
      expect(teaching[field]).toBeTypeOf('string')
      expect(teaching[field]?.length).toBeGreaterThan(0)
    }
  })

  it('declares whether the task is playable or merely announced', () => {
    expect(declaration.available).toBeTypeOf('boolean')
  })
})

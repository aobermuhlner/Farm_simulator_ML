/**
 * The optional architecture diagram a task may declare.
 *
 * Kept in its own file rather than folded into `validate-declaration.test.ts`, which is
 * about the fields every declaration must carry. This block is the first optional one,
 * and its rules are about agreement with the knobs rather than about presence.
 */

import { describe, expect, it } from 'vitest'
import { DIAGRAM_KINDS } from '../src/task/types.js'
import { validateDeclaration } from '../src/task/validate.js'
import { rawCnnTask, rawFeedforwardTask } from './helpers/architectures'

const feedforward = rawFeedforwardTask()

/** The fully-connected task with its diagram block replaced. */
function withDiagram(diagram: unknown): Record<string, unknown> {
  const copy: Record<string, unknown> = structuredClone(feedforward)
  copy.diagram = diagram
  return copy
}

/** That task's own diagram block, with one field overridden. */
function diagramWith(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...(structuredClone(feedforward).diagram as Record<string, unknown>), ...patch }
}

function issuesOf(input: unknown): { code: string; field?: string; message: string }[] {
  const result = validateDeclaration(input)
  expect(result.ok).toBe(false)
  return result.ok ? [] : [...result.issues]
}

function messages(input: unknown): string {
  return issuesOf(input)
    .map((issue) => issue.message)
    .join(' ')
}

/** The knob a diagram field names, from the fully-connected task. */
function knobNamed(id: unknown): Record<string, unknown> {
  const knobs = feedforward.knobs as Record<string, unknown>[]
  const knob = knobs.find((candidate) => candidate.id === id)
  if (knob === undefined) throw new Error(`the task should declare knob ${String(id)}`)
  return knob
}

describe('a task may declare no diagram at all', () => {
  it('accepts a declaration carrying no diagram block', () => {
    const copy: Record<string, unknown> = structuredClone(feedforward)
    delete copy.diagram

    const result = validateDeclaration(copy)

    expect(result.ok ? [] : result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('leaves such a task with no diagram rather than a guessed one', () => {
    const copy: Record<string, unknown> = structuredClone(feedforward)
    delete copy.diagram

    const result = validateDeclaration(copy)

    if (!result.ok) throw new Error('a declaration without a diagram should validate')
    expect(result.declaration.diagram).toBeUndefined()
  })
})

describe('a fully-connected declaration is validated as its own kind', () => {
  it('validates with its diagram block', () => {
    const result = validateDeclaration(feedforward)

    expect(result.ok ? [] : result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('gives every value its width knob permits a drawn count', () => {
    const result = validateDeclaration(feedforward)
    if (!result.ok) throw new Error('the fully-connected task should validate')
    const diagram = result.declaration.diagram
    if (diagram?.kind !== 'feedforward') throw new Error('expected a feedforward diagram')
    const knob = knobNamed(diagram.unitsKnob)
    const values = knob.values as (string | number)[]

    expect(values.length).toBeGreaterThan(1)
    for (const value of values) {
      expect(diagram.unitsShown[String(value)], `no drawn count for ${String(value)}`).toBeDefined()
    }
  })

  it('names no output count, because the declared categories already fix it', () => {
    // Two declared numbers for one thing could only disagree, and nothing would be able
    // to say which was right. The output layer is the categories, and nothing else.
    const keys = Object.keys(feedforward.diagram as Record<string, unknown>)

    expect(keys.filter((key) => /output/i.test(key))).toEqual([])
  })

  it('names knobs it actually declares, and a known kind', () => {
    const result = validateDeclaration(feedforward)
    if (!result.ok) throw new Error('the fully-connected task should validate')
    const diagram = result.declaration.diagram
    if (diagram?.kind !== 'feedforward') throw new Error('expected a feedforward diagram')

    expect(DIAGRAM_KINDS).toContain(diagram.kind)
    expect(knobNamed(diagram.layersKnob)).toBeDefined()
    expect(knobNamed(diagram.unitsKnob)).toBeDefined()
    expect(diagram.inputsShown).toBeGreaterThan(0)
  })
})

describe('an incomplete diagram block is refused, not half-used', () => {
  it('names every required field that is missing', () => {
    for (const field of ['kind', 'layersKnob', 'unitsKnob', 'unitsShown', 'inputsShown']) {
      const block = diagramWith({})
      delete block[field]

      const issues = issuesOf(withDiagram(block))

      expect(
        issues.map((issue) => issue.field),
        `omitting "diagram.${field}" should be reported`,
      ).toContain(`diagram.${field}`)
    }
  })

  it('refuses a diagram that is not an object', () => {
    const issues = issuesOf(withDiagram('feedforward'))

    expect(issues.some((issue) => issue.field === 'diagram')).toBe(true)
  })

  it('refuses an unknown architecture kind, naming it', () => {
    expect(messages(withDiagram(diagramWith({ kind: 'transformer' })))).toContain('"transformer"')
  })
})

describe('a diagram must agree with the knobs it names', () => {
  it('refuses a layers knob the task does not declare, naming it', () => {
    const issues = issuesOf(withDiagram(diagramWith({ layersKnob: 'not-a-knob' })))

    expect(issues.some((issue) => issue.code === 'unknown-knob')).toBe(true)
    expect(issues.map((issue) => issue.message).join(' ')).toContain('"not-a-knob"')
  })

  it('refuses a units knob the task does not declare, naming it', () => {
    const issues = issuesOf(withDiagram(diagramWith({ unitsKnob: 'nor-this-one' })))

    expect(issues.some((issue) => issue.field === 'diagram.unitsKnob')).toBe(true)
    expect(issues.map((issue) => issue.message).join(' ')).toContain('"nor-this-one"')
  })

  it('refuses a layers knob permitting a value that is not a whole number', () => {
    // The dropout knob permits 0.2, which is not a number of layers.
    const message = messages(withDiagram(diagramWith({ layersKnob: 'dropout' })))

    expect(message).toContain('0.2')
    expect(message).toContain('whole number of layers')
  })

  it('refuses a width value left without a drawn count, naming that value', () => {
    const message = messages(
      withDiagram(diagramWith({ unitsShown: { '16': 2, '64': 4 } })),
    )

    expect(message).toContain('256')
    expect(message).toContain('no drawn count')
  })

  it('refuses a drawn count that is not a positive whole number, naming it', () => {
    for (const count of [0, -4, 2.5]) {
      const message = messages(
        withDiagram(diagramWith({ unitsShown: { '16': 2, '64': count, '256': 8 } })),
      )

      expect(message, `${count} should be refused`).toContain(String(count))
      expect(message).toContain('positive whole number')
    }
  })

  it('refuses a unitsShown that is not an object', () => {
    const issues = issuesOf(withDiagram(diagramWith({ unitsShown: [2, 4, 8] })))

    expect(issues.some((issue) => issue.field === 'diagram.unitsShown')).toBe(true)
  })

  it('accepts a slider as the layers knob when its steps are whole', () => {
    const declaration = structuredClone(feedforward)
    const knobs = declaration.knobs as Record<string, unknown>[]
    knobs.push({
      kind: 'slider',
      id: 'stack',
      label: 'Stack size',
      min: 1,
      max: 4,
      step: 1,
      default: 2,
      help: 'How many layers the stack has.',
    })
    declaration.diagram = diagramWith({ layersKnob: 'stack' })

    const result = validateDeclaration(declaration)

    expect(result.ok ? [] : result.issues).toEqual([])
  })

  it('refuses a slider width knob whose steps are not all mapped', () => {
    const declaration = structuredClone(feedforward)
    const knobs = declaration.knobs as Record<string, unknown>[]
    knobs.push({
      kind: 'slider',
      id: 'spread',
      label: 'Spread',
      min: 0,
      max: 0.4,
      step: 0.2,
      default: 0.2,
      help: 'How wide the spread is.',
    })
    // 0, 0.2 and 0.4 are permitted; only two of them are given a count.
    declaration.diagram = diagramWith({
      unitsKnob: 'spread',
      unitsShown: { '0': 2, '0.2': 4 },
    })

    const message = messages(declaration)

    expect(message).toContain('0.4')
  })
})

/**
 * The convolutional kind, declared explicitly rather than patched out of the shipped
 * block. Its knobs are added to the shipped declaration so that everything else about it
 * stays valid, and the diagram under test names only the two added knobs.
 */
function withCnn(patch: Record<string, unknown> = {}): Record<string, unknown> {
  const declaration = rawCnnTask(patch)
  const knobs = declaration.knobs as Record<string, unknown>[]
  // A block count no small input can support, for the resolution bound.
  knobs.push({
    kind: 'choice',
    id: 'deep',
    label: 'A deeper stack',
    values: [4, 5],
    default: 4,
    help: 'A block count only a large input can support.',
  })
  return declaration
}

/** The convolutional diagram block, with one field removed. */
function cnnWithout(field: string): Record<string, unknown> {
  const declaration = withCnn()
  delete (declaration.diagram as Record<string, unknown>)[field]
  return declaration
}

describe('a convolutional diagram is validated as its own kind', () => {
  it('accepts a complete one', () => {
    const result = validateDeclaration(withCnn())

    expect(result.ok ? [] : result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('names every required field that is missing', () => {
    for (const field of ['kind', 'blocksKnob', 'channelsKnob', 'inputSize', 'channelsShown']) {
      const issues = issuesOf(cnnWithout(field))

      expect(
        issues.map((issue) => issue.field),
        `omitting "diagram.${field}" should be reported`,
      ).toContain(`diagram.${field}`)
    }
  })

  it('requires none of the fields only the fully-connected kind carries', () => {
    // The shipped block declares layersKnob, unitsKnob, unitsShown and inputsShown. A
    // convolutional declaration carrying none of them is complete all the same.
    const declaration = withCnn()
    const keys = Object.keys(declaration.diagram as Record<string, unknown>)

    expect(keys).not.toContain('layersKnob')
    expect(keys).not.toContain('unitsKnob')
    expect(keys).not.toContain('unitsShown')
    expect(keys).not.toContain('inputsShown')
    expect(validateDeclaration(declaration).ok).toBe(true)
  })

  it('names no output count, because the declared categories already fix it', () => {
    const keys = Object.keys(withCnn().diagram as Record<string, unknown>)

    expect(keys.filter((key) => /output/i.test(key))).toEqual([])
  })

  it('declares no per-block spatial size, which is derived instead', () => {
    const keys = Object.keys(withCnn().diagram as Record<string, unknown>)

    expect(keys.filter((key) => /size/i.test(key))).toEqual(['inputSize'])
  })

  it('refuses a blocks knob the task does not declare, naming it', () => {
    const issues = issuesOf(withCnn({ blocksKnob: 'not-a-knob' }))

    expect(issues.some((issue) => issue.field === 'diagram.blocksKnob')).toBe(true)
    expect(issues.map((issue) => issue.message).join(' ')).toContain('"not-a-knob"')
  })

  it('refuses a channels knob the task does not declare, naming it', () => {
    const issues = issuesOf(withCnn({ channelsKnob: 'nor-this-one' }))

    expect(issues.some((issue) => issue.field === 'diagram.channelsKnob')).toBe(true)
    expect(issues.map((issue) => issue.message).join(' ')).toContain('"nor-this-one"')
  })

  it('refuses a blocks knob permitting a value that is not a whole number', () => {
    // The shipped dropout knob permits 0.2, which is not a number of blocks.
    const message = messages(withCnn({ blocksKnob: 'dropout' }))

    expect(message).toContain('0.2')
    expect(message).toContain('whole number of blocks')
  })

  it('refuses a channel value left without a drawn depth, naming that value', () => {
    const message = messages(withCnn({ channelsShown: { '8': 2, '16': 3 } }))

    expect(message).toContain('32')
    expect(message).toContain('no drawn count')
  })

  it('refuses a drawn depth that is not a positive whole number, naming it', () => {
    for (const depth of [0, -4, 2.5]) {
      const message = messages(withCnn({ channelsShown: { '8': 2, '16': depth, '32': 4 } }))

      expect(message, `${depth} should be refused`).toContain(String(depth))
      expect(message).toContain('positive whole number')
    }
  })

  it('refuses an input resolution that is not a positive whole number, naming it', () => {
    for (const size of [0, -128, 12.5]) {
      const issues = issuesOf(withCnn({ inputSize: size }))

      expect(
        issues.some((issue) => issue.field === 'diagram.inputSize'),
        `${size} should be refused`,
      ).toBe(true)
      expect(issues.map((issue) => issue.message).join(' ')).toContain(String(size))
    }
  })

  it('refuses a block count the input resolution cannot support, naming all three', () => {
    // 16px halves to 8, 4, 2, 1 and then to nothing: five blocks have no feature map.
    const issues = issuesOf(
      withCnn({
        inputSize: 16,
        blocksKnob: 'deep',
        channelsShown: { '8': 2, '16': 3, '32': 4 },
      }),
    )
    const message = issues.map((issue) => issue.message).join(' ')

    expect(issues.some((issue) => issue.code === 'unbuildable-block-count')).toBe(true)
    expect(message).toContain('16')
    expect(message).toContain('5')
    expect(message).toContain('"deep"')
  })

  it('accepts every block count the input resolution does support', () => {
    // 128px supports four blocks, ending at 8x8.
    const result = validateDeclaration(withCnn({ inputSize: 128 }))

    expect(result.ok ? [] : result.issues).toEqual([])
  })

  it('substitutes no reduced block count for one it has refused', () => {
    const result = validateDeclaration(withCnn({ inputSize: 16, blocksKnob: 'deep' }))

    expect(result.ok).toBe(false)
  })

  it('refuses an unknown kind before measuring it against either shape', () => {
    const issues = issuesOf(withCnn({ kind: 'transformer' }))

    expect(issues.map((issue) => issue.message).join(' ')).toContain('"transformer"')
    expect(issues.map((issue) => issue.message).join(' ')).toContain('"cnn"')
    // Nothing is reported about the fields a known kind would have wanted.
    expect(issues.filter((issue) => issue.field?.startsWith('diagram.'))).toHaveLength(1)
  })
})

describe('broken knobs are the cause, and stay the cause', () => {
  it('adds no diagram issue of its own when the knobs are malformed', () => {
    const declaration = structuredClone(feedforward)
    declaration.knobs = [{ kind: 'choice', label: 'No id here', values: [1, 2], default: 1 }]

    const issues = issuesOf(declaration)

    expect(issues.length).toBeGreaterThan(0)
    expect(issues.filter((issue) => issue.field?.startsWith('diagram'))).toEqual([])
  })

  it('adds no diagram issue when the knobs are not a list', () => {
    const declaration = structuredClone(feedforward)
    declaration.knobs = 'four of them'

    const issues = issuesOf(declaration)

    expect(issues.filter((issue) => issue.field?.startsWith('diagram'))).toEqual([])
  })
})

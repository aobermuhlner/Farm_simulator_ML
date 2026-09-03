/**
 * Resolving a declaration plus knob values into an architecture to draw.
 *
 * One suite per architecture family, each against a task declaring that family and
 * nothing else. The shipped apple task is convolutional, so the fully-connected rules
 * are asserted against a task written for them — the family the lesson does not happen
 * to use is the one most at risk of being left unspecified.
 */

import { describe, expect, it } from 'vitest'
import { blockSizes } from '../src/task/cnn.js'
import { layersOf, resolveArchitecture } from '../src/task/diagram.js'
import type { ChoiceKnob, TaskDeclaration } from '../src/task/types.js'
import { validateDeclaration } from '../src/task/validate.js'
import { cnnTask, feedforwardTask, rawCnnTask, rawFeedforwardTask } from './helpers/architectures'

const feedforward = feedforwardTask()
const cnn = cnnTask()

/** The feedforward diagram of a task, narrowed. */
function feedforwardDiagram(declaration: TaskDeclaration) {
  const diagram = declaration.diagram
  if (diagram?.kind !== 'feedforward') throw new Error('expected a feedforward task')
  return diagram
}

/** The convolutional diagram of a task, narrowed. */
function cnnDiagram(declaration: TaskDeclaration) {
  const diagram = declaration.diagram
  if (diagram?.kind !== 'cnn') throw new Error('expected a convolutional task')
  return diagram
}

/** The knob a diagram field names, as a choice knob. */
function choiceKnob(declaration: TaskDeclaration, knobId: string): ChoiceKnob {
  const knob = declaration.knobs.find((candidate) => candidate.id === knobId)
  if (knob?.kind !== 'choice') throw new Error(`${knobId} is expected to be a choice knob`)
  return knob
}

/** Default values of a task with some knobs overridden. */
function valuesOf(
  declaration: TaskDeclaration,
  overrides: Readonly<Record<string, string | number>> = {},
) {
  return {
    ...Object.fromEntries(declaration.knobs.map((knob) => [knob.id, knob.default])),
    ...overrides,
  }
}

/** The resolved architecture of a task, narrowed to the fully-connected kind. */
function resolveFeedforward(overrides: Readonly<Record<string, string | number>> = {}) {
  const resolved = resolveArchitecture(feedforward, valuesOf(feedforward, overrides))
  if (resolved?.kind !== 'feedforward') return undefined
  return resolved
}

/** The resolved architecture of a task, narrowed to the convolutional kind. */
function resolveCnn(overrides: Readonly<Record<string, string | number>> = {}) {
  const resolved = resolveArchitecture(cnn, valuesOf(cnn, overrides))
  if (resolved?.kind !== 'cnn') return undefined
  return resolved
}

/** A declaration with two categories instead of three, otherwise as given. */
function twoCategories(raw: Record<string, unknown>): TaskDeclaration {
  const copy = structuredClone(raw)
  copy.categories = [
    { id: 'ripe', label: 'Ripe one' },
    { id: 'unripe', label: 'Unripe one' },
  ]
  copy.categoryActions = { ripe: 'pick', unripe: 'decline' }
  copy.payoffs = { ripe: { pick: 4, decline: 0 }, unripe: { pick: -1, decline: 0 } }
  copy.policy = { kind: 'highest-probability' }
  const validated = validateDeclaration(copy)
  if (!validated.ok) throw new Error(validated.issues.map((issue) => issue.message).join(' '))
  return validated.declaration
}

describe('a task is read as the family it declares', () => {
  it('reads a convolutional task as convolutional', () => {
    const resolved = resolveArchitecture(cnn, valuesOf(cnn))

    expect(resolved?.kind).toBe('cnn')
    expect(resolved).not.toHaveProperty('hidden')
  })

  it('reads a fully-connected task as fully-connected', () => {
    const resolved = resolveArchitecture(feedforward, valuesOf(feedforward))

    expect(resolved?.kind).toBe('feedforward')
    expect(resolved).not.toHaveProperty('blocks')
  })

  it('substitutes no family for a task declaring no architecture', () => {
    const raw = rawCnnTask()
    delete raw.diagram
    const validated = validateDeclaration(raw)
    if (!validated.ok) throw new Error('a declaration without a diagram should validate')

    expect(resolveArchitecture(validated.declaration, valuesOf(validated.declaration))).toBeUndefined()
  })
})

describe('the hidden layers of a fully-connected task', () => {
  it('draws exactly as many hidden layers as the depth knob says, for every value', () => {
    const knob = choiceKnob(feedforward, feedforwardDiagram(feedforward).layersKnob)

    for (const value of knob.values) {
      const resolved = resolveFeedforward({ [knob.id]: value })
      expect(resolved?.hidden, `depth ${String(value)}`).toHaveLength(Number(value))
    }
  })

  it('draws the declared stand-in count in every hidden layer, for every width', () => {
    const diagram = feedforwardDiagram(feedforward)
    const knob = choiceKnob(feedforward, diagram.unitsKnob)

    for (const value of knob.values) {
      const resolved = resolveFeedforward({ [knob.id]: value })
      const expected = diagram.unitsShown[String(value)]
      expect(expected, `no drawn count for ${String(value)}`).toBeDefined()
      expect(resolved?.hidden.every((units) => units === expected), `width ${String(value)}`).toBe(
        true,
      )
    }
  })

  it('draws a stand-in rather than the value itself where they differ', () => {
    const knob = choiceKnob(feedforward, feedforwardDiagram(feedforward).unitsKnob)
    const widest = knob.values[knob.values.length - 1]

    const resolved = resolveFeedforward({ [knob.id]: widest as number })

    expect(resolved?.declaredUnits).toBe(widest)
    expect(resolved?.hidden[0]).toBeLessThan(Number(widest))
  })

  it('never shrinks a layer as the declared width grows', () => {
    const knob = choiceKnob(feedforward, feedforwardDiagram(feedforward).unitsKnob)

    const drawn = knob.values.map((value) => resolveFeedforward({ [knob.id]: value })?.hidden[0] ?? 0)

    expect(drawn).toEqual([...drawn].sort((a, b) => a - b))
    expect(new Set(drawn).size).toBe(drawn.length)
  })

  it('draws the declared number of input units', () => {
    expect(resolveFeedforward()?.inputs).toBe(feedforwardDiagram(feedforward).inputsShown)
  })

  it('puts the input first, the hidden layers between, and the output last', () => {
    const resolved = resolveFeedforward({ [feedforwardDiagram(feedforward).layersKnob]: 2 })
    if (resolved === undefined) throw new Error('the default configuration should resolve')

    expect(layersOf(resolved)).toEqual([resolved.inputs, ...resolved.hidden, resolved.outputs])
    expect(layersOf(resolved)).toHaveLength(resolved.hidden.length + 2)
  })
})

describe('the blocks of a convolutional task', () => {
  it('has exactly as many blocks as the depth knob says, for every value', () => {
    const knob = choiceKnob(cnn, cnnDiagram(cnn).blocksKnob)

    for (const value of knob.values) {
      const resolved = resolveCnn({ [knob.id]: value })
      expect(resolved?.blocks, `${String(value)} blocks`).toHaveLength(Number(value))
    }
  })

  it('starts at the declared base channel count and doubles it per block', () => {
    const knob = choiceKnob(cnn, cnnDiagram(cnn).channelsKnob)

    for (const base of knob.values) {
      const resolved = resolveCnn({ [knob.id]: base })
      const channels = resolved?.blocks.map((block) => block.channels) ?? []

      expect(channels[0], `base ${String(base)}`).toBe(Number(base))
      for (let block = 1; block < channels.length; block += 1) {
        expect(channels[block], `block ${block} of base ${String(base)}`).toBe(
          (channels[block - 1] ?? 0) * 2,
        )
      }
    }
  })

  it('states the true spatial size of every block, halving from the input', () => {
    const diagram = cnnDiagram(cnn)
    const knob = choiceKnob(cnn, diagram.blocksKnob)

    for (const value of knob.values) {
      const resolved = resolveCnn({ [knob.id]: value })

      expect(resolved?.inputSize).toBe(diagram.inputSize)
      expect(resolved?.blocks.map((block) => block.size), `${String(value)} blocks`).toEqual(
        blockSizes(diagram.inputSize, Number(value)),
      )
    }
  })

  it('halves the stated size of each newly added block', () => {
    const resolved = resolveCnn({ [cnnDiagram(cnn).blocksKnob]: 4 })
    const sizes = resolved?.blocks.map((block) => block.size) ?? []

    expect(sizes).toEqual([64, 32, 16, 8])
    for (let block = 1; block < sizes.length; block += 1) {
      expect(sizes[block]).toBe((sizes[block - 1] ?? 0) / 2)
    }
  })

  it('draws a channel depth that is a stand-in, not the channel count', () => {
    const diagram = cnnDiagram(cnn)
    const knob = choiceKnob(cnn, diagram.channelsKnob)

    for (const base of knob.values) {
      const resolved = resolveCnn({ [knob.id]: base })
      const first = resolved?.blocks[0]

      expect(resolved?.declaredChannels, `base ${String(base)}`).toBe(base)
      expect(first?.drawnDepth).toBe(diagram.channelsShown[String(base)])
      expect(first?.drawnDepth).toBeLessThan(first?.channels ?? 0)
    }
  })

  it('draws each block deeper than the block before it', () => {
    const knob = choiceKnob(cnn, cnnDiagram(cnn).blocksKnob)

    for (const value of knob.values) {
      const depths = resolveCnn({ [knob.id]: value })?.blocks.map((block) => block.drawnDepth) ?? []

      for (let block = 1; block < depths.length; block += 1) {
        expect(depths[block], `block ${block} of ${String(value)}`).toBeGreaterThan(
          depths[block - 1] ?? 0,
        )
      }
    }
  })

  it('grows the drawn depth with the declared channel count', () => {
    const knob = choiceKnob(cnn, cnnDiagram(cnn).channelsKnob)

    const drawn = knob.values.map((value) => resolveCnn({ [knob.id]: value })?.blocks[0]?.drawnDepth ?? 0)

    expect(drawn).toEqual([...drawn].sort((a, b) => a - b))
    expect(new Set(drawn).size).toBe(drawn.length)
  })

  it('grows in capacity with every step of either knob', () => {
    const diagram = cnnDiagram(cnn)
    const capacity = (overrides: Record<string, string | number>): number => {
      const resolved = resolveCnn(overrides)
      if (resolved === undefined) throw new Error('these values should resolve')
      // Weights of the two 3x3 convolutions of each block, which is where a convolutional
      // stack's capacity lives; the head is a few hundred parameters at any setting.
      return resolved.blocks.reduce((total, block, index) => {
        const inputChannels = index === 0 ? 3 : (resolved.blocks[index - 1]?.channels ?? 3)
        return total + 9 * inputChannels * block.channels + 9 * block.channels * block.channels
      }, 0)
    }

    for (const blocks of [2, 3]) {
      expect(capacity({ [diagram.blocksKnob]: blocks + 1 })).toBeGreaterThan(
        capacity({ [diagram.blocksKnob]: blocks }),
      )
    }
    const bases = choiceKnob(cnn, diagram.channelsKnob).values
    for (let step = 1; step < bases.length; step += 1) {
      const larger = bases[step] ?? 0
      const smaller = bases[step - 1] ?? 0
      expect(capacity({ [diagram.channelsKnob]: larger })).toBeGreaterThan(
        capacity({ [diagram.channelsKnob]: smaller }),
      )
    }
  })
})

describe('the classifier head of a convolutional task', () => {
  it('pools the last block to a vector of its channels', () => {
    const resolved = resolveCnn()
    const last = resolved?.blocks[resolved.blocks.length - 1]

    expect(resolved?.head.pooledChannels).toBe(last?.channels)
  })

  it('provides a place for a declared dropout knob to act', () => {
    // The task declares a dropout knob, so its architecture has to have somewhere to
    // apply dropout; a knob a student turns to no effect teaches that it does not matter.
    expect(cnn.knobs.some((knob) => knob.id === 'dropout')).toBe(true)
    expect(resolveCnn()?.head.appliesDropout).toBe(true)
  })

  it('has one output per declared category', () => {
    expect(resolveCnn()?.head.outputs).toBe(cnn.categories.length)
    expect(resolveCnn()?.head.outputs).toBe(3)
  })

  it('follows the categories rather than the diagram block', () => {
    const declaration = twoCategories(rawCnnTask())

    const resolved = resolveArchitecture(declaration, valuesOf(declaration))

    expect(resolved?.kind === 'cnn' ? resolved.head.outputs : undefined).toBe(2)
  })
})

describe('the output layer of a fully-connected task', () => {
  it('has one unit per declared category', () => {
    expect(resolveFeedforward()?.outputs).toBe(feedforward.categories.length)
    expect(resolveFeedforward()?.outputs).toBe(3)
  })

  it('follows the categories rather than the diagram block', () => {
    const declaration = twoCategories(rawFeedforwardTask())

    const resolved = resolveArchitecture(declaration, valuesOf(declaration))

    expect(resolved?.kind === 'feedforward' ? resolved.outputs : undefined).toBe(2)
  })
})

describe('the labels the disclosure needs', () => {
  it('carries the declared labels of both fully-connected knobs, not their ids', () => {
    const diagram = feedforwardDiagram(feedforward)
    const resolved = resolveFeedforward()

    expect(resolved?.layersLabel).toBe(
      feedforward.knobs.find((knob) => knob.id === diagram.layersKnob)?.label,
    )
    expect(resolved?.unitsLabel).toBe(
      feedforward.knobs.find((knob) => knob.id === diagram.unitsKnob)?.label,
    )
    expect(resolved?.layersLabel).not.toBe(diagram.layersKnob)
    expect(resolved?.unitsLabel).not.toBe(diagram.unitsKnob)
  })

  it('carries the declared labels of both convolutional knobs, not their ids', () => {
    const diagram = cnnDiagram(cnn)
    const resolved = resolveCnn()

    expect(resolved?.blocksLabel).toBe(
      cnn.knobs.find((knob) => knob.id === diagram.blocksKnob)?.label,
    )
    expect(resolved?.channelsLabel).toBe(
      cnn.knobs.find((knob) => knob.id === diagram.channelsKnob)?.label,
    )
    expect(resolved?.blocksLabel).not.toBe(diagram.blocksKnob)
    expect(resolved?.channelsLabel).not.toBe(diagram.channelsKnob)
  })
})

describe('when there is nothing honest to draw', () => {
  it('resolves nothing for a fully-connected value the knob does not permit', () => {
    const diagram = feedforwardDiagram(feedforward)

    expect(resolveArchitecture(feedforward, valuesOf(feedforward, { [diagram.unitsKnob]: 999 }))).toBeUndefined()
    expect(resolveArchitecture(feedforward, valuesOf(feedforward, { [diagram.layersKnob]: 5 }))).toBeUndefined()
  })

  it('resolves nothing for a convolutional value the knob does not permit', () => {
    const diagram = cnnDiagram(cnn)

    expect(resolveArchitecture(cnn, valuesOf(cnn, { [diagram.channelsKnob]: 999 }))).toBeUndefined()
    expect(resolveArchitecture(cnn, valuesOf(cnn, { [diagram.blocksKnob]: 5 }))).toBeUndefined()
  })

  it('resolves nothing when an unrelated knob value is out of range', () => {
    // The whole configuration is refused, so there is no configuration to draw.
    const slider = cnn.knobs.find((knob) => knob.kind === 'slider')
    if (slider?.kind !== 'slider') throw new Error('the test task should declare a slider')

    expect(resolveArchitecture(cnn, valuesOf(cnn, { [slider.id]: slider.max + 1 }))).toBeUndefined()
  })

  it('needs no run, no score and no screen to resolve either family', () => {
    // Nothing but a declaration and a set of values, which is what makes a second page
    // able to present an architecture.
    expect(resolveArchitecture(cnn, valuesOf(cnn))).toBeDefined()
    expect(resolveArchitecture(feedforward, valuesOf(feedforward))).toBeDefined()
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { layersOf, resolveArchitecture } from '../../../../src/task/diagram.js'
import { firstFamily } from '../../../../src/task/families.js'
import type { ChoiceKnob, TaskDeclaration } from '../../../../src/task/types.js'
import { diagrammedDeclaration } from '../../test-support/declarations.js'
import { FeedforwardDiagram } from './FeedforwardDiagram.js'

afterEach(cleanup)

const drawn = diagrammedDeclaration()
const family = firstFamily(drawn)
const repoRoot = process.cwd()
const SOURCE = join(repoRoot, 'web/src/components/architecture/FeedforwardDiagram.tsx')

function diagramOf(declaration: TaskDeclaration) {
  const diagram = firstFamily(declaration).diagram
  if (diagram?.kind !== 'feedforward') throw new Error('the task should declare a feedforward diagram')
  return diagram
}

function choiceKnob(knobId: string): ChoiceKnob {
  const knob = family.knobs.find((candidate) => candidate.id === knobId)
  if (knob?.kind !== 'choice') throw new Error(`${knobId} is expected to be a choice knob`)
  return knob
}

const DIAGRAM = diagramOf(drawn)

/** The extremes of each capacity knob, so a test can ask for the biggest drawing. */
const layerValues = () => choiceKnob(DIAGRAM.layersKnob).values
const shallowest = layerValues()[0] ?? 1
const widest = layerValues()[layerValues().length - 1] ?? 1
const broadestValues = () => choiceKnob(DIAGRAM.unitsKnob).values
const broadest = broadestValues()[broadestValues().length - 1] ?? 1

function defaults(): Record<string, string | number> {
  return Object.fromEntries(family.knobs.map((knob) => [knob.id, knob.default]))
}

/** Renders the diagram for the fully-connected task at some knob values. */
function draw(overrides: Readonly<Record<string, string | number>> = {}): HTMLElement {
  const architecture = resolveArchitecture(drawn, family, { ...defaults(), ...overrides })
  if (architecture?.kind !== 'feedforward') throw new Error('these values should resolve')
  const { container } = render(<FeedforwardDiagram architecture={architecture} />)
  return container
}

function layerGroups(container: HTMLElement, kind?: string): Element[] {
  const selector = kind === undefined ? '[data-layer]' : `[data-layer-kind="${kind}"]`
  return [...container.querySelectorAll(selector)]
}

function unitsIn(group: Element): number {
  return group.querySelectorAll('circle').length
}

function connections(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('line')]
}

describe('the layers drawn', () => {
  it('draws exactly as many hidden layers as the depth knob is set to', () => {
    for (const value of choiceKnob(DIAGRAM.layersKnob).values) {
      const container = draw({ [DIAGRAM.layersKnob]: value })

      expect(layerGroups(container, 'hidden'), `depth ${String(value)}`).toHaveLength(
        Number(value),
      )
      cleanup()
    }
  })

  it('draws the declared stand-in count in every hidden layer', () => {
    for (const value of choiceKnob(DIAGRAM.unitsKnob).values) {
      const container = draw({ [DIAGRAM.unitsKnob]: value })
      const expected = DIAGRAM.unitsShown[String(value)]

      for (const group of layerGroups(container, 'hidden')) {
        expect(unitsIn(group), `width ${String(value)}`).toBe(expected)
      }
      cleanup()
    }
  })

  it('draws an input layer and an output layer either side of the hidden ones', () => {
    const container = draw()

    expect(layerGroups(container, 'input')).toHaveLength(1)
    expect(layerGroups(container, 'output')).toHaveLength(1)
    const kinds = layerGroups(container).map((group) => group.getAttribute('data-layer-kind'))
    expect(kinds[0]).toBe('input')
    expect(kinds[kinds.length - 1]).toBe('output')
    expect(kinds.slice(1, -1).every((kind) => kind === 'hidden')).toBe(true)
  })

  it('gives the output layer one unit per declared category', () => {
    const container = draw()
    const output = layerGroups(container, 'output')[0]
    if (output === undefined) throw new Error('an output layer should be drawn')

    expect(unitsIn(output)).toBe(drawn.categories.length)
  })

  it('gives the input layer the declared number of units', () => {
    const container = draw()
    const input = layerGroups(container, 'input')[0]
    if (input === undefined) throw new Error('an input layer should be drawn')

    expect(unitsIn(input)).toBe(DIAGRAM.inputsShown)
  })
})

describe('the connections', () => {
  it('fully connects each adjacent pair of layers and nothing else', () => {
    for (const depth of choiceKnob(DIAGRAM.layersKnob).values) {
      const architecture = resolveArchitecture(drawn, family, {
        ...defaults(),
        [DIAGRAM.layersKnob]: depth,
      })
      if (architecture?.kind !== 'feedforward') throw new Error('these values should resolve')
      const layers = layersOf(architecture)
      const expected = layers
        .slice(0, -1)
        .reduce((total, units, index) => total + units * (layers[index + 1] ?? 0), 0)

      const container = draw({ [DIAGRAM.layersKnob]: depth })

      expect(connections(container), `depth ${String(depth)}`).toHaveLength(expected)
      cleanup()
    }
  })

  it('joins only layers that are next to each other', () => {
    const container = draw({ [DIAGRAM.layersKnob]: widest, [DIAGRAM.unitsKnob]: broadest })

    const steps = connections(container).map(
      (line) => Number(line.getAttribute('data-to')) - Number(line.getAttribute('data-from')),
    )

    expect(steps.length).toBeGreaterThan(20)
    expect(new Set(steps)).toEqual(new Set([1]))
  })

  it('joins no two units within one layer', () => {
    const container = draw()

    for (const line of connections(container)) {
      expect(line.getAttribute('data-from')).not.toBe(line.getAttribute('data-to'))
      expect(line.getAttribute('x1')).not.toBe(line.getAttribute('x2'))
    }
  })
})

describe('the drawing as a labelled graphic', () => {
  it('is one graphic whose name states the layers and the declared units', () => {
    draw({ [DIAGRAM.layersKnob]: widest, [DIAGRAM.unitsKnob]: broadest })

    const graphic = screen.getByRole('img')
    const name = graphic.getAttribute('aria-label') ?? ''

    expect(name).toContain(`${String(widest)} hidden layers`)
    expect(name).toContain(String(broadest))
    expect(name).toContain(String(drawn.categories.length))
  })

  it('renames itself when a knob it depends on changes', () => {
    draw({ [DIAGRAM.layersKnob]: shallowest })
    const before = screen.getByRole('img').getAttribute('aria-label')
    cleanup()

    draw({ [DIAGRAM.layersKnob]: widest })
    const after = screen.getByRole('img').getAttribute('aria-label')

    expect(before).toContain(`${String(shallowest)} hidden layers`)
    expect(after).toContain(`${String(widest)} hidden layers`)
    expect(after).not.toBe(before)
  })
})

describe('what the copy says about the drawing', () => {
  it('states the units the configuration actually specifies', () => {
    for (const value of choiceKnob(DIAGRAM.unitsKnob).values) {
      const container = draw({ [DIAGRAM.unitsKnob]: value })

      expect(container.textContent, `width ${String(value)}`).toContain(String(value))
      cleanup()
    }
  })

  it('marks the drawn units as a stand-in rather than a count', () => {
    const container = draw()

    const abstracted = container.querySelector('.abstracted')?.textContent ?? ''
    expect(abstracted).toContain('stand-in')
    expect(abstracted).toContain('not')
    expect(abstracted).toContain('count')
  })

  it('does not disclaim the number of layers', () => {
    const container = draw()

    const exact = container.querySelector('.exact')?.textContent ?? ''
    expect(exact).toContain('exactly')
    for (const hedge of ['stand-in', 'roughly', 'about', 'approximate']) {
      expect(exact, `the layer count is hedged with "${hedge}"`).not.toContain(hedge)
    }
  })

  it('names both knobs by their declared labels', () => {
    const container = draw()

    for (const knobId of [DIAGRAM.layersKnob, DIAGRAM.unitsKnob]) {
      const label = family.knobs.find((knob) => knob.id === knobId)?.label
      if (label === undefined) throw new Error(`no label for ${knobId}`)
      expect(container.textContent).toContain(label)
    }
  })

  it('names no knob id in the component source', () => {
    const source = readFileSync(SOURCE, 'utf8')

    for (const knob of family.knobs) {
      expect(source, `the component names "${knob.id}"`).not.toMatch(
        new RegExp(`['"\`]${knob.id}['"\`]`),
      )
    }
  })
})

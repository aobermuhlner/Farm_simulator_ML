/**
 * The convolutional drawing.
 *
 * Run against a task whose resolution, stage counts, filter counts and categories are all
 * different from the shipped lesson's, and mounted directly with nothing but a resolved
 * architecture — no declaration, no screen, no run.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveArchitecture } from '../../../../src/task/diagram.js'
import { firstFamily } from '../../../../src/task/families.js'
import type { ChoiceKnob } from '../../../../src/task/types.js'
import {
  appleDeclaration,
  convolutionalDeclaration,
} from '../../test-support/declarations.js'
import { CnnDiagram } from './CnnDiagram.js'

afterEach(cleanup)

const task = convolutionalDeclaration()
const family = firstFamily(task)
const SOURCE = join(process.cwd(), 'web/src/components/architecture/CnnDiagram.tsx')

const DIAGRAM = (() => {
  if (family.diagram?.kind !== 'cnn') throw new Error('the test task should declare a cnn')
  return family.diagram
})()

function choiceKnob(knobId: string): ChoiceKnob {
  const knob = family.knobs.find((candidate) => candidate.id === knobId)
  if (knob?.kind !== 'choice') throw new Error(`${knobId} is expected to be a choice knob`)
  return knob
}

function defaults(): Record<string, string | number> {
  return Object.fromEntries(family.knobs.map((knob) => [knob.id, knob.default]))
}

/** Renders the drawing for the convolutional task at some knob values. */
function draw(overrides: Readonly<Record<string, string | number>> = {}): HTMLElement {
  const architecture = resolveArchitecture(task, family, { ...defaults(), ...overrides })
  if (architecture?.kind !== 'cnn') throw new Error('these values should resolve')
  const { container } = render(<CnnDiagram architecture={architecture} />)
  return container
}

function volumes(container: HTMLElement, kind?: string): Element[] {
  const selector = kind === undefined ? '[data-volume]' : `[data-volume-kind="${kind}"]`
  return [...container.querySelectorAll(selector)]
}

/** The drawn side of a volume's front face, which is what a reader compares. */
function drawnSide(volume: Element): number {
  const front = volume.querySelector('[data-face="0"]')
  return Number(front?.getAttribute('width') ?? 0)
}

function drawnFaces(volume: Element): number {
  return volume.querySelectorAll('[data-face]').length
}

function numberOf(volume: Element, attribute: string): number {
  return Number(volume.getAttribute(attribute) ?? 0)
}

const blockValues = choiceKnob(DIAGRAM.blocksKnob).values
const channelValues = choiceKnob(DIAGRAM.channelsKnob).values
const deepest = blockValues[blockValues.length - 1] ?? 2
const shallowest = blockValues[0] ?? 2

describe('the volumes drawn', () => {
  it('draws one feature-map volume per block, after the input', () => {
    for (const value of blockValues) {
      const container = draw({ [DIAGRAM.blocksKnob]: value })

      expect(volumes(container, 'block'), `${String(value)} blocks`).toHaveLength(Number(value))
      expect(volumes(container, 'input')).toHaveLength(1)
      cleanup()
    }
  })

  it('draws the input as an image volume rather than a column of units', () => {
    const container = draw()
    const input = volumes(container, 'input')[0]
    if (input === undefined) throw new Error('an input volume should be drawn')

    expect(input.querySelectorAll('rect').length).toBeGreaterThan(0)
    expect(input.querySelectorAll('circle')).toHaveLength(0)
    expect(numberOf(input, 'data-size')).toBe(DIAGRAM.inputSize)
  })

  it('draws each volume spatially smaller than the volume before it', () => {
    const container = draw({ [DIAGRAM.blocksKnob]: deepest })
    const sides = volumes(container).map(drawnSide)

    expect(sides.length).toBe(Number(deepest) + 1)
    for (let volume = 1; volume < sides.length; volume += 1) {
      expect(sides[volume], `volume ${volume}`).toBeLessThan(sides[volume - 1] ?? 0)
    }
  })

  it('draws each volume deeper than the volume before it', () => {
    const container = draw({ [DIAGRAM.blocksKnob]: deepest })
    const depths = volumes(container).map(drawnFaces)

    for (let volume = 1; volume < depths.length; volume += 1) {
      expect(depths[volume], `volume ${volume}`).toBeGreaterThan(depths[volume - 1] ?? 0)
    }
  })

  it('compresses the drawn sizes rather than scaling them', () => {
    // Drawn to scale, the last of four volumes would be a sixteenth of the first: a few
    // pixels beside a legible box. The stated sizes stay exact; the boxes do not.
    const container = draw({ [DIAGRAM.blocksKnob]: deepest })
    const sides = volumes(container).map(drawnSide)
    const first = sides[0] ?? 1
    const last = sides[sides.length - 1] ?? 1
    const trueRatio = DIAGRAM.inputSize / 2 ** Number(deepest)

    expect(first / last).toBeLessThan(DIAGRAM.inputSize / trueRatio)
    expect(first / last).toBeGreaterThan(1)
  })
})

describe('the spatial sizes stated', () => {
  it('states the true size of every block, derived from the input resolution', () => {
    for (const value of blockValues) {
      const container = draw({ [DIAGRAM.blocksKnob]: value })
      const stated = volumes(container, 'block').map((volume) => numberOf(volume, 'data-size'))
      const expected = Array.from(
        { length: Number(value) },
        (_, block) => DIAGRAM.inputSize / 2 ** (block + 1),
      )

      expect(stated, `${String(value)} blocks`).toEqual(expected)
      cleanup()
    }
  })

  it('states each size on screen as text, not only as data', () => {
    const container = draw({ [DIAGRAM.blocksKnob]: shallowest })
    const text = container.textContent ?? ''

    for (let block = 1; block <= Number(shallowest); block += 1) {
      const size = DIAGRAM.inputSize / 2 ** block
      expect(text, `size ${size}`).toContain(String(size))
    }
  })

  it('halves the size stated for a newly added block', () => {
    const shorter = draw({ [DIAGRAM.blocksKnob]: shallowest })
    const before = volumes(shorter, 'block').map((volume) => numberOf(volume, 'data-size'))
    cleanup()

    const longer = draw({ [DIAGRAM.blocksKnob]: Number(shallowest) + 1 })
    const after = volumes(longer, 'block').map((volume) => numberOf(volume, 'data-size'))

    expect(after.slice(0, before.length)).toEqual(before)
    expect(after[after.length - 1]).toBe((before[before.length - 1] ?? 0) / 2)
  })

  it('does not disclaim the spatial sizes as approximations', () => {
    const container = draw()
    const exact = container.querySelector('.exact')?.textContent ?? ''
    const abstracted = container.querySelector('.abstracted')?.textContent ?? ''

    expect(exact).toContain('exact')
    for (const hedge of ['stand-in', 'roughly', 'about', 'approximate']) {
      expect(exact, `the sizes are hedged with "${hedge}"`).not.toContain(hedge)
    }
    // The abstraction copy is about the channel depth, and says nothing about size.
    expect(abstracted).toContain('stand-in')
    expect(abstracted).not.toContain('size')
  })
})

describe('the channel depth drawn', () => {
  it('states each block true channel count while drawing a smaller depth', () => {
    for (const base of channelValues) {
      const container = draw({ [DIAGRAM.channelsKnob]: base })

      volumes(container, 'block').forEach((volume, block) => {
        const channels = numberOf(volume, 'data-channels')
        expect(channels, `block ${block} of base ${String(base)}`).toBe(
          Number(base) * 2 ** block,
        )
        expect(drawnFaces(volume)).toBeLessThan(channels)
      })
      cleanup()
    }
  })

  it('redraws the depth when the channel knob changes', () => {
    const smaller = draw({ [DIAGRAM.channelsKnob]: channelValues[0] as number })
    const before = volumes(smaller, 'block').map(drawnFaces)
    cleanup()

    const larger = draw({
      [DIAGRAM.channelsKnob]: channelValues[channelValues.length - 1] as number,
    })
    const after = volumes(larger, 'block').map(drawnFaces)

    expect(after).not.toEqual(before)
    after.forEach((depth, block) => expect(depth).toBeGreaterThan(before[block] ?? 0))
  })

  it('discloses the depth as a stand-in and states the value the configuration specifies', () => {
    for (const base of channelValues) {
      const container = draw({ [DIAGRAM.channelsKnob]: base })
      const abstracted = container.querySelector('.abstracted')?.textContent ?? ''

      expect(abstracted, `base ${String(base)}`).toContain(String(base))
      expect(abstracted).toContain('stand-in')
      expect(abstracted).toContain('not a count')
      cleanup()
    }
  })
})

describe('locality rather than connectivity', () => {
  it('draws no full connectivity between two volumes', () => {
    const container = draw({ [DIAGRAM.blocksKnob]: deepest })
    const drawnVolumes = volumes(container)

    for (let pair = 0; pair + 1 < drawnVolumes.length; pair += 1) {
      const between = container.querySelectorAll(
        `[data-from="${pair}"][data-to="${pair + 1}"] line`,
      ).length
      const positions =
        numberOf(drawnVolumes[pair] as Element, 'data-size') ** 2 *
        numberOf(drawnVolumes[pair + 1] as Element, 'data-size') ** 2

      expect(between).toBeGreaterThan(0)
      expect(between, `pair ${pair}`).not.toBe(positions)
      expect(between).toBeLessThan(positions)
    }
  })

  it('depicts a local region of one volume producing a position in the next', () => {
    const container = draw({ [DIAGRAM.blocksKnob]: deepest })
    const patches = [...container.querySelectorAll('[data-patch]')]

    expect(patches).toHaveLength(Number(deepest))
    for (const patch of patches) {
      const region = patch.querySelector('.patch')
      const position = patch.querySelector('.position')
      const earlier = Number(
        container
          .querySelector(`[data-volume="${patch.getAttribute('data-from')}"] [data-face="0"]`)
          ?.getAttribute('width') ?? 0,
      )

      expect(region).not.toBeNull()
      expect(position).not.toBeNull()
      // A region, not the whole face: a convolution looks at a patch of what it is given.
      expect(Number(region?.getAttribute('width') ?? 0)).toBeLessThan(earlier)
    }
  })

  it('draws none of the fully-connected portrayal', () => {
    const container = draw()

    expect(container.querySelector('.connections')).toBeNull()
    expect(container.querySelectorAll('[data-layer-kind]')).toHaveLength(0)
  })
})

describe('the classifier head', () => {
  it('shows the pooling and the dense classifier between the last volume and the outputs', () => {
    const container = draw()

    expect(container.querySelector('[data-stage="pooling"]')).not.toBeNull()
    expect(container.querySelector('[data-stage="classifier"]')).not.toBeNull()
    expect(container.textContent).toContain('pooled')
  })

  it('shows the stage where the dropout knob acts', () => {
    const container = draw()

    expect(container.querySelector('[data-stage="regularizer"]')).not.toBeNull()
    expect(container.textContent).toContain('Dropout')
  })

  it('draws one output per declared category', () => {
    const container = draw()

    expect(container.querySelectorAll('[data-output]')).toHaveLength(task.categories.length)
    expect(task.categories).toHaveLength(2)
  })

  it('follows a task declaring a different number of categories', () => {
    const apple = appleDeclaration()
    const architecture = resolveArchitecture(
      apple,
      firstFamily(apple),
      Object.fromEntries(firstFamily(apple).knobs.map((knob) => [knob.id, knob.default])),
    )
    if (architecture?.kind !== 'cnn') throw new Error('the shipped task should resolve as a cnn')

    const { container } = render(<CnnDiagram architecture={architecture} />)

    expect(container.querySelectorAll('[data-output]')).toHaveLength(apple.categories.length)
    expect(apple.categories.length).toBe(3)
  })
})

describe('the drawing as a labelled graphic', () => {
  it('names the blocks, each block channel count and the size the stack reduces to', () => {
    draw({ [DIAGRAM.blocksKnob]: deepest })
    const name = screen.getByRole('img').getAttribute('aria-label') ?? ''
    const last = DIAGRAM.inputSize / 2 ** Number(deepest)

    expect(name).toContain(`${String(deepest)} blocks`)
    for (let block = 0; block < Number(deepest); block += 1) {
      const channels = Number(family.knobs.find((knob) => knob.id === DIAGRAM.channelsKnob)?.default) * 2 ** block
      expect(name, `channels of block ${block}`).toContain(String(channels))
    }
    expect(name).toContain(`${last} by ${last}`)
  })

  it('renames itself when a knob it depends on changes', () => {
    draw({ [DIAGRAM.blocksKnob]: shallowest })
    const before = screen.getByRole('img').getAttribute('aria-label')
    cleanup()

    draw({ [DIAGRAM.blocksKnob]: deepest })
    const after = screen.getByRole('img').getAttribute('aria-label')

    expect(before).toContain(`${String(shallowest)} blocks`)
    expect(after).toContain(`${String(deepest)} blocks`)
    expect(after).not.toBe(before)
  })
})

describe('what the drawing may not know', () => {
  it('names both knobs by their declared labels', () => {
    const container = draw()

    for (const knobId of [DIAGRAM.blocksKnob, DIAGRAM.channelsKnob]) {
      const label = family.knobs.find((knob) => knob.id === knobId)?.label
      if (label === undefined) throw new Error(`no label for ${knobId}`)
      expect(container.textContent).toContain(label)
    }
  })

  it('names no knob id of either task in the component source', () => {
    const source = readFileSync(SOURCE, 'utf8')
    const apple = appleDeclaration()

    for (const knob of [...family.knobs, ...firstFamily(apple).knobs]) {
      expect(source, `the component names "${knob.id}"`).not.toMatch(
        new RegExp(`['"\`]${knob.id}['"\`]`),
      )
    }
  })
})

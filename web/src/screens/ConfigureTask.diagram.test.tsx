/**
 * The architecture diagram seated on the configuration screen.
 *
 * Kept apart from `ConfigureTask.test.tsx`, which is about a screen rendered from knob
 * declarations alone; these tests are about the drawing beside them and about what
 * happens for a task that declares none.
 *
 * The shipped task is convolutional, so the tests that follow its knobs count volumes.
 * A fully-connected task is mounted on the same screen further down, which is what shows
 * the screen picks a drawing from the declaration rather than knowing one.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { CnnDiagram, FeedforwardDiagram, TaskDeclaration } from '../../../src/task/types.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import {
  appleArtifact,
  entryLoader,
  appleDeclaration,
  appleTruth,
  convolutionalDeclaration,
  diagrammedDeclaration,
  unrelatedArtifact,
  unrelatedDeclaration,
  unrelatedTruth,
} from '../test-support/declarations.js'
import { ConfigureTask } from './ConfigureTask.js'

afterEach(cleanup)

const apple = appleDeclaration()

const DIAGRAM: CnnDiagram = (() => {
  if (apple.diagram?.kind !== 'cnn') {
    throw new Error('the apple task should declare a convolutional diagram')
  }
  return apple.diagram
})()

function render_(declaration: TaskDeclaration) {
  return render(
    <ConfigureTask
      declaration={declaration}
      loadEntry={entryLoader(appleArtifact())}
      truth={appleTruth()}
      replayMs={0}
      onBack={() => {}}
    />,
  )
}

/** Renders a task that brings its own artifact-free stand-ins. */
function renderOther(declaration: TaskDeclaration) {
  return render(
    <ConfigureTask
      declaration={declaration}
      loadEntry={entryLoader(unrelatedArtifact())}
      truth={unrelatedTruth()}
      replayMs={0}
      onBack={() => {}}
    />,
  )
}

/** The declared label of a knob the diagram names. */
function labelOf(knobId: string): string {
  const label = apple.knobs.find((knob) => knob.id === knobId)?.label
  if (label === undefined) throw new Error(`no label for ${knobId}`)
  return label
}

function drawing(): HTMLElement {
  return screen.getByRole('img')
}

function blockVolumes(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-volume-kind="block"]')]
}

function facesInFirstBlock(container: HTMLElement): number {
  const first = blockVolumes(container)[0]
  if (first === undefined) throw new Error('a block volume should be drawn')
  return first.querySelectorAll('[data-face]').length
}

function hiddenLayers(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-layer-kind="hidden"]')]
}

function unitsInFirstHidden(container: HTMLElement): number {
  const first = hiddenLayers(container)[0]
  if (first === undefined) throw new Error('a hidden layer should be drawn')
  return first.querySelectorAll('circle').length
}

/**
 * Picks a choice knob's option by the value it shows.
 *
 * By element rather than by string: a control's option values are indices while its
 * labels are the declared values, so passing "2" to `selectOptions` for a knob offering
 * 2, 3 and 4 matches the option *labelled* 2 rather than the one at index 2.
 */
async function choose(label: string, value: string | number): Promise<void> {
  const select = screen.getByLabelText(label) as HTMLSelectElement
  const option = within(select).getByRole('option', { name: String(value) })
  await userEvent.selectOptions(select, option as HTMLOptionElement)
}

/** Every value a choice knob of the apple task permits. */
function valuesOf(knobId: string): readonly (string | number)[] {
  const knob = apple.knobs.find((candidate) => candidate.id === knobId)
  if (knob?.kind !== 'choice') throw new Error(`${knobId} is expected to be a choice`)
  return knob.values
}

describe('the diagram beside the settings', () => {
  it('is shown alongside every declared knob control, with no run scored', () => {
    const { container } = render_(apple)

    expect(drawing()).toBeDefined()
    for (const knob of apple.knobs) {
      expect(screen.getByLabelText(knob.label), `no control for ${knob.id}`).toBeDefined()
    }
    expect(blockVolumes(container).length).toBeGreaterThan(0)
    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    expect(screen.queryByText(/Total earnings/)).toBeNull()
  })

  it('sits in the same column block as the settings, not below the run button', () => {
    const { container } = render_(apple)
    const columns = container.querySelector('.configure-columns')

    expect(columns).not.toBeNull()
    expect(within(columns as HTMLElement).getByRole('group', { name: 'Settings' })).toBeDefined()
    expect(within(columns as HTMLElement).getByRole('img')).toBeDefined()
  })

  it('needs no run to appear', () => {
    render_(apple)

    expect(screen.getByRole('button', { name: 'Train model' })).toBeDefined()
    expect(drawing().getAttribute('aria-label')).toContain('blocks')
  })
})

describe('the drawing follows the knobs', () => {
  it('redraws the blocks when the depth knob changes, with no run in between', async () => {
    const { container } = render_(apple)

    for (const value of valuesOf(DIAGRAM.blocksKnob)) {
      await choose(labelOf(DIAGRAM.blocksKnob), value)

      expect(blockVolumes(container), `${String(value)} blocks`).toHaveLength(Number(value))
      expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    }
  })

  it('redraws the channel depth when the width knob changes, with no run in between', async () => {
    const { container } = render_(apple)

    for (const value of valuesOf(DIAGRAM.channelsKnob)) {
      await choose(labelOf(DIAGRAM.channelsKnob), value)

      expect(facesInFirstBlock(container), `channels ${String(value)}`).toBe(
        DIAGRAM.channelsShown[String(value)],
      )
      expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    }
  })

  it('states the newly selected channel count, not the one left behind', async () => {
    const { container } = render_(apple)
    const values = valuesOf(DIAGRAM.channelsKnob)
    const [first] = values
    const last = values[values.length - 1]
    if (first === undefined || last === undefined) throw new Error('two values expected')

    await choose(labelOf(DIAGRAM.channelsKnob), last)

    // Matched against the knob's label, because the channel counts of later blocks
    // contain the digits of the smaller values.
    const abstracted = container.querySelector('.abstracted')?.textContent ?? ''
    expect(abstracted).toContain(`${labelOf(DIAGRAM.channelsKnob)}: ${String(last)}`)
    expect(abstracted).not.toContain(`${labelOf(DIAGRAM.channelsKnob)}: ${String(first)}`)
  })

  it('restates the spatial sizes when the depth knob changes', async () => {
    const { container } = render_(apple)
    const values = valuesOf(DIAGRAM.blocksKnob)
    const deepest = values[values.length - 1]
    if (deepest === undefined) throw new Error('a value expected')

    await choose(labelOf(DIAGRAM.blocksKnob), deepest)

    const stated = blockVolumes(container).map((volume) =>
      Number(volume.getAttribute('data-size')),
    )
    expect(stated).toEqual(
      Array.from({ length: Number(deepest) }, (_, block) => DIAGRAM.inputSize / 2 ** (block + 1)),
    )
  })
})

describe('a task that declares no diagram', () => {
  it('is shown none, and is otherwise the same screen', () => {
    const other = unrelatedDeclaration()
    expect(other.diagram).toBeUndefined()

    renderOther(other)

    expect(screen.queryByRole('img')).toBeNull()
    for (const knob of other.knobs) {
      expect(screen.getByLabelText(knob.label)).toBeDefined()
    }
    expect(screen.getByRole('heading', { name: other.title })).toBeDefined()
  })

  it('still runs', async () => {
    const other = unrelatedDeclaration()
    renderOther(other)

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Run a month' }))

    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()
    // The replay draws curves, which are images too — so this asks specifically whether
    // an architecture was drawn. None is declared, so none should be.
    expect(document.querySelector('.network-drawing, .cnn-drawing')).toBeNull()
  })
})

describe('a configuration that does not resolve', () => {
  /**
   * A declaration the validator would refuse — its depth knob defaults to a value its own
   * list does not permit — built by hand to reach the branch that draws nothing beside a
   * refused configuration. The screen's own controls cannot produce that state, which is
   * exactly why it is worth pinning.
   */
  function impossible(): TaskDeclaration {
    const declaration = {
      ...apple,
      knobs: apple.knobs.map((knob) =>
        knob.id === DIAGRAM.blocksKnob && knob.kind === 'choice'
          ? { ...knob, default: 5 }
          : knob,
      ),
    } as TaskDeclaration
    expect(validateDeclaration(declaration).ok).toBe(false)
    return declaration
  }

  it('draws nothing, and shows the refusal the engine named', () => {
    render_(impossible())

    expect(screen.queryByRole('img')).toBeNull()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('does not permit')
    expect(screen.queryByTestId('current-configuration')).toBeNull()
  })
})

describe('a fully-connected task on the same screen', () => {
  /** The feedforward diagram of the drawn test task. */
  function diagramOf(declaration: TaskDeclaration): FeedforwardDiagram {
    if (declaration.diagram?.kind !== 'feedforward') {
      throw new Error('the drawn test task should declare a feedforward diagram')
    }
    return declaration.diagram
  }

  it('draws from its own declaration, with no screen code of its own', () => {
    const other = diagrammedDeclaration()
    const diagram = diagramOf(other)

    const { container } = renderOther(other)

    // Its own knobs, its own mapping: one stage of one unit by default, two inputs, and
    // two outputs because it declares two categories.
    expect(hiddenLayers(container)).toHaveLength(1)
    expect(unitsInFirstHidden(container)).toBe(diagram.unitsShown.narrow)
    expect(
      container.querySelector('[data-layer-kind="output"]')?.querySelectorAll('circle').length,
    ).toBe(other.categories.length)
    expect(
      container.querySelector('[data-layer-kind="input"]')?.querySelectorAll('circle').length,
    ).toBe(diagram.inputsShown)
    // Nothing convolutional is drawn for it.
    expect(container.querySelectorAll('[data-volume]')).toHaveLength(0)
  })

  it('follows its own knobs, including a width knob taking strings', async () => {
    const other = diagrammedDeclaration()
    const diagram = diagramOf(other)
    const breadth = other.knobs.find((knob) => knob.id === diagram.unitsKnob)
    const stack = other.knobs.find((knob) => knob.id === diagram.layersKnob)
    if (breadth?.kind !== 'choice' || stack?.kind !== 'choice') {
      throw new Error('both knobs are expected to be choices')
    }

    const { container } = renderOther(other)
    const widestStack = stack.values[stack.values.length - 1]
    const widestBreadth = breadth.values[breadth.values.length - 1]
    if (widestStack === undefined || widestBreadth === undefined) {
      throw new Error('both knobs should offer values')
    }
    await choose(stack.label, widestStack)
    await choose(breadth.label, widestBreadth)

    expect(hiddenLayers(container)).toHaveLength(Number(widestStack))
    expect(unitsInFirstHidden(container)).toBe(diagram.unitsShown[String(widestBreadth)])
    expect(container.textContent).toContain(String(widestBreadth))
  })
})

describe('a second convolutional task on the same screen', () => {
  it('draws its own resolution, stages and categories', async () => {
    const other = convolutionalDeclaration()
    if (other.diagram?.kind !== 'cnn') throw new Error('expected a convolutional test task')
    const diagram = other.diagram
    const stages = other.knobs.find((knob) => knob.id === diagram.blocksKnob)
    if (stages?.kind !== 'choice') throw new Error('its depth knob should be a choice')

    const { container } = renderOther(other)
    const deepest = stages.values[stages.values.length - 1]
    if (deepest === undefined) throw new Error('its depth knob should offer values')

    const select = screen.getByLabelText(stages.label) as HTMLSelectElement
    await userEvent.selectOptions(
      select,
      within(select).getByRole('option', { name: String(deepest) }) as HTMLOptionElement,
    )

    expect(blockVolumes(container)).toHaveLength(Number(deepest))
    expect(
      blockVolumes(container).map((volume) => Number(volume.getAttribute('data-size'))),
    ).toEqual(
      Array.from({ length: Number(deepest) }, (_, block) => diagram.inputSize / 2 ** (block + 1)),
    )
    expect(container.querySelectorAll('[data-output]')).toHaveLength(other.categories.length)
    // Nothing of the apple task's architecture leaks into it.
    expect(diagram.inputSize).not.toBe(DIAGRAM.inputSize)
  })
})

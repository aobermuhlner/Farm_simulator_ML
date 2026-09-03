import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runHarvest } from '../../../src/scoring/index.js'
import {
  appleArtifact,
  appleDeclaration,
  appleTruth,
  unrelatedArtifact,
  unrelatedDeclaration,
  unrelatedTruth,
} from '../test-support/declarations.js'
import { ConfigureTask } from './ConfigureTask.js'

afterEach(cleanup)

const apple = appleDeclaration()

function renderApple(fixtureBacked = true) {
  return render(
    <ConfigureTask
      declaration={apple}
      artifact={appleArtifact()}
      truth={appleTruth()}
      fixtureBacked={fixtureBacked}
      onBack={() => {}}
    />,
  )
}

/** The select rendered for a choice knob, found by its declared label. */
function knobSelect(label: string): HTMLSelectElement {
  return screen.getByLabelText(label) as HTMLSelectElement
}

async function run(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Run a month' }))
}

/** The report region, so queries do not also match the form above it. */
function report(): HTMLElement {
  return screen.getByRole('region', { name: 'Run report' })
}

describe('arriving at a task', () => {
  it('shows the declared title and task-level teaching copy', () => {
    renderApple()

    expect(screen.getByRole('heading', { name: apple.title })).toBeDefined()
    expect(screen.getByText(apple.teaching.summary)).toBeDefined()
  })

  it('offers the declared theory behind a help affordance', async () => {
    renderApple()

    await userEvent.click(screen.getByText('What am I actually changing?'))

    expect(screen.getByText(apple.teaching.theory)).toBeDefined()
  })
})

describe('the configuration screen renders from knob declarations', () => {
  it('renders one control per declared knob, labelled as declared', () => {
    renderApple()

    for (const knob of apple.knobs) {
      expect(screen.getByLabelText(knob.label), `no control for ${knob.id}`).toBeDefined()
    }
  })

  it('offers a choice knob exactly its declared values', () => {
    renderApple()
    const blocks = apple.knobs.find((knob) => knob.id === 'blocks')
    if (blocks?.kind !== 'choice') throw new Error('the depth knob is expected to be a choice')

    const options = within(knobSelect(blocks.label)).getAllByRole('option')

    expect(options.map((option) => option.textContent)).toEqual(
      blocks.values.map((value) => String(value)),
    )
  })

  it('gives a slider knob its declared min, max and step', () => {
    renderApple()
    const slider = apple.knobs.find((knob) => knob.kind === 'slider')
    if (slider?.kind !== 'slider') throw new Error('the apple task is expected to declare a slider')

    const input = screen.getByLabelText(slider.label)

    expect(input.getAttribute('type')).toBe('range')
    expect(input.getAttribute('min')).toBe(String(slider.min))
    expect(input.getAttribute('max')).toBe(String(slider.max))
    expect(input.getAttribute('step')).toBe(String(slider.step))
  })

  it('seeds every knob at its declared default', () => {
    renderApple()

    for (const knob of apple.knobs) {
      const control = screen.getByLabelText(knob.label) as HTMLInputElement | HTMLSelectElement
      const shown =
        knob.kind === 'choice' ? knob.values[Number(control.value)] : Number(control.value)
      expect(shown, `${knob.id} did not start at its default`).toBe(knob.default)
    }
  })

  it('renders a task whose knobs it has never seen', () => {
    const other = unrelatedDeclaration()
    render(
      <ConfigureTask
        declaration={other}
        artifact={unrelatedArtifact()}
        truth={unrelatedTruth()}
        fixtureBacked
        onBack={() => {}}
      />,
    )

    for (const knob of other.knobs) {
      expect(screen.getByLabelText(knob.label)).toBeDefined()
    }
  })
})

describe('knob help', () => {
  it('offers help on every rendered knob and shows the declared copy', async () => {
    renderApple()

    for (const knob of apple.knobs) {
      const affordance = screen.getByText(`What does ${knob.label} do?`)
      await userEvent.click(affordance)
      expect(screen.getByText(knob.help), `${knob.id} help copy missing`).toBeDefined()
    }
  })
})

describe('configuration identity', () => {
  it('shows the identifier the engine resolves the knob values to', () => {
    renderApple()

    expect(screen.getByTestId('current-configuration').textContent).toBe(
      'blocks2-channels16-regularization1-dropout0',
    )
  })

  it('shows one identical identifier however the knobs were reached', async () => {
    const { unmount } = renderApple()
    await userEvent.selectOptions(knobSelect('Convolutional blocks'), '0')
    await userEvent.selectOptions(knobSelect('Patterns per block'), '2')
    const setInOneOrder = screen.getByTestId('current-configuration').textContent
    unmount()

    renderApple()
    await userEvent.selectOptions(knobSelect('Patterns per block'), '2')
    await userEvent.selectOptions(knobSelect('Convolutional blocks'), '0')
    const setInTheOther = screen.getByTestId('current-configuration').textContent

    expect(setInOneOrder).toBe(setInTheOther)
  })
})

describe('running a harvest', () => {
  it('reports the earnings the engine computed, not its own', async () => {
    renderApple()
    await run()

    const expected = runHarvest(
      apple,
      Object.fromEntries(apple.knobs.map((knob) => [knob.id, knob.default])),
      appleArtifact(),
      'pool',
      appleTruth(),
    )
    if (!expected.ok) throw new Error('the default configuration should run')

    expect(screen.getByText(/Total earnings/).textContent).toContain(
      expected.outcome.earnings.toFixed(2),
    )
  })

  it('derives no outcome of its own when the engine refuses', async () => {
    renderApple()
    await userEvent.selectOptions(knobSelect('Patterns per block'), '2')
    await run()

    expect(screen.queryByText(/Total earnings/)).toBeNull()
    expect(screen.getByRole('alert')).toBeDefined()
  })
})

describe('the report and the configuration it came from', () => {
  it('names the configuration the report was produced from', async () => {
    renderApple()
    await run()

    expect(within(report()).getByText(/blocks2-channels16-regularization1-dropout0/)).toBeDefined()
  })

  it('stops presenting a report as current once a knob moves', async () => {
    renderApple()
    await run()
    expect(within(report()).getByText(/images evaluated/)).toBeDefined()

    // Option 1, not 0: the declaration now opens on the first option, and selecting the
    // value that is already set would move no knob at all.
    await userEvent.selectOptions(knobSelect('Convolutional blocks'), '1')

    expect(within(report()).queryByText(/images evaluated/)).toBeNull()
    expect(within(report()).getByRole('status').textContent).toContain('changed the knobs since')
  })

  it('reports the new configuration after running again', async () => {
    renderApple()
    await run()
    await userEvent.selectOptions(knobSelect('Convolutional blocks'), '1')
    await run()

    expect(within(report()).getByText(/blocks3-channels16-regularization1-dropout0/)).toBeDefined()
  })

  it('discloses that the predictions were fixtures', async () => {
    renderApple()
    await run()

    expect(screen.getByRole('note').textContent).toContain('fixture data')
  })

  it('omits the fixture disclosure when the data is not fixture-backed', async () => {
    renderApple(false)
    await run()

    expect(screen.queryByRole('note')).toBeNull()
  })
})

describe('refusals', () => {
  it('explains an unprecomputed configuration and names it', async () => {
    renderApple()
    await userEvent.selectOptions(knobSelect('Patterns per block'), '2')
    await run()

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('blocks2-channels32-regularization1-dropout0')
    expect(alert.textContent).toContain('trained in advance')
  })

  it('shows the cause the engine named rather than a message of its own', async () => {
    const declaration = apple
    const stale = { ...appleArtifact(), schemaVersion: '9.9.9' }
    render(
      <ConfigureTask
        declaration={declaration}
        artifact={stale}
        truth={appleTruth()}
        fixtureBacked
        onBack={() => {}}
      />,
    )
    await run()

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('9.9.9')
    expect(alert.textContent).toContain('1.0.0')
    expect(screen.queryByText(/Total earnings/)).toBeNull()
  })
})

describe('leaving the task', () => {
  it('offers a way back to the farm', async () => {
    const onBack = vi.fn()
    render(
      <ConfigureTask
        declaration={apple}
        artifact={appleArtifact()}
        truth={appleTruth()}
        fixtureBacked
        onBack={onBack}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})

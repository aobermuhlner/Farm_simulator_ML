import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appleArtifact,
  appleDeclaration,
  entryLoader,
  unrelatedArtifact,
  unrelatedDeclaration,
} from '../test-support/declarations.js'
import { ConfigureTask } from './ConfigureTask.js'

afterEach(cleanup)

const apple = appleDeclaration()

function renderApple() {
  return render(
    <ConfigureTask
      declaration={apple}
      loadEntry={entryLoader(appleArtifact())}
      replayMs={0}
      onBack={() => {}}
      onPutToWork={() => {}}
    />,
  )
}

/** The select rendered for a choice knob, found by its declared label. */
function knobSelect(label: string): HTMLSelectElement {
  return screen.getByLabelText(label) as HTMLSelectElement
}

/** Makes the model for the configuration in the knobs. The replay is collapsed to nothing. */
async function train(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
  await waitFor(() => screen.getByRole('button', { name: 'Train model' }))
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
        loadEntry={entryLoader(unrelatedArtifact())}
        replayMs={0}
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

describe('the year cannot be run from the workshop', () => {
  it('offers nothing that runs the year or brings a crop in, before or after a model is made', async () => {
    renderApple()
    for (const name of [/run a month/i, /run the year/i, /bring .* in/i, /harvest/i]) {
      expect(screen.queryByRole('button', { name }), `the workshop offers ${name}`).toBeNull()
    }

    await train()
    for (const name of [/run a month/i, /run the year/i, /bring .* in/i, /harvest/i]) {
      expect(screen.queryByRole('button', { name }), `the workshop offers ${name}`).toBeNull()
    }
  })

  it('shows no earnings figure and no report of a harvest', async () => {
    renderApple()
    await train()

    expect(screen.queryByText(/Total earnings/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
  })
})

describe('putting a model to work', () => {
  it('offers nothing to put to work until a model has been made', () => {
    renderApple()

    expect(screen.queryByRole('button', { name: 'Put this model to work' })).toBeNull()
  })

  it('offers it once the replay has finished, naming the configuration it made', async () => {
    const onPutToWork = vi.fn()
    render(
      <ConfigureTask
        declaration={apple}
        loadEntry={entryLoader(appleArtifact())}
        replayMs={0}
        onBack={() => {}}
        onPutToWork={onPutToWork}
      />,
    )
    await train()

    await userEvent.click(screen.getByRole('button', { name: 'Put this model to work' }))

    expect(onPutToWork).toHaveBeenCalledOnce()
    expect(onPutToWork.mock.calls[0]?.[0]).toBe('blocks2-channels16-regularization1-dropout0')
  })

  it('withdraws the offer as soon as a knob moves, because that model is no longer made', async () => {
    renderApple()
    await train()
    expect(screen.getByRole('button', { name: 'Put this model to work' })).toBeDefined()

    await userEvent.selectOptions(knobSelect('Convolutional blocks'), '1')

    expect(screen.queryByRole('button', { name: 'Put this model to work' })).toBeNull()
  })

  it('costs nothing and leaves the knobs exactly where they were', async () => {
    renderApple()
    await train()
    const before = screen.getByTestId('current-configuration').textContent

    await userEvent.click(screen.getByRole('button', { name: 'Put this model to work' }))

    expect(screen.getByTestId('current-configuration').textContent).toBe(before)
  })
})

describe('a task already at work', () => {
  function renderAtWork(onHandBack = vi.fn()) {
    render(
      <ConfigureTask
        declaration={apple}
        loadEntry={entryLoader(appleArtifact())}
        replayMs={0}
        onBack={() => {}}
        atWork="blocks3-channels32-regularization1-dropout0"
        onPutToWork={() => {}}
        onHandBack={onHandBack}
      />,
    )
    return onHandBack
  }

  it('says which configuration is at work, whatever the knobs currently say', () => {
    renderAtWork()

    expect(screen.getByTestId('at-work').textContent).toBe(
      'blocks3-channels32-regularization1-dropout0',
    )
    expect(screen.getByTestId('current-configuration').textContent).toBe(
      'blocks2-channels16-regularization1-dropout0',
    )
  })

  it('offers to hand the job back', async () => {
    const onHandBack = renderAtWork()

    await userEvent.click(screen.getByRole('button', { name: 'Hand this job back' }))

    expect(onHandBack).toHaveBeenCalledOnce()
  })

  it('offers nothing to hand back for a task the hands already work', () => {
    renderApple()

    expect(screen.queryByRole('button', { name: 'Hand this job back' })).toBeNull()
    expect(screen.queryByTestId('at-work')).toBeNull()
  })

  it('leaves what is at work alone while a different model is made', async () => {
    renderAtWork()
    await userEvent.selectOptions(knobSelect('Convolutional blocks'), '1')
    await train()

    // Tinkering is a scratchpad; the slot is a commitment. Only putting to work moves it.
    expect(screen.getByTestId('at-work').textContent).toBe(
      'blocks3-channels32-regularization1-dropout0',
    )
  })
})

describe('refusals', () => {
  it('explains an unprecomputed configuration and names it', async () => {
    renderApple()
    await userEvent.selectOptions(knobSelect('Patterns per block'), '2')
    await train()

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('blocks2-channels32-regularization1-dropout0')
    expect(alert.textContent).toContain('trained in advance')
  })

  it('shows the cause the engine named rather than a message of its own', async () => {
    // The screen no longer owns version checking — the artifact index is read when the
    // task loads — so what is tested here is that it prints the cause it was handed.
    render(
      <ConfigureTask
        declaration={apple}
        loadEntry={() =>
          Promise.resolve({
            ok: false,
            issues: [
              {
                code: 'schema-version-mismatch',
                field: 'schemaVersion',
                message:
                  'Declared schema version "1.0.0" does not match prediction artifact version "9.9.9".',
              },
            ],
          })
        }
        replayMs={0}
        onBack={() => {}}
      />,
    )
    await train()

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
        loadEntry={entryLoader(appleArtifact())}
        onBack={onBack}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})

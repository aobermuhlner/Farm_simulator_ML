import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { LoadedTask } from './data/load.js'
import {
  appleArtifact,
  appleDeclaration,
  appleTruth,
  unrelatedArtifact,
  unrelatedDeclaration,
  unrelatedTruth,
} from './test-support/declarations.js'
import { App } from './App.js'

afterEach(cleanup)

const appleTask: LoadedTask = {
  declaration: appleDeclaration(),
  artifact: appleArtifact(),
  truth: appleTruth(),
}

const screeningTask: LoadedTask = {
  declaration: unrelatedDeclaration(),
  artifact: unrelatedArtifact(),
  truth: unrelatedTruth(),
}

function loads(...tasks: readonly LoadedTask[]) {
  return () => Promise.resolve({ ok: true as const, value: tasks })
}

async function openTask(title: string): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: `Open ${title}` }))
}

async function runMonth(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Run a month' }))
}

describe('the four stages of the simulator', () => {
  it('goes from the farm to a report and back', async () => {
    render(<App load={loads(appleTask)} />)

    await openTask('Apple Harvest')
    expect(screen.getByRole('heading', { name: 'Apple Harvest' })).toBeDefined()

    await runMonth()
    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(screen.getByRole('heading', { name: 'The farm' })).toBeDefined()
  })

  it('keeps the task selected while the configuration is revised and re-run', async () => {
    render(<App load={loads(appleTask)} />)
    await openTask('Apple Harvest')
    await runMonth()

    await userEvent.selectOptions(screen.getByLabelText('Convolutional blocks'), '0')
    await runMonth()

    expect(screen.getByRole('heading', { name: 'Apple Harvest' })).toBeDefined()
    expect(
      within(screen.getByRole('region', { name: 'Run report' })).getByText(
        /blocks2-channels16-regularization1-dropout0/,
      ),
    ).toBeDefined()
  })

  it('shows a load refusal instead of an empty farm', async () => {
    render(
      <App
        load={() =>
          Promise.resolve({
            ok: false as const,
            issues: [{ code: 'data-unreachable', message: 'Could not fetch the declaration.' }],
          })
        }
      />,
    )

    expect((await screen.findByRole('alert')).textContent).toContain('Could not fetch')
    expect(screen.queryByRole('heading', { name: 'The farm' })).toBeNull()
  })
})

describe('a task the screens have never seen', () => {
  it('plays through the same screens with no code of its own', async () => {
    render(<App load={loads(screeningTask)} />)

    await openTask('Skin Screening')
    expect(screen.getByLabelText('Sensitivity')).toBeDefined()

    await runMonth()

    const report = screen.getByRole('region', { name: 'Run report' })
    expect(within(report).getByRole('rowheader', { name: 'Healthy patch' })).toBeDefined()
    expect(within(report).getByRole('rowheader', { name: 'Diseased patch' })).toBeDefined()
    expect(within(report).getByRole('columnheader', { name: 'Flag for the vet' })).toBeDefined()
    expect(within(report).getByRole('columnheader', { name: 'Pass it' })).toBeDefined()
  })

  it('brings no apple vocabulary with it', async () => {
    render(<App load={loads(screeningTask)} />)
    await openTask('Skin Screening')
    await runMonth()

    for (const word of ['apple', 'Apple', 'wormy', 'ripe', 'harvest robot']) {
      expect(screen.queryByText(new RegExp(word)), `"${word}" leaked into the screens`).toBeNull()
    }
  })
})

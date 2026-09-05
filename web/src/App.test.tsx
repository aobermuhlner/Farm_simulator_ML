import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { LoadedTask } from './data/load.js'
import {
  appleArtifact,
  unrelatedArtifact,
  unrelatedDeclaration,
  unrelatedTruth,
} from './test-support/declarations.js'
import { loadsFarm } from './test-support/farm.js'
import { loadsCatalog, memoryStorage, savesTo } from './test-support/progression.js'
import { appleTask as committedAppleTask, loadEntryFor, taskFrom } from './test-support/pool.js'
import { App } from './App.js'

afterEach(cleanup)

const appleTask: LoadedTask = committedAppleTask()

const screeningTask: LoadedTask = taskFrom(
  unrelatedDeclaration(),
  unrelatedArtifact(),
  unrelatedTruth(),
)

function loads(...tasks: readonly LoadedTask[]) {
  return () => Promise.resolve({ ok: true as const, value: tasks })
}

/**
 * Every render below goes through the shell with its entry loader injected, and with
 * the training replay collapsed to nothing — these tests are about the stages, not the
 * pacing, and `TrainingRun`'s own suite owns the animation.
 */
function renderApp(...tasks: readonly LoadedTask[]) {
  return render(
    <App
      load={loads(...tasks)}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm()}
      loadShop={loadsCatalog()}
      {...savesTo(memoryStorage())}
      replayMs={0}
    />,
  )
}

async function openTask(title: string): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: `Open ${title}` }))
}

/** Trains the model in the knobs, then runs the month over it. */
async function runMonth(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Run a month' }))
}

describe('the four stages of the simulator', () => {
  it('goes from the farm to a report and back', async () => {
    renderApp(appleTask)

    await openTask('Apple Harvest')
    expect(screen.getByRole('heading', { name: 'Apple Harvest' })).toBeDefined()

    await runMonth()
    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(screen.getByRole('heading', { name: 'The farm' })).toBeDefined()
  })

  it('keeps the task selected while the configuration is revised and re-run', async () => {
    renderApp(appleTask)
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
        loadFarm={loadsFarm()}
      />,
    )

    expect((await screen.findByRole('alert')).textContent).toContain('Could not fetch')
    expect(screen.queryByRole('heading', { name: 'The farm' })).toBeNull()
  })
})

describe('a task the screens have never seen', () => {
  it('plays through the same screens with no code of its own', async () => {
    renderApp(screeningTask)

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
    renderApp(screeningTask)
    await openTask('Skin Screening')
    await runMonth()

    for (const word of ['apple', 'Apple', 'wormy', 'ripe', 'harvest robot']) {
      expect(screen.queryByText(new RegExp(word)), `"${word}" leaked into the screens`).toBeNull()
    }
  })
})

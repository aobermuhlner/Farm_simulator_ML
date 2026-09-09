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
import { farmCarrying, loadsFarm } from './test-support/farm.js'
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
/** A farm that declares a crop for the card the screens have never seen. */
const bothCards = farmCarrying([screeningTask.declaration])

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
      loadFarm={loadsFarm(bothCards)}
      loadShop={loadsCatalog()}
      {...savesTo(memoryStorage())}
      replayMs={0}
    />,
  )
}

async function openTask(title: string): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: `Open ${title}` }))
}

/** Makes the model in the knobs and puts it to work for this task. */
async function putToWork(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))
}

/** Runs the year for the whole farm from the overview, and confirms it. */
async function runYear(year: number): Promise<void> {
  const name = `Run year ${String(year)}`
  await userEvent.click(await screen.findByRole('button', { name }))
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Run the year' })).getByRole('button', { name }),
  )
}

/**
 * The whole loop: a model made in the workshop, put to work, and the year run over it.
 *
 * Four acts rather than two presses, because they are four different commitments. The
 * workshop is free and repeatable; the year is the farm's and is run once.
 */
async function playYear(title: string, year = 1): Promise<void> {
  await openTask(title)
  await putToWork()
  await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
  await runYear(year)
}

/** Opens one card's report of the year that closed. */
async function openReport(title: string, year: number): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: `See year ${String(year)} for ${title}` }),
  )
}

describe('the year loop', () => {
  it('goes from the farm through the workshop to a closed year’s report and back', async () => {
    renderApp(appleTask)

    await openTask('Apple Harvest')
    expect(screen.getByRole('heading', { name: 'Apple Harvest' })).toBeDefined()

    await putToWork()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(screen.getByRole('heading', { name: 'The farm' })).toBeDefined()

    await runYear(1)
    await openReport('Apple Harvest', 1)
    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(screen.getByRole('heading', { name: 'The farm' })).toBeDefined()
  })

  it('keeps the task selected while the configuration is revised and a model made again', async () => {
    renderApp(appleTask)
    await openTask('Apple Harvest')
    await putToWork()

    await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), '0')
    await putToWork()

    expect(screen.getByRole('heading', { name: 'Apple Harvest' })).toBeDefined()
    expect(screen.getByTestId('at-work').textContent).toBe(
      'blocks2-channels8-regularization1-dropout0-datasetstarter',
    )
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
        loadFarm={loadsFarm(bothCards)}
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

    await putToWork()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    await runYear(1)
    await openReport('Skin Screening', 1)

    const report = screen.getByRole('region', { name: 'Run report' })
    expect(within(report).getByRole('rowheader', { name: 'Healthy patch' })).toBeDefined()
    expect(within(report).getByRole('rowheader', { name: 'Diseased patch' })).toBeDefined()
    expect(within(report).getByRole('columnheader', { name: 'Flag for the vet' })).toBeDefined()
    expect(within(report).getByRole('columnheader', { name: 'Pass it' })).toBeDefined()
  })

  it('brings no apple vocabulary with it', async () => {
    renderApp(screeningTask)
    await playYear('Skin Screening')
    await openReport('Skin Screening', 1)

    for (const word of ['apple', 'Apple', 'wormy', 'ripe', 'harvest robot']) {
      expect(screen.queryByText(new RegExp(word)), `"${word}" leaked into the screens`).toBeNull()
    }
  })
})

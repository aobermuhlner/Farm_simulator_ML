/**
 * The workshop through the whole shell: what putting a model to work changes, and what
 * it must not.
 *
 * Both claims need the shell rather than the screen. That a slot survives a reload is a
 * fact about the save, which the workshop cannot see; that no stage of the workshop moves
 * money is a fact about the balance, the year and the ledger, which live above it.
 * Hypotheses have to be cheap or they will not be formed — a workshop that charged for a
 * model would teach a student to guess once rather than to look.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { formatUnits, openFarm } from '../../src/economy/index.js'
import type { SavedFarm } from '../../src/save/index.js'
import { firstFamily } from '../../src/task/families.js'
import { App } from './App.js'
import { SAVE_KEY, type SaveStorage } from './data/save.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import { appleTask as committedAppleTask, loadEntryFor } from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo } from './test-support/progression.js'

afterEach(cleanup)

const appleTask = committedAppleTask()
const declaration = farmDeclaration()
const opened = openFarm(declaration)

const OPENING_BALANCE = formatUnits(opened.balance, declaration)
const OPENING_YEAR = String(declaration.openingYear)
/** The family the shipped apple task opens at, and the one every slot below names. */
const FAMILY = firstFamily(appleTask.declaration).id

const DEFAULT_CONFIGURATION = 'blocks2-channels16-regularization1-dropout0'

function renderApp(storage: SaveStorage = memoryStorage()): SaveStorage {
  render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm()}
      loadShop={loadsCatalog()}
      {...savesTo(storage)}
      replayMs={0}
    />,
  )
  return storage
}

function saved(storage: SaveStorage): SavedFarm {
  const text = storage.getItem(SAVE_KEY)
  if (text === null) throw new Error('nothing was saved')
  return JSON.parse(text) as SavedFarm
}

function shown(label: string): string {
  return screen.getByRole('definition', { name: label }).textContent ?? ''
}

async function openWorkshop(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
  )
}

async function makeModel(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
  await screen.findByRole('button', { name: 'Put this model to work' })
}

async function putToWork(): Promise<void> {
  await makeModel()
  await userEvent.click(screen.getByRole('button', { name: 'Put this model to work' }))
}

describe('a model put to work stays at work', () => {
  it('writes the slot, and it is still at work when the farm is opened again', async () => {
    const storage = renderApp()
    await openWorkshop()
    await putToWork()

    expect(saved(storage).slots).toEqual({
      [appleTask.declaration.id]: { configuration: DEFAULT_CONFIGURATION, family: FAMILY },
    })

    // Opened again from the same storage: the shell is remounted from nothing but the save.
    cleanup()
    renderApp(storage)
    await openWorkshop()

    expect(screen.getByTestId('at-work').textContent).toBe(DEFAULT_CONFIGURATION)
  })

  it('hands the job back to the farm’s own labour without touching the money', async () => {
    const storage = renderApp()
    await openWorkshop()
    await putToWork()

    await userEvent.click(screen.getByRole('button', { name: 'Hand this job back' }))

    expect(screen.queryByTestId('at-work')).toBeNull()
    expect(saved(storage).slots).toEqual({})
    expect(shown('Balance')).toBe(OPENING_BALANCE)
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(saved(storage).ledger).toEqual([])
  })

  it('leaves the slot as it was while a different model is made and not put to work', async () => {
    const storage = renderApp()
    await openWorkshop()
    await putToWork()

    await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), '0')
    await makeModel()

    // Tinkering is a scratchpad; the slot is a commitment the year reads.
    expect(screen.getByTestId('at-work').textContent).toBe(DEFAULT_CONFIGURATION)
    expect(saved(storage).slots).toEqual({
      [appleTask.declaration.id]: { configuration: DEFAULT_CONFIGURATION, family: FAMILY },
    })
  })
})

describe('the workshop is entered and left as often as a student likes', () => {
  it('holds the knob values it was left at, and the model made for them is made again', async () => {
    renderApp()
    await openWorkshop()
    await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), '0')
    expect(screen.getByTestId('current-configuration').textContent).toBe(
      'blocks2-channels8-regularization1-dropout0',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    await openWorkshop()

    expect(screen.getByTestId('current-configuration').textContent).toBe(
      'blocks2-channels8-regularization1-dropout0',
    )
    // And every stage of it is reachable again with no crop having been brought in.
    await makeModel()
    expect(shown('Year')).toBe(OPENING_YEAR)
  })
})

describe('the workshop moves no money', () => {
  it('leaves the balance, the year and the ledger where they were, whatever is done in it', async () => {
    const storage = renderApp()
    await openWorkshop()

    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await userEvent.click(await screen.findByRole('button', { name: /back/i }))

    await makeModel()
    await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), '0')
    await makeModel()
    await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), '2')
    await putToWork()
    await userEvent.click(screen.getByRole('button', { name: 'Hand this job back' }))

    expect(shown('Balance')).toBe(OPENING_BALANCE)
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(saved(storage).ledger).toEqual([])
    expect(saved(storage).movements).toEqual([])
    expect(saved(storage).balance).toBe(declaration.openingBalance)
    expect(saved(storage).year).toBe(declaration.openingYear)
  })
})

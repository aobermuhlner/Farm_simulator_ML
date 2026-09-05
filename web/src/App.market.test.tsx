/**
 * The market as a stage of the farm.
 *
 * Reached from the overview without a task being selected, left back to it, and the
 * balance readable from it the way it is from every other screen. The catalog is loaded
 * the way the tasks and the farm are — a refusal reaches the student as its cause, and no
 * market is shown behind it.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatUnits, toUnits } from '../../src/economy/index.js'
import { App } from './App.js'
import { SHIPPED_CATALOG, SHIPPED_FARM } from './data/paths.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import { appleTask as committedAppleTask, loadEntryFor } from './test-support/pool.js'
import {
  loadsCatalog,
  memoryStorage,
  refusesCatalog,
  savesTo,
  shopCatalog,
} from './test-support/progression.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const appleTask = committedAppleTask()
const declaration = farmDeclaration()
const catalog = shopCatalog()

function renderApp() {
  return render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm()}
      loadShop={loadsCatalog(catalog)}
      {...savesTo(memoryStorage())}
      replayMs={0}
    />,
  )
}

function shown(label: string): string {
  return screen.getByRole('definition', { name: label }).textContent ?? ''
}

describe('the market is reached from the overview and left again', () => {
  it('opens with no task selected and returns to the overview', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    expect(screen.getByRole('heading', { name: 'The market' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: appleTask.declaration.title })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Train model' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(screen.getByRole('heading', { name: 'The farm' })).toBeDefined()
  })

  it('keeps the balance readable from the market', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    expect(shown('Balance')).toBe(
      formatUnits(toUnits(declaration.openingBalance, declaration.precision), declaration),
    )
    expect(shown('Farm')).toBe(declaration.name)
  })
})

describe('a purchase is reflected without leaving the market', () => {
  it('falls the balance by the price and shows the item as owned, in place', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))
    await userEvent.click(screen.getByRole('button', { name: 'Buy Second row' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(screen.getByRole('heading', { name: 'The market' })).toBeDefined()
    expect(screen.getByTestId('state-second-row').textContent).toBe('Owned')
    expect(shown('Balance')).toBe(
      formatUnits(toUnits(declaration.openingBalance - 10, declaration.precision), declaration),
    )
    expect(screen.queryByRole('button', { name: 'Buy Second row' })).toBeNull()
  })

  it('leaves every other item where it was', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))
    const before = screen.getByTestId('state-stone-shed').textContent

    await userEvent.click(screen.getByRole('button', { name: 'Buy Second row' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(screen.getByTestId('state-stone-shed').textContent).toBe(before)
    expect(screen.getByTestId('state-weather-station').textContent).toBe(
      'Nobody in the valley builds these yet.',
    )
  })

  it('opens what it declares on the configuration screen and nothing else', async () => {
    // The shop catalog opens knobs of tasks this build does not ship, so the apple task's
    // knobs are all unmentioned — and therefore all open, before and after a purchase.
    renderApp()
    await userEvent.click(
      await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
    )
    const before = screen.getAllByRole('option').map((option) => option.textContent)

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Go to the market' }))
    await userEvent.click(screen.getByRole('button', { name: 'Buy Second row' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    await userEvent.click(
      screen.getByRole('button', { name: `Open ${appleTask.declaration.title}` }),
    )

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(before)
  })
})

describe('a catalog that cannot be loaded has no market', () => {
  it('shows the cause when the file is unreachable', async () => {
    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
        loadEntry={loadEntryFor}
        loadFarm={loadsFarm()}
        loadShop={refusesCatalog('Could not fetch "data/declarations/catalog.json": 404.')}
        {...savesTo(memoryStorage())}
        replayMs={0}
      />,
    )

    expect(await screen.findByText(/Could not fetch/)).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'The market' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Go to the market' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Farm status' })).toBeNull()
  })

  it('shows the cause when the validator refuses what was fetched', async () => {
    // Through the real loader, so the refusal is the validator's own rather than a
    // stand-in's: an item in a group the catalog never declared.
    vi.stubGlobal('fetch', (input: string) => {
      const url = String(input)
      if (url.endsWith(SHIPPED_FARM)) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(declaration) } as Response)
      }
      if (url.endsWith(SHIPPED_CATALOG)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              schemaVersion: '1.0.0',
              groups: [{ id: 'models', label: 'Models' }],
              ownedAtStart: [],
              items: [
                {
                  id: 'ghost',
                  group: 'nowhere',
                  label: 'Ghost',
                  copy: 'It is in a group that does not exist.',
                  price: 1,
                  opens: [
                    { kind: 'knob-values', task: appleTask.declaration.id, knob: 'channels', values: [8] },
                  ],
                },
              ],
            }),
        } as Response)
      }
      return Promise.resolve({ ok: false, status: 404 } as Response)
    })

    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
        loadEntry={loadEntryFor}
        {...savesTo(memoryStorage())}
        replayMs={0}
      />,
    )

    expect(await screen.findByText(/which the catalog does not declare/)).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'The market' })).toBeNull()
  })
})

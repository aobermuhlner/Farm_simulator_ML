/**
 * The market as a stage of the farm.
 *
 * Reached from the overview without a task being selected, left back to it, and the
 * balance readable from it the way it is from every other screen. The catalog is loaded
 * the way the tasks and the farm are — a refusal reaches the student as its cause, and no
 * market is shown behind it.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatUnits, toUnits } from '../../src/economy/index.js'
import { App } from './App.js'
import { SHIPPED_CATALOG, SHIPPED_FARM } from './data/paths.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import type { Catalog } from '../../src/progression/index.js'
import {
  unrelatedArtifact,
  unrelatedDeclaration,
  unrelatedTruth,
} from './test-support/declarations.js'
import { appleTask as committedAppleTask, loadEntryFor, taskFrom } from './test-support/pool.js'
import {
  loadsCatalog,
  memoryStorage,
  refusesCatalog,
  savesTo,
  shopCatalog,
  soundCatalog,
} from './test-support/progression.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const appleTask = committedAppleTask()

/**
 * The shipped farm with a purse, because these are tests about the market.
 *
 * The farm ships broke — every capability on it is bought with apples the student sorted
 * — and a farm that can afford nothing offers no purchase to click. What is being held
 * here is what the market does when one is made, so the money is put there rather than
 * earned, and every figure below is read against this declaration's own opening.
 */
const declaration = { ...farmDeclaration(), openingBalance: 2000 }
const catalog = shopCatalog()

function renderApp() {
  return render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm(declaration)}
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
              groups: [{ id: 'models', label: 'Models', soldAt: 'market' }],
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

describe('the market is sectioned by the part of the farm a shelf belongs to', () => {
  const other = taskFrom(unrelatedDeclaration(), unrelatedArtifact(), unrelatedTruth())

  /**
   * A catalog with a shelf for each task and one for the farm.
   *
   * Its second task is one the shell has never presented, and its heading is that
   * task's own declared title — so the section appears with no screen code added for
   * it, which is the whole reason the heading is not written anywhere.
   */
  function sectioned(): Catalog {
    return soundCatalog(
      {
        schemaVersion: '1.0.0',
        groups: [
          { id: 'orchard', label: 'Orchard', task: appleTask.declaration.id, soldAt: 'market' },
          { id: 'clinic', label: 'Clinic', task: other.declaration.id, soldAt: 'market' },
          { id: 'yard', label: 'Yard', soldAt: 'market' },
          { id: 'capacity', label: 'Capacity', soldAt: 'bench' },
        ],
        ownedAtStart: [],
        items: [
          {
            id: 'more-trees',
            group: 'orchard',
            label: 'More trees',
            copy: 'A hundred more to bring in.',
            price: 10,
            opens: [{ kind: 'farm-land', units: 100 }],
          },
          {
            id: 'a-second-camera',
            group: 'clinic',
            label: 'A second camera',
            copy: 'One more lens for the other field.',
            price: 20,
            opens: [
              {
                kind: 'knob-values',
                task: other.declaration.id,
                knob: 'sensitivity',
                values: ['high'],
              },
            ],
          },
          {
            id: 'a-shed',
            group: 'yard',
            label: 'A shed',
            copy: 'Somewhere dry for the crates.',
            price: 30,
            opens: [{ kind: 'farm-land', units: 1 }],
          },
          {
            id: 'one-more-layer',
            group: 'capacity',
            label: 'One more layer',
            copy: 'Room for a second layer.',
            price: 40,
            opens: [
              { kind: 'knob-values', task: appleTask.declaration.id, knob: 'blocks', values: [3] },
            ],
          },
        ],
      },
      declaration,
    )
  }

  function renderBoth() {
    return render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [appleTask, other] })}
        loadEntry={loadEntryFor}
        loadFarm={loadsFarm()}
        loadShop={loadsCatalog(sectioned())}
        {...savesTo(memoryStorage())}
        replayMs={0}
      />,
    )
  }

  it('heads each part of the farm with that task’s own declared title', async () => {
    renderBoth()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      appleTask.declaration.title,
      other.declaration.title,
      declaration.name,
    ])
  })

  it('shows a second task’s shelf with no screen change, under its own heading', async () => {
    renderBoth()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    const section = within(screen.getByRole('region', { name: other.declaration.title }))
    expect(section.getByRole('heading', { name: 'Clinic' })).toBeDefined()
    expect(section.getByText('A second camera')).toBeDefined()
    expect(section.queryByText('More trees')).toBeNull()
  })

  it('puts a shelf belonging to no task under the farm, after the parts', async () => {
    renderBoth()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    const section = within(screen.getByRole('region', { name: declaration.name }))
    expect(section.getByText('A shed')).toBeDefined()
  })

  it('shows nothing sold at the workshop’s bench', async () => {
    renderBoth()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    expect(screen.queryByText('One more layer')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Capacity' })).toBeNull()
  })
})

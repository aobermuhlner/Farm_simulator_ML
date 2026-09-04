/**
 * The farm's money and its year, through the whole shell.
 *
 * Two things are checked here that a component test cannot reach. One is that the bar is
 * above the stage switch rather than inside a screen, so it is readable on the overview,
 * the configuration, the run and the report without navigating. The other is that
 * nothing in the app moves money yet: the seam `harvest-scoring` will attach to is
 * shipped unattached on purpose, and a run that quietly paid out would be the slot
 * machine the workshop/harvest split exists to kill.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Farm } from '../../src/economy/index.js'
import { credit, formatUnits, openFarm, toUnits } from '../../src/economy/index.js'
import { App } from './App.js'
import { FarmBar } from './components/FarmBar.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import { appleTask as committedAppleTask, loadEntryFor } from './test-support/pool.js'

afterEach(cleanup)

const appleTask = committedAppleTask()
const declaration = farmDeclaration()
const opened = openFarm(declaration)

/** The declared opening balance as the bar presents it. */
const OPENING_BALANCE = formatUnits(opened.balance, declaration)
const OPENING_YEAR = String(declaration.openingYear)

function renderApp(loadFarm = loadsFarm()) {
  return render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadFarm}
      replayMs={0}
    />,
  )
}

function shown(label: string): string {
  return screen.getByRole('definition', { name: label }).textContent ?? ''
}

async function openTask(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
  )
}

async function runMonth(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Run a month' }))
}

describe('the farm opens at its declared state', () => {
  it('shows the declared name, year and balance from the declaration', async () => {
    renderApp()
    await screen.findByRole('region', { name: 'Farm status' })

    expect(shown('Farm')).toBe(declaration.name)
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)
  })

  it('opens with an empty ledger, so no year has closed yet', async () => {
    renderApp()
    await screen.findByRole('region', { name: 'Farm status' })

    expect(opened.ledger).toEqual([])
    expect(shown('Year')).toBe(OPENING_YEAR)
  })
})

describe('a farm that cannot be opened', () => {
  it('shows the cause reported and no bar, year or balance', async () => {
    renderApp(() =>
      Promise.resolve({
        ok: false as const,
        issues: [
          {
            code: 'missing-field',
            field: 'currency',
            message: 'Farm declaration is missing required field "currency".',
          },
        ],
      }),
    )

    expect((await screen.findByRole('alert')).textContent).toContain('"currency"')
    expect(screen.queryByRole('region', { name: 'Farm status' })).toBeNull()
    expect(screen.queryByRole('definition', { name: 'Year' })).toBeNull()
    expect(screen.queryByRole('definition', { name: 'Balance' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'The farm' })).toBeNull()
  })
})

describe('a farm declaring something else', () => {
  it('shows a different name and a different currency with no screen changes', async () => {
    const other = {
      name: 'Another Holding',
      currency: 'coins',
      precision: 0,
      openingBalance: 40,
      openingYear: 11,
    }
    renderApp(loadsFarm(other))
    await screen.findByRole('region', { name: 'Farm status' })

    expect(shown('Farm')).toBe('Another Holding')
    expect(shown('Year')).toBe('11')
    expect(shown('Balance')).toBe('coins 40')
    expect(shown('Balance')).not.toContain(declaration.currency)
  })
})

describe('a zero balance is not an ending', () => {
  it('opens the farm, shows zero, and still lets the student work', async () => {
    renderApp(loadsFarm({ ...declaration, openingBalance: 0 }))
    await screen.findByRole('region', { name: 'Farm status' })

    expect(shown('Balance')).toBe(formatUnits(0, declaration))
    for (const ending of [/game over/i, /bankrupt/i, /you (have )?lost/i, /the end/i, /ruined/i]) {
      expect(screen.queryByText(ending), `the farm is presented as ${ending}`).toBeNull()
    }

    await openTask()
    await runMonth()
    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()
    expect(shown('Balance')).toBe(formatUnits(0, declaration))
  })
})

describe('the bar is on every stage', () => {
  it('is readable from the overview through a run to a report', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'The farm' })
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)

    await openTask()
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)

    await userEvent.click(await screen.findByRole('button', { name: 'Run a month' }))
    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)
  })

  it('shows the same four stages a student saw before it existed', async () => {
    renderApp()

    await openTask()
    expect(screen.getByRole('heading', { name: appleTask.declaration.title })).toBeDefined()
    await runMonth()
    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(screen.getByRole('heading', { name: 'The farm' })).toBeDefined()
  })
})

/**
 * A stage with the bar above it, holding the farm the way `App` does.
 *
 * The bar following the money is a property of where the state lives, not of a control
 * on any screen — and nothing in the app moves money in this change, which is what the
 * seam test below asserts. So the movement is made here, in the shape the first paying
 * caller will make it: the economy module returns a new farm value and the holder
 * re-renders with it.
 */
function Stage() {
  const [farm, setFarm] = useState<Farm>(() => openFarm(declaration))
  return (
    <main>
      <FarmBar farm={farm} />
      <section aria-labelledby="stage-heading">
        <h1 id="stage-heading">A stage</h1>
        <button
          type="button"
          onClick={() => setFarm(credit(farm, toUnits(125.5, declaration.precision), 'a windfall'))}
        >
          Move the money
        </button>
      </section>
    </main>
  )
}

describe('the bar follows the money', () => {
  it('shows the new figure without the student navigating', async () => {
    render(<Stage />)
    const stage = screen.getByRole('heading', { name: 'A stage' })

    expect(shown('Balance')).toBe(OPENING_BALANCE)
    await userEvent.click(screen.getByRole('button', { name: 'Move the money' }))

    const moved = credit(opened, toUnits(125.5, declaration.precision), 'a windfall')
    expect(shown('Balance')).toBe(formatUnits(moved.balance, declaration))
    expect(shown('Balance')).not.toBe(OPENING_BALANCE)
    // Same screen throughout: nothing remounted and nothing was navigated to.
    expect(screen.getByRole('heading', { name: 'A stage' })).toBe(stage)
  })
})

describe('nothing claims to save the farm', () => {
  it('offers no save, load, restore or reset on any stage', async () => {
    renderApp()
    await screen.findByRole('region', { name: 'Farm status' })

    const checkStage = () => {
      for (const word of [/save/i, /^load$/i, /restore/i, /reset/i]) {
        expect(screen.queryByRole('button', { name: word }), `a control offers ${word}`).toBeNull()
      }
      for (const claim of [
        /progress is (kept|saved)/i,
        /saved automatically/i,
        /your farm is saved/i,
        /pick up where you left off/i,
      ]) {
        expect(screen.queryByText(claim), `copy claims ${claim}`).toBeNull()
      }
    }

    checkStage()
    await openTask()
    checkStage()
    await runMonth()
    checkStage()
  })
})

describe('the seam stays unattached', () => {
  it('moves no money and closes no year when a task is run to a report', async () => {
    renderApp()
    await openTask()
    await runMonth()

    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)
  })

  it('leaves the year and the balance where they were after two runs', async () => {
    renderApp()
    await openTask()
    await runMonth()
    await userEvent.selectOptions(screen.getByLabelText('Convolutional blocks'), '0')
    await runMonth()

    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)
  })
})

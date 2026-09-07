/**
 * The farm's money and its year, through the whole shell.
 *
 * Two things are checked here that a component test cannot reach. One is that the bar is
 * above the stage switch rather than inside a screen, so it is readable on the overview,
 * the workshop, the market, the labour and a report without navigating. The other is
 * where money moves: only closing a year moves it, and it moves once. The workshop is
 * free however much is done in it — `App.workshop.test.tsx` holds that half.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Farm } from '../../src/economy/index.js'
import { credit, formatUnits, openFarm, toUnits } from '../../src/economy/index.js'
import { App } from './App.js'
import { FarmBar } from './components/FarmBar.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import { loadsCatalog, memoryStorage, savesTo, soundCatalog } from './test-support/progression.js'
import { declaredValues } from '../../src/progression/index.js'
import { STORAGE_UNAVAILABLE } from './data/save.js'

/** What the storage edge reports when the browser will not keep anything. */
const refusedStorage = {
  code: STORAGE_UNAVAILABLE,
  message: 'This browser would not keep this change, so progress is not being kept this session.',
}
import { appleTask as committedAppleTask, loadEntryFor } from './test-support/pool.js'

afterEach(cleanup)

const appleTask = committedAppleTask()
const declaration = farmDeclaration()
const opened = openFarm(declaration)

/** The declared opening balance as the bar presents it. */
const OPENING_BALANCE = formatUnits(opened.balance, declaration)
const OPENING_YEAR = String(declaration.openingYear)

function renderApp(loadFarm = loadsFarm(), loadShop = loadsCatalog()) {
  return render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadFarm}
      loadShop={loadShop}
      {...savesTo(memoryStorage())}
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

/** Makes a model and puts it to work for the open task. */
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

/** The workshop, a model at work, and the year run over it. */
async function playYear(year: number): Promise<void> {
  await openTask()
  await putToWork()
  await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
  await runYear(year)
}

async function openReport(year: number): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', {
      name: `See year ${String(year)} for ${appleTask.declaration.title}`,
    }),
  )
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
      openingCrop: 6,
      cropComposition: { sound: 0.75, spoiled: 0.25 },
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

    await playYear(declaration.openingYear)
    await openReport(declaration.openingYear)
    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()
    // A year has closed, so the balance has moved — from zero, without an ending.
    expect(screen.queryByText(/game over/i)).toBeNull()
  })
})

describe('the bar is on every stage', () => {
  it('is readable on the overview and the workshop while nothing has moved', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'The farm' })
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)

    await openTask()
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await screen.findByRole('button', { name: 'Put this model to work' })
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)
  })

  it('is readable on the market and on a closed year’s report', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'The farm' })

    await userEvent.click(screen.getByRole('button', { name: 'Go to the market' }))
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))

    await playYear(declaration.openingYear)
    const closed = String(declaration.openingYear + 1)
    expect(shown('Year')).toBe(closed)

    await openReport(declaration.openingYear)
    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()
    expect(shown('Year')).toBe(closed)
    expect(screen.getByRole('definition', { name: 'Balance' })).toBeDefined()
  })

  it('walks the stages a student walks: overview, workshop, overview, report', async () => {
    renderApp()

    await openTask()
    expect(screen.getByRole('heading', { name: appleTask.declaration.title })).toBeDefined()
    await putToWork()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    await runYear(declaration.openingYear)
    await openReport(declaration.openingYear)
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

describe('the farm says what it does about progress', () => {
  it('claims nothing about saving while storage will not have it', async () => {
    // `game-economy`'s "the farm's state is not presented as saved" was removed by
    // `progression-catalog`, which specifies persistence — but the honesty rule survives
    // for the one case where the claim would be false.
    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
        loadEntry={loadEntryFor}
        loadFarm={loadsFarm()}
        loadShop={loadsCatalog()}
        readSave={() => ({ ok: false as const, issue: refusedStorage })}
        writeSave={() => ({ ok: false as const, issue: refusedStorage })}
        clearSave={() => ({ ok: false as const, issue: refusedStorage })}
        replayMs={0}
      />,
    )

    expect(await screen.findByText(/progress is not being kept/i)).toBeDefined()
    for (const claim of [/progress is (kept|saved)$/i, /saved automatically/i]) {
      expect(screen.queryByText(claim), `copy claims ${claim}`).toBeNull()
    }

    // Playable all the same: storage refusing blocks nothing.
    await playYear(declaration.openingYear)
    await openReport(declaration.openingYear)
    expect(await screen.findByRole('region', { name: 'Run report' })).toBeDefined()
  })

  it('offers to start again, and says what that discards', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Start a new farm' }))

    expect(screen.getByText(/discards this one/i).textContent).toMatch(/money/i)
    expect(screen.getByText(/discards this one/i).textContent).toMatch(/bought/i)
    expect(screen.getByText(/discards this one/i).textContent).toMatch(/year/i)
  })
})

describe('only closing a year moves money', () => {
  it('leaves the year and the balance where they were until the year is run', async () => {
    renderApp()
    await openTask()
    await putToWork()
    await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), '0')
    await putToWork()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)
  })

  it('advances the year exactly once when it is run, and offers the following year next', async () => {
    renderApp()
    await playYear(declaration.openingYear)

    expect(shown('Year')).toBe(String(declaration.openingYear + 1))
    expect(shown('Balance')).not.toBe(OPENING_BALANCE)
    expect(
      screen.getByRole('button', { name: `Run year ${String(declaration.openingYear + 1)}` }),
    ).toBeDefined()
    expect(
      screen.queryByRole('button', { name: `Run year ${String(declaration.openingYear)}` }),
    ).toBeNull()
  })
})

/**
 * Owning the means to automate a card is not the same as putting a model on it.
 *
 * This is the defect the workshop/harvest split was written to fix: a card was worked by
 * a robot because the farm *could* work it that way, so a student who had bought their way
 * to a bigger model found the orchard already running one they never chose. The labour
 * follows only from what was put to work, and a farm that has put nothing to work sorts
 * by hand however much it owns.
 */
describe('what the farm owns does not decide who works', () => {
  /** A catalog whose every row opens one knob outright, and which the farm owns already. */
  function ownsEverything() {
    const items = appleTask.declaration.knobs.map((knob) => ({
      id: `opens-${knob.id}`,
      group: 'toolshed',
      label: `Everything ${knob.id} offers`,
      copy: 'Opens every value this knob declares.',
      price: 1,
      opens: [
        {
          kind: 'knob-values',
          task: appleTask.declaration.id,
          knob: knob.id,
          values: [...declaredValues(knob)],
        },
      ],
    }))
    return loadsCatalog(
      soundCatalog({
        schemaVersion: '1.0.0',
        groups: [{ id: 'toolshed', label: 'Toolshed' }],
        ownedAtStart: items.map((item) => item.id),
        items,
      }),
    )
  }

  it('leaves the card sorted by hand when nothing has been put to work', async () => {
    renderApp(loadsFarm(), ownsEverything())
    await screen.findByRole('heading', { name: 'The farm' })

    const slot = document.querySelector(`[data-slot="${appleTask.declaration.id}"]`)
    expect(slot?.textContent).toContain(declaration.manualLabour?.label ?? '')
    expect(slot?.textContent).not.toMatch(/blocks\d/)
  })

  it('sends the student to do the work when the year is run, rather than a model of its own', async () => {
    renderApp(loadsFarm(), ownsEverything())
    await runYear(declaration.openingYear)

    // The card is outstanding and offered to the student: nothing was brought in for them,
    // and the year has not moved.
    expect(await screen.findByRole('button', { name: /by hand/ })).toBeDefined()
    expect(screen.getByRole('status').textContent).toContain(appleTask.declaration.title)
    expect(shown('Year')).toBe(OPENING_YEAR)
    expect(shown('Balance')).toBe(OPENING_BALANCE)
  })
})

/**
 * Hand sorting through the whole shell: when it is offered, and what finishing one costs
 * and pays.
 *
 * Everything here needs the shell rather than the screen. Whether the labour is offered at
 * all is a fact about what is *working* each card; that a completed sort closes the year
 * and appends one record is the economy's *recording a harvest* step, and hand sorting is
 * the first thing in the game to use it. Both are invisible from inside the screen that
 * collects the decisions.
 *
 * The labour is reached by running the year from the overview, which is where the whole
 * farm's crop is brought in. On a one-card farm the year in progress lasts exactly as long
 * as the sort, which is the correct amount of ceremony for a farm with one card.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { firstFamily } from '../../src/task/families.js'
import type { FarmDeclaration } from '../../src/economy/index.js'
import { formatUnits, toUnits } from '../../src/economy/index.js'
import { measureSort } from '../../src/sorting/index.js'
import type { SavedFarm } from '../../src/save/index.js'
import { App } from './App.js'
import type { SaveStorage } from './data/save.js'
import { SAVE_KEY } from './data/save.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import { appleCrop, appleManifest, appleTask, farmSorting, loadEntryFor } from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo, soundCatalog } from './test-support/progression.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const task = appleTask()
const declaration = task.declaration
const shipped = farmDeclaration()
const manifest = appleManifest()
const SEED = 4242

/**
 * How long a test that sorts a whole harvest may take.
 *
 * One of these is sixty simulated clicks through the real shell, which outruns the default
 * five seconds whenever the suite is busy. Nothing about the app is slow; the test is
 * genuinely doing sixty of everything, because that is what one person is presented with.
 */
const SORTING_TIME = 60_000

const SORT_BUTTON = 'Sort this year’s crop by hand'

/** Which picture is on the screen right now, by the id the stage marks it with. */
function shownPiece(): string {
  return (
    document
      .querySelector('[role="img"][data-image]')
      ?.getAttribute('data-image') ?? ''
  )
}

/** Runs the year from the overview and confirms it, which is what opens the labour. */
async function runTheYear(year: number): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: `Run year ${String(year)}` }))
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Run the year' })).getByRole('button', {
      name: `Run year ${String(year)}`,
    }),
  )
}

/** The crop the shell will draw for the opening year, so a test can price it in advance. */
const crop = appleCrop(farmSorting(), SEED)
const firstAction = declaration.actions[0]?.id ?? ''
const blanket = measureSort(
  declaration,
  crop,
  crop.truth,
  crop.presented.map((piece) => ({ imageId: piece.imageId, action: firstAction, elapsedMs: 0 })),
)

/** The manifest, served the way the browser would serve it. */
function serveManifest(): void {
  vi.stubGlobal('fetch', (input: string) =>
    String(input).endsWith('manifest.json')
      ? Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(manifest),
        } as Response)
      : Promise.resolve({ ok: false, status: 404 } as Response),
  )
}

/** A catalog carrying one item, so a farm can declare something that does the job. */
function catalogWithRig(owned: readonly string[]) {
  return soundCatalog(
    {
      schemaVersion: '1.0.0',
      groups: [{ id: 'yard', label: 'Yard' }],
      ownedAtStart: [...owned],
      items: [
        {
          id: 'sorting-rig',
          group: 'yard',
          label: 'Sorting rig',
          copy: 'It would do the whole crop while you have your lunch.',
          price: 2800,
          opens: [
            {
              kind: 'knob-values',
              task: declaration.id,
              knob: firstFamily(declaration).knobs[0]?.id ?? '',
              values: [firstFamily(declaration).knobs[0]?.default ?? 0],
            },
          ],
        },
      ],
    },
    shipped,
  )
}

function renderApp(
  over: {
    readonly farm?: FarmDeclaration
    readonly owned?: readonly string[]
    readonly declaresRig?: boolean
    readonly storage?: SaveStorage
  } = {},
) {
  serveManifest()
  const storage = over.storage ?? memoryStorage()
  const farm =
    over.farm ??
    (over.declaresRig === true ? { ...shipped, automation: { item: 'sorting-rig' } } : shipped)
  render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [task] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm(farm)}
      loadShop={loadsCatalog(catalogWithRig(over.owned ?? []))}
      drawSeed={() => SEED}
      {...savesTo(storage)}
      replayMs={0}
    />,
  )
  return storage
}

/** What the save holds, which is where the ledger and the year actually live. */
function saved(storage: SaveStorage): SavedFarm {
  const text = storage.getItem(SAVE_KEY)
  if (text === null) throw new Error('nothing was saved')
  return JSON.parse(text) as SavedFarm
}

function shown(label: string): string {
  return screen.getByRole('definition', { name: label }).textContent ?? ''
}

/** Runs the year, enters the labour, and decides every piece presented with the same action. */
async function sortWholeCrop(year = shipped.openingYear): Promise<void> {
  await runTheYear(year)
  await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
  const label = declaration.actions[0]?.label ?? ''
  await screen.findByRole('img', { name: 'The piece you are deciding about' })

  for (let index = 0; index < crop.presented.length; index += 1) {
    await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
  }
}

describe('hand sorting is the labour whenever no model is working the card', () => {
  it('is what running the year calls for when the farm has put no model to work', async () => {
    renderApp()
    await runTheYear(shipped.openingYear)

    expect(await screen.findByRole('button', { name: SORT_BUTTON })).toBeTruthy()
  })

  it('is not offered before the year is run, because there is no crop to bring in yet', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'The farm' })

    expect(screen.queryByRole('button', { name: SORT_BUTTON })).toBeNull()
  })

  it('is called for again the following year', async () => {
    renderApp()
    await sortWholeCrop()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(shown('Year')).toBe(String(shipped.openingYear + 1))
    await runTheYear(shipped.openingYear + 1)
    expect(await screen.findByRole('button', { name: SORT_BUTTON })).toBeTruthy()
  }, SORTING_TIME)

  it('is still called for by a farm that owns what would do the job but has not set it working', async () => {
    // The defect `workshop-harvest-split` names: hand sorting used to be dropped on
    // *ownership*, which would leave a farm that had bought the machine and never put it
    // to work with no labour at all. It is the labour slot that decides, and an unfilled
    // slot is the hands.
    renderApp({ declaresRig: true, owned: ['sorting-rig'] })
    await runTheYear(shipped.openingYear)

    expect(await screen.findByRole('button', { name: SORT_BUTTON })).toBeTruthy()
  })

  it('is called for when that thing is not the farm’s either', async () => {
    renderApp({ declaresRig: true, owned: [] })
    await runTheYear(shipped.openingYear)

    expect(await screen.findByRole('button', { name: SORT_BUTTON })).toBeTruthy()
  })
})

describe('a stage that belongs to the farm rather than to a task run', () => {
  it('carries the year and the balance, as every other stage does', async () => {
    renderApp()
    await runTheYear(shipped.openingYear)
    await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    expect(screen.getByRole('region', { name: 'Farm status' })).toBeTruthy()
    expect(shown('Year')).toBe(String(shipped.openingYear))
    expect(shown('Balance')).toBe(formatUnits(toUnits(shipped.openingBalance, shipped.precision), shipped))
  })

  it('neither configures a task nor reports a run', async () => {
    renderApp()
    await runTheYear(shipped.openingYear)
    await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    expect(screen.queryByRole('heading', { name: 'The farm' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Train model' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
  })

  it('goes back to the overview and leaves it as it was', async () => {
    const storage = renderApp()
    await runTheYear(shipped.openingYear)
    await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
    await screen.findByRole('img', { name: 'The piece you are deciding about' })
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(screen.getByRole('heading', { name: 'The farm' })).toBeTruthy()
    expect(shown('Year')).toBe(String(shipped.openingYear))
    expect(saved(storage).ledger).toEqual([])
  })
})

describe('a completed sort is that year’s harvest', () => {
  it('settles the wage, appends one record and advances the year', async () => {
    const storage = renderApp()
    await sortWholeCrop()

    const record = saved(storage)
    expect(record.ledger).toHaveLength(1)
    expect(record.ledger[0]?.year).toBe(shipped.openingYear)
    expect(record.ledger[0]?.harvest).toBeCloseTo(blanket.wage, 2)
    expect(record.year).toBe(shipped.openingYear + 1)
    expect(record.balance).toBeCloseTo(shipped.openingBalance + blanket.wage, 2)
    expect(shown('Year')).toBe(String(shipped.openingYear + 1))
  }, SORTING_TIME)

  it('shows that year’s outcome rather than opening another decision', async () => {
    renderApp()
    await sortWholeCrop()

    expect(screen.queryByRole('img', { name: 'The piece you are deciding about' })).toBeNull()
    expect(document.querySelector('[data-wage]')?.textContent).toBeTruthy()
    expect(document.querySelector('[data-correct]')?.textContent).toBe(String(blanket.correct))
  }, SORTING_TIME)

  it('appends exactly one record per year sorted, however many years are sorted', async () => {
    const storage = renderApp()
    await sortWholeCrop()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    await sortWholeCrop(shipped.openingYear + 1)

    const record = saved(storage)
    expect(record.ledger.map((year) => year.year)).toEqual([
      shipped.openingYear,
      shipped.openingYear + 1,
    ])
    expect(record.year).toBe(shipped.openingYear + 2)
  }, SORTING_TIME)
})

describe('a sort that is abandoned', () => {
  it('settles nothing, appends nothing and leaves the year where it was', async () => {
    const storage = renderApp()
    await screen.findByRole('heading', { name: 'The farm' })
    const before = saved(storage)
    await runTheYear(shipped.openingYear)

    await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
    await screen.findByRole('img', { name: 'The piece you are deciding about' })
    const label = declaration.actions[0]?.label ?? ''
    for (let index = 0; index < 3; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    const after = saved(storage)
    expect(after.balance).toBe(before.balance)
    expect(after.year).toBe(before.year)
    expect(after.ledger).toEqual([])
    expect(after.movements).toEqual(before.movements)
  })
})

describe('the sort produces no labels', () => {
  it('writes no per-image decision anywhere in what is kept', async () => {
    const storage = renderApp()
    await sortWholeCrop()

    const text = storage.getItem(SAVE_KEY) ?? ''
    for (const piece of crop.presented) {
      expect(text, `${piece.imageId} survived the sort`).not.toContain(piece.imageId)
    }
    expect(text).not.toContain('imageId')
    expect(text).not.toContain('mistakes')
    expect(text).not.toContain('elapsedMs')
  }, SORTING_TIME)

  it('keeps only what the year came to', async () => {
    const storage = renderApp()
    await sortWholeCrop()

    const record = saved(storage)
    expect(Object.keys(record.ledger[0] ?? {}).sort()).toEqual([
      'absorbed',
      'closingBalance',
      'harvest',
      'year',
    ])
  }, SORTING_TIME)

  it('keeps that card’s aggregate for the closed year, and nothing finer', async () => {
    // The report on the card is rendered from this, and it cannot be recomputed: the
    // decisions were the student's own and are never written down.
    const storage = renderApp()
    await sortWholeCrop()

    const closed = saved(storage).lastYear
    expect(closed?.year).toBe(shipped.openingYear)
    expect(Object.keys(closed?.brought[0] ?? {}).sort()).toEqual([
      'counts',
      'evaluated',
      'harvest',
      'paid',
      'task',
    ])
    // What the harvest records is about the year, not about the student: the crop's size
    // and mix, the arithmetic of what it paid, and nothing image by image.
    expect(Object.keys(closed?.brought[0]?.harvest ?? {})).not.toContain('decisions')
    // No configuration is named: a person brought this crop in.
    expect(closed?.brought[0]?.configuration).toBeUndefined()
  }, SORTING_TIME)
})

describe('a year abandoned part way is the same year when it is entered again', () => {
  it('presents the same crop rather than drawing another one', async () => {
    renderApp()
    await runTheYear(shipped.openingYear)
    await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    const first = shownPiece()
    const label = declaration.actions[0]?.label ?? ''
    for (let index = 0; index < 3; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
    }
    const fourth = shownPiece()
    expect(fourth).not.toBe(first)

    // Away, and back again. The year has not closed, so nothing has been paid and nothing
    // has advanced — and leaving must not be a way to be given a crop one likes better.
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(shown('Year')).toBe(String(shipped.openingYear))
    await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    expect(shownPiece()).toBe(first)
    expect(crop.presented[0]?.imageId).toBe(first)
  })
})

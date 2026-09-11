/**
 * The year loop through the whole shell: run once, closed once, reported from the card.
 *
 * All of this needs the shell. Whether two cards close one year between them is a fact
 * about the ledger, which no screen can see; whether a card that will not fetch leaves
 * the year open is a fact about the stage state; and the report being reached from a card
 * rather than from the workshop is the whole shape of the change.
 *
 * The second card is a task the screens have never heard of, so a two-card farm is also a
 * second proof that nothing here is written for one lesson.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatUnits, openFarm } from '../../src/economy/index.js'
import type { FamilyEntry } from '../../src/families/index.js'
import type { SavedFarm } from '../../src/save/index.js'
import { firstFamily } from '../../src/task/families.js'
import { App } from './App.js'
import type { LoadedTask } from './data/load.js'
import { SAVE_KEY, type SaveStorage } from './data/save.js'
import {
  unrelatedArtifact,
  unrelatedDeclaration,
  unrelatedTruth,
} from './test-support/declarations.js'
import { farmCarrying, farmDeclaration, loadsFarm } from './test-support/farm.js'
import { appleTask as committedAppleTask, loadEntryFor, taskFrom } from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo } from './test-support/progression.js'

afterEach(cleanup)

const apple = committedAppleTask()
const screening = taskFrom(unrelatedDeclaration(), unrelatedArtifact(), unrelatedTruth())
const declaration = farmDeclaration()
/** The farm as a two-card farm needs it: a crop declared for both cards. */
const bothCards = farmCarrying([apple.declaration, screening.declaration])
const FIRST_YEAR = declaration.openingYear
const OPENING_BALANCE = formatUnits(openFarm(declaration).balance, declaration)
/**
 * How many pieces one person is put in front of.
 *
 * The whole of the opening crop: nothing declares a limit, and the shipped orchard is one
 * tree. A larger orchard would be bounded only by the photographs the split holds, which
 * is far above this.
 */
const PRESENTED = declaration.orchard.opening * declaration.orchard.piecesPerUnit

/**
 * How long a test that brings a crop in by hand may take.
 *
 * Every simulated click goes through the real shell, which outruns the default five
 * seconds whenever the suite is busy.
 */
const SORTING_TIME = 60_000

type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly { code: string; message: string }[] }

function renderApp(
  over: {
    readonly tasks?: readonly LoadedTask[]
    readonly storage?: SaveStorage
    readonly loadEntry?: (
      task: LoadedTask,
      familyId: string,
      id: string,
    ) => Promise<Loaded<FamilyEntry>>
  } = {},
): SaveStorage {
  const storage = over.storage ?? memoryStorage()
  render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: over.tasks ?? [apple] })}
      loadEntry={over.loadEntry ?? loadEntryFor}
      loadFarm={loadsFarm(bothCards)}
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

/** Opens one card's workshop, makes a model there and puts it to work. */
async function putToWork(task: LoadedTask): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: `Open ${task.declaration.title}` }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))
  await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
}

async function runYear(year: number): Promise<void> {
  const name = `Run year ${String(year)}`
  await userEvent.click(await screen.findByRole('button', { name }))
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Run the year' })).getByRole('button', { name }),
  )
}

/**
 * A loader that serves each card's workshop once and then refuses at harvest time.
 *
 * Kept per card so a two-card farm can reach the same state on both: the workshop has to
 * be able to make a model before the year can refuse to bring its crop in.
 */
function refusingAfterTraining() {
  const served = new Set<string>()
  return (task: LoadedTask, familyId: string, id: string): Promise<Loaded<FamilyEntry>> => {
    if (served.has(task.declaration.id)) {
      return Promise.resolve({
        ok: false as const,
        issues: [
          { code: 'data-unreachable', message: 'The predictions for this model are unreachable.' },
        ],
      })
    }
    served.add(task.declaration.id)
    return loadEntryFor(task, familyId, id)
  }
}

/** The region a refused crop's cause and its remedy are shown in. */
function refusalRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'A crop that was not brought in' })
}

/** Hands one refused card's job back to the manual labour, from where the refusal is. */
async function handBackFromRefusal(task: LoadedTask): Promise<void> {
  await userEvent.click(
    within(refusalRegion()).getByRole('button', {
      name: new RegExp(task.declaration.title),
    }),
  )
}

/** Sorts a whole crop by hand, taking the first declared action on every piece. */
async function sortWholeCropByHand(task: LoadedTask): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: /by hand/ }))
  await screen.findByRole('img', { name: 'The piece you are deciding about' })
  const action = task.declaration.actions[0]?.label ?? ''
  for (let piece = 0; piece < PRESENTED; piece += 1) {
    await userEvent.click(screen.getByRole('button', { name: new RegExp(action) }))
  }
  await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
}

async function openReport(task: LoadedTask, year: number): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', {
      name: `See year ${String(year)} for ${task.declaration.title}`,
    }),
  )
}

/**
 * How the family the apple task opens at appears in a labour slot.
 *
 * The slot shows this rather than the configuration identifier: the farm is read at a
 * glance for *which family* is working which crop, and the identifier is a report's job.
 */
const APPLE_SLOT = firstFamily(apple.declaration).slot

/** What one card's slot says, from the overview. */
function slotText(task: LoadedTask): string {
  return document.querySelector(`[data-slot="${task.declaration.id}"]`)?.textContent ?? ''
}

describe('a card at work by a model is brought in without the student', () => {
  it('closes a two-card farm’s year in one act, with one record for the total', async () => {
    const storage = renderApp({ tasks: [apple, screening] })
    await putToWork(apple)
    await putToWork(screening)

    await runYear(FIRST_YEAR)

    const record = saved(storage)
    expect(record.ledger).toHaveLength(1)
    expect(record.ledger[0]?.year).toBe(FIRST_YEAR)
    expect(record.year).toBe(FIRST_YEAR + 1)
    // The record is the total of what the two cards paid, and both are in the closed year.
    const paid = (record.lastYear?.brought ?? []).reduce((total, crop) => total + crop.paid, 0)
    expect(record.lastYear?.brought).toHaveLength(2)
    expect(record.ledger[0]?.harvest).toBeCloseTo(paid, 2)
    expect(shown('Year')).toBe(String(FIRST_YEAR + 1))
  })

  it('decides nothing for the student and opens no labour of its own', async () => {
    renderApp()
    await putToWork(apple)
    await runYear(FIRST_YEAR)

    expect(screen.queryByRole('img', { name: 'The piece you are deciding about' })).toBeNull()
    expect(screen.queryByRole('button', { name: /by hand/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'The farm' })).toBeDefined()
  })
})

describe('a card that cannot be brought in leaves the year open', () => {
  it('shows the cause the engine named, keeps the year open and substitutes no labour', async () => {
    const storage = renderApp({ loadEntry: refusingAfterTraining() })
    await putToWork(apple)
    await runYear(FIRST_YEAR)

    expect(screen.getByRole('alert').textContent).toContain('unreachable')
    expect(shown('Year')).toBe(String(FIRST_YEAR))
    expect(shown('Balance')).toBe(OPENING_BALANCE)
    expect(saved(storage).ledger).toEqual([])

    // Still outstanding — and not offered to the student's own hands in the robot's place.
    expect(screen.getByRole('status').textContent).toContain(apple.declaration.title)
    expect(screen.queryByRole('button', { name: /by hand/ })).toBeNull()
    expect(slotText(apple)).toContain(APPLE_SLOT.label)
  })

  it('offers no way to run the year again while it is open', async () => {
    renderApp({ loadEntry: refusingAfterTraining() })
    await putToWork(apple)
    await runYear(FIRST_YEAR)

    expect(screen.queryByRole('button', { name: /Run year/ })).toBeNull()
  })

  it('offers the job back beside the cause, for the card that was refused', async () => {
    renderApp({ loadEntry: refusingAfterTraining() })
    await putToWork(apple)
    await runYear(FIRST_YEAR)

    const region = refusalRegion()
    expect(region.textContent).toContain('unreachable')
    const control = within(region).getByRole('button', { name: /Take the model off/ })
    expect(control.textContent).toContain(apple.declaration.title)
  })
})

/**
 * A year held open by a crop that will not come in has to be closable from where the
 * student is standing. The engine will not take the model off for them — that would pay
 * a wage they did not choose to earn and hide a broken artifact behind a worked year — so
 * the remedy is theirs to take, and it has to be within reach of the refusal.
 */
describe('handing back from the refusal unblocks the year', () => {
  it('returns the slot to the manual labour, moving no money and closing nothing', async () => {
    const storage = renderApp({ loadEntry: refusingAfterTraining() })
    await putToWork(apple)
    await runYear(FIRST_YEAR)

    await handBackFromRefusal(apple)

    expect(slotText(apple)).toContain(declaration.manualLabour?.label ?? '')
    expect(slotText(apple)).not.toMatch(/blocks\d/)
    expect(shown('Year')).toBe(String(FIRST_YEAR))
    expect(shown('Balance')).toBe(OPENING_BALANCE)
    expect(saved(storage).ledger).toEqual([])
    expect(saved(storage).lastYear).toBeUndefined()
    // The cause was about a model no longer at work, so it does not stand beside the card.
    expect(screen.queryByRole('region', { name: 'A crop that was not brought in' })).toBeNull()
  })

  it('then offers the crop to the student, and bringing it in closes the year', async () => {
    const { appleManifest } = await import('./test-support/pool.js')
    const manifest = appleManifest()
    vi.stubGlobal('fetch', (input: string) =>
      String(input).endsWith('manifest.json')
        ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)
        : Promise.resolve({ ok: false, status: 404 } as Response),
    )

    const storage = renderApp({ loadEntry: refusingAfterTraining() })
    await putToWork(apple)
    await runYear(FIRST_YEAR)
    expect(screen.queryByRole('button', { name: /by hand/ })).toBeNull()

    await handBackFromRefusal(apple)
    await sortWholeCropByHand(apple)

    expect(shown('Year')).toBe(String(FIRST_YEAR + 1))
    expect(saved(storage).ledger.map((year) => year.year)).toEqual([FIRST_YEAR])
    expect(saved(storage).lastYear?.brought).toHaveLength(1)
    // Brought in by the hands, so the closed year names no configuration for that card.
    expect(saved(storage).lastYear?.brought[0]?.configuration).toBeUndefined()

    vi.unstubAllGlobals()
  }, SORTING_TIME)

  it('leaves a second refused card refused and still at work by its model', async () => {
    renderApp({ tasks: [apple, screening], loadEntry: refusingAfterTraining() })
    await putToWork(apple)
    await putToWork(screening)
    await runYear(FIRST_YEAR)

    await handBackFromRefusal(apple)

    expect(slotText(apple)).toContain(declaration.manualLabour?.label ?? '')
    const region = refusalRegion()
    expect(within(region).getAllByRole('button', { name: /Take the model off/ })).toHaveLength(1)
    expect(within(region).getByRole('button', { name: /Take the model off/ }).textContent).toContain(
      screening.declaration.title,
    )
    expect(shown('Year')).toBe(String(FIRST_YEAR))
  })
})

describe('a closed year is not run again', () => {
  it('names the following year and offers no labour for the one that closed', async () => {
    renderApp()
    await putToWork(apple)
    await runYear(FIRST_YEAR)

    expect(
      screen.getByRole('button', { name: `Run year ${String(FIRST_YEAR + 1)}` }),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: `Run year ${String(FIRST_YEAR)}` })).toBeNull()
    expect(screen.queryByRole('button', { name: /by hand/ })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('appends exactly one record per year, however many years are run', async () => {
    const storage = renderApp()
    await putToWork(apple)
    await runYear(FIRST_YEAR)
    await runYear(FIRST_YEAR + 1)

    expect(saved(storage).ledger.map((year) => year.year)).toEqual([FIRST_YEAR, FIRST_YEAR + 1])
    expect(saved(storage).year).toBe(FIRST_YEAR + 2)
  })
})

describe('a task offers the report of the year it closed', () => {
  it('offers none before a year has closed, rather than an empty one', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'The farm' })

    expect(screen.queryByRole('button', { name: /See year/ })).toBeNull()

    await putToWork(apple)
    expect(screen.queryByRole('button', { name: /See year/ })).toBeNull()
  })

  it('names the year and the configuration the crop was brought in by', async () => {
    renderApp()
    await putToWork(apple)
    await runYear(FIRST_YEAR)
    await openReport(apple, FIRST_YEAR)

    const configuration = document.querySelector('.configuration') as HTMLElement
    expect(configuration.textContent).toContain(`Year ${String(FIRST_YEAR)}`)
    expect(configuration.textContent).toContain('blocks2-channels16-regularization1-dropout0-datasetstarter')
  })

  it('runs nothing and changes no labour slot on the way in', async () => {
    const storage = renderApp()
    await putToWork(apple)
    await runYear(FIRST_YEAR)
    const before = saved(storage)

    await openReport(apple, FIRST_YEAR)

    const after = saved(storage)
    expect(after.slots).toEqual(before.slots)
    expect(after.ledger).toEqual(before.ledger)
    expect(after.year).toBe(before.year)
    expect(after.balance).toBe(before.balance)
  })

  it('goes back to the farm with the slot and the year as they were', async () => {
    renderApp()
    await putToWork(apple)
    await runYear(FIRST_YEAR)
    await openReport(apple, FIRST_YEAR)
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(screen.getByRole('heading', { name: 'The farm' })).toBeDefined()
    expect(slotText(apple)).toContain(APPLE_SLOT.label)
    expect(shown('Year')).toBe(String(FIRST_YEAR + 1))
  })

  it('keeps naming the configuration a closed year was brought in by after the job is handed back', async () => {
    // Handing back takes effect from the next crop, never retroactively over a year that
    // has already closed and been paid for.
    renderApp()
    await putToWork(apple)
    await runYear(FIRST_YEAR)

    await userEvent.click(
      await screen.findByRole('button', { name: `Open ${apple.declaration.title}` }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Hand this job back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(slotText(apple)).toContain(declaration.manualLabour?.label ?? '')
    await openReport(apple, FIRST_YEAR)
    expect((document.querySelector('.configuration') as HTMLElement).textContent).toContain(
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
    )
  })

  it('offers a report only from the card the closed year holds one for', async () => {
    renderApp({ tasks: [apple, screening] })
    await putToWork(apple)
    await putToWork(screening)
    await runYear(FIRST_YEAR)

    for (const task of [apple, screening]) {
      await openReport(task, FIRST_YEAR)
      expect(screen.getByRole('heading', { name: task.declaration.title })).toBeDefined()
      await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    }
  })
})

/**
 * Putting a model to work and handing the job back are free, reversible, and take effect
 * from the next crop. They write the labour slot and nothing else, so neither can reach
 * back into a year that has closed or a crop that is already in.
 */
describe('changing the labour costs nothing and rewrites nothing already brought in', () => {
  /** Hands the open card's job back from the workshop, and returns to the farm. */
  async function handBackFromWorkshop(task: LoadedTask): Promise<void> {
    await userEvent.click(
      await screen.findByRole('button', { name: `Open ${task.declaration.title}` }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Hand this job back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
  }

  it('leaves the balance, the ledger and the year as they were', async () => {
    const storage = renderApp()
    await screen.findByRole('heading', { name: 'The farm' })
    const before = saved(storage)

    await putToWork(apple)
    const atWork = saved(storage)
    await handBackFromWorkshop(apple)
    const after = saved(storage)

    for (const record of [atWork, after]) {
      expect(record.balance).toBe(before.balance)
      expect(record.ledger).toEqual(before.ledger)
      expect(record.year).toBe(before.year)
      expect(record.movements).toEqual(before.movements)
    }
    // Only the slot moved, and it moved back.
    expect(atWork.slots[apple.declaration.id]).toBeDefined()
    expect(after.slots).toEqual(before.slots)
  })

  it('leaves a crop already brought in within an open year exactly as it was', async () => {
    // Two cards, one at work and one on the hands: the year runs, the model's crop comes
    // in, and the year stays open on the card the student still owes.
    const storage = renderApp({ tasks: [apple, screening] })
    await putToWork(apple)
    await runYear(FIRST_YEAR)

    const before = saved(storage)
    expect(before.pending?.brought.map((crop) => crop.task)).toEqual([apple.declaration.id])

    await handBackFromWorkshop(apple)

    const after = saved(storage)
    expect(after.pending?.brought).toEqual(before.pending?.brought)
    expect(after.balance).toBe(before.balance)
    expect(after.ledger).toEqual(before.ledger)
    expect(after.year).toBe(FIRST_YEAR)
    // The card whose crop is in is not offered again for it; the other one still is.
    expect(slotText(apple)).toContain(declaration.manualLabour?.label ?? '')
    expect(screen.getByRole('status').textContent).toContain(screening.declaration.title)
    expect(screen.getByRole('status').textContent).not.toContain(apple.declaration.title)
  })
})

describe('the whole loop, end to end', () => {
  it('walks a fresh farm through a hand-worked year and then a model-worked one', async () => {
    // The pool is fetched by the sorting stage, so the manifest has to be served for the
    // hand-worked half of this. Everything else is the shell as a student meets it.
    const { appleManifest } = await import('./test-support/pool.js')
    const manifest = appleManifest()
    vi.stubGlobal('fetch', (input: string) =>
      String(input).endsWith('manifest.json')
        ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)
        : Promise.resolve({ ok: false, status: 404 } as Response),
    )

    const storage = renderApp()
    await screen.findByRole('heading', { name: 'The farm' })
    expect(slotText(apple)).toContain(declaration.manualLabour?.label ?? '')

    // Year one, by hand.
    await runYear(FIRST_YEAR)
    await userEvent.click(await screen.findByRole('button', { name: /by hand/ }))
    await screen.findByRole('img', { name: 'The piece you are deciding about' })
    const action = apple.declaration.actions[0]?.label ?? ''
    for (let piece = 0; piece < PRESENTED; piece += 1) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(action) }))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(saved(storage).ledger).toHaveLength(1)
    expect(shown('Year')).toBe(String(FIRST_YEAR + 1))
    const afterHand = saved(storage).balance

    // The hand-worked year's report identifies the labour and names no configuration.
    await openReport(apple, FIRST_YEAR)
    const handReport = document.querySelector('.configuration') as HTMLElement
    expect(handReport.textContent).toContain(declaration.manualLabour?.label ?? '')
    expect(handReport.querySelector('code')).toBeNull()
    expect(handReport.textContent).not.toMatch(/blocks\d/)
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    // Year two, by a model put to work in the workshop.
    await putToWork(apple)
    expect(slotText(apple)).toContain(APPLE_SLOT.label)
    await runYear(FIRST_YEAR + 1)

    const record = saved(storage)
    expect(record.ledger).toHaveLength(2)
    expect(record.ledger[1]?.year).toBe(FIRST_YEAR + 1)
    expect(record.year).toBe(FIRST_YEAR + 2)
    expect(record.balance).not.toBe(afterHand)
    expect(record.lastYear?.brought[0]?.configuration).toBe(
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
    )

    vi.unstubAllGlobals()
  }, SORTING_TIME)
})

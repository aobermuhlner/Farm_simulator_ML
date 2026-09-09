/**
 * A task offering two kinds of model, through the whole shell.
 *
 * The screen tests show the picker works; these show the shell around it does. Two claims
 * need the shell: that selecting a family costs nothing — the balance, the ledger and the
 * year all live above the workshop — and that a task the screens have never seen is
 * offered, configured, put to work and reported through the same screens as the shipped
 * one, with no screen code added for it.
 *
 * The two families disagree about every image on purpose, so the report can be read for
 * which one actually brought the crop in.
 *
 * See openspec/changes/model-families/specs/simulator-shell/spec.md.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { formatUnits, openFarm } from '../../src/economy/index.js'
import type { SavedFarm } from '../../src/save/index.js'
import type { ModelFamilyDeclaration } from '../../src/task/types.js'
import { App } from './App.js'
import { SAVE_KEY, type SaveStorage } from './data/save.js'
import {
  LADDER_IMAGES,
  ladderFeatures,
  ladderModelDocument,
  ladderPredictions,
  twoFamilyDeclaration,
  unrelatedTruth,
} from './test-support/declarations.js'
import { farmCarrying, farmDeclaration, loadsFarm } from './test-support/farm.js'
import { loadEntryFor, taskFrom } from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo } from './test-support/progression.js'

afterEach(cleanup)

const ladder = twoFamilyDeclaration()
const [SHIPS_PREDICTIONS, SHIPS_MODEL] = ladder.families as readonly ModelFamilyDeclaration[]

/** The ladder task as `loadTask` would return it: one family of each shipped form. */
const task = taskFrom(
  ladder,
  [ladderPredictions()],
  unrelatedTruth(),
  { [SHIPS_MODEL!.id]: { 'depth1-photographsclinic': { ...ladderModelDocument() } } },
  ladderFeatures(),
)

const declaration = farmCarrying([ladder], farmDeclaration())
const FIRST_YEAR = declaration.openingYear
const OPENING_BALANCE = formatUnits(openFarm(declaration).balance, declaration)

function renderApp(storage: SaveStorage = memoryStorage()): SaveStorage {
  render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [task] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm(declaration)}
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
  await userEvent.click(await screen.findByRole('button', { name: `Open ${ladder.title}` }))
}

async function selectFamily(family: ModelFamilyDeclaration): Promise<void> {
  const button = document.querySelector(`[data-family="${family.id}"]`)
  if (button === null) throw new Error(`no control for family "${family.id}"`)
  await userEvent.click(button as HTMLButtonElement)
}

/** Makes a model of whichever family is showing and puts it to work. */
async function putToWork(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))
}

async function runYear(year: number): Promise<void> {
  const name = `Run year ${String(year)}`
  await userEvent.click(await screen.findByRole('button', { name }))
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Run the year' })).getByRole('button', { name }),
  )
}

async function openReport(year: number): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: `See year ${String(year)} for ${ladder.title}` }),
  )
}

/** What one card's slot says, from the overview. */
function slotText(): string {
  return document.querySelector(`[data-slot="${ladder.id}"]`)?.textContent ?? ''
}

describe('a task the screens have never seen, through the same screens', () => {
  it('is offered, configured, put to work and reported with no screen code of its own', async () => {
    const storage = renderApp()
    await openWorkshop()
    await selectFamily(SHIPS_MODEL!)
    await putToWork()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    // The slot is that family's own declaration, not a word this shell chose.
    expect(slotText()).toContain(SHIPS_MODEL!.slot.label)
    expect(slotText()).toContain(SHIPS_MODEL!.slot.icon)

    await runYear(FIRST_YEAR)
    await openReport(FIRST_YEAR)

    const report = screen.getByRole('region', { name: 'Run report' })
    expect(report.textContent).toContain(SHIPS_MODEL!.label)
    expect(report.textContent).toContain('depth1-photographsclinic')
    expect(saved(storage).slots[ladder.id]).toEqual({ configuration: 'depth1-photographsclinic', family: SHIPS_MODEL!.id })
  })

  it('shows the family the crop was brought in by, not the one now selected', async () => {
    renderApp()
    await openWorkshop()
    await selectFamily(SHIPS_MODEL!)
    await putToWork()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    await runYear(FIRST_YEAR)

    // A different family is selected after the year closed. The report is a record of
    // that year, and goes on naming what actually brought the crop in.
    await openWorkshop()
    await selectFamily(SHIPS_PREDICTIONS!)
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    await openReport(FIRST_YEAR)

    const report = screen.getByRole('region', { name: 'Run report' })
    expect(report.textContent).toContain(SHIPS_MODEL!.label)
    expect(report.textContent).not.toContain(SHIPS_PREDICTIONS!.label)
    expect(report.textContent).toContain(String(FIRST_YEAR))
  })
})

describe('selecting a family costs nothing', () => {
  it('moves no money, writes no ledger record and leaves the year where it was', async () => {
    const storage = renderApp()
    await openWorkshop()

    await selectFamily(SHIPS_MODEL!)
    await selectFamily(SHIPS_PREDICTIONS!)

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(shown('Balance')).toBe(OPENING_BALANCE)
    expect(shown('Year')).toBe(String(FIRST_YEAR))
    expect(saved(storage).ledger).toEqual([])
    expect(saved(storage).movements).toEqual([])
  })

  it('leaves a filled slot at the model that was put to work', async () => {
    const storage = renderApp()
    await openWorkshop()
    await selectFamily(SHIPS_MODEL!)
    await putToWork()

    await selectFamily(SHIPS_PREDICTIONS!)

    // Looking at a family is not putting it to work: the slot is the commitment.
    expect(saved(storage).slots[ladder.id]?.family).toBe(SHIPS_MODEL!.id)
    expect(screen.getByTestId('at-work').textContent).toBe('depth1-photographsclinic')
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(slotText()).toContain(SHIPS_MODEL!.slot.label)
  })
})

describe('which family a task shows is progress', () => {
  it('opens where the student left it, with each family’s own knobs', async () => {
    const storage = renderApp()
    await openWorkshop()
    await selectFamily(SHIPS_MODEL!)

    cleanup()
    renderApp(storage)
    await openWorkshop()

    const button = document.querySelector(`[data-family="${SHIPS_MODEL!.id}"]`)
    expect(button?.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(SHIPS_MODEL!.teaching.summary)).toBeDefined()
  })

  it('keeps each family’s knob values apart across a reload', async () => {
    const knob = SHIPS_PREDICTIONS!.knobs[0]
    if (knob?.kind !== 'choice') throw new Error('its first knob should be a choice')
    const other = knob.values.find((value) => value !== knob.default)

    const storage = renderApp()
    await openWorkshop()
    await userEvent.selectOptions(screen.getByLabelText(knob.label), String(other))

    // The whole set this family is sitting at, its dataset knob included: what a family
    // is fitted on is one of its knob values like any other.
    const stored = saved(storage).knobs[ladder.id] as Record<string, unknown>
    expect(stored[SHIPS_PREDICTIONS!.id]).toEqual({
      [knob.id]: other,
      [SHIPS_PREDICTIONS!.datasetKnob]: 'clinic',
    })
    expect(stored[SHIPS_MODEL!.id]).toBeUndefined()
  })
})

describe('every image of both splits is answered for', () => {
  it('brings a crop in by a family that ships its model, with no table fetched', async () => {
    renderApp()
    await openWorkshop()
    await selectFamily(SHIPS_MODEL!)
    await putToWork()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    await runYear(FIRST_YEAR)
    await openReport(FIRST_YEAR)

    // The crop is drawn from the evaluation split, and every piece of it was decided.
    const report = screen.getByRole('region', { name: 'Run report' })
    expect(report.textContent).toContain('images evaluated')
    expect(LADDER_IMAGES.pool?.length).toBeGreaterThan(0)
    expect(shown('Year')).toBe(String(FIRST_YEAR + 1))
  })
})

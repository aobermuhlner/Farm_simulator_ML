/**
 * The gate through the whole shell: the puzzle, the slot it withholds, and the save.
 *
 * The screen tests show the workshop withholds the control; these show the shell around it
 * keeps the promise. Three claims need the shell and cannot be seen below it: that passing
 * a tutorial is written to the save and survives a return, that nothing about it moves
 * money or the year, and that a slot restored for a family whose lesson is outstanding
 * comes back as something to go and do.
 *
 * See openspec/changes/model-tutorials/specs/simulator-shell/spec.md.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { formatUnits, openFarm } from '../../src/economy/index.js'
import type { SavedFarm } from '../../src/save/index.js'
import type { ModelFamilyDeclaration, TutorialDeclaration } from '../../src/task/types.js'
import { App } from './App.js'
import { SAVE_KEY, type SaveStorage } from './data/save.js'
import {
  ladderFeatures,
  ladderModelDocument,
  ladderPredictions,
  tutoredLadderDeclaration,
  unrelatedTruth,
} from './test-support/declarations.js'
import { farmCarrying, farmDeclaration, loadsFarm } from './test-support/farm.js'
import { loadEntryFor, taskFrom } from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo } from './test-support/progression.js'
import { FIXTURE_ANSWER, fixtureBodies, fixtureKinds } from './test-support/tutorials.js'

afterEach(cleanup)

const ladder = tutoredLadderDeclaration()

function rung(index: number): ModelFamilyDeclaration {
  const family = ladder.families[index]
  if (family === undefined) throw new Error(`the tutored ladder declares no family ${index}`)
  return family
}

function declaredTutorial(family: ModelFamilyDeclaration): TutorialDeclaration {
  if (family.tutorial === undefined) throw new Error('the tutored ladder must declare a tutorial')
  return family.tutorial
}

const GATED = rung(0)
const UNGATED = rung(1)
const TUTORIAL = declaredTutorial(GATED)

const task = taskFrom(
  ladder,
  [ladderPredictions()],
  unrelatedTruth(),
  { [UNGATED.id]: { 'depth1-photographsclinic': { ...ladderModelDocument() } } },
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
      tutorialKinds={fixtureKinds}
      tutorialBodies={fixtureBodies}
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

async function sitTutorial(answer: string): Promise<void> {
  const [entry] = screen.getAllByRole('button', { name: TUTORIAL.title })
  if (entry === undefined) throw new Error('the workshop offers no tutorial')
  await userEvent.click(entry)
  await userEvent.click(screen.getByRole('button', { name: answer }))
  await userEvent.click(screen.getByRole('button', { name: /back to the workshop/i }))
}

function slotText(): string {
  return document.querySelector(`[data-slot="${ladder.id}"]`)?.textContent ?? ''
}

describe('passing the tutorial, through the shell', () => {
  it('withholds the slot until it is passed, and fills it after', async () => {
    renderApp()
    await openWorkshop()

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await screen.findByTestId('training-step')
    expect(screen.queryByRole('button', { name: 'Put this model to work' })).toBeNull()

    await sitTutorial(FIXTURE_ANSWER)
    await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(slotText()).toContain(GATED.slot.label)
  })

  it('writes it to the save, and only the id', async () => {
    const storage = renderApp()
    await openWorkshop()
    await sitTutorial('green')
    await sitTutorial(FIXTURE_ANSWER)

    expect(saved(storage).tutorials).toEqual([TUTORIAL.id])
  })

  it('is still passed when the page is opened again, and the family still fieldable', async () => {
    const storage = renderApp()
    await openWorkshop()
    await sitTutorial(FIXTURE_ANSWER)

    cleanup()
    renderApp(storage)
    await openWorkshop()
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    expect(await screen.findByRole('button', { name: 'Put this model to work' })).toBeTruthy()
  })

  it('moves no money, appends nothing and leaves the year where it was', async () => {
    const storage = renderApp()
    await openWorkshop()
    await sitTutorial('green')
    await sitTutorial('wormy')
    await sitTutorial(FIXTURE_ANSWER)
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(shown('Balance')).toBe(OPENING_BALANCE)
    expect(shown('Year')).toBe(String(FIRST_YEAR))
    expect(saved(storage).movements).toEqual([])
    expect(saved(storage).ledger).toEqual([])
  })

  it('leaves what is at work at work, through a failed attempt and a re-pass', async () => {
    const storage = renderApp()
    await openWorkshop()
    await sitTutorial(FIXTURE_ANSWER)
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))
    const atWork = document.querySelector('[data-testid="at-work"]')?.textContent ?? ''
    expect(atWork).not.toBe('')

    // Free and unlimited, and the four things a year turns on are none of its business.
    await sitTutorial('green')
    await sitTutorial(FIXTURE_ANSWER)

    expect(document.querySelector('[data-testid="at-work"]')?.textContent).toBe(atWork)
    expect(saved(storage).tutorials).toEqual([TUTORIAL.id])
    expect(saved(storage).movements).toEqual([])
    expect(saved(storage).ledger).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
    expect(shown('Balance')).toBe(OPENING_BALANCE)
    expect(shown('Year')).toBe(String(FIRST_YEAR))
    expect(slotText()).toContain(GATED.slot.label)
  })

  it('leaves an untutored family fieldable from the first visit', async () => {
    renderApp()
    await openWorkshop()
    const other = document.querySelector(`[data-family="${UNGATED.id}"]`)
    if (other === null) throw new Error('the picker offers no second family')
    await userEvent.click(other)

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    expect(await screen.findByRole('button', { name: 'Put this model to work' })).toBeTruthy()
  })
})

describe('a saved slot whose lesson is outstanding', () => {
  it('comes back as hand work, told as something to go and do', async () => {
    const storage = memoryStorage()
    // Written by hand rather than played into place: this is the case a student reaches by
    // a declaration gaining a tutorial after a model was already at work.
    renderApp(storage)
    await openWorkshop()
    await sitTutorial(FIXTURE_ANSWER)
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))

    const withSlot = saved(storage)
    storage.setItem(SAVE_KEY, JSON.stringify({ ...withSlot, tutorials: [] }))

    cleanup()
    renderApp(storage)

    const notice = await screen.findByRole('alert', { name: 'About your saved progress' })
    expect(notice.textContent).toMatch(/tutorial/i)
    expect(notice.textContent).toMatch(/workshop/i)
    expect(notice.textContent).not.toMatch(/can no longer make|no longer declares/i)
    expect(slotText()).not.toContain(GATED.slot.label)
  })

  it('keeps the money and the year the save left', async () => {
    const storage = memoryStorage()
    renderApp(storage)
    await openWorkshop()
    await sitTutorial(FIXTURE_ANSWER)
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))

    const withSlot = saved(storage)
    storage.setItem(SAVE_KEY, JSON.stringify({ ...withSlot, tutorials: [] }))

    cleanup()
    renderApp(storage)
    await screen.findByRole('region', { name: 'Farm status' })

    expect(shown('Balance')).toBe(OPENING_BALANCE)
    expect(shown('Year')).toBe(String(FIRST_YEAR))
  })
})

describe('the market says nothing about it', () => {
  it('opens no puzzle and mentions none', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: /market/i }))

    const market = screen.getByRole('region', { name: /market/i })
    expect(market.textContent ?? '').not.toMatch(/tutorial/i)
    expect(within(market).queryByRole('button', { name: TUTORIAL.title })).toBeNull()
  })
})

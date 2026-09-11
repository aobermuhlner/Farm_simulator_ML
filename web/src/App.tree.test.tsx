/**
 * The whole loop, played through with the second family, against what actually ships.
 *
 * Every other test in this change holds one joint. This one walks the path a student
 * walks: the market sells a kind of model, the workshop offers it locked, buying it
 * unlocks selection and nothing else, the puzzle stands between owning it and fielding
 * it, passing the puzzle opens the slot, the budget is a knob like any other, the model
 * goes to work, the year runs and the report breaks it down.
 *
 * The declaration, the catalog, the pool, the trees and the farm are all the committed
 * ones. Nothing here is a fixture, because what is being asked is whether the frame
 * carries a second rung as shipped — and a stand-in second family would only prove that
 * the frame carries a stand-in.
 *
 * What it does *not* assert is anything about how good the tree is. The trees are
 * placeholders, and a figure recorded here is a figure somebody would later mistake for
 * a measurement.
 */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bestLabelling, type LabelTheLeavesPuzzle } from '../../src/tutorials/index.js'
import { App } from './App.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import {
  appleManifest,
  appleTask as committedAppleTask,
  loadEntryFor,
} from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo, shippedCatalog } from './test-support/progression.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const appleTask = committedAppleTask()
const declaration = appleTask.declaration
const shipped = farmDeclaration()

const tree = declaration.families.find((family) => family.ships === 'model')
const network = declaration.families.find((family) => family.ships === 'predictions')
if (tree === undefined || network === undefined) {
  throw new Error('the shipped task must declare both rungs')
}

const budget = tree.knobs.find((knob) => knob.id !== tree.datasetKnob)
if (budget === undefined || budget.kind !== 'choice') {
  throw new Error('the tree family must declare an enumerated node budget')
}

const tutorial = tree.tutorial
if (tutorial === undefined) throw new Error('the tree family must declare its tutorial')
const best = bestLabelling(tutorial.puzzle as LabelTheLeavesPuzzle).labelling

/** The catalog item that opens the tree family, read off the shipped catalog. */
const opensTheTree = shippedCatalog().items.find((item) =>
  item.opens.some((unlock) => unlock.kind === 'model-family' && unlock.family === tree.id),
)
if (opensTheTree === undefined) throw new Error('the catalog sells no item opening the tree')

/** The catalog item that opens the network family, likewise. */
const opensTheNetwork = shippedCatalog().items.find((item) =>
  item.opens.some((unlock) => unlock.kind === 'model-family' && unlock.family === network.id),
)
if (opensTheNetwork === undefined) {
  throw new Error('the catalog sells no item opening the network')
}

/**
 * Serves the committed pool manifest.
 *
 * The puzzle fetches the pictures it poses when it is opened, which is the whole reason
 * they are not on the farm's startup path — so a walk that sits the puzzle has to serve
 * it, and one that never does needs no stub.
 */
function serveManifest(): void {
  const manifest = appleManifest()
  vi.stubGlobal('fetch', (input: string) =>
    String(input).endsWith('manifest.json')
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)
      : Promise.resolve({ ok: false, status: 404 } as Response),
  )
}

/** The options of the select labelled `label`, in their declared words. */
function optionsOf(label: string): { readonly text: string; readonly enabled: boolean }[] {
  const select = screen.getByLabelText(label) as HTMLSelectElement
  return Array.from(select.options).map((option) => ({
    text: option.textContent ?? '',
    enabled: !option.disabled,
  }))
}

/**
 * The shipped farm with a purse, because this is a suite about the tree.
 *
 * The farm ships broke and every model on it is bought with apples the student sorted;
 * walking that ladder is `App.shipped.test.tsx`'s job. What is held here is what happens
 * once the tree has been paid for, so the money is put there rather than earned.
 */
const withPurse = { ...shipped, openingBalance: 20000 }

function renderApp(storage = memoryStorage()) {
  serveManifest()
  render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm(withPurse)}
      loadShop={loadsCatalog(shippedCatalog())}
      {...savesTo(storage)}
      replayMs={0}
    />,
  )
  return storage
}

async function openWorkshop(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: `Open ${declaration.title}` }),
  )
}

/** Buys one catalog item by label, through the market and its confirmation. */
async function buy(label: string): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))
  await userEvent.click(screen.getByRole('button', { name: `Buy ${label}` }))
  await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
  await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
}

/**
 * Buys one upgrade at the workshop's bench, from inside the workshop.
 *
 * A capacity item is sold beside the knob it moves rather than in the market, so this is
 * the whole of the difference between buying a model and buying room in one.
 */
async function buyAtBench(label: string): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Upgrades' }))
  await userEvent.click(await screen.findByRole('button', { name: `Buy ${label}` }))
  await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
  await userEvent.click(screen.getByRole('button', { name: 'Back to the workshop' }))
}

function familyButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-family="${tree!.id}"]`)
  if (button === null) throw new Error('the workshop offers no button for the tree family')
  return button
}

/** Sits the puzzle and labels every leaf as well as it can be labelled. */
async function passThePuzzle(): Promise<void> {
  const [entry] = screen.getAllByRole('button', { name: tutorial!.title })
  if (entry === undefined) throw new Error('the workshop offers no tutorial')
  await userEvent.click(entry)
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: /that is what/i }) as HTMLButtonElement).disabled,
    ).toBe(false),
  )

  for (const [index, category] of best.entries()) {
    const tray = document.querySelector<HTMLButtonElement>(`[data-tray="${category}"]`)
    const leaf = document.querySelector<HTMLButtonElement>(`[data-leaf="${index}"]`)
    if (tray === null || leaf === null) throw new Error(`no tray item or leaf for ${index}`)
    await userEvent.click(tray)
    await userEvent.click(leaf)
  }

  await userEvent.click(screen.getByRole('button', { name: /that is what/i }))
  await userEvent.click(screen.getByRole('button', { name: /back to the workshop/i }))
}

describe('buying the tree, passing its puzzle, and putting it to work', () => {
  it('walks the whole loop from the declared data alone', async () => {
    renderApp()

    // ── The workshop, before anything is bought ─────────────────────────────────
    await openWorkshop()

    // Both rungs are shown; the one that is not owned is greyed rather than hidden,
    // with the item that opens it and its price beside it.
    expect(familyButton().disabled).toBe(true)
    expect(screen.getByText(new RegExp(opensTheTree!.label))).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    // ── The market ──────────────────────────────────────────────────────────────
    await buy(opensTheTree!.label)

    // ── Selecting it ────────────────────────────────────────────────────────────
    await openWorkshop()
    expect(familyButton().disabled).toBe(false)
    await userEvent.click(familyButton())

    // Its own knob is on screen, in its own declared words, and the convolutional
    // family's knobs are not.
    expect(screen.getByLabelText(budget!.label)).toBeDefined()
    expect(screen.queryByLabelText('Convolutional blocks')).toBeNull()

    // ── The gate ────────────────────────────────────────────────────────────────
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    // The tree itself is what appears: this family draws its model rather than a curve,
    // and the drawing is resolved from the structure that will score the harvest.
    await screen.findByRole('img', { name: /^A tree of/ })
    // Owned, tuned, made — and still not fieldable, because the lesson is outstanding.
    expect(screen.queryByRole('button', { name: 'Put this model to work' })).toBeNull()

    await passThePuzzle()

    // ── Setting the budget, and putting it to work ──────────────────────────────
    await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    expect(document.querySelector(`[data-slot="${declaration.id}"]`)?.textContent).toContain(
      tree!.slot.label,
    )

    // ── The year ────────────────────────────────────────────────────────────────
    await userEvent.click(await screen.findByRole('button', { name: 'Run year 1' }))
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Run the year' })).getByRole('button', {
        name: 'Run year 1',
      }),
    )

    // ── The report ──────────────────────────────────────────────────────────────
    await userEvent.click(
      await screen.findByRole('button', { name: `See year 1 for ${declaration.title}` }),
    )

    // Broken down per true category and per action, never to one headline number:
    // an over-selective model scores beautifully on the wormy row for entirely the
    // wrong reason, and only the breakdown shows it.
    const report = await screen.findByRole('heading', { name: 'Run report' })
    expect(report).toBeDefined()
    const tables = screen.getAllByRole('table')
    const breakdown = tables[tables.length - 1]
    if (breakdown === undefined) throw new Error('the report shows no breakdown')
    for (const category of declaration.categories) {
      expect(
        within(breakdown).getAllByText(new RegExp(category.label)).length,
        category.label,
      ).toBeGreaterThan(0)
    }
    for (const action of declaration.actions) {
      expect(
        within(breakdown).getAllByText(new RegExp(action.label)).length,
        action.label,
      ).toBeGreaterThan(0)
    }
  }, 60_000)

  it('buys a larger budget and runs the tree at it', async () => {
    renderApp()

    await buy(opensTheTree!.label)
    const larger = shippedCatalog().items.find((item) =>
      item.opens.some((unlock) => unlock.kind === 'knob-values' && unlock.knob === budget!.id),
    )
    if (larger === undefined) throw new Error('the catalog sells no larger budget')

    await openWorkshop()
    await userEvent.click(familyButton())
    await buyAtBench(larger.label)

    const opened = larger.opens.flatMap((unlock) =>
      unlock.kind === 'knob-values' ? unlock.values : [],
    )
    const wanted = String(opened[0])
    expect(optionsOf(budget!.label).find((option) => option.text === wanted)?.enabled).toBe(true)

    const knob = screen.getByLabelText(budget!.label) as HTMLSelectElement
    const at = [...knob.options].findIndex((option) => option.textContent === wanted)
    await userEvent.selectOptions(knob, String(at))
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    // The configuration the budget resolves to is covered, so nothing refuses.
    expect(
      (await screen.findByTestId('current-configuration')).textContent,
    ).toContain(`${budget!.id}${wanted}`)
    expect(screen.queryByText(/No model was trained/)).toBeNull()
  }, 60_000)

  it('leaves the budgets that were never bought greyed rather than gone', async () => {
    renderApp()
    await buy(opensTheTree!.label)
    await openWorkshop()
    await userEvent.click(familyButton())

    const options = optionsOf(budget!.label)

    expect(options.map((option) => option.text)).toEqual(budget!.values.map(String))
    expect(options.filter((option) => option.enabled).map((option) => option.text)).toEqual([
      String(budget!.default),
    ])
  }, 60_000)
})

describe('6.3 a family that records no history is shown without one', () => {
  it('draws no curve, no empty axis and no error for the tree', async () => {
    // `model-families`: a family that records no history declares none, and is not
    // presented with an empty curve or a zero-length axis. The workshop showing a tree
    // without a curve is the frame working, not a gap.
    renderApp()
    await buy(opensTheTree!.label)
    await openWorkshop()
    await userEvent.click(familyButton())
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    await passThePuzzle()
    await screen.findByRole('button', { name: 'Put this model to work' })

    expect(tree!.history).toBeUndefined()
    expect(screen.queryByTestId('training-step')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  }, 60_000)

  it('still draws one for the family that does record a history', async () => {
    // The eye is bought like everything else on this farm, so a suite about what the
    // workshop draws for it has to buy it first.
    renderApp()
    await buy(opensTheNetwork!.label)
    await openWorkshop()
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    expect((await screen.findByTestId('training-step')).textContent).toContain(
      network!.history?.axis ?? '',
    )
  }, 60_000)
})

describe('6.4 nothing on screen claims a fit that did not happen', () => {
  it('shows the family’s own copy, and that copy claims no fit', async () => {
    renderApp()
    await buy(opensTheTree!.label)
    await openWorkshop()
    await userEvent.click(familyButton())

    // The copy on screen is the copy the declaration carries, word for word. That is
    // what makes the honesty condition checkable at all: there is one place it is
    // written, and `test/tree-honesty.test.ts` reads that place.
    expect(screen.getByText(tree!.teaching.summary)).toBeDefined()
  }, 60_000)

  it('says nothing about the student’s photographs having trained the tree', async () => {
    renderApp()
    await buy(opensTheTree!.label)
    await openWorkshop()
    await userEvent.click(familyButton())
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await passThePuzzle()
    await screen.findByRole('button', { name: 'Put this model to work' })

    const page = document.body.textContent ?? ''
    for (const claim of [
      /fitted to your/i,
      /learned from your/i,
      /trained on your/i,
      /your photographs taught/i,
    ]) {
      expect(page, String(claim)).not.toMatch(claim)
    }
  }, 60_000)
})

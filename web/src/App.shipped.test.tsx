/**
 * What a student who has bought a model and nothing else actually sees in this build.
 *
 * The visible claim of `progression-catalog` is here rather than in the market: three
 * knobs go from freely turnable into a refusal to greyed with a reason, and `channels`
 * stays turnable across exactly the three values a model was trained for. That is the
 * claim, so it is asserted against the shipped catalog and the shipped task rather than
 * against a stand-in.
 *
 * The eye is owned rather than bought here. `smallholding-economy` made every capability
 * on the farm something earned, and walking that ladder from a balance of zero is
 * `App.sorting.figures.test.tsx`'s subject; what this suite is about begins once a model
 * is on the farm, whichever way it got there.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import {
  appleManifest,
  appleTask as committedAppleTask,
  loadEntryFor,
} from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo, shippedCatalog } from './test-support/progression.js'

/**
 * One market row, found through something only that row carries.
 *
 * The market sells more than one thing now, so `getByRole('button', { name: /^Buy /})`
 * no longer names anything in particular. Scoping to the row keeps each assertion about
 * the item it is about.
 */
function rowOf(testId: string) {
  const row = screen.getByTestId(testId).closest('li')
  if (row === null) throw new Error(`no market row carries "${testId}"`)
  return within(row)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/**
 * Serves the committed pool manifest, for the one walk that opens the training browser.
 *
 * The browser fetches it when a student asks for it, which is the whole point of it not
 * being on the farm's startup path — so a suite that never opens the browser needs no
 * stub, and this one does.
 */
function serveManifest(): void {
  const manifest = appleManifest()
  vi.stubGlobal('fetch', (input: string) =>
    String(input).endsWith('manifest.json')
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)
      : Promise.resolve({ ok: false, status: 404 } as Response),
  )
}

const appleTask = committedAppleTask()
const shipped = farmDeclaration()

/** The shipped farm with enough in the purse to buy a rung of the orchard ladder. */
const withPurse = { ...shipped, openingBalance: 2000 }

/** The shipped catalog's item that opens the family the task opens at. */
const opensTheFirstFamily = (() => {
  const wanted = appleTask.declaration.families[0]?.id
  const item = shippedCatalog().items.find((entry) =>
    entry.opens.some((unlock) => unlock.kind === 'model-family' && unlock.family === wanted),
  )
  if (item === undefined) throw new Error(`the shipped catalog opens no family "${String(wanted)}"`)
  return item
})()

/** The orchard rung that may be bought more than once, which is the one with a tally. */
const repeatableRung = (() => {
  const item = shippedCatalog().items.find(
    (entry) =>
      (entry.repeat ?? 1) > 1 && entry.opens.some((unlock) => unlock.kind === 'farm-land'),
  )
  if (item === undefined) throw new Error('the shipped catalog sells no repeatable rung')
  return item
})()

/** The cheapest rung of the orchard ladder, which is the one a new farm reaches first. */
const cheapestRung = (() => {
  const rungs = shippedCatalog().items.filter(
    (entry) =>
      entry.priceUnits !== undefined &&
      entry.opens.some((unlock) => unlock.kind === 'farm-land'),
  )
  const item = rungs.reduce((cheapest, entry) =>
    (entry.priceUnits ?? 0) < (cheapest.priceUnits ?? 0) ? entry : cheapest,
  )
  return {
    item,
    units: item.opens.reduce(
      (sum, unlock) => (unlock.kind === 'farm-land' ? sum + unlock.units : sum),
      0,
    ),
  }
})()

function renderApp() {
  const owning = shippedCatalog()
  return render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm(withPurse)}
      loadShop={loadsCatalog({ ...owning, ownedAtStart: [opensTheFirstFamily.id] })}
      {...savesTo(memoryStorage())}
      replayMs={0}
    />,
  )
}

async function openTask(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
  )
}

/** The options of the select labelled `label`, and which of them are selectable. */
function optionsOf(label: string): { readonly text: string; readonly enabled: boolean }[] {
  const select = screen.getByLabelText(label) as HTMLSelectElement
  return Array.from(select.options).map((option) => ({
    text: option.textContent ?? '',
    enabled: !option.disabled,
  }))
}

describe('a student who owns one model and nothing else', () => {
  it('still walks the whole loop: workshop, model at work, year run, report', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'The farm' })).toBeDefined()

    await openTask()
    expect(screen.getByTestId('current-configuration').textContent).toBe(
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Put this model to work' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    const name = `Run year ${String(shipped.openingYear)}`
    await userEvent.click(await screen.findByRole('button', { name }))
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Run the year' })).getByRole('button', { name }),
    )

    await userEvent.click(
      await screen.findByRole('button', {
        name: `See year ${String(shipped.openingYear)} for ${appleTask.declaration.title}`,
      }),
    )
    expect(await screen.findByRole('region', { name: 'Run report' })).toBeDefined()
  })

  it('can turn the patterns knob across all three trained values', async () => {
    renderApp()
    await openTask()

    expect(optionsOf('Patterns per block')).toEqual([
      { text: '8', enabled: true },
      { text: '16', enabled: true },
      { text: '32', enabled: true },
    ])

    for (const [index, id] of [
      [0, 'blocks2-channels8-regularization1-dropout0-datasetstarter'],
      [2, 'blocks2-channels32-regularization1-dropout0-datasetstarter'],
    ] as const) {
      await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), String(index))
      expect(screen.getByTestId('current-configuration').textContent).toBe(id)
      await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
      expect(await screen.findByRole('button', { name: 'Put this model to work' })).toBeDefined()
    }
  })

  it('finds the deeper stack greyed rather than gone, with a reason beside it', async () => {
    renderApp()
    await openTask()

    expect(optionsOf('Convolutional blocks')).toEqual([
      { text: '2', enabled: true },
      { text: '3', enabled: false },
      { text: '4', enabled: false },
    ])
    // One note per locked value — 3 and 4 — each naming the item that would open it.
    expect(screen.getAllByText(/Deeper stacks/)).toHaveLength(2)
  })

  it('finds dropout greyed rather than gone', async () => {
    renderApp()
    await openTask()

    expect(optionsOf('Dropout')).toEqual([
      { text: '0', enabled: true },
      { text: '0.2', enabled: false },
      { text: '0.5', enabled: false },
    ])
  })

  it('finds the regularization slider sitting at its declared default', async () => {
    renderApp()
    await openTask()

    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.disabled).toBe(true)
    expect(slider.value).toBe('1')
  })

  it('meets no untrained refusal anywhere it can reach', async () => {
    renderApp()
    await openTask()

    for (const index of ['0', '1', '2']) {
      await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), index)
      await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
      expect(await screen.findByRole('button', { name: 'Put this model to work' })).toBeDefined()
      expect(screen.queryByText(/No model was trained/)).toBeNull()
    }
  })

  it('reads its replay in the word the family declares for a step, which is "epoch"', async () => {
    // The screen used to write `epoch <n>` itself. It now reads the axis the family
    // declares, and the shipped convolutional family declares "epoch" — so nothing on
    // screen moved, which is the whole of what taking a word out of a screen should do.
    renderApp()
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    const step = await screen.findByTestId('training-step')

    const family = appleTask.declaration.families.find((candidate) => candidate.ships === 'predictions')
    expect(family?.history?.axis).toBe('epoch')
    expect(step.textContent).toContain('epoch')
  })

  it('sees a market selling the orchard ladder and the models, each other row saying why', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    // What carries a price is what a model exists for. Six rungs of the orchard ladder
    // and both families do; the one this student already owns shows as owned, and the
    // larger photograph sets each say in their own words why they cannot be bought. Only
    // the rungs this balance covers offer a button, which is the rule that nothing but
    // money keeps a purchase out of reach.
    const shelved = shippedCatalog().items.filter((item) => item.group !== 'capacity')
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(shelved.length)
    expect(screen.getByTestId(`state-${opensTheFirstFamily.id}`).textContent).toBe('Owned')
    // The capacity items are sold at the workshop's bench now, so none of them is here.
    for (const testId of ['state-deeper-stacks', 'state-stronger-regularization',
      'state-dropout-layers', 'state-tree-four-questions', 'state-tree-six-questions']) {
      expect(screen.queryByTestId(testId), testId).toBeNull()
    }
    // The two larger datasets: shown, explained, and honest about why they cannot be
    // bought — no model has been fitted on photographs that do not exist yet.
    for (const testId of ['state-bulk-photos', 'state-checked-photos']) {
      expect(screen.getByTestId(testId).textContent).toContain('fitted')
      expect(rowOf(testId).queryByRole('button', { name: /^Buy / })).toBeNull()
    }
  })

  it('sees the shelves sectioned by the part of the farm they belong to', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    // The task's own declared title heads its section, and the farm-wide shelves come
    // after it under the farm's own declared name. Neither word is in a screen.
    const sections = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)
    expect(sections).toEqual([appleTask.declaration.title, shipped.name])
  })

  it('shows how much of a repeatable rung has been bought and how much the catalog permits', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    expect(screen.getByTestId(`tally-${repeatableRung.id}`).textContent).toBe(
      `0 of ${String(repeatableRung.repeat ?? 1)} bought, ${String(repeatableRung.repeat ?? 1)} to go`,
    )
  })

  it('buys a rung of the orchard ladder, and the land held rises by what it opens', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    const bar = screen.getByRole('region', { name: 'Farm status' })
    const reach = 400
    expect(bar.textContent).toContain(`${String(shipped.orchard.opening)} / ${String(reach)} trees`)

    // Scoped to the rung's own row: several things are for sale, and which one grows the
    // orchard is exactly what is being asserted below.
    await userEvent.click(
      rowOf(`state-${cheapestRung.item.id}`).getByRole('button', { name: /^Buy / }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    // The ladder terminates, so the land it could reach is a real figure and does not move.
    expect(bar.textContent).toContain(
      `${String(shipped.orchard.opening + cheapestRung.units)} / ${String(reach)} trees`,
    )
    expect(screen.getByTestId(`state-${cheapestRung.item.id}`).textContent).toBe('Owned')
  })
})

/**
 * The walk `dataset-tiers`' last task asks for, scripted rather than done by hand.
 *
 * One session through all four screens in the order a student meets them — farm,
 * workshop, training browser, market — against the shipped declaration, the shipped
 * catalog, the committed pool and the committed artifacts. What it confirms is what the
 * task names: that the two larger datasets appear, that they are explained in their own
 * declared words, and that neither can be bought.
 *
 * Written as one test rather than four because the claim is about a student's path. Each
 * screen already has its own suite; what is not asserted anywhere else is that the tier a
 * student is fitting on survives the trip between them.
 */
describe('farm to workshop to the training data to the market, in one sitting', () => {
  const family = appleTask.declaration.families[0]
  const tiers = appleTask.declaration.datasets

  it('shows the set the robot came with, and says why the others cannot be bought', async () => {
    if (family === undefined) throw new Error('the shipped task must declare a family')
    const [smallest, ...larger] = tiers
    if (smallest === undefined) throw new Error('the shipped task must declare a tier')
    const datasetKnob = family.knobs.find((knob) => knob.id === family.datasetKnob)
    if (datasetKnob === undefined) throw new Error('the shipped family must declare its knob')

    // ── The farm ────────────────────────────────────────────────────────────────
    serveManifest()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'The farm' })).toBeDefined()

    // ── The workshop ────────────────────────────────────────────────────────────
    await openTask()

    // Every tier is on screen, so a student can see what there is to earn; only the one
    // that came with the robot can be selected.
    expect(optionsOf(datasetKnob.label)).toEqual(
      tiers.map((tier, index) => ({ text: tier.id, enabled: index === 0 })),
    )
    // Its label quality is stated where it is offered, not only where it is browsed.
    expect(screen.getByText(smallest.disclosure)).toBeDefined()
    // And the tier is part of what the configuration is.
    expect(screen.getByTestId('current-configuration').textContent).toContain(
      `${family.datasetKnob}${smallest.id}`,
    )

    // ── The training data ───────────────────────────────────────────────────────
    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    expect(screen.getByText(smallest.label, { exact: false })).toBeDefined()
    expect(screen.getByText(smallest.disclosure)).toBeDefined()
    expect(screen.queryAllByRole('img')).toHaveLength(smallest.size)
    // The composition it declares is the composition on screen.
    const composition = screen.getByRole('table')
    for (const category of appleTask.declaration.categories) {
      const row = within(composition).getByRole('row', { name: new RegExp(category.label) })
      expect(within(row).getByText(String(smallest.composition[category.id]))).toBeDefined()
    }
    // Nothing gives away which photographs are filed wrongly, on a tier or otherwise.
    expect(screen.queryByText(/mislabel/i)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Back to the settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    // ── The market ──────────────────────────────────────────────────────────────
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    for (const tier of larger) {
      // Present, and described in the catalog's own declared copy.
      const row = screen.getByRole('heading', { level: 4, name: tier.label })
      expect(row).toBeDefined()
    }
    // Neither is for sale, and each says why in words a student can act on.
    for (const testId of ['state-bulk-photos', 'state-checked-photos']) {
      const state = screen.getByTestId(testId)
      expect(state.textContent).toContain('fitted')
      expect(state.textContent).not.toBe('Owned')
    }
    // Whatever else the market has come to sell, neither of the larger sets is for sale.
    for (const testId of ['state-bulk-photos', 'state-checked-photos']) {
      expect(rowOf(testId).queryByRole('button', { name: /^Buy / })).toBeNull()
    }
  })
})

/**
 * The opening of the game, played.
 *
 * A new farm holds one tree, five apples and no money, and owns nothing at all. Everything
 * it ever gets is bought with apples the student sorted by hand, and this walks that from
 * the first click: five apples, a wage, the price of the thing that would do the job, and
 * then enough harvests to buy the first rung of the orchard ladder and the first model.
 *
 * Played through the real shell against the shipped declarations, because the claim is
 * about the game rather than about any one screen: that the ladder's first rungs are
 * reachable by hand, and that what the bar reads as the student climbs them is 1, then 5,
 * then 10 trees out of the 400 the catalog can sell towards.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatUnits, toUnits } from '../../src/economy/index.js'
import { App } from './App.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import {
  appleCrop,
  appleManifest,
  appleTask as committedAppleTask,
  farmOnLand,
  loadEntryFor,
} from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo, shippedCatalog } from './test-support/progression.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const task = committedAppleTask()
const declaration = task.declaration
const shipped = farmDeclaration()
const SEED = 4242
const SORT_BUTTON = 'Sort this year’s crop by hand'

/**
 * How long one of these may take.
 *
 * Climbing to ten trees is a couple of hundred simulated clicks through the real shell,
 * which is the point: the ladder's first rungs are bought a crop at a time.
 */
const PLAYING_TIME = 180_000

function money(amount: number): string {
  return formatUnits(toUnits(amount, shipped.precision), shipped)
}

function shown(label: string): string {
  return screen.getByRole('definition', { name: label }).textContent ?? ''
}

/** The item that puts a robot on the orchard, which the farm names and the catalog prices. */
const automates = (() => {
  const named = shipped.automation?.item
  const item = shippedCatalog().items.find((entry) => entry.id === named)
  if (item === undefined || item.priceUnits === undefined) {
    throw new Error('the shipped farm must name a priced item that does the job')
  }
  return item
})()

/** The cheapest rung of the orchard ladder, and the land it opens. */
function rungAt(position: number) {
  const rungs = shippedCatalog()
    .items.filter(
      (item) =>
        item.priceUnits !== undefined && item.opens.some((open) => open.kind === 'farm-land'),
    )
    .sort((a, b) => (a.priceUnits ?? 0) - (b.priceUnits ?? 0))
  const item = rungs[position]
  if (item === undefined) throw new Error(`the ladder has no rung ${position}`)
  return {
    item,
    units: item.opens.reduce((sum, open) => (open.kind === 'farm-land' ? sum + open.units : sum), 0),
  }
}

function renderFarm() {
  const manifest = appleManifest()
  vi.stubGlobal('fetch', (input: string) =>
    String(input).endsWith('manifest.json')
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)
      : Promise.resolve({ ok: false, status: 404 } as Response),
  )
  render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [task] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm()}
      loadShop={loadsCatalog(shippedCatalog())}
      drawSeed={() => SEED}
      {...savesTo(memoryStorage())}
      replayMs={0}
    />,
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

/**
 * Brings one year's crop in by hand, every apple decided the way its category calls for,
 * and leaves the student back on the farm.
 */
async function sortTheYear(year: number, land: number): Promise<void> {
  await runTheYear(year)
  await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
  await screen.findByRole('img', { name: 'The piece you are deciding about' })

  const crop = appleCrop({ ...farmOnLand(land), year }, SEED)
  for (const piece of crop.presented) {
    const category = crop.truth[piece.imageId] as string
    const action = declaration.categoryActions[category] as string
    const label = declaration.actions.find((entry) => entry.id === action)?.label ?? ''
    await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
  }
  await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))
}

/** Buys one catalog item through the market and its confirmation, and comes back. */
async function buy(label: string): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))
  await userEvent.click(await screen.findByRole('button', { name: `Buy ${label}` }))
  await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
  await userEvent.click(screen.getByRole('button', { name: /back/i }))
}

describe('the first harvest of a farm that owns nothing', () => {
  it('opens broke, on one tree, with nothing bought', async () => {
    renderFarm()
    await screen.findByRole('heading', { name: 'The farm' })

    expect(shown('Balance')).toBe(money(0))
    expect(shown(shipped.orchard.label)).toBe(`1 / 400 ${shipped.orchard.unit}`)
  }, PLAYING_TIME)

  it('pays five apples sorted by hand, and names what would do the job instead', async () => {
    renderFarm()
    await runTheYear(shipped.openingYear)
    await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    // Five apples, and all five offered: nothing declares a smaller number any more.
    const crop = appleCrop(farmOnLand(1), SEED)
    expect(crop.size).toBe(5)
    expect(crop.presented).toHaveLength(5)
    expect(screen.getByText('Piece 1 of 5')).toBeDefined()

    for (const piece of crop.presented) {
      const category = crop.truth[piece.imageId] as string
      const action = declaration.categoryActions[category] as string
      const label = declaration.actions.find((entry) => entry.id === action)?.label ?? ''
      await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
    }

    // Two red at 1.20 and two green at 0.60, the worm thrown away. Not the 4.35 that five
    // apples at the declared 55 / 35 / 10 would pay: five apples cannot hold those shares,
    // so the crop is two, two and one, and what it drew is what pays. See `harvest-run`.
    expect(crop.composition).toEqual({ red: 2, green: 2, wormy: 1 })
    expect(document.querySelector('[data-wage]')?.textContent).toBe(money(3.6))
    expect(document.querySelector('[data-faultless]')?.textContent).toBe(money(3.6))
    expect(document.querySelector('[data-unsorted]')).toBeNull()

    // And beside the wage, what the farm declares would do the whole crop, at the price
    // the catalog gives it. Roughly twenty-eight harvests of this, which is the argument.
    expect(document.querySelector('[data-automation]')?.textContent).toContain(automates.label)
    expect(document.querySelector('[data-automation-price]')?.textContent).toBe(
      formatUnits(automates.priceUnits ?? 0, shipped),
    )
  }, PLAYING_TIME)
})

describe('the first rungs of the ladder, bought with apples sorted by hand', () => {
  it('climbs one tree to five to ten, and states the four hundred it could reach', async () => {
    renderFarm()
    await screen.findByRole('heading', { name: 'The farm' })

    const first = rungAt(0)
    const second = rungAt(1)
    expect(first.units).toBe(4)
    expect(second.units).toBe(5)

    // ── One tree ────────────────────────────────────────────────────────────────
    // Five apples a harvest at 3.60. Five of them covers the 15 the first rung costs.
    let year = shipped.openingYear
    for (let harvest = 0; harvest < 5; harvest += 1, year += 1) {
      await sortTheYear(year, 1)
    }
    expect(shown('Balance')).toBe(money(18))

    await buy(first.item.label)
    expect(shown(shipped.orchard.label)).toBe(`5 / 400 ${shipped.orchard.unit}`)

    // ── Five trees ──────────────────────────────────────────────────────────────
    // Twenty-five apples a harvest now, so the 55 the next rung costs is three of them.
    for (let harvest = 0; harvest < 3; harvest += 1, year += 1) {
      await sortTheYear(year, 5)
    }
    await buy(second.item.label)
    expect(shown(shipped.orchard.label)).toBe(`10 / 400 ${shipped.orchard.unit}`)

    // The ladder terminates, so the land the orchard could reach is a real figure and has
    // not moved while the land held climbed underneath it.
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))
    expect(
      screen.getByRole('region', { name: 'Farm status' }).textContent,
    ).toContain(`10 / 400 ${shipped.orchard.unit}`)
  }, PLAYING_TIME)

  it('buys the model that ends the clicking with the wage from a ten-tree orchard', async () => {
    renderFarm()
    await screen.findByRole('heading', { name: 'The farm' })

    let year = shipped.openingYear
    for (let harvest = 0; harvest < 5; harvest += 1, year += 1) await sortTheYear(year, 1)
    await buy(rungAt(0).item.label)
    for (let harvest = 0; harvest < 3; harvest += 1, year += 1) await sortTheYear(year, 5)
    await buy(rungAt(1).item.label)

    // Fifty apples a harvest against a hundred for the tree: about three more harvests,
    // by which point the clicking is the argument the price is answering.
    for (let harvest = 0; harvest < 3; harvest += 1, year += 1) await sortTheYear(year, 10)
    await buy(automates.label)

    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))
    expect(screen.getByTestId(`state-${automates.id}`).textContent).toBe('Owned')
  }, PLAYING_TIME)
})

/**
 * The first harvests, played through the app, with what each one pays written down.
 *
 * This is the numbers pass rather than a behaviour test: every figure below was read off
 * the screen the student reads it off, by clicking through the crop the shell drew. They
 * are asserted so that moving a declared number moves a figure here and says which — the
 * first-pass values in `design.md` are expected to change, and this is what tells whoever
 * changes them what they did.
 *
 * The clock is injected so a pace is a pace. Real clicks in a suite land microseconds
 * apart, which would report a rate no hand could reach; two and a half seconds an image
 * is a plausible one, and the arithmetic on screen is the app's own either way.
 *
 * What the harvests come to, at the shipped payoff table and the mix the farm's first
 * year draws:
 *
 * | Crop | Presented | Sorted faultlessly | Left unsorted | At 2.5 s an image |
 * | ---: | --------: | -----------------: | ------------: | ----------------: |
 * |   10 |        10 |          CHF  2.80 |             0 |    25 s, whole crop 25 s |
 * |   40 |        40 |          CHF 11.60 |             0 |  1.7 min, whole crop 1.7 min |
 * |  400 |        60 |          CHF 17.40 |           340 |  2.5 min, whole crop 16.7 min |
 * | 4000 |        60 |          CHF 17.40 |          3940 |  2.5 min, whole crop 2.8 h |
 *
 * The money figures are derived from the crop the shell actually drew rather than typed
 * out, because the year's mix is drawn within a declared range and a retuned range would
 * otherwise mean sweeping this file again. The table above is what they currently come to;
 * the assertions are what they must agree with.
 *
 * The wage stops rising at a crop of 60 — the declared limit — and every piece grown past
 * it is time on the projection and nothing in the pocket. That is the plateau, and it is
 * the whole argument for buying something that does the job.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatUnits, toUnits } from '../../src/economy/index.js'
import { App } from './App.js'
import { farmBearing, farmDeclaration, loadsFarm } from './test-support/farm.js'
import { appleCrop, appleManifest, appleTask, farmSorting, loadEntryFor } from './test-support/pool.js'
import { emptyCatalog, loadsCatalog, memoryStorage, savesTo } from './test-support/progression.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const task = appleTask()
const declaration = task.declaration
const shipped = farmDeclaration()
const manifest = appleManifest()
const SEED = 4242
const SECONDS_PER_PIECE = 2.5

/**
 * How long one of these cases may take.
 *
 * A harvest here is sixty simulated clicks through the real shell, which outruns the
 * default five seconds whenever the suite is busy. Nothing about the app is slow; the
 * test is genuinely doing sixty of everything.
 */
const PLAYING_TIME = 60_000

const SORT_BUTTON = 'Sort this year’s crop by hand'

function money(amount: number): string {
  return formatUnits(toUnits(amount, shipped.precision), shipped)
}

/**
 * What a faultless sort of the pieces on screen comes to, from the declaration.
 *
 * Derived rather than written down: what one person is presented with is the year's mix
 * over the declared limit, and the year's mix is drawn from a declared range. A figure
 * typed out here would be a second statement of the same thing, able to disagree.
 */
function faultlessWage(crop: { presented: readonly { imageId: string }[]; truth: Readonly<Record<string, string>> }): string {
  const total = crop.presented.reduce((sum, piece) => {
    const category = crop.truth[piece.imageId] as string
    const action = declaration.categoryActions[category] as string
    return sum + (declaration.payoffs[category]?.[action] as number)
  }, 0)
  return money(total)
}

/** What the screen says, for a figure it marks with `attribute`. */
function figure(attribute: string): string {
  return document.querySelector(`[${attribute}]`)?.textContent ?? ''
}

/**
 * Plays one whole harvest of a farm whose crop is `cropSize`, deciding every piece the
 * way the task says it should be decided, and returns what the screen then reports.
 */
async function harvest(
  cropSize: number,
  task = appleTask(),
): Promise<{
  readonly presented: number
  readonly faultlessly: string
  readonly wage: string
  readonly faultless: string
  readonly elapsed: string
  readonly rate: string
  readonly projection: string
  readonly unsorted: string
}> {
  vi.stubGlobal('fetch', (input: string) =>
    String(input).endsWith('manifest.json')
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)
      : Promise.resolve({ ok: false, status: 404 } as Response),
  )

  let clock = 0
  const crop = appleCrop(farmSorting(cropSize), SEED, task.declaration)

  render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [task] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm(farmBearing(cropSize, shipped))}
      loadShop={loadsCatalog(emptyCatalog())}
      drawSeed={() => SEED}
      now={() => clock}
      {...savesTo(memoryStorage())}
      replayMs={0}
    />,
  )

  // The labour is reached by running the year: it is the whole farm's crop coming in.
  const runYear = `Run year ${String(shipped.openingYear)}`
  await userEvent.click(await screen.findByRole('button', { name: runYear }))
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Run the year' })).getByRole('button', {
      name: runYear,
    }),
  )
  await userEvent.click(await screen.findByRole('button', { name: SORT_BUTTON }))
  await screen.findByRole('img', { name: 'The piece you are deciding about' })

  for (const piece of crop.presented) {
    const category = crop.truth[piece.imageId] as string
    const action = task.declaration.categoryActions[category] as string
    const label =
      task.declaration.actions.find((candidate) => candidate.id === action)?.label ?? ''
    clock += SECONDS_PER_PIECE * 1000
    await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
  }

  return {
    presented: crop.presented.length,
    /** What a faultless sort of exactly these pieces is worth, from the declaration. */
    faultlessly: faultlessWage(crop),
    wage: figure('data-wage'),
    faultless: figure('data-faultless'),
    elapsed: figure('data-elapsed'),
    rate: figure('data-rate'),
    projection: figure('data-projection'),
    unsorted: document.querySelector('[data-unsorted]')?.getAttribute('data-unsorted') ?? '0',
  }
}

/** The apple task with one of its hand-sorting figures changed, and nothing else. */
function retuned(perHarvest: number) {
  const task = appleTask()
  return {
    ...task,
    declaration: {
      ...task.declaration,
      handSorting: { ...task.declaration.handSorting, perHarvest },
    },
  }
}

describe('the first harvests, as the app plays them', () => {
  it('pays a crop of ten sorted whole', async () => {
    const played = await harvest(10)

    expect(played.presented).toBe(10)
    expect(played.wage).toBe(played.faultlessly)
    expect(played.faultless).toBe(played.faultlessly)
    expect(played.wage).toBe(money(2.8))
    expect(played.elapsed).toBe('25 s')
    expect(played.rate).toBe('24')
    expect(played.projection).toBe('25 s')
    expect(played.unsorted).toBe('0')
  }, PLAYING_TIME)

  it('pays a grown holding more, and still sorts it whole', async () => {
    const played = await harvest(40)

    expect(played.presented).toBe(40)
    expect(played.wage).toBe(played.faultlessly)
    expect(played.wage).toBe(money(11.6))
    expect(played.elapsed).toBe('1.7 min')
    expect(played.projection).toBe('1.7 min')
    expect(played.unsorted).toBe('0')
  }, PLAYING_TIME)

  it('stops paying past what one person can sort, and says how much was left', async () => {
    const played = await harvest(400)

    expect(played.presented).toBe(declaration.handSorting.perHarvest)
    expect(played.wage).toBe(money(17.4))
    expect(played.elapsed).toBe('2.5 min')
    expect(played.projection).toBe('16.7 min')
    expect(played.unsorted).toBe(String(400 - declaration.handSorting.perHarvest))
  }, PLAYING_TIME)

  it('pays a crop ten times larger again not one franc more', async () => {
    const played = await harvest(4000)

    expect(played.presented).toBe(declaration.handSorting.perHarvest)
    expect(played.wage).toBe(money(17.4))
    expect(played.elapsed).toBe('2.5 min')
    // The same afternoon's work, and a whole crop that would now take days.
    expect(played.projection).toBe('2.8 h')
    expect(played.unsorted).toBe(String(4000 - declaration.handSorting.perHarvest))
  }, PLAYING_TIME)
})

describe('the numbers move as declared data', () => {
  it('moves the plateau with the declared limit, and with no code change', async () => {
    // The same crop, the same table and the same screens; only the task's declared figure
    // for what one person gets through is different, and the whole shape moves with it.
    const played = await harvest(400, retuned(20))

    expect(played.presented).toBe(20)
    expect(played.wage).toBe(money(5.8))
    expect(played.unsorted).toBe('380')
    expect(played.projection).toBe('16.7 min')
  }, PLAYING_TIME)

  it('moves the opening harvest with the farm’s declared crop', async () => {
    const small = await harvest(4)
    expect(small.presented).toBe(4)
    expect(small.unsorted).toBe('0')
    expect(small.wage).toBe(money(1))
  }, PLAYING_TIME)
})

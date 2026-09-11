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
 * |    5 |         5 |          CHF  3.60 |             0 |   12.5 s, whole crop 12.5 s |
 * |   40 |        40 |          CHF 34.80 |             0 |  1.7 min, whole crop 1.7 min |
 * |  400 |       400 |                  — |             0 |   — (offered, not clicked through) |
 * | 2000 |       721 |                  — |          1279 |   — (offered, not clicked through) |
 *
 * The money figures are derived from the crop the shell actually drew rather than typed
 * out, because the year's mix is drawn within a declared range and a retuned range would
 * otherwise mean sweeping this file again. The table above is what they currently come to;
 * the assertions are what they must agree with.
 *
 * Two things bound a harvest, and only one of them is a number anyone declared. The crop
 * is offered entire however large it is — 400 apples is 400 clicks if the student wants
 * them — and what finally stops it is the evaluation split running out of distinct
 * photographs at about 720. Everything grown past that is time on the projection and
 * nothing in the pocket. That is the plateau, and it is the whole argument for buying
 * something that does the job.
 *
 * The five-apple opening pays 3.60 rather than the 5 x 0.87 its declared shares suggest:
 * five apples cannot be 55 / 35 / 10, so the crop is two, two and one, and the drawn
 * counts are what pays. `harvest-run` requires exactly that.
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
 * A harvest here is dozens of simulated clicks through the real shell, which outruns the
 * default five seconds whenever the suite is busy. Nothing about the app is slow; the
 * test is genuinely doing all of them.
 */
const PLAYING_TIME = 60_000

const SORT_BUTTON = 'Sort this year’s crop by hand'

function money(amount: number): string {
  return formatUnits(toUnits(amount, shipped.precision), shipped)
}

/**
 * What a faultless sort of the pieces on screen comes to, from the declaration.
 *
 * Derived rather than written down: what one person is presented with is the crop itself,
 * and the year's mix is drawn from a declared range. A figure typed out here would be a
 * second statement of the same thing, able to disagree.
 */
function faultlessWage(crop: {
  presented: readonly { imageId: string }[]
  truth: Readonly<Record<string, string>>
}): string {
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

/** Everything the summary reports once a sort has settled. */
function reported() {
  return {
    wage: figure('data-wage'),
    faultless: figure('data-faultless'),
    elapsed: figure('data-elapsed'),
    rate: figure('data-rate'),
    projection: figure('data-projection'),
    unsorted: document.querySelector('[data-unsorted]')?.getAttribute('data-unsorted') ?? '0',
  }
}

/**
 * Opens the sorting screen on a farm whose crop is `cropSize`, and hands back the crop
 * the shell drew along with a clicker for it.
 *
 * The clock is the shell's, so the pace on screen is the pace this test set.
 */
async function openSort(cropSize: number): Promise<{
  readonly crop: ReturnType<typeof appleCrop>
  readonly decide: (count: number) => Promise<void>
}> {
  vi.stubGlobal('fetch', (input: string) =>
    String(input).endsWith('manifest.json')
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)
      : Promise.resolve({ ok: false, status: 404 } as Response),
  )

  let clock = 0
  const crop = appleCrop(farmSorting(cropSize), SEED, declaration)

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

  async function decide(count: number): Promise<void> {
    for (const piece of crop.presented.slice(0, count)) {
      const category = crop.truth[piece.imageId] as string
      const action = declaration.categoryActions[category] as string
      const label = declaration.actions.find((candidate) => candidate.id === action)?.label ?? ''
      clock += SECONDS_PER_PIECE * 1000
      await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
    }
  }

  return { crop, decide }
}

/** Plays one whole harvest of a crop of `cropSize`, deciding every piece as declared. */
async function harvest(cropSize: number) {
  const { crop, decide } = await openSort(cropSize)
  await decide(crop.presented.length)
  return { presented: crop.presented.length, faultlessly: faultlessWage(crop), ...reported() }
}

describe('the first harvests, as the app plays them', () => {
  it('pays the opening crop of five, sorted whole', async () => {
    const played = await harvest(5)

    expect(played.presented).toBe(5)
    expect(played.wage).toBe(played.faultlessly)
    expect(played.faultless).toBe(played.faultlessly)
    // Two red, two green and one wormy — five apples cannot be 55 / 35 / 10, and what
    // pays is what was drawn.
    expect(played.wage).toBe(money(3.6))
    expect(played.elapsed).toBe('12.5 s')
    expect(played.rate).toBe('24')
    expect(played.projection).toBe('12.5 s')
    expect(played.unsorted).toBe('0')
  }, PLAYING_TIME)

  it('pays a grown holding more, and still sorts it whole', async () => {
    const played = await harvest(40)

    expect(played.presented).toBe(40)
    expect(played.wage).toBe(played.faultlessly)
    expect(played.wage).toBe(money(34.8))
    expect(played.elapsed).toBe('1.7 min')
    expect(played.projection).toBe('1.7 min')
    expect(played.unsorted).toBe('0')
  }, PLAYING_TIME)

  it('offers the whole of a crop of four hundred, which no declared number bounds', async () => {
    // Far more than anyone will click through in a sitting, and offered all the same:
    // where the sort stops is the student's own decision.
    const { crop } = await openSort(400)

    expect(crop.presented).toHaveLength(400)
    expect(figure('data-progress')).toBe('Piece 1 of 400')
  }, PLAYING_TIME)

  it('runs out of photographs before it runs out of apples, past the split', async () => {
    // 2 000 apples against a split holding 500 red, 250 green and 250 wormy photographs.
    // Green is what runs short — a quarter of the split against a third of the crop — and
    // the portion keeps the crop's own mix rather than being filled out with the reds and
    // worms that were left. The exact figure follows the year's drawn share of worms.
    const { crop } = await openSort(2000)

    expect(crop.size).toBe(2000)
    expect(crop.presented).toHaveLength(721)
    expect(figure('data-progress')).toBe('Piece 1 of 721')
  }, PLAYING_TIME)
})

describe('the student draws the line, and the screen prices it first', () => {
  it('states the wage, the count left and what the orchard bears on them', async () => {
    const { crop, decide } = await openSort(2000)
    await decide(20)

    const discarded = crop.presented.length - 20
    expect(figure('data-stop-discarded')).toBe(String(discarded))
    // 0.55 x 1.20 + 0.35 x 0.60 + 0.10 x 0 an apple, over what would be left.
    expect(figure('data-stop-worth')).toContain(money(discarded * 0.87))
    expect(figure('data-stop-time')).toBe('29.2 min')
  }, PLAYING_TIME)

  it('closes the year on a delivered part of a crop, and counts the rest as left', async () => {
    const { crop, decide } = await openSort(2000)
    await decide(20)

    const offered = figure('data-stop-wage')
    await userEvent.click(screen.getByRole('button', { name: /Deliver what you have sorted/ }))
    await userEvent.click(screen.getByRole('button', { name: /Deliver and close the year/ }))

    const played = reported()
    // Exactly what the offer promised, and the whole of the rest of the crop — the 701
    // still presentable and the 1 279 there were never photographs for — earns nothing.
    expect(played.wage).toBe(offered)
    expect(played.wage).toBe(faultlessWage({ ...crop, presented: crop.presented.slice(0, 20) }))
    expect(played.unsorted).toBe(String(2000 - 20))
    expect(played.elapsed).toBe('50 s')

    // And the year is closed on the same step a completed sort closes it on: the wage is
    // against the balance, and the farm has moved on to the next one.
    const bar = screen.getByRole('region', { name: 'Farm status' })
    expect(within(bar).getByRole('definition', { name: 'Year' }).textContent).toBe(
      String(shipped.openingYear + 1),
    )
    expect(within(bar).getByRole('definition', { name: 'Balance' }).textContent).toBe(played.wage)
  }, PLAYING_TIME)
})

describe('the numbers move as declared data', () => {
  it('moves the opening harvest with the farm’s declared crop', async () => {
    const small = await harvest(4)
    expect(small.presented).toBe(4)
    expect(small.unsorted).toBe('0')
    expect(small.wage).toBe(money(3))
  }, PLAYING_TIME)
})

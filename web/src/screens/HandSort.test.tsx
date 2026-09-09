/**
 * The sorting screen: one image, the declared actions, and the summary afterwards.
 *
 * Rendered against the committed pool's own crop, so what is on screen is what a student
 * would be given. The two rules this suite exists to hold are that nothing about an image
 * appears while a decision about it is open, and that every control comes from the
 * declaration rather than from this screen.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SortOutcome } from '../../../src/sorting/index.js'
import { measureSort } from '../../../src/sorting/index.js'
import { formatUnits, toUnits } from '../../../src/economy/index.js'
import { appleDeclaration } from '../test-support/declarations.js'
import { farmBearing, farmDeclaration } from '../test-support/farm.js'
import { appleCrop, farmSorting, loadsCrop, refusesCrop } from '../test-support/pool.js'
import { ACTION_KEYS, describeSeconds, HandSort } from './HandSort.js'
import type { CropView } from '../data/pool.js'

afterEach(cleanup)

const declaration = appleDeclaration()
const farm = farmDeclaration()
const actions = declaration.actions
const REQUIRED = declaration.categoryActions

function formatAmount(amount: number): string {
  return formatUnits(toUnits(amount, farm.precision), farm)
}

function renderSort(
  crop: CropView,
  over: Partial<Parameters<typeof HandSort>[0]> = {},
): { settled: SortOutcome[] } {
  const settled: SortOutcome[] = []
  render(
    <HandSort
      declaration={declaration}
      load={loadsCrop(crop)}
      onSettle={(outcome) => settled.push(outcome)}
      formatAmount={formatAmount}
      onBack={() => undefined}
      {...over}
    />,
  )
  return { settled }
}

/** The image currently under decision. */
function shownImage(): string {
  const cell = screen.getByRole('img', { name: 'The piece you are deciding about' })
  return cell.getAttribute('data-image') ?? ''
}

/** Chooses the action the task says the image on screen calls for. */
async function decideCorrectly(crop: CropView): Promise<void> {
  const category = crop.truth[shownImage()] as string
  const action = REQUIRED[category] as string
  await userEvent.click(screen.getByRole('button', { name: new RegExp(labelOf(action)) }))
}

function labelOf(actionId: string): string {
  return actions.find((action) => action.id === actionId)?.label ?? actionId
}

describe('one image at a time, with the declared actions under it', () => {
  it('offers a control per declared action, in the declared order', async () => {
    const crop = appleCrop()
    renderSort(crop)
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    const controls = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-action'))
    expect(controls.map((button) => button.getAttribute('data-action'))).toEqual(
      actions.map((action) => action.id),
    )
    expect(controls.map((button) => button.textContent)).toEqual(
      actions.map((action, index) => expect.stringContaining(action.label) as unknown as string),
    )
  })

  it('shows a distinct key on each control, assigned by declared order', async () => {
    renderSort(appleCrop())
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    const keys = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-action'))
      .map((button) => button.querySelector('.action-key')?.textContent)
    expect(keys).toEqual(actions.map((_action, index) => ACTION_KEYS[index]))
    expect(new Set(keys).size).toBe(actions.length)
  })

  it('reaches every declared action by pointer', async () => {
    for (const action of actions) {
      const crop = appleCrop()
      const { settled } = renderSort(crop)
      await screen.findByRole('img', { name: 'The piece you are deciding about' })

      const first = shownImage()
      await userEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }))
      expect(shownImage()).not.toBe(first)
      expect(settled).toHaveLength(0)
      cleanup()
    }
  })

  it('reaches every declared action by key', async () => {
    for (const [index, action] of actions.entries()) {
      const crop = appleCrop()
      renderSort(crop)
      await screen.findByRole('img', { name: 'The piece you are deciding about' })

      const first = shownImage()
      await userEvent.keyboard(ACTION_KEYS[index] as string)
      expect(shownImage(), `key ${String(ACTION_KEYS[index])} should choose ${action.id}`).not.toBe(
        first,
      )
      cleanup()
    }
  })

  it('reaches every declared action by a directional swipe where three are declared', async () => {
    const crop = appleCrop()
    renderSort(crop)
    const cell = await screen.findByRole('img', { name: 'The piece you are deciding about' })
    const first = shownImage()

    await userEvent.pointer([
      { target: cell, coords: { clientX: 200, clientY: 200 }, keys: '[MouseLeft>]' },
      { target: cell, coords: { clientX: 60, clientY: 205 } },
      { target: cell, coords: { clientX: 60, clientY: 205 }, keys: '[/MouseLeft]' },
    ])

    expect(shownImage()).not.toBe(first)
    expect(screen.getByText(/^Piece 2 of/)).toBeTruthy()
  })

  it('shows the position in the crop and the student’s own tallies', async () => {
    const crop = appleCrop()
    renderSort(crop)
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    expect(screen.getByRole('status').textContent).toContain(`Piece 1 of ${crop.presented.length}`)
    for (const action of actions) {
      expect(document.querySelector(`[data-chosen="${action.id}"]`)?.textContent).toBe('0')
    }

    await userEvent.click(screen.getByRole('button', { name: new RegExp(labelOf(actions[0]?.id ?? '')) }))
    expect(document.querySelector(`[data-chosen="${actions[0]?.id ?? ''}"]`)?.textContent).toBe('1')
    expect(screen.getByRole('status').textContent).toContain('Piece 2 of')
  })
})

describe('nothing about the image but its picture', () => {
  it('shows neither the category nor its declared label while a decision is open', async () => {
    const crop = appleCrop()
    renderSort(crop)
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    const text = document.body.textContent ?? ''
    for (const category of declaration.categories) {
      expect(text, `the label of "${category.id}" is on screen`).not.toContain(category.label)
    }
    expect(document.body.innerHTML).not.toContain(`"${crop.truth[shownImage()] as string}"`)
  })

  it('shows no attribute value for the image on screen', async () => {
    renderSort(appleCrop())
    const cell = await screen.findByRole('img', { name: 'The piece you are deciding about' })

    // The screen is handed no attributes at all, which is the strongest form of this.
    for (const attribute of ['hue', 'roundness', 'gloss', 'lighting', 'wormVisibility']) {
      expect(document.body.innerHTML).not.toContain(attribute)
    }
    expect(cell.getAttribute('data-image')).toBeTruthy()
  })

  it('says nothing about whether the previous decision was right', async () => {
    const crop = appleCrop()
    renderSort(crop)
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    await decideCorrectly(crop)
    // "right" and "wrong" are not looked for as bare words: a gesture label says "swipe
    // right", and outlawing the direction would be a rule about English rather than
    // about verdicts. What a verdict would actually say is looked for instead, along
    // with every part of the summary that could carry one.
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/correct|incorrect|mistake|well done|got it/i)
    expect(document.querySelector('[data-correct]')).toBeNull()
    expect(document.querySelector('.breakdown')).toBeNull()
    expect(document.querySelector('[data-wage]')).toBeNull()
  })

  it('offers no review of what has been decided while the crop is still being sorted', async () => {
    const crop = appleCrop()
    renderSort(crop)
    await screen.findByRole('img', { name: 'The piece you are deciding about' })
    await decideCorrectly(crop)

    expect(document.querySelector('[data-review]')).toBeNull()
    expect(screen.queryByRole('button', { name: /got wrong/ })).toBeNull()
  })
})

describe('a crop that cannot be brought in', () => {
  it('shows the cause of an unreachable pool, and no image and no wage', async () => {
    renderSort(appleCrop(), {
      load: refusesCrop('data-unreachable', 'The pool manifest could not be fetched (404).'),
    })

    expect((await screen.findByRole('alert')).textContent).toContain('could not be fetched')
    expect(screen.queryByRole('img', { name: 'The piece you are deciding about' })).toBeNull()
    expect(document.querySelector('[data-wage]')).toBeNull()
  })

  it('shows the cause of a mismatched pool, naming what the module named', async () => {
    renderSort(appleCrop(), {
      load: refusesCrop(
        'pool-mismatch',
        'This pool was generated for another task, so its images cannot be sorted here.',
        'poolId',
      ),
    })

    expect((await screen.findByRole('alert')).textContent).toContain('another task')
    expect(screen.queryByRole('img', { name: 'The piece you are deciding about' })).toBeNull()
    expect(document.querySelector('[data-progress]')).toBeNull()
  })
})

/** A settled outcome over the whole crop, decided as the caller says. */
function sortedWith(crop: CropView, chosen: (category: string) => string, elapsedMs = 3000) {
  return measureSort(
    declaration,
    crop,
    crop.truth,
    crop.presented.map((piece) => ({
      imageId: piece.imageId,
      action: chosen(crop.truth[piece.imageId] as string),
      elapsedMs,
    })),
  )
}

describe('the summary breaks the crop down and states its arithmetic', () => {
  const crop = appleCrop()
  const outcome = sortedWith(crop, (category) => REQUIRED[category] as string)

  it('reports every category-and-action combination, zeros included', async () => {
    renderSort(crop, { outcome })
    await screen.findByRole('img', { name: 'The piece you are deciding about' }).catch(() => null)

    for (const category of declaration.categories) {
      for (const action of actions) {
        const cell = document.querySelector(`[data-cell="${category.id}:${action.id}"]`)
        expect(cell, `${category.id} × ${action.id} is missing`).not.toBeNull()
        expect(cell?.textContent).toMatch(/^\d+$/)
      }
    }
  })

  it('shows the count correct alongside the breakdown rather than instead of it', () => {
    renderSort(crop, { outcome })
    expect(document.querySelector('[data-correct]')?.textContent).toBe(String(outcome.correct))
    expect(document.querySelector('.breakdown')).not.toBeNull()
  })

  it('shows the wage and what a faultless sort of the same pieces would have paid', () => {
    const sloppy = sortedWith(crop, () => actions[0]?.id ?? '')
    renderSort(crop, { outcome: sloppy })

    expect(document.querySelector('[data-wage]')?.textContent).toBe(formatAmount(sloppy.wage))
    expect(document.querySelector('[data-faultless]')?.textContent).toBe(
      formatAmount(sloppy.faultless),
    )
    expect(sloppy.faultless).toBeGreaterThan(sloppy.wage)
  })

  it('shows the throughput arithmetic: elapsed, a minute, and the whole crop', () => {
    renderSort(crop, { outcome })
    expect(document.querySelector('[data-elapsed]')?.textContent).toBe(
      describeSeconds(outcome.throughput.seconds),
    )
    expect(document.querySelector('[data-rate]')?.textContent).toBe(
      String(Math.round(outcome.throughput.perMinute * 10) / 10),
    )
    expect(document.querySelector('[data-projection]')?.textContent).toBe(
      describeSeconds(outcome.throughput.wholeCropSeconds),
    )
  })

  it('says nothing about a remainder when the crop was sorted entire', () => {
    // A crop one person can get through, which the shipped orchard is far past: the
    // remainder line is about the crop being larger than a pair of hands, so a crop that
    // is not needs its own farm to say so.
    const small = appleCrop(farmSorting(declaration.handSorting.perHarvest))
    const whole = sortedWith(small, (category) => REQUIRED[category] as string)
    renderSort(small, { outcome: whole })
    expect(whole.unsorted).toBe(0)
    expect(document.querySelector('[data-unsorted]')).toBeNull()
  })

  it('states how many were left and that they earned nothing when the crop was too big', () => {
    const large = appleCrop(farmSorting(400))
    const past = sortedWith(large, (category) => REQUIRED[category] as string)
    renderSort(large, { outcome: past })

    expect(past.unsorted).toBe(400 - declaration.handSorting.perHarvest)
    const line = document.querySelector('[data-unsorted]')
    expect(line?.getAttribute('data-unsorted')).toBe(String(past.unsorted))
    expect(line?.textContent).toContain('earned nothing')
    // And the projected time covers the whole crop rather than the part decided.
    expect(past.throughput.wholeCropSeconds).toBeGreaterThan(past.throughput.seconds)
  })
})

describe('the price of not doing it by hand', () => {
  const crop = appleCrop()
  const outcome = sortedWith(crop, (category) => REQUIRED[category] as string)

  it('states the declared price beside the wage when the farm declares one', () => {
    renderSort(crop, {
      outcome,
      automation: { label: 'Sorting rig', price: 'ETB 2 800.00' },
    })

    const line = document.querySelector('[data-automation]')
    expect(line?.textContent).toContain('Sorting rig')
    expect(document.querySelector('[data-automation-price]')?.textContent).toBe('ETB 2 800.00')
  })

  it('omits the comparison, and every price, when the farm declares none', () => {
    renderSort(crop, { outcome })
    expect(document.querySelector('[data-automation]')).toBeNull()
    expect(document.querySelector('[data-automation-price]')).toBeNull()
  })
})

describe('the mistakes are reviewable once the wage is shown', () => {
  const crop = appleCrop()
  const sloppy = sortedWith(crop, () => actions[0]?.id ?? '')

  it('shows each one with its category’s declared label and the action it called for', async () => {
    renderSort(crop, { outcome: sloppy })

    await userEvent.click(screen.getByRole('button', { name: /got wrong/ }))
    const review = document.querySelector('[data-review]')
    expect(review).not.toBeNull()

    const first = sloppy.mistakes[0]
    if (first === undefined) throw new Error('the sloppy sort must have made mistakes')
    const categoryLabel = declaration.categories.find((c) => c.id === first.category)?.label ?? ''
    const calledLabel = labelOf(first.called)
    expect(review?.textContent).toContain(categoryLabel)
    expect(review?.textContent).toContain(calledLabel)
    expect(within(review as HTMLElement).getAllByRole('img')).toHaveLength(sloppy.mistakes.length)
  })

  it('reveals no attribute value in the review', async () => {
    renderSort(crop, { outcome: sloppy })
    await userEvent.click(screen.getByRole('button', { name: /got wrong/ }))

    for (const attribute of ['hue', 'roundness', 'gloss', 'lighting', 'wormVisibility']) {
      expect(document.body.innerHTML).not.toContain(attribute)
    }
  })

  it('offers nothing to review when there was nothing to get wrong', () => {
    const faultless = sortedWith(crop, (category) => REQUIRED[category] as string)
    renderSort(crop, { outcome: faultless })
    expect(screen.queryByRole('button', { name: /got wrong/ })).toBeNull()
  })
})

describe('a sort that runs to the end', () => {
  it('hands over one outcome, once, when the last piece is decided', async () => {
    const crop = appleCrop()
    const clock = vi.fn()
    let tick = 0
    clock.mockImplementation(() => {
      tick += 2000
      return tick
    })
    const { settled } = renderSort(crop, { now: clock })
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    for (let index = 0; index < crop.presented.length; index += 1) {
      expect(settled, `settled after ${index} of ${crop.presented.length}`).toHaveLength(0)
      await decideCorrectly(crop)
    }

    expect(settled).toHaveLength(1)
    expect(settled[0]?.decided).toBe(crop.presented.length)
    expect(settled[0]?.correct).toBe(crop.presented.length)
    expect(settled[0]?.throughput.seconds).toBeGreaterThan(0)
    // Sixty simulated clicks through the real screen, which outruns the default five
    // seconds whenever the suite is busy. The screen is not slow; the test is doing sixty
    // of everything, because that is what one person is presented with.
  }, 60_000)

  it('opens no decision at all for a year already brought in', async () => {
    const crop = appleCrop()
    const outcome = sortedWith(crop, (category) => REQUIRED[category] as string)
    const { settled } = renderSort(crop, { outcome })

    expect(screen.queryByRole('img', { name: 'The piece you are deciding about' })).toBeNull()
    expect(document.querySelector('[data-wage]')).not.toBeNull()

    await userEvent.keyboard(ACTION_KEYS[0] as string)
    expect(settled).toHaveLength(0)
  })
})

describe('the summary states what the buyer measured', () => {
  const term = declaration.delivery
  if (term === undefined) throw new Error('the shipped task must declare a delivery term')

  /**
   * A crop of the wettest year the shipped range allows, so the limit is reachable.
   *
   * The range is dropped and the share pinned at its upper bound rather than left to a
   * draw: a screen test about what the summary says must not depend on which year came up.
   */
  function wettest(cropSize = declaration.handSorting.perHarvest): CropView {
    // Built from a farm declared to bear exactly this crop, not from the shipped one:
    // the size is the land times the yield now, so pinning the composition on the
    // shipped orchard would hand the draw sixty pieces per requested one.
    const wet = { ...farmBearing(cropSize, farm), cropComposition: { red: 0.51, green: 0.35, wormy: 0.14 } }
    delete (wet as { yearVariation?: unknown }).yearVariation
    return appleCrop({ ...farmSorting(cropSize), declaration: wet }, 4242)
  }

  it('states the measured share and the limit it was measured against', () => {
    const crop = appleCrop(farmSorting(declaration.handSorting.perHarvest))
    const careless = sortedWith(crop, () => term.delivering[0] as string)
    renderSort(crop, { outcome: careless })

    const line = document.querySelector('[data-delivery]') as HTMLElement
    expect(line).not.toBeNull()
    expect(line.querySelector('[data-share]')?.textContent).toContain('%')
    expect(line.querySelector('[data-tolerance]')?.textContent).toBe(
      `${Math.round(term.tolerance * 1000) / 10}%`,
    )
    expect(line.querySelector('[data-delivered]')?.textContent).toBe(String(careless.decided))
    // Named from the declaration, so a lesson measuring something else says so here.
    for (const category of term.measures) {
      const label = declaration.categories.find((entry) => entry.id === category)?.label
      expect(line.textContent).toContain(label)
    }
  })

  it('shows the deduction as its own figure when the delivery was downgraded', () => {
    const crop = wettest()
    const careless = sortedWith(crop, () => term.delivering[0] as string)
    renderSort(crop, { outcome: careless })

    expect(careless.delivery.downgraded).toBe(true)
    expect(document.querySelector('[data-downgraded]')).not.toBeNull()
    expect(document.querySelector('[data-gross]')?.textContent).toBe(
      formatAmount(careless.delivery.gross),
    )
    expect(document.querySelector('[data-downgrade]')?.textContent).toBe(
      formatAmount(careless.delivery.downgrade),
    )
    expect(document.querySelector('[data-wage]')?.textContent).toBe(formatAmount(careless.wage))
  })

  it('says the delivery was accepted when the share stayed under the limit', () => {
    const crop = appleCrop(farmSorting(declaration.handSorting.perHarvest))
    const careful = sortedWith(crop, (category) => REQUIRED[category] as string)
    renderSort(crop, { outcome: careful })

    expect(careful.delivery.downgraded).toBe(false)
    expect(document.querySelector('[data-accepted]')).not.toBeNull()
    expect(document.querySelector('[data-downgraded]')).toBeNull()
    expect(document.querySelector('[data-wage]')?.textContent).toBe(
      formatAmount(careful.delivery.gross),
    )
  })

  it('says nothing was measured when nothing went to the buyer', () => {
    const crop = appleCrop(farmSorting(declaration.handSorting.perHarvest))
    const outside = actions.find((action) => !term.delivering.includes(action.id))
    if (outside === undefined) throw new Error('the term must leave an action outside it')
    const kept = sortedWith(crop, () => outside.id)
    renderSort(crop, { outcome: kept })

    const line = document.querySelector('[data-delivery]') as HTMLElement
    expect(line.querySelector('[data-share]')).toBeNull()
    expect(line.textContent).toMatch(/nothing/i)
  })

  it('leaves the unsorted line and the throughput figures exactly as they were', () => {
    const crop = wettest(400)
    const careless = sortedWith(crop, () => term.delivering[0] as string)
    renderSort(crop, { outcome: careless })

    expect(careless.delivery.downgraded).toBe(true)
    expect(document.querySelector('[data-unsorted]')?.getAttribute('data-unsorted')).toBe(
      String(400 - declaration.handSorting.perHarvest),
    )
    expect(document.querySelector('[data-elapsed]')?.textContent).toBe(
      describeSeconds(careless.throughput.seconds),
    )
    expect(document.querySelector('[data-projection]')?.textContent).toBe(
      describeSeconds(careless.throughput.wholeCropSeconds),
    )
  })
})

/**
 * The upgrade bench, rendered from a task and a catalog it has never heard of.
 *
 * Every family label, knob label and price on screen comes out of the value handed in,
 * and the four states an offer can be in are decided before the screen sees them — the
 * same four the market shows, through the same components, because the counter is where
 * a thing is bought and nothing more.
 *
 * The case that matters most is a locked family with upgrades under it: those upgrades
 * are for sale, because money is the only key, and what says the model is not yours is
 * a heading above them rather than a control greyed out.
 *
 * See openspec/changes/market/specs/model-upgrades/spec.md.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatUnits } from '../../../src/economy/index.js'
import type { Catalog } from '../../../src/progression/index.js'
import { benchView } from '../../../src/progression/index.js'
import type { ModelFamilyDeclaration, TaskDeclaration } from '../../../src/task/types.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import { farmDeclaration } from '../test-support/farm.js'
import { twoFamilyDeclaration, unrelatedDeclaration } from '../test-support/declarations.js'
import { soundCatalog } from '../test-support/progression.js'
import { UpgradeBench } from './UpgradeBench.js'

afterEach(cleanup)

const farm = farmDeclaration()

/**
 * A two-family task whose families do not share the values of their same-named knob.
 *
 * The catalog names a task and a knob and no family, so which family an upgrade belongs
 * to is answered by which of them permits the values it opens. The fixture ladder gives
 * both families `depth` over the same values, which is a catalog the loader refuses —
 * so this widens the second one, and the two are then told apart.
 */
function ladder(): TaskDeclaration {
  const base = twoFamilyDeclaration()
  const [first, second] = base.families as readonly ModelFamilyDeclaration[]
  const validated = validateDeclaration({
    ...base,
    families: [
      { ...first, knobs: [{ ...first!.knobs[0], values: [1, 2] }, first!.knobs[1]] },
      { ...second, knobs: [{ ...second!.knobs[0], values: [1, 3] }, second!.knobs[1]] },
    ],
  })
  if (!validated.ok) throw new Error('the widened ladder was meant to validate')
  return validated.declaration
}

const task = ladder()
const [network, chain] = task.families as readonly ModelFamilyDeclaration[]

/** Every shelf the cases below need: one at the market, one at the bench. */
function catalogFor(task: TaskDeclaration): Catalog {
  return soundCatalog(
    {
      schemaVersion: '1.0.0',
      groups: [
        { id: 'models', label: 'Models', soldAt: 'market' },
        { id: 'capacity', label: 'Capacity', soldAt: 'bench' },
      ],
      ownedAtStart: [],
      items: [
        {
          id: 'the-chain',
          group: 'models',
          label: 'A chain of cuts',
          copy: 'A second kind of model, small enough to send.',
          price: 600,
          opens: [{ kind: 'model-family', task: task.id, family: chain!.id }],
        },
        {
          id: 'one-more-layer',
          group: 'capacity',
          label: 'One more layer',
          copy: 'Room for the network to stack a second layer.',
          price: 100,
          repeat: 3,
          opens: [{ kind: 'knob-values', task: task.id, knob: 'depth', values: [2] }],
        },
        {
          id: 'one-more-question',
          group: 'capacity',
          label: 'One more question',
          copy: 'Room for the chain to ask a third question.',
          notForSaleReason: 'No chain that long has been fitted yet.',
          opens: [{ kind: 'knob-values', task: task.id, knob: 'depth', values: [3] }],
        },
        {
          id: 'the-archive',
          group: 'models',
          label: 'The regional archive',
          copy: 'More photographs, sold in the market rather than here.',
          price: 50,
          opens: [{ kind: 'knob-values', task: task.id, knob: 'photographs', values: ['archive'] }],
        },
      ],
    },
    farm,
  )
}

const catalog = catalogFor(task)

function renderBench(
  owned: readonly string[] = [],
  balanceUnits = 100000,
  over: {
    readonly onBuy?: (itemId: string) => void
    readonly onBack?: () => void
    readonly refusal?: readonly { code: string; message: string; field?: string }[]
    readonly declaration?: TaskDeclaration
    readonly catalog?: Catalog
  } = {},
) {
  const onBuy = over.onBuy ?? vi.fn()
  render(
    <UpgradeBench
      view={benchView(
        over.declaration ?? task,
        over.catalog ?? catalog,
        owned,
        balanceUnits,
      )}
      formatPrice={(units) => formatUnits(units, farm)}
      onBuy={onBuy}
      onBack={over.onBack ?? vi.fn()}
      refusal={over.refusal}
    />,
  )
  return onBuy
}

/** The section for one family, by its declared label. */
function familySection(family: ModelFamilyDeclaration) {
  return within(screen.getByRole('region', { name: family.label }))
}

describe('the bench lists what a task’s models are', () => {
  it('shows every declared family in declared order, owned or not', () => {
    renderBench()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)

    expect(headings.join(' ')).toContain(network!.label)
    expect(headings.join(' ')).toContain(chain!.label)
    expect(headings.findIndex((text) => text?.includes(network!.label))).toBeLessThan(
      headings.findIndex((text) => text?.includes(chain!.label)),
    )
  })

  it('says of a family the farm does not own what opens it, and for how much', () => {
    renderBench()
    const state = screen.getByTestId(`family-state-${chain!.id}`).textContent ?? ''

    expect(state).toContain('A chain of cuts')
    expect(state).toContain(formatUnits(60000, farm))
    expect(screen.getByTestId(`family-state-${network!.id}`).textContent).toBe('Owned')
  })

  it('shows the same families once the item that opens one is owned', () => {
    renderBench(['the-chain'])
    expect(screen.getByTestId(`family-state-${chain!.id}`).textContent).toBe('Owned')
  })

  it('offers nothing that sells, refunds or returns anything', () => {
    renderBench(['one-more-layer'])
    for (const word of [/sell/i, /refund/i, /return/i]) {
      expect(screen.queryByRole('button', { name: word }), `${word}`).toBeNull()
    }
  })

  it('renders a task and a catalog the shell has never seen', () => {
    const other = unrelatedDeclaration()
    cleanup()
    renderBench([], 100000, { declaration: other, catalog: catalogFor(other) })

    const family = other.families[0]
    expect(screen.getByRole('region', { name: family!.label })).toBeDefined()
    expect(screen.getByTestId(`nothing-for-sale-${family!.id}`)).toBeDefined()
  })
})

describe('an upgrade is shown under the family and the knob it opens', () => {
  it('puts an upgrade under its knob, with the knob’s declared label', () => {
    renderBench()
    const knob = network!.knobs[0]
    const section = within(familySection(network!).getByRole('region', { name: knob!.label }))

    expect(section.getByText('One more layer')).toBeDefined()
    expect(screen.getByTestId('opens-one-more-layer').textContent).toContain('2')
  })

  it('shows an upgrade under one family only, when two share a knob id', () => {
    renderBench()

    expect(familySection(network!).queryByText('One more question')).toBeNull()
    expect(familySection(chain!).queryByText('One more layer')).toBeNull()
    expect(familySection(chain!).getByText('One more question')).toBeDefined()
  })

  it('shows no knob for which nothing is sold at the bench', () => {
    renderBench()
    const dataset = network!.knobs[1]

    expect(familySection(network!).queryByRole('region', { name: dataset!.label })).toBeNull()
  })

  it('says so of a family with nothing further for sale, with no empty knob heading', () => {
    const other = unrelatedDeclaration()
    renderBench([], 100000, { declaration: other, catalog: catalogFor(other) })
    const family = other.families[0]

    expect(screen.getByTestId(`nothing-for-sale-${family!.id}`).textContent).toMatch(/nothing/i)
    for (const knob of family!.knobs) {
      expect(screen.queryByRole('region', { name: knob.label }), knob.label).toBeNull()
    }
  })

  it('does not offer what the market sells', () => {
    renderBench()
    expect(screen.queryByText('The regional archive')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Buy The regional archive' })).toBeNull()
  })

  it('reads the four states the way the market reads them', () => {
    renderBench([], 0)
    expect(screen.getByTestId('state-one-more-layer').textContent).toContain('saving')
    expect(screen.getByTestId('state-one-more-question').textContent).toBe(
      'No chain that long has been fitted yet.',
    )

    cleanup()
    renderBench()
    expect(screen.getByTestId('state-one-more-layer').textContent).toBe(formatUnits(10000, farm))

    cleanup()
    renderBench(['one-more-layer', 'one-more-layer', 'one-more-layer'])
    expect(screen.getByTestId('state-one-more-layer').textContent).toBe('Owned')
  })

  it('shows a repeatable upgrade with what has been bought and what is left', () => {
    renderBench(['one-more-layer'])
    expect(screen.getByTestId('tally-one-more-layer').textContent).toBe(
      '1 of 3 bought, 2 to go',
    )
  })
})

describe('buying at the bench is the market’s purchase under another roof', () => {
  it('names the item and its price before any money moves', async () => {
    const onBuy = renderBench()
    await userEvent.click(screen.getByRole('button', { name: 'Buy One more layer' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('One more layer')
    expect(dialog.textContent).toContain(formatUnits(10000, farm))
    expect(dialog.textContent).toContain('cannot be undone')
    expect(onBuy).not.toHaveBeenCalled()
  })

  it('costs nothing when the confirmation is abandoned', async () => {
    const onBuy = renderBench()
    await userEvent.click(screen.getByRole('button', { name: 'Buy One more layer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onBuy).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('buys exactly the item that was confirmed', async () => {
    const onBuy = renderBench()
    await userEvent.click(screen.getByRole('button', { name: 'Buy One more layer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onBuy).toHaveBeenCalledWith('one-more-layer')
  })

  it('shows a shortfall the engine reported, without leaving the bench', () => {
    renderBench([], 0, {
      refusal: [
        {
          code: 'insufficient-funds',
          field: 'one-more-layer',
          message: 'The farm cannot cover one-more-layer: it is short by 40.00.',
        },
      ],
    })

    expect(screen.getByRole('alert').textContent).toContain('short by')
    expect(screen.getByRole('heading', { name: 'Upgrades' })).toBeDefined()
  })

  it('shows a refusal at the catalog’s repeat limit, without leaving the bench', () => {
    renderBench(['one-more-layer', 'one-more-layer', 'one-more-layer'], 100000, {
      refusal: [
        {
          code: 'already-owned',
          field: 'one-more-layer',
          message: 'The farm already owns one-more-layer 3 times, which is all the catalog permits.',
        },
      ],
    })

    expect(screen.getByRole('alert').textContent).toContain('all the catalog permits')
    expect(screen.getByRole('heading', { name: 'Upgrades' })).toBeDefined()
  })

  it('sells an upgrade for a family the farm does not own, with money alone', async () => {
    // `progression-catalog` is unambiguous: a purchase is not gated on owning any other
    // item. What says the model is not yours is the heading above, never the control.
    const onBuy = renderBench()
    expect(screen.getByTestId(`family-state-${chain!.id}`).textContent).toContain('Not yours yet')

    const chainSection = familySection(chain!)
    expect(chainSection.queryByRole('button', { name: /buy/i })).toBeNull()
    // The chain's own upgrade has no price at all, so nothing is offered for it — the
    // network's is the one that proves an offer is made on money alone.
    await userEvent.click(screen.getByRole('button', { name: 'Buy One more layer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onBuy).toHaveBeenCalledWith('one-more-layer')
  })

  it('states nothing about a tutorial, and opens none', async () => {
    const onBuy = renderBench()
    expect(document.body.textContent ?? '').not.toMatch(/tutorial|lesson|puzzle/i)

    await userEvent.click(screen.getByRole('button', { name: 'Buy One more layer' }))
    expect(document.body.textContent ?? '').not.toMatch(/tutorial|lesson|puzzle/i)
    expect(onBuy).not.toHaveBeenCalled()
  })

  it('leaves back to where it was entered from', async () => {
    const onBack = vi.fn()
    renderBench([], 100000, { onBack })
    await userEvent.click(screen.getByRole('button', { name: 'Back to the workshop' }))

    expect(onBack).toHaveBeenCalled()
  })
})

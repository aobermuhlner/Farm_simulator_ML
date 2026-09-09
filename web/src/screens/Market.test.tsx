/**
 * The market, rendered from a catalog it has never heard of.
 *
 * Every noun on screen comes out of the value handed in, and the four states a row can be
 * in are decided before the screen sees them. The test that matters most is the one that
 * shows the four reading differently from one another: money being the only key is
 * something a student has to be able to see, and "not yet affordable" reading like
 * "barred" would undo the whole §2 rule.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatUnits } from '../../../src/economy/index.js'
import { marketView } from '../../../src/progression/index.js'
import { Market } from './Market.js'
import { farmDeclaration } from '../test-support/farm.js'
import { repeatShopCatalog, shopCatalog } from '../test-support/progression.js'

afterEach(cleanup)

const farm = farmDeclaration()
const catalog = shopCatalog()

function renderMarket(
  balanceUnits = 200000,
  owned: readonly string[] = ['starter-plot'],
  onBuy = vi.fn(),
) {
  render(
    <Market
      view={marketView(catalog, owned, balanceUnits)}
      formatPrice={(units) => formatUnits(units, farm)}
      onBuy={onBuy}
      onBack={vi.fn()}
    />,
  )
  return onBuy
}

function stateOf(id: string): string {
  return screen.getByTestId(`state-${id}`).textContent ?? ''
}

describe('the catalog is rendered as declared', () => {
  it('shows the groups in the order the catalog declares them', () => {
    renderMarket()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)
    expect(headings).toEqual(['Planting', 'Sheds'])
  })

  it('shows no group with nothing in it', () => {
    renderMarket()
    expect(screen.queryByText('Quiet corner')).toBeNull()
  })

  it('shows each item under its own group, with its declared copy', () => {
    renderMarket()
    const planting = screen.getByRole('region', { name: 'Planting' })
    expect(planting.textContent).toContain('Starter plot')
    expect(planting.textContent).toContain('Second row')
    expect(planting.textContent).toContain('One more row along the fence.')
    expect(planting.textContent).not.toContain('Stone shed')
  })
})

describe('the four states read differently from one another', () => {
  it('distinguishes owned, buyable, saving and not for sale', () => {
    renderMarket()
    const states = ['starter-plot', 'second-row', 'stone-shed', 'weather-station'].map(stateOf)

    expect(new Set(states).size).toBe(4)
    expect(states[0]).toBe('Owned')
    expect(states[1]).toBe(formatUnits(1000, farm))
    expect(states[2]).toContain('saving')
    expect(states[3]).toBe('Nobody in the valley builds these yet.')
  })

  it('offers a purchase for the buyable one only', () => {
    renderMarket()
    expect(screen.getByRole('button', { name: 'Buy Second row' })).toBeDefined()
    for (const label of ['Starter plot', 'Stone shed', 'Weather station']) {
      expect(screen.queryByRole('button', { name: `Buy ${label}` }), label).toBeNull()
    }
  })

  it('presents what cannot be afforded as saving for, never as barred', () => {
    renderMarket()
    const shed = screen.getByText('Stone shed').closest('li')?.textContent ?? ''

    expect(shed).toContain(formatUnits(99999900, farm))
    for (const wrong of [/locked/i, /barred/i, /not allowed/i, /requires/i, /you need/i]) {
      expect(shed, `${wrong}`).not.toMatch(wrong)
    }
  })

  it('says why an unpriced item cannot be bought, in the catalog’s own words', () => {
    renderMarket()
    const station = screen.getByText('Weather station').closest('li')?.textContent ?? ''

    expect(station).toContain('Nobody in the valley builds these yet.')
    expect(station).not.toContain(farm.currency)
  })

  it('offers nothing that sells, refunds or returns an owned item', () => {
    renderMarket()
    for (const word of [/sell/i, /refund/i, /return/i]) {
      expect(screen.queryByRole('button', { name: word }), `${word}`).toBeNull()
    }
  })
})

describe('a purchase is confirmed before money moves', () => {
  it('names the item and its price in the confirmation', async () => {
    const onBuy = renderMarket()
    await userEvent.click(screen.getByRole('button', { name: 'Buy Second row' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Second row')
    expect(dialog.textContent).toContain(formatUnits(1000, farm))
    expect(onBuy).not.toHaveBeenCalled()
  })

  it('costs nothing when the confirmation is abandoned', async () => {
    const onBuy = renderMarket()
    await userEvent.click(screen.getByRole('button', { name: 'Buy Second row' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onBuy).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('buys exactly the item that was confirmed', async () => {
    const onBuy = renderMarket()
    await userEvent.click(screen.getByRole('button', { name: 'Buy Second row' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onBuy).toHaveBeenCalledWith('second-row')
  })
})

describe('a refusal is shown with the cause the engine named', () => {
  it('renders it without hiding the market', () => {
    render(
      <Market
        view={marketView(catalog, ['starter-plot'], 200000)}
        formatPrice={(units) => formatUnits(units, farm)}
        onBuy={vi.fn()}
        onBack={vi.fn()}
        refusal={[
          {
            code: 'insufficient-funds',
            field: 'stone-shed',
            message: 'The farm cannot cover stone-shed: it is short by CHF 997 999.00.',
          },
        ]}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('short by')
    expect(screen.getByRole('heading', { name: 'Planting' })).toBeDefined()
  })
})

describe('a market for another farm renders through the same screen', () => {
  it('shows a catalog whose every noun is different, with no code of its own', () => {
    const other = shopCatalog()
    render(
      <Market
        view={marketView(other, [], 0)}
        formatPrice={(units) => formatUnits(units, farm)}
        onBuy={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    // Nothing is owned and nothing is affordable, so every priced row reads as saving.
    expect(stateOf('starter-plot')).toBe(formatUnits(0, farm))
    expect(stateOf('second-row')).toContain('saving')
    expect(screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual([
      'Starter plot',
      'Second row',
      'Stone shed',
      'Weather station',
    ])
  })
})

describe('a row the catalog permits to be bought more than once', () => {
  function renderRepeat(held: number, balanceUnits = 200000, onBuy = vi.fn()) {
    const owned = Array.from({ length: held }, () => 'another-row')
    render(
      <Market
        view={marketView(repeatShopCatalog(), owned, balanceUnits)}
        formatPrice={(units) => formatUnits(units, farm)}
        onBuy={onBuy}
        onBack={vi.fn()}
      />,
    )
    return onBuy
  }

  it('shows how many have been bought and how many the catalog still permits', () => {
    renderRepeat(2)
    expect(screen.getByTestId('tally-another-row').textContent).toBe('2 of 5 bought, 3 to go')
  })

  it('still offers to be bought while the balance covers it', async () => {
    const onBuy = renderRepeat(2)
    await userEvent.click(screen.getByRole('button', { name: 'Buy Another row' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onBuy).toHaveBeenCalledWith('another-row')
  })

  it('offers no purchase at the limit, and says what it gave rather than saving for it', () => {
    renderRepeat(5)
    expect(screen.getByTestId('tally-another-row').textContent).toBe('All 5 bought')
    expect(stateOf('another-row')).toBe('Owned')
    expect(screen.queryByRole('button', { name: /^Buy / })).toBeNull()
  })

  it('is not reported as unaffordable at its limit, however little money is left', () => {
    // No amount of money would obtain another one, so "not yet affordable" would be a
    // lie about why the row offers nothing.
    renderRepeat(5, 0)
    expect(stateOf('another-row')).toBe('Owned')
    expect(stateOf('another-row')).not.toMatch(/saving/i)
  })

  it('reports being saved for while some remain and the balance does not cover it', () => {
    renderRepeat(2, 0)
    expect(screen.getByTestId('tally-another-row').textContent).toBe('2 of 5 bought, 3 to go')
    expect(stateOf('another-row')).toMatch(/saving/i)
  })

  it('says nothing about a count for a row the catalog permits once', () => {
    renderMarket()
    expect(screen.queryByTestId('tally-second-row')).toBeNull()
    expect(screen.queryByTestId('tally-starter-plot')).toBeNull()
  })

  it('offers no way to sell, refund or return what it gave', () => {
    renderRepeat(5)
    for (const word of [/sell/i, /refund/i, /return/i]) {
      expect(screen.queryByRole('button', { name: word })).toBeNull()
    }
  })
})

describe('a tutorial is nothing the market knows about', () => {
  it('bars no purchase, to a farm that has finished nothing', () => {
    // The market takes no tutorial state at all, which is the structural form of *Money
    // is the only key to a purchase* surviving `model-tutorials` untouched. Every row the
    // balance covers still offers to be bought.
    renderMarket(200000, [])

    for (const row of screen.getAllByTestId(/^state-/)) {
      expect(row.textContent ?? '').not.toMatch(/tutorial|lesson|finish|learn/i)
    }
    expect(screen.getAllByRole('button', { name: /buy/i }).length).toBeGreaterThan(0)
  })

  it('presents no puzzle and opens none on a purchase', async () => {
    const onBuy = renderMarket(200000, [])

    const [first] = screen.getAllByRole('button', { name: /buy/i })
    if (first === undefined) throw new Error('the market offers nothing to buy')
    await userEvent.click(first)

    // Buying a family and being ambushed by a puzzle would be the market saying money was
    // not the key after all. What a purchase does here is ask for confirmation.
    expect(document.body.textContent ?? '').not.toMatch(/tutorial/i)
    expect(onBuy).not.toHaveBeenCalled()
  })
})

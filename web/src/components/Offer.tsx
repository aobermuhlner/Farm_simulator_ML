/**
 * One thing for sale, and the confirmation that buys it.
 *
 * Shared by the market and the workshop's upgrade bench, because the counter is where a
 * thing is bought and nothing more: two components would be two places for the four
 * states to drift, and for one counter to grow a wording the other does not have.
 *
 * Which of the four states an item is in is decided by the engine, not here. A screen
 * that worked it out itself could present "you cannot afford this" as "you are not
 * allowed this", and money being the only key is exactly what a counter has to show.
 *
 * Nothing offers to sell, refund or return anything, at either counter.
 */

import type { MarketItem } from '../../../src/progression/index.js'

export interface OfferProps {
  readonly entry: MarketItem
  /** Presents a price in the farm's declared currency. */
  readonly formatPrice: (units: number) => string
  /** Begins a purchase. The confirmation is what buys it. */
  readonly onBuy: (entry: MarketItem) => void
  /** Extra lines under the copy — the values an upgrade opens, where a counter has any. */
  readonly children?: React.ReactNode
}

/**
 * How much of a repeatable item has been bought and how much is left, or nothing at all
 * for an item the catalog permits once.
 *
 * Shown so a student can see what is left to earn towards rather than discovering the
 * limit by reaching it. An item at its limit says what it gave; it is never presented as
 * unaffordable, because no amount of money would obtain another one.
 */
export function tallyNote(entry: MarketItem): string | undefined {
  if (entry.limit === 1) return undefined
  if (entry.remaining === 0) return `All ${entry.limit} bought`
  return `${entry.held} of ${entry.limit} bought, ${entry.remaining} to go`
}

/** What an item's state says about it, in words the catalog does not supply. */
export function stateNote(entry: MarketItem, formatPrice: (units: number) => string): string {
  if (entry.state === 'owned') return 'Owned'
  if (entry.state === 'not-for-sale') return entry.item.notForSaleReason ?? 'Not for sale yet'
  const price = entry.item.priceUnits === undefined ? '' : formatPrice(entry.item.priceUnits)
  return entry.state === 'buyable' ? price : `${price} — saving for it`
}

export function Offer({ entry, formatPrice, onBuy, children }: OfferProps) {
  return (
    <li className={`market-item ${entry.state}`}>
      <h4>{entry.item.label}</h4>
      <p className="shop-copy">{entry.item.copy}</p>
      {children}
      {tallyNote(entry) === undefined ? null : (
        <p className="market-tally" data-testid={`tally-${entry.item.id}`}>
          {tallyNote(entry)}
        </p>
      )}
      <p className="market-state" data-testid={`state-${entry.item.id}`}>
        {stateNote(entry, formatPrice)}
      </p>
      {entry.state === 'buyable' ? (
        <button type="button" onClick={() => onBuy(entry)}>
          Buy {entry.item.label}
        </button>
      ) : null}
    </li>
  )
}

export interface ConfirmPurchaseProps {
  readonly entry: MarketItem
  readonly formatPrice: (units: number) => string
  readonly onConfirm: (itemId: string) => void
  readonly onCancel: () => void
}

/**
 * The one gate money passes through, at either counter.
 *
 * The item and its price are named before anything moves, and abandoning it costs
 * nothing — so a purchase is always something a student chose twice.
 */
export function ConfirmPurchase({
  entry,
  formatPrice,
  onConfirm,
  onCancel,
}: ConfirmPurchaseProps) {
  return (
    <section className="confirm" role="dialog" aria-label="Confirm this purchase">
      <p>
        {`Buy ${entry.item.label} for ${
          entry.item.priceUnits === undefined ? '' : formatPrice(entry.item.priceUnits)
        }? This cannot be undone.`}
      </p>
      <button type="button" onClick={() => onConfirm(entry.item.id)}>
        Confirm
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </section>
  )
}

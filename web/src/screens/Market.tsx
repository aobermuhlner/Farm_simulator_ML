/**
 * The market: everything the farm can buy, rendered from the declared catalog.
 *
 * Nothing here knows what any of it is. The groups, their order, the items under them,
 * their copy and their prices are all read from the value handed in, so a market for an
 * entirely different farm renders through this same screen.
 *
 * Which of the four states an item is in is decided by the engine, not here. A screen
 * that worked it out itself could present "you cannot afford this" as "you are not
 * allowed this", and money being the only key is exactly what the market has to show.
 *
 * A purchase is confirmed before any money moves, with the item and its price named, and
 * the result is shown in place — a student never leaves the market to find out what
 * happened.
 */

import { useState } from 'react'
import type { MarketItem, MarketView } from '../../../src/progression/index.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { Issues } from '../components/Issues.js'

export interface MarketProps {
  readonly view: MarketView
  /** Presents a price in the farm's declared currency. */
  readonly formatPrice: (units: number) => string
  readonly onBuy: (itemId: string) => void
  readonly onBack: () => void
  /** Why the last purchase did not happen, as the engine reported it. */
  readonly refusal?: readonly ValidationIssue[]
}

/** What an item's state says about it, in words the catalog does not supply. */
function stateNote(entry: MarketItem, formatPrice: (units: number) => string): string {
  if (entry.state === 'owned') return 'Owned'
  if (entry.state === 'not-for-sale') return entry.item.notForSaleReason ?? 'Not for sale yet'
  const price = entry.item.priceUnits === undefined ? '' : formatPrice(entry.item.priceUnits)
  return entry.state === 'buyable' ? price : `${price} — saving for it`
}

export function Market({ view, formatPrice, onBuy, onBack, refusal }: MarketProps) {
  const [confirming, setConfirming] = useState<MarketItem | undefined>(undefined)

  return (
    <section aria-labelledby="market-heading">
      <button type="button" onClick={onBack}>
        Back to the farm
      </button>

      <h1 id="market-heading">The market</h1>

      {refusal === undefined || refusal.length === 0 ? null : (
        <Issues title="That purchase did not happen" issues={refusal} />
      )}

      {view.groups.map((group) => (
        <section key={group.group.id} className="market-group" aria-label={group.group.label}>
          <h2>{group.group.label}</h2>
          <ul className="market-items">
            {group.items.map((entry) => (
              <li key={entry.item.id} className={`market-item ${entry.state}`}>
                <h3>{entry.item.label}</h3>
                <p className="shop-copy">{entry.item.copy}</p>
                <p className="market-state" data-testid={`state-${entry.item.id}`}>
                  {stateNote(entry, formatPrice)}
                </p>
                {entry.state === 'buyable' ? (
                  <button type="button" onClick={() => setConfirming(entry)}>
                    Buy {entry.item.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {confirming === undefined ? null : (
        <section className="confirm" role="dialog" aria-label="Confirm this purchase">
          <p>
            {`Buy ${confirming.item.label} for ${
              confirming.item.priceUnits === undefined
                ? ''
                : formatPrice(confirming.item.priceUnits)
            }? This cannot be undone.`}
          </p>
          <button
            type="button"
            onClick={() => {
              const bought = confirming.item.id
              setConfirming(undefined)
              onBuy(bought)
            }}
          >
            Confirm
          </button>
          <button type="button" onClick={() => setConfirming(undefined)}>
            Cancel
          </button>
        </section>
      )}
    </section>
  )
}

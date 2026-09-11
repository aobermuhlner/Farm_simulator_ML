/**
 * The market: everything the farm buys away from the workshop, from the declared catalog.
 *
 * Nothing here knows what any of it is. The sections, the shelves under them, their
 * order, the items, their copy and their prices are all read from the value handed in,
 * so a market for an entirely different farm renders through this same screen — and a
 * second part of the farm appears with no change here at all, because a section heading
 * is a task's own declared title and never a word written down twice.
 *
 * Which of the four states an item is in is decided by the engine, not here, and the
 * offer and its confirmation are the shared ones the upgrade bench also uses: the
 * counter is where a thing is bought and nothing more.
 *
 * A purchase is confirmed before any money moves, with the item and its price named, and
 * the result is shown in place — a student never leaves the market to find out what
 * happened.
 */

import { useState } from 'react'
import type { MarketItem, MarketView } from '../../../src/progression/index.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { ConfirmPurchase, Offer } from '../components/Offer.js'
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

      {view.sections.map((section) => (
        <section
          key={section.taskId ?? ''}
          className="market-section"
          aria-label={section.title}
          data-section={section.taskId ?? ''}
        >
          <h2>{section.title}</h2>
          {section.groups.map((group) => (
            <section key={group.group.id} className="market-group" aria-label={group.group.label}>
              <h3>{group.group.label}</h3>
              <ul className="market-items">
                {group.items.map((entry) => (
                  <Offer
                    key={entry.item.id}
                    entry={entry}
                    formatPrice={formatPrice}
                    onBuy={setConfirming}
                  />
                ))}
              </ul>
            </section>
          ))}
        </section>
      ))}

      {confirming === undefined ? null : (
        <ConfirmPurchase
          entry={confirming}
          formatPrice={formatPrice}
          onConfirm={(itemId) => {
            setConfirming(undefined)
            onBuy(itemId)
          }}
          onCancel={() => setConfirming(undefined)}
        />
      )}
    </section>
  )
}

/**
 * The upgrade bench: a stage of the workshop where capacity is bought.
 *
 * Sold here rather than in the market because a capacity item means nothing on its own —
 * each opens values of one knob of one model, and a student reads a price against the
 * dial it moves. *This dial does not go past two yet, and here is what going past two
 * costs* is a sentence that can only be written where the dials are.
 *
 * Every family the task declares is listed, owned or not: a bench tied to what is
 * selected could never show the thing it exists to sell. A family a student does not own
 * is listed with the item that opens it and that item's price, and its upgrades are
 * still for sale — money is the only key at this counter exactly as it is at the other.
 *
 * Nothing here knows what any of it is. Family labels, knob labels, item copy and prices
 * all come from the value handed in, and the offer and its confirmation are the market's
 * own components.
 */

import { useState } from 'react'
import type { BenchView, MarketItem } from '../../../src/progression/index.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { ConfirmPurchase, Offer } from '../components/Offer.js'
import { Issues } from '../components/Issues.js'

export interface UpgradeBenchProps {
  readonly view: BenchView
  /** Presents a price in the farm's declared currency. */
  readonly formatPrice: (units: number) => string
  readonly onBuy: (itemId: string) => void
  readonly onBack: () => void
  /** Why the last purchase did not happen, as the engine reported it. */
  readonly refusal?: readonly ValidationIssue[]
}

/** The values one item opens, read out of what it declares it opens. */
function opened(entry: MarketItem, taskId: string, knobId: string): readonly (string | number)[] {
  return entry.item.opens.flatMap((unlock) =>
    unlock.kind === 'knob-values' && unlock.task === taskId && unlock.knob === knobId
      ? [...unlock.values]
      : [],
  )
}

export function UpgradeBench({ view, formatPrice, onBuy, onBack, refusal }: UpgradeBenchProps) {
  const [confirming, setConfirming] = useState<MarketItem | undefined>(undefined)

  return (
    <section aria-labelledby="bench-heading" className="upgrade-bench">
      <button type="button" onClick={onBack}>
        Back to the workshop
      </button>

      <h2 id="bench-heading">Upgrades</h2>

      {refusal === undefined || refusal.length === 0 ? null : (
        <Issues title="That purchase did not happen" issues={refusal} />
      )}

      {view.families.map((entry) => (
        <section
          key={entry.family.id}
          className={entry.available ? 'bench-family' : 'bench-family locked'}
          aria-label={entry.family.label}
        >
          <h3>
            <span aria-hidden="true">{entry.family.slot.icon}</span> {entry.family.label}
          </h3>

          {/*
            The family's own state sits above its upgrades, so a price for a dial of a
            model the student does not own is read under a heading that says as much.
            Greying the upgrades out instead would be the shop saying "you are not
            allowed this", which it has promised never to say.
          */}
          <p className="bench-family-state" data-testid={`family-state-${entry.family.id}`}>
            {entry.available
              ? 'Owned'
              : entry.openedBy === undefined
                ? 'Not yours yet'
                : `Not yours yet — opened by ${entry.openedBy.label}${
                    entry.openedBy.priceUnits === undefined
                      ? ''
                      : `, ${formatPrice(entry.openedBy.priceUnits)}`
                  }`}
          </p>

          {entry.knobs.length === 0 ? (
            <p className="bench-empty" data-testid={`nothing-for-sale-${entry.family.id}`}>
              Nothing further is for sale for this one.
            </p>
          ) : (
            entry.knobs.map((knob) => (
              <section key={knob.knob.id} className="bench-knob" aria-label={knob.knob.label}>
                <h4>{knob.knob.label}</h4>
                <ul className="market-items">
                  {knob.items.map((item) => (
                    <Offer
                      key={item.item.id}
                      entry={item}
                      formatPrice={formatPrice}
                      onBuy={setConfirming}
                    >
                      <p className="bench-opens" data-testid={`opens-${item.item.id}`}>
                        {`Opens ${opened(item, view.taskId, knob.knob.id)
                          .map((value) => String(value))
                          .join(', ')}`}
                      </p>
                    </Offer>
                  ))}
                </ul>
              </section>
            ))
          )}
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

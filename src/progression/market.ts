/**
 * What the market shows, decided here rather than on the screen.
 *
 * The four states an item can be in — owned, buyable now, not yet affordable, not for
 * sale — are a fact about the catalog and the balance, so they are computed once and
 * handed over. A screen that worked them out itself would be a screen that could invent
 * a fifth, or present "you cannot afford this" as "you are not allowed this", which is
 * exactly the distinction §2 turns on: money is the only key, and `saving` means you
 * cannot afford it, never that it is barred.
 *
 * Groups come out in the order the catalog declares them, and a group with no items comes
 * out not at all — an empty section is a promise the market cannot keep.
 */

import type { Catalog, CatalogItem, GroupDeclaration } from './catalog.js'
import { repeatLimit } from './catalog.js'
import { countOwned } from './purchase.js'

/**
 * `owned` — bought as many times as the catalog permits, or owned from the start.
 * `buyable` — priced, permitted again, and the balance covers it.
 * `saving` — priced, permitted again, and the balance does not cover it yet. Not barred.
 * `not-for-sale` — declares no price, and says why.
 *
 * An item at its limit is `owned` rather than `saving`, because no amount of money would
 * obtain another one and "not yet affordable" would be a lie about why it offers nothing.
 */
export type MarketItemState = 'owned' | 'buyable' | 'saving' | 'not-for-sale'

export interface MarketItem {
  readonly item: CatalogItem
  readonly state: MarketItemState
  /** How many times it has been bought. */
  readonly held: number
  /** How many times the catalog still permits it to be bought. */
  readonly remaining: number
  /** How many times the catalog permits it to be bought in all. */
  readonly limit: number
}

export interface MarketGroup {
  readonly group: GroupDeclaration
  readonly items: readonly MarketItem[]
}

export interface MarketView {
  readonly groups: readonly MarketGroup[]
}

/** One item as the market shows it, given what is owned and what the farm holds. */
function viewOf(item: CatalogItem, owned: readonly string[], balanceUnits: number): MarketItem {
  const limit = repeatLimit(item)
  const held = countOwned(owned, item.id)
  const remaining = Math.max(0, limit - held)
  const state: MarketItemState =
    remaining === 0
      ? 'owned'
      : item.priceUnits === undefined
        ? 'not-for-sale'
        : item.priceUnits <= balanceUnits
          ? 'buyable'
          : 'saving'
  return { item, state, held, remaining, limit }
}

/** The market as it stands, for a farm holding `balanceUnits` and owning `owned`. */
export function marketView(
  catalog: Catalog,
  owned: readonly string[],
  balanceUnits: number,
): MarketView {
  return {
    groups: catalog.groups
      .map((group) => ({
        group,
        items: catalog.items
          .filter((item) => item.group === group.id)
          .map((item) => viewOf(item, owned, balanceUnits)),
      }))
      .filter((entry) => entry.items.length > 0),
  }
}

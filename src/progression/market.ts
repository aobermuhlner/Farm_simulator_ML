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

/**
 * `owned` — already bought or owned from the start.
 * `buyable` — priced, and the balance covers it.
 * `saving` — priced, and the balance does not cover it yet. Not barred.
 * `not-for-sale` — declares no price, and says why.
 */
export type MarketItemState = 'owned' | 'buyable' | 'saving' | 'not-for-sale'

export interface MarketItem {
  readonly item: CatalogItem
  readonly state: MarketItemState
}

export interface MarketGroup {
  readonly group: GroupDeclaration
  readonly items: readonly MarketItem[]
}

export interface MarketView {
  readonly groups: readonly MarketGroup[]
}

/** The state one item is in, given what is owned and what the farm holds. */
function stateOf(
  item: CatalogItem,
  owned: readonly string[],
  balanceUnits: number,
): MarketItemState {
  if (owned.includes(item.id)) return 'owned'
  if (item.priceUnits === undefined) return 'not-for-sale'
  return item.priceUnits <= balanceUnits ? 'buyable' : 'saving'
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
          .map((item) => ({ item, state: stateOf(item, owned, balanceUnits) })),
      }))
      .filter((entry) => entry.items.length > 0),
  }
}

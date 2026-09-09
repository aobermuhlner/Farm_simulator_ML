/**
 * Buying one item.
 *
 * Everything about money is `game-economy`'s: this reaches for `debit`, and the
 * insufficient-funds refusal it returns is passed through unchanged so the shortfall the
 * economy named is the shortfall the screen shows. Nothing here recomputes it.
 *
 * There is deliberately no way back. No sell, no refund, no un-own — a purchase is a
 * decision a student lives with, which is what makes the money loop a progression system
 * rather than a menu. The owned list is only ever appended to, literally: an item the
 * catalog permits to be bought more than once appears in it once per purchase, which is
 * why the limit is a count of occurrences rather than a membership test.
 *
 * The reason recorded on the movement is the item's *id*, not its label. A ledger is
 * saved and a label is declared: writing the label into the movement would put a copy of
 * a declaration into the save, where a later rename could make the two disagree with
 * nothing able to say which is right.
 */

import type { Farm } from '../economy/index.js'
import { debit } from '../economy/index.js'
import type { ValidationIssue } from '../task/validate.js'
import type { Catalog } from './catalog.js'
import { itemById, repeatLimit } from './catalog.js'

/** An id the catalog does not declare. */
export const UNKNOWN_ITEM = 'unknown-item'
/** An item bought as many times as the catalog permits it to be. */
export const ALREADY_OWNED = 'already-owned'
/** An item that declares no price, so nothing can buy it. */
export const NOT_FOR_SALE = 'not-for-sale'

/** How many times `id` has been bought. `owned` is a multiset, so this counts, not tests. */
export function countOwned(owned: readonly string[], id: string): number {
  return owned.reduce((count, entry) => (entry === id ? count + 1 : count), 0)
}

export type Purchase =
  | { readonly ok: true; readonly farm: Farm; readonly owned: readonly string[] }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/**
 * Buys `itemId`, returning the farm and the ownership that follow.
 *
 * Refusals are values, not throws: a student who cannot afford something has made no
 * error. Every refusal leaves the balance and the owned list exactly as they were.
 */
export function buyItem(
  catalog: Catalog,
  farm: Farm,
  owned: readonly string[],
  itemId: string,
): Purchase {
  const item = itemById(catalog, itemId)
  if (item === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: UNKNOWN_ITEM,
          field: itemId,
          message: `The catalog declares no item "${itemId}", so there is nothing to buy.`,
        },
      ],
    }
  }

  const limit = repeatLimit(item)
  const held = countOwned(owned, item.id)
  if (held >= limit) {
    return {
      ok: false,
      issues: [
        {
          code: ALREADY_OWNED,
          field: item.id,
          message:
            limit === 1
              ? `"${item.label}" is already owned; buying it again would move money for nothing.`
              : `"${item.label}" has been bought ${held} times and the catalog permits ${limit}; buying it again would move money for nothing.`,
        },
      ],
    }
  }

  if (item.priceUnits === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: NOT_FOR_SALE,
          field: item.id,
          message: `"${item.label}" is not for sale: ${item.notForSaleReason ?? 'it declares no price.'}`,
        },
      ],
    }
  }

  const paid = debit(farm, item.priceUnits, item.id)
  if (!paid.ok) return { ok: false, issues: paid.issues }

  // What a purchase opens is given on every purchase, so growth is applied here rather
  // than derived from the owned list — one place, and no screen ever learns what growth
  // is. The crop the land bears follows by construction, since it is not stored.
  const grown = item.opens.reduce(
    (units, unlock) => (unlock.kind === 'farm-land' ? units + unlock.units : units),
    0,
  )

  return {
    ok: true,
    farm: grown === 0 ? paid.farm : { ...paid.farm, land: paid.farm.land + grown },
    owned: [...owned, item.id],
  }
}

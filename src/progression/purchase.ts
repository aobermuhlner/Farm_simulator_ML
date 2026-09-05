/**
 * Buying one item.
 *
 * Everything about money is `game-economy`'s: this reaches for `debit`, and the
 * insufficient-funds refusal it returns is passed through unchanged so the shortfall the
 * economy named is the shortfall the screen shows. Nothing here recomputes it.
 *
 * There is deliberately no way back. No sell, no refund, no un-own — a purchase is a
 * decision a student lives with, which is what makes the money loop a progression system
 * rather than a menu. The owned list is only ever appended to.
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
import { itemById } from './catalog.js'

/** An id the catalog does not declare. */
export const UNKNOWN_ITEM = 'unknown-item'
/** An item the farm already owns. */
export const ALREADY_OWNED = 'already-owned'
/** An item that declares no price, so nothing can buy it. */
export const NOT_FOR_SALE = 'not-for-sale'

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

  if (owned.includes(item.id)) {
    return {
      ok: false,
      issues: [
        {
          code: ALREADY_OWNED,
          field: item.id,
          message: `"${item.label}" is already owned; buying it again would move money for nothing.`,
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

  return { ok: true, farm: paid.farm, owned: [...owned, item.id] }
}

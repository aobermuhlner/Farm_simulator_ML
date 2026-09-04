/**
 * The farm's money, its year and its ledger.
 *
 * Arithmetic only: no React, no storage, no screen state. Every operation returns a new
 * farm value, so the React side is a `setState` with the result and this module stays
 * testable without a renderer.
 *
 * Two rules that look like one are kept apart on purpose. A debit larger than the
 * balance is *refused* — you cannot buy what you cannot afford, and the refusal names the
 * shortfall so a market screen can say why the button did nothing. A harvest that settles
 * to a loss is not refused: it happened, and it floors the balance at zero with the
 * amount the floor absorbed recorded rather than swallowed.
 *
 * Runtime refusals are result values; programming errors throw. An empty wallet is a
 * legitimate thing for a student to reach, so it comes back as a `ValidationIssue`. A
 * movement with no reason, or an amount that is not a whole unit, is a mistake in the
 * calling code, and throwing keeps the two distinguishable.
 *
 * There is no failure state here, by design: no bankruptcy, no game over. A bad year is
 * a bad year. See openspec/changes/game-economy/specs/game-economy/spec.md.
 */

import type { ValidationIssue } from '../task/validate.js'
import type { FarmDeclaration } from './declaration.js'
import { formatUnits, toUnits } from './amounts.js'

/** One movement of money inside the year in progress, in whole units. */
export interface Movement {
  /** Signed whole units: positive for a credit, negative for a debit. */
  readonly units: number
  readonly reason: string
}

/** What one closed year came to. Appended once and never changed afterwards. */
export interface YearRecord {
  readonly year: number
  /** Signed whole units the harvest itself paid, before the floor. */
  readonly harvest: number
  /** Whole units the zero floor absorbed; zero when the balance never reached it. */
  readonly absorbed: number
  /** The balance, in whole units, that this year closed at. */
  readonly closingBalance: number
}

/**
 * The farm as a value.
 *
 * `balance` is whole units and never negative. `movements` covers the year in progress
 * only; a closed year's figures are in `ledger`.
 */
export interface Farm {
  readonly declaration: FarmDeclaration
  readonly balance: number
  readonly year: number
  readonly movements: readonly Movement[]
  readonly ledger: readonly YearRecord[]
}

/** A movement the farm declined to make, with the cause in the house shape. */
export type FarmChange =
  | { readonly ok: true; readonly farm: Farm }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

export const INSUFFICIENT_FUNDS = 'insufficient-funds'

/**
 * The farm at its declared opening state: the declared balance, the declared year, no
 * movements yet and an empty ledger.
 */
export function openFarm(declaration: FarmDeclaration): Farm {
  return {
    declaration,
    balance: toUnits(declaration.openingBalance, declaration.precision),
    year: declaration.openingYear,
    movements: [],
    ledger: [],
  }
}

/** Refuses an amount that is not a whole unit, so a doubled conversion fails loudly. */
function requireUnits(units: number, what: string): void {
  if (typeof units !== 'number' || !Number.isFinite(units) || !Number.isInteger(units)) {
    throw new Error(
      `${what} must be a whole number of the currency's smallest unit; received ${JSON.stringify(units)}. Amounts cross into whole units once, through toUnits.`,
    )
  }
}

/** Refuses an unsigned amount given the wrong sign for the direction it is moving. */
function requireNonNegative(units: number, what: string): void {
  if (units < 0) {
    throw new Error(`${what} must not be negative; received ${units}.`)
  }
}

/** Refuses a movement with nothing said about why the money moved. */
function requireReason(reason: string): void {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error('Every movement of money must state its reason.')
  }
}

/**
 * Money in, with the reason it came in.
 *
 * Cannot refuse: there is no such thing as too much money arriving, so this returns the
 * farm itself rather than a result to unwrap.
 */
export function credit(farm: Farm, units: number, reason: string): Farm {
  requireUnits(units, 'A credit')
  requireNonNegative(units, 'A credit')
  requireReason(reason)
  return {
    ...farm,
    balance: farm.balance + units,
    movements: [...farm.movements, { units, reason }],
  }
}

/**
 * Money out, with the reason it went out.
 *
 * Refused when the balance will not cover it, naming the shortfall. A refusal leaves the
 * balance and the year's movements exactly as they were — nothing half spent.
 */
export function debit(farm: Farm, units: number, reason: string): FarmChange {
  requireUnits(units, 'A debit')
  requireNonNegative(units, 'A debit')
  requireReason(reason)

  if (units > farm.balance) {
    const shortfall = units - farm.balance
    return {
      ok: false,
      issues: [
        {
          code: INSUFFICIENT_FUNDS,
          field: reason,
          message: `The farm cannot cover ${reason}: it is short by ${formatUnits(shortfall, farm.declaration)}.`,
        },
      ],
    }
  }

  return {
    ok: true,
    farm: {
      ...farm,
      balance: farm.balance - units,
      movements: [...farm.movements, { units: -units, reason }],
    },
  }
}

/**
 * What the year in progress has moved so far, in the order it happened.
 *
 * Exposed so a screen can show what has been earned and spent this year without keeping
 * a second record of it.
 */
export function movementsThisYear(farm: Farm): readonly Movement[] {
  return farm.movements
}

/**
 * Records a harvest: settles what it paid, closes the year, opens the next one.
 *
 * One operation rather than a credit followed by a year advance, because the requirement
 * that only a harvest advances the year would otherwise rest on every future caller
 * remembering to do both in the right order. There is deliberately no way to advance the
 * year on its own.
 *
 * `paid` is signed whole units and may be a loss. A loss deeper than the balance brings
 * it to rest at zero rather than below, and the year's record carries both the figure the
 * harvest paid and the amount the floor absorbed, so a report can show the arithmetic
 * instead of only the outcome.
 */
export function recordHarvest(farm: Farm, paid: number): Farm {
  requireUnits(paid, 'A harvest settlement')

  const settled = farm.balance + paid
  const absorbed = settled < 0 ? -settled : 0
  const balance = settled < 0 ? 0 : settled

  return {
    declaration: farm.declaration,
    balance,
    year: farm.year + 1,
    movements: [],
    ledger: [
      ...farm.ledger,
      { year: farm.year, harvest: paid, absorbed, closingBalance: balance },
    ],
  }
}

/**
 * The save, as a codec.
 *
 * Nothing here touches storage. `web/src/data/save.ts` is the twenty lines that talk to
 * `localStorage`; this module turns a farm into a plain versioned object and back, which
 * makes the version check, the shape check and the reference-dropping testable with no
 * DOM at all — the same split `src/task/validate.ts` and `web/src/data/load.ts` already
 * use.
 *
 * Two rules that look inconsistent and are not:
 *
 * A **version** this build does not read means the shape is unknown, so no field in it
 * can be trusted and adopting any of it would be a guess. The save is discarded whole and
 * the student is told. Migrating wrongly is the failure this exists to prevent, and a
 * quiet reset is the one that would hide it.
 *
 * A **reference** the declarations no longer carry — an owned id the catalog dropped, a
 * knob value a task no longer permits — is a known shape carrying a stale name, and the
 * build that removed it is the one at fault. Resetting a student's farm because we
 * renamed an entry would be the worse failure, so the reference is dropped, it opens
 * nothing, and the money and the years survive.
 *
 * The save records progress and never declarations. The farm's name, its currency, its
 * precision, its opening state and every catalog id, price, label and rule are re-read
 * from the declarations on every open. Amounts are written the way the declarations write
 * them — decimal amounts, not the economy's whole units — so the one conversion boundary
 * that already exists stays the only one and a hand-edited balance reads the way a
 * student expects.
 *
 * Nothing signs, checksums or obfuscates any of it. A save that fits the schema is played
 * as it is given, however it came to say what it says. See
 * openspec/changes/progression-catalog/specs/game-save/spec.md.
 */

import type { Farm, FarmDeclaration, Movement, YearRecord } from '../economy/index.js'
import { openFarm, toAmount, toUnits } from '../economy/index.js'
import type { Catalog } from '../progression/catalog.js'
import { itemById } from '../progression/catalog.js'
import { declaredValues } from '../progression/knobValues.js'
import { valueKey } from '../progression/knobValues.js'
import type { TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import { knobPermits } from '../task/validate.js'

/**
 * The schema this build reads. Bumped deliberately and never silently: every bump resets
 * every student's farm, which is the cost of never migrating one wrongly.
 */
export const SAVE_SCHEMA_VERSION = '1.0.0'

/** A save discarded whole, with the cause the student is told. */
export const SAVE_RESET = 'save-reset'
/** A reference the declarations no longer carry, dropped from an otherwise kept save. */
export const SAVE_REFERENCE_DROPPED = 'save-reference-dropped'

/** Knob id to the value last chosen for it, per task. */
export type SavedKnobs = Readonly<Record<string, Readonly<Record<string, string | number>>>>

/** Everything play has changed, and nothing a declaration states. */
export interface GameState {
  readonly farm: Farm
  /**
   * The farm's seed, drawn once and kept for its life.
   *
   * Nothing reads it yet — `harvest-scoring` will, so a year's crop is the same on every
   * visit. It ships now because adding a field later means a schema bump, and a schema
   * bump resets every student's farm. One unused field is much the smaller cost.
   */
  readonly seed: number
  readonly owned: readonly string[]
  readonly knobs: SavedKnobs
}

/** One movement, as the save writes it: a decimal amount and its reason. */
export interface SavedMovement {
  readonly amount: number
  readonly reason: string
}

/** One closed year, as the save writes it. Amounts are decimal, not whole units. */
export interface SavedYear {
  readonly year: number
  readonly harvest: number
  readonly absorbed: number
  readonly closingBalance: number
}

export interface SavedFarm {
  readonly schemaVersion: string
  readonly seed: number
  readonly year: number
  readonly balance: number
  readonly movements: readonly SavedMovement[]
  readonly ledger: readonly SavedYear[]
  readonly owned: readonly string[]
  readonly knobs: SavedKnobs
}

export type SaveRestore =
  | {
      readonly kind: 'restored'
      readonly state: GameState
      /** References the declarations no longer carry, one issue each. Never fatal. */
      readonly dropped: readonly ValidationIssue[]
    }
  | { readonly kind: 'reset'; readonly cause: ValidationIssue }

/** What a restore needs in order to resolve the references a save carries. */
export interface SaveContext {
  readonly declaration: FarmDeclaration
  readonly catalog: Catalog
  readonly tasks: readonly TaskDeclaration[]
}

/** Where a new farm's seed comes from. Injected by tests, which need it to be dull. */
export type DrawSeed = () => number

const drawRandomSeed: DrawSeed = () => Math.floor(Math.random() * 2 ** 32)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function reset(message: string): SaveRestore {
  return {
    kind: 'reset',
    cause: {
      code: SAVE_RESET,
      message: `Earlier progress could not be read and has been reset: ${message}`,
    },
  }
}

function dropped(message: string, field: string): ValidationIssue {
  return { code: SAVE_REFERENCE_DROPPED, field, message }
}

/**
 * A farm at its declared opening state, owning what the catalog says a new farm owns.
 *
 * The seed is drawn here and nowhere else, so reopening a save cannot redraw it.
 */
export function newGame(
  declaration: FarmDeclaration,
  catalog: Catalog,
  draw: DrawSeed = drawRandomSeed,
): GameState {
  return {
    farm: openFarm(declaration),
    seed: draw(),
    owned: [...catalog.ownedAtStart],
    knobs: {},
  }
}

/** The state as a plain object, with every amount in the form the declarations use. */
export function encodeSave(state: GameState): SavedFarm {
  const precision = state.farm.declaration.precision
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    seed: state.seed,
    year: state.farm.year,
    balance: toAmount(state.farm.balance, precision),
    movements: state.farm.movements.map((movement) => ({
      amount: toAmount(movement.units, precision),
      reason: movement.reason,
    })),
    ledger: state.farm.ledger.map((record) => ({
      year: record.year,
      harvest: toAmount(record.harvest, precision),
      absorbed: toAmount(record.absorbed, precision),
      closingBalance: toAmount(record.closingBalance, precision),
    })),
    owned: [...state.owned],
    knobs: state.knobs,
  }
}

/** The save as text, for whatever is going to store it. */
export function serializeSave(state: GameState): string {
  return JSON.stringify(encodeSave(state))
}

/** Reads the movements of the year in progress, or undefined when the shape is wrong. */
function readMovements(raw: unknown, precision: number): Movement[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const movements: Movement[] = []
  for (const entry of raw) {
    if (!isRecord(entry) || !isFiniteNumber(entry.amount) || typeof entry.reason !== 'string') {
      return undefined
    }
    if (entry.reason.trim().length === 0) return undefined
    movements.push({ units: toUnits(entry.amount, precision), reason: entry.reason })
  }
  return movements
}

/** Reads the ledger, or undefined when the shape is wrong. */
function readLedger(raw: unknown, precision: number): YearRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const ledger: YearRecord[] = []
  for (const entry of raw) {
    if (
      !isRecord(entry) ||
      !Number.isInteger(entry.year) ||
      !isFiniteNumber(entry.harvest) ||
      !isFiniteNumber(entry.absorbed) ||
      !isFiniteNumber(entry.closingBalance)
    ) {
      return undefined
    }
    ledger.push({
      year: entry.year as number,
      harvest: toUnits(entry.harvest, precision),
      absorbed: toUnits(entry.absorbed, precision),
      closingBalance: toUnits(entry.closingBalance, precision),
    })
  }
  return ledger
}

/**
 * Reads the saved knob values, dropping every reference the declarations no longer carry.
 *
 * A task that is gone drops whole; a knob that is gone drops; a value the knob no longer
 * permits falls back to that knob's declared default, so the knob opens somewhere it is
 * allowed to be rather than somewhere it is not.
 */
function readKnobs(
  raw: unknown,
  tasks: readonly TaskDeclaration[],
  issues: ValidationIssue[],
): SavedKnobs | undefined {
  if (!isRecord(raw)) return undefined

  const knobs: Record<string, Record<string, string | number>> = {}
  for (const [taskId, values] of Object.entries(raw)) {
    if (!isRecord(values)) return undefined

    const task = tasks.find((candidate) => candidate.id === taskId)
    if (task === undefined) {
      issues.push(
        dropped(`The save holds settings for task "${taskId}", which this build does not declare.`, taskId),
      )
      continue
    }

    const kept: Record<string, string | number> = {}
    for (const [knobId, value] of Object.entries(values)) {
      if (typeof value !== 'string' && typeof value !== 'number') return undefined

      const knob = task.knobs.find((candidate) => candidate.id === knobId)
      if (knob === undefined) {
        issues.push(
          dropped(
            `The save holds a setting for "${knobId}", which task "${taskId}" no longer declares.`,
            knobId,
          ),
        )
        continue
      }
      if (!knobPermits(knob, value)) {
        issues.push(
          dropped(
            `The save holds ${JSON.stringify(value)} for "${knobId}", which it no longer permits; it opens at its default of ${JSON.stringify(knob.default)}.`,
            knobId,
          ),
        )
        kept[knobId] = knob.default
        continue
      }
      kept[knobId] = value
    }
    knobs[taskId] = kept
  }
  return knobs
}

/**
 * Restores a farm from a saved object.
 *
 * Every check that can fail the *shape* discards the whole save; every check that can
 * fail a *reference* drops the reference. Nothing in between, and nothing repaired.
 */
export function decodeSave(raw: unknown, context: SaveContext): SaveRestore {
  if (!isRecord(raw)) return reset('what was stored is not a save.')

  if (raw.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return reset(
      `it was written at schema version ${JSON.stringify(raw.schemaVersion)} and this build reads ${SAVE_SCHEMA_VERSION}.`,
    )
  }

  const precision = context.declaration.precision

  if (!isFiniteNumber(raw.seed)) return reset('it records no usable farm seed.')
  if (!Number.isInteger(raw.year)) return reset('it records no usable year.')
  if (!isFiniteNumber(raw.balance) || raw.balance < 0) return reset('it records no usable balance.')

  const movements = readMovements(raw.movements, precision)
  if (movements === undefined) return reset('its record of this year’s movements is not of the shape a save has.')

  const ledger = readLedger(raw.ledger, precision)
  if (ledger === undefined) return reset('its ledger is not of the shape a save has.')

  if (!Array.isArray(raw.owned) || raw.owned.some((id) => typeof id !== 'string')) {
    return reset('its record of what the farm owns is not of the shape a save has.')
  }

  const issues: ValidationIssue[] = []
  const knobs = readKnobs(raw.knobs, context.tasks, issues)
  if (knobs === undefined) return reset('its record of the knob values is not of the shape a save has.')

  const owned: string[] = []
  for (const id of raw.owned as readonly string[]) {
    if (itemById(context.catalog, id) === undefined) {
      issues.push(
        dropped(`The save owns "${id}", which the catalog no longer declares; it opens nothing.`, id),
      )
      continue
    }
    if (!owned.includes(id)) owned.push(id)
  }

  return {
    kind: 'restored',
    state: {
      farm: {
        declaration: context.declaration,
        balance: toUnits(raw.balance, precision),
        year: raw.year as number,
        movements,
        ledger,
      },
      seed: raw.seed,
      owned,
      knobs,
    },
    dropped: issues,
  }
}

/**
 * Restores a farm from stored text.
 *
 * Text that is not JSON is a save that cannot be read, which is a reset with a cause and
 * not an exception for a caller to catch.
 */
export function parseSave(text: string, context: SaveContext): SaveRestore {
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch (cause) {
    return reset(`what was stored could not be read as a save (${String(cause)}).`)
  }
  return decodeSave(raw, context)
}

/**
 * The knob values one task opens at: what the save kept, over the declared defaults.
 *
 * Exported so the shell has one place to ask, rather than spreading the fallback across
 * every screen that needs a starting value.
 */
export function knobValuesFor(
  state: GameState,
  task: TaskDeclaration,
): Readonly<Record<string, string | number>> {
  const saved = state.knobs[task.id] ?? {}
  return Object.fromEntries(
    task.knobs.map((knob) => {
      const value = saved[knob.id]
      const permitted =
        value !== undefined &&
        declaredValues(knob).some((candidate) => valueKey(candidate) === valueKey(value))
      return [knob.id, permitted ? (value as string | number) : knob.default]
    }),
  )
}

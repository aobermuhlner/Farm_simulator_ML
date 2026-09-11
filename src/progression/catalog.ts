/**
 * The declared catalog: everything the farm can buy, and everything a purchase opens.
 *
 * The catalog is data for the same reason a task is. Five nouns are queued to be sold —
 * trees, datasets, decision nodes, orchard blocks and whole model families — and five
 * near-identical gating systems is what this file exists instead of.
 *
 * Two rules shape it. An item names what it opens, rather than a knob declaring what
 * opens it: availability is then the inversion of one map, task declarations never change
 * when something is unlocked, and a build with no catalog entries is a playable farm with
 * everything open. And an item may declare no price, in which case it is shown but is not
 * for sale — the honest form of "no model for this has been trained yet".
 *
 * Refusals take the house shape: a `ValidationIssue` list naming the field, never a
 * throw, never a partial catalog. A catalog that will not validate stops the farm
 * opening, the same way a farm declaration that will not validate does.
 *
 * See openspec/changes/progression-catalog/specs/progression-catalog/spec.md.
 */

import type { FarmDeclaration } from '../economy/index.js'
import { toUnits } from '../economy/index.js'
import type { ValidationIssue } from '../task/validate.js'

/** The counters a group's items can stand at. One anywhere else is refused by name. */
export const COUNTERS = ['market', 'bench'] as const

/** Where a group's items are bought: the farm's market, or the workshop's bench. */
export type Counter = (typeof COUNTERS)[number]

/**
 * A heading items are shown under, in the order the catalog lists them.
 *
 * A group carries two facts beyond its heading: the counter its items stand at, and the
 * part of the farm they belong to. Both are on the group rather than on the item, so
 * that a group stays one shelf — two items of one group standing at different counters
 * would leave the heading meaning nothing — and so that a missing field is a refusal
 * rather than a silent default that moves an item to another shop.
 *
 * The part of the farm is a task id, because the parts of the farm *are* the tasks. A
 * catalog declaring its own places would name the apple orchard twice, in two files,
 * with nothing able to say which is right when one is edited. A group naming no task
 * belongs to the farm rather than to any one part of it.
 */
export interface GroupDeclaration {
  readonly id: string
  readonly label: string
  readonly soldAt: Counter
  /** The task its items are for, or absent when they belong to the whole farm. */
  readonly task?: string
}

/** Kinds of thing an item can open. A kind not in this list is refused, never ignored. */
export const UNLOCK_KINDS = ['knob-values', 'farm-land', 'model-family'] as const

/** Values of one knob of one task that owning an item makes selectable. */
export interface KnobValuesUnlock {
  readonly kind: 'knob-values'
  readonly task: string
  readonly knob: string
  readonly values: readonly (string | number)[]
}

/**
 * Land the farm gains by buying the item.
 *
 * Growth rather than unlocking: buying it twice gives twice the land, and two items that
 * each grow the farm open two different things. What the land bears is the farm's to
 * declare, so nothing here says anything about a crop.
 */
export interface FarmLandUnlock {
  readonly kind: 'farm-land'
  readonly units: number
}

/**
 * A whole kind of model that owning the item makes selectable.
 *
 * Its own kind rather than a knob value, because a family is not a setting of anything:
 * it brings its own knobs, its own drawing and its own models, and a knob whose values
 * were family ids would put every family's identity into one task-level list.
 *
 * What it opens is *selection*, and only that. Whether a family may be put to work has
 * a second input — its declared tutorial — which `model-tutorials` owns and which no
 * purchase touches. Buying a family and being handed a puzzle is the market saying that
 * money was not the key, which the market has promised it will never say.
 */
export interface ModelFamilyUnlock {
  readonly kind: 'model-family'
  readonly task: string
  readonly family: string
}

export type Unlock = KnobValuesUnlock | FarmLandUnlock | ModelFamilyUnlock

export interface CatalogItem {
  readonly id: string
  /** The declared group this item is shown under. */
  readonly group: string
  readonly label: string
  /** Shop copy: what a student reads about it. Never matched, never branched on. */
  readonly copy: string
  /** What owning it opens. At least one thing, so nothing is sold that does nothing. */
  readonly opens: readonly Unlock[]
  /**
   * How many times it can be bought. Absent means once, which is every item that has
   * ever been declared, so an item saying nothing about it behaves exactly as before.
   */
  readonly repeat?: number
  /**
   * The price in whole units of the farm's declared precision, or undefined when the
   * item is not for sale. Converted once, here, through the currency's own boundary.
   */
  readonly priceUnits?: number
  /** Why it cannot be bought yet. Required exactly when there is no price. */
  readonly notForSaleReason?: string
}

export interface Catalog {
  readonly schemaVersion: string
  readonly groups: readonly GroupDeclaration[]
  /** Ids a new farm owns before it has bought anything. */
  readonly ownedAtStart: readonly string[]
  readonly items: readonly CatalogItem[]
}

export type CatalogValidation =
  | { readonly ok: true; readonly catalog: Catalog }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/** Every field the catalog itself must carry. */
export const REQUIRED_CATALOG_FIELDS = [
  'schemaVersion',
  'groups',
  'ownedAtStart',
  'items',
] as const

/** Every field an item must carry, whether or not it is for sale. */
export const REQUIRED_ITEM_FIELDS = ['id', 'group', 'label', 'copy', 'opens'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

/**
 * True when `amount` can be held exactly at `precision` decimal places.
 *
 * A price of 12.005 in a currency counted to two decimals has no right answer: rounding
 * it silently would make the declared price and the price debited two different figures.
 */
function fitsPrecision(amount: number, precision: number): boolean {
  const scaled = amount * 10 ** precision
  return Math.abs(scaled - Math.round(scaled)) < 1e-9
}

/** Reads the group list, reporting malformed and repeated entries. */
function readGroups(raw: unknown, issues: ValidationIssue[]): GroupDeclaration[] {
  if (!Array.isArray(raw)) {
    issues.push(issue('malformed-field', 'Field "groups" must be a list.', 'groups'))
    return []
  }
  const groups: GroupDeclaration[] = []
  const seen = new Set<string>()
  raw.forEach((entry, index) => {
    if (!isRecord(entry) || !isNonEmptyString(entry.id) || !isNonEmptyString(entry.label)) {
      issues.push(
        issue(
          'malformed-entry',
          `Entry ${index} of "groups" needs a non-empty id and label.`,
          `groups[${index}]`,
        ),
      )
      return
    }
    if (seen.has(entry.id)) {
      issues.push(
        issue('duplicate-group', `Group id "${entry.id}" is declared twice.`, `groups[${index}]`),
      )
      return
    }
    if (entry.soldAt === undefined || entry.soldAt === null) {
      issues.push(
        issue(
          'missing-field',
          `Group "${entry.id}" does not say which counter its items are sold at; it must declare "soldAt" as one of ${COUNTERS.join(', ')}.`,
          `groups[${index}].soldAt`,
        ),
      )
      return
    }
    if (
      typeof entry.soldAt !== 'string' ||
      !COUNTERS.includes(entry.soldAt as (typeof COUNTERS)[number])
    ) {
      issues.push(
        issue(
          'unknown-counter',
          `Group "${entry.id}" is sold at ${JSON.stringify(entry.soldAt)}, which is not a counter this build has; it knows ${COUNTERS.join(', ')}.`,
          `groups[${index}].soldAt`,
        ),
      )
      return
    }
    // Absent is the farm-wide reading, so only a present-but-malformed task is refused.
    // Whether the task it names exists is a cross-file question `check.ts` answers.
    if (entry.task !== undefined && entry.task !== null && !isNonEmptyString(entry.task)) {
      issues.push(
        issue(
          'malformed-field',
          `Group "${entry.id}" field "task" must be a non-empty task id when it is declared.`,
          `groups[${index}].task`,
        ),
      )
      return
    }
    seen.add(entry.id)
    groups.push({
      id: entry.id,
      label: entry.label,
      soldAt: entry.soldAt as Counter,
      ...(isNonEmptyString(entry.task) ? { task: entry.task } : {}),
    })
  })
  return groups
}

/** Reads one item's `opens` list. Kinds this build does not know are refused by name. */
function readOpens(id: string, raw: unknown, issues: ValidationIssue[]): Unlock[] | undefined {
  if (!Array.isArray(raw)) {
    issues.push(issue('malformed-field', `Item "${id}" must declare "opens" as a list.`, id))
    return undefined
  }
  if (raw.length === 0) {
    issues.push(
      issue(
        'opens-nothing',
        `Item "${id}" declares nothing that owning it opens, so buying it would do nothing.`,
        id,
      ),
    )
    return undefined
  }

  const opens: Unlock[] = []
  let usable = true
  raw.forEach((entry, index) => {
    const where = `${id}.opens[${index}]`
    if (!isRecord(entry)) {
      issues.push(
        issue('malformed-entry', `Entry ${index} of item "${id}" is not an object.`, where),
      )
      usable = false
      return
    }
    const kind = entry.kind
    if (typeof kind !== 'string' || !UNLOCK_KINDS.includes(kind as (typeof UNLOCK_KINDS)[number])) {
      issues.push(
        issue(
          'unknown-unlock-kind',
          `Item "${id}" opens something of kind ${JSON.stringify(kind)}, which this build does not recognise; it knows ${UNLOCK_KINDS.join(', ')}.`,
          where,
        ),
      )
      usable = false
      return
    }
    if (kind === 'farm-land') {
      // Growing the farm by nothing is a purchase that does nothing, which is the same
      // defect as an item that opens nothing at all — so it is refused, not rounded.
      const units = entry.units
      if (typeof units !== 'number' || !Number.isInteger(units) || units < 1) {
        issues.push(
          issue(
            'malformed-entry',
            `Item "${id}" grows the farm by ${JSON.stringify(units)}, which must be a whole amount of land of one or more.`,
            `${where}.units`,
          ),
        )
        usable = false
        return
      }
      opens.push({ kind: 'farm-land', units })
      return
    }
    if (kind === 'model-family') {
      if (!isNonEmptyString(entry.task) || !isNonEmptyString(entry.family)) {
        issues.push(
          issue(
            'malformed-entry',
            `Item "${id}" opens a model family without naming a task and a family.`,
            where,
          ),
        )
        usable = false
        return
      }
      opens.push({ kind: 'model-family', task: entry.task, family: entry.family })
      return
    }
    if (!isNonEmptyString(entry.task) || !isNonEmptyString(entry.knob)) {
      issues.push(
        issue(
          'malformed-entry',
          `Item "${id}" opens knob values without naming a task and a knob.`,
          where,
        ),
      )
      usable = false
      return
    }
    if (
      !Array.isArray(entry.values) ||
      entry.values.length === 0 ||
      entry.values.some((value) => typeof value !== 'string' && typeof value !== 'number')
    ) {
      issues.push(
        issue(
          'malformed-entry',
          `Item "${id}" opens knob "${entry.knob}" without naming at least one value it permits.`,
          where,
        ),
      )
      usable = false
      return
    }
    opens.push({
      kind: 'knob-values',
      task: entry.task,
      knob: entry.knob,
      values: entry.values as readonly (string | number)[],
    })
  })

  return usable ? opens : undefined
}

/**
 * The price of one item in whole units, or undefined when it declares none.
 *
 * `undefined` covers both a refused price and an absent one, so the issues list is what
 * tells them apart: a refusal pushes an issue, an absence does not.
 */
function readPrice(
  id: string,
  raw: unknown,
  farm: FarmDeclaration,
  issues: ValidationIssue[],
): number | undefined {
  if (raw === undefined || raw === null) return undefined

  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    issues.push(
      issue(
        'malformed-price',
        `Item "${id}" declares a price of ${JSON.stringify(raw)}, which is not an amount.`,
        id,
      ),
    )
    return undefined
  }
  if (raw < 0) {
    issues.push(issue('malformed-price', `Item "${id}" declares a negative price of ${raw}.`, id))
    return undefined
  }
  if (!fitsPrecision(raw, farm.precision)) {
    issues.push(
      issue(
        'unrepresentable-amount',
        `Item "${id}" is priced at ${raw}, which is finer than the declared precision of ${farm.precision} decimal places.`,
        id,
      ),
    )
    return undefined
  }
  return toUnits(raw, farm.precision)
}

/** Reads one item, or reports why it cannot be read. */
function readItem(
  raw: unknown,
  index: number,
  groups: readonly GroupDeclaration[],
  farm: FarmDeclaration,
  issues: ValidationIssue[],
): CatalogItem | undefined {
  if (!isRecord(raw)) {
    issues.push(
      issue('malformed-entry', `Entry ${index} of "items" is not an object.`, `items[${index}]`),
    )
    return undefined
  }

  const id = isNonEmptyString(raw.id) ? raw.id : undefined
  const where = id ?? `items[${index}]`

  let complete = true
  for (const field of REQUIRED_ITEM_FIELDS) {
    if (raw[field] === undefined || raw[field] === null) {
      issues.push(
        issue(
          'missing-field',
          `Item "${where}" is missing required field "${field}".`,
          `${where}.${field}`,
        ),
      )
      complete = false
    }
  }
  for (const field of ['id', 'group', 'label', 'copy'] as const) {
    if (raw[field] !== undefined && raw[field] !== null && !isNonEmptyString(raw[field])) {
      issues.push(
        issue(
          'malformed-field',
          `Item "${where}" field "${field}" must be a non-empty string.`,
          `${where}.${field}`,
        ),
      )
      complete = false
    }
  }
  if (!complete || id === undefined) return undefined

  const group = groups.find((candidate) => candidate.id === raw.group)
  if (group === undefined) {
    issues.push(
      issue(
        'unknown-group',
        `Item "${id}" is in group "${String(raw.group)}", which the catalog does not declare.`,
        `${id}.group`,
      ),
    )
    return undefined
  }

  const priceUnits = readPrice(id, raw.price, farm, issues)
  const forSale = raw.price !== undefined && raw.price !== null
  const reason = raw.notForSaleReason

  if (!forSale && !isNonEmptyString(reason)) {
    issues.push(
      issue(
        'missing-field',
        `Item "${id}" declares no price, so it must declare "notForSaleReason" — the reason it cannot be bought yet.`,
        `${id}.notForSaleReason`,
      ),
    )
    return undefined
  }
  if (forSale && reason !== undefined && reason !== null && !isNonEmptyString(reason)) {
    issues.push(
      issue(
        'malformed-field',
        `Item "${id}" field "notForSaleReason" must be a non-empty string.`,
        `${id}.notForSaleReason`,
      ),
    )
    return undefined
  }

  const repeat = raw.repeat
  let repeatLimit: number | undefined
  if (repeat !== undefined && repeat !== null) {
    if (typeof repeat !== 'number' || !Number.isInteger(repeat) || repeat < 1) {
      issues.push(
        issue(
          'malformed-field',
          `Item "${id}" declares a repeat limit of ${JSON.stringify(repeat)}, which must be a whole number of one or more.`,
          `${id}.repeat`,
        ),
      )
      return undefined
    }
    repeatLimit = repeat
  }

  const opens = readOpens(id, raw.opens, issues)
  if (opens === undefined) return undefined
  if (forSale && priceUnits === undefined) return undefined

  // What the bench is for is reading a price against the knob it moves, so an item with
  // no one knob to sit under has no place there. Land and a whole family are refused
  // here, where no task is needed to see them; reaching across two families needs the
  // declarations to resolve a knob to a family, and is `check.ts`'s half of this rule.
  if (group.soldAt === 'bench') {
    const stray = opens.find((unlock) => unlock.kind !== 'knob-values')
    if (stray !== undefined) {
      issues.push(
        issue(
          'bench-item-is-no-upgrade',
          `Item "${id}" stands at the bench but opens something of kind "${stray.kind}"; only values of one model family's knobs are sold there.`,
          `${id}.opens`,
        ),
      )
      return undefined
    }
  }

  return {
    id,
    group: raw.group as string,
    label: raw.label as string,
    copy: raw.copy as string,
    opens,
    ...(repeatLimit === undefined ? {} : { repeat: repeatLimit }),
    ...(priceUnits === undefined ? {} : { priceUnits }),
    ...(isNonEmptyString(reason) ? { notForSaleReason: reason } : {}),
  }
}

/**
 * Validates a candidate catalog against the farm whose currency prices it.
 *
 * Structure only: what an item opens is checked against the loaded tasks by
 * `checkCatalogAgainstTasks`, and what a priced item opens is checked against the
 * artifact by `checkCatalogCoverage`. Splitting them keeps this function usable without a
 * task in hand, which is what the market's own tests need.
 */
export function validateCatalog(input: unknown, farm: FarmDeclaration): CatalogValidation {
  if (!isRecord(input)) {
    return { ok: false, issues: [issue('malformed-declaration', 'A catalog must be an object.')] }
  }

  const issues: ValidationIssue[] = []

  for (const field of REQUIRED_CATALOG_FIELDS) {
    if (input[field] === undefined || input[field] === null) {
      issues.push(issue('missing-field', `The catalog is missing required field "${field}".`, field))
    }
  }
  if (issues.length > 0) return { ok: false, issues }

  if (!isNonEmptyString(input.schemaVersion)) {
    issues.push(
      issue('malformed-field', 'Field "schemaVersion" must be a non-empty string.', 'schemaVersion'),
    )
  }

  const groups = readGroups(input.groups, issues)

  const items: CatalogItem[] = []
  const seen = new Set<string>()
  if (!Array.isArray(input.items)) {
    issues.push(issue('malformed-field', 'Field "items" must be a list.', 'items'))
  } else {
    input.items.forEach((raw, index) => {
      const item = readItem(raw, index, groups, farm, issues)
      if (item === undefined) return
      if (seen.has(item.id)) {
        issues.push(issue('duplicate-item', `Item id "${item.id}" is declared twice.`, item.id))
        return
      }
      seen.add(item.id)
      items.push(item)
    })
  }

  const ownedAtStart: string[] = []
  if (!Array.isArray(input.ownedAtStart)) {
    issues.push(issue('malformed-field', 'Field "ownedAtStart" must be a list.', 'ownedAtStart'))
  } else {
    input.ownedAtStart.forEach((id, index) => {
      if (typeof id !== 'string') {
        issues.push(
          issue(
            'malformed-entry',
            `Entry ${index} of "ownedAtStart" is not an item id.`,
            `ownedAtStart[${index}]`,
          ),
        )
        return
      }
      // Checked against the items read above rather than against the raw list, so an id
      // naming an item that itself failed to validate is reported once, as that item.
      if (!seen.has(id)) {
        issues.push(
          issue(
            'unknown-item',
            `"ownedAtStart" names item "${id}", which the catalog does not declare.`,
            `ownedAtStart[${index}]`,
          ),
        )
        return
      }
      ownedAtStart.push(id)
    })
  }

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    catalog: { schemaVersion: input.schemaVersion as string, groups, ownedAtStart, items },
  }
}

/** The item with this id, or undefined when the catalog declares none. */
export function itemById(catalog: Catalog, id: string): CatalogItem | undefined {
  return catalog.items.find((item) => item.id === id)
}

/** How many times this item may be bought. An item declaring no limit is bought once. */
export function repeatLimit(item: CatalogItem): number {
  return item.repeat ?? 1
}

/**
 * The largest orchard the farm can reach: the declared opening plus everything the
 * catalog could still sell towards it.
 *
 * Derived rather than declared, so a repeat limit and a ceiling cannot disagree. Only
 * *priced* items count: nothing can buy an unpriced one, which is the same reading an
 * unpriced item is already given everywhere else.
 */
export function maxLand(catalog: Catalog, farm: FarmDeclaration): number {
  return catalog.items.reduce((total, item) => {
    if (item.priceUnits === undefined) return total
    const growth = item.opens.reduce(
      (sum, unlock) => (unlock.kind === 'farm-land' ? sum + unlock.units : sum),
      0,
    )
    return total + growth * repeatLimit(item)
  }, farm.orchard.opening)
}

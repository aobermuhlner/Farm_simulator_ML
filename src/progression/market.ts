/**
 * What each counter shows, decided here rather than on the screens.
 *
 * The four states an item can be in — owned, buyable now, not yet affordable, not for
 * sale — are a fact about the catalog and the balance, so they are computed once and
 * handed over. A screen that worked them out itself would be a screen that could invent
 * a fifth, or present "you cannot afford this" as "you are not allowed this", which is
 * exactly the distinction §2 turns on: money is the only key, and `saving` means you
 * cannot afford it, never that it is barred.
 *
 * Two views, one `viewOf`. The market and the workshop's upgrade bench are two counters
 * over one catalog, and the counter is *where* a thing is bought and nothing more — so
 * the four states can never read differently at one than at the other, and `purchase.ts`
 * is untouched by either.
 *
 * Groups come out in the order the catalog declares them, and a group with no items
 * comes out not at all — an empty section is a promise a counter cannot keep.
 */

import type { FarmDeclaration } from '../economy/index.js'
import type { KnobDeclaration, ModelFamilyDeclaration, TaskDeclaration } from '../task/types.js'
import { knobPermits } from '../task/validate.js'
import { computeAvailability, familyAvailability, taskAvailability } from './availability.js'
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

/**
 * One part of the farm, and the shelves that belong to it.
 *
 * The heading is the task's own declared title, so a second task's shelf appears with no
 * screen change and the farm's parts are never named twice. A section belonging to no
 * task is headed with the farm's declared name and comes after the parts.
 */
export interface MarketSection {
  /** The task this section stands for, or undefined when it belongs to the whole farm. */
  readonly taskId?: string
  /** The task's declared title, or the farm's declared name for the farm-wide section. */
  readonly title: string
  readonly groups: readonly MarketGroup[]
}

export interface MarketView {
  readonly sections: readonly MarketSection[]
}

/** One item as a counter shows it, given what is owned and what the farm holds. */
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

/** The given groups with their items, in declared order, empty groups dropped. */
function groupsAt(
  catalog: Catalog,
  groups: readonly GroupDeclaration[],
  owned: readonly string[],
  balanceUnits: number,
): readonly MarketGroup[] {
  return groups
    .map((group) => ({
      group,
      items: catalog.items
        .filter((item) => item.group === group.id)
        .map((item) => viewOf(item, owned, balanceUnits)),
    }))
    .filter((entry) => entry.items.length > 0)
}

/**
 * The market as it stands, for a farm holding `balanceUnits` and owning `owned`.
 *
 * Sectioned by the part of the farm a group belongs to, in the order the first group of
 * each part is declared, with the farm-wide section last. Items sold at the bench are
 * not here: an item stands at exactly one counter.
 */
export function marketView(
  catalog: Catalog,
  tasks: readonly TaskDeclaration[],
  farm: FarmDeclaration,
  owned: readonly string[],
  balanceUnits: number,
): MarketView {
  const forMarket = catalog.groups.filter((group) => group.soldAt === 'market')

  const sections: MarketSection[] = []
  // Declared order, taken from the first group of each part: the order of the shelves
  // stays one fact in one place, and that place is the catalog. A group naming a task
  // this build does not carry is refused at load, so nothing here has to cope with one.
  for (const group of forMarket) {
    if (group.task === undefined) continue
    if (sections.some((section) => section.taskId === group.task)) continue
    const task = tasks.find((candidate) => candidate.id === group.task)
    if (task === undefined) continue
    sections.push({
      taskId: task.id,
      title: task.title,
      groups: groupsAt(
        catalog,
        forMarket.filter((candidate) => candidate.task === task.id),
        owned,
        balanceUnits,
      ),
    })
  }

  sections.push({
    title: farm.name,
    groups: groupsAt(
      catalog,
      forMarket.filter((group) => group.task === undefined),
      owned,
      balanceUnits,
    ),
  })

  return { sections: sections.filter((section) => section.groups.length > 0) }
}

/** One knob of one family, and the upgrades the bench sells for its values. */
export interface BenchKnob {
  readonly knob: KnobDeclaration
  readonly items: readonly MarketItem[]
}

/**
 * One family of the task, and what the bench sells for it.
 *
 * Listed whether or not it is owned, because the bench is where a student reads what
 * buying one would give them — a bench tied to the selection could never show the thing
 * it exists to sell. No knob at all is a family with nothing further for sale.
 */
export interface BenchFamily {
  readonly family: ModelFamilyDeclaration
  readonly available: boolean
  /** The item that opens it. Present exactly when the family is locked. */
  readonly openedBy?: CatalogItem
  readonly knobs: readonly BenchKnob[]
}

export interface BenchView {
  /** The task this bench belongs to, so a screen can read what an item opens of it. */
  readonly taskId: string
  readonly families: readonly BenchFamily[]
}

/**
 * The upgrade bench for one task.
 *
 * Every family the task declares, in declared order, and under each only the knobs some
 * bench item opens values of. Which family a knob-values unlock belongs to is answered
 * by which family declares that knob and permits those values: the catalog names a task
 * and a knob and no family, because it predates families, so two families sharing a knob
 * id are told apart by what their knobs permit rather than by anything declared twice.
 */
export function benchView(
  task: TaskDeclaration,
  catalog: Catalog,
  owned: readonly string[],
  balanceUnits: number,
): BenchView {
  const benchGroups = new Set(
    catalog.groups.filter((group) => group.soldAt === 'bench').map((group) => group.id),
  )
  const forBench = catalog.items.filter((item) => benchGroups.has(item.group))
  const availability = taskAvailability(computeAvailability(catalog, [task], owned), task.id)

  return {
    taskId: task.id,
    families: task.families.map((family) => {
      const entry = familyAvailability(availability, family.id)
      const knobs: BenchKnob[] = []
      for (const knob of family.knobs) {
        const items = forBench
          .filter((item) =>
            item.opens.some(
              (unlock) =>
                unlock.kind === 'knob-values' &&
                unlock.task === task.id &&
                unlock.knob === knob.id &&
                unlock.values.every((value) => knobPermits(knob, value)),
            ),
          )
          .map((item) => viewOf(item, owned, balanceUnits))
        if (items.length > 0) knobs.push({ knob, items })
      }
      const openedBy = entry?.openedBy
      return {
        family,
        available: entry?.available ?? true,
        ...(openedBy === undefined ? {} : { openedBy }),
        knobs,
      }
    }),
  }
}

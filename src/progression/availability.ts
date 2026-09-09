/**
 * Ownership in, availability out.
 *
 * The single place unlock rules live. Screens receive the answer and render it; none of
 * them asks "is this unlocked?" by consulting a rule, which is what keeps the invariant
 * test's job possible — a screen that never names a knob cannot branch on one.
 *
 * The rule is default-open. Anything the catalog does not mention is available, and
 * anything it does mention is available exactly when the item that opens it is owned.
 * Nothing else is an input: not the year, not the balance, not whether a task has been
 * played. A farm in year nine with a fortune and no purchases has exactly the choices it
 * had on its first day.
 *
 * See openspec/changes/progression-catalog/specs/progression-catalog/spec.md —
 * "Ownership is the only input to what is available".
 */

import { declaredKnobs } from '../task/families.js'
import type { TaskDeclaration } from '../task/types.js'
import type { Catalog, CatalogItem } from './catalog.js'
import { declaredValues, valueKey } from './knobValues.js'

/** One declared value of one knob, and whether a student may select it. */
export interface ValueAvailability {
  readonly value: string | number
  readonly available: boolean
  /**
   * The item that opens it. Present exactly when the value is locked: an available value
   * either was never mentioned or is opened by something already owned, and in both
   * cases there is nothing left to name.
   */
  readonly openedBy?: CatalogItem
}

export interface KnobAvailability {
  readonly knobId: string
  /** Every value the knob declares, in declared order, available or not. */
  readonly values: readonly ValueAvailability[]
}

/** One declared model family, and whether a student may select it. */
export interface FamilyAvailability {
  readonly familyId: string
  readonly available: boolean
  /** The item that opens it. Present exactly when the family is locked. */
  readonly openedBy?: CatalogItem
}

export interface TaskAvailability {
  readonly taskId: string
  readonly knobs: readonly KnobAvailability[]
  /**
   * Every family the task declares, in declared order, available or not.
   *
   * Computed here rather than read off the declaration, for the same reason a knob
   * value's availability is: a declaration reads the same whatever a student owns, and
   * a screen that decided for itself could disagree with the one that refuses the run.
   * Nothing in the catalog opens a family yet, so every family is open — which is the
   * default-open rule, not a gap.
   */
  readonly families: readonly FamilyAvailability[]
}

export interface Availability {
  readonly tasks: readonly TaskAvailability[]
}

/**
 * What the given ownership makes selectable, across every loaded task.
 *
 * Three arguments and no more, deliberately: the catalog, the tasks it references, and
 * the ids owned. A fourth would be a way for something other than ownership to decide
 * what a student may choose.
 */
export function computeAvailability(
  catalog: Catalog,
  tasks: readonly TaskDeclaration[],
  owned: readonly string[],
): Availability {
  /** "task knob value" to the item that opens it, for everything the catalog mentions. */
  const opener = new Map<string, CatalogItem>()
  for (const item of catalog.items) {
    for (const unlock of item.opens) {
      // Growth opens no knob value, so it puts nothing in this map. Availability is
      // therefore identical for a farm that owns a growth item once, twice or not at
      // all — which is what keeps a repeated id from meaning anything here.
      if (unlock.kind !== 'knob-values') continue
      for (const value of unlock.values) {
        opener.set(`${unlock.task} ${unlock.knob} ${valueKey(value)}`, item)
      }
    }
  }

  return {
    tasks: tasks.map((task) => ({
      taskId: task.id,
      families: task.families.map((family) => ({ familyId: family.id, available: true })),
      knobs: declaredKnobs(task).map((knob) => ({
        knobId: knob.id,
        values: declaredValues(knob).map((value) => {
          const item = opener.get(`${task.id} ${knob.id} ${valueKey(value)}`)
          if (item === undefined || owned.includes(item.id)) {
            return { value, available: true }
          }
          return { value, available: false, openedBy: item }
        }),
      })),
    })),
  }
}

/** What one task offers, or undefined when the availability covers no such task. */
export function taskAvailability(
  availability: Availability,
  taskId: string,
): TaskAvailability | undefined {
  return availability.tasks.find((task) => task.taskId === taskId)
}

/** What one family offers, or undefined when the task declares no such family. */
export function familyAvailability(
  task: TaskAvailability | undefined,
  familyId: string,
): FamilyAvailability | undefined {
  return task?.families.find((family) => family.familyId === familyId)
}

/** What one knob offers, or undefined when the task offers no such knob. */
export function knobAvailability(
  task: TaskAvailability,
  knobId: string,
): KnobAvailability | undefined {
  return task.knobs.find((knob) => knob.knobId === knobId)
}

/**
 * The locked entry for a value, or undefined when it may be selected.
 *
 * A value the availability does not mention at all is available: nothing narrower than
 * "the catalog locks it" locks anything, so a knob added to a declaration after this
 * availability was computed opens rather than closes.
 */
export function lockedValue(
  task: TaskAvailability | undefined,
  knobId: string,
  value: string | number,
): ValueAvailability | undefined {
  if (task === undefined) return undefined
  const knob = knobAvailability(task, knobId)
  if (knob === undefined) return undefined
  const entry = knob.values.find((candidate) => valueKey(candidate.value) === valueKey(value))
  if (entry === undefined || entry.available) return undefined
  return entry
}

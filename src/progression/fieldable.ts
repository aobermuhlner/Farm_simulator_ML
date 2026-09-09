/**
 * Tutorials in, fieldability out.
 *
 * Deliberately beside `computeAvailability` rather than inside it. That function takes the
 * catalog, the tasks and what is owned, and its own comment says a fourth argument "would
 * be a way for something other than ownership to decide what a student may choose" — which
 * is still true, and is why this is a second function rather than a fourth argument.
 *
 * The scope split is the whole of the exception `model-tutorials` takes to
 * `progression-catalog`'s *Ownership is the only input to what is available*. What a
 * student may **select** stays a function of the catalog and what is owned, and of nothing
 * else: an untutored family is offered in the picker, its knobs turn, its model is made and
 * its training is presented. What gains a second input is what may be **put to work**, and
 * that input is exactly one — whether the family's declared tutorial has been passed.
 * Not the year, not the balance, not whether the task has been played.
 *
 * See openspec/changes/model-tutorials/specs/progression-catalog/spec.md.
 */

import type { TaskDeclaration, TutorialId } from '../task/types.js'
import { isTutorialComplete } from '../tutorials/index.js'

/** One declared family, and whether a student may put a model of it to work. */
export interface FamilyFieldability {
  readonly familyId: string
  readonly fieldable: boolean
  /**
   * The tutorial standing in the way. Present exactly when the family is not fieldable:
   * a fieldable family either declares no tutorial or has had it passed, and in both cases
   * there is nothing left to name.
   *
   * The id rather than the whole declaration, because what a screen needs from it — the
   * title, the copy, the puzzle — it reads from the declaration it already has.
   */
  readonly withheldBy?: TutorialId
}

export interface TaskFieldability {
  readonly taskId: string
  /** Every family the task declares, in declared order, fieldable or not. */
  readonly families: readonly FamilyFieldability[]
}

export interface Fieldability {
  readonly tasks: readonly TaskFieldability[]
}

/**
 * What the tutorials passed so far make fieldable, across every loaded task.
 *
 * Two arguments and no more, for the same reason availability takes three: a third would
 * be a second way for something to withhold a model from the farm, and the specs allow
 * exactly one.
 */
export function computeFieldability(
  tasks: readonly TaskDeclaration[],
  completed: readonly TutorialId[],
): Fieldability {
  return {
    tasks: tasks.map((task) => ({
      taskId: task.id,
      families: task.families.map((family) => {
        if (isTutorialComplete(family.tutorial, completed)) {
          return { familyId: family.id, fieldable: true }
        }
        // Narrowed by `isTutorialComplete` returning false, which it only does for a
        // family that declares one.
        return { familyId: family.id, fieldable: false, withheldBy: family.tutorial?.id }
      }),
    })),
  }
}

/** What one task offers, or undefined when the fieldability covers no such task. */
export function taskFieldability(
  fieldability: Fieldability,
  taskId: string,
): TaskFieldability | undefined {
  return fieldability.tasks.find((task) => task.taskId === taskId)
}

/**
 * What one family offers, or undefined when the task declares no such family.
 *
 * A family the fieldability does not mention is not answered for here. Callers treat
 * silence as fieldable, for the same reason `lockedValue` treats it as unlocked: nothing
 * narrower than "a tutorial withholds it" withholds anything.
 */
export function familyFieldability(
  task: TaskFieldability | undefined,
  familyId: string,
): FamilyFieldability | undefined {
  return task?.families.find((family) => family.familyId === familyId)
}

/**
 * The tutorial withholding a family, or undefined when it may be put to work.
 *
 * The single question every caller actually asks — the workshop deciding whether to offer
 * the control, and the labour resolver deciding whether to accept one. One function so the
 * two cannot disagree.
 */
export function withheldBy(
  fieldability: Fieldability,
  taskId: string,
  familyId: string,
): TutorialId | undefined {
  const family = familyFieldability(taskFieldability(fieldability, taskId), familyId)
  if (family === undefined || family.fieldable) return undefined
  return family.withheldBy
}

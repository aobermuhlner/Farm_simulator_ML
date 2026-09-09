/**
 * The tutorial registry: one kind of puzzle, one checker, one winnability decision, one
 * judge.
 *
 * Keyed by the kind a tutorial declares, never by the family it teaches. That is the whole
 * discipline of this module: the frame poses a puzzle, judges an attempt, records that it
 * was passed and withholds fielding until it is, and it does all four without knowing what
 * the puzzle is. A registry keyed by family id would make adding a lesson a change to this
 * file, which is exactly what the family being a declared entity exists to prevent.
 *
 * Why a registry at all, when `network-diagram` gets by with a closed union: a drawing can
 * be data-driven and a puzzle cannot. In a tutorial the interaction *is* the lesson, so
 * every kind brings its own body, and this is the seam that lets one be added as a leaf
 * rather than as a widening of `TutorialDeclaration`.
 *
 * See openspec/changes/model-tutorials/specs/model-tutorials/spec.md.
 */

import type { TaskDeclaration, TutorialDeclaration, TutorialId } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import { LABEL_THE_LEAVES, labelTheLeaves } from './leaves.js'

export * from './leaves.js'

/**
 * Whether a puzzle can be solved at all, and why not where it cannot.
 *
 * A cause rather than a bare `false`, because this refusal happens at load: a student
 * locked out by authored data is locked out somewhere no screen can explain, so the
 * message has to carry everything the author needs.
 */
export type Winnability = { readonly ok: true } | { readonly ok: false; readonly cause: string }

/**
 * Everything the frame requires of a kind before it will pose one.
 *
 * `winnable` is required rather than optional, deliberately. A kind that cannot say
 * whether its own puzzle is solvable cannot be checked at load, and an unwinnable tutorial
 * that reaches a student is a wall with no message on it.
 */
export interface TutorialKind {
  /**
   * Refuses puzzle data this kind cannot pose.
   *
   * `at` is the field path of the puzzle block, so a refusal names where the defect is in
   * the same terms every other declaration refusal does.
   *
   * `declaration` is the task the family declaring this tutorial belongs to, so a kind can
   * hold its puzzle to that task's own vocabulary: a puzzle naming a category the task
   * does not declare, or a feature it does not measure, is a puzzle whose answer means
   * nothing the rest of the game recognises. It arrives *while* that declaration is still
   * being checked, so a kind reads it defensively — every defect in the declaration itself
   * is reported by the checks beside this one, and reporting it twice would leave an author
   * guessing which to fix.
   *
   * Being handed it does not make the frame family-aware: a task declaration is not a
   * family, and nothing above a kind branches on which family is being taught.
   */
  readonly check: (
    puzzle: unknown,
    at: string,
    declaration: TaskDeclaration,
  ) => readonly ValidationIssue[]
  /** Whether the declared data admits any solution that clears the pass condition. */
  readonly winnable: (puzzle: unknown) => Winnability
  /**
   * Whether one attempt clears the pass condition.
   *
   * A boolean and nothing else. There is deliberately no score, no partial credit and no
   * count of what was right: the save records completion and only completion, and a judge
   * that returned more would be an invitation to record more.
   */
  readonly judge: (puzzle: unknown, attempt: unknown) => boolean
}

export type TutorialKinds = Readonly<Record<string, TutorialKind>>

/**
 * The kinds this build recognises.
 *
 * One entry, keyed by the kind a tutorial declares and never by the family it teaches, so
 * that a second puzzle is a new leaf beside `leaves.ts` plus a line here. A kind not in
 * here is refused at load naming itself — which is the right answer rather than a gap,
 * because a declared gate with no puzzle behind it is a wall.
 *
 * Its key set has to match `web/src/components/tutorial/TutorialBody.tsx`'s, or a
 * declaration would validate and then render nothing. A test holds the two together.
 */
export const TUTORIAL_KINDS: TutorialKinds = { [LABEL_THE_LEAVES]: labelTheLeaves }

/** The registered kind, or undefined where this build carries none by that name. */
export function tutorialKind(kind: string, kinds: TutorialKinds = TUTORIAL_KINDS): TutorialKind | undefined {
  return Object.prototype.hasOwnProperty.call(kinds, kind) ? kinds[kind] : undefined
}

/**
 * Whether one attempt at a tutorial passes.
 *
 * A tutorial whose kind is not registered never reaches here — it is refused at load — so
 * an unknown kind at this point is a bug rather than a student's problem, and failing the
 * attempt is the safe answer: it withholds fielding rather than granting it.
 */
export function judgeAttempt(
  tutorial: TutorialDeclaration,
  attempt: unknown,
  kinds: TutorialKinds = TUTORIAL_KINDS,
): boolean {
  const registered = tutorialKind(tutorial.kind, kinds)
  if (registered === undefined) return false
  return registered.judge(tutorial.puzzle, attempt)
}

/** Whether this set of completed ids covers a family's tutorial. A family with none is covered. */
export function isTutorialComplete(
  tutorial: TutorialDeclaration | undefined,
  completed: readonly TutorialId[],
): boolean {
  if (tutorial === undefined) return true
  return completed.includes(tutorial.id)
}

/**
 * Refuses one tutorial id declared twice, across tasks, with different content.
 *
 * `validateDeclaration` catches this within a single task; it cannot see across them,
 * because it is handed one declaration at a time. Completion is global, so the check has
 * to be too — this is the cross-declaration counterpart, run once the tasks are loaded,
 * the same shape as the catalog being checked against the tasks it references.
 */
export function tutorialAgreementIssues(
  tasks: readonly TaskDeclaration[],
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<TutorialId, { readonly task: string; readonly declared: string }>()
  for (const task of tasks) {
    for (const family of task.families) {
      const tutorial = family.tutorial
      if (tutorial === undefined) continue
      const declared = JSON.stringify(tutorial)
      const first = seen.get(tutorial.id)
      if (first === undefined) {
        seen.set(tutorial.id, { task: task.id, declared })
        continue
      }
      if (first.declared === declared) continue
      issues.push({
        code: 'disagreeing-tutorial',
        field: `${task.id}.families.${family.id}.tutorial.id`,
        message: `Tutorial id ${JSON.stringify(tutorial.id)} is declared by task "${first.task}" and by task "${task.id}" with different content; one completion cannot stand for two different puzzles.`,
      })
    }
  }
  return issues
}

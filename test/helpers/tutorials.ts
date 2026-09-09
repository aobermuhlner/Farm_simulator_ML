/**
 * A tutorial kind that exists only for the tests.
 *
 * The frame ships with no kinds — `fitted-tree-tutorial` supplies the first real one — so
 * everything about posing, checking, judging and gating has to be exercised against
 * something. This is that something, and it is deliberately the dullest puzzle that still
 * has all three of the properties the frame requires of a kind: data that can be malformed,
 * data that can be unwinnable, and an answer that can be right or wrong.
 *
 * It lives here rather than in `src/tutorials/` on purpose. A test-only kind in the shipped
 * registry would be a puzzle a student could reach, and the registry being injectable is
 * what makes keeping it out of there possible.
 */

import type { TaskDeclaration, TutorialDeclaration } from '../../src/task/types.js'
import type { TutorialKind, TutorialKinds } from '../../src/tutorials/index.js'
import type { ValidationIssue } from '../../src/task/validate.js'

/** The kind name every fixture below declares. */
export const FIXTURE_KIND = 'pick-one'

/** What a `pick-one` puzzle declares: some options, and which of them is right. */
export interface PickOnePuzzle {
  readonly options: readonly string[]
  readonly answer: string
  /**
   * A declared category and a declared feature this puzzle is about, if any.
   *
   * Neither is needed to pose the dullest puzzle there is, and both are here so the
   * *smallest* form of "a kind holds its puzzle to the task's own vocabulary" has
   * something to hold: a puzzle naming a category the task does not declare, or a feature
   * it does not measure, is refused at load naming what it invented.
   */
  readonly category?: string
  readonly feature?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Shape, then solvability, then correctness — the three questions the frame asks a kind.
 *
 * Unwinnable here means the declared answer is not among the declared options, so no
 * choice a student can make clears the mark. That is the whole class of defect the
 * load-time refusal exists for, in its smallest form.
 */
export const pickOne: TutorialKind = {
  check(puzzle: unknown, at: string, declaration: TaskDeclaration): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = []
    if (!isRecord(puzzle)) {
      return [{ code: 'malformed-puzzle', field: at, message: `Field "${at}" must be an object.` }]
    }
    if (
      !Array.isArray(puzzle.options) ||
      puzzle.options.length === 0 ||
      puzzle.options.some((option) => typeof option !== 'string' || option === '')
    ) {
      issues.push({
        code: 'malformed-puzzle',
        field: `${at}.options`,
        message: `Field "${at}.options" must be a non-empty list of non-empty strings.`,
      })
    }
    if (typeof puzzle.answer !== 'string' || puzzle.answer === '') {
      issues.push({
        code: 'malformed-puzzle',
        field: `${at}.answer`,
        message: `Field "${at}.answer" must be a non-empty string.`,
      })
    }
    // Read defensively: this runs in the same pass that checks the declaration's own
    // categories and features, so a task whose vocabulary is itself malformed reports that
    // there rather than twice.
    const declared = (list: unknown): readonly string[] =>
      Array.isArray(list)
        ? list.flatMap((entry) =>
            typeof entry === 'object' && entry !== null && typeof (entry as { id?: unknown }).id === 'string'
              ? [(entry as { id: string }).id]
              : [],
          )
        : []
    if (typeof puzzle.category === 'string' && !declared(declaration.categories).includes(puzzle.category)) {
      issues.push({
        code: 'undeclared-category',
        field: `${at}.category`,
        message: `The puzzle names category ${JSON.stringify(puzzle.category)}, which this task does not declare.`,
      })
    }
    if (typeof puzzle.feature === 'string' && !declared(declaration.features).includes(puzzle.feature)) {
      issues.push({
        code: 'undeclared-feature',
        field: `${at}.feature`,
        message: `The puzzle names feature ${JSON.stringify(puzzle.feature)}, which this task does not measure.`,
      })
    }
    return issues
  },

  winnable(puzzle: unknown) {
    const { options, answer } = puzzle as PickOnePuzzle
    if (options.includes(answer)) return { ok: true }
    return {
      ok: false,
      cause: `nothing among ${JSON.stringify(options)} is the declared answer ${JSON.stringify(answer)}.`,
    }
  },

  judge(puzzle: unknown, attempt: unknown): boolean {
    return attempt === (puzzle as PickOnePuzzle).answer
  },
}

/** The registry a test hands to the validator, the judge and the screens. */
export const fixtureKinds: TutorialKinds = { [FIXTURE_KIND]: pickOne }

/** A sound `pick-one` tutorial, with anything about it overridable. */
export function fixtureTutorial(
  overrides: Partial<TutorialDeclaration> = {},
): TutorialDeclaration {
  return {
    id: 'pick-the-red-one',
    title: 'Which one is the red one?',
    teaching: {
      summary: 'Say which of these the robot should crate.',
      theory: 'A model is a rule for turning what is seen into what is done.',
    },
    disclosure: 'You are given three words to choose between; the real thing has to find them.',
    kind: FIXTURE_KIND,
    puzzle: { options: ['red', 'green', 'wormy'], answer: 'red' } satisfies PickOnePuzzle,
    ...overrides,
  }
}

/** The answer that passes `fixtureTutorial()`. */
export const FIXTURE_ANSWER = 'red'

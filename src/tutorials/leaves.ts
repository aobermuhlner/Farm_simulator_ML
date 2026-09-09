/**
 * The puzzle whose questions are given and whose leaves are empty.
 *
 * A chain of questions — is this feature above this number? — with one leaf at every exit,
 * and a student who says what each leaf is *for* by putting one piece of fruit into it.
 * The claim it teaches is the one a tree rests on: ask the questions in order, follow the
 * first yes, and every piece ends up in exactly one leaf, which carries the outcome.
 *
 * All of it is a pure function of declared data. That is not a style preference: the frame
 * asks whether a puzzle can be solved at all *at load*, where there is no pool and no
 * screen, so anything the answer depends on has to be in the declaration. The pictures are
 * needed for pixels alone, which is why the measured values are copied into the puzzle and
 * pinned against the pool by a test rather than read from it here.
 *
 * A question is a `RuleSplit` from `src/features/rules.ts` rather than a shape of its own,
 * so a threshold means the same thing here that it means in the exhaustive search. The walk
 * is written out below instead of going through `applyRule`, because `applyRule` answers
 * with an *action* and this puzzle's leaves carry **categories** — deliberately, as its
 * central claim. Routing through it would mean labelling leaves with actions and mapping
 * back, which inverts the thing the puzzle exists to teach.
 *
 * See openspec/changes/fitted-tree-tutorial/specs/fitted-tree-tutorial/spec.md.
 */

import type { RuleSplit } from '../features/rules.js'
import type { CategoryId, FeatureId, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import type { TutorialKind, Winnability } from './index.js'

/** The kind a tutorial declares to be posed as this puzzle. */
export const LABEL_THE_LEAVES = 'label-the-leaves'

/**
 * One piece of fruit the puzzle files: which picture it is, what it really is, and the
 * values the declared questions read of it.
 *
 * The values are copied from the pool that ships the picture, and only for the features
 * some declared question asks about. A tree asks about what it asks about, so a panel of
 * every measured number would invite a question this puzzle cannot answer — it does not
 * choose its questions — and copying data nothing reads is drift with no benefit.
 */
export interface LeafPuzzleItem {
  /** The pool image this is, so the body can draw the real photograph. */
  readonly image: string
  /** The declared category it truly belongs to. */
  readonly category: CategoryId
  /** Its measured value for each feature a declared question asks about, and no other. */
  readonly features: Readonly<Record<FeatureId, number>>
}

/**
 * The whole of what this kind declares.
 *
 * `mark` is a count rather than a share. At nine items and a mark of eight the mark *is*
 * the best labelling available, so there is no percentage anybody would have to justify,
 * and a later puzzle can sit anywhere between without this file changing.
 */
export interface LabelTheLeavesPuzzle {
  /** Asked in the declared order; a chain of n of them poses n + 1 leaves. */
  readonly questions: readonly RuleSplit[]
  readonly items: readonly LeafPuzzleItem[]
  /** The fewest items that must be filed correctly for an answer to pass. */
  readonly mark: number
}

/**
 * What the student says each leaf is for, one entry per leaf, in leaf order.
 *
 * `null` where a leaf carries no label yet. An unlabelled leaf files nothing correctly,
 * which is what makes an incomplete answer simply a failing one rather than a special case.
 */
export type LeafLabelling = readonly (CategoryId | null)[]

/** How many leaves a chain of this many questions poses: one per exit. */
export function leafCount(puzzle: LabelTheLeavesPuzzle): number {
  return puzzle.questions.length + 1
}

/**
 * Which leaf one item reaches.
 *
 * The first question it answers yes to, or the final leaf when it answers no to all of
 * them. `> threshold` rather than `>=`, matching `applyRule` exactly, because a student who
 * reads a threshold off one screen and applies it on another must not find two answers.
 */
export function leafOf(
  questions: readonly RuleSplit[],
  features: Readonly<Record<string, number>>,
): number {
  for (const [index, question] of questions.entries()) {
    const value = features[question.feature]
    if (value !== undefined && value > question.threshold) return index
  }
  return questions.length
}

/** The items reaching each leaf, in leaf order. Every item appears in exactly one. */
export function itemsByLeaf(
  puzzle: LabelTheLeavesPuzzle,
): readonly (readonly LeafPuzzleItem[])[] {
  const leaves: LeafPuzzleItem[][] = Array.from({ length: leafCount(puzzle) }, () => [])
  for (const item of puzzle.items) {
    leaves[leafOf(puzzle.questions, item.features)]?.push(item)
  }
  return leaves
}

/** How many items a labelling files correctly: the label on the leaf they reach is what they are. */
export function filedCorrectly(puzzle: LabelTheLeavesPuzzle, labelling: LeafLabelling): number {
  let correct = 0
  for (const item of puzzle.items) {
    if (labelling[leafOf(puzzle.questions, item.features)] === item.category) correct += 1
  }
  return correct
}

/**
 * The best labelling available, and how much of the puzzle it gets right.
 *
 * Per leaf independently: the category most of what lands there truly belongs to. That is
 * exact rather than a heuristic because a chain of questions *partitions* the items, so no
 * leaf's best label depends on another's — the same argument the rule search makes for not
 * searching leaves jointly.
 *
 * A tie goes to whichever of the tied categories appears first among the declared items, so
 * the answer depends on the declaration and not on the order the leaves happen to be walked
 * in. A leaf nothing reaches is left unlabelled: there is no label it could be wrong about.
 */
export function bestLabelling(puzzle: LabelTheLeavesPuzzle): {
  readonly labelling: LeafLabelling
  readonly correct: number
} {
  const labelling = itemsByLeaf(puzzle).map((reaching) => {
    let best: CategoryId | null = null
    let bestCount = 0
    for (const candidate of reaching) {
      const count = reaching.filter((item) => item.category === candidate.category).length
      if (count > bestCount) {
        best = candidate.category
        bestCount = count
      }
    }
    return best
  })
  return { labelling, correct: filedCorrectly(puzzle, labelling) }
}

/**
 * Whether one submitted labelling passes.
 *
 * A boolean and nothing else. The count reached is computed and then thrown away here on
 * purpose: a judge that returned it would be an invitation to record it, and what is kept
 * about a tutorial is that it was passed.
 *
 * The attempt arrives from a screen, so it is read defensively — anything that is not a
 * labelling of this puzzle's leaves fails, which withholds fielding rather than granting it.
 */
export function judgeLabelling(puzzle: LabelTheLeavesPuzzle, attempt: unknown): boolean {
  if (!Array.isArray(attempt) || attempt.length !== leafCount(puzzle)) return false
  const declared = new Set(puzzle.items.map((item) => item.category))
  const labelling: LeafLabelling = attempt.map((label) =>
    typeof label === 'string' && declared.has(label) ? label : null,
  )
  return filedCorrectly(puzzle, labelling) >= puzzle.mark
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The ids a task declares, read out of a declaration that is still being checked.
 *
 * Defensive on purpose, and `undefined` rather than an empty list where there is nothing
 * to read. A kind's checker runs in the same pass that checks the task's own categories and
 * features, so a task that declares neither reports that where it belongs — and a puzzle
 * held against a vocabulary of nothing would report every name it uses as invented, which
 * would leave an author guessing which of two refusals to fix.
 */
function declaredIds(list: unknown): readonly string[] | undefined {
  if (!Array.isArray(list)) return undefined
  const ids = list.flatMap((entry) =>
    isRecord(entry) && typeof entry.id === 'string' ? [entry.id] : [],
  )
  return ids.length === 0 ? undefined : ids
}

function malformed(field: string, message: string): ValidationIssue {
  return { code: 'malformed-puzzle', field, message }
}

/**
 * Refuses puzzle data this kind could not pose, naming what is wrong with it.
 *
 * Everything here is a defect an author can only have introduced by hand, and every one of
 * them would otherwise surface as a puzzle that renders half a tree or files an item
 * nowhere. Checked before winnability, so one defect is reported once.
 */
export function checkPuzzle(
  puzzle: unknown,
  at: string,
  declaration: TaskDeclaration,
): readonly ValidationIssue[] {
  if (!isRecord(puzzle)) return [malformed(at, `Field "${at}" must be an object.`)]

  const issues: ValidationIssue[] = []
  const features = declaredIds(declaration.features)
  const categories = declaredIds(declaration.categories)

  const questions = Array.isArray(puzzle.questions) ? puzzle.questions : undefined
  if (questions === undefined || questions.length === 0) {
    issues.push(
      malformed(
        `${at}.questions`,
        `Field "${at}.questions" must be a non-empty list: a puzzle asking nothing poses one leaf and teaches nothing.`,
      ),
    )
  }

  /** The features some declared question actually reads, for the two checks that need it. */
  const asked = new Set<string>()
  /**
   * Whether every declared question could be read at all.
   *
   * The two checks over an item's values both turn on the *set* of features the tree asks
   * about, so a single unreadable question would make every value on every item look either
   * missing or unasked. One defect, one refusal: below, those two checks wait until the
   * questions are sound.
   */
  let questionsReadable = questions !== undefined && questions.length > 0

  questions?.forEach((question, index) => {
    const where = `${at}.questions[${index}]`
    if (!isRecord(question)) {
      issues.push(malformed(where, `Field "${where}" must be an object.`))
      questionsReadable = false
      return
    }
    if (typeof question.feature !== 'string' || question.feature === '') {
      issues.push(malformed(`${where}.feature`, `Field "${where}.feature" must name a feature.`))
      questionsReadable = false
    } else {
      asked.add(question.feature)
      if (features !== undefined && !features.includes(question.feature)) {
        issues.push({
          code: 'undeclared-feature',
          field: `${where}.feature`,
          message: `The puzzle asks about feature ${JSON.stringify(question.feature)}, which this task does not measure.`,
        })
      }
    }
    if (typeof question.threshold !== 'number' || !Number.isFinite(question.threshold)) {
      issues.push(
        malformed(
          `${where}.threshold`,
          `Field "${where}.threshold" must be a number; found ${JSON.stringify(question.threshold)}.`,
        ),
      )
    }
  })

  const items = Array.isArray(puzzle.items) ? puzzle.items : undefined
  if (items === undefined || items.length === 0) {
    issues.push(
      malformed(
        `${at}.items`,
        `Field "${at}.items" must be a non-empty list: a puzzle with nothing to file cannot be tested or judged.`,
      ),
    )
  }

  items?.forEach((item, index) => {
    const where = `${at}.items[${index}]`
    if (!isRecord(item)) {
      issues.push(malformed(where, `Field "${where}" must be an object.`))
      return
    }
    const named = typeof item.image === 'string' && item.image !== '' ? item.image : String(index)
    if (typeof item.image !== 'string' || item.image === '') {
      issues.push(malformed(`${where}.image`, `Field "${where}.image" must name a pool image.`))
    }
    if (typeof item.category !== 'string' || item.category === '') {
      issues.push(malformed(`${where}.category`, `Field "${where}.category" must name a category.`))
    } else if (categories !== undefined && !categories.includes(item.category)) {
      issues.push({
        code: 'undeclared-category',
        field: `${where}.category`,
        message: `Image ${JSON.stringify(named)} is declared as category ${JSON.stringify(item.category)}, which this task does not declare.`,
      })
    }

    const values = isRecord(item.features) ? item.features : undefined
    if (values === undefined) {
      issues.push(
        malformed(`${where}.features`, `Field "${where}.features" must be an object of measured values.`),
      )
      return
    }
    if (!questionsReadable) return
    for (const feature of asked) {
      if (typeof values[feature] !== 'number' || !Number.isFinite(values[feature] as number)) {
        issues.push({
          code: 'missing-measured-value',
          field: `${where}.features.${feature}`,
          message: `Image ${JSON.stringify(named)} declares no value for feature ${JSON.stringify(feature)}, which a declared question asks about, so it could not be filed.`,
        })
      }
    }
    for (const feature of Object.keys(values)) {
      // Not merely unused: a value on screen for a feature no question reads is the panel
      // of numbers this puzzle deliberately does not show, and it is the drift risk the
      // pinning test would then have to cover for nothing.
      if (asked.has(feature)) continue
      issues.push({
        code: 'unasked-measured-value',
        field: `${where}.features.${feature}`,
        message: `Image ${JSON.stringify(named)} declares a value for feature ${JSON.stringify(feature)}, which no declared question asks about.`,
      })
    }
  })

  if (typeof puzzle.mark !== 'number' || !Number.isInteger(puzzle.mark) || puzzle.mark < 1) {
    issues.push(
      malformed(
        `${at}.mark`,
        `Field "${at}.mark" must be a whole number of at least one; found ${JSON.stringify(puzzle.mark)}. A mark of none is a gate that opens on any answer.`,
      ),
    )
  }

  return issues
}

/**
 * Whether the declared data admits an answer that clears the mark — and whether it leaves
 * anything to get wrong.
 *
 * Both directions refuse at load, because both are authored mistakes a screen could not
 * explain. A mark nothing reaches locks a student out of a family they have bought; a
 * puzzle whose best labelling files everything correctly has removed the lesson, which is
 * that a correctly labelled tree still gets a piece of fruit wrong. The measurement it
 * takes to notice the second is exactly the measurement done here.
 */
export function winnableLeaves(puzzle: LabelTheLeavesPuzzle): Winnability {
  const best = bestLabelling(puzzle)
  if (best.correct < puzzle.mark) {
    return {
      ok: false,
      cause: `the best labelling of its leaves files ${best.correct} of ${puzzle.items.length} correctly, short of the declared mark of ${puzzle.mark}.`,
    }
  }
  if (best.correct === puzzle.items.length) {
    return {
      ok: false,
      cause: `the best labelling of its leaves files every one of its ${puzzle.items.length} correctly, so it leaves nothing for the given questions to get wrong — which is the lesson.`,
    }
  }
  return { ok: true }
}

/** The kind, as the frame requires it: check the shape, then whether it can be solved, then judge. */
export const labelTheLeaves: TutorialKind = {
  check: checkPuzzle,
  winnable: (puzzle) => winnableLeaves(puzzle as LabelTheLeavesPuzzle),
  judge: (puzzle, attempt) => judgeLabelling(puzzle as LabelTheLeavesPuzzle, attempt),
}

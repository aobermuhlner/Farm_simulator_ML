/**
 * The leaf-labelling puzzle as an engine: what it refuses, where it files things, what the
 * best labelling of it is, and what passes.
 *
 * Every one of those is a pure function of declared data, and the tests are written over a
 * small hand-made puzzle rather than over the shipped one. The shipped puzzle is authored
 * data and is pinned separately; a suite that could only exercise the engine through it
 * would confuse a defect in the code with a defect in the authoring.
 */

import { describe, expect, it } from 'vitest'
import type { TaskDeclaration } from '../src/task/types.js'
import {
  bestLabelling,
  checkPuzzle,
  filedCorrectly,
  itemsByLeaf,
  judgeLabelling,
  LABEL_THE_LEAVES,
  labelTheLeaves,
  leafCount,
  leafOf,
  winnableLeaves,
  type LabelTheLeavesPuzzle,
} from '../src/tutorials/index.js'
import { appleDeclaration } from './helpers/apple.js'

const task: TaskDeclaration = appleDeclaration()

/**
 * A three-leaf puzzle over the shipped task's vocabulary, with one item misfiled.
 *
 * Deliberately the same *shape* as the shipped one and none of its numbers: two questions,
 * three leaves, a leaf whose majority is one category and whose minority is another.
 */
function puzzle(over: Partial<LabelTheLeavesPuzzle> = {}): LabelTheLeavesPuzzle {
  return {
    questions: [
      { feature: 'darkSpotArea', threshold: 0.02 },
      { feature: 'redness', threshold: 0.45 },
    ],
    items: [
      { image: 'a-1', category: 'wormy', features: { darkSpotArea: 0.06, redness: 0.47 } },
      { image: 'a-2', category: 'wormy', features: { darkSpotArea: 0.05, redness: 0.48 } },
      { image: 'a-3', category: 'red', features: { darkSpotArea: 0, redness: 0.52 } },
      { image: 'a-4', category: 'red', features: { darkSpotArea: 0, redness: 0.51 } },
      { image: 'a-5', category: 'wormy', features: { darkSpotArea: 0, redness: 0.49 } },
      { image: 'a-6', category: 'green', features: { darkSpotArea: 0, redness: -0.42 } },
    ],
    mark: 5,
    ...over,
  }
}

function causes(over: Partial<Record<string, unknown>>): readonly string[] {
  const broken = { ...puzzle(), ...over } as unknown
  return checkPuzzle(broken, 'tutorial.puzzle', task).map(
    (issue) => `${issue.code} ${issue.field ?? ''} ${issue.message}`,
  )
}

describe('a question means what it means in the rule search', () => {
  it('is a feature and a threshold, and nothing else', () => {
    // The type is `RuleSplit`, so a threshold read off one screen and applied on another
    // cannot mean two things. This is the assertion that the reuse is real rather than a
    // coincidence of field names.
    const [first] = puzzle().questions

    expect(Object.keys(first ?? {}).sort()).toEqual(['feature', 'threshold'])
  })

  it('poses one more leaf than there are questions', () => {
    expect(leafCount(puzzle())).toBe(3)
    expect(leafCount(puzzle({ questions: [{ feature: 'redness', threshold: 0 }] }))).toBe(2)
  })
})

describe('what the checker refuses', () => {
  it('accepts the sound puzzle, so every refusal below is a real one', () => {
    expect(checkPuzzle(puzzle(), 'tutorial.puzzle', task)).toEqual([])
  })

  it('refuses a puzzle that is not an object at all', () => {
    expect(causes({}).length).toBe(0)
    expect(checkPuzzle('a tree', 'tutorial.puzzle', task)).toHaveLength(1)
  })

  it('refuses a puzzle declaring no questions', () => {
    expect(causes({ questions: [] }).join(' ')).toContain('tutorial.puzzle.questions')
    expect(causes({ questions: undefined }).join(' ')).toContain('tutorial.puzzle.questions')
  })

  it('refuses a question naming a feature the task does not measure, naming it', () => {
    const issues = causes({
      questions: [{ feature: 'stalkLength', threshold: 0.5 }],
    })

    expect(issues.join(' ')).toContain('undeclared-feature')
    expect(issues.join(' ')).toContain('stalkLength')
  })

  it('refuses a threshold that is not a number, naming what was found', () => {
    const issues = causes({
      questions: [{ feature: 'redness', threshold: 'quite red' }],
    })

    expect(issues.join(' ')).toContain('tutorial.puzzle.questions[0].threshold')
    expect(issues.join(' ')).toContain('quite red')
  })

  it('refuses an item naming a category the task does not declare, naming both', () => {
    const issues = causes({
      items: [{ image: 'a-9', category: 'speckled', features: { darkSpotArea: 0, redness: 0 } }],
    })

    expect(issues.join(' ')).toContain('undeclared-category')
    expect(issues.join(' ')).toContain('speckled')
    expect(issues.join(' ')).toContain('a-9')
  })

  it('refuses an item missing a value a question reads, naming the image and the feature', () => {
    const issues = causes({
      items: [{ image: 'a-9', category: 'red', features: { darkSpotArea: 0 } }],
    })

    expect(issues.join(' ')).toContain('missing-measured-value')
    expect(issues.join(' ')).toContain('a-9')
    expect(issues.join(' ')).toContain('redness')
  })

  it('refuses a declared value for a feature no question asks about, naming it', () => {
    // The puzzle shows the values it declares, and a value for a feature the tree never
    // reads is the panel of numbers this puzzle deliberately does not put on screen.
    const issues = causes({
      items: [
        {
          image: 'a-9',
          category: 'red',
          features: { darkSpotArea: 0, redness: 0.5, spotCount: 3 },
        },
      ],
    })

    expect(issues.join(' ')).toContain('unasked-measured-value')
    expect(issues.join(' ')).toContain('spotCount')
  })

  it('refuses a puzzle with nothing to file, and a mark that is not a count', () => {
    expect(causes({ items: [] }).join(' ')).toContain('tutorial.puzzle.items')
    for (const mark of ['eight', 0, -1, 2.5, undefined]) {
      expect(causes({ mark }).join(' '), String(mark)).toContain('tutorial.puzzle.mark')
    }
  })

  it('says nothing about a declaration that declares no vocabulary to hold it to', () => {
    // The checker runs in the same pass that checks the task's own categories and features,
    // so a task that declares neither reports that where it belongs. Holding the puzzle
    // against a vocabulary of nothing would report every name it uses as invented, and an
    // author would have two refusals for one defect.
    expect(checkPuzzle(puzzle(), 'tutorial.puzzle', {} as unknown as TaskDeclaration)).toEqual([])
  })

  it('reports one unreadable question once, rather than once per value of every item', () => {
    // Both checks over an item's values turn on the set of features the tree asks about, so
    // a question nobody can read would otherwise make every value look either missing or
    // unasked — nine items' worth of noise for one defect.
    const issues = causes({
      questions: [{ threshold: 0.02 }, { feature: 'redness', threshold: 0.45 }],
    })

    expect(issues.join(' ')).toContain('tutorial.puzzle.questions[0].feature')
    expect(issues.join(' ')).not.toContain('missing-measured-value')
    expect(issues.join(' ')).not.toContain('unasked-measured-value')
  })
})

describe('where one item is filed', () => {
  const questions = puzzle().questions

  it('stops at the leaf of the first question it answers yes to', () => {
    expect(leafOf(questions, { darkSpotArea: 0.06, redness: 0.99 })).toBe(0)
  })

  it('reaches the final leaf when it answers no to every question', () => {
    expect(leafOf(questions, { darkSpotArea: 0.02, redness: 0.45 })).toBe(2)
    expect(leafOf(questions, { darkSpotArea: 0, redness: -1 })).toBe(2)
  })

  it('files every declared item in exactly one leaf, and none nowhere', () => {
    const leaves = itemsByLeaf(puzzle())
    const filed = leaves.flatMap((leaf) => leaf.map((item) => item.image))

    expect(leaves).toHaveLength(3)
    expect(filed.sort()).toEqual(puzzle().items.map((item) => item.image).sort())
    expect(new Set(filed).size).toBe(filed.length)
  })

  it('files on the declared questions and the declared values alone', () => {
    expect(itemsByLeaf(puzzle()).map((leaf) => leaf.map((item) => item.image))).toEqual([
      ['a-1', 'a-2'],
      ['a-3', 'a-4', 'a-5'],
      ['a-6'],
    ])
  })
})

describe('the best labelling', () => {
  it('gives each leaf the category most of what lands in it truly is', () => {
    const best = bestLabelling(puzzle())

    expect(best.labelling).toEqual(['wormy', 'red', 'green'])
    expect(best.correct).toBe(5)
  })

  it('does not depend on the order the leaves are walked in', () => {
    // A leaf's best label depends on nothing but the items reaching it, which is what makes
    // the maximum exact rather than a search. So the answer must survive the items being
    // declared in any order, and every leaf's label must be reachable without looking at
    // another leaf.
    const shuffled = puzzle({ items: [...puzzle().items].reverse() })

    expect(bestLabelling(shuffled)).toEqual(bestLabelling(puzzle()))
  })

  it('leaves one leaf’s label alone when another leaf’s items change', () => {
    const elsewhere = puzzle({
      items: [
        ...puzzle().items.filter((item) => item.image !== 'a-6'),
        { image: 'a-7', category: 'wormy', features: { darkSpotArea: 0, redness: -0.4 } },
      ],
    })
    const best = bestLabelling(elsewhere)

    expect(best.labelling.slice(0, 2)).toEqual(['wormy', 'red'])
    expect(best.labelling[2]).toBe('wormy')
  })

  it('leaves a leaf nothing reaches unlabelled, with nothing to be wrong about', () => {
    const unreached = puzzle({
      questions: [
        { feature: 'darkSpotArea', threshold: 9 },
        { feature: 'redness', threshold: 0.45 },
      ],
    })
    const best = bestLabelling(unreached)

    expect(best.labelling[0]).toBeNull()
    expect(best.correct).toBe(4)
  })

  it('reports both the labelling and what it files correctly', () => {
    const best = bestLabelling(puzzle())

    expect(filedCorrectly(puzzle(), best.labelling)).toBe(best.correct)
  })
})

describe('whether a puzzle can be won at all', () => {
  it('accepts one that clears its mark while still misfiling something', () => {
    expect(winnableLeaves(puzzle())).toEqual({ ok: true })
  })

  it('refuses a mark the best labelling cannot reach, naming both numbers', () => {
    const result = winnableLeaves(puzzle({ mark: 6 }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.cause).toContain('5')
    expect(result.cause).toContain('6')
  })

  it('refuses one whose best labelling files everything correctly', () => {
    // The lesson is that a correctly labelled tree still gets something wrong. A puzzle
    // with nothing to get wrong has removed it, and no screen could say so.
    const clean = puzzle({
      items: puzzle().items.filter((item) => item.image !== 'a-5'),
      mark: 5,
    })
    const result = winnableLeaves(clean)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.cause).toContain('nothing')
  })

  it('is what the frame asks, so both refusals reach a declaration', () => {
    expect(labelTheLeaves.winnable(puzzle({ mark: 9 })).ok).toBe(false)
    expect(labelTheLeaves.winnable(puzzle()).ok).toBe(true)
  })
})

describe('judging one labelling', () => {
  it('passes a labelling that files at least the mark correctly', () => {
    expect(judgeLabelling(puzzle(), ['wormy', 'red', 'green'])).toBe(true)
    expect(judgeLabelling(puzzle({ mark: 3 }), ['wormy', 'red', null])).toBe(true)
  })

  it('fails one below the mark', () => {
    expect(judgeLabelling(puzzle(), ['red', 'wormy', 'green'])).toBe(false)
    expect(judgeLabelling(puzzle(), [null, null, null])).toBe(false)
  })

  it('answers a boolean and nothing else, so no count leaves the function', () => {
    for (const answer of [['wormy', 'red', 'green'], ['red', 'red', 'red'], 'nonsense', 7, null]) {
      expect(typeof judgeLabelling(puzzle(), answer)).toBe('boolean')
    }
  })

  it('fails an answer that is not a labelling of this puzzle’s leaves', () => {
    // Withholding fielding rather than granting it is the safe direction for anything
    // arriving from a screen.
    expect(judgeLabelling(puzzle(), ['wormy', 'red'])).toBe(false)
    expect(judgeLabelling(puzzle(), ['wormy', 'red', 'green', 'red'])).toBe(false)
    expect(judgeLabelling(puzzle(), ['wormy', 'red', 'speckled'])).toBe(false)
    expect(judgeLabelling(puzzle(), undefined)).toBe(false)
  })

  it('is what the frame judges by, under the kind’s registered name', () => {
    expect(LABEL_THE_LEAVES).toBe('label-the-leaves')
    expect(labelTheLeaves.judge(puzzle(), ['wormy', 'red', 'green'])).toBe(true)
    expect(labelTheLeaves.judge(puzzle(), ['green', 'green', 'green'])).toBe(false)
  })
})

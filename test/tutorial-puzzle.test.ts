/**
 * The authored puzzle: that it loads, that its numbers are the pool's, and that it still
 * teaches what it was chosen to teach.
 *
 * Three separate obligations, and they fail differently on purpose. The first is the
 * validator's and would catch a puzzle that cannot be posed. The second pins the copied
 * measurements against `pools/apple-harvest/manifest.json`, the way
 * `test/features-ladder.test.ts` pins its figures — a regenerated pool moves the numbers
 * and this is what says so out loud. The third is the one that matters most and is easiest
 * to lose: the set of nine was chosen because the best labelling of these leaves *still
 * gets one apple wrong*, and a well-meant swap that removed the misfiled apple would leave
 * a puzzle that validates, passes, and no longer has a lesson in it.
 *
 * See openspec/changes/fitted-tree-tutorial/specs/fitted-tree-tutorial/spec.md.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateDeclaration } from '../src/task/validate.js'
import {
  bestLabelling,
  checkPuzzle,
  itemsByLeaf,
  judgeLabelling,
  LABEL_THE_LEAVES,
  leafCount,
  leafOf,
  winnableLeaves,
  type LabelTheLeavesPuzzle,
  type LeafPuzzleItem,
} from '../src/tutorials/index.js'
import { appleDeclaration } from './helpers/apple.js'
import { rawTwoFamilyTask, SHIPS_MODEL, SHIPS_PREDICTIONS } from './helpers/families.js'
import { leafPuzzle, leafTutorial, LEAF_TUTORIAL_PATH } from './helpers/leaves.js'

const task = appleDeclaration()

/** What the pool records for every image, so the copies can be checked against it. */
interface ManifestImage {
  readonly category: string
  readonly features: Readonly<Record<string, number>>
}

function manifest(): Readonly<Record<string, ManifestImage>> {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'pools/apple-harvest/manifest.json'), 'utf8'),
  ) as { readonly images: Readonly<Record<string, ManifestImage>> }
  return raw.images
}

/**
 * Every disagreement between a declared value and the pool's, named in full.
 *
 * A boolean would not be enough here: whoever reads this failure is deciding whether to
 * re-copy one number or to pick nine new apples, and that decision needs the image, the
 * feature, what the puzzle claims and what the pool actually recorded.
 */
function drifted(puzzle: LabelTheLeavesPuzzle): readonly string[] {
  const images = manifest()
  const found: string[] = []
  for (const item of puzzle.items) {
    const recorded = images[item.image]
    if (recorded === undefined) {
      found.push(`${item.image} is not in the pool at all`)
      continue
    }
    if (recorded.category !== item.category) {
      found.push(
        `${item.image} is declared as "${item.category}" and the pool records "${recorded.category}"`,
      )
    }
    for (const [feature, declared] of Object.entries(item.features)) {
      const actual = recorded.features[feature]
      if (actual !== declared) {
        found.push(
          `${item.image} declares ${feature} = ${declared} and the pool records ${String(actual)}`,
        )
      }
    }
  }
  return found
}

describe('the authored puzzle is declared data the validator accepts', () => {
  it('is committed where the change that ships its family will pick it up', () => {
    expect(LEAF_TUTORIAL_PATH).toBe('declarations/tutorials/label-the-leaves.json')
    expect(leafTutorial().kind).toBe(LABEL_THE_LEAVES)
  })

  it('passes its own kind’s checker against the task it belongs to', () => {
    expect(checkPuzzle(leafPuzzle(), 'tutorial.puzzle', task)).toEqual([])
  })

  it('loads on a family of that task, through the shipped registry', () => {
    // Through `validateDeclaration` and the registry the browser loads, rather than by
    // calling the kind directly: the envelope, the puzzle and the winnability check are
    // three layers and this is the only assertion that they agree.
    const result = validateDeclaration(
      rawTwoFamilyTask([{ ...SHIPS_PREDICTIONS, tutorial: leafTutorial() }, SHIPS_MODEL]),
    )

    expect(result.ok, result.ok ? '' : result.issues.map((issue) => issue.message).join(' ')).toBe(
      true,
    )
  })

  it('asks two questions and poses three leaves', () => {
    const puzzle = leafPuzzle()

    expect(puzzle.questions).toHaveLength(2)
    expect(leafCount(puzzle)).toBe(3)
    expect(puzzle.items).toHaveLength(9)
  })

  it('is winnable, and winnable only because it is not perfect', () => {
    expect(winnableLeaves(leafPuzzle())).toEqual({ ok: true })

    const best = bestLabelling(leafPuzzle())

    expect(best.correct).toBe(leafPuzzle().mark)
    expect(best.correct).toBeLessThan(leafPuzzle().items.length)
  })

  it('declares only the values its own questions ask about', () => {
    const asked = leafPuzzle().questions.map((question) => question.feature)

    for (const item of leafPuzzle().items) {
      expect(Object.keys(item.features).sort()).toEqual([...asked].sort())
    }
  })
})

describe('the copied measurements are the pool’s', () => {
  it('agrees with the shipped manifest, image by image and feature by feature', () => {
    expect(drifted(leafPuzzle())).toEqual([])
  })

  it('names the image, the feature, the declared value and the recorded one when one drifts', () => {
    // The check has to be seen to fail, or a green suite says nothing about whether it
    // would notice a regenerated pool.
    const puzzle = leafPuzzle()
    const [first, ...rest] = puzzle.items as readonly LeafPuzzleItem[]
    const edited = {
      ...puzzle,
      items: [
        { ...(first as LeafPuzzleItem), features: { ...first?.features, redness: 0.1234 } },
        ...rest,
      ],
    } as LabelTheLeavesPuzzle

    const found = drifted(edited)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain(first?.image ?? '')
    expect(found[0]).toContain('redness')
    expect(found[0]).toContain('0.1234')
    expect(found[0]).toContain(String(first?.features.redness))
  })

  it('would notice an image that left the pool, and a category that changed under it', () => {
    const puzzle = leafPuzzle()
    const [first] = puzzle.items as readonly LeafPuzzleItem[]

    expect(
      drifted({ ...puzzle, items: [{ ...(first as LeafPuzzleItem), image: 't-000' }] }).join(' '),
    ).toContain('not in the pool')
    expect(
      drifted({
        ...puzzle,
        items: [{ ...(first as LeafPuzzleItem), category: 'green' }],
      }).join(' '),
    ).toContain('the pool records')
  })
})

describe('the nine still exhibit the lesson', () => {
  it('is labelled best as one leaf per category, in the order the questions pose them', () => {
    expect(bestLabelling(leafPuzzle()).labelling).toEqual(['wormy', 'red', 'green'])
  })

  it('files eight of the nine correctly and no more', () => {
    const best = bestLabelling(leafPuzzle())

    expect(best.correct).toBe(8)
    expect(leafPuzzle().items).toHaveLength(9)
    expect(judgeLabelling(leafPuzzle(), best.labelling)).toBe(true)
  })

  it('misfiles exactly one, and it is a wormy apple sitting in the leaf the reds reach', () => {
    // This is the whole reason the set is these nine. The escapee measures no dark patch at
    // all while being wormy, which is `measured-features`' contamination in one photograph —
    // and it has to come from the held-out images, because no apple among the fitted ones
    // escapes this tree.
    const puzzle = leafPuzzle()
    const best = bestLabelling(puzzle)
    const misfiled = puzzle.items.filter(
      (item) => best.labelling[leafOf(puzzle.questions, item.features)] !== item.category,
    )

    expect(misfiled).toHaveLength(1)
    const [escapee] = misfiled
    expect(escapee?.category).toBe('wormy')
    expect(leafOf(puzzle.questions, escapee?.features ?? {})).toBe(1)
    expect(best.labelling[1]).toBe('red')
    expect(escapee?.features.darkSpotArea).toBe(0)
  })

  it('fails if the escapee is swapped for one the tree gets right', () => {
    // A well-meant tidy-up that replaced it with a red apple would leave a puzzle that
    // validates, passes, and teaches nothing. The winnability check is what refuses it, and
    // this is the assertion that the refusal reaches this puzzle rather than only a fixture.
    const puzzle = leafPuzzle()
    const tidied = {
      ...puzzle,
      items: puzzle.items.map((item) =>
        item.features.darkSpotArea === 0 && item.category === 'wormy'
          ? { ...item, category: 'red' as const }
          : item,
      ),
    }

    expect(bestLabelling(tidied).correct).toBe(9)
    expect(winnableLeaves(tidied).ok).toBe(false)
  })

  it('draws its apples from both roles, so the set does not read as a special case', () => {
    const images = manifest() as Readonly<Record<string, { readonly role?: string }>>
    const roles = new Set(leafPuzzle().items.map((item) => images[item.image]?.role))

    expect(roles.size).toBeGreaterThan(1)
  })

  it('leaves every leaf with something in it, so none is unlabellable', () => {
    for (const leaf of itemsByLeaf(leafPuzzle())) expect(leaf.length).toBeGreaterThan(0)
  })
})

describe('what the puzzle says about itself', () => {
  const tutorial = leafTutorial()

  it('states that the questions were given and that the real model chooses its own', () => {
    expect(tutorial.disclosure).toContain('given')
    expect(tutorial.disclosure).toMatch(/chooses its own/)
    expect(tutorial.disclosure).toMatch(/questions/)
  })

  it('claims nowhere that the puzzle is the model', () => {
    const copy = [tutorial.teaching.summary, tutorial.teaching.theory, tutorial.disclosure].join(
      ' ',
    )

    // The puzzle introduces the model; it is not it. A tutorial that said otherwise would be
    // the simplification going undisclosed in the one sentence meant to disclose it.
    expect(copy).not.toMatch(/this is the model|you have (just )?built (a|the) model/i)
    expect(copy).not.toMatch(/trains|training the model/i)
  })

  it('offers no way to change a question, so what is disclosed and what is on screen agree', () => {
    // Nothing in the declared data admits a changed question: the questions are the
    // puzzle's, not the attempt's, and an attempt is a labelling of leaves and nothing else.
    expect(judgeLabelling(leafPuzzle(), { questions: [], labelling: ['wormy'] })).toBe(false)
  })

  it('carries the copy the frame presents, all four pieces of it', () => {
    expect(tutorial.id).not.toBe('')
    expect(tutorial.title).not.toBe('')
    expect(tutorial.teaching.summary.length).toBeGreaterThan(20)
    expect(tutorial.teaching.theory.length).toBeGreaterThan(20)
    expect(tutorial.disclosure.length).toBeGreaterThan(20)
  })
})

/**
 * The registry, the judge, and the one check that has to see across declarations.
 *
 * The discipline being asserted here is that nothing in `src/tutorials/` knows a family
 * from another: the key is the kind, the judge answers a boolean and nothing more, and the
 * agreement check reads ids rather than families.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { TaskDeclaration } from '../src/task/types.js'
import { validateDeclaration } from '../src/task/validate.js'
import {
  isTutorialComplete,
  judgeAttempt,
  LABEL_THE_LEAVES,
  labelTheLeaves,
  TUTORIAL_KINDS,
  tutorialAgreementIssues,
  tutorialKind,
} from '../src/tutorials/index.js'
import { rawTwoFamilyTask, SHIPS_MODEL, SHIPS_PREDICTIONS } from './helpers/families.js'
import { FIXTURE_ANSWER, FIXTURE_KIND, fixtureKinds, fixtureTutorial } from './helpers/tutorials.js'

function taskWith(tutorial: unknown, id = 'two-family-task'): TaskDeclaration {
  const result = validateDeclaration(
    { ...rawTwoFamilyTask([{ ...SHIPS_PREDICTIONS, tutorial }, SHIPS_MODEL]), id },
    { tutorialKinds: fixtureKinds },
  )
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return result.declaration
}

describe('the registry is keyed by kind and by nothing else', () => {
  it('carries the kinds this build poses, and nothing a test invented', () => {
    // One shipped kind, found by the name a declaration would give. The fixture kind is
    // deliberately not in here: a test-only puzzle in the shipped registry would be a
    // puzzle a student could reach.
    expect(Object.keys(TUTORIAL_KINDS)).toEqual([LABEL_THE_LEAVES])
    expect(tutorialKind(LABEL_THE_LEAVES)).toBe(labelTheLeaves)
    expect(tutorialKind(FIXTURE_KIND)).toBeUndefined()
  })

  it('is what a declaration carrying the shipped kind reaches', () => {
    // Not "unrecognised" any more: the kind is registered, so the puzzle data is handed to
    // its checker and refused on its own terms.
    const issues = validateDeclaration(
      rawTwoFamilyTask([
        { ...SHIPS_PREDICTIONS, tutorial: fixtureTutorial({ kind: LABEL_THE_LEAVES, puzzle: {} }) },
        SHIPS_MODEL,
      ]),
    )

    expect(issues.ok).toBe(false)
    if (issues.ok) return
    expect(issues.issues.some((issue) => issue.code === 'unknown-tutorial-kind')).toBe(false)
    expect(issues.issues.some((issue) => issue.code === 'malformed-puzzle')).toBe(true)
  })

  it('finds a kind in the registry it is handed', () => {
    expect(tutorialKind(FIXTURE_KIND, fixtureKinds)).toBeDefined()
    expect(tutorialKind('drag-the-apples', fixtureKinds)).toBeUndefined()
  })

  it('is not fooled by a name every object carries', () => {
    expect(tutorialKind('constructor', fixtureKinds)).toBeUndefined()
    expect(tutorialKind('toString', fixtureKinds)).toBeUndefined()
  })

  it('names no family, in the registry or anywhere else under src/tutorials', () => {
    const here = fileURLToPath(new URL('.', import.meta.url))
    const source = readFileSync(`${here}../src/tutorials/index.ts`, 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    for (const familyId of [SHIPS_PREDICTIONS.id, SHIPS_MODEL.id]) {
      expect(code).not.toContain(familyId)
    }
    expect(code).not.toContain(FIXTURE_KIND)
  })
})

describe('judging an attempt', () => {
  const tutorial = fixtureTutorial()

  it('passes the declared answer and fails everything else', () => {
    expect(judgeAttempt(tutorial, FIXTURE_ANSWER, fixtureKinds)).toBe(true)
    expect(judgeAttempt(tutorial, 'green', fixtureKinds)).toBe(false)
    expect(judgeAttempt(tutorial, undefined, fixtureKinds)).toBe(false)
  })

  it('answers a boolean and nothing else, so there is nowhere to record a score', () => {
    expect(typeof judgeAttempt(tutorial, FIXTURE_ANSWER, fixtureKinds)).toBe('boolean')
  })

  it('fails rather than passes when the kind is not registered', () => {
    // Unreachable in a loaded build — the declaration was refused — so the safe answer is
    // the one that withholds fielding rather than granting it.
    expect(judgeAttempt(tutorial, FIXTURE_ANSWER, {})).toBe(false)
  })
})

describe('whether a family is covered', () => {
  it('counts a family declaring no tutorial as covered', () => {
    expect(isTutorialComplete(undefined, [])).toBe(true)
  })

  it('counts a family whose id is among the passed as covered', () => {
    expect(isTutorialComplete(fixtureTutorial(), ['pick-the-red-one'])).toBe(true)
    expect(isTutorialComplete(fixtureTutorial(), ['something-else'])).toBe(false)
    expect(isTutorialComplete(fixtureTutorial(), [])).toBe(false)
  })
})

describe('one id, one puzzle — across tasks as well as within one', () => {
  it('accepts two tasks declaring the identical tutorial', () => {
    const tasks = [taskWith(fixtureTutorial(), 'first'), taskWith(fixtureTutorial(), 'second')]

    expect(tutorialAgreementIssues(tasks)).toEqual([])
  })

  it('refuses two tasks declaring one id with different content, naming both tasks', () => {
    const tasks = [
      taskWith(fixtureTutorial(), 'first'),
      taskWith(fixtureTutorial({ title: 'Which one is ripe?' }), 'second'),
    ]

    const issues = tutorialAgreementIssues(tasks)

    expect(issues).toHaveLength(1)
    const [only] = issues
    expect(only?.code).toBe('disagreeing-tutorial')
    expect(only?.message).toContain('pick-the-red-one')
    expect(only?.message).toContain('first')
    expect(only?.message).toContain('second')
  })

  it('has nothing to say about tasks that declare no tutorial at all', () => {
    const plain = validateDeclaration(rawTwoFamilyTask())
    expect(plain.ok).toBe(true)
    if (!plain.ok) return

    expect(tutorialAgreementIssues([plain.declaration])).toEqual([])
  })
})

/**
 * A tutorial as declared data, and what the validator refuses.
 *
 * Three layers, and each is checked here separately, because a defect in one must not be
 * reported as a defect in another: the envelope is the frame's, the puzzle's shape is the
 * kind's, and whether the puzzle can be solved at all is the kind's too. The last is the
 * one that has to be caught at load, because a student locked out by authored data is
 * locked out somewhere no screen can explain.
 */

import { describe, expect, it } from 'vitest'
import { validateDeclaration } from '../src/task/validate.js'
import { TUTORIAL_KINDS } from '../src/tutorials/index.js'
import { appleDeclaration } from './helpers/apple.js'
import { rawTwoFamilyTask, SHIPS_MODEL, SHIPS_PREDICTIONS } from './helpers/families.js'
import { FIXTURE_KIND, fixtureKinds, fixtureTutorial } from './helpers/tutorials.js'

/** The two-family task with a tutorial hung on whichever family the test cares about. */
function taskWith(tutorial: unknown, onSecondFamily: unknown = undefined): Record<string, unknown> {
  return rawTwoFamilyTask([
    { ...SHIPS_PREDICTIONS, tutorial },
    onSecondFamily === undefined ? SHIPS_MODEL : { ...SHIPS_MODEL, tutorial: onSecondFamily },
  ])
}

function issuesOf(declaration: Record<string, unknown>): readonly string[] {
  const result = validateDeclaration(declaration, { tutorialKinds: fixtureKinds })
  if (result.ok) return []
  return result.issues.map((issue) => `${issue.code} ${issue.field ?? ''} ${issue.message}`)
}

describe('the shipped game is untouched by this change', () => {
  it('declares no tutorial on any family, so the gate is inert', () => {
    // `model-tutorials` ships the frame; `fitted-tree-tutorial` ships the first puzzle.
    // Until then a gate on a shipped family would be a wall, so there is none.
    for (const family of appleDeclaration().families) expect(family.tutorial).toBeUndefined()
  })

  it('validates against the registry the browser actually loads', () => {
    // Not the fixture registry: the shipped declaration has to load in a build carrying no
    // kinds at all, which is the build this change produces.
    expect(validateDeclaration(rawTwoFamilyTask()).ok).toBe(true)
    const shipped = validateDeclaration(
      JSON.parse(JSON.stringify(appleDeclaration())) as unknown,
    )
    expect(shipped.ok).toBe(true)
  })
})

describe('a family may declare a tutorial, and may not', () => {
  it('accepts a family that declares none, which is every family shipped today', () => {
    const shipped = appleDeclaration()

    for (const family of shipped.families) expect(family.tutorial).toBeUndefined()
    expect(validateDeclaration(rawTwoFamilyTask()).ok).toBe(true)
  })

  it('reads the declared tutorial back off the family', () => {
    const result = validateDeclaration(taskWith(fixtureTutorial()), {
      tutorialKinds: fixtureKinds,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const tutorial = result.declaration.families[0]?.tutorial
    expect(tutorial?.id).toBe('pick-the-red-one')
    expect(tutorial?.title).toBe('Which one is the red one?')
    expect(tutorial?.teaching.theory).toContain('turning what is seen')
  })

  it('refuses a tutorial that is not an object', () => {
    expect(issuesOf(taskWith('a puzzle'))).toContainEqual(
      expect.stringContaining('families[0].tutorial'),
    )
  })
})

describe('the envelope the frame needs', () => {
  it.each(['id', 'title', 'teaching', 'disclosure', 'kind', 'puzzle'] as const)(
    'refuses a tutorial missing "%s", naming the family and the field',
    (field) => {
      const { [field]: _dropped, ...rest } = fixtureTutorial() as unknown as Record<
        string,
        unknown
      >

      const issues = issuesOf(taskWith(rest))

      expect(issues).toContainEqual(expect.stringContaining(`families[0].tutorial.${field}`))
      expect(issues.join(' ')).toContain(SHIPS_PREDICTIONS.id)
    },
  )

  it('refuses teaching copy that is missing its theory', () => {
    const issues = issuesOf(
      taskWith(fixtureTutorial({ teaching: { summary: 'Say which one.' } as never })),
    )

    expect(issues).toContainEqual(expect.stringContaining('families[0].tutorial.teaching.theory'))
  })

  it.each(['id', 'title', 'disclosure', 'kind'] as const)('refuses an empty "%s"', (field) => {
    expect(issuesOf(taskWith(fixtureTutorial({ [field]: '' } as never)))).toContainEqual(
      expect.stringContaining(`families[0].tutorial.${field}`),
    )
  })
})

describe('what a tutorial simplifies', () => {
  it('is carried by the declaration and read back off it', () => {
    const result = validateDeclaration(taskWith(fixtureTutorial()), {
      tutorialKinds: fixtureKinds,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.declaration.families[0]?.tutorial?.disclosure).toContain('the real thing')
  })

  it('is a field of its own, so theory copy cannot stand in for it', () => {
    // A tutorial whose theory says what it withholds and whose own field does not is
    // refused: the theory sits behind a disclosure, and this sentence must not.
    const { disclosure: _dropped, ...rest } = fixtureTutorial() as unknown as Record<
      string,
      unknown
    >
    const theoryInstead = {
      ...rest,
      teaching: {
        summary: 'Say which of these the robot should crate.',
        theory: 'You are given three words to choose between; the real thing has to find them.',
      },
    }

    const issues = issuesOf(taskWith(theoryInstead))

    expect(issues).toContainEqual(expect.stringContaining('families[0].tutorial.disclosure'))
    expect(issues.join(' ')).toContain(SHIPS_PREDICTIONS.id)
  })

  it('leaves the refusal for missing theory copy naming the theory copy', () => {
    // The two are separate obligations, and a defect in one must not be reported as a
    // defect in the other.
    const { teaching: _dropped, ...rest } = fixtureTutorial() as unknown as Record<
      string,
      unknown
    >

    const issues = issuesOf(taskWith(rest))

    expect(issues).toContainEqual(expect.stringContaining('families[0].tutorial.teaching'))
    expect(issues.join(' ')).not.toContain('tutorial.disclosure')
  })
})

describe('a kind is held to the task’s own vocabulary', () => {
  it('is handed the declaration of the task the family belongs to', () => {
    // Read from the task the puzzle actually hangs on rather than from a copy: a category
    // declared by some other task is not a category this puzzle's answer means anything in.
    const declared = rawTwoFamilyTask().categories as readonly { readonly id: string }[]

    expect(issuesOf(taskWith(fixtureTutorial({ puzzle: { options: ['a'], answer: 'a', category: declared[0]?.id } })))).toEqual([])
  })

  it('refuses a puzzle naming a category the task does not declare, naming both', () => {
    const issues = issuesOf(
      taskWith(fixtureTutorial({ puzzle: { options: ['a'], answer: 'a', category: 'speckled' } })),
    )

    expect(issues.join(' ')).toContain('speckled')
    expect(issues.join(' ')).toContain(SHIPS_PREDICTIONS.id)
    expect(issues).toContainEqual(expect.stringContaining('families[0].tutorial.puzzle.category'))
  })

  it('refuses a puzzle naming a feature the task does not measure, naming both', () => {
    const issues = issuesOf(
      taskWith(fixtureTutorial({ puzzle: { options: ['a'], answer: 'a', feature: 'stalkLength' } })),
    )

    expect(issues.join(' ')).toContain('stalkLength')
    expect(issues.join(' ')).toContain(SHIPS_PREDICTIONS.id)
    expect(issues).toContainEqual(expect.stringContaining('families[0].tutorial.puzzle.feature'))
  })

  it('accepts a feature the task does measure, so the refusal above is a real check', () => {
    const declared = rawTwoFamilyTask().features as readonly { readonly id: string }[]

    expect(
      issuesOf(taskWith(fixtureTutorial({ puzzle: { options: ['a'], answer: 'a', feature: declared[0]?.id } }))),
    ).toEqual([])
  })
})

describe('a kind this build does not carry', () => {
  it('is refused naming the kind, rather than ignored', () => {
    const issues = issuesOf(taskWith(fixtureTutorial({ kind: 'drag-the-apples' })))

    expect(issues.join(' ')).toContain('unknown-tutorial-kind')
    expect(issues.join(' ')).toContain('drag-the-apples')
  })

  it('is what the fixture kind is against the registry the browser loads', () => {
    // The shipped registry carries the kinds this build poses and nothing a test invented,
    // so a fixture puzzle is refused there — which is what makes injecting the registry the
    // only way to exercise the frame.
    expect(Object.keys(TUTORIAL_KINDS)).not.toContain(FIXTURE_KIND)

    const result = validateDeclaration(taskWith(fixtureTutorial()))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((issue) => issue.code === 'unknown-tutorial-kind')).toBe(true)
  })
})

describe('the puzzle, once its kind has it', () => {
  it('is refused with the kind’s own cause when it is malformed', () => {
    const issues = issuesOf(
      taskWith(fixtureTutorial({ puzzle: { options: [], answer: 'red' } })),
    )

    expect(issues).toContainEqual(expect.stringContaining('families[0].tutorial.puzzle.options'))
  })

  it('is not also reported as unwinnable when it is merely malformed', () => {
    // Two causes for one defect would leave an author guessing which to fix.
    const issues = issuesOf(taskWith(fixtureTutorial({ puzzle: { options: ['red'] } })))

    expect(issues.join(' ')).not.toContain('unwinnable-tutorial')
  })

  it('is refused at load when nothing solves it, naming the family and the cause', () => {
    const issues = issuesOf(
      taskWith(fixtureTutorial({ puzzle: { options: ['green', 'wormy'], answer: 'red' } })),
    )

    expect(issues.join(' ')).toContain('unwinnable-tutorial')
    expect(issues.join(' ')).toContain('pick-the-red-one')
    expect(issues.join(' ')).toContain(SHIPS_PREDICTIONS.id)
    expect(issues.join(' ')).toContain('"red"')
  })

  it('loads when something does solve it, so the refusal above is a real check', () => {
    expect(issuesOf(taskWith(fixtureTutorial()))).toEqual([])
  })
})

describe('one tutorial id means one puzzle', () => {
  it('accepts two families declaring the identical tutorial', () => {
    expect(issuesOf(taskWith(fixtureTutorial(), fixtureTutorial()))).toEqual([])
  })

  it('refuses two families declaring one id with different content, naming the id', () => {
    const issues = issuesOf(
      taskWith(fixtureTutorial(), fixtureTutorial({ title: 'Which one is the ripe one?' })),
    )

    expect(issues.join(' ')).toContain('disagreeing-tutorial')
    expect(issues.join(' ')).toContain('pick-the-red-one')
  })

  it('leaves two different ids alone', () => {
    expect(
      issuesOf(
        taskWith(
          fixtureTutorial(),
          fixtureTutorial({ id: 'pick-the-green-one', title: 'Which one is the green one?' }),
        ),
      ),
    ).toEqual([])
  })

  it('does not mind a kind it cannot check disagreeing about nothing', () => {
    // Guard against the agreement check being fooled by key order rather than content.
    const reordered = { ...fixtureTutorial() }
    const shuffled = {
      puzzle: reordered.puzzle,
      kind: reordered.kind,
      teaching: reordered.teaching,
      title: reordered.title,
      id: reordered.id,
    }

    expect(issuesOf(taskWith(reordered, shuffled)).join(' ')).toContain('disagreeing-tutorial')
  })
})

describe('the kind is what dispatch turns on, never the family', () => {
  it('checks two families of different kinds against their own kinds', () => {
    const issues = issuesOf(
      taskWith(
        fixtureTutorial(),
        fixtureTutorial({ id: 'second', kind: 'not-registered', title: 'Second' }),
      ),
    )

    expect(issues.join(' ')).toContain('not-registered')
    expect(issues.join(' ')).not.toContain(FIXTURE_KIND)
  })
})

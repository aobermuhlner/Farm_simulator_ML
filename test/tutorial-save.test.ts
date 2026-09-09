/**
 * What the save keeps about a tutorial, and the one stale reference it deliberately does
 * not drop.
 *
 * Two promises are load-bearing here and both are asserted directly rather than inferred:
 * that the save has nowhere to put a score, and that a completion whose declaration has
 * gone is kept rather than dropped — the single exception to "a reference this build no
 * longer declares is dropped", made because dropping it would cost a student a lesson they
 * already sat and buy nothing at all.
 */

import { describe, expect, it } from 'vitest'
import { credit, openFarm, toUnits } from '../src/economy/index.js'
import type { GameState, SaveContext } from '../src/save/index.js'
import {
  decodeSave,
  encodeSave,
  newGame,
  SAVE_SCHEMA_VERSION,
  SAVE_TUTORIAL_OUTSTANDING,
  serializeSave,
  parseSave,
} from '../src/save/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { validateDeclaration } from '../src/task/validate.js'
import { catalogWith, soundCatalog, testFarm } from './helpers/catalog.js'
import { rawTwoFamilyTask, SHIPS_MODEL, SHIPS_PREDICTIONS } from './helpers/families.js'
import { fixtureKinds, fixtureTutorial } from './helpers/tutorials.js'

const TUTORED = SHIPS_PREDICTIONS.id
const TUTORIAL = 'pick-the-red-one'

function taskWith(tutorial: unknown): TaskDeclaration {
  const result = validateDeclaration(
    rawTwoFamilyTask([{ ...SHIPS_PREDICTIONS, tutorial }, SHIPS_MODEL]),
    { tutorialKinds: fixtureKinds },
  )
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return result.declaration
}

const gated = taskWith(fixtureTutorial())
const ungated = (() => {
  const plain = validateDeclaration(rawTwoFamilyTask())
  if (!plain.ok) throw new Error('the plain two-family task should validate')
  return { ...plain.declaration, id: gated.id }
})()

const catalog = soundCatalog(catalogWith([]))

function contextFor(task: TaskDeclaration): SaveContext {
  return { declaration: testFarm, catalog, tasks: [task] }
}

/** A played farm with whatever tutorials and slots the case needs. */
function played(over: Partial<GameState> = {}): GameState {
  return {
    ...newGame(testFarm, catalog, () => 7),
    farm: credit(openFarm(testFarm), toUnits(50, 2), 'sales'),
    ...over,
  }
}

describe('what the save records about a tutorial', () => {
  it('opens a new farm with none passed', () => {
    expect(newGame(testFarm, catalog, () => 7).tutorials).toEqual([])
  })

  it('writes the ids passed, and reads them back', () => {
    const written = serializeSave(played({ tutorials: [TUTORIAL] }))

    const restored = parseSave(written, contextFor(gated))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    expect(restored.state.tutorials).toEqual([TUTORIAL])
  })

  it('records the id and nothing else — no score, no count, no timing', () => {
    const encoded = encodeSave(played({ tutorials: [TUTORIAL] })) as unknown as Record<
      string,
      unknown
    >

    expect(encoded.tutorials).toEqual([TUTORIAL])
    // Whatever the shape of the save grows into, a bare list of strings has nowhere to
    // put a number, which is the structural form of the promise.
    for (const entry of encoded.tutorials as readonly unknown[]) {
      expect(typeof entry).toBe('string')
    }
    expect(JSON.stringify(encoded)).not.toContain('attempts')
    expect(JSON.stringify(encoded)).not.toContain('score')
  })

  it('opens a save that records none with none passed, keeping the rest', () => {
    const { tutorials: _absent, ...withoutField } = encodeSave(
      played({ tutorials: [] }),
    ) as unknown as Record<string, unknown>

    const restored = decodeSave(withoutField, contextFor(gated))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    expect(restored.state.tutorials).toEqual([])
    expect(restored.state.seed).toBe(7)
  })

  it('resets on a record that is not a list of ids', () => {
    const raw = { ...encodeSave(played()), tutorials: [{ id: TUTORIAL, score: 3 }] }

    expect(decodeSave(raw, contextFor(gated)).kind).toBe('reset')
  })

  it('resets a save written at the schema this build replaced', () => {
    const raw = { ...encodeSave(played()), schemaVersion: '3.0.0' }

    const restored = decodeSave(raw, contextFor(gated))

    expect(restored.kind).toBe('reset')
    if (restored.kind !== 'reset') return
    expect(restored.cause.message).toContain('"3.0.0"')
    expect(restored.cause.message).toContain(SAVE_SCHEMA_VERSION)
  })
})

describe('the tutorial itself is a declaration, never save state', () => {
  it('shows rewritten copy on a restored farm without resetting what was passed', () => {
    const written = serializeSave(played({ tutorials: [TUTORIAL] }))
    const rewritten = taskWith(
      fixtureTutorial({
        title: 'Which of these does the robot crate?',
        teaching: { summary: 'Rewritten.', theory: 'Also rewritten.' },
      }),
    )

    const restored = parseSave(written, contextFor(rewritten))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    expect(restored.state.tutorials).toEqual([TUTORIAL])
    expect(JSON.stringify(encodeSave(restored.state))).not.toContain('Rewritten.')
  })
})

describe('a completion no declaration carries', () => {
  it('is kept rather than dropped, and nothing is reported about it', () => {
    const written = serializeSave(played({ tutorials: ['a-lesson-since-withdrawn'] }))

    const restored = parseSave(written, contextFor(ungated))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    expect(restored.state.tutorials).toEqual(['a-lesson-since-withdrawn'])
    expect(restored.dropped).toEqual([])
  })

  it('is found already satisfied when a declaration names that id again', () => {
    const written = serializeSave(played({ tutorials: [TUTORIAL] }))

    // Away, then back — the case a drop would silently make the student re-sit.
    const away = parseSave(written, contextFor(ungated))
    expect(away.kind).toBe('restored')
    if (away.kind !== 'restored') return

    const back = parseSave(serializeSave(away.state), contextFor(gated))

    expect(back.kind).toBe('restored')
    if (back.kind !== 'restored') return
    expect(back.state.tutorials).toContain(TUTORIAL)
  })
})

describe('a slot whose family has an unfinished tutorial', () => {
  // Both families declare a dataset knob, so an identifier they compose ends in the tier
  // it was fitted on.
  const atWork = { [gated.id]: { configurationId: 'depth1-datasetstarter', family: TUTORED } }

  it('reverts to the hands, reporting the tutorial in its own words', () => {
    const written = serializeSave(played({ slots: atWork, tutorials: [] }))

    const restored = parseSave(written, contextFor(gated))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    expect(restored.state.slots).toEqual({})
    expect(restored.dropped).toHaveLength(1)
    const [cause] = restored.dropped
    expect(cause?.code).toBe(SAVE_TUTORIAL_OUTSTANDING)
    expect(cause?.message).toContain('tutorial')
    expect(cause?.message).toContain('workshop')
  })

  it('is not reported as something this build cannot make', () => {
    const written = serializeSave(played({ slots: atWork, tutorials: [] }))

    const restored = parseSave(written, contextFor(gated))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    const [cause] = restored.dropped
    expect(cause?.code).not.toBe('save-reference-dropped')
    expect(cause?.message).not.toContain('can no longer make')
    expect(cause?.message).not.toContain('no longer declares')
  })

  it('keeps the rest of the save, the knob values for that family included', () => {
    const knobs = { [gated.id]: { [TUTORED]: { depth: 2 } } }
    const written = serializeSave(played({ slots: atWork, knobs, tutorials: [] }))

    const restored = parseSave(written, contextFor(gated))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    expect(restored.state.knobs).toEqual(knobs)
    expect(restored.state.farm.balance).toBe(played().farm.balance)
  })

  it('is kept once the tutorial has been passed', () => {
    const written = serializeSave(played({ slots: atWork, tutorials: [TUTORIAL] }))

    const restored = parseSave(written, contextFor(gated))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    expect(restored.state.slots).toEqual(atWork)
    expect(restored.dropped).toEqual([])
  })

  it('is untouched for a family that declares no tutorial', () => {
    const written = serializeSave(played({ slots: atWork, tutorials: [] }))

    const restored = parseSave(written, contextFor(ungated))

    expect(restored.kind).toBe('restored')
    if (restored.kind !== 'restored') return
    expect(restored.state.slots).toEqual(atWork)
  })
})

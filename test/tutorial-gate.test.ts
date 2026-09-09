/**
 * The gate: what an unfinished tutorial withholds, and what it leaves entirely alone.
 *
 * The scope split is the whole of the exception this change takes to *Ownership is the
 * only input to what is available*, so it is asserted from both sides here — availability
 * is untouched by a tutorial, and fielding is the one thing that is not.
 */

import { describe, expect, it } from 'vitest'
import { handBack, labourFor, putToWork, type LabourSlots } from '../src/labour/index.js'
import {
  computeAvailability,
  computeFieldability,
  familyAvailability,
  familyFieldability,
  taskAvailability,
  taskFieldability,
  withheldBy,
} from '../src/progression/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { validateDeclaration } from '../src/task/validate.js'
import { catalogWith, soundCatalog } from './helpers/catalog.js'
import { rawTwoFamilyTask, SHIPS_MODEL, SHIPS_PREDICTIONS } from './helpers/families.js'
import { fixtureKinds, fixtureTutorial } from './helpers/tutorials.js'

const TUTORED = SHIPS_PREDICTIONS.id
const UNTUTORED = SHIPS_MODEL.id
const TUTORIAL = 'pick-the-red-one'

/** One family declaring a tutorial, one declaring none — the two cases side by side. */
function gatedTask(): TaskDeclaration {
  const result = validateDeclaration(
    rawTwoFamilyTask([{ ...SHIPS_PREDICTIONS, tutorial: fixtureTutorial() }, SHIPS_MODEL]),
    { tutorialKinds: fixtureKinds },
  )
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return result.declaration
}

const task = gatedTask()
const tutored = task.families.find((family) => family.id === TUTORED)
const untutored = task.families.find((family) => family.id === UNTUTORED)
const catalog = soundCatalog(catalogWith([]))

describe('what a tutorial does not touch', () => {
  it('leaves availability a function of the catalog and what is owned', () => {
    const availability = computeAvailability(catalog, [task], [])
    const offered = taskAvailability(availability, task.id)

    expect(familyAvailability(offered, TUTORED)?.available).toBe(true)
    expect(familyAvailability(offered, UNTUTORED)?.available).toBe(true)
  })

  it('leaves every knob value exactly as selectable as it was', () => {
    const withTutorial = computeAvailability(catalog, [task], [])
    const plain = validateDeclaration(rawTwoFamilyTask())
    expect(plain.ok).toBe(true)
    if (!plain.ok) return
    const without = computeAvailability(catalog, [plain.declaration], [])

    expect(taskAvailability(withTutorial, task.id)?.knobs).toEqual(
      taskAvailability(without, plain.declaration.id)?.knobs,
    )
  })
})

describe('what an unfinished tutorial withholds', () => {
  it('reports the family as selectable and not fieldable', () => {
    const fieldability = computeFieldability([task], [])
    const offered = taskFieldability(fieldability, task.id)

    expect(familyFieldability(offered, TUTORED)).toEqual({
      familyId: TUTORED,
      fieldable: false,
      withheldBy: TUTORIAL,
    })
  })

  it('leaves a family declaring no tutorial fieldable from the first day', () => {
    const fieldability = computeFieldability([task], [])

    expect(familyFieldability(taskFieldability(fieldability, task.id), UNTUTORED)).toEqual({
      familyId: UNTUTORED,
      fieldable: true,
    })
    expect(withheldBy(fieldability, task.id, UNTUTORED)).toBeUndefined()
  })

  it('names the tutorial standing in the way, and stops naming it once it is passed', () => {
    expect(withheldBy(computeFieldability([task], []), task.id, TUTORED)).toBe(TUTORIAL)
    expect(withheldBy(computeFieldability([task], [TUTORIAL]), task.id, TUTORED)).toBeUndefined()
  })

  it('says nothing about a task or a family it has never heard of', () => {
    const fieldability = computeFieldability([task], [])

    expect(withheldBy(fieldability, 'another-task', TUTORED)).toBeUndefined()
    expect(withheldBy(fieldability, task.id, 'another-family')).toBeUndefined()
  })
})

describe('putting a model to work', () => {
  const model = { configurationId: 'depth1', family: TUTORED }

  it('is refused while the tutorial is outstanding, naming it', () => {
    const fielded = putToWork({}, task.id, model, { tutorial: tutored?.tutorial, completed: [] })

    expect(fielded.ok).toBe(false)
    if (fielded.ok) return
    expect(fielded.withheldBy).toBe(TUTORIAL)
  })

  it('leaves the slots exactly as they were when it refuses', () => {
    const before: LabourSlots = { [task.id]: { configurationId: 'depth1', family: UNTUTORED } }

    const fielded = putToWork(before, task.id, model, {
      tutorial: tutored?.tutorial,
      completed: [],
    })

    expect(fielded.ok).toBe(false)
    expect(labourFor(before, task.id)).toEqual({
      kind: 'model',
      model: { configurationId: 'depth1', family: UNTUTORED },
    })
  })

  it('succeeds once the tutorial is passed, with nothing else changed', () => {
    const fielded = putToWork({}, task.id, model, {
      tutorial: tutored?.tutorial,
      completed: [TUTORIAL],
    })

    expect(fielded.ok).toBe(true)
    if (!fielded.ok) return
    expect(labourFor(fielded.slots, task.id)).toEqual({ kind: 'model', model })
    // The one slot and nothing else: passing a tutorial fields a model, it does not open
    // a knob value, a catalog item or another family.
    expect(fielded.slots).toEqual({ [task.id]: model })
    expect(computeFieldability([task], [TUTORIAL])).toEqual({
      tasks: [
        {
          taskId: task.id,
          families: [
            { familyId: TUTORED, fieldable: true },
            { familyId: UNTUTORED, fieldable: true },
          ],
        },
      ],
    })
  })

  it('succeeds immediately for a family that declares no tutorial', () => {
    const fielded = putToWork(
      {},
      task.id,
      { configurationId: 'depth1', family: UNTUTORED },
      { tutorial: untutored?.tutorial, completed: [] },
    )

    expect(fielded.ok).toBe(true)
  })

  it('is not satisfied by having passed some other tutorial', () => {
    const fielded = putToWork({}, task.id, model, {
      tutorial: tutored?.tutorial,
      completed: ['pick-the-green-one'],
    })

    expect(fielded.ok).toBe(false)
  })
})

describe('handing the job back', () => {
  it('is never withheld, so a tutorial can never strand a model on a task', () => {
    // The case that would strand one: a model fielded before its family declared a
    // tutorial, and the declaration then gaining one.
    const stranded: LabourSlots = { [task.id]: { configurationId: 'depth1', family: TUTORED } }

    expect(labourFor(handBack(stranded, task.id), task.id)).toEqual({ kind: 'manual' })
  })
})

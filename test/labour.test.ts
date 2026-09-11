/**
 * Who works a card, and which cards are played at all.
 *
 * The interesting case is the empty one: a farm that has bought nothing still has a
 * complete labour assignment, because absence of a slot is the hands rather than a gap.
 */

import { describe, expect, it } from 'vitest'
import {
  configurationResolves,
  handBack,
  isAtWork,
  isPlayable,
  labourFor,
  playableTasks,
  putToWork,
  type FieldedModel,
  type LabourSlots,
} from '../src/labour/index.js'
import { computeAvailability, declaredValues } from '../src/progression/index.js'
import { configurationId } from '../src/task/configId.js'
import { firstFamily } from '../src/task/families.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple.js'
import { soundCatalog } from './helpers/catalog.js'

const apple = appleDeclaration()
const family = firstFamily(apple)
/** The family every slot below is made in. A slot without one is `save-codec`'s business. */
const FAMILY = family.id

/**
 * `putToWork` for a family that declares no tutorial, with the answer unwrapped.
 *
 * The apple family declares none, so every slot below is fielded ungated. The gate itself
 * has its own tests further down — this helper exists so that the questions about *who
 * works a card* are not each rewritten to unwrap a union they do not care about.
 */
function field(slots: LabourSlots, taskId: string, model: FieldedModel): LabourSlots {
  const fielded = putToWork(slots, taskId, model, { completed: [] })
  if (!fielded.ok) throw new Error(`Fielding was unexpectedly withheld by "${fielded.withheldBy}".`)
  return fielded.slots
}

describe('who brings a card’s crop in', () => {
  it('is the farm’s hands when there are no slots at all', () => {
    expect(labourFor(undefined, apple.id)).toEqual({ kind: 'manual' })
    expect(labourFor({}, apple.id)).toEqual({ kind: 'manual' })
    expect(isAtWork({}, apple.id)).toBe(false)
  })

  it('is the farm’s hands when the only slot is for another card', () => {
    const slots: LabourSlots = { 'another-task': { configurationId: 'blocks2-channels8', family: FAMILY } }

    expect(labourFor(slots, apple.id)).toEqual({ kind: 'manual' })
    expect(labourFor(slots, 'another-task')).toEqual({
      kind: 'model',
      model: { configurationId: 'blocks2-channels8', family: FAMILY },
    })
  })

  it('is the model in a filled slot', () => {
    const slots = field({}, apple.id, { configurationId: 'blocks2-channels16', family: FAMILY })

    expect(labourFor(slots, apple.id)).toEqual({
      kind: 'model',
      model: { configurationId: 'blocks2-channels16', family: FAMILY },
    })
    expect(isAtWork(slots, apple.id)).toBe(true)
  })

  it('hands the job back to the hands, leaving other cards alone', () => {
    const slots = field(
      field({}, apple.id, { configurationId: 'a', family: FAMILY }),
      'another-task',
      { configurationId: 'b', family: FAMILY },
    )

    const back = handBack(slots, apple.id)

    expect(labourFor(back, apple.id)).toEqual({ kind: 'manual' })
    expect(labourFor(back, 'another-task')).toEqual({
      kind: 'model',
      model: { configurationId: 'b', family: FAMILY },
    })
  })

  it('fills an empty slot with the model put to work, leaving other cards alone', () => {
    const before: LabourSlots = { 'another-task': { configurationId: 'b', family: FAMILY } }

    const after = field(before, apple.id, { configurationId: 'blocks3-channels32', family: FAMILY })

    expect(labourFor(after, apple.id)).toEqual({
      kind: 'model',
      model: { configurationId: 'blocks3-channels32', family: FAMILY },
    })
    expect(labourFor(after, 'another-task')).toEqual({
      kind: 'model',
      model: { configurationId: 'b', family: FAMILY },
    })
    // The slots handed in are not written through: a farm is replaced, never mutated.
    expect(before[apple.id]).toBeUndefined()
  })

  it('replaces the model in a filled slot rather than adding a second labour', () => {
    const first = field({}, apple.id, { configurationId: 'blocks2-channels8', family: FAMILY })
    const second = field(first, apple.id, { configurationId: 'blocks4-channels32', family: FAMILY })

    expect(labourFor(second, apple.id)).toEqual({
      kind: 'model',
      model: { configurationId: 'blocks4-channels32', family: FAMILY },
    })
    expect(Object.keys(second)).toEqual([apple.id])
  })

  it('is the hands for a card the stored slots hold no record for at all', () => {
    // What a save written before a card existed restores as, and what a card a declaration
    // has just added looks like: no entry, which is the hands rather than a gap.
    const stored: LabourSlots = { 'another-task': { configurationId: 'b', family: FAMILY } }

    expect(apple.id in stored).toBe(false)
    expect(labourFor(stored, apple.id)).toEqual({ kind: 'manual' })
    expect(isAtWork(stored, apple.id)).toBe(false)
  })

  it('names the family the model was made in, not only the configuration', () => {
    const slots = field({}, apple.id, { configurationId: 'x', family: FAMILY })

    expect(labourFor(slots, apple.id)).toEqual({
      kind: 'model',
      model: { configurationId: 'x', family: FAMILY },
    })
  })

  it('keeps two families of one identifier apart', () => {
    // The same string in two families is two models. A slot resolves to the one whose
    // family it names, and never to the other's.
    const here = field({}, apple.id, { configurationId: 'depth1', family: 'one' })
    const there = field({}, apple.id, { configurationId: 'depth1', family: 'two' })

    expect(labourFor(here, apple.id)).not.toEqual(labourFor(there, apple.id))
  })
})

const announced: TaskDeclaration = { ...apple, id: 'announced-task', available: false }

describe('which cards are played', () => {
  it('excludes a card the declaration only announces', () => {
    expect(isPlayable(announced)).toBe(false)
  })

  it('includes an available card that progression has not locked', () => {
    expect(isPlayable(apple)).toBe(true)
  })

  it('excludes a card whose every value of a knob progression still locks', () => {
    const knob = family.knobs[0]
    if (knob === undefined) throw new Error('the task must declare a knob')
    const values = [...declaredValues(knob)]
    expect(values.length).toBeGreaterThan(0)

    const catalog = soundCatalog({
      schemaVersion: '1.0.0',
      groups: [{ id: 'toolshed', label: 'Toolshed', soldAt: 'market' }],
      ownedAtStart: [],
      items: [
        {
          id: 'the-whole-knob',
          group: 'toolshed',
          label: 'The whole knob',
          copy: 'Opens every value this knob declares.',
          price: 5,
          opens: [{ kind: 'knob-values', task: apple.id, knob: knob.id, values }],
        },
      ],
    })

    const locked = computeAvailability(catalog, [apple], [])
    const owned = computeAvailability(catalog, [apple], ['the-whole-knob'])

    expect(isPlayable(apple, locked)).toBe(false)
    expect(isPlayable(apple, owned)).toBe(true)
  })

  it('is played when progression says nothing about its values at all', () => {
    // Two silences, and both open: no availability computed, and an availability computed
    // from a catalog that names nothing of this card. Nothing narrower than "the catalog
    // locks it" locks anything.
    const silent = computeAvailability(
      soundCatalog({
        schemaVersion: '1.0.0',
        groups: [{ id: 'toolshed', label: 'Toolshed', soldAt: 'market' }],
        ownedAtStart: [],
        items: [],
      }),
      [],
      [],
    )

    expect(isPlayable(apple)).toBe(true)
    expect(isPlayable(apple, silent)).toBe(true)
  })

  it('lists the playable cards in declared order and drops the rest', () => {
    expect(playableTasks([apple, announced]).map((task) => task.id)).toEqual([apple.id])
  })
})

/**
 * A slot records the configuration a model was made as, not the knob values behind it.
 *
 * `progression-catalog` guarantees that opening a value *extends* what can be selected and
 * reinterprets nothing already selected. Re-resolving knob values at harvest time would
 * launder that away: the same slot would mean a different model once the catalog moved.
 */
describe('opening a value changes what can be made, not what is at work', () => {
  /** A catalog whose one item opens every value of the task's first knob. */
  function gatedCatalog() {
    const knob = family.knobs[0]
    if (knob === undefined) throw new Error('the task must declare a knob')
    return soundCatalog({
      schemaVersion: '1.0.0',
      groups: [{ id: 'toolshed', label: 'Toolshed', soldAt: 'market' }],
      ownedAtStart: [],
      items: [
        {
          id: 'the-whole-knob',
          group: 'toolshed',
          label: 'The whole knob',
          copy: 'Opens every value this knob declares.',
          price: 5,
          opens: [
            { kind: 'knob-values', task: apple.id, knob: knob.id, values: [...declaredValues(knob)] },
          ],
        },
      ],
    })
  }

  it('leaves every slot resolving to the model it did', () => {
    const catalog = gatedCatalog()
    const slots = field(
      field({}, apple.id, { configurationId: 'blocks2-channels16', family: FAMILY }),
      'another-task',
      { configurationId: 'blocks3-channels8', family: FAMILY },
    )

    const before = computeAvailability(catalog, [apple], [])
    const after = computeAvailability(catalog, [apple], ['the-whole-knob'])

    // The purchase is what moved: the card goes from having no way through to being played.
    expect(isPlayable(apple, before)).toBe(false)
    expect(isPlayable(apple, after)).toBe(true)

    // The slots did not, and neither did what they resolve to.
    expect(labourFor(slots, apple.id)).toEqual({
      kind: 'model',
      model: { configurationId: 'blocks2-channels16', family: FAMILY },
    })
    expect(labourFor(slots, 'another-task')).toEqual({
      kind: 'model',
      model: { configurationId: 'blocks3-channels8', family: FAMILY },
    })
  })

  it('stores the configuration the model was made as, and no knob values', () => {
    const slots = field({}, apple.id, { configurationId: 'blocks2-channels16', family: FAMILY })
    const model = slots[apple.id]

    expect(model).toEqual({ configurationId: 'blocks2-channels16', family: FAMILY })
    expect(Object.keys(model ?? {}).sort()).toEqual(['configurationId', 'family'])
  })
})

/**
 * Composing and reading back are one round trip, and the declaration contract's separator
 * refusal is what makes it total: every identifier the task can compose reads back to the
 * values it came from. Exercised over the whole declared cross product rather than a
 * sample, because the failure this guards is one identifier in the set binding the wrong
 * value — which silently drops a student's model on restore.
 */
describe('an identifier reads back to the configuration it was composed from', () => {
  /** Every ordered set of knob values the task's declarations permit. */
  function declaredConfigurations(task: TaskDeclaration): (readonly [string, string | number])[][] {
    return firstFamily(task).knobs.reduce<(readonly [string, string | number])[][]>(
      (rows, knob) =>
        rows.flatMap((row) => declaredValues(knob).map((value) => [...row, [knob.id, value] as const])),
      [[]],
    )
  }

  it('resolves every configuration the shipped knobs can make', () => {
    const configurations = declaredConfigurations(apple)
    expect(configurations.length).toBe(
      family.knobs.reduce((count, knob) => count * declaredValues(knob).length, 1),
    )

    for (const values of configurations) {
      const id = configurationId({ taskId: apple.id, familyId: FAMILY, values })
      expect(configurationResolves(family, id), `${id} should resolve`).toBe(true)
    }
  })

  it('refuses an identifier naming a value the knobs do not permit', () => {
    const values = family.knobs.map((knob) => [knob.id, knob.default] as const)
    const withdrawn = configurationId({
      taskId: apple.id,
      familyId: FAMILY,
      values: values.map((pair, index) => (index === 0 ? ([pair[0], 99] as const) : pair)),
    })

    expect(configurationResolves(family, withdrawn)).toBe(false)
  })

  it('refuses an identifier with a knob missing, renamed, or added', () => {
    const values = family.knobs.map((knob) => [knob.id, knob.default] as const)

    expect(configurationResolves(family, configurationId({ taskId: apple.id, familyId: FAMILY, values: values.slice(1) }))).toBe(false)
    expect(
      configurationResolves(
        family,
        configurationId({
          taskId: apple.id,
          familyId: FAMILY,
          values: values.map((pair, index) => (index === 0 ? (['renamed', pair[1]] as const) : pair)),
        }),
      ),
    ).toBe(false)
    expect(
      configurationResolves(family, configurationId({ taskId: apple.id, familyId: FAMILY, values: [...values, ['extra', 1]] })),
    ).toBe(false)
    expect(configurationResolves(family, '')).toBe(false)
  })
})

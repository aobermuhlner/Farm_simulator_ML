/**
 * What a task's model families must declare, and what the validator refuses.
 *
 * Kept apart from `validate-declaration.test.ts`, which is about the fields describing the
 * *job*. This file is about the fields describing the *models doing it* — and about the
 * one property that makes several of them safe to have at once: everything a family owns
 * is scoped to that family, so two rungs of one ladder can share a knob name without
 * either resolving to the other.
 *
 * See openspec/changes/model-families/specs/model-families/spec.md.
 */

import { describe, expect, it } from 'vitest'
import { validateDeclaration } from '../src/task/validate.js'
import { rawTwoFamilyTask, SHIPS_MODEL, SHIPS_PREDICTIONS, twoFamilyTask } from './helpers/families'

function issuesOf(input: unknown): { code: string; field?: string; message: string }[] {
  const result = validateDeclaration(input)
  expect(result.ok).toBe(false)
  return result.ok ? [] : [...result.issues]
}

function messages(input: unknown): string {
  return issuesOf(input)
    .map((issue) => issue.message)
    .join(' ')
}

/** The two-family task with one family replaced by a patched copy of it. */
function withFamily(index: number, patch: Record<string, unknown>): Record<string, unknown> {
  const families = [{ ...SHIPS_PREDICTIONS }, { ...SHIPS_MODEL }] as Record<string, unknown>[]
  const family = families[index]
  if (family === undefined) throw new Error(`no family at ${index}`)
  families[index] = { ...family, ...patch }
  return rawTwoFamilyTask(families)
}

/** The two-family task with a field deleted from one family. */
function withoutFamilyField(index: number, field: string): Record<string, unknown> {
  const raw = withFamily(index, {})
  const families = raw.families as Record<string, unknown>[]
  delete (families[index] as Record<string, unknown>)[field]
  return raw
}

describe('a task declares at least one model family', () => {
  it('accepts a task declaring two of them', () => {
    const result = validateDeclaration(rawTwoFamilyTask())

    expect(result.ok ? [] : result.issues).toEqual([])
    expect(twoFamilyTask().families.map((family) => family.id)).toEqual([
      SHIPS_PREDICTIONS.id,
      SHIPS_MODEL.id,
    ])
  })

  it('refuses a task declaring none, naming the omission', () => {
    for (const families of [[], undefined]) {
      const raw = rawTwoFamilyTask()
      if (families === undefined) delete raw.families
      else raw.families = families

      const issues = issuesOf(raw)

      expect(issues.some((issue) => issue.field === 'families')).toBe(true)
      expect(issues.map((issue) => issue.message).join(' ')).toContain('families')
    }
  })

  it('refuses two families sharing an id, naming that id', () => {
    const raw = rawTwoFamilyTask([SHIPS_PREDICTIONS, { ...SHIPS_MODEL, id: SHIPS_PREDICTIONS.id }])

    const issues = issuesOf(raw)

    expect(issues.some((issue) => issue.code === 'duplicate-id')).toBe(true)
    expect(issues.map((issue) => issue.message).join(' ')).toContain(`"${SHIPS_PREDICTIONS.id}"`)
  })

  it('refuses a family missing any of the fields every family must carry', () => {
    for (const field of ['id', 'label', 'ships', 'knobs', 'teaching', 'slot']) {
      const issues = issuesOf(withoutFamilyField(0, field))

      expect(
        issues.map((issue) => issue.field),
        `omitting "${field}" should be reported`,
      ).toContain(`families[0].${field}`)
    }
  })

  it('refuses a family that declares nothing to recognise it by in a slot', () => {
    for (const slot of [{ icon: '' }, { label: 'Only a label' }, { icon: 'x' }]) {
      const issues = issuesOf(withFamily(0, { slot }))
      expect(issues.some((issue) => issue.field?.startsWith('families[0].slot'))).toBe(true)
    }
  })
})

describe('a family declares what it ships', () => {
  it('accepts the two supported forms and no others', () => {
    expect(validateDeclaration(rawTwoFamilyTask()).ok).toBe(true)
  })

  it('refuses a form the system does not support, naming what was declared', () => {
    const issues = issuesOf(withFamily(0, { ships: 'live' }))

    expect(issues.some((issue) => issue.code === 'unknown-shipped-form')).toBe(true)
    expect(issues.map((issue) => issue.message).join(' ')).toContain('"live"')
  })

  it('refuses a family declaring nothing at all, naming the field', () => {
    const issues = issuesOf(withoutFamilyField(0, 'ships'))

    expect(issues.map((issue) => issue.field)).toContain('families[0].ships')
  })

  it('refuses a prediction-shipping family naming no artifact', () => {
    const issues = issuesOf(withoutFamilyField(0, 'predictions'))

    expect(issues.map((issue) => issue.field)).toContain('families[0].predictions')
    expect(issues.map((issue) => issue.message).join(' ')).toContain('"predictions"')
  })

  it('refuses a model-shipping family naming no models', () => {
    const issues = issuesOf(withoutFamilyField(1, 'models'))

    expect(issues.map((issue) => issue.field)).toContain('families[1].models')
  })

  it('reads the shipped form from the declaration rather than from what is present', () => {
    // A family that ships its model, with an artifact path sitting beside it, still ships
    // its model: adding a file is not a way of changing how a family predicts.
    const raw = withFamily(1, { predictions: 'artifacts/two-family/fitted-net' })
    const result = validateDeclaration(raw)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.declaration.families[1]?.ships).toBe('model')
  })
})

describe('a knob belongs to its family and to no other', () => {
  it('lets two families of one task declare a knob with the same id', () => {
    const task = twoFamilyTask()
    const [first, second] = task.families

    expect(first?.knobs.map((knob) => knob.id)).toEqual(second?.knobs.map((knob) => knob.id))
    expect(validateDeclaration(rawTwoFamilyTask()).ok).toBe(true)
  })

  it('refuses one family declaring the same knob twice, naming the family and the id', () => {
    const knobs = [...SHIPS_PREDICTIONS.knobs, ...SHIPS_PREDICTIONS.knobs]
    const issues = issuesOf(withFamily(0, { knobs }))

    expect(issues.some((issue) => issue.code === 'duplicate-id')).toBe(true)
    const message = issues.map((issue) => issue.message).join(' ')
    expect(message).toContain(SHIPS_PREDICTIONS.id)
    expect(message).toContain('"depth"')
  })

  it('names the family in a separator refusal, as well as the knob and the id', () => {
    const issues = issuesOf(
      withFamily(1, { knobs: [{ ...SHIPS_MODEL.knobs[0], id: 'a-b' }] }),
    )

    expect(issues.some((issue) => issue.code === 'separator-in-identifier')).toBe(true)
    const message = issues.map((issue) => issue.message).join(' ')
    expect(message).toContain(SHIPS_MODEL.id)
    expect(message).toContain('"a-b"')
  })

  it('names the family in a separator refusal about a declared value', () => {
    const issues = issuesOf(
      withFamily(1, {
        knobs: [{ ...SHIPS_MODEL.knobs[0], values: ['one', 'two-three'], default: 'one' }],
      }),
    )

    expect(issues.some((issue) => issue.code === 'separator-in-identifier')).toBe(true)
    const message = issues.map((issue) => issue.message).join(' ')
    expect(message).toContain(SHIPS_MODEL.id)
    expect(message).toContain('two-three')
  })
})

describe('a family draws its own architecture and nobody else’s', () => {
  const DRAWN = {
    kind: 'cnn',
    blocksKnob: 'depth',
    channelsKnob: 'depth',
    inputSize: 128,
    channelsShown: { '1': 2, '2': 3 },
  }

  it('accepts a diagram naming knobs its own family declares', () => {
    expect(validateDeclaration(withFamily(0, { diagram: DRAWN })).ok).toBe(true)
  })

  it('refuses a diagram naming a knob only another family declares, naming both', () => {
    // The second family gets a knob of its own; the first family's diagram names it.
    const families = [
      { ...SHIPS_PREDICTIONS, diagram: { ...DRAWN, blocksKnob: 'stages' } },
      {
        ...SHIPS_MODEL,
        knobs: [
          {
            kind: 'choice',
            id: 'stages',
            label: 'Stages',
            values: [1, 2],
            default: 1,
            help: 'How many stages the chain has.',
          },
        ],
      },
    ]

    const issues = issuesOf(rawTwoFamilyTask(families))

    expect(issues.some((issue) => issue.code === 'unknown-knob')).toBe(true)
    const message = issues.map((issue) => issue.message).join(' ')
    expect(message).toContain('"stages"')
    expect(message).toContain(SHIPS_PREDICTIONS.id)
  })
})

describe('a history is declared, or there is none', () => {
  it('accepts a family that records none, and gives it no axis', () => {
    const task = twoFamilyTask()

    expect(task.families[1]?.history).toBeUndefined()
    expect(validateDeclaration(rawTwoFamilyTask()).ok).toBe(true)
  })

  it('refuses a declared history with nothing to call its axis', () => {
    for (const history of [{}, { axis: '' }, { axis: 3 }]) {
      const issues = issuesOf(withFamily(1, { history }))

      expect(
        issues.map((issue) => issue.field),
        `${JSON.stringify(history)} should be reported`,
      ).toContain('families[1].history.axis')
    }
  })

  it('carries the declared axis through, in the words the declaration uses', () => {
    expect(twoFamilyTask().families[0]?.history?.axis).toBe(SHIPS_PREDICTIONS.history.axis)
    expect(SHIPS_PREDICTIONS.history.axis).not.toBe('epoch')
  })
})

describe('a family declares which of its knobs selects its photographs', () => {
  it('accepts the two-family task, where both families name their own', () => {
    const result = validateDeclaration(rawTwoFamilyTask())
    expect(result.ok ? [] : result.issues).toEqual([])
    for (const family of twoFamilyTask().families) {
      expect(family.datasetKnob).toBe('dataset')
      expect(family.knobs.map((knob) => knob.id)).toContain(family.datasetKnob)
    }
  })

  it('refuses a family declaring none, naming the family and the field', () => {
    const issues = issuesOf(withoutFamilyField(0, 'datasetKnob'))
    const missing = issues.find((issue) => issue.field === 'families[0].datasetKnob')
    expect(missing?.code).toBe('missing-field')
    expect(missing?.message).toContain(SHIPS_PREDICTIONS.id)
    expect(missing?.message).toContain('datasetKnob')
  })

  it('refuses one naming a knob the family does not declare, naming both', () => {
    const issues = issuesOf(withFamily(1, { datasetKnob: 'photographs' }))
    const unknown = issues.find((issue) => issue.code === 'unknown-dataset-knob')
    expect(unknown?.message).toContain(SHIPS_MODEL.id)
    expect(unknown?.message).toContain('photographs')
  })

  it('refuses a dataset knob permitting a value that names no declared tier', () => {
    const knobs = [
      ...SHIPS_PREDICTIONS.knobs.filter((knob) => knob.id !== 'dataset'),
      {
        kind: 'choice',
        id: 'dataset',
        label: 'Photographs',
        values: ['starter', 'borrowed'],
        default: 'starter',
        help: 'Which set of photographs it was fitted on.',
      },
    ]
    const issues = issuesOf(withFamily(0, { knobs }))
    const unknown = issues.find((issue) => issue.code === 'unknown-dataset-tier')
    expect(unknown?.message).toContain('borrowed')
    expect(unknown?.message).toContain(SHIPS_PREDICTIONS.id)
  })

  it('refuses a dataset knob defaulting to anything but the smallest tier', () => {
    const knobs = [
      ...SHIPS_PREDICTIONS.knobs.filter((knob) => knob.id !== 'dataset'),
      {
        kind: 'choice',
        id: 'dataset',
        label: 'Photographs',
        values: ['starter', 'checked'],
        default: 'checked',
        help: 'Which set of photographs it was fitted on.',
      },
    ]
    const issue = issuesOf(withFamily(0, { knobs })).find(
      (entry) => entry.code === 'dataset-knob-default',
    )
    expect(issue?.message).toContain('checked')
    expect(issue?.message).toContain('starter')
  })

  it('refuses a slider as the dataset knob, since a dataset is named rather than measured', () => {
    const knobs = [
      ...SHIPS_PREDICTIONS.knobs.filter((knob) => knob.id !== 'dataset'),
      {
        kind: 'slider',
        id: 'dataset',
        label: 'Photographs',
        min: 0,
        max: 2,
        step: 1,
        default: 0,
        help: 'Which set of photographs it was fitted on.',
      },
    ]
    const issue = issuesOf(withFamily(0, { knobs })).find(
      (entry) => entry.code === 'dataset-knob-not-a-choice',
    )
    expect(issue?.message).toContain(SHIPS_PREDICTIONS.id)
  })
})

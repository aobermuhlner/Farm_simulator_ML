import { describe, expect, it } from 'vitest'
import { REQUIRED_FIELDS, validateDeclaration } from '../src/task/validate.js'
import { loadRawDeclaration } from './helpers/load-raw'

const apple = loadRawDeclaration('apple-harvest')

/** The shipped declaration with one field removed. */
function without(field: string): Record<string, unknown> {
  const copy: Record<string, unknown> = structuredClone(apple)
  delete copy[field]
  return copy
}

/** The shipped declaration with one field replaced. */
function withField(field: string, value: unknown): Record<string, unknown> {
  const copy: Record<string, unknown> = structuredClone(apple)
  copy[field] = value
  return copy
}

function issuesOf(input: unknown): { code: string; field?: string; message: string }[] {
  const result = validateDeclaration(input)
  expect(result.ok).toBe(false)
  return result.ok ? [] : [...result.issues]
}

describe('declaration completeness', () => {
  it('accepts the shipped apple declaration', () => {
    const result = validateDeclaration(apple)
    expect(result.ok ? [] : result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('refuses a declaration missing any required field, naming that field', () => {
    for (const field of REQUIRED_FIELDS) {
      const issues = issuesOf(without(field))
      const missing = issues.filter((issue) => issue.code === 'missing-field')
      expect(
        missing.map((issue) => issue.field),
        `omitting "${field}" should be reported`,
      ).toContain(field)
      expect(missing.some((issue) => issue.message.includes(`"${field}"`))).toBe(true)
    }
  })

  it('reports the omission as a configuration error rather than throwing', () => {
    expect(() => validateDeclaration(without('payoffs'))).not.toThrow()
  })

  it('refuses input that is not an object at all', () => {
    for (const input of [null, undefined, 42, 'apple-harvest', []]) {
      expect(validateDeclaration(input).ok).toBe(false)
    }
  })

  it('requires teaching copy at the task level', () => {
    const fields = issuesOf(withField('teaching', { summary: 'only a summary' })).map((i) => i.field)
    expect(fields).toContain('teaching.theory')
  })
})

describe('categories, actions and their mapping', () => {
  it('rejects a declaration with fewer than two categories', () => {
    const issues = issuesOf(withField('categories', [{ id: 'red', label: 'Ripe red apple' }]))
    expect(issues.some((i) => i.code === 'too-few' && i.field === 'categories')).toBe(true)
  })

  it('rejects a declaration with fewer than two actions', () => {
    const issues = issuesOf(withField('actions', [{ id: 'pick', label: 'Pick it' }]))
    expect(issues.some((i) => i.code === 'too-few' && i.field === 'actions')).toBe(true)
  })

  it('rejects a category that is not mapped to any action', () => {
    const issues = issuesOf(withField('categoryActions', { red: 'pick', green: 'decline' }))
    expect(issues.some((i) => i.code === 'unmapped-category')).toBe(true)
    expect(issues.some((i) => i.message.includes('"wormy"'))).toBe(true)
  })

  it('rejects a mapping that points at an action the task never declared', () => {
    const issues = issuesOf(
      withField('categoryActions', { red: 'pick', green: 'decline', wormy: 'incinerate' }),
    )
    expect(issues.some((i) => i.code === 'unknown-action')).toBe(true)
    expect(issues.some((i) => i.message.includes('incinerate'))).toBe(true)
  })

  it('rejects a mapping key that is not a declared category', () => {
    const issues = issuesOf(
      withField('categoryActions', {
        red: 'pick',
        green: 'decline',
        wormy: 'decline',
        bruised: 'decline',
      }),
    )
    expect(issues.some((i) => i.code === 'unknown-category')).toBe(true)
  })

  it('rejects duplicate category ids', () => {
    const issues = issuesOf(
      withField('categories', [
        { id: 'red', label: 'Ripe red apple' },
        { id: 'red', label: 'Also red' },
        { id: 'green', label: 'Unripe green apple' },
      ]),
    )
    expect(issues.some((i) => i.code === 'duplicate-id')).toBe(true)
  })

  it('accepts a task whose categories and actions are unrelated to apples', () => {
    const screening = {
      ...apple,
      id: 'skin-screening',
      title: 'Skin Disease Screening',
      categories: [
        { id: 'healthy', label: 'Healthy' },
        { id: 'diseased', label: 'Diseased' },
      ],
      actions: [
        { id: 'flag', label: 'Flag for the vet' },
        { id: 'pass', label: 'Pass' },
      ],
      categoryActions: { healthy: 'pass', diseased: 'flag' },
      payoffs: {
        healthy: { flag: -5, pass: 0 },
        diseased: { flag: -5, pass: -500 },
      },
    }
    const result = validateDeclaration(screening)
    expect(result.ok ? [] : result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })
})

describe('payoff table completeness', () => {
  it('rejects a table missing one combination, naming that combination', () => {
    const partial = structuredClone(apple.payoffs) as Record<string, Record<string, number>>
    delete partial.wormy?.pick
    const issues = issuesOf(withField('payoffs', partial))
    const incomplete = issues.filter((i) => i.code === 'incomplete-payoff-table')
    expect(incomplete).toHaveLength(1)
    expect(incomplete[0]?.message).toContain('"wormy"')
    expect(incomplete[0]?.message).toContain('"pick"')
  })

  it('rejects a table missing an entire category row', () => {
    const partial = structuredClone(apple.payoffs) as Record<string, unknown>
    delete partial.green
    const issues = issuesOf(withField('payoffs', partial))
    expect(issues.filter((i) => i.code === 'incomplete-payoff-table')).toHaveLength(2)
  })

  it('rejects a non-numeric payoff cell', () => {
    const partial = structuredClone(apple.payoffs) as Record<string, Record<string, unknown>>
    if (partial.red) partial.red.pick = 'a lot'
    const issues = issuesOf(withField('payoffs', partial))
    expect(issues.some((i) => i.field === 'payoffs.red.pick')).toBe(true)
  })
})

describe('decision policy declaration', () => {
  it('rejects a declaration with no policy, as incomplete', () => {
    const issues = issuesOf(without('policy'))
    expect(issues.some((i) => i.code === 'missing-field' && i.field === 'policy')).toBe(true)
  })

  it('rejects an unknown policy kind, naming the kinds it knows', () => {
    const issues = issuesOf(withField('policy', { kind: 'coin-flip' }))
    const unknown = issues.find((i) => i.code === 'unknown-policy')
    expect(unknown?.message).toContain('coin-flip')
    expect(unknown?.message).toContain('highest-probability')
  })

  it('requires a threshold policy to cover every category and declare a fallback', () => {
    const issues = issuesOf(
      withField('policy', { kind: 'threshold', thresholds: { red: 0.6 } }),
    )
    expect(issues.map((i) => i.field)).toContain('policy.thresholds.green')
    expect(issues.map((i) => i.field)).toContain('policy.thresholds.wormy')
    expect(issues.map((i) => i.field)).toContain('policy.fallbackAction')
  })

  it('accepts a well-formed threshold policy', () => {
    const result = validateDeclaration(
      withField('policy', {
        kind: 'threshold',
        thresholds: { red: 0.6, green: 0.5, wormy: 0.2 },
        fallbackAction: 'decline',
      }),
    )
    expect(result.ok ? [] : result.issues).toEqual([])
  })
})

describe('knob declarations', () => {
  it('rejects a knob missing any of its required fields', () => {
    for (const field of ['id', 'label', 'kind', 'help', 'default'] as const) {
      const knobs = structuredClone(apple.knobs) as Record<string, unknown>[]
      delete knobs[0]?.[field]
      const issues = issuesOf(withField('knobs', knobs))
      expect(
        issues.some((i) => i.field === `knobs[0].${field}`),
        `omitting knob field "${field}" should be reported`,
      ).toBe(true)
    }
  })

  it('rejects an unknown knob kind', () => {
    const knobs = structuredClone(apple.knobs) as Record<string, unknown>[]
    if (knobs[0]) knobs[0].kind = 'dial'
    const issues = issuesOf(withField('knobs', knobs))
    expect(issues.some((i) => i.code === 'unknown-knob-kind')).toBe(true)
  })

  it('rejects a choice knob whose default is not among its own values', () => {
    const knobs = structuredClone(apple.knobs) as Record<string, unknown>[]
    if (knobs[0]) knobs[0].default = 5
    const issues = issuesOf(withField('knobs', knobs))
    expect(issues.some((i) => i.code === 'default-not-allowed')).toBe(true)
  })

  it('rejects a slider knob whose default sits off its own step', () => {
    const knobs = structuredClone(apple.knobs) as Record<string, unknown>[]
    const slider = knobs.find((k) => k.kind === 'slider')
    if (slider) slider.default = 0.5
    const issues = issuesOf(withField('knobs', knobs))
    expect(issues.some((i) => i.code === 'default-not-allowed')).toBe(true)
  })

  it('rejects an empty knob list', () => {
    const issues = issuesOf(withField('knobs', []))
    expect(issues.some((i) => i.field === 'knobs')).toBe(true)
  })
})

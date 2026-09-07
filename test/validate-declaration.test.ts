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
    const issues = issuesOf(withField('actions', [{ id: 'crate-red', label: 'Crate as red' }]))
    expect(issues.some((i) => i.code === 'too-few' && i.field === 'actions')).toBe(true)
  })

  it('rejects a category that is not mapped to any action', () => {
    const issues = issuesOf(withField('categoryActions', { red: 'crate-red', green: 'crate-green' }))
    expect(issues.some((i) => i.code === 'unmapped-category')).toBe(true)
    expect(issues.some((i) => i.message.includes('"wormy"'))).toBe(true)
  })

  it('rejects a mapping that points at an action the task never declared', () => {
    const issues = issuesOf(
      withField('categoryActions', { red: 'crate-red', green: 'crate-green', wormy: 'incinerate' }),
    )
    expect(issues.some((i) => i.code === 'unknown-action')).toBe(true)
    expect(issues.some((i) => i.message.includes('incinerate'))).toBe(true)
  })

  it('rejects a mapping key that is not a declared category', () => {
    const issues = issuesOf(
      withField('categoryActions', {
        red: 'crate-red',
        green: 'crate-green',
        wormy: 'discard',
        bruised: 'discard',
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
    delete partial.wormy?.['crate-red']
    const issues = issuesOf(withField('payoffs', partial))
    const incomplete = issues.filter((i) => i.code === 'incomplete-payoff-table')
    expect(incomplete).toHaveLength(1)
    expect(incomplete[0]?.message).toContain('"wormy"')
    expect(incomplete[0]?.message).toContain('"crate-red"')
  })

  it('rejects a table missing an entire category row', () => {
    const partial = structuredClone(apple.payoffs) as Record<string, unknown>
    delete partial.green
    const issues = issuesOf(withField('payoffs', partial))
    expect(issues.filter((i) => i.code === 'incomplete-payoff-table')).toHaveLength(3)
  })

  it('rejects a non-numeric payoff cell', () => {
    const partial = structuredClone(apple.payoffs) as Record<string, Record<string, unknown>>
    if (partial.red) partial.red['crate-red'] = 'a lot'
    const issues = issuesOf(withField('payoffs', partial))
    expect(issues.some((i) => i.field === 'payoffs.red.crate-red')).toBe(true)
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

  it('requires a threshold policy to declare a priority order at all', () => {
    const issues = issuesOf(
      withField('policy', {
        kind: 'threshold',
        thresholds: { red: 0.6, green: 0.5, wormy: 0.2 },
        fallbackAction: 'discard',
      }),
    )
    expect(issues.some((i) => i.code === 'malformed-priority')).toBe(true)
  })

  it('rejects a priority order that omits, repeats or invents a category, naming it', () => {
    const cases = [
      { priority: ['red', 'green'], named: 'wormy' },
      { priority: ['red', 'red', 'green', 'wormy'], named: 'red' },
      { priority: ['red', 'green', 'wormy', 'bruised'], named: 'bruised' },
    ]

    for (const { priority, named } of cases) {
      const issues = issuesOf(
        withField('policy', {
          kind: 'threshold',
          thresholds: { red: 0.6, green: 0.5, wormy: 0.2 },
          fallbackAction: 'discard',
          priority,
        }),
      )
      const faults = issues.filter((i) => i.code === 'malformed-priority')
      expect(faults.length, `${priority.join(', ')} should be refused`).toBeGreaterThan(0)
      expect(
        faults.some((issue) => issue.message.includes(named)),
        `the refusal of ${priority.join(', ')} should name "${named}"`,
      ).toBe(true)
    }
  })

  it('accepts a well-formed threshold policy', () => {
    const result = validateDeclaration(
      withField('policy', {
        kind: 'threshold',
        thresholds: { red: 0.6, green: 0.5, wormy: 0.2 },
        fallbackAction: 'discard',
        priority: ['wormy', 'red', 'green'],
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

/**
 * The separator joins the parts of a configuration identifier, so an identifier carrying
 * it inside a part cannot be read back to the values it was composed from — and a slot
 * naming one that cannot be read back is dropped on restore, silently taking a student's
 * model off the task. It is refused at authoring time instead.
 */
describe('the identifier separator cannot enter a knob id or a declared value', () => {
  /** The shipped knobs with one of them replaced by `edit`'s result. */
  function knobsWith(
    pick: (knobs: Record<string, unknown>[]) => Record<string, unknown> | undefined,
    edit: (knob: Record<string, unknown>) => void,
  ): Record<string, unknown> {
    const knobs = structuredClone(apple.knobs) as Record<string, unknown>[]
    const knob = pick(knobs)
    if (knob === undefined) throw new Error('the shipped declaration has no such knob')
    edit(knob)
    return withField('knobs', knobs)
  }

  it('refuses a knob whose id contains the separator, naming that id', () => {
    const issues = issuesOf(
      knobsWith(
        (knobs) => knobs[0],
        (knob) => {
          knob.id = 'conv-blocks'
        },
      ),
    )
    const refusal = issues.find((i) => i.code === 'separator-in-identifier')
    expect(refusal?.field).toBe('knobs[0].id')
    expect(refusal?.message).toContain('conv-blocks')
  })

  it('refuses a choice knob permitting a hyphenated string value, naming that value', () => {
    const issues = issuesOf(
      knobsWith(
        (knobs) => knobs[0],
        (knob) => {
          knob.values = ['two-blocks', 'three']
          knob.default = 'three'
        },
      ),
    )
    const refusal = issues.find((i) => i.code === 'separator-in-identifier')
    expect(refusal?.field).toBe('knobs[0].values')
    expect(refusal?.message).toContain('blocks')
    expect(refusal?.message).toContain('two-blocks')
  })

  it('refuses a slider whose range walks to a negative value, naming that value', () => {
    const issues = issuesOf(
      knobsWith(
        (knobs) => knobs.find((knob) => knob.kind === 'slider'),
        (knob) => {
          knob.min = -1
        },
      ),
    )
    const refusal = issues.find((i) => i.code === 'separator-in-identifier')
    expect(refusal?.field).toBe('knobs[2]')
    expect(refusal?.message).toContain('regularization')
    expect(refusal?.message).toContain('-1')
  })

})

describe('a category’s declared action is its best-paying action', () => {
  const mapping = apple.categoryActions as Record<string, string>
  const actionIds = (apple.actions as { id: string; label: string }[]).map((action) => action.id)
  const categoryIds = (apple.categories as { id: string }[]).map((category) => category.id)

  /** The shipped table with one cell repriced. */
  function repriced(category: string, action: string, value: number): Record<string, unknown> {
    const payoffs = structuredClone(apple.payoffs) as Record<string, Record<string, number>>
    const row = payoffs[category]
    if (row === undefined) throw new Error(`the shipped table has no row for "${category}"`)
    row[action] = value
    return withField('payoffs', payoffs)
  }

  /** Some declared action that is not the one `category` is declared to call for. */
  function rivalOf(category: string): string {
    const rival = actionIds.find((action) => action !== mapping[category])
    if (rival === undefined) throw new Error(`no rival action for category "${category}"`)
    return rival
  }

  /** What the shipped table pays for one cell. */
  function paid(category: string, action: string): number {
    const value = (apple.payoffs as Record<string, Record<string, number>>)[category]?.[action]
    if (typeof value !== 'number') throw new Error(`no payoff for ${category}/${action}`)
    return value
  }

  it('accepts the shipped declaration, so the rule formalises rather than repairs', () => {
    const result = validateDeclaration(apple)
    expect(result.ok ? [] : result.issues.filter((i) => i.code === 'payoff-contradicts-mapping'))
      .toEqual([])
  })

  it('rejects a row where another action outpays the declared one, naming all three', () => {
    const category = categoryIds[0] as string
    const declared = mapping[category] as string
    const rival = rivalOf(category)

    const issues = issuesOf(repriced(category, rival, paid(category, declared) + 1))
    const disagreement = issues.filter((i) => i.code === 'payoff-contradicts-mapping')
    expect(disagreement).toHaveLength(1)
    expect(disagreement[0]?.message).toContain(`"${category}"`)
    expect(disagreement[0]?.message).toContain(`"${declared}"`)
    expect(disagreement[0]?.message).toContain(`"${rival}"`)
  })

  it('rejects an exact tie between the declared action and another', () => {
    const category = categoryIds[0] as string
    const declared = mapping[category] as string
    const rival = rivalOf(category)

    const issues = issuesOf(repriced(category, rival, paid(category, declared)))
    const disagreement = issues.filter((i) => i.code === 'payoff-contradicts-mapping')
    expect(disagreement).toHaveLength(1)
    expect(disagreement[0]?.message).toContain(`"${category}"`)
    expect(disagreement[0]?.message).toContain(`"${declared}"`)
    expect(disagreement[0]?.message).toContain(`"${rival}"`)
  })

  it('reports a hole in the table once, as a hole rather than also as a disagreement', () => {
    const category = categoryIds[0] as string
    const payoffs = structuredClone(apple.payoffs) as Record<string, Record<string, number>>
    delete payoffs[category]?.[rivalOf(category)]

    const issues = issuesOf(withField('payoffs', payoffs))
    expect(issues.filter((i) => i.code === 'incomplete-payoff-table')).toHaveLength(1)
    expect(issues.filter((i) => i.code === 'payoff-contradicts-mapping')).toEqual([])
  })

  it('refuses Game_design.md §4.1’s first-pass table, naming wormy', () => {
    // The table the rule was written for: wormy is declared to call for discard at 0.00
    // while crating a wormy apple pays +0.40, so "crate everything" is the best-paying
    // strategy — the diagnosis trap inverted.
    const issues = issuesOf({
      ...apple,
      actions: [
        { id: 'crate-red', label: 'Crate as red' },
        { id: 'crate-green', label: 'Crate as green' },
        { id: 'discard', label: 'Throw it away' },
      ],
      categoryActions: { red: 'crate-red', green: 'crate-green', wormy: 'discard' },
      payoffs: {
        red: { 'crate-red': 0.4, 'crate-green': 0.2, discard: 0 },
        green: { 'crate-red': -0.3, 'crate-green': 0.2, discard: 0 },
        wormy: { 'crate-red': 0.4, 'crate-green': 0.2, discard: 0 },
      },
    })
    const disagreement = issues.filter((i) => i.code === 'payoff-contradicts-mapping')
    expect(disagreement).toHaveLength(2)
    for (const issue of disagreement) {
      expect(issue.message).toContain('"wormy"')
      expect(issue.message).toContain('"discard"')
    }
    expect(disagreement.map((i) => i.field)).toEqual([
      'payoffs.wormy.crate-red',
      'payoffs.wormy.crate-green',
    ])
  })

  it('accepts an action that no category calls for, when no row pays it best', () => {
    // A cautious action — never the right answer to a certain image, available for an
    // uncertain one — stays legal. The rule is about the actions a category does declare.
    const payoffs = structuredClone(apple.payoffs) as Record<string, Record<string, number>>
    for (const row of Object.values(payoffs)) {
      row.hold = Math.min(...Object.values(row)) - 1
    }
    const result = validateDeclaration({
      ...apple,
      actions: [...(apple.actions as unknown[]), { id: 'hold', label: 'Set it aside' }],
      payoffs,
    })

    expect(result.ok ? [] : result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })
})

describe('what one person can sort by hand', () => {
  it('requires both figures, naming the one that is missing', () => {
    for (const field of ['perHarvest', 'secondsPerImage'] as const) {
      const handSorting = structuredClone(apple.handSorting) as Record<string, unknown>
      delete handSorting[field]
      const issues = issuesOf(withField('handSorting', handSorting))
      expect(
        issues.map((issue) => issue.field),
        `omitting "${field}" should be reported`,
      ).toContain(`handSorting.${field}`)
    }
  })

  it('refuses a field that is not an object at all', () => {
    const issues = issuesOf(withField('handSorting', 60))
    expect(issues.map((issue) => issue.field)).toContain('handSorting')
  })

  it('refuses a sorting limit that could not show every category once', () => {
    const categories = (apple.categories as { id: string }[]).length
    const issues = issuesOf(
      withField('handSorting', { perHarvest: categories - 1, secondsPerImage: 60 }),
    )
    const refusal = issues.find((issue) => issue.code === 'sorting-limit-too-small')
    expect(refusal?.field).toBe('handSorting.perHarvest')
    expect(refusal?.message).toContain(String(categories))
  })

  it('accepts a sorting limit of exactly one image per declared category', () => {
    const categories = (apple.categories as { id: string }[]).length
    const result = validateDeclaration(
      withField('handSorting', { perHarvest: categories, secondsPerImage: 60 }),
    )
    expect(result.ok ? [] : result.issues).toEqual([])
  })

  it('refuses a sorting limit that is not a whole number of images', () => {
    for (const perHarvest of [0, -10, 12.5, '60', null]) {
      const issues = issuesOf(withField('handSorting', { perHarvest, secondsPerImage: 60 }))
      expect(
        issues.map((issue) => issue.field),
        `${JSON.stringify(perHarvest)} should be refused`,
      ).toContain('handSorting.perHarvest')
    }
  })

  it('refuses a time cap of zero or less, so no rate can be infinite or negative', () => {
    for (const secondsPerImage of [0, -1, Number.POSITIVE_INFINITY, '60']) {
      const issues = issuesOf(withField('handSorting', { perHarvest: 60, secondsPerImage }))
      const refusal = issues.find((issue) => issue.field === 'handSorting.secondsPerImage')
      expect(refusal, `${JSON.stringify(secondsPerImage)} should be refused`).toBeDefined()
      expect(refusal?.message).toContain('greater than zero')
    }
  })

  it('accepts a fractional time cap, which is a duration rather than a count', () => {
    const result = validateDeclaration(
      withField('handSorting', { perHarvest: 60, secondsPerImage: 2.5 }),
    )
    expect(result.ok ? [] : result.issues).toEqual([])
  })
})

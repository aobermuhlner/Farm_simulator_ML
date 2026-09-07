/**
 * The farm declaration: the file itself, and the validator that refuses a broken one.
 *
 * The shipped file is read from disk and put through the real validator rather than
 * stood in for, because a farm declaration that does not validate stops the farm from
 * opening at all — there is no partial version of it.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DATA_MOUNTS, sourcePathFor } from '../web/src/data/paths.js'
import { SHIPPED_FARM } from '../web/src/data/paths.js'
import {
  OPTIONAL_FARM_FIELDS,
  REQUIRED_FARM_FIELDS,
  validateFarmDeclaration,
} from '../src/economy/index.js'

const repoRoot = process.cwd()

function shippedFarmJson(): unknown {
  const source = sourcePathFor(SHIPPED_FARM)
  if (source === undefined) throw new Error(`no mount serves ${SHIPPED_FARM}`)
  return JSON.parse(readFileSync(join(repoRoot, source), 'utf8')) as unknown
}

/** A declaration that validates, as the base for testing one field at a time. */
function sound(): Record<string, unknown> {
  return {
    name: 'Test Farm',
    currency: 'ETB',
    precision: 2,
    openingBalance: 1500,
    openingYear: 4,
    openingCrop: 24,
    cropComposition: { sound: 0.8, spoiled: 0.2 },
  }
}

function fieldsOf(input: Record<string, unknown>, omit: string): Record<string, unknown> {
  const copy = { ...input }
  delete copy[omit]
  return copy
}

describe('the shipped farm declaration', () => {
  it('is served by the declarations mount already in the table', () => {
    expect(sourcePathFor(SHIPPED_FARM)).toBe('declarations/farm.json')
    expect(Object.keys(DATA_MOUNTS)).toContain('data/declarations')
  })

  it('parses and validates', () => {
    const validated = validateFarmDeclaration(shippedFarmJson())
    expect(validated.ok, validated.ok ? '' : validated.issues.map((i) => i.message).join(' ')).toBe(
      true,
    )
  })

  it('carries every required farm-level field, and nothing beyond the optional ones', () => {
    const parsed = shippedFarmJson() as Record<string, unknown>
    expect(Object.keys(parsed).sort()).toEqual(
      expect.arrayContaining([...REQUIRED_FARM_FIELDS].sort()),
    )
    for (const field of Object.keys(parsed)) {
      expect(
        [...REQUIRED_FARM_FIELDS, ...OPTIONAL_FARM_FIELDS] as readonly string[],
        `"${field}" is not a field the farm declaration has`,
      ).toContain(field)
    }
  })
})

describe('a farm declaration that cannot be trusted', () => {
  it('accepts a complete declaration', () => {
    const validated = validateFarmDeclaration(sound())
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.declaration.currency).toBe('ETB')
    expect(validated.declaration.openingYear).toBe(4)
  })

  it('refuses one with no currency, naming the field', () => {
    const validated = validateFarmDeclaration(fieldsOf(sound(), 'currency'))
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    expect(validated.issues.map((issue) => issue.field)).toContain('currency')
    expect(validated.issues[0]?.code).toBe('missing-field')
  })

  it('refuses a precision that is not a whole number of decimal places', () => {
    for (const precision of [1.5, -1, '2']) {
      const validated = validateFarmDeclaration({ ...sound(), precision })
      expect(validated.ok, `precision ${JSON.stringify(precision)} was accepted`).toBe(false)
      if (validated.ok) continue
      expect(validated.issues.map((issue) => issue.field)).toContain('precision')
    }
  })

  it('refuses an opening balance finer than its own declared precision', () => {
    const validated = validateFarmDeclaration({ ...sound(), openingBalance: 100.005 })
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    const issue = validated.issues.find((candidate) => candidate.field === 'openingBalance')
    expect(issue?.code).toBe('unrepresentable-amount')
    expect(issue?.message).toContain('2 decimal places')
  })

  it('refuses something that is not an object at all', () => {
    const validated = validateFarmDeclaration('a farm')
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('malformed-declaration')
  })

  it('names every missing field rather than the first', () => {
    const validated = validateFarmDeclaration({})
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    expect(validated.issues.map((issue) => issue.field).sort()).toEqual(
      [...REQUIRED_FARM_FIELDS].sort(),
    )
  })
})

describe('the crop the farm bears', () => {
  it('opens at about ten pieces in the shipped declaration', () => {
    const parsed = shippedFarmJson() as Record<string, unknown>
    expect(parsed.openingCrop).toBe(10)
  })

  it('declares what the shipped crop is made of, in shares that come to one', () => {
    const parsed = shippedFarmJson() as Record<string, unknown>
    const composition = parsed.cropComposition as Record<string, number>
    expect(Object.keys(composition).length).toBeGreaterThan(1)
    expect(Object.values(composition).reduce((total, share) => total + share, 0)).toBeCloseTo(1, 9)
  })

  it('refuses an opening crop that is not a whole number of one or more', () => {
    for (const openingCrop of [0, -4, 2.5, '10', null]) {
      const validated = validateFarmDeclaration({ ...sound(), openingCrop })
      expect(validated.ok, `an opening crop of ${JSON.stringify(openingCrop)} was accepted`).toBe(
        false,
      )
      if (validated.ok) continue
      expect(validated.issues.map((issue) => issue.field)).toContain('openingCrop')
    }
  })

  it('refuses a missing composition rather than leaving it to be guessed at', () => {
    const validated = validateFarmDeclaration(fieldsOf(sound(), 'cropComposition'))
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    const issue = validated.issues.find((candidate) => candidate.field === 'cropComposition')
    expect(issue?.code).toBe('missing-field')
  })

  it('refuses a share that is not a positive number, naming the category', () => {
    for (const share of [0, -0.2, 'half', null]) {
      const validated = validateFarmDeclaration({
        ...sound(),
        cropComposition: { sound: 0.8, spoiled: share },
      })
      expect(validated.ok, `a share of ${JSON.stringify(share)} was accepted`).toBe(false)
      if (validated.ok) continue
      expect(validated.issues.map((issue) => issue.field)).toContain('cropComposition.spoiled')
    }
  })

  it('refuses shares that do not come to one', () => {
    const validated = validateFarmDeclaration({
      ...sound(),
      cropComposition: { sound: 0.8, spoiled: 0.1 },
    })
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    const issue = validated.issues.find((candidate) => candidate.code === 'crop-composition-unbalanced')
    expect(issue?.field).toBe('cropComposition')
    expect(issue?.message).toContain('0.9')
  })

  it('refuses a composition made of nothing', () => {
    const validated = validateFarmDeclaration({ ...sound(), cropComposition: {} })
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    expect(validated.issues.map((issue) => issue.field)).toContain('cropComposition')
  })
})

describe('what would do the job instead of hands', () => {
  it('accepts a farm that names the purchase which does it', () => {
    const validated = validateFarmDeclaration({ ...sound(), automation: { item: 'sorting-rig' } })
    expect(validated.ok ? [] : validated.issues).toEqual([])
    if (!validated.ok) return
    expect(validated.declaration.automation?.item).toBe('sorting-rig')
  })

  it('accepts a farm that names none, which is what makes hands the only way', () => {
    const validated = validateFarmDeclaration(sound())
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.declaration.automation).toBeUndefined()
  })

  it('refuses one that names nothing usable, rather than half-declaring it', () => {
    for (const automation of [{}, { item: '' }, 'sorting-rig', { item: 7 }]) {
      const validated = validateFarmDeclaration({ ...sound(), automation })
      expect(validated.ok, `${JSON.stringify(automation)} was accepted`).toBe(false)
      if (validated.ok) continue
      expect(validated.issues.map((issue) => issue.field)).toContain('automation')
    }
  })
})

describe('how the farm’s own labour is shown in a slot', () => {
  it('accepts a farm that declares an icon and a label for it', () => {
    const validated = validateFarmDeclaration({
      ...sound(),
      manualLabour: { icon: '🧤', label: 'Done by the family' },
    })
    expect(validated.ok ? [] : validated.issues).toEqual([])
    if (!validated.ok) return
    expect(validated.declaration.manualLabour?.icon).toBe('🧤')
    expect(validated.declaration.manualLabour?.label).toBe('Done by the family')
  })

  it('accepts a farm that declares neither, because the hands still do the work', () => {
    const validated = validateFarmDeclaration(sound())
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.declaration.manualLabour).toBeUndefined()
  })

  it('accepts one half of it, so a farm may name the labour without drawing it', () => {
    const validated = validateFarmDeclaration({ ...sound(), manualLabour: { label: 'By hand' } })
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.declaration.manualLabour?.label).toBe('By hand')
    expect(validated.declaration.manualLabour?.icon).toBeUndefined()
  })

  it('refuses one that half-declares it rather than presenting an empty slot', () => {
    for (const manualLabour of ['by hand', { icon: '' }, { label: 7 }, { icon: 3, label: '' }]) {
      const validated = validateFarmDeclaration({ ...sound(), manualLabour })
      expect(validated.ok, `${JSON.stringify(manualLabour)} was accepted`).toBe(false)
      if (validated.ok) continue
      expect(validated.issues.map((issue) => issue.field).join(' ')).toContain('manualLabour')
    }
  })
})

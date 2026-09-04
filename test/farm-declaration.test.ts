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
import { REQUIRED_FARM_FIELDS, validateFarmDeclaration } from '../src/economy/index.js'

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

  it('carries the farm-level fields and nothing else', () => {
    const parsed = shippedFarmJson() as Record<string, unknown>
    expect(Object.keys(parsed).sort()).toEqual([...REQUIRED_FARM_FIELDS].sort())
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

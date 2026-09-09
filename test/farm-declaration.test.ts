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
  cropSize,
  openFarm,
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
    orchard: { label: 'Orchard', unit: 'trees', opening: 24, piecesPerUnit: 1 },
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

describe('the orchard the farm declares', () => {
  it('opens at the orchard the shipped declaration bears', () => {
    // A hundred trees at sixty pieces each, which is what `Game_design.md` §4.5 quotes and
    // what every earnings figure in this repository is set against. It is also well above
    // the floor the draw guard sets — `harvest-scoring/design.md`, decision 7 — below which
    // which photographs were drawn would decide a year more than the model does.
    const parsed = shippedFarmJson() as Record<string, unknown>
    const orchard = parsed.orchard as Record<string, unknown>

    expect(orchard.opening).toBe(100)
    expect(orchard.piecesPerUnit).toBe(60)
    expect((orchard.opening as number) * (orchard.piecesPerUnit as number)).toBe(6000)
    expect(orchard.unit).toBe('trees')
    expect(orchard.label).toBe('Orchard')
  })

  it('is what the opened farm bears, rather than a separately declared size', () => {
    const validated = validateFarmDeclaration(shippedFarmJson())
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(cropSize(openFarm(validated.declaration))).toBe(6000)
  })

  it('states the size of the crop in no declared field, so nothing can disagree', () => {
    // Two statements about one fact, with nothing able to say which is right when a later
    // edit makes them differ. The crop is derived; only the land is declared.
    const fields = [...REQUIRED_FARM_FIELDS, ...OPTIONAL_FARM_FIELDS] as readonly string[]
    expect(fields).not.toContain('openingCrop')
    expect(fields).not.toContain('cropSize')
    expect(fields).toContain('orchard')
    expect(Object.keys(shippedFarmJson() as Record<string, unknown>)).not.toContain('openingCrop')
  })

  it('refuses an orchard whose land is not a whole number of one or more', () => {
    for (const opening of [0, -4, 2.5, '10', null]) {
      const validated = validateFarmDeclaration({
        ...sound(),
        orchard: { ...(sound().orchard as Record<string, unknown>), opening },
      })
      expect(validated.ok, `land of ${JSON.stringify(opening)} was accepted`).toBe(false)
      if (validated.ok) continue
      expect(validated.issues.map((issue) => issue.field)).toContain('orchard.opening')
    }
  })

  it('refuses an orchard whose yield per unit is not a whole number of one or more', () => {
    for (const piecesPerUnit of [0, -4, 2.5, '10', null]) {
      const validated = validateFarmDeclaration({
        ...sound(),
        orchard: { ...(sound().orchard as Record<string, unknown>), piecesPerUnit },
      })
      expect(validated.ok, `a yield of ${JSON.stringify(piecesPerUnit)} was accepted`).toBe(false)
      if (validated.ok) continue
      expect(validated.issues.map((issue) => issue.field)).toContain('orchard.piecesPerUnit')
    }
  })

  it('refuses an orchard with no name for itself or for a unit of its land', () => {
    for (const field of ['label', 'unit'] as const) {
      for (const value of ['', '   ', 7, null]) {
        const validated = validateFarmDeclaration({
          ...sound(),
          orchard: { ...(sound().orchard as Record<string, unknown>), [field]: value },
        })
        expect(validated.ok, `${field} of ${JSON.stringify(value)} was accepted`).toBe(false)
        if (validated.ok) continue
        expect(validated.issues.map((issue) => issue.field)).toContain(`orchard.${field}`)
      }
    }
  })

  it('names each faulty field of the orchard rather than the orchard as a whole', () => {
    const validated = validateFarmDeclaration({
      ...sound(),
      orchard: { label: 'Orchard', unit: '', opening: 2.5, piecesPerUnit: 60 },
    })
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    const fields = validated.issues.map((issue) => issue.field)
    expect(fields).toContain('orchard.unit')
    expect(fields).toContain('orchard.opening')
    expect(fields).not.toContain('orchard.piecesPerUnit')
  })

  it('refuses a farm declaring no orchard rather than assuming a size for it', () => {
    const validated = validateFarmDeclaration(fieldsOf(sound(), 'orchard'))
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    expect(validated.issues.map((issue) => issue.field)).toContain('orchard')
    expect(validated.issues.map((issue) => issue.code)).toContain('missing-field')
  })

  it('refuses an orchard that is not an object, naming the field', () => {
    for (const orchard of ['big', 100, []]) {
      const validated = validateFarmDeclaration({ ...sound(), orchard })
      expect(validated.ok, `an orchard of ${JSON.stringify(orchard)} was accepted`).toBe(false)
      if (validated.ok) continue
      expect(validated.issues.map((issue) => issue.field)).toContain('orchard')
    }
  })

  it('declares what the shipped crop is made of, in shares that come to one', () => {
    const parsed = shippedFarmJson() as Record<string, unknown>
    const composition = parsed.cropComposition as Record<string, number>
    expect(Object.keys(composition).length).toBeGreaterThan(1)
    expect(Object.values(composition).reduce((total, share) => total + share, 0)).toBeCloseTo(1, 9)
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

describe('how the crop’s composition varies from year to year', () => {
  /** The sound declaration with a variation range patched onto it. */
  function varying(variation: unknown): Record<string, unknown> {
    return { ...sound(), yearVariation: variation }
  }

  function issuesOf(input: Record<string, unknown>): { code: string; field?: string; message: string }[] {
    const result = validateFarmDeclaration(input)
    expect(result.ok).toBe(false)
    return result.ok ? [] : [...result.issues]
  }

  it('is optional: a farm declaring none opens with the same crop every year', () => {
    expect(validateFarmDeclaration(sound()).ok).toBe(true)
    expect(OPTIONAL_FARM_FIELDS).toContain('yearVariation')
  })

  it('accepts a range containing the category’s declared share', () => {
    const result = validateFarmDeclaration(varying({ spoiled: { min: 0.15, max: 0.3 } }))
    expect(result.ok ? [] : result.issues).toEqual([])
  })

  it('refuses a range that does not contain the declared share, naming the category', () => {
    for (const range of [{ min: 0.25, max: 0.4 }, { min: 0.05, max: 0.15 }]) {
      const issues = issuesOf(varying({ spoiled: range }))
      const refusal = issues.find((issue) => issue.code === 'year-variation-excludes-declared')
      expect(refusal?.field, JSON.stringify(range)).toBe('yearVariation.spoiled')
      expect(refusal?.message).toContain('spoiled')
    }
  })

  it('refuses a range reaching zero or one, naming the category', () => {
    for (const range of [{ min: 0, max: 0.3 }, { min: 0.15, max: 1 }, { min: -0.1, max: 0.3 }]) {
      const issues = issuesOf(varying({ spoiled: range }))
      const refusal = issues.find((issue) => issue.code === 'year-variation-out-of-range')
      expect(refusal?.field, JSON.stringify(range)).toBe('yearVariation.spoiled')
      expect(refusal?.message).toContain('spoiled')
    }
  })

  it('refuses a range that runs downwards', () => {
    const issues = issuesOf(varying({ spoiled: { min: 0.3, max: 0.15 } }))
    expect(issues.map((issue) => issue.field)).toContain('yearVariation.spoiled')
  })

  it('refuses an upper bound leaving no room for another declared category', () => {
    // Two categories, one of which may take the whole crop in its wettest year: the other
    // is then a category the crop must hold one of and has no share to hold it with.
    const issues = issuesOf({
      ...sound(),
      cropComposition: { sound: 0.2, spoiled: 0.8 },
      yearVariation: { spoiled: { min: 0.7, max: 0.999 } },
    })
    const refusal = issues.find((issue) => issue.code === 'year-variation-crowds-out')
    expect(refusal?.field).toBe('yearVariation.spoiled')
    expect(refusal?.message).toContain('sound')
    // Measured against the crop the declared opening land bears, which is the smallest
    // the orchard ever is — and the message names that derived figure, not a declared one.
    const orchard = sound().orchard as { opening: number; piecesPerUnit: number }
    expect(refusal?.message).toContain(String(orchard.opening * orchard.piecesPerUnit))
  })

  it('measures the crowd-out against the land times the yield, not against the land', () => {
    // The same declared ranges against the same land, bearing sixty pieces a unit rather
    // than one: a crop sixty times larger leaves every category a whole piece to hold.
    const orchard = sound().orchard as Record<string, unknown>
    const roomy = validateFarmDeclaration({
      ...sound(),
      orchard: { ...orchard, piecesPerUnit: 60 },
      cropComposition: { sound: 0.2, spoiled: 0.8 },
      yearVariation: { spoiled: { min: 0.7, max: 0.999 } },
    })
    expect(roomy.ok).toBe(true)
  })

  it('refuses a range for a category the crop is not made of, naming it', () => {
    const issues = issuesOf(varying({ bruised: { min: 0.1, max: 0.2 } }))
    const refusal = issues.find((issue) => issue.code === 'unknown-category')
    expect(refusal?.field).toBe('yearVariation.bruised')
    expect(refusal?.message).toContain('bruised')
  })

  it('refuses a range that is not a pair of numbers, naming the category', () => {
    for (const range of [{ min: 0.1 }, 'wide', { min: 'a', max: 'b' }]) {
      const issues = issuesOf(varying({ spoiled: range }))
      expect(issues.map((issue) => issue.field), JSON.stringify(range)).toContain(
        'yearVariation.spoiled',
      )
    }
  })

  it('refuses a variation that is not an object at all', () => {
    const issues = issuesOf(varying([{ min: 0.1, max: 0.2 }]))
    expect(issues.map((issue) => issue.field)).toContain('yearVariation')
  })
})

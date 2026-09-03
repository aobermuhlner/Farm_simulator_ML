import { describe, expect, it } from 'vitest'
import { readPool, regionFor, REQUIRED_ATTRIBUTES, REQUIRED_ATLAS_FIELDS } from '../src/pool/index.js'
import type { ValidationIssue } from '../src/task/validate.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'

const apple = appleDeclaration()
const manifest = committedManifest()

/** A deep-enough copy that a test can break one field without touching the original. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function issuesFor(mutate: (draft: Record<string, unknown>) => void): readonly ValidationIssue[] {
  const draft = copy(manifest) as unknown as Record<string, unknown>
  mutate(draft)
  const result = readPool(draft, apple)
  if (result.ok) throw new Error('expected the manifest to be refused')
  return result.issues
}

function messages(issues: readonly ValidationIssue[]): string {
  return issues.map((entry) => entry.message).join(' ')
}

describe('reading a well-formed pool', () => {
  const result = readPool(manifest, apple)

  it('loads the committed manifest', () => {
    expect(result.ok).toBe(true)
  })

  it('exposes a true category for every image', () => {
    if (!result.ok) throw new Error('expected the committed pool to load')
    expect(Object.keys(result.pool.truth)).toHaveLength(1200)
    expect(result.pool.truth['t-001']).toBe(manifest.images['t-001']?.category)
    for (const category of Object.values(result.pool.truth)) {
      expect(['red', 'green', 'wormy']).toContain(category)
    }
  })

  it('derives a pixel region inside the atlas for every image', () => {
    if (!result.ok) throw new Error('expected the committed pool to load')
    for (const id of Object.keys(result.pool.images)) {
      const region = regionFor(result.pool, id)
      const atlas = result.pool.atlases[result.pool.images[id]!.atlas]!
      expect(region).toBeDefined()
      expect(region!.x + region!.size).toBeLessThanOrEqual(atlas.width)
      expect(region!.y + region!.size).toBeLessThanOrEqual(atlas.height)
    }
  })

  it('refuses nothing when the task and the pool agree', () => {
    if (!result.ok) throw new Error(messages(result.issues))
    expect(result.pool.poolId).toBe(apple.pool)
    expect(result.pool.schemaVersion).toBe(apple.schemaVersion)
  })
})

describe('completeness refusals', () => {
  it.each(['poolId', 'schemaVersion', 'splits', 'atlases', 'images'] as const)(
    'refuses a manifest with no %s, naming it',
    (field) => {
      const issues = issuesFor((draft) => {
        delete draft[field]
      })
      expect(issues.some((entry) => entry.field === field)).toBe(true)
      expect(messages(issues)).toContain(field)
    },
  )

  it.each(['split', 'category', 'attributes', 'atlas', 'cell'] as const)(
    'refuses an image missing its %s, naming the image',
    (field) => {
      const issues = issuesFor((draft) => {
        const images = draft.images as Record<string, Record<string, unknown>>
        delete images['p-0007']![field]
      })
      expect(issues.some((entry) => entry.field === 'p-0007')).toBe(true)
      expect(messages(issues)).toContain(field)
      expect(messages(issues)).toContain('p-0007')
    },
  )

  it.each(REQUIRED_ATTRIBUTES)('refuses an image with no %s recorded', (attribute) => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { attributes: Record<string, unknown> }>
      delete images['t-002']!.attributes[attribute]
    })
    expect(messages(issues)).toContain(attribute)
    expect(messages(issues)).toContain('t-002')
  })

  it.each(REQUIRED_ATLAS_FIELDS)('refuses an atlas with no %s', (field) => {
    const issues = issuesFor((draft) => {
      const atlases = draft.atlases as Record<string, Record<string, unknown>>
      delete atlases['atlas-pool-1']![field]
    })
    expect(messages(issues)).toContain(field)
    expect(messages(issues)).toContain('atlas-pool-1')
  })
})

describe('identity and version refusals', () => {
  it('refuses a pool the task does not reference, naming both ids', () => {
    const issues = issuesFor((draft) => {
      draft.poolId = 'pools/somewhere-else'
    })
    expect(messages(issues)).toContain('pools/somewhere-else')
    expect(messages(issues)).toContain(apple.pool)
    expect(issues.some((entry) => entry.code === 'pool-mismatch')).toBe(true)
  })

  it('refuses a version the task was not built against, naming both versions', () => {
    const issues = issuesFor((draft) => {
      draft.schemaVersion = '9.9.9'
    })
    expect(messages(issues)).toContain('9.9.9')
    expect(messages(issues)).toContain(apple.schemaVersion)
    expect(issues.some((entry) => entry.code === 'pool-version-mismatch')).toBe(true)
  })
})

describe('structural refusals', () => {
  it('refuses a declared count that disagrees with the images present', () => {
    const issues = issuesFor((draft) => {
      const splits = draft.splits as Record<string, { count: number }>
      splits.pool!.count = 999
    })
    expect(messages(issues)).toContain('999')
    expect(messages(issues)).toContain('1000')
    expect(issues.some((entry) => entry.code === 'split-count-mismatch')).toBe(true)
  })

  it('refuses a category that is absent from a split', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { split: string; category: string }>
      for (const image of Object.values(images)) {
        if (image.split === 'training' && image.category === 'wormy') image.category = 'red'
      }
    })
    expect(issues.some((entry) => entry.code === 'category-missing-from-split')).toBe(true)
    expect(messages(issues)).toContain('wormy')
    expect(messages(issues)).toContain('training')
  })

  it('refuses a cell index outside its atlas', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { cell: number }>
      images['p-0500']!.cell = 4096
    })
    expect(issues.some((entry) => entry.code === 'cell-out-of-bounds')).toBe(true)
    expect(messages(issues)).toContain('4096')
    expect(messages(issues)).toContain('p-0500')
  })

  it('refuses an image whose atlas serves a different split', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { atlas: string }>
      images['t-005']!.atlas = 'atlas-pool-0'
    })
    expect(issues.some((entry) => entry.code === 'split-mismatch')).toBe(true)
    expect(messages(issues)).toContain('t-005')
  })

  it('refuses an image in a split the pool does not declare', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { split: string }>
      images['t-006']!.split = 'holdout'
    })
    expect(issues.some((entry) => entry.code === 'unknown-split')).toBe(true)
    expect(messages(issues)).toContain('holdout')
  })

  it('refuses a category the task does not declare', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { category: string }>
      images['p-0001']!.category = 'bruised'
    })
    expect(issues.some((entry) => entry.code === 'unknown-category')).toBe(true)
    expect(messages(issues)).toContain('bruised')
  })

  it('refuses an atlas whose grid does not fill its width', () => {
    const issues = issuesFor((draft) => {
      const atlases = draft.atlases as Record<string, { grid: number }>
      atlases['atlas-training-0']!.grid = 7
    })
    expect(issues.some((entry) => entry.code === 'malformed-atlas')).toBe(true)
  })
})

describe('enumeration order', () => {
  it('enumerates the training split identically on every read', () => {
    const first = readPool(copy(manifest), apple)
    const second = readPool(copy(manifest), apple)
    if (!first.ok || !second.ok) throw new Error('expected the committed pool to load twice')
    expect(first.pool.order.training).toEqual(second.pool.order.training)
    expect(first.pool.order.training).toHaveLength(200)
    expect(first.pool.order.training[0]).toBe('t-001')
    expect(first.pool.order.pool).toHaveLength(1000)
  })

  it('puts every image in exactly one split order', () => {
    const result = readPool(manifest, apple)
    if (!result.ok) throw new Error('expected the committed pool to load')
    const all = [...result.pool.order.training, ...result.pool.order.pool]
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(1200)
  })
})

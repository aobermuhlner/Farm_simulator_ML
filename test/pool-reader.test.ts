import { describe, expect, it } from 'vitest'
import {
  POOL_SPLITS,
  readPool,
  regionFor,
  REQUIRED_ATTRIBUTES,
  REQUIRED_ATLAS_FIELDS,
} from '../src/pool/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { validateDeclaration, type ValidationIssue } from '../src/task/validate.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'
import { loadRawDeclaration } from './helpers/load-raw'

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

/**
 * A convolutional task over this pool, declaring its input resolution.
 *
 * Built here rather than taken from the shipped declaration so the mismatch can be
 * produced by changing one declared number, with the manifest left exactly as committed —
 * which is the disagreement this check exists for.
 */
function cnnTask(inputSize: number): TaskDeclaration {
  const raw = loadRawDeclaration('apple-harvest')
  const knobs = raw.knobs as Record<string, unknown>[]
  const declaration = {
    ...raw,
    knobs: [
      ...knobs,
      {
        kind: 'choice',
        id: 'stack',
        label: 'Convolutional blocks',
        values: [2, 3],
        default: 3,
        help: 'How many blocks the stack has.',
      },
      {
        kind: 'choice',
        id: 'filters',
        label: 'Channels in the first block',
        values: [8, 16],
        default: 16,
        help: 'How many filters the first block learns.',
      },
    ],
    diagram: {
      kind: 'cnn',
      blocksKnob: 'stack',
      channelsKnob: 'filters',
      inputSize,
      channelsShown: { '8': 2, '16': 3 },
    },
  }

  const validated = validateDeclaration(declaration)
  if (!validated.ok) throw new Error(messages(validated.issues))
  return validated.declaration
}

describe('a convolutional task must agree with the pool about the image size', () => {
  it('accepts the resolution the manifest provides', () => {
    const result = readPool(copy(manifest), cnnTask(128))

    expect(result.ok ? [] : result.issues).toEqual([])
  })

  it('refuses a declared resolution the pool does not provide, naming both', () => {
    const result = readPool(copy(manifest), cnnTask(64))

    if (result.ok) throw new Error('expected a mismatched resolution to be refused')
    expect(result.issues.some((entry) => entry.code === 'input-size-mismatch')).toBe(true)
    expect(messages(result.issues)).toContain('64')
    expect(messages(result.issues)).toContain('128')
  })

  it('leaves a task declaring no convolutional diagram unchecked', () => {
    const raw = loadRawDeclaration('apple-harvest')
    delete raw.diagram
    const validated = validateDeclaration(raw)
    if (!validated.ok) throw new Error(messages(validated.issues))

    const result = readPool(copy(manifest), validated.declaration)

    expect(result.ok).toBe(true)
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

describe('training roles', () => {
  const result = readPool(manifest, apple)

  it('assigns every training image to exactly one role', () => {
    if (!result.ok) throw new Error(messages(result.issues))
    const { fitted, heldOut } = result.pool.roles
    expect(fitted.length + heldOut.length).toBe(200)
    expect(new Set([...fitted, ...heldOut]).size).toBe(200)
    expect(heldOut.length).toBeLessThan(fitted.length)
  })

  it('keeps both roles inside the training split', () => {
    if (!result.ok) throw new Error(messages(result.issues))
    for (const id of [...result.pool.roles.fitted, ...result.pool.roles.heldOut]) {
      expect(result.pool.images[id]?.split).toBe('training')
    }
  })

  it('exposes the seed a prediction artifact binds itself to', () => {
    if (!result.ok) throw new Error(messages(result.issues))
    expect(result.pool.seed).toBe(manifest.seed)
    expect(Number.isFinite(result.pool.seed)).toBe(true)
  })

  it('refuses a training image with no role, naming it', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, Record<string, unknown>>
      delete images['t-004']!.role
    })
    expect(issues.some((entry) => entry.code === 'missing-role')).toBe(true)
    expect(messages(issues)).toContain('t-004')
  })

  it('refuses a role the pool does not declare, naming the image', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { role: string }>
      images['t-004']!.role = 'validation'
    })
    expect(issues.some((entry) => entry.code === 'unknown-role')).toBe(true)
    expect(messages(issues)).toContain('t-004')
    expect(messages(issues)).toContain('validation')
  })

  it('refuses a role on an evaluation-pool image, naming it', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { role?: string }>
      images['p-0300']!.role = 'heldOut'
    })
    expect(issues.some((entry) => entry.code === 'role-outside-training')).toBe(true)
    expect(messages(issues)).toContain('p-0300')
  })

  it('refuses a declared role count that disagrees with its images', () => {
    const issues = issuesFor((draft) => {
      const splits = draft.splits as { training: { roles: Record<string, { count: number }> } }
      splits.training.roles.heldOut!.count = 7
    })
    expect(issues.some((entry) => entry.code === 'role-count-mismatch')).toBe(true)
    expect(messages(issues)).toContain('heldOut')
    expect(messages(issues)).toContain('7')
    expect(messages(issues)).toContain('40')
  })

  it('refuses a training split declaring no roles at all', () => {
    const issues = issuesFor((draft) => {
      const splits = draft.splits as { training: { roles?: unknown } }
      delete splits.training.roles
    })
    expect(issues.some((entry) => entry.field === 'splits.training.roles')).toBe(true)
  })

  it('refuses a category held out entirely, naming the role and the category', () => {
    const issues = issuesFor((draft) => {
      const images = draft.images as Record<string, { split: string; category: string; role?: string }>
      for (const image of Object.values(images)) {
        if (image.split === 'training' && image.category === 'green') image.role = 'heldOut'
      }
      const splits = draft.splits as { training: { roles: Record<string, { count: number }> } }
      splits.training.roles.fitted!.count -= 40
      splits.training.roles.heldOut!.count += 40
    })
    expect(issues.some((entry) => entry.code === 'category-missing-from-role')).toBe(true)
    expect(messages(issues)).toContain('green')
    expect(messages(issues)).toContain('fitted')
  })
})

describe('the roles are not a split', () => {
  it('still declares exactly two splits', () => {
    expect(POOL_SPLITS).toEqual(['training', 'pool'])
    expect(Object.keys(manifest.splits).sort()).toEqual(['pool', 'training'])
  })

  it('refuses a manifest declaring a third split, naming it', () => {
    const issues = issuesFor((draft) => {
      const splits = draft.splits as Record<string, unknown>
      splits.validation = { count: 40 }
    })
    expect(issues.some((entry) => entry.code === 'unknown-split')).toBe(true)
    expect(messages(issues)).toContain('validation')
  })

  it('still browses all 200 training images, held-out ones included', () => {
    const result = readPool(manifest, apple)
    if (!result.ok) throw new Error(messages(result.issues))
    expect(result.pool.order.training).toHaveLength(200)
    for (const id of result.pool.roles.heldOut) {
      expect(result.pool.order.training).toContain(id)
    }
  })
})

/**
 * What the tree reader refuses, one refusal per test.
 *
 * A shipped tree is checked once, when it is read, rather than once per image at
 * harvest: a defect found halfway through a thousand apples has already produced a
 * plausible-looking number for the first five hundred. Everything below therefore
 * happens before a single apple is scored, and every refusal names the configuration
 * and the defect, because a message that says only "invalid model" leaves an author
 * opening three files to find out which.
 *
 * The starting point is a real shipped tree with exactly one thing broken, so the rest
 * of the document stays plausible — the approach `artifact-index.test.ts` takes with the
 * prediction artifact.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readModelFile } from '../src/families/index.js'
import { appleDeclaration } from './helpers/apple'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const apple = appleDeclaration()

const family = apple.families.find((candidate) => candidate.ships === 'model')
if (family === undefined) throw new Error('the apple task declares no model-shipping family')

const index = JSON.parse(
  readFileSync(join(repoRoot, family.models ?? '', 'index.json'), 'utf8'),
) as { readonly configurations: Readonly<Record<string, { readonly file: string }>> }

const CONFIGURATION = Object.keys(index.configurations)[0] ?? ''
const rawTree = JSON.parse(
  readFileSync(
    join(repoRoot, family.models ?? '', index.configurations[CONFIGURATION]?.file ?? ''),
    'utf8',
  ),
) as Record<string, any>

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function issuesOf(mutate: (draft: Record<string, any>) => void) {
  const draft = copy(rawTree)
  mutate(draft)
  const result = readModelFile(draft, apple, family!, CONFIGURATION)
  if (result.ok) throw new Error('expected the tree to be refused')
  return result.issues
}

function named(issues: readonly { readonly message: string }[]): string {
  return issues.map((issue) => issue.message).join(' ')
}

describe('the shipped tree reads as it stands', () => {
  it('reads, so every refusal below is caused by the one thing it broke', () => {
    const result = readModelFile(copy(rawTree), apple, family!, CONFIGURATION)
    if (!result.ok) throw new Error(named(result.issues))
    expect(result.document.model.splits.length).toBeGreaterThan(0)
  })
})

describe('a tree asking about something the task does not measure', () => {
  it('refuses, naming the configuration and the feature', () => {
    const issues = issuesOf((draft) => {
      draft.model.splits[0].feature = 'wormVisibility'
    })
    expect(issues.some((issue) => issue.code === 'unknown-feature')).toBe(true)
    expect(named(issues)).toContain(CONFIGURATION)
    expect(named(issues)).toContain('wormVisibility')
  })

  it('refuses a feature that is not named at all', () => {
    const issues = issuesOf((draft) => {
      delete draft.model.splits[0].feature
    })
    expect(issues.some((issue) => issue.code === 'unknown-feature')).toBe(true)
    expect(named(issues)).toContain(CONFIGURATION)
  })
})

describe('a threshold outside the span its feature covers, or not a number at all', () => {
  it('refuses a cut above the declared range, naming the configuration and the feature', () => {
    const issues = issuesOf((draft) => {
      const feature = String(draft.model.splits[0].feature)
      const declared = apple.features.find((candidate) => candidate.id === feature)
      draft.model.splits[0].threshold = (declared?.range.max ?? 0) + 1
    })
    expect(issues.some((issue) => issue.code === 'threshold-out-of-range')).toBe(true)
    expect(named(issues)).toContain(CONFIGURATION)
    expect(named(issues)).toContain(String(rawTree.model.splits[0].feature))
  })

  it('refuses a cut below the declared range', () => {
    const issues = issuesOf((draft) => {
      const feature = String(draft.model.splits[0].feature)
      const declared = apple.features.find((candidate) => candidate.id === feature)
      draft.model.splits[0].threshold = (declared?.range.min ?? 0) - 1
    })
    expect(issues.some((issue) => issue.code === 'threshold-out-of-range')).toBe(true)
  })

  it('refuses a threshold that is not finite', () => {
    for (const value of [null, 'high', Number.POSITIVE_INFINITY]) {
      const issues = issuesOf((draft) => {
        draft.model.splits[0].threshold = value
      })
      expect(issues.some((issue) => issue.code === 'malformed-model'), String(value)).toBe(true)
      expect(named(issues)).toContain(CONFIGURATION)
    }
  })
})

describe('a path that does not terminate in a leaf', () => {
  it('refuses a chain with no fallback, naming the configuration and where it ends', () => {
    const issues = issuesOf((draft) => {
      delete draft.model.otherwise
    })
    expect(issues.some((issue) => issue.code === 'non-terminating-model')).toBe(true)
    expect(named(issues)).toContain(CONFIGURATION)
    expect(issues.some((issue) => issue.field === 'otherwise')).toBe(true)
  })

  it('refuses a model carrying no questions to ask at all', () => {
    const issues = issuesOf((draft) => {
      delete draft.model.splits
    })
    expect(issues.some((issue) => issue.code === 'malformed-model')).toBe(true)
    expect(named(issues)).toContain(CONFIGURATION)
  })
})

describe('a leaf that is not a distribution over the declared categories', () => {
  it('refuses a leaf with the wrong number of probabilities, naming where it sits', () => {
    const issues = issuesOf((draft) => {
      draft.model.splits[0].whenAbove = [0.5, 0.5]
    })
    expect(issues.some((issue) => issue.code === 'malformed-distribution')).toBe(true)
    expect(named(issues)).toContain(CONFIGURATION)
    expect(issues.some((issue) => issue.field === 'splits[0].whenAbove')).toBe(true)
  })

  it('refuses a leaf whose probabilities do not sum to one', () => {
    const issues = issuesOf((draft) => {
      draft.model.otherwise = [0.5, 0.5, 0.5]
    })
    expect(issues.some((issue) => issue.code === 'malformed-distribution')).toBe(true)
    expect(issues.some((issue) => issue.field === 'otherwise')).toBe(true)
  })

  it('refuses a leaf carrying a probability outside zero to one', () => {
    const issues = issuesOf((draft) => {
      draft.model.otherwise = [1.4, -0.2, -0.2]
    })
    expect(issues.some((issue) => issue.code === 'malformed-distribution')).toBe(true)
  })

  it('refuses a leaf that names a category instead of weighing them', () => {
    const issues = issuesOf((draft) => {
      draft.model.otherwise = 'wormy'
    })
    expect(issues.some((issue) => issue.code === 'malformed-distribution')).toBe(true)
    expect(named(issues)).toContain(CONFIGURATION)
  })
})

describe('a tree that belongs to something else', () => {
  it('refuses a file made in another family, naming both', () => {
    const issues = issuesOf((draft) => {
      draft.familyId = 'convolutional'
    })
    expect(issues.some((issue) => issue.code === 'artifact-family-mismatch')).toBe(true)
    expect(named(issues)).toContain(family!.id)
  })

  it('refuses a file that identifies itself as another configuration', () => {
    const issues = issuesOf((draft) => {
      draft.configurationId = 'nodes99-datasetstarter'
    })
    expect(issues.some((issue) => issue.code === 'artifact-configuration-mismatch')).toBe(true)
    expect(named(issues)).toContain(CONFIGURATION)
  })
})

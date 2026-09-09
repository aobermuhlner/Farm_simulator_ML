/**
 * What the artifact reader refuses.
 *
 * The committed artifact is the starting point for every case, so each test breaks
 * exactly one thing and the rest of the document stays real — the same approach
 * `pool-reader.test.ts` takes with the manifest.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  coverageIssue,
  readArtifactIndex,
  readConfigurationFile,
  UNTRAINED_CONFIGURATION,
  type PoolBinding,
} from '../src/task/artifactIndex.js'
import { firstFamily } from '../src/task/families.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const apple = appleDeclaration()
const manifest = committedManifest()

const binding: PoolBinding = {
  poolId: manifest.poolId,
  schemaVersion: manifest.schemaVersion,
  seed: manifest.seed,
}

const imageIds = {
  training: Object.entries(manifest.images)
    .filter(([, image]) => image.split === 'training')
    .map(([id]) => id),
  pool: Object.entries(manifest.images)
    .filter(([, image]) => image.split === 'pool')
    .map(([id]) => id),
}

const family = firstFamily(apple)

function read<T>(name: string): T {
  return JSON.parse(readFileSync(`${repoRoot}${family.predictions ?? ''}/${name}`, 'utf8')) as T
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const rawIndex = read<Record<string, unknown>>('index.json')
const DEFAULT_ID = 'blocks2-channels16-regularization1-dropout0'
const rawFile = read<Record<string, unknown>>(`${DEFAULT_ID}.json`)

function indexIssues(mutate: (draft: Record<string, any>) => void) {
  const draft = copy(rawIndex)
  mutate(draft)
  const result = readArtifactIndex(draft, apple, family, binding)
  if (result.ok) throw new Error('expected the index to be refused')
  return result.issues
}

function loadedIndex() {
  const result = readArtifactIndex(copy(rawIndex), apple, family, binding)
  if (!result.ok) throw new Error(result.issues.map((entry) => entry.message).join(' '))
  return result.index
}

function fileIssues(mutate: (draft: Record<string, any>) => void, id = DEFAULT_ID) {
  const draft = copy(rawFile)
  mutate(draft)
  const result = readConfigurationFile(draft, apple, loadedIndex(), id, imageIds)
  if (result.ok) throw new Error('expected the configuration file to be refused')
  return result.issues
}

function messages(issues: readonly { message: string }[]): string {
  return issues.map((entry) => entry.message).join(' ')
}

describe('the committed artifact reads', () => {
  it('loads its index and enumerates coverage without reading a prediction', () => {
    const index = loadedIndex()
    expect(index.coverage.length).toBeGreaterThan(0)
    expect(index.coverage).toContain(DEFAULT_ID)
  })

  it('loads a covered configuration with its history and both splits', () => {
    const result = readConfigurationFile(copy(rawFile), apple, loadedIndex(), DEFAULT_ID, imageIds)
    if (!result.ok) throw new Error(messages(result.issues))
    expect(result.entry.history).toHaveLength(40)
    expect(Object.keys(result.entry.predictions.training)).toHaveLength(200)
    expect(Object.keys(result.entry.predictions.pool)).toHaveLength(1000)
  })
})

describe('the pool an artifact is bound to', () => {
  it('refuses a differently seeded pool, naming both seeds', () => {
    const result = readArtifactIndex(copy(rawIndex), apple, family, { ...binding, seed: 999 })
    if (result.ok) throw new Error('expected a refusal')
    expect(result.issues.some((entry) => entry.code === 'artifact-pool-mismatch')).toBe(true)
    expect(messages(result.issues)).toContain('999')
    expect(messages(result.issues)).toContain(String(manifest.seed))
  })

  it('refuses a pool of another id or schema version', () => {
    for (const override of [{ poolId: 'pools/elsewhere' }, { schemaVersion: '9.9.9' }]) {
      const result = readArtifactIndex(copy(rawIndex), apple, family, { ...binding, ...override })
      if (result.ok) throw new Error('expected a refusal')
      expect(result.issues.some((entry) => entry.code === 'artifact-pool-mismatch')).toBe(true)
    }
  })
})

describe('coverage', () => {
  it('refuses an uncovered but valid configuration as untrained, not as invalid', () => {
    const issue = coverageIssue(loadedIndex(), 'blocks4-channels32-regularization0-dropout0.5')
    expect(issue?.code).toBe(UNTRAINED_CONFIGURATION)
    expect(issue?.message).toContain('blocks4-channels32-regularization0-dropout0.5')
    expect(issue?.message).toContain('trained')
    expect(issue?.message).not.toContain('invalid')
  })

  it('substitutes nothing for a configuration it does not cover', () => {
    const result = readConfigurationFile(
      copy(rawFile),
      apple,
      loadedIndex(),
      'blocks3-channels8-regularization2-dropout0.2',
      imageIds,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe(UNTRAINED_CONFIGURATION)
  })

  it('refuses an artifact that covers nothing', () => {
    const issues = indexIssues((draft) => {
      draft.configurations = {}
    })
    expect(issues.some((entry) => entry.code === 'empty-coverage')).toBe(true)
  })
})

describe('provenance', () => {
  it.each(['knobs', 'epochs', 'seed', 'pipeline', 'architecture', 'shaping'] as const)(
    'refuses a configuration recording no %s, naming it',
    (field) => {
      const issues = indexIssues((draft) => {
        delete draft.configurations[DEFAULT_ID][field]
      })
      expect(issues.some((entry) => entry.code === 'missing-provenance')).toBe(true)
      expect(messages(issues)).toContain(DEFAULT_ID)
    },
  )

  it('refuses a shaping step that names no configurations', () => {
    const issues = indexIssues((draft) => {
      draft.configurations[DEFAULT_ID].shaping = [{ step: 'sharpen-worms', configurations: [] }]
    })
    expect(issues.some((entry) => entry.code === 'unattributed-shaping')).toBe(true)
    expect(messages(issues)).toContain('sharpen-worms')
  })

  it('accepts a shaping step that attributes itself to the configuration it touched', () => {
    const draft = copy(rawIndex) as Record<string, any>
    draft.configurations[DEFAULT_ID].shaping = [
      { step: 'sharpen-worms', configurations: [DEFAULT_ID] },
    ]
    const result = readArtifactIndex(draft, apple, family, binding)
    if (!result.ok) throw new Error(messages(result.issues))
    expect(result.index.configurations[DEFAULT_ID]?.shaping).toHaveLength(1)
  })
})

describe('ground truth and decisions', () => {
  it('refuses an index that names a category as true', () => {
    const issues = indexIssues((draft) => {
      draft.configurations[DEFAULT_ID].category = 'red'
    })
    expect(issues.some((entry) => entry.code === 'artifact-states-truth')).toBe(true)
    expect(messages(issues)).toContain('category')
  })

  it('refuses a configuration file that carries a chosen action', () => {
    const issues = fileIssues((draft) => {
      draft.action = 'crate-red'
    })
    expect(issues.some((entry) => entry.code === 'artifact-states-truth')).toBe(true)
    expect(messages(issues)).toContain('action')
  })
})

describe('completeness', () => {
  it('refuses a missing image rather than scoring the ones present', () => {
    const issues = fileIssues((draft) => {
      delete draft.predictions.pool['p-0042']
    })
    expect(issues.some((entry) => entry.code === 'incomplete-configuration')).toBe(true)
    expect(messages(issues)).toContain('p-0042')
  })

  it('refuses an image the manifest does not declare', () => {
    const issues = fileIssues((draft) => {
      draft.predictions.training['t-999'] = [0.4, 0.3, 0.3]
    })
    expect(issues.some((entry) => entry.code === 'unknown-image')).toBe(true)
    expect(messages(issues)).toContain('t-999')
  })

  it('refuses a third split in the predictions', () => {
    const issues = fileIssues((draft) => {
      draft.predictions.validation = {}
    })
    expect(issues.some((entry) => entry.code === 'unknown-split')).toBe(true)
    expect(messages(issues)).toContain('validation')
  })

  it('refuses a file that identifies itself as another configuration', () => {
    const issues = fileIssues((draft) => {
      draft.configurationId = 'blocks2-channels8-regularization1-dropout0'
    })
    expect(issues.some((entry) => entry.code === 'artifact-configuration-mismatch')).toBe(true)
  })
})

describe('the training history', () => {
  it('refuses an epoch the run did not perform', () => {
    const issues = fileIssues((draft) => {
      draft.history[7].epoch = 99
    })
    expect(issues.some((entry) => entry.code === 'history-not-contiguous')).toBe(true)
    expect(messages(issues)).toContain('epoch 8')
  })

  it('refuses a history shorter than the epochs the run recorded', () => {
    const issues = fileIssues((draft) => {
      draft.history = draft.history.slice(0, 10)
    })
    expect(issues.some((entry) => entry.code === 'history-length-mismatch')).toBe(true)
  })

  it('refuses an accuracy that is not a share', () => {
    const issues = fileIssues((draft) => {
      draft.history[3].valAccuracy = 1.4
    })
    expect(issues.some((entry) => entry.code === 'malformed-history')).toBe(true)
    expect(messages(issues)).toContain('valAccuracy')
  })

  it('refuses a configuration with no history at all', () => {
    const issues = fileIssues((draft) => {
      draft.history = []
    })
    expect(issues.some((entry) => entry.code === 'missing-history')).toBe(true)
  })
})

describe('stored probabilities', () => {
  it.each([
    ['the wrong number of values', [0.5, 0.5]],
    ['a value outside zero to one', [1.4, -0.4, 0]],
    ['a sum outside the declared tolerance', [0.5, 0.2, 0.2]],
    ['a value finer than the declared precision', [0.33334, 0.33333, 0.33333]],
  ])('refuses %s, naming the configuration and the image', (_case, vector) => {
    const issues = fileIssues((draft) => {
      draft.predictions.training['t-001'] = vector
    })
    expect(issues.some((entry) => entry.code === 'malformed-distribution')).toBe(true)
    expect(messages(issues)).toContain('t-001')
    expect(messages(issues)).toContain(DEFAULT_ID)
  })

  it('refuses a tolerance the declared precision cannot meet', () => {
    const issues = indexIssues((draft) => {
      draft.encoding.sumTolerance = 1e-9
    })
    expect(issues.some((entry) => entry.code === 'encoding-tolerance-too-tight')).toBe(true)
  })
})

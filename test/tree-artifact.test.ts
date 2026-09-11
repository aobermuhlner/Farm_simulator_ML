/**
 * The shipped trees, as they sit on disk.
 *
 * They are placeholders: written out by hand, in the shape a fit would later emit, so
 * that everything downstream — the reader, the evaluator, the drawing, the scoring, the
 * report — sees exactly what it will see when the trees are real. `CLAUDE.md` permits
 * that while the frame is what is being built. What it does not permit is a placeholder
 * that presents itself as a fit, which is why the provenance is checked here rather than
 * inferred anywhere.
 *
 * Nothing in this file measures how good a tree is. That belongs to the change that
 * fits them, and a figure recorded here would be a figure somebody later mistook for a
 * measurement.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFamilyStore, readModelFile } from '../src/families/index.js'
import { readModelIndex } from '../src/families/modelIndex.js'
import type { PoolBinding } from '../src/task/artifactIndex.js'
import { truthFieldsIn } from '../src/task/artifactIndex.js'
import { configurationId } from '../src/task/configId.js'
import { defaultConfiguration } from '../src/task/configuration.js'
import { distributionProblem } from '../src/policy/index.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const apple = appleDeclaration()
const manifest = committedManifest()

const family = apple.families.find((candidate) => candidate.ships === 'model')
if (family === undefined) throw new Error('the apple task declares no model-shipping family')

const DIRECTORY = family.models ?? ''
const binding: PoolBinding = {
  poolId: manifest.poolId,
  schemaVersion: manifest.schemaVersion,
  seed: manifest.seed,
}

function read<T>(name: string): T {
  return JSON.parse(readFileSync(join(repoRoot, DIRECTORY, name), 'utf8')) as T
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const rawIndex = read<Record<string, any>>('index.json')

function loadedIndex() {
  const result = readModelIndex(copy(rawIndex), apple, family!, binding)
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return result.index
}

function indexIssues(mutate: (draft: Record<string, any>) => void) {
  const draft = copy(rawIndex)
  mutate(draft)
  const result = readModelIndex(draft, apple, family!, binding)
  if (result.ok) throw new Error('expected the model index to be refused')
  return result.issues
}

describe('the index binds the trees to the task, the family and the pool', () => {
  it('reads, and covers a configuration for every value of the node budget', () => {
    const index = loadedIndex()
    const nodes = family!.knobs.find((knob) => knob.id !== family!.datasetKnob)
    if (nodes === undefined || nodes.kind !== 'choice') throw new Error('no budget knob')

    expect(index.coverage).toHaveLength(nodes.values.length)
    for (const value of nodes.values) {
      const id = configurationId({
        taskId: apple.id,
        familyId: family!.id,
        values: [
          [nodes.id, value],
          [family!.datasetKnob, 'starter'],
        ],
      })
      expect(index.coverage, String(value)).toContain(id)
    }
  })

  it('covers the budget owned before any purchase', () => {
    expect(loadedIndex().coverage).toContain(
      configurationId(defaultConfiguration(apple, family!)),
    )
  })

  it('binds to the pool the manifest committed, and refuses another', () => {
    expect(loadedIndex().pool).toEqual(binding)
    const issues = indexIssues((draft) => {
      draft.pool.seed = binding.seed + 1
    })
    expect(issues.some((issue) => issue.code === 'artifact-pool-mismatch')).toBe(true)
  })

  it('names one file per configuration, so one is retrievable without the others', () => {
    const index = loadedIndex()
    const files = Object.values(index.files)

    expect(new Set(files).size).toBe(files.length)
    // Every file the directory holds is either the index or exactly one configuration's.
    expect(readdirSync(join(repoRoot, DIRECTORY)).sort()).toEqual(
      ['index.json', ...files].sort(),
    )
  })

  it('states no category as true and no action as chosen, anywhere', () => {
    expect(truthFieldsIn(rawIndex)).toEqual([])
    for (const name of Object.values(loadedIndex().files)) {
      expect(truthFieldsIn(read(name)), name).toEqual([])
    }
  })
})

describe('every shipped tree reads, and every leaf is a distribution', () => {
  const index = loadedIndex()

  for (const [id, file] of Object.entries(index.files)) {
    it(`reads ${id} against the shape the evaluator applies`, () => {
      const result = readModelFile(read(file), apple, family!, id)
      if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))

      const { model } = result.document
      const leaves = [...model.splits.map((split) => split.whenAbove), model.otherwise]
      for (const [at, leaf] of leaves.entries()) {
        expect(distributionProblem(apple, leaf), `${id} leaf ${at}`).toBeUndefined()
      }
    })

    it(`asks ${id}'s questions about numbers the task declares, inside their ranges`, () => {
      const result = readModelFile(read(file), apple, family!, id)
      if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))

      for (const split of result.document.model.splits) {
        const declared = apple.features.find((feature) => feature.id === split.feature)
        expect(declared, `${id} splits on ${split.feature}`).toBeDefined()
        expect(Number.isFinite(split.threshold)).toBe(true)
        expect(split.threshold, `${id} ${split.feature}`).toBeGreaterThanOrEqual(
          declared?.range.min ?? Number.NEGATIVE_INFINITY,
        )
        expect(split.threshold, `${id} ${split.feature}`).toBeLessThanOrEqual(
          declared?.range.max ?? Number.POSITIVE_INFINITY,
        )
      }
    })

    it(`records no history for ${id}, because the family declares none`, () => {
      expect(family!.history).toBeUndefined()
      expect(read<Record<string, unknown>>(file).history).toBeUndefined()
    })
  }

  it('reads no true category and no chosen action off any leaf', () => {
    // A leaf says how likely each kind of apple is. What is done about that is the
    // decision policy's, applied live, and the shape here is what keeps it so.
    for (const file of Object.values(index.files)) {
      const document = read<{ readonly model: Record<string, unknown> }>(file)
      const text = JSON.stringify(document.model)
      for (const forbidden of apple.actions.map((action) => action.id)) {
        expect(text, forbidden).not.toContain(forbidden)
      }
    }
  })

  it('grows: each budget keeps the smaller budget’s questions and adds to them', () => {
    // Best-first growth is what makes buying a node *extend* the tree a student has
    // rather than replace it, and the placeholders are written in that shape so the
    // fit that replaces them is a data change.
    const byBudget = Object.entries(index.files)
      .map(([id, file]) => {
        const result = readModelFile(read(file), apple, family!, id)
        if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
        return result.document.model.splits
      })
      .sort((a, b) => a.length - b.length)

    for (let step = 1; step < byBudget.length; step += 1) {
      const smaller = byBudget[step - 1] ?? []
      const larger = byBudget[step] ?? []
      expect(larger.length).toBeGreaterThan(smaller.length)
      expect(larger.slice(0, smaller.length)).toEqual(smaller)
    }
  })
})

describe('a placeholder records what it is, and a claimed fit must show itself', () => {
  it('records every shipped tree as authored, and names what authored it', () => {
    for (const [id, record] of Object.entries(loadedIndex().configurations)) {
      expect(record.provenance.origin, id).toBe('authored')
      expect(String(record.provenance.authoredBy).length, id).toBeGreaterThan(20)
    }
  })

  it('refuses a tree that claims a fit without recording what fitted it', () => {
    const first = Object.keys(rawIndex.configurations as Record<string, unknown>)[0] ?? ''
    const issues = indexIssues((draft) => {
      draft.configurations[first].provenance = { origin: 'fitted' }
    })
    expect(issues.some((issue) => issue.code === 'unrecorded-fit')).toBe(true)
    expect(issues.map((issue) => issue.message).join(' ')).toContain(first)
  })

  it('refuses a fit that names a revision but no seed, so it could not be repeated', () => {
    const first = Object.keys(rawIndex.configurations as Record<string, unknown>)[0] ?? ''
    const issues = indexIssues((draft) => {
      draft.configurations[first].provenance = {
        origin: 'fitted',
        pipeline: { revision: '0'.repeat(40), dirty: false },
      }
    })
    expect(issues.some((issue) => issue.code === 'unrecorded-fit')).toBe(true)
  })

  it('refuses an authored tree that names nothing as its author', () => {
    const first = Object.keys(rawIndex.configurations as Record<string, unknown>)[0] ?? ''
    const issues = indexIssues((draft) => {
      draft.configurations[first].provenance = { origin: 'authored' }
    })
    expect(issues.some((issue) => issue.code === 'missing-provenance')).toBe(true)
  })

  it('refuses a record carrying no provenance at all', () => {
    const first = Object.keys(rawIndex.configurations as Record<string, unknown>)[0] ?? ''
    const issues = indexIssues((draft) => {
      delete draft.configurations[first].provenance
    })
    expect(issues.some((issue) => issue.code === 'missing-provenance')).toBe(true)
  })

  it('refuses a record whose tier disagrees with its own identifier', () => {
    const first = Object.keys(rawIndex.configurations as Record<string, unknown>)[0] ?? ''
    const issues = indexIssues((draft) => {
      draft.configurations[first].tier = 'bulk'
    })
    expect(issues.some((issue) => issue.code === 'artifact-tier-mismatch')).toBe(true)
  })
})

describe('the store the registry builds from that index', () => {
  it('comes back through the shipped-form reader, with no prediction index beside it', () => {
    const store = readFamilyStore(copy(rawIndex), apple, family!, binding)
    if (!store.ok) throw new Error(store.issues.map((issue) => issue.message).join(' '))

    expect(store.store.coverage).toEqual(loadedIndex().coverage)
    expect(store.store.index).toBeUndefined()
  })
})

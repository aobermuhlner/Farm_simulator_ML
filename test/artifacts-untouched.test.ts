/**
 * The artifacts and the pool did not move, and could not have needed to.
 *
 * `three-action-sorting` claims loudly that going from two actions to three costs no
 * retraining and no new artifact. That claim rests on one structural fact: an action never
 * enters an artifact. `prediction-artifacts` stores a distribution over *categories*, and
 * `configId.ts` composes knob ids and values and nothing else, so renaming, adding or
 * repricing an action changes no identifier and invalidates no stored prediction.
 *
 * Asserted rather than assumed, and asserted against the shipped files rather than the
 * fixture, because the fixture is the one a rewrite would have quietly kept in step.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { configurationId } from '../src/task/configId.js'
import { defaultConfiguration } from '../src/task/configuration.js'
import { resolveFamilyEntry, readFamilyStore } from '../src/families/index.js'
import { firstFamily } from '../src/task/families.js'
import { appleDeclaration } from './helpers/apple'

const apple = appleDeclaration()
const family = firstFamily(apple)

const SHIPPED_INDEX = 'artifacts/apple-harvest/predictions/index.json'

interface ShippedIndex {
  readonly schemaVersion: string
  readonly taskId: string
  readonly categories: readonly string[]
  readonly configurations: Readonly<Record<string, { readonly file: string }>>
}

function shippedIndex(): ShippedIndex {
  return JSON.parse(readFileSync(join(process.cwd(), SHIPPED_INDEX), 'utf8')) as ShippedIndex
}

describe('the shipped prediction index is untouched by the widening', () => {
  it('still resolves the shipped defaults to the configuration it was trained for', () => {
    const id = configurationId(defaultConfiguration(apple, family))

    expect(id).toBe('blocks2-channels16-regularization1-dropout0')
    expect(Object.keys(shippedIndex().configurations)).toContain(id)
  })

  it('covers exactly the configurations it covered before', () => {
    expect(Object.keys(shippedIndex().configurations)).toEqual([
      'blocks2-channels8-regularization1-dropout0',
      'blocks2-channels16-regularization1-dropout0',
      'blocks2-channels32-regularization1-dropout0',
    ])
  })

  it('indexes its probability vectors by the declared category order, not by an action', () => {
    const index = shippedIndex()

    expect(index.categories).toEqual(apple.categories.map((category) => category.id))
    expect(index.taskId).toBe(apple.id)
  })
})

describe('no artifact could have needed to change', () => {
  it('names no action anywhere in the shipped index or its configuration files', () => {
    // The reason the rename is free. If an id ever did reach an artifact, this is where a
    // later widening would find out — before it shipped a stale one.
    const index = shippedIndex()
    const files = [
      readFileSync(join(process.cwd(), SHIPPED_INDEX), 'utf8'),
      ...Object.values(index.configurations).map((entry) =>
        readFileSync(join(process.cwd(), 'artifacts/apple-harvest/predictions', entry.file), 'utf8'),
      ),
    ]

    expect(files.length).toBeGreaterThan(1)
    for (const action of apple.actions) {
      for (const text of files) {
        expect(text, `an artifact names action "${action.id}"`).not.toContain(action.id)
        expect(text, `an artifact names action "${action.label}"`).not.toContain(action.label)
      }
    }
  })

  it('carries no key that would state a decision or a ground truth', () => {
    const raw = readFileSync(join(process.cwd(), SHIPPED_INDEX), 'utf8')
    const index = shippedIndex() as unknown as Record<string, unknown>

    for (const forbidden of ['"action"', '"chosen"', '"category":']) {
      expect(raw, `the shipped index carries ${forbidden}`).not.toContain(forbidden)
    }
    // `categories` is the vector's index order, which is not a claim about any image.
    expect(index).toHaveProperty('categories')
    expect(index).not.toHaveProperty('category')
  })
})

/**
 * The shipped artifacts after the family move: metadata only.
 *
 * `model-families` re-emits every shipped file to record which family made it, and
 * nothing else about them changes — no probability, no configuration key, no history
 * entry, and no retraining. What follows is the standing form of that promise: every
 * configuration the artifact covers resolves, through the family-scoped path, to exactly
 * the numbers its own file carries.
 */
describe('the shipped artifacts belong to a declared family', () => {
  const family = firstFamily(apple)
  const directory = family.predictions ?? ''

  function read<T>(name: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), `${directory}/${name}`), 'utf8')) as T
  }

  const index = read<{
    readonly familyId?: string
    readonly configurations: Readonly<Record<string, { readonly file: string }>>
  }>('index.json')

  it('records the family on the index, so no family has to be assumed for it', () => {
    expect(index.familyId).toBe(family.id)
    expect(apple.families.map((declared) => declared.id)).toContain(index.familyId)
  })

  it('records it on every configuration file too', () => {
    for (const [id, record] of Object.entries(index.configurations)) {
      const file = read<{ familyId?: string; taskId?: string; configurationId?: string }>(
        record.file,
      )
      expect(file.familyId, id).toBe(family.id)
      expect(file.taskId, id).toBe(apple.id)
      expect(file.configurationId, id).toBe(id)
    }
  })

  it('resolves every covered configuration to the numbers its own file carries', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'pools/apple-harvest/manifest.json'), 'utf8'),
    ) as { poolId: string; schemaVersion: string; seed: number; images: Record<string, { split: string }> }
    const binding = {
      poolId: manifest.poolId,
      schemaVersion: manifest.schemaVersion,
      seed: manifest.seed,
    }
    const store = readFamilyStore(index, apple, family, binding)
    if (!store.ok) throw new Error(store.issues.map((issue) => issue.message).join(' '))

    const imageIds: Record<string, string[]> = { training: [], pool: [] }
    for (const [id, image] of Object.entries(manifest.images)) {
      imageIds[image.split]?.push(id)
    }

    expect(store.store.coverage.length).toBeGreaterThan(0)
    for (const id of store.store.coverage) {
      const file = index.configurations[id]?.file ?? ''
      const document = read<{
        history: readonly unknown[]
        predictions: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>>
      }>(file)

      const resolved = resolveFamilyEntry({
        declaration: apple,
        family,
        configurationId: id,
        document,
        imageIds,
        index: store.store.index,
      })

      if (!resolved.ok) throw new Error(resolved.issues.map((issue) => issue.message).join(' '))
      expect(resolved.entry.history, id).toEqual(document.history)
      for (const split of ['training', 'pool'] as const) {
        expect([...resolved.entry.imageIdsIn(split)].sort(), `${id}/${split}`).toEqual(
          Object.keys(document.predictions[split] ?? {}).sort(),
        )
        for (const imageId of resolved.entry.imageIdsIn(split)) {
          expect(resolved.entry.distributionFor(split, imageId), `${id}/${split}/${imageId}`).toEqual(
            document.predictions[split]?.[imageId],
          )
        }
      }
    }
  })

  it('records no retraining: the run behind each configuration is the one committed', () => {
    // A re-emit changes metadata. A retrain would change the seed a run was fitted at,
    // the number of epochs it ran for, or the revision that produced it.
    for (const [id, record] of Object.entries(index.configurations)) {
      const provenance = record as unknown as {
        readonly seed: number
        readonly epochs: number
        readonly pipeline: { readonly revision: string; readonly dirty: boolean }
        readonly shaping: readonly unknown[]
      }
      expect(provenance.pipeline.revision, id).toMatch(/^[0-9a-f]{40}$/)
      expect(provenance.pipeline.dirty, id).toBe(false)
      expect(provenance.epochs, id).toBeGreaterThan(0)
      expect(provenance.shaping, id).toEqual([])
    }
  })
})

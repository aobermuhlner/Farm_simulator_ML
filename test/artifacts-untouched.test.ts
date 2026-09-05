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
import { appleDeclaration } from './helpers/apple'

const apple = appleDeclaration()

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
    const id = configurationId(defaultConfiguration(apple))

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

/**
 * The tree drawn is the tree that scores, and it is drawn in the task's own words.
 *
 * Two claims, and they are the whole reason the structure ships rather than a table of
 * its predictions.
 *
 * The first is identity. The drawing is resolved from the same `ShippedModel` the
 * evaluator walks, carried on the same entry, so there is no second copy to drift.
 * Asserted by reading both out of one resolution and comparing them question by
 * question — not by drawing one and trusting that it matches.
 *
 * The second is that a specific apple's route through it can be traced, and that the
 * route agrees with the answer the scorer gives that apple. A drawing that highlighted a
 * path the model does not take would be worse than no drawing: it would teach the wrong
 * mechanism convincingly.
 *
 * The component itself is tested beside it, under jsdom; this file is the engine's half.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { entryFromModel, predictWith, readModelFile } from '../src/families/index.js'
import { vectorOf } from '../src/features/index.js'
import { readPool } from '../src/pool/index.js'
import { resolveArchitecture, traceTree } from '../src/task/diagram.js'
import type { ResolvedTree } from '../src/task/diagram.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const apple = appleDeclaration()
const manifest = committedManifest()

const family = apple.families.find((candidate) => candidate.ships === 'model')
if (family === undefined) throw new Error('the apple task declares no model-shipping family')

const pool = (() => {
  const result = readPool(manifest as unknown, apple)
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return result.pool
})()

const imageIds: Readonly<Record<string, readonly string[]>> = {
  training: Object.keys(manifest.images).filter((id) => manifest.images[id]?.split === 'training'),
  pool: Object.keys(manifest.images).filter((id) => manifest.images[id]?.split === 'pool'),
}

const features = Object.fromEntries(
  Object.keys(manifest.images).map((id) => {
    const vector = vectorOf(apple, pool, id)
    if (vector === undefined) throw new Error(`the manifest records no full vector for ${id}`)
    return [id, vector]
  }),
)

function read<T>(name: string): T {
  return JSON.parse(readFileSync(join(repoRoot, family!.models ?? '', name), 'utf8')) as T
}

const index = read<{ readonly configurations: Readonly<Record<string, { readonly file: string }>> }>(
  'index.json',
)

/** One configuration, resolved the way the workshop resolves it: model first, drawing from it. */
function drawn(configurationId: string, budget: number) {
  const record = index.configurations[configurationId]
  const model = readModelFile(read(record?.file ?? ''), apple, family!, configurationId)
  if (!model.ok) throw new Error(model.issues.map((issue) => issue.message).join(' '))

  const entry = entryFromModel(model.document, imageIds, features)
  const architecture = resolveArchitecture(
    apple,
    family!,
    { nodes: budget, [family!.datasetKnob]: 'starter' },
    entry.structure,
  )
  if (architecture?.kind !== 'tree') throw new Error(`no tree drawing for ${configurationId}`)
  return { architecture, entry, model: model.document.model }
}

/** Every covered configuration with the budget its identifier carries. */
const covered = Object.keys(index.configurations).map((id) => ({
  id,
  budget: Number(/nodes(\d+)/.exec(id)?.[1] ?? 0),
}))

describe('the drawing comes from the structure and not from the knobs', () => {
  it('is not drawn at all before the model is in hand', () => {
    // A family whose shape lives in its model has nothing honest to draw until the model
    // arrives. An empty outline would read as a tree that asks no questions.
    expect(
      resolveArchitecture(apple, family!, { nodes: 2, [family!.datasetKnob]: 'starter' }),
    ).toBeUndefined()
  })

  it('draws one question per question the tree actually asks, at every budget', () => {
    for (const { id, budget } of covered) {
      const { architecture, model } = drawn(id, budget)
      expect(architecture.questions, id).toHaveLength(model.splits.length)
      expect(architecture.nodes, id).toBe(model.splits.length)
      expect(architecture.nodes, id).toBe(budget)
    }
  })

  it('draws the same thresholds the scorer compares against', () => {
    for (const { id, budget } of covered) {
      const { architecture, model } = drawn(id, budget)
      expect(architecture.questions.map((question) => question.threshold), id).toEqual(
        model.splits.map((split) => split.threshold),
      )
    }
  })

  it('draws the same leaves the scorer answers with, in the declared category order', () => {
    for (const { id, budget } of covered) {
      const { architecture, model } = drawn(id, budget)
      const drawnLeaves = [
        ...architecture.questions.map((question) => question.whenAbove),
        architecture.otherwise,
      ]
      const modelLeaves = [...model.splits.map((split) => split.whenAbove), model.otherwise]

      expect(drawnLeaves.length).toBe(modelLeaves.length)
      for (const [at, leaf] of drawnLeaves.entries()) {
        expect(leaf.shares.map((share) => share.probability), `${id} leaf ${at}`).toEqual(
          modelLeaves[at],
        )
        expect(leaf.shares.map((share) => share.categoryLabel), `${id} leaf ${at}`).toEqual(
          apple.categories.map((category) => category.label),
        )
      }
    }
  })
})

describe('the drawing names nothing of its own', () => {
  it('says a question in the words the task declares for the number it cuts', () => {
    const { architecture, model } = drawn(covered[0]?.id ?? '', covered[0]?.budget ?? 0)

    for (const [at, question] of architecture.questions.entries()) {
      const feature = apple.features.find((candidate) => candidate.id === model.splits[at]?.feature)
      expect(question.featureLabel, String(at)).toBe(feature?.label)
      expect(question.unit, String(at)).toBe(feature?.unit)
    }
  })

  it('carries no feature id anywhere in what it hands the screen', () => {
    // The screen is given labels. An id reaching it would be an id the screen either
    // printed at a student or held a prettier table of names for.
    const { architecture } = drawn(covered[0]?.id ?? '', covered[0]?.budget ?? 0)
    const text = JSON.stringify(architecture)

    for (const feature of apple.features) {
      expect(text, feature.id).not.toContain(`"${feature.id}"`)
    }
  })

  it('names the budget knob in the words the family declares for it', () => {
    const { architecture } = drawn(covered[0]?.id ?? '', covered[0]?.budget ?? 0)
    const knob = family!.knobs.find((candidate) => candidate.id !== family!.datasetKnob)

    expect(architecture.nodesLabel).toBe(knob?.label)
  })

  it('refuses to resolve a tree whose diagram names a knob the family does not declare', () => {
    const misdeclared = { ...family!, diagram: { kind: 'tree' as const, nodesKnob: 'depth' } }
    const { model } = drawn(covered[0]?.id ?? '', covered[0]?.budget ?? 0)

    expect(
      resolveArchitecture(
        apple,
        misdeclared,
        { nodes: covered[0]?.budget ?? 0, [family!.datasetKnob]: 'starter' },
        model,
      ),
    ).toBeUndefined()
  })
})

describe('one apple’s path through the tree', () => {
  it('traces every image of the pool to the leaf the scorer gives it', () => {
    const { architecture, model } = drawn(covered[0]?.id ?? '', covered[0]?.budget ?? 0)
    const leaves = [...model.splits.map((split) => split.whenAbove), model.otherwise]

    for (const imageId of Object.keys(manifest.images)) {
      const vector = features[imageId] ?? {}
      const path = traceTree(model, vector)
      const landed = path.claimedBy ?? model.splits.length

      expect(leaves[landed], imageId).toEqual(predictWith(model, vector))
      // And the drawing has a leaf at exactly that position to highlight.
      const drawnLeaf =
        path.claimedBy === undefined
          ? architecture.otherwise
          : architecture.questions[path.claimedBy]?.whenAbove
      expect(drawnLeaf?.shares.map((share) => share.probability), imageId).toEqual(
        predictWith(model, vector),
      )
    }
  })

  it('walks past exactly the questions the apple answered no to, in order', () => {
    const { model } = drawn(covered[0]?.id ?? '', covered[0]?.budget ?? 0)

    for (const imageId of Object.keys(manifest.images).slice(0, 200)) {
      const vector = features[imageId] ?? {}
      const path = traceTree(model, vector)

      expect(path.answeredNo).toEqual(
        Array.from({ length: path.claimedBy ?? model.splits.length }, (_, at) => at),
      )
      for (const at of path.answeredNo) {
        const split = model.splits[at]
        if (split === undefined) throw new Error('walked past a question the tree does not ask')
        expect(vector[split.feature] ?? Number.NEGATIVE_INFINITY, `${imageId} q${at}`).toBeLessThanOrEqual(
          split.threshold,
        )
      }
      if (path.claimedBy !== undefined) {
        const split = model.splits[path.claimedBy]
        expect(vector[split?.feature ?? ''] ?? 0, imageId).toBeGreaterThan(split?.threshold ?? 0)
      }
    }
  })

  it('finds a real apple that every branch of every budget claims', () => {
    // A question no apple in 1 200 ever answers yes to is a branch a student can never
    // trace, which makes the drawing wider than the lesson in it. This is not a
    // measurement of the tree; it is a check that the drawing has something to show.
    for (const { id, budget } of covered) {
      const { model } = drawn(id, budget)
      const claimed = new Set<number | undefined>()
      for (const imageId of Object.keys(manifest.images)) {
        claimed.add(traceTree(model, features[imageId] ?? {}).claimedBy)
      }

      for (let at = 0; at < model.splits.length; at += 1) {
        expect(claimed.has(at), `${id}: question ${at} claims no apple in the pool`).toBe(true)
      }
      expect(claimed.has(undefined), `${id}: no apple reaches the last leaf`).toBe(true)
    }
  })
})

/** Kept honest: a `ResolvedTree` is what the drawing is handed, and nothing wider. */
const _shape: ResolvedTree = drawn(covered[0]?.id ?? '', covered[0]?.budget ?? 0).architecture
void _shape

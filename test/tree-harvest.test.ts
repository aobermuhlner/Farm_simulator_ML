/**
 * A harvest scored from the tree, through the engine the network already runs on.
 *
 * `runFielded` takes a `FamilyEntry` and scores it, and the decision policy, the payoff
 * table and the report never learn where the entry came from. That is the boundary the
 * whole family abstraction rests on, and a second family is the only thing that can
 * demonstrate it holds: everything below goes through the same `scoreCrop` the
 * convolutional runs use, unchanged, with a tree behind it.
 *
 * The figures here are not read as measurements of anything. The trees are placeholders
 * and what they earn is an artefact of the numbers somebody typed; what is asserted is
 * that a year runs, that its earnings are the payoff table applied to the actions the
 * policy chose, and that the leaf chose none of them.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { entryFromModel, readModelFile } from '../src/families/index.js'
import { vectorOf } from '../src/features/index.js'
import { chooseAction } from '../src/policy/index.js'
import { readPool } from '../src/pool/index.js'
import { CROP_SPLIT, scoreCrop } from '../src/scoring/index.js'
import type { CropImage } from '../src/sorting/index.js'
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
const CONFIGURATION = Object.keys(index.configurations)[0] ?? ''

function shippedEntry(configurationId = CONFIGURATION) {
  const record = index.configurations[configurationId]
  const result = readModelFile(read(record?.file ?? ''), apple, family!, configurationId)
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return { document: result.document, entry: entryFromModel(result.document, imageIds, features) }
}

/** A year's crop: every picture of the evaluation pool, once, with its true category. */
const crop: readonly CropImage[] = (imageIds[CROP_SPLIT] ?? []).map((imageId) => ({
  imageId,
  category: manifest.images[imageId]?.category ?? '',
}))

describe('the year runs over the evaluation pool, scored from the tree', () => {
  it('scores every piece of the crop and reports earnings', () => {
    const { entry } = shippedEntry()
    const result = scoreCrop(apple, CONFIGURATION, entry, crop)

    if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
    expect(result.configurationId).toBe(CONFIGURATION)
    expect(result.outcome.evaluated).toBe(crop.length)
    expect(Number.isFinite(result.outcome.earnings)).toBe(true)
  })

  it('breaks the run down per true category and chosen action, never to one number', () => {
    // The diagnosis trap: an over-selective model looks excellent on wormy apples for
    // entirely the wrong reason. The breakdown is what makes that visible, and it has
    // to be there whatever family produced the run.
    const { entry } = shippedEntry()
    const result = scoreCrop(apple, CONFIGURATION, entry, crop)
    if (!result.ok) throw new Error('the crop should score')

    for (const category of apple.categories) {
      const row = result.outcome.counts[category.id]
      expect(row, category.id).toBeDefined()
      for (const action of apple.actions) expect(row?.[action.id], action.id).toBeDefined()
    }
    const counted = apple.categories.reduce(
      (sum, category) =>
        sum +
        apple.actions.reduce(
          (row, action) => row + (result.outcome.counts[category.id]?.[action.id] ?? 0),
          0,
        ),
      0,
    )
    expect(counted).toBe(result.outcome.evaluated)
  })

  it('runs every covered budget, so nothing on sale scores differently in kind', () => {
    for (const configurationId of Object.keys(index.configurations)) {
      const { entry } = shippedEntry(configurationId)
      const result = scoreCrop(apple, configurationId, entry, crop)
      if (!result.ok) throw new Error(`${configurationId}: ${result.issues[0]?.message ?? ''}`)
      expect(result.outcome.evaluated, configurationId).toBe(crop.length)
    }
  })
})

describe('the decision policy chooses the action, not the leaf', () => {
  it('gives every image the action the declared policy makes of its leaf', () => {
    const { entry } = shippedEntry()
    const result = scoreCrop(apple, CONFIGURATION, entry, crop)
    if (!result.ok) throw new Error('the crop should score')

    for (const image of result.outcome.images) {
      expect(image.action, image.imageId).toBe(chooseAction(apple, image.distribution))
    }
  })

  it('carries a distribution per image and no chosen action out of the tree', () => {
    // The entry the engine is handed says how likely each kind of apple is, and says
    // nothing about what to do. Every action in the run above was made downstream of it.
    const { document, entry } = shippedEntry()
    const text = JSON.stringify(document.model)
    for (const action of apple.actions) expect(text).not.toContain(action.id)

    const distribution = entry.distributionFor(CROP_SPLIT, crop[0]?.imageId ?? '')
    expect(distribution).toHaveLength(apple.categories.length)
  })

  it('re-sorts the same harvest under a different declared policy', () => {
    // The same tree, the same crop, the same leaves — and a different report, because
    // the rule that reads the leaves moved. That is the separation stated as a run.
    const { entry } = shippedEntry()
    const demanding = {
      ...apple,
      policy: {
        kind: 'threshold' as const,
        thresholds: Object.fromEntries(apple.categories.map((category) => [category.id, 0.99])),
        fallbackAction: 'discard',
        priority: apple.categories.map((category) => category.id),
      },
    }

    const first = scoreCrop(apple, CONFIGURATION, entry, crop)
    const second = scoreCrop(demanding, CONFIGURATION, entry, crop)
    if (!first.ok || !second.ok) throw new Error('both runs should score')

    expect(second.outcome.images.every((image) => image.action === 'discard')).toBe(true)
    expect(first.outcome.earnings).not.toBe(second.outcome.earnings)
  })
})

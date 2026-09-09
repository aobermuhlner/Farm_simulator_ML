/**
 * Scoring the year's crop rather than the pool.
 *
 * The distinction this file exists for is invisible while a crop happens to be the pool:
 * both would evaluate a thousand images and both would return the same number every year.
 * So every test below is against a crop whose size is not the pool's, and the shipped
 * artifact rather than a fixture, because what changed is which images a real harvest is
 * scored over.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Farm, FarmDeclaration } from '../src/economy/index.js'
import { openFarm } from '../src/economy/index.js'
import type { LoadedPool } from '../src/pool/index.js'
import { readPool } from '../src/pool/index.js'
import { entryFromPredictions } from '../src/families/index.js'
import type { ConfigurationEntry, PredictionArtifact } from '../src/task/artifact.js'
import { firstFamily } from '../src/task/families.js'
import { CROP_SPLIT, scoreCrop, valueDelivery } from '../src/scoring/index.js'
import type { Crop, CropSplit } from '../src/sorting/index.js'
import { drawCrop } from '../src/sorting/index.js'
import { appleDeclaration } from './helpers/apple.js'

const declaration = appleDeclaration()

const base: FarmDeclaration = {
  name: 'Test Farm',
  currency: 'ETB',
  precision: 2,
  openingBalance: 0,
  openingYear: 1,
  orchard: { label: 'Orchard', unit: 'trees', opening: 6000, piecesPerUnit: 1 },
  cropComposition: { red: 0.55, green: 0.35, wormy: 0.1 },
}

function pool(): LoadedPool {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'pools/apple-harvest/manifest.json'), 'utf8'),
  ) as unknown
  const read = readPool(raw, declaration)
  if (!read.ok) throw new Error(`the committed pool must read: ${read.issues[0]?.message}`)
  return read.pool
}

const committed = pool()
const split: CropSplit = { imageIds: committed.order.pool, truth: committed.truth }

const directory = firstFamily(declaration).predictions ?? ''

/** One shipped configuration's stored predictions, read off disk. */
function shippedEntry(configurationId: string): ConfigurationEntry {
  const index = JSON.parse(
    readFileSync(join(process.cwd(), `${directory}/index.json`), 'utf8'),
  ) as { configurations: Record<string, { file: string }> }
  const record = index.configurations[configurationId]
  if (record === undefined) throw new Error(`no shipped configuration "${configurationId}"`)
  return JSON.parse(
    readFileSync(join(process.cwd(), `${directory}/${record.file}`), 'utf8'),
  ) as ConfigurationEntry
}

const SHIPPED = 'blocks2-channels16-regularization1-dropout0-datasetstarter'
const stored = shippedEntry(SHIPPED)
const entry = entryFromPredictions(stored)

function farm(over: Partial<Farm> = {}): Farm {
  return { ...openFarm(base), ...over }
}

function cropOf(state: Farm = farm(), seed = 4242): Crop {
  const draw = drawCrop(declaration, state, split, seed)
  if (!draw.ok) throw new Error(`the crop was meant to draw: ${draw.issues[0]?.message}`)
  return draw.crop
}

function scored(crop: Crop) {
  const result = scoreCrop(declaration, SHIPPED, entry, crop.pieces)
  if (!result.ok) throw new Error(`the crop was meant to score: ${result.issues[0]?.message}`)
  return result.outcome
}

describe('a model is scored over the year’s crop rather than over the pool', () => {
  it('evaluates as many images as the crop holds, not as many as the pool does', () => {
    const crop = cropOf(farm({ land: 6000 }))
    expect(entry.imageIdsIn(CROP_SPLIT)).toHaveLength(1000)
    expect(scored(crop).evaluated).toBe(6000)
  })

  it('evaluates fewer than the pool when the orchard is smaller than it', () => {
    const crop = cropOf(farm({ land: 300 }))
    expect(scored(crop).evaluated).toBe(300)
  })

  it('counts every cell over the crop, so the counts come to the crop’s size', () => {
    const outcome = scored(cropOf(farm({ land: 6000 })))
    let total = 0
    for (const category of declaration.categories) {
      for (const action of declaration.actions) {
        total += outcome.counts[category.id]?.[action.id] ?? 0
      }
    }
    expect(total).toBe(6000)
  })

  it('gives a bigger orchard a bigger harvest, which scoring the pool never could', () => {
    const small = scored(cropOf(farm({ land: 1200 })))
    const large = scored(cropOf(farm({ land: 6000 })))
    expect(large.evaluated).toBeGreaterThan(small.evaluated)
    expect(large.earnings).toBeGreaterThan(small.earnings)
  })

  it('gives a different year a different harvest for one unchanged configuration', () => {
    const first = scored(cropOf(farm({ year: 1, land: 6000 })))
    const second = scored(cropOf(farm({ year: 2, land: 6000 })))
    expect(second.earnings).not.toBe(first.earnings)
  })
})

describe('a picture standing for several pieces is scored once for each', () => {
  it('counts a repeated picture once per appearance, in payoff and in cell alike', () => {
    const crop = cropOf(farm({ land: 6000 }))
    expect(crop.recurred).toBe(true)

    const appearances = new Map<string, number>()
    for (const piece of crop.pieces) {
      appearances.set(piece.imageId, (appearances.get(piece.imageId) ?? 0) + 1)
    }
    const repeated = [...appearances].find(([, count]) => count > 1)
    expect(repeated).toBeDefined()

    const outcome = scored(crop)
    const scoredTimes = outcome.images.filter(
      (image) => image.imageId === (repeated?.[0] ?? ''),
    )
    expect(scoredTimes).toHaveLength(repeated?.[1] ?? 0)

    // Every appearance carries its own payoff, and they are the same payoff: the same
    // picture under the same configuration cannot be decided two different ways.
    const chosen = new Set(scoredTimes.map((image) => image.action))
    expect(chosen.size).toBe(1)
    const sum = scoredTimes.reduce((total, image) => total + image.payoff, 0)
    expect(sum).toBeCloseTo((scoredTimes[0]?.payoff ?? 0) * scoredTimes.length, 10)
  })

  it('scores a crop of six passes at six times a crop of one, image for image', () => {
    // Every picture of the pool exactly once against every picture exactly six times: the
    // second is six of the first, which is what "each appearance is its own apple" means.
    const once = scoreCrop(
      declaration,
      SHIPPED,
      entry,
      committed.order.pool.map((imageId) => ({
        imageId,
        category: committed.truth[imageId] as string,
      })),
    )
    const sixfold = scoreCrop(
      declaration,
      SHIPPED,
      entry,
      [0, 1, 2, 3, 4, 5].flatMap(() =>
        committed.order.pool.map((imageId) => ({
          imageId,
          category: committed.truth[imageId] as string,
        })),
      ),
    )
    if (!once.ok || !sixfold.ok) throw new Error('both crops were meant to score')
    expect(sixfold.outcome.evaluated).toBe(once.outcome.evaluated * 6)
    expect(sixfold.outcome.earnings).toBeCloseTo(once.outcome.earnings * 6, 8)
  })
})

describe('a crop the configuration cannot be scored over refuses', () => {
  it('names the image a configuration has no stored prediction for', () => {
    const result = scoreCrop(declaration, SHIPPED, entry, [
      { imageId: 'not-an-image', category: 'red' },
    ])
    expect(result.ok).toBe(false)
    const issue = result.ok ? undefined : result.issues[0]
    expect(issue?.code).toBe('missing-prediction')
    expect(issue?.field).toBe('not-an-image')
  })

  it('names an image whose stored distribution is unusable, and scores nothing', () => {
    const first = committed.order.pool[0] as string
    const corrupt = entryFromPredictions({
      history: stored.history,
      predictions: {
        ...stored.predictions,
        [CROP_SPLIT]: { ...stored.predictions[CROP_SPLIT], [first]: [0.5, 0.5, 0.5] },
      },
    } as ConfigurationEntry)
    const result = scoreCrop(declaration, SHIPPED, corrupt, [
      { imageId: first, category: 'red' },
    ])
    expect(result.ok).toBe(false)
    expect(result.ok ? undefined : result.issues[0]?.code).toBe('malformed-distribution')
  })

  it('reports one cause per image however often that image recurs', () => {
    const result = scoreCrop(declaration, SHIPPED, entry, [
      { imageId: 'not-an-image', category: 'red' },
      { imageId: 'not-an-image', category: 'red' },
      { imageId: 'not-an-image', category: 'red' },
    ])
    expect(result.ok ? [] : result.issues).toHaveLength(1)
  })

  it('reads its predictions from the evaluation split and nowhere else', () => {
    // The training split is the one a model was fitted on; a crop scored against it would
    // be the flattering wrong number the whole pool split exists to prevent. An entry
    // holding only the training split therefore scores nothing at all: it is asked for
    // the evaluation split, has none, and refuses naming the image.
    expect(CROP_SPLIT).toBe('pool')
    const trainingOnly = entryFromPredictions({
      history: stored.history,
      predictions: { training: stored.predictions.training },
    } as unknown as PredictionArtifact['configurations'][string])
    const image = committed.order.training[0] as string

    const result = scoreCrop(declaration, SHIPPED, trainingOnly, [
      { imageId: image, category: 'red' },
    ])

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.issues.map((issue) => issue.field)).toEqual([image])
  })
})

describe('the year’s harvest is valued from the crop it was scored over', () => {
  it('holds gross less downgrade equals paid over a real crop', () => {
    const outcome = scored(cropOf(farm({ land: 6000 })))
    const value = valueDelivery(declaration, outcome)
    expect(value.gross).toBeCloseTo(outcome.earnings, 8)
    expect(value.gross - value.downgrade).toBeCloseTo(value.paid, 8)
  })
})

describe('no dataset tier label reaches the scoring', () => {
  /**
   * The committed pool with its one tier filing every red apple as green.
   *
   * The task's declared composition moves with it, because a tier declares the counts it
   * filed rather than the counts it holds — the reader refuses the two disagreeing, which
   * is checked in `pool-reader.test.ts`. What is under test here is that nothing
   * downstream of the reader is affected by the move.
   */
  function relabelled(): LoadedPool {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), 'pools/apple-harvest/manifest.json'), 'utf8'),
    ) as { images: Record<string, { tierLabels?: Record<string, string> }> }
    for (const image of Object.values(raw.images)) {
      if (image.tierLabels?.starter === 'red') image.tierLabels.starter = 'green'
    }
    const misfiling = {
      ...declaration,
      datasets: declaration.datasets.map((tier, index) =>
        index === 0 ? { ...tier, composition: { red: 0, green: 150, wormy: 50 } } : tier,
      ),
    }
    const read = readPool(raw, misfiling)
    if (!read.ok) throw new Error(`the doctored pool must read: ${read.issues[0]?.message}`)
    return read.pool
  }

  it('reads the truth off the manifest’s category and never off a tier label', () => {
    const misfiled = relabelled()

    // The tier really does disagree with the truth now, so the assertion below has
    // something to be about.
    const reds = misfiled.order.training.filter((id) => misfiled.truth[id] === 'red')
    expect(reds.length).toBeGreaterThan(0)
    for (const id of reds) expect(misfiled.tierLabels[id]?.starter).toBe('green')
    for (const id of reds) expect(misfiled.truth[id]).toBe('red')
  })

  it('earns exactly what it earned before, because a tier label is not ground truth', () => {
    const misfiled = relabelled()
    const misfiledSplit: CropSplit = { imageIds: misfiled.order.pool, truth: misfiled.truth }

    const state = farm({ land: 6000 })
    const honest = scored(cropOf(state))
    const draw = drawCrop(declaration, state, misfiledSplit, 4242)
    if (!draw.ok) throw new Error(`the crop was meant to draw: ${draw.issues[0]?.message}`)
    const result = scoreCrop(declaration, SHIPPED, entry, draw.crop.pieces)
    if (!result.ok) throw new Error(`the crop was meant to score: ${result.issues[0]?.message}`)

    // Same earnings and the same per-category breakdown: the tier's labels moved and the
    // harvest did not notice, which is the property the whole two-label path rests on.
    expect(result.outcome.earnings).toBe(honest.earnings)
    expect(result.outcome.counts).toEqual(honest.counts)
  })

  it('leaves the evaluation pool with no tier label to consult in the first place', () => {
    for (const id of committed.order.pool) {
      expect(committed.tierLabels[id], id).toBeUndefined()
      expect(committed.images[id]?.tier, id).toBeUndefined()
    }
  })
})

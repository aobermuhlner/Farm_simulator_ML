/**
 * The ship gate: what makes "not shippable" a real outcome rather than a sentence.
 *
 * `openspec/changes/prediction-artifacts/specs/prediction-artifacts/spec.md` states what
 * a shipped artifact must be — trained, bound to its pool, complete over every manifest
 * image, honest about what produced it, and carrying no ground truth. This suite runs
 * those requirements against the *committed* artifact, so an artifact that drifts from
 * the pool, loses a configuration's provenance, or quietly gains a label fails the normal
 * test command instead of reaching a student.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { blockChannels, blockSizes } from '../src/task/cnn.js'
import { lookupConfiguration, type PredictionArtifact } from '../src/task/artifact.js'
import { configurationId } from '../src/task/configId.js'
import { defaultConfiguration } from '../src/task/configuration.js'
import { firstFamily } from '../src/task/families.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))

const apple = appleDeclaration()
const manifest = committedManifest()

/** Fields that would turn a distribution into an answer. None may appear anywhere. */
const FORBIDDEN_FIELDS = ['category', 'truth', 'label', 'action', 'correct']

interface ArtifactIndex {
  readonly schemaVersion: string
  readonly taskId: string
  readonly categories: readonly string[]
  readonly pool: { readonly poolId: string; readonly schemaVersion: string; readonly seed: number }
  readonly encoding: { readonly decimals: number; readonly sumTolerance: number }
  readonly configurations: Readonly<Record<string, ConfigurationRecord>>
}

interface ConfigurationRecord {
  readonly file: string
  readonly knobs: Readonly<Record<string, number | string>>
  readonly epochs: number
  readonly seed: number
  readonly pipeline: { readonly revision: string; readonly dirty: boolean }
  readonly hyperparameters: Readonly<Record<string, unknown>>
  readonly architecture: {
    readonly blocks: number
    readonly channels: readonly number[]
    readonly spatial: readonly number[]
    readonly parameters: number
  }
  readonly shaping: readonly { readonly step: string; readonly configurations: readonly string[] }[]
}

interface ConfigurationFile {
  readonly schemaVersion: string
  readonly taskId: string
  readonly configurationId: string
  readonly history: readonly {
    epoch: number
    trainLoss: number
    valLoss: number
    trainAccuracy: number
    valAccuracy: number
  }[]
  readonly predictions: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>>
}

const family = firstFamily(apple)

function readArtifactFile<T>(name: string): T {
  return JSON.parse(readFileSync(`${repoRoot}${family.predictions ?? ''}/${name}`, 'utf8')) as T
}

const index = readArtifactFile<ArtifactIndex>('index.json')
const covered = Object.entries(index.configurations)
const files = new Map<string, ConfigurationFile>(
  covered.map(([id, record]) => [id, readArtifactFile<ConfigurationFile>(record.file)]),
)

/** Image ids per split, and per training role, as the committed manifest declares them. */
const manifestImages = Object.entries(manifest.images)
const idsBySplit = {
  training: manifestImages.filter(([, image]) => image.split === 'training').map(([id]) => id),
  pool: manifestImages.filter(([, image]) => image.split === 'pool').map(([id]) => id),
}
const heldOut = manifestImages
  .filter(([, image]) => image.role === 'heldOut')
  .map(([id]) => id)

function fieldsIn(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) fieldsIn(item, found)
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_FIELDS.includes(key)) found.push(key)
      fieldsIn(nested, found)
    }
  }
  return found
}

describe('the artifact is bound to the pool that produced it', () => {
  it('records the pool it was trained against', () => {
    expect(index.pool.poolId).toBe(manifest.poolId)
    expect(index.pool.schemaVersion).toBe(manifest.schemaVersion)
    expect(index.pool.seed).toBe(manifest.seed)
  })

  it('belongs to the task that declares it', () => {
    expect(index.taskId).toBe(apple.id)
    expect(index.schemaVersion).toBe(apple.schemaVersion)
    expect(index.categories).toEqual(apple.categories.map((category) => category.id))
  })
})

describe('coverage', () => {
  it('covers at least one configuration, enumerable without reading a prediction', () => {
    expect(covered.length).toBeGreaterThan(0)
    expect(Object.keys(index.configurations)).toEqual(covered.map(([id]) => id))
  })

  it('covers the configuration the declared defaults resolve to', () => {
    const id = configurationId(defaultConfiguration(apple, family))
    expect(Object.keys(index.configurations)).toContain(id)
  })

  it('resolves a covered configuration through the reading contract', () => {
    const id = configurationId(defaultConfiguration(apple, family))
    const file = files.get(id)
    if (file === undefined) throw new Error(`no file for ${id}`)

    const artifact: PredictionArtifact = {
      schemaVersion: index.schemaVersion,
      taskId: index.taskId,
      familyId: family.id,
      categories: index.categories,
      configurations: { [id]: { history: file.history, predictions: file.predictions as never } },
    }
    const lookup = lookupConfiguration(apple, family, defaultConfiguration(apple, family), artifact)
    expect(lookup.ok).toBe(true)
  })

  it('names each configuration in its own file, so a file cannot be mistaken for another', () => {
    for (const [id, file] of files) {
      expect(file.configurationId).toBe(id)
      expect(file.taskId).toBe(apple.id)
      expect(file.schemaVersion).toBe(apple.schemaVersion)
    }
  })
})

describe('every covered configuration is complete', () => {
  it.each([...files.keys()])('%s spans the whole pool exactly once', (id) => {
    const file = files.get(id)!
    expect(Object.keys(file.predictions).sort()).toEqual(['pool', 'training'])
    for (const [split, ids] of Object.entries(idsBySplit)) {
      const present = Object.keys(file.predictions[split] ?? {})
      expect(present.sort()).toEqual([...ids].sort())
      expect(new Set(present).size).toBe(ids.length)
    }
  })

  it.each([...files.keys()])('%s puts the held-out images under the training split', (id) => {
    const file = files.get(id)!
    for (const imageId of heldOut) {
      expect(file.predictions.training?.[imageId]).toBeDefined()
    }
  })

  it.each([...files.keys()])('%s numbers its epochs contiguously', (id) => {
    const file = files.get(id)!
    const record = index.configurations[id]!
    expect(file.history.length).toBe(record.epochs)
    expect(file.history.map((entry) => entry.epoch)).toEqual(
      Array.from({ length: record.epochs }, (_, epoch) => epoch + 1),
    )
    for (const entry of file.history) {
      expect(Number.isFinite(entry.trainLoss)).toBe(true)
      expect(Number.isFinite(entry.valLoss)).toBe(true)
      // Measured per epoch, and shares: the replay reads these as percentages.
      expect(entry.trainAccuracy).toBeGreaterThanOrEqual(0)
      expect(entry.trainAccuracy).toBeLessThanOrEqual(1)
      expect(entry.valAccuracy).toBeGreaterThanOrEqual(0)
      expect(entry.valAccuracy).toBeLessThanOrEqual(1)
    }
  })
})

describe('stored probabilities decode to distributions', () => {
  it('declares a tolerance the declared precision can meet', () => {
    const worst = (index.categories.length * 10 ** -index.encoding.decimals) / 2
    expect(index.encoding.sumTolerance).toBeGreaterThanOrEqual(worst)
  })

  it.each([...files.keys()])('%s stores only decodable vectors', (id) => {
    const file = files.get(id)!
    const quantum = 10 ** -index.encoding.decimals
    for (const [split, images] of Object.entries(file.predictions)) {
      for (const [imageId, vector] of Object.entries(images)) {
        const where = `${id} ${split} ${imageId}`
        expect(vector.length, where).toBe(index.categories.length)
        let sum = 0
        for (const value of vector) {
          expect(value, where).toBeGreaterThanOrEqual(0)
          expect(value, where).toBeLessThanOrEqual(1)
          // Stored at the declared precision, not merely close to it.
          expect(Math.abs(Math.round(value / quantum) * quantum - value), where).toBeLessThan(1e-9)
          sum += value
        }
        expect(Math.abs(sum - 1), where).toBeLessThanOrEqual(index.encoding.sumTolerance)
      }
    }
  })
})

describe('the artifact carries no ground truth and no decision', () => {
  it('states no category, label or action anywhere', () => {
    expect(fieldsIn(index)).toEqual([])
    for (const [id, file] of files) {
      expect(fieldsIn(file), id).toEqual([])
    }
  })

  it('leaves ground truth to the manifest alone', () => {
    // The manifest has it; the artifact must not repeat it.
    expect(manifest.images['t-001']?.category).toBeDefined()
  })
})

describe('provenance', () => {
  it.each([...files.keys()])('%s records what produced it', (id) => {
    const record = index.configurations[id]!
    expect(record.knobs).toBeDefined()
    expect(Object.keys(record.knobs).sort()).toEqual(family.knobs.map((knob) => knob.id).sort())
    expect(record.epochs).toBeGreaterThan(0)
    expect(Number.isFinite(record.seed)).toBe(true)
    expect(record.hyperparameters).toBeDefined()
    expect(record.pipeline.revision).toMatch(/^[0-9a-f]{40}$/)
  })

  it.each([...files.keys()])('%s resolves to the identifier its knobs claim', (id) => {
    const record = index.configurations[id]!
    const values = family.knobs.map(
      (knob) => [knob.id, record.knobs[knob.id]] as [string, string | number],
    )
    expect(configurationId({ values } as never)).toBe(id)
  })

  it.each([...files.keys()])('%s was produced from a revision that is in history', (id) => {
    // A dirty tree means the code that produced these numbers is not recorded anywhere a
    // reviewer could reach, which is the one thing provenance exists to prevent.
    expect(index.configurations[id]!.pipeline.dirty).toBe(false)
  })

  it.each([...files.keys()])('%s is readable as measured or as shaped, never ambiguous', (id) => {
    const shaping = index.configurations[id]!.shaping
    expect(Array.isArray(shaping)).toBe(true)
    for (const step of shaping) {
      expect(typeof step.step).toBe('string')
      expect(step.configurations).toContain(id)
    }
  })
})

describe('the recorded architecture is the declared one', () => {
  it.each([...files.keys()])('%s matches the arithmetic the app draws from', (id) => {
    const record = index.configurations[id]!
    const diagram = family.diagram
    if (diagram === undefined || diagram.kind !== 'cnn') throw new Error('the task declares no cnn')

    const blocks = Number(record.knobs[diagram.blocksKnob])
    const channels = Number(record.knobs[diagram.channelsKnob])

    expect(record.architecture.blocks, id).toBe(blocks)
    expect(record.architecture.channels, id).toEqual(blockChannels(channels, blocks))
    expect(record.architecture.spatial, id).toEqual(blockSizes(diagram.inputSize, blocks))
    expect(record.architecture.parameters, id).toBeGreaterThan(0)
  })
})

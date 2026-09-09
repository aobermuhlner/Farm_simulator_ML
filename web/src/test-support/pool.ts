/**
 * The committed pool, for screen tests.
 *
 * Read off disk and put through the real reader, for the same reason
 * `declarations.ts` reads the shipped declaration: a grid test that passed against a
 * hand-typed manifest would prove nothing about the 200 apples a student actually gets.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Farm } from '../../../src/economy/index.js'
import { openFarm } from '../../../src/economy/index.js'
import type { LoadedPool } from '../../../src/pool/index.js'
import { readPool } from '../../../src/pool/index.js'
import type { FamilyEntry } from '../../../src/families/index.js'
import {
  entryFromPredictions,
  familyCoverageIssue,
  resolveFamilyEntry,
} from '../../../src/families/index.js'
import type { ConfigurationEntry, PredictionArtifact } from '../../../src/task/artifact.js'
import { readArtifactIndex, type LoadedIndex } from '../../../src/task/artifactIndex.js'
import { firstFamily } from '../../../src/task/families.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'
import type { Loaded, LoadedFamily, LoadedTask } from '../data/load.js'
import { dataUrlFor, taskDataPaths } from '../data/paths.js'
import type { CropView, TrainingSplitView } from '../data/pool.js'
import { cropView, trainingSplitView } from '../data/pool.js'
import { appleDeclaration } from './declarations.js'
import { farmBearing, farmDeclaration } from './farm.js'

const repoRoot = process.cwd()

/** The committed apple manifest, as fetched JSON would arrive. */
export function appleManifest(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(repoRoot, 'pools/apple-harvest/manifest.json'), 'utf8'),
  ) as Record<string, unknown>
}

/** The committed apple pool, through the real reader. */
export function applePool(): LoadedPool {
  const read = readPool(appleManifest(), appleDeclaration())
  if (!read.ok) {
    throw new Error(
      `The committed apple pool does not read: ${read.issues.map((issue) => issue.message).join(' ')}`,
    )
  }
  return read.pool
}

/** The committed apple pool's training split, as the browser receives it. */
export function appleTrainingSplit(): TrainingSplitView {
  const view = trainingSplitView(applePool(), appleDeclaration(), dataUrlFor('pools/apple-harvest') ?? '')
  if (!view.ok) {
    throw new Error(
      `The committed apple split does not project: ${view.issues.map((issue) => issue.message).join(' ')}`,
    )
  }
  return view.value
}

/**
 * The apple task as `loadTask` would return it, built from the committed files.
 *
 * Screen and shell tests need a `LoadedTask` without a server. Reading the shipped
 * artifact index and pool through their real readers keeps that stand-in honest: if the
 * committed data stops loading, these tests stop passing too.
 */
export function appleTask(): LoadedTask {
  const declaration = appleDeclaration()
  const pool = applePool()
  const family = firstFamily(declaration)
  const directory = family.predictions ?? ''
  const raw = JSON.parse(readFileSync(join(repoRoot, `${directory}/index.json`), 'utf8')) as unknown

  const index = readArtifactIndex(raw, declaration, family, {
    poolId: pool.poolId,
    schemaVersion: pool.schemaVersion,
    seed: pool.seed,
  })
  if (!index.ok) {
    throw new Error(
      `The committed artifact index does not read: ${index.issues.map((issue) => issue.message).join(' ')}`,
    )
  }

  const paths = taskDataPaths('data/declarations/apple-harvest.json', declaration)
  if (paths === undefined) throw new Error('the apple task names data this build does not serve')

  const files = Object.fromEntries(
    Object.entries(index.index.configurations).map(([id, record]) => [id, record.file]),
  )
  const task: LoadedTask = {
    declaration,
    families: {
      [family.id]: {
        family,
        coverage: index.index.coverage,
        files,
        indexUrl: paths.families[family.id] ?? '',
        index: index.index,
      },
    },
    truth: pool.truth,
    imageIds: { training: pool.order.training, pool: pool.order.pool },
    tierImages: pool.tiers,
    features: Object.fromEntries(
      Object.entries(pool.images).map(([id, image]) => [id, image.features]),
    ),
    paths,
  }
  entries.set(task, {
    [family.id]: committedArtifact(declaration, directory, index.index, family.id),
  })
  return task
}

/**
 * The entries behind a stand-in task, without a server.
 *
 * The shipped app fetches one configuration at a time; a shell test needs the same
 * contract with none of the plumbing. Tasks built here register what they cover, and
 * `loadEntryFor` answers from it — including the untrained refusal for anything they
 * do not.
 */
const entries = new WeakMap<LoadedTask, Record<string, PredictionArtifact>>()

/** The shipped models a task registered, by family id then configuration id. */
const shipped = new WeakMap<
  LoadedTask,
  Readonly<Record<string, Readonly<Record<string, unknown>>>>
>()

/** Reads one family's committed artifact into one in-memory artifact. */
function committedArtifact(
  declaration: TaskDeclaration,
  directory: string,
  index: LoadedIndex,
  familyId: string,
): PredictionArtifact {
  const configurations: Record<string, ConfigurationEntry> = {}
  for (const [id, record] of Object.entries(index.configurations)) {
    const document = JSON.parse(
      readFileSync(join(repoRoot, `${directory}/${record.file}`), 'utf8'),
    ) as { history: ConfigurationEntry['history']; predictions: ConfigurationEntry['predictions'] }
    configurations[id] = { history: document.history, predictions: document.predictions }
  }
  return {
    schemaVersion: index.schemaVersion,
    taskId: index.taskId,
    familyId,
    categories: index.categories,
    configurations,
  }
}

/**
 * The dataset tier one configuration identifier carries, for the knob that selects it.
 *
 * An identifier is `knobId + value` joined by `-` in declared knob order, so the tier is
 * the part beginning with the family's dataset knob id. Read rather than passed in, so a
 * fixture cannot record a tier its own identifiers disagree with — the same agreement the
 * real reader refuses on.
 */
function tierOf(configurationId: string, knobId: string): string {
  const parts = configurationId.split('-')
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index] as string
    if (part.startsWith(knobId) && part.length > knobId.length) return part.slice(knobId.length)
  }
  throw new Error(`configuration "${configurationId}" carries no value for knob "${knobId}"`)
}

/** A `LoadedTask` around an in-memory artifact, for a task with no committed one. */
export function taskFrom(
  declaration: TaskDeclaration,
  artifacts: PredictionArtifact | readonly PredictionArtifact[],
  truth: Readonly<Record<string, CategoryId>>,
  /**
   * A shipped model per model-shipping family, keyed by family id then by configuration.
   *
   * Given alongside the artifacts rather than instead of them, because a task's families
   * do not have to agree about what they ship — which is the whole point of the fixture
   * that uses this.
   */
  models: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
  /** The numbers measured of each image, for a family that evaluates its own model. */
  features: Readonly<Record<string, Readonly<Record<string, number>>>> = {},
): LoadedTask {
  const list = Array.isArray(artifacts)
    ? (artifacts as readonly PredictionArtifact[])
    : [artifacts as PredictionArtifact]

  const first = Object.values(list[0]?.configurations ?? {})[0]
  const imageIds = Object.fromEntries(
    Object.entries(first?.predictions ?? {}).map(([split, rows]) => [split, Object.keys(rows)]),
  )

  const families: Record<string, LoadedFamily> = {}
  const byFamily: Record<string, PredictionArtifact> = {}
  for (const artifact of list) {
    const family = declaration.families.find((candidate) => candidate.id === artifact.familyId)
    if (family === undefined) {
      throw new Error(`Task "${declaration.id}" declares no family "${artifact.familyId}".`)
    }
    const configurations = Object.fromEntries(
      Object.keys(artifact.configurations).map((id) => [
        id,
        {
          file: `${id}.json`,
          knobs: {},
          // The tier the identifier itself carries, so a fixture index agrees with the
          // configuration ids it was built from rather than restating them.
          tier: tierOf(id, family.datasetKnob),
          epochs: Object.values(artifact.configurations)[0]?.history.length ?? 0,
          seed: 0,
          pipeline: { revision: '0'.repeat(40), dirty: false },
          architecture: { blocks: 0, channels: [], spatial: [], parameters: 0 },
          shaping: [],
        },
      ]),
    )
    families[family.id] = {
      family,
      coverage: Object.keys(configurations),
      files: Object.fromEntries(Object.keys(configurations).map((id) => [id, `${id}.json`])),
      indexUrl: `data/artifacts/${declaration.id}/${family.id}/index.json`,
      index: {
        schemaVersion: artifact.schemaVersion,
        taskId: artifact.taskId,
        familyId: artifact.familyId,
        categories: artifact.categories,
        pool: { poolId: declaration.pool, schemaVersion: declaration.schemaVersion, seed: 0 },
        encoding: { decimals: 3, sumTolerance: 0.0015 },
        configurations,
        coverage: Object.keys(configurations),
      },
    }
    byFamily[family.id] = artifact
  }

  for (const [familyId, covered] of Object.entries(models)) {
    const family = declaration.families.find((candidate) => candidate.id === familyId)
    if (family === undefined) {
      throw new Error(`Task "${declaration.id}" declares no family "${familyId}".`)
    }
    families[familyId] = {
      family,
      coverage: Object.keys(covered),
      files: Object.fromEntries(Object.keys(covered).map((id) => [id, `${id}.json`])),
      indexUrl: `data/artifacts/${declaration.id}/${familyId}/index.json`,
    }
  }

  // Every training image belongs to every tier a covered configuration names: a fixture
  // task has one pool, and whatever its configurations were fitted on is all of it.
  const tierImages: Record<string, readonly string[]> = {}
  for (const loaded of Object.values(families)) {
    for (const id of loaded.coverage) {
      tierImages[tierOf(id, loaded.family.datasetKnob)] = imageIds.training ?? []
    }
  }

  const task: LoadedTask = {
    declaration,
    families,
    truth,
    imageIds,
    tierImages,
    features,
    paths: {
      declaration: `data/declarations/${declaration.id}.json`,
      pool: { manifest: 'data/pools/none/manifest.json', atlases: 'data/pools/none' },
      families: Object.fromEntries(
        Object.entries(families).map(([id, loaded]) => [id, loaded.indexUrl]),
      ),
    },
  }
  entries.set(task, byFamily)
  shipped.set(task, models)
  return task
}

/** `loadEntry` for a task built here, with the same refusal the real loader gives. */
export function loadEntryFor(
  task: LoadedTask,
  familyId: string,
  configurationId: string,
): Promise<Loaded<FamilyEntry>> {
  const loaded = task.families[familyId]
  if (loaded === undefined) {
    return Promise.resolve({
      ok: false,
      issues: [
        {
          code: 'unknown-family',
          field: familyId,
          message: `Task "${task.declaration.id}" declares no model family "${familyId}".`,
        },
      ],
    })
  }

  // A model-shipping family goes through the real registry, so a fixture cannot pass a
  // model the app itself would refuse.
  const document = shipped.get(task)?.[familyId]?.[configurationId]
  if (document !== undefined) {
    const resolved = resolveFamilyEntry({
      declaration: task.declaration,
      family: loaded.family,
      configurationId,
      document,
      imageIds: task.imageIds,
      features: task.features,
    })
    return Promise.resolve(
      resolved.ok
        ? { ok: true, value: resolved.entry }
        : { ok: false, issues: resolved.issues },
    )
  }

  const entry = entries.get(task)?.[familyId]?.configurations[configurationId]
  if (entry === undefined) {
    const issue = familyCoverageIssue(loaded.family, loaded.coverage, configurationId)
    return Promise.resolve({ ok: false, issues: issue === undefined ? [] : [issue] })
  }
  return Promise.resolve({ ok: true, value: entryFromPredictions(entry) })
}

/**
 * A farm at its declared opening state, bearing a crop of `cropSize` where one is given.
 *
 * The crop is no longer a field a test can set: it is the land the farm holds times what
 * the declaration says a unit of land bears. So a requested size is converted into a
 * declaration that bears exactly it — see `farmBearing` — and the callers below go on
 * asking for the crop they are about.
 */
export function farmSorting(cropSize?: number): Farm {
  return openFarm(cropSize === undefined ? farmDeclaration() : farmBearing(cropSize))
}

/** A farm at its declared opening state holding `land` units of the declared land. */
export function farmOnLand(land: number): Farm {
  return { ...openFarm(farmDeclaration()), land }
}

/**
 * A year's crop of the committed pool, as the sorting screen receives it.
 *
 * Through the real draw and the real projection, so a screen test is looking at the
 * images a student would be shown rather than at a hand-typed stand-in of them.
 */
export function appleCrop(
  farm: Farm = farmSorting(),
  seed = 4242,
  declaration: TaskDeclaration = appleDeclaration(),
): CropView {
  const view = cropView(applePool(), declaration, farm, seed, dataUrlFor('pools/apple-harvest') ?? '')
  if (!view.ok) {
    throw new Error(
      `the committed crop does not draw: ${view.issues.map((issue) => issue.message).join(' ')}`,
    )
  }
  return view.value
}

/**
 * A crop for a task with no pool on disk, built by hand.
 *
 * The geometry is nominal — a screen test cares that the right cell is asked for, not
 * that a PNG exists — and the categories are whatever the caller's task declares.
 */
export function cropOf(
  pieces: readonly { readonly imageId: string; readonly category: string }[],
  over: {
    readonly size?: number
    readonly unsorted?: number
    readonly composition?: Readonly<Record<string, number>>
    readonly recurred?: boolean
    readonly held?: Readonly<Record<string, number>>
  } = {},
): CropView {
  const composition: Record<string, number> = {}
  for (const piece of pieces) composition[piece.category] = (composition[piece.category] ?? 0) + 1
  return {
    size: over.size ?? pieces.length,
    unsorted: over.unsorted ?? 0,
    composition: over.composition ?? composition,
    recurred: over.recurred ?? false,
    held: over.held ?? composition,
    presented: pieces.map((piece, index) => ({
      imageId: piece.imageId,
      atlasUrl: 'data/pools/none/atlas.png',
      atlasWidth: 512,
      atlasHeight: 512,
      x: (index % 4) * 128,
      y: Math.floor(index / 4) * 128,
      cellSize: 128,
    })),
    truth: Object.fromEntries(pieces.map((piece) => [piece.imageId, piece.category])),
  }
}

/** A `load` for the sorting screen, standing in for the fetch. */
export function loadsCrop(view: CropView) {
  return (): Promise<Loaded<CropView>> => Promise.resolve({ ok: true as const, value: view })
}

/** A `load` for the sorting screen that refuses, with the cause a caller names. */
export function refusesCrop(code: string, message: string, field?: string) {
  return (): Promise<Loaded<CropView>> =>
    Promise.resolve({
      ok: false as const,
      issues: [field === undefined ? { code, message } : { code, message, field }],
    })
}

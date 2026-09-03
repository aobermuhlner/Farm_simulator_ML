/**
 * The committed pool, for screen tests.
 *
 * Read off disk and put through the real reader, for the same reason
 * `declarations.ts` reads the shipped declaration: a grid test that passed against a
 * hand-typed manifest would prove nothing about the 200 apples a student actually gets.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LoadedPool } from '../../../src/pool/index.js'
import { readPool } from '../../../src/pool/index.js'
import type { ConfigurationEntry, PredictionArtifact } from '../../../src/task/artifact.js'
import {
  coverageIssue,
  readArtifactIndex,
  type LoadedIndex,
} from '../../../src/task/artifactIndex.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'
import type { Loaded, LoadedTask } from '../data/load.js'
import { dataUrlFor, taskDataPaths } from '../data/paths.js'
import type { TrainingSplitView } from '../data/pool.js'
import { trainingSplitView } from '../data/pool.js'
import { appleDeclaration } from './declarations.js'

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
  const raw = JSON.parse(
    readFileSync(join(repoRoot, `${declaration.predictions}/index.json`), 'utf8'),
  ) as unknown

  const index = readArtifactIndex(raw, declaration, {
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

  const task: LoadedTask = {
    declaration,
    index: index.index,
    truth: pool.truth,
    imageIds: { training: pool.order.training, pool: pool.order.pool },
    paths,
  }
  entries.set(task, committedArtifact(declaration, index.index))
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
const entries = new WeakMap<LoadedTask, PredictionArtifact>()

/** Reads the committed artifact for a task into one in-memory artifact. */
function committedArtifact(declaration: TaskDeclaration, index: LoadedIndex): PredictionArtifact {
  const configurations: Record<string, ConfigurationEntry> = {}
  for (const [id, record] of Object.entries(index.configurations)) {
    const document = JSON.parse(
      readFileSync(join(repoRoot, `${declaration.predictions}/${record.file}`), 'utf8'),
    ) as { history: ConfigurationEntry['history']; predictions: ConfigurationEntry['predictions'] }
    configurations[id] = { history: document.history, predictions: document.predictions }
  }
  return {
    schemaVersion: index.schemaVersion,
    taskId: index.taskId,
    categories: index.categories,
    configurations,
  }
}

/** A `LoadedTask` around an in-memory artifact, for a task with no committed one. */
export function taskFrom(
  declaration: TaskDeclaration,
  artifact: PredictionArtifact,
  truth: Readonly<Record<string, CategoryId>>,
): LoadedTask {
  const first = Object.values(artifact.configurations)[0]
  const imageIds = Object.fromEntries(
    Object.entries(first?.predictions ?? {}).map(([split, rows]) => [split, Object.keys(rows)]),
  )
  const configurations = Object.fromEntries(
    Object.keys(artifact.configurations).map((id) => [
      id,
      {
        file: `${id}.json`,
        knobs: {},
        epochs: first?.history.length ?? 0,
        seed: 0,
        pipeline: { revision: '0'.repeat(40), dirty: false },
        architecture: { blocks: 0, channels: [], spatial: [], parameters: 0 },
        shaping: [],
      },
    ]),
  )

  const task: LoadedTask = {
    declaration,
    index: {
      schemaVersion: artifact.schemaVersion,
      taskId: artifact.taskId,
      categories: artifact.categories,
      pool: { poolId: declaration.pool, schemaVersion: declaration.schemaVersion, seed: 0 },
      encoding: { decimals: 3, sumTolerance: 0.0015 },
      configurations,
      coverage: Object.keys(configurations),
    },
    truth,
    imageIds,
    paths: {
      declaration: `data/declarations/${declaration.id}.json`,
      pool: { manifest: 'data/pools/none/manifest.json', atlases: 'data/pools/none' },
      predictions: `data/artifacts/${declaration.id}/predictions/index.json`,
    },
  }
  entries.set(task, artifact)
  return task
}

/** `loadEntry` for a task built here, with the same refusal the real loader gives. */
export function loadEntryFor(
  task: LoadedTask,
  configurationId: string,
): Promise<Loaded<ConfigurationEntry>> {
  const artifact = entries.get(task)
  const entry = artifact?.configurations[configurationId]
  if (entry === undefined) {
    const issue = coverageIssue(task.index, configurationId)
    return Promise.resolve({ ok: false, issues: issue === undefined ? [] : [issue] })
  }
  return Promise.resolve({ ok: true, value: entry })
}

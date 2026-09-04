/**
 * Loading task data over the network.
 *
 * Everything here refuses the way the engine refuses: a `ValidationIssue` list
 * naming the cause, never a throw and never a partial result. The shell renders
 * those issues directly, so a malformed declaration reaches the student as the
 * field it is missing rather than as a blank screen.
 *
 * No rule lives here. Validation is `validateDeclaration`, the pool is `readPool`, the
 * artifact is `readArtifactIndex` / `readConfigurationFile`. This module only fetches and
 * hands off.
 *
 * A task loads its declaration, its pool and its artifact *index*. It does not load any
 * configuration's predictions: those arrive when a student runs one, so choosing a
 * configuration transfers that configuration and not the others.
 */

import type { ConfigurationEntry } from '../../../src/task/artifact.js'
import {
  coverageIssue,
  readArtifactIndex,
  readConfigurationFile,
  type LoadedIndex,
} from '../../../src/task/artifactIndex.js'
import type { LoadedPool } from '../../../src/pool/index.js'
import { readPool } from '../../../src/pool/index.js'
import type { FarmDeclaration } from '../../../src/economy/index.js'
import { validateFarmDeclaration } from '../../../src/economy/index.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import {
  configurationUrl,
  SHIPPED_FARM,
  SHIPPED_TASKS,
  taskDataPaths,
  type PoolPaths,
  type TaskDataPaths,
} from './paths.js'

export type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/** Everything one task needs before it can be configured and run. */
export interface LoadedTask {
  readonly declaration: TaskDeclaration
  /** Coverage, the pool binding and the provenance — no predictions. */
  readonly index: LoadedIndex
  /** True category per image id, from the pool manifest, which is its only source. */
  readonly truth: Readonly<Record<string, CategoryId>>
  /** Image ids per split, as the manifest enumerates them. */
  readonly imageIds: Readonly<Record<string, readonly string[]>>
  readonly paths: TaskDataPaths
}

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

/** Resolves a data URL against the base the bundle was built for. */
export function dataUrl(path: string): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}${path}`
}

/**
 * Fetches one data file as JSON.
 *
 * Exported because the training browser fetches its pool manifest lazily, from its own
 * module, and a second copy of "unreachable and malformed refuse rather than throw"
 * is a second place for that behaviour to drift.
 */
export async function fetchJson(path: string): Promise<Loaded<unknown>> {
  let response: Response
  try {
    response = await fetch(dataUrl(path))
  } catch (cause) {
    return {
      ok: false,
      issues: [issue('data-unreachable', `Could not fetch "${path}": ${String(cause)}.`, path)],
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      issues: [
        issue('data-unreachable', `Could not fetch "${path}": ${response.status}.`, path),
      ],
    }
  }
  try {
    return { ok: true, value: (await response.json()) as unknown }
  } catch (cause) {
    return {
      ok: false,
      issues: [issue('data-malformed', `"${path}" is not valid JSON: ${String(cause)}.`, path)],
    }
  }
}

/**
 * Fetches a task declaration and validates it. The declaration is never trusted
 * because it was fetched from our own origin — it goes through the same
 * validator a third-party lesson would.
 */
export async function loadDeclaration(path: string): Promise<Loaded<TaskDeclaration>> {
  const fetched = await fetchJson(path)
  if (!fetched.ok) return fetched

  const validated = validateDeclaration(fetched.value)
  if (!validated.ok) return { ok: false, issues: validated.issues }
  return { ok: true, value: validated.declaration }
}

/** Fetches a pool manifest and reads it against the task that references it. */
export async function loadPool(
  paths: PoolPaths,
  declaration: TaskDeclaration,
): Promise<Loaded<LoadedPool>> {
  const raw = await fetchJson(paths.manifest)
  if (!raw.ok) return raw

  const read = readPool(raw.value, declaration)
  if (!read.ok) return { ok: false, issues: read.issues }
  return { ok: true, value: read.pool }
}

/**
 * Loads a task's declaration, its pool and its artifact index.
 *
 * The pool is loaded eagerly now, because it is where ground truth lives and a run is
 * scored against it. That is also what makes the browsed images and the scored images
 * the same images — there is only one pool to be either.
 */
export async function loadTask(declarationUrl: string): Promise<Loaded<LoadedTask>> {
  const declared = await loadDeclaration(declarationUrl)
  if (!declared.ok) return declared
  const declaration = declared.value

  const paths = taskDataPaths(declarationUrl, declaration)
  if (paths === undefined) {
    return {
      ok: false,
      issues: [
        issue(
          'data-unserved',
          `Task "${declaration.id}" names pool "${declaration.pool}" and predictions "${declaration.predictions}", and this build serves at least one of them from nowhere.`,
          declaration.id,
        ),
      ],
    }
  }

  const [pool, rawIndex] = await Promise.all([
    loadPool(paths.pool, declaration),
    fetchJson(paths.predictions),
  ])
  if (!pool.ok) return pool
  if (!rawIndex.ok) return rawIndex

  const index = readArtifactIndex(rawIndex.value, declaration, {
    poolId: pool.value.poolId,
    schemaVersion: pool.value.schemaVersion,
    seed: pool.value.seed,
  })
  if (!index.ok) return { ok: false, issues: index.issues }

  return {
    ok: true,
    value: {
      declaration,
      index: index.index,
      truth: pool.value.truth,
      imageIds: { training: pool.value.order.training, pool: pool.value.order.pool },
      paths,
    },
  }
}

/**
 * Fetches one configuration's predictions and history.
 *
 * Coverage is checked before anything is fetched, so a configuration no model was
 * trained for refuses as `untrained-configuration` — naming it, and distinct from an
 * invalid configuration — instead of arriving as a 404 with nothing to say.
 */
export async function loadConfiguration(
  task: LoadedTask,
  configurationId: string,
): Promise<Loaded<ConfigurationEntry>> {
  const uncovered = coverageIssue(task.index, configurationId)
  if (uncovered !== undefined) return { ok: false, issues: [uncovered] }

  const record = task.index.configurations[configurationId]
  if (record === undefined) return { ok: false, issues: [] }

  const raw = await fetchJson(configurationUrl(task.paths.predictions, record.file))
  if (!raw.ok) return raw

  const read = readConfigurationFile(
    raw.value,
    task.declaration,
    task.index,
    configurationId,
    task.imageIds,
  )
  if (!read.ok) return { ok: false, issues: read.issues }
  return { ok: true, value: read.entry }
}

/**
 * Every task this build ships.
 *
 * A task that will not load takes the farm down with it rather than quietly
 * disappearing from the overview: a lesson missing without explanation is the
 * silent failure the contract exists to prevent.
 */
export async function loadShippedTasks(): Promise<Loaded<readonly LoadedTask[]>> {
  const loaded = await Promise.all(SHIPPED_TASKS.map(loadTask))
  const failed = loaded.find((result) => !result.ok)
  if (failed !== undefined && !failed.ok) return failed
  return {
    ok: true,
    value: loaded.flatMap((result) => (result.ok ? [result.value] : [])),
  }
}

/**
 * Fetches the farm declaration and validates it.
 *
 * The farm is loaded the same way a task is, through the same refusal contract: a
 * missing or malformed declaration comes back as issues naming the field, and the shell
 * shows them instead of opening a farm with a currency it invented.
 */
export async function loadFarmDeclaration(
  path: string = SHIPPED_FARM,
): Promise<Loaded<FarmDeclaration>> {
  const fetched = await fetchJson(path)
  if (!fetched.ok) return fetched

  const validated = validateFarmDeclaration(fetched.value)
  if (!validated.ok) return { ok: false, issues: validated.issues }
  return { ok: true, value: validated.declaration }
}

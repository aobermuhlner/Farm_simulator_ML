/**
 * Loading task data over the network.
 *
 * Everything here refuses the way the engine refuses: a `ValidationIssue` list
 * naming the cause, never a throw and never a partial result. The shell renders
 * those issues directly, so a malformed declaration reaches the student as the
 * field it is missing rather than as a blank screen.
 *
 * No rule lives here. Validation is `validateDeclaration`; version comparison is
 * `checkArtifactVersion`. This module only fetches and hands off.
 */

import type { PredictionArtifact } from '../../../src/task/artifact.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import { checkArtifactVersion } from '../../../src/task/version.js'
import { SHIPPED_TASKS, type PoolPaths, type TaskDataPaths } from './paths.js'

export type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/** Ground truth per image id, plus the split each image belongs to. */
export interface PoolManifest {
  readonly poolId: string
  readonly images: Readonly<Record<string, { readonly split: string; readonly category: CategoryId }>>
}

/** Everything one task needs before it can be configured and run. */
export interface LoadedTask {
  readonly declaration: TaskDeclaration
  readonly artifact: PredictionArtifact
  readonly truth: Readonly<Record<string, CategoryId>>
  /**
   * Where this task's generated pool is served from, when it ships one.
   *
   * Carried as paths rather than as loaded data because it is fetched lazily, only if a
   * student opens the training browser — `design.md`. Absent for a task with no
   * generated pool, which then simply offers nothing to browse.
   */
  readonly generatedPool?: PoolPaths
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

function readArtifact(input: unknown, declaredVersion: string): Loaded<PredictionArtifact> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, issues: [issue('data-malformed', 'A prediction artifact must be an object.')] }
  }
  const candidate = input as Partial<PredictionArtifact>
  if (typeof candidate.schemaVersion !== 'string') {
    return {
      ok: false,
      issues: [
        issue('data-malformed', 'Prediction artifact declares no schema version.', 'schemaVersion'),
      ],
    }
  }

  const version = checkArtifactVersion(declaredVersion, candidate.schemaVersion)
  if (!version.ok) return { ok: false, issues: [version.issue] }

  return { ok: true, value: candidate as PredictionArtifact }
}

function readTruth(input: unknown): Loaded<Readonly<Record<string, CategoryId>>> {
  const manifest = input as Partial<PoolManifest>
  if (typeof manifest?.images !== 'object' || manifest.images === null) {
    return {
      ok: false,
      issues: [issue('data-malformed', 'Pool manifest declares no images.', 'images')],
    }
  }
  const truth: Record<string, CategoryId> = {}
  for (const [imageId, entry] of Object.entries(manifest.images)) {
    if (typeof entry?.category !== 'string') {
      return {
        ok: false,
        issues: [
          issue('data-malformed', `Pool manifest gives image "${imageId}" no category.`, imageId),
        ],
      }
    }
    truth[imageId] = entry.category
  }
  return { ok: true, value: truth }
}

/**
 * Loads a task's declaration, its prediction artifact and its ground truth.
 *
 * A version mismatch refuses here rather than at run time, so the task never
 * reaches a configuration screen it could not have run from.
 */
export async function loadTask(paths: TaskDataPaths): Promise<Loaded<LoadedTask>> {
  const declared = await loadDeclaration(paths.declaration)
  if (!declared.ok) return declared

  const [rawArtifact, rawPool] = await Promise.all([
    fetchJson(paths.predictions),
    fetchJson(paths.pool),
  ])
  if (!rawArtifact.ok) return rawArtifact
  if (!rawPool.ok) return rawPool

  const artifact = readArtifact(rawArtifact.value, declared.value.schemaVersion)
  if (!artifact.ok) return artifact

  const truth = readTruth(rawPool.value)
  if (!truth.ok) return truth

  return {
    ok: true,
    value: {
      declaration: declared.value,
      artifact: artifact.value,
      truth: truth.value,
      generatedPool: paths.generatedPool,
    },
  }
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

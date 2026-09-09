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
 * A task loads its declaration, its pool and one *index* per declared family. It does not
 * load any configuration's predictions or any family's model: those arrive when a student
 * runs one, so choosing a configuration transfers that configuration and not the others,
 * and selecting a family transfers nothing belonging to the task's other families.
 */

import type { FamilyEntry } from '../../../src/families/index.js'
import {
  familyCoverageIssue,
  readFamilyStore,
  resolveFamilyEntry,
} from '../../../src/families/index.js'
import type { LoadedIndex } from '../../../src/task/artifactIndex.js'
import type { LoadedPool } from '../../../src/pool/index.js'
import { readPool } from '../../../src/pool/index.js'
import type { FarmDeclaration } from '../../../src/economy/index.js'
import { validateFarmDeclaration } from '../../../src/economy/index.js'
import type {
  CategoryId,
  FamilyId,
  ModelFamilyDeclaration,
  TaskDeclaration,
} from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import { tutorialAgreementIssues } from '../../../src/tutorials/index.js'
import type { Catalog } from '../../../src/progression/index.js'
import {
  checkCatalogAgainstTasks,
  checkCatalogCoverage,
  validateCatalog,
} from '../../../src/progression/index.js'
import {
  configurationUrl,
  SHIPPED_CATALOG,
  SHIPPED_FARM,
  SHIPPED_TASKS,
  taskDataPaths,
  type PoolPaths,
  type TaskDataPaths,
} from './paths.js'

export type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/**
 * One family's store, as it was loaded: what it covers, and where each file sits.
 *
 * `index` is present only for a family whose predictions ship — it carries the encoding
 * and the provenance a prediction table is read against. A family whose model ships has
 * coverage and files and nothing else to read against, because its models carry their own
 * numbers and are checked when they are read.
 */
export interface LoadedFamily {
  readonly family: ModelFamilyDeclaration
  /** Every configuration this family has a model for. */
  readonly coverage: readonly string[]
  /** Configuration identifier to the file it sits in, beside this family's index. */
  readonly files: Readonly<Record<string, string>>
  /** Where this family's index was fetched from; its files sit beside it. */
  readonly indexUrl: string
  /** The prediction artifact index, for a family whose predictions ship. */
  readonly index?: LoadedIndex
}

/** Everything one task needs before it can be configured and run. */
export interface LoadedTask {
  readonly declaration: TaskDeclaration
  /** One entry per declared family: coverage and the pool binding, never a prediction. */
  readonly families: Readonly<Record<FamilyId, LoadedFamily>>
  /** True category per image id, from the pool manifest, which is its only source. */
  readonly truth: Readonly<Record<string, CategoryId>>
  /** Image ids per split, as the manifest enumerates them. */
  readonly imageIds: Readonly<Record<string, readonly string[]>>
  /** Training image ids per dataset tier, as the manifest assigns them. */
  readonly tierImages: Readonly<Record<string, readonly string[]>>
  /** The numbers measured of each image, for a family that evaluates its own model. */
  readonly features: Readonly<Record<string, Readonly<Record<string, number>>>>
  readonly paths: TaskDataPaths
}

/** The family a task declares under this id, as it was loaded. */
export function loadedFamily(task: LoadedTask, familyId: FamilyId): LoadedFamily | undefined {
  return task.families[familyId]
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
          `Task "${declaration.id}" names pool "${declaration.pool}" and one store per model family, and this build serves at least one of them from nowhere.`,
          declaration.id,
        ),
      ],
    }
  }

  const pool = await loadPool(paths.pool, declaration)
  if (!pool.ok) return pool
  const binding = {
    poolId: pool.value.poolId,
    schemaVersion: pool.value.schemaVersion,
    seed: pool.value.seed,
  }

  // Every family's index, in parallel: each is small, each is checked against this task,
  // this family and this pool, and none of them carries a prediction or a model.
  const loaded = await Promise.all(
    declaration.families.map(async (family) => {
      const url = paths.families[family.id]
      if (url === undefined) {
        return {
          ok: false as const,
          issues: [
            issue(
              'data-unserved',
              `Family "${family.id}" of task "${declaration.id}" is served from nowhere.`,
              family.id,
            ),
          ],
        }
      }
      return readFamilyIndex(url, declaration, family, binding)
    }),
  )
  const refused = loaded.find((result) => !result.ok)
  if (refused !== undefined && !refused.ok) return refused

  const families: Record<string, LoadedFamily> = {}
  for (const result of loaded) if (result.ok) families[result.value.family.id] = result.value

  return {
    ok: true,
    value: {
      declaration,
      families,
      truth: pool.value.truth,
      imageIds: { training: pool.value.order.training, pool: pool.value.order.pool },
      tierImages: pool.value.tiers,
      features: Object.fromEntries(
        Object.entries(pool.value.images).map(([id, image]) => [id, image.features]),
      ),
      paths,
    },
  }
}

/**
 * Fetches one family's index and hands it to the reader its shipped form calls for.
 *
 * The fetch is this module's job; which reader is `src/families/`'s. Nothing here asks
 * what a family ships, because a `FamilyStore` says the same thing whichever reader
 * produced it — and a shell that asked would be a shell that could answer differently.
 */
async function readFamilyIndex(
  url: string,
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  pool: { readonly poolId: string; readonly schemaVersion: string; readonly seed: number },
): Promise<Loaded<LoadedFamily>> {
  const raw = await fetchJson(url)
  if (!raw.ok) return raw

  const read = readFamilyStore(raw.value, declaration, family, pool)
  if (!read.ok) return { ok: false, issues: read.issues }
  return { ok: true, value: { family, ...read.store, indexUrl: url } }
}

/**
 * Fetches one configuration of one family, and resolves it to an entry.
 *
 * Coverage is checked before anything is fetched, so a configuration no model was made
 * for refuses as `untrained-configuration` — naming the family and the identifier, and
 * distinct from an invalid configuration — instead of arriving as a 404 with nothing to
 * say. One request, whatever the family ships and however large the pool is.
 */
export async function loadConfiguration(
  task: LoadedTask,
  familyId: FamilyId,
  configurationId: string,
): Promise<Loaded<FamilyEntry>> {
  const loaded = task.families[familyId]
  if (loaded === undefined) {
    return {
      ok: false,
      issues: [
        issue(
          'unknown-family',
          `Task "${task.declaration.id}" declares no model family "${familyId}".`,
          familyId,
        ),
      ],
    }
  }

  const uncovered = familyCoverageIssue(loaded.family, loaded.coverage, configurationId)
  if (uncovered !== undefined) return { ok: false, issues: [uncovered] }

  const file = loaded.files[configurationId]
  if (file === undefined) return { ok: false, issues: [] }

  const raw = await fetchJson(configurationUrl(loaded.indexUrl, file))
  if (!raw.ok) return raw

  const resolved = resolveFamilyEntry({
    declaration: task.declaration,
    family: loaded.family,
    configurationId,
    document: raw.value,
    imageIds: task.imageIds,
    tierImages: task.tierImages,
    ...(loaded.index === undefined ? {} : { index: loaded.index }),
    features: task.features,
  })
  if (!resolved.ok) return { ok: false, issues: resolved.issues }
  return { ok: true, value: resolved.entry }
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
  const tasks = loaded.flatMap((result) => (result.ok ? [result.value] : []))

  // Checked once the tasks are in hand, because `validateDeclaration` is handed one
  // declaration at a time and cannot see across them — while tutorial completion is
  // recorded globally, so one id has to mean one puzzle across every task loaded.
  const disagreeing = tutorialAgreementIssues(tasks.map((task) => task.declaration))
  if (disagreeing.length > 0) return { ok: false, issues: disagreeing }

  return { ok: true, value: tasks }
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

/**
 * Fetches the catalog and checks it three ways.
 *
 * Structure first, then every reference against the tasks that were loaded, then what a
 * purchase would open against what each task's artifact covers. The last two need the
 * tasks in hand, which is why the catalog is loaded after them rather than beside them —
 * a catalog naming a knob no task declares is a build mistake, and it must reach the
 * student as that rather than as a knob that quietly never unlocks.
 */
export async function loadCatalog(
  farm: FarmDeclaration,
  tasks: readonly LoadedTask[],
  path: string = SHIPPED_CATALOG,
): Promise<Loaded<Catalog>> {
  const fetched = await fetchJson(path)
  if (!fetched.ok) return fetched

  const validated = validateCatalog(fetched.value, farm)
  if (!validated.ok) return { ok: false, issues: validated.issues }

  const declarations = tasks.map((task) => task.declaration)
  const references = checkCatalogAgainstTasks(validated.catalog, declarations)
  if (references.length > 0) return { ok: false, issues: references }

  const coverage = Object.fromEntries(
    tasks.map((task) => [
      task.declaration.id,
      Object.fromEntries(
        Object.entries(task.families).map(([familyId, loaded]) => [familyId, loaded.coverage]),
      ),
    ]),
  )
  const untrained = checkCatalogCoverage(validated.catalog, declarations, coverage)
  if (untrained.length > 0) return { ok: false, issues: untrained }

  return { ok: true, value: validated.catalog }
}

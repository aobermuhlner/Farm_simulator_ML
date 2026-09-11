/**
 * The index of a family whose model ships: what it covers, and the pool it was fitted to.
 *
 * The counterpart of `src/task/artifactIndex.ts` for the other shipped form, and
 * deliberately much smaller. A prediction artifact has to describe an encoding, a
 * quantization and the provenance of a training run; a shipped model carries its own
 * numbers and is checked when it is read. What is left is the same three obligations:
 * bind to a task, bind to a family, bind to a pool — and say which configurations exist,
 * so that one no model was fitted for refuses as untrained rather than as a 404.
 *
 * See openspec/changes/model-families/specs/prediction-artifacts/spec.md.
 */

import type { PoolBinding } from '../task/artifactIndex.js'
import { ID_SEPARATOR } from '../task/configId.js'
import type { ModelFamilyDeclaration, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import { checkArtifactVersion } from '../task/version.js'

/**
 * Where one shipped model came from, recorded rather than inferred.
 *
 * `fitted-tree` requires a model that was authored rather than fitted to say so in its
 * own provenance, and requires nothing downstream to work it out from an absent history,
 * a missing seed or the date on a file. Inference is exactly how a placeholder quietly
 * becomes load-bearing, and two things read this: the refusal below, and the honesty
 * condition on what may be said about the model on screen.
 *
 * Both origins have to say *by what*. A fitted model says which pipeline revision and
 * which seed produced it, so a reviewer holding the pool can repeat it. An authored one
 * says who wrote it and why, because there is no run to point at and "somebody typed
 * these numbers" is the fact a reader most needs.
 */
export interface ModelProvenance {
  readonly origin: 'authored' | 'fitted'
  /** What authored it, for an authored model. Required of one, meaningless to a fit. */
  readonly authoredBy?: string
  /** The producing pipeline, for a fitted model. Required of one. */
  readonly pipeline?: { readonly revision: string; readonly dirty: boolean }
  /** The seed the fit ran under, for a fitted model. */
  readonly seed?: number
  /** How many steps the fit performed, where it recorded a history. */
  readonly steps?: number
}

/** What one configuration's record in a model index says. */
export interface ModelRecord {
  /** The file this configuration's model sits in, beside the index. */
  readonly file: string
  /** The knob values this configuration resolves from. */
  readonly knobs: Readonly<Record<string, string | number>>
  /** The dataset tier it was made for, checked against the identifier at load. */
  readonly tier: string
  readonly provenance: ModelProvenance
}

export interface LoadedModelIndex {
  readonly schemaVersion: string
  readonly taskId: string
  readonly familyId: string
  readonly pool: PoolBinding
  /** Configuration identifier to the file its model sits in, beside this index. */
  readonly files: Readonly<Record<string, string>>
  /** Configuration identifier to everything its record says about it. */
  readonly configurations: Readonly<Record<string, ModelRecord>>
  /** Every configuration this family has a model for. */
  readonly coverage: readonly string[]
}

export type ModelIndexValidation =
  | { readonly ok: true; readonly index: LoadedModelIndex }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

/**
 * The dataset tier an identifier carries, read off the identifier's own spelling.
 *
 * The same rule `src/task/artifactIndex.ts` applies to a prediction index, and applied
 * here for the same reason: the recorded tier and the identifier's must agree, or the
 * artifact offers two answers to "which photographs was this made for" and nothing can
 * say which. The dataset knob is declared last, so this is a suffix rather than a scan.
 */
function tierIn(configurationId: string, knobId: string): string | undefined {
  const parts = configurationId.split(ID_SEPARATOR)
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index] as string
    if (part.startsWith(knobId) && part.length > knobId.length) return part.slice(knobId.length)
  }
  return undefined
}

/**
 * What a record says about where its model came from, refused when it says nothing.
 *
 * The refusal that matters is the asymmetric one: a model claiming a fit it cannot show
 * is worse than a model admitting it was authored, because the claim is the thing a
 * student would be misled by. So `fitted` without a producing revision is refused
 * naming the configuration, and so is `authored` without something to name as its
 * author — both record an origin without recording what produced it.
 */
function readProvenance(
  id: string,
  raw: unknown,
  issues: ValidationIssue[],
): ModelProvenance | undefined {
  if (!isRecord(raw)) {
    issues.push(
      issue(
        'missing-provenance',
        `Configuration "${id}" records no provenance, so nothing can say whether its model was fitted or authored.`,
        id,
      ),
    )
    return undefined
  }
  if (raw.origin !== 'authored' && raw.origin !== 'fitted') {
    issues.push(
      issue(
        'missing-provenance',
        `Configuration "${id}" records origin ${JSON.stringify(raw.origin)}; a shipped model is either "authored" or "fitted".`,
        id,
      ),
    )
    return undefined
  }

  if (raw.origin === 'fitted') {
    const pipeline = raw.pipeline
    if (!isRecord(pipeline) || typeof pipeline.revision !== 'string' || pipeline.revision === '') {
      issues.push(
        issue(
          'unrecorded-fit',
          `Configuration "${id}" records that its model was fitted but names no producing revision, so nothing can say what fitted it.`,
          id,
        ),
      )
      return undefined
    }
    if (typeof raw.seed !== 'number' || !Number.isFinite(raw.seed)) {
      issues.push(
        issue(
          'unrecorded-fit',
          `Configuration "${id}" records that its model was fitted but records no seed, so the fit cannot be repeated.`,
          id,
        ),
      )
      return undefined
    }
    return {
      origin: 'fitted',
      pipeline: pipeline as ModelProvenance['pipeline'],
      seed: raw.seed,
      ...(typeof raw.steps === 'number' ? { steps: raw.steps } : {}),
    }
  }

  if (typeof raw.authoredBy !== 'string' || raw.authoredBy.trim() === '') {
    issues.push(
      issue(
        'missing-provenance',
        `Configuration "${id}" records that its model was authored but names nothing as its author.`,
        id,
      ),
    )
    return undefined
  }
  return { origin: 'authored', authoredBy: raw.authoredBy }
}

function readRecord(
  id: string,
  raw: unknown,
  family: ModelFamilyDeclaration,
  issues: ValidationIssue[],
): ModelRecord | undefined {
  if (!isRecord(raw) || typeof raw.file !== 'string' || raw.file === '') {
    issues.push(issue('malformed-entry', `Configuration "${id}" names no model file.`, id))
    return undefined
  }
  if (!isRecord(raw.knobs)) {
    issues.push(
      issue(
        'missing-provenance',
        `Configuration "${id}" records no knob values, so what it resolves from cannot be repeated.`,
        id,
      ),
    )
    return undefined
  }
  if (typeof raw.tier !== 'string' || raw.tier === '') {
    issues.push(
      issue(
        'missing-provenance',
        `Configuration "${id}" records no dataset tier, so nothing can say which photographs it was made for.`,
        id,
      ),
    )
    return undefined
  }
  const carried = tierIn(id, family.datasetKnob)
  if (carried !== raw.tier) {
    issues.push(
      issue(
        'artifact-tier-mismatch',
        `Configuration "${id}" records dataset tier "${raw.tier}", but its identifier carries "${String(carried)}".`,
        id,
      ),
    )
    return undefined
  }

  const provenance = readProvenance(id, raw.provenance, issues)
  if (provenance === undefined) return undefined

  return {
    file: raw.file,
    knobs: raw.knobs as Readonly<Record<string, string | number>>,
    tier: raw.tier,
    provenance,
  }
}

/** Reads a model index against the task, the family and the pool it claims to belong to. */
export function readModelIndex(
  raw: unknown,
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  pool: PoolBinding,
): ModelIndexValidation {
  if (!isRecord(raw)) {
    return { ok: false, issues: [issue('data-malformed', 'A model index must be an object.')] }
  }

  const issues: ValidationIssue[] = []
  for (const field of ['schemaVersion', 'taskId', 'familyId', 'pool', 'configurations'] as const) {
    if (raw[field] === undefined) {
      issues.push(issue('missing-field', `The model index declares no ${field}.`, field))
    }
  }
  if (issues.length > 0) return { ok: false, issues }

  const version = checkArtifactVersion(declaration.schemaVersion, String(raw.schemaVersion))
  if (!version.ok) issues.push(version.issue)

  if (raw.taskId !== declaration.id) {
    issues.push(
      issue(
        'artifact-task-mismatch',
        `The model index belongs to task "${String(raw.taskId)}", not "${declaration.id}".`,
        'taskId',
      ),
    )
  }
  if (raw.familyId !== family.id) {
    issues.push(
      issue(
        'artifact-family-mismatch',
        `The model index belongs to family "${String(raw.familyId)}", not "${family.id}".`,
        'familyId',
      ),
    )
  }

  const binding = raw.pool
  if (!isRecord(binding)) {
    issues.push(issue('missing-field', 'The model index records no pool binding.', 'pool'))
  } else {
    for (const [field, expected] of [
      ['poolId', pool.poolId],
      ['schemaVersion', pool.schemaVersion],
      ['seed', pool.seed],
    ] as const) {
      if (binding[field] !== expected) {
        issues.push(
          issue(
            'artifact-pool-mismatch',
            `The model index was produced from pool ${field} "${String(binding[field])}", but the loaded pool declares "${String(expected)}".`,
            `pool.${field}`,
          ),
        )
      }
    }
  }

  const files: Record<string, string> = {}
  const configurations: Record<string, ModelRecord> = {}
  if (!isRecord(raw.configurations)) {
    issues.push(issue('malformed-field', 'The model index declares no configurations.', 'configurations'))
  } else {
    for (const [id, record] of Object.entries(raw.configurations)) {
      const read = readRecord(id, record, family, issues)
      if (read === undefined) continue
      files[id] = read.file
      configurations[id] = read
    }
    if (Object.keys(raw.configurations).length === 0) {
      issues.push(
        issue('empty-coverage', 'The model index covers no configuration, so nothing can be run.', 'configurations'),
      )
    }
  }

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    index: {
      schemaVersion: String(raw.schemaVersion),
      taskId: String(raw.taskId),
      familyId: String(raw.familyId),
      pool: binding as unknown as PoolBinding,
      files,
      configurations,
      coverage: Object.keys(files),
    },
  }
}

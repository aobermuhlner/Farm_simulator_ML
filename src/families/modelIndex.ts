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
import type { ModelFamilyDeclaration, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import { checkArtifactVersion } from '../task/version.js'

export interface LoadedModelIndex {
  readonly schemaVersion: string
  readonly taskId: string
  readonly familyId: string
  readonly pool: PoolBinding
  /** Configuration identifier to the file its model sits in, beside this index. */
  readonly files: Readonly<Record<string, string>>
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
  if (!isRecord(raw.configurations)) {
    issues.push(issue('malformed-field', 'The model index declares no configurations.', 'configurations'))
  } else {
    for (const [id, record] of Object.entries(raw.configurations)) {
      if (!isRecord(record) || typeof record.file !== 'string' || record.file === '') {
        issues.push(issue('malformed-entry', `Configuration "${id}" names no model file.`, id))
        continue
      }
      files[id] = record.file
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
      coverage: Object.keys(files),
    },
  }
}

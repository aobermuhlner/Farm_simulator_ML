/**
 * Turning requested knob values into a configuration that may be run.
 *
 * Nothing downstream accepts loose knob values: scoring takes a
 * `ResolvedConfiguration`, which only `resolveConfiguration` produces and only
 * for values the task's own knob declarations permit. An out-of-range value
 * therefore cannot reach a run.
 */

import type { FamilyId, KnobDeclaration, ModelFamilyDeclaration, TaskDeclaration } from './types.js'
import { knobPermits, type ValidationIssue } from './validate.js'

export interface ResolvedConfiguration {
  readonly taskId: string
  /**
   * The family whose knobs these values belong to.
   *
   * Carried because configuration identity is family-scoped: the identifier composed
   * below says nothing about which family composed it, and two families of one task may
   * compose the same string from different knobs. Everything that resolves an identifier
   * resolves it against this family and never against the task at large.
   */
  readonly familyId: FamilyId
  /** Knob id and value pairs, in the family's declared knob order. */
  readonly values: readonly (readonly [string, string | number])[]
}

export type ConfigurationValidation =
  | { readonly ok: true; readonly configuration: ResolvedConfiguration }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

function describeAllowed(knob: KnobDeclaration): string {
  return knob.kind === 'choice'
    ? `allowed values are ${knob.values.join(', ')}`
    : `allowed range is ${knob.min} to ${knob.max} in steps of ${knob.step}`
}

/** The configuration a student starts from: every knob of one family at its default. */
export function defaultConfiguration(
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
): ResolvedConfiguration {
  return {
    taskId: declaration.id,
    familyId: family.id,
    values: family.knobs.map((knob) => [knob.id, knob.default] as const),
  }
}

/**
 * Resolves requested knob values against one family's knob declarations. Knobs the
 * request omits fall back to their declared default; unknown knob ids and
 * values the declaration does not permit are refused, each naming the knob.
 *
 * Against the family rather than the task, because a knob id is unique only within a
 * family: resolving `depth` against the task would pick whichever family declared it
 * first and quietly build a configuration of the wrong model.
 */
export function resolveConfiguration(
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  requested: Readonly<Record<string, unknown>>,
): ConfigurationValidation {
  const issues: ValidationIssue[] = []
  const values: (readonly [string, string | number])[] = []
  const knownIds = family.knobs.map((knob) => knob.id)

  for (const key of Object.keys(requested)) {
    if (!knownIds.includes(key)) {
      issues.push({
        code: 'unknown-knob',
        field: key,
        message: `Family "${family.id}" of task "${declaration.id}" declares no knob "${key}".`,
      })
    }
  }

  for (const knob of family.knobs) {
    const requestedValue = Object.prototype.hasOwnProperty.call(requested, knob.id)
      ? requested[knob.id]
      : knob.default

    if (!knobPermits(knob, requestedValue)) {
      issues.push({
        code: 'knob-value-out-of-range',
        field: knob.id,
        message: `Knob "${knob.id}" does not permit ${JSON.stringify(requestedValue)}; ${describeAllowed(knob)}.`,
      })
      continue
    }
    values.push([knob.id, requestedValue as string | number])
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, configuration: { taskId: declaration.id, familyId: family.id, values } }
}

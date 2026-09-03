/**
 * Turning requested knob values into a configuration that may be run.
 *
 * Nothing downstream accepts loose knob values: scoring takes a
 * `ResolvedConfiguration`, which only `resolveConfiguration` produces and only
 * for values the task's own knob declarations permit. An out-of-range value
 * therefore cannot reach a run.
 */

import type { KnobDeclaration, TaskDeclaration } from './types.js'
import { knobPermits, type ValidationIssue } from './validate.js'

export interface ResolvedConfiguration {
  readonly taskId: string
  /** Knob id and value pairs, in the task's declared knob order. */
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

/** The configuration a student starts from: every knob at its declared default. */
export function defaultConfiguration(declaration: TaskDeclaration): ResolvedConfiguration {
  return {
    taskId: declaration.id,
    values: declaration.knobs.map((knob) => [knob.id, knob.default] as const),
  }
}

/**
 * Resolves requested knob values against a task's knob declarations. Knobs the
 * request omits fall back to their declared default; unknown knob ids and
 * values the declaration does not permit are refused, each naming the knob.
 */
export function resolveConfiguration(
  declaration: TaskDeclaration,
  requested: Readonly<Record<string, unknown>>,
): ConfigurationValidation {
  const issues: ValidationIssue[] = []
  const values: (readonly [string, string | number])[] = []
  const knownIds = declaration.knobs.map((knob) => knob.id)

  for (const key of Object.keys(requested)) {
    if (!knownIds.includes(key)) {
      issues.push({
        code: 'unknown-knob',
        field: key,
        message: `Task "${declaration.id}" declares no knob "${key}".`,
      })
    }
  }

  for (const knob of declaration.knobs) {
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
  return { ok: true, configuration: { taskId: declaration.id, values } }
}

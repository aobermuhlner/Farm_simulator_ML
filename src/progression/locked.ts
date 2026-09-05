/**
 * The locked check, and the order the three refusals are asked in.
 *
 * `src/task/` knows nothing about ownership and keeps it that way: `resolveConfiguration`
 * is untouched and stays the only producer of a `ResolvedConfiguration`. This runs a
 * second, progression-aware check over the configuration it produced.
 *
 * The order is invalid, then locked, then untrained. A value outside the declared values
 * is a mistake in the calling code whatever is owned; a locked value must never reach an
 * artifact lookup; untrained is what remains once both have passed. Each carries its own
 * code, so `Issues` renders three distinguishable causes and no screen has to decide
 * which one a student is looking at — a student who has not bought something has made no
 * error, and a student who has bought something has not met the limits of what was
 * trained.
 */

import type { ResolvedConfiguration } from '../task/configuration.js'
import { resolveConfiguration } from '../task/configuration.js'
import type { TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import type { TaskAvailability } from './availability.js'
import { lockedValue } from './availability.js'

/** A configuration naming a declared value that is not yet owned. */
export const LOCKED_CONFIGURATION = 'locked-configuration'

/**
 * Every locked value the configuration names, each naming what opens it.
 *
 * An availability of `undefined` locks nothing. That is the default-open rule again: a
 * caller with no catalog in hand is a caller with nothing to lock, not a caller who
 * should have everything locked.
 */
export function lockedIssues(
  configuration: ResolvedConfiguration,
  availability: TaskAvailability | undefined,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const [knobId, value] of configuration.values) {
    const locked = lockedValue(availability, knobId, value)
    if (locked === undefined) continue
    issues.push({
      code: LOCKED_CONFIGURATION,
      field: knobId,
      message: `${JSON.stringify(value)} is not yet owned${
        locked.openedBy === undefined ? '' : `; "${locked.openedBy.label}" opens it`
      }.`,
    })
  }
  return issues
}

export type SelectableConfiguration =
  | { readonly ok: true; readonly configuration: ResolvedConfiguration }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/**
 * Resolves requested knob values and then checks what they resolved to is owned.
 *
 * One function rather than two calls at every call site, because the order the two
 * refusals are asked in is the specified behaviour and a caller that got it backwards
 * would report a locked value as an invalid one.
 */
export function resolveSelectable(
  declaration: TaskDeclaration,
  requested: Readonly<Record<string, unknown>>,
  availability: TaskAvailability | undefined,
): SelectableConfiguration {
  const resolved = resolveConfiguration(declaration, requested)
  if (!resolved.ok) return { ok: false, issues: resolved.issues }

  const locked = lockedIssues(resolved.configuration, availability)
  if (locked.length > 0) return { ok: false, issues: locked }

  return { ok: true, configuration: resolved.configuration }
}

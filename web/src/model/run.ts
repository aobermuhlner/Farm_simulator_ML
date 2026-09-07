/**
 * The screens' only door into the engine.
 *
 * `design.md` — the shell derives no earnings, counts or chosen actions of its
 * own. Everything below delegates: `resolveConfiguration` decides whether knob
 * values are permitted, `configurationId` names them, and `runHarvest` scores.
 * If a screen needs a number that is not returned from here, the fix is an
 * engine change with a spec behind it, not arithmetic in a component.
 */

import type { ConfigurationEntry } from '../../../src/task/artifact.js'
import { configurationId } from '../../../src/task/configId.js'
import { defaultConfiguration } from '../../../src/task/configuration.js'
import type { TaskAvailability } from '../../../src/progression/index.js'
import { resolveSelectable } from '../../../src/progression/index.js'
import type { RunResult } from '../../../src/scoring/index.js'
import { scoreEntry } from '../../../src/scoring/index.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'

/** Issue code the engine uses for a configuration the artifact has no entry for. */
export const UNKNOWN_CONFIGURATION = 'unknown-configuration'

/** Knob id to the value currently selected for it. */
export type KnobValues = Readonly<Record<string, string | number>>

/** Every knob at its declared default, as the student's starting point. */
export function defaultKnobValues(declaration: TaskDeclaration): KnobValues {
  return Object.fromEntries(defaultConfiguration(declaration).values)
}

/**
 * The configuration identifier the current knob values resolve to, or the
 * issues that stop them resolving. Order-independent, because the engine builds
 * the id from the declared knob order rather than from selection order.
 *
 * `availability` adds the second of the three refusals: a value the declaration permits
 * but the farm does not yet own refuses as locked, before anything is fetched. Omitting
 * it locks nothing, which is the same default-open rule the engine works by.
 */
export function identifyConfiguration(
  declaration: TaskDeclaration,
  values: KnobValues,
  availability?: TaskAvailability,
): { readonly ok: true; readonly id: string } | { readonly ok: false; readonly issues: readonly { code: string; message: string; field?: string }[] } {
  const resolved = resolveSelectable(declaration, values, availability)
  if (!resolved.ok) return { ok: false, issues: resolved.issues }
  return { ok: true, id: configurationId(resolved.configuration) }
}

/**
 * Brings one card's crop in, from the configuration at work for it and its own entry.
 *
 * Driven by the identifier rather than by knob values, because that is what a labour slot
 * holds — see `workshop-harvest-split/design.md`, decision 3. The knobs are a scratchpad
 * a student may have moved on since; the slot is the commitment the year reads.
 *
 * The training split is deliberately not run here: showing training-versus-harvest
 * performance is `training-simulation`'s work, and designing that comparison twice is how
 * the two end up disagreeing.
 */
export function runFielded(
  declaration: TaskDeclaration,
  identifier: string,
  entry: ConfigurationEntry,
  truth: Readonly<Record<string, CategoryId>>,
): RunResult {
  return scoreEntry(declaration, identifier, entry, 'pool', truth)
}

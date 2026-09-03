/**
 * The screens' only door into the engine.
 *
 * `design.md` — the shell derives no earnings, counts or chosen actions of its
 * own. Everything below delegates: `resolveConfiguration` decides whether knob
 * values are permitted, `configurationId` names them, and `runHarvest` scores.
 * If a screen needs a number that is not returned from here, the fix is an
 * engine change with a spec behind it, not arithmetic in a component.
 */

import type { PredictionArtifact } from '../../../src/task/artifact.js'
import { configurationId } from '../../../src/task/configId.js'
import { defaultConfiguration, resolveConfiguration } from '../../../src/task/configuration.js'
import type { RunResult } from '../../../src/scoring/index.js'
import { runHarvest } from '../../../src/scoring/index.js'
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
 */
export function identifyConfiguration(
  declaration: TaskDeclaration,
  values: KnobValues,
): { readonly ok: true; readonly id: string } | { readonly ok: false; readonly issues: readonly { code: string; message: string; field?: string }[] } {
  const resolved = resolveConfiguration(declaration, values)
  if (!resolved.ok) return { ok: false, issues: resolved.issues }
  return { ok: true, id: configurationId(resolved.configuration) }
}

/**
 * Runs one harvest over the evaluation pool.
 *
 * The training split is deliberately not run here: showing training-versus-
 * harvest performance is `training-simulation`'s work, and designing that
 * comparison twice is how the two end up disagreeing.
 */
export function runPool(
  declaration: TaskDeclaration,
  values: KnobValues,
  artifact: PredictionArtifact,
  truth: Readonly<Record<string, CategoryId>>,
): RunResult {
  return runHarvest(declaration, values, artifact, 'pool', truth)
}

/**
 * A task declaring two model families, for the engine tests.
 *
 * The shipped apple task declares one, so a suite that only ever ran against it would
 * leave family scoping asserted nowhere — and family scoping is the whole of what this
 * change buys. Both families here declare a knob called `depth` with the same values, so
 * the two compose *identical* identifier strings: a lookup that resolved an identifier
 * against the task rather than against the family would answer with the wrong family's
 * model, and would answer with a real, plausible distribution rather than failing.
 *
 * One family ships predictions and records a history whose axis is not epochs; the other
 * ships its model and records none. Between them they exercise both evaluators, both
 * shipped forms and both sides of "a family may have no history".
 */

import type { PredictionArtifact } from '../../src/task/artifact.js'
import type { ModelFamilyDeclaration, TaskDeclaration } from '../../src/task/types.js'
import { validateDeclaration } from '../../src/task/validate.js'
import { loadRawDeclaration } from './load-raw'

/**
 * The dataset knob both families declare.
 *
 * Every family declares one — a model is always fitted on something — so the two-family
 * task carries it too, with the tiers it inherits from the apple declaration it is built
 * from. Declared last, as `dataset-tiers/design.md` requires, so the identifier gains a
 * suffix rather than reshuffling.
 */
const DATASET_KNOB = {
  kind: 'choice',
  id: 'dataset',
  label: 'Photos to learn from',
  values: ['starter', 'bulk', 'checked'],
  default: 'starter',
  help: 'Which set of photographs this model is fitted on.',
} as const

/** The knob both families declare, so that both compose the same identifiers. */
const DEPTH_KNOB = {
  kind: 'choice',
  id: 'depth',
  label: 'Depth',
  values: [1, 2],
  default: 1,
  help: 'How much of the picture it looks at before it answers.',
} as const

/** The prediction-shipping family: fitted in advance, its table looked up. */
export const SHIPS_PREDICTIONS = {
  id: 'fitted-net',
  label: 'Fitted network',
  ships: 'predictions',
  predictions: 'artifacts/two-family/fitted-net',
  slot: { icon: 'N', label: 'Network' },
  history: { axis: 'sweep' },
  teaching: {
    summary: 'A network whose weights are too large to travel.',
    theory: 'What travels is the table of what it said, keyed by the settings it was fitted at.',
  },
  knobs: [DEPTH_KNOB, DATASET_KNOB],
  datasetKnob: 'dataset',
} as const

/** The model-shipping family: a few thresholds, applied in the browser. */
export const SHIPS_MODEL = {
  id: 'cut-chain',
  label: 'Chain of cuts',
  ships: 'model',
  models: 'artifacts/two-family/cut-chain',
  slot: { icon: 'C', label: 'Cuts' },
  teaching: {
    summary: 'A handful of thresholds on the numbers measured from each picture.',
    theory: 'Small enough to send, so it is applied here rather than looked up.',
  },
  knobs: [DEPTH_KNOB, DATASET_KNOB],
  datasetKnob: 'dataset',
} as const

/**
 * The schema version the two-family task declares, read from the declaration it is built
 * from rather than repeated, so that a pool schema bump moves the fixtures with it.
 */
export const TWO_FAMILY_SCHEMA = String(loadRawDeclaration('apple-harvest').schemaVersion)

/** The raw two-family declaration, for a test that needs to break one field of it. */
export function rawTwoFamilyTask(
  families: readonly unknown[] = [SHIPS_PREDICTIONS, SHIPS_MODEL],
): Record<string, unknown> {
  const raw = loadRawDeclaration('apple-harvest')
  return { ...raw, id: 'two-family-task', title: 'Two Family Task', families: [...families] }
}

/** The validated two-family task. */
export function twoFamilyTask(): TaskDeclaration {
  const result = validateDeclaration(rawTwoFamilyTask())
  if (!result.ok) {
    throw new Error(
      `the two-family test declaration should validate; issues: ${result.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return result.declaration
}

/** One of that task's families, by id. */
export function familyOf(task: TaskDeclaration, id: string): ModelFamilyDeclaration {
  const family = task.families.find((candidate) => candidate.id === id)
  if (family === undefined) throw new Error(`the test task declares no family "${id}"`)
  return family
}

/**
 * A prediction artifact for the network family, under the identifier both families make.
 *
 * Its distributions are deliberately the opposite of what the shipped model below says
 * about the same images, so a test can tell which family answered.
 */
export function twoFamilyArtifact(familyId = SHIPS_PREDICTIONS.id): PredictionArtifact {
  return {
    schemaVersion: TWO_FAMILY_SCHEMA,
    taskId: 'two-family-task',
    familyId,
    categories: ['red', 'green', 'wormy'],
    configurations: {
      'depth1-datasetstarter': {
        history: [
          { epoch: 1, trainLoss: 0.9, valLoss: 0.95, trainAccuracy: 0.4, valAccuracy: 0.35 },
          { epoch: 2, trainLoss: 0.5, valLoss: 0.6, trainAccuracy: 0.8, valAccuracy: 0.7 },
        ],
        predictions: {
          training: { 'a-1': [0.9, 0.05, 0.05] },
          pool: { 'a-1': [0.9, 0.05, 0.05], 'a-2': [0.9, 0.05, 0.05] },
        },
      },
    },
  }
}

/** A shipped model for the cut-chain family, at the same identifier. */
export function twoFamilyModelDocument(
  over: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    schemaVersion: TWO_FAMILY_SCHEMA,
    taskId: 'two-family-task',
    familyId: SHIPS_MODEL.id,
    configurationId: 'depth1-datasetstarter',
    model: {
      splits: [{ feature: 'redness', threshold: 0.5, whenAbove: [0.05, 0.05, 0.9] }],
      otherwise: [0.05, 0.9, 0.05],
    },
    ...over,
  }
}

/** Image ids per split, as a pool manifest would enumerate them. */
export const TWO_FAMILY_IMAGES = {
  training: ['a-1'],
  pool: ['a-1', 'a-2'],
} as const

/** Measured features for those images, as the pool manifest records them. */
export function twoFamilyFeatures(): Readonly<Record<string, Readonly<Record<string, number>>>> {
  return {
    'a-1': { redness: 0.9, roundness: 0.8, darkSpotArea: 0.01, spotCount: 0, textureVar: 0.02 },
    'a-2': { redness: 0.1, roundness: 0.8, darkSpotArea: 0.01, spotCount: 0, textureVar: 0.02 },
  }
}

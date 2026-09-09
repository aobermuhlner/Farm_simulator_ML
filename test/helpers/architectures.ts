/**
 * A task per supported architecture family, for the engine tests.
 *
 * The apple task declares one family, so a suite that only ever ran against it would
 * leave the other family's rules asserted nowhere — and the family the apple task does
 * not use is exactly the one at risk of quietly rotting. These two declarations keep both
 * specified independently of which family the shipped lesson happens to be in.
 *
 * Both are built on the shipped declaration's non-architecture fields, so they stay valid
 * for the same reasons it is, and both go through the real validator: a hand-typed shape
 * that never validated would prove nothing about what a declaration may say.
 */

import type { TaskDeclaration } from '../../src/task/types.js'
import { validateDeclaration } from '../../src/task/validate.js'
import { loadRawDeclaration } from './load-raw'

/** A dropout knob, whose 0.2 is the value no count of layers or blocks can be. */
const DROPOUT_KNOB = {
  kind: 'choice',
  id: 'dropout',
  label: 'Dropout',
  values: [0, 0.2, 0.5],
  default: 0,
  help: 'The fraction of units switched off at random during each training step.',
} as const

/** A slider knob, so a suite can put a whole configuration out of range. */
const REGULARIZATION_KNOB = {
  kind: 'slider',
  id: 'regularization',
  label: 'Loss regularization strength',
  min: 0,
  max: 3,
  step: 1,
  default: 1,
  help: 'How hard training pushes towards simpler answers.',
} as const

/**
 * The shipped declaration with its one family's knobs and architecture replaced.
 *
 * The family is rebuilt rather than the task, because that is where knobs and a drawing
 * live: a task-level `knobs` is refused at load, which is the point of moving them.
 */
function taskWith(
  id: string,
  knobs: readonly Record<string, unknown>[],
  diagram: Record<string, unknown>,
): Record<string, unknown> {
  const raw = loadRawDeclaration('apple-harvest')
  const families = raw.families as readonly Record<string, unknown>[]
  const family = families[0] as Record<string, unknown>
  const shipped = family.knobs as readonly Record<string, unknown>[]
  // The task's own dataset knob rides along with the replaced set. Every family declares
  // one — a model is always fitted on something — and these tasks keep the apple task's
  // tiers because it is the apple task's declaration they are built from.
  const dataset = shipped.find((knob) => knob.id === family.datasetKnob)
  return {
    ...raw,
    id,
    title: id,
    families: [
      {
        ...family,
        knobs: dataset === undefined ? [...knobs] : [...knobs, dataset],
        diagram,
      },
    ],
  }
}

/** A fully-connected task, as raw declaration data. */
export function rawFeedforwardTask(
  diagramPatch: Record<string, unknown> = {},
): Record<string, unknown> {
  return taskWith(
    'feedforward-task',
    [
      {
        kind: 'choice',
        id: 'layers',
        label: 'Hidden layers',
        values: [2, 4, 8],
        default: 4,
        help: 'How many layers the network stacks.',
      },
      {
        kind: 'choice',
        id: 'units',
        label: 'Neurons per layer',
        values: [16, 64, 256],
        default: 64,
        help: 'How much room each layer has.',
      },
      DROPOUT_KNOB,
      REGULARIZATION_KNOB,
    ],
    {
      kind: 'feedforward',
      layersKnob: 'layers',
      unitsKnob: 'units',
      unitsShown: { '16': 2, '64': 4, '256': 8 },
      inputsShown: 3,
      ...diagramPatch,
    },
  )
}

/** A convolutional task, as raw declaration data. */
export function rawCnnTask(diagramPatch: Record<string, unknown> = {}): Record<string, unknown> {
  return taskWith(
    'cnn-task',
    [
      {
        kind: 'choice',
        id: 'blocks',
        label: 'Convolutional blocks',
        values: [2, 3, 4],
        default: 3,
        help: 'How many blocks the stack has.',
      },
      {
        kind: 'choice',
        id: 'channels',
        label: 'Channels in the first block',
        values: [8, 16, 32],
        default: 16,
        help: 'How many filters the first block learns.',
      },
      DROPOUT_KNOB,
      REGULARIZATION_KNOB,
    ],
    {
      kind: 'cnn',
      blocksKnob: 'blocks',
      channelsKnob: 'channels',
      inputSize: 128,
      channelsShown: { '8': 2, '16': 3, '32': 4 },
      ...diagramPatch,
    },
  )
}

function validated(raw: Record<string, unknown>): TaskDeclaration {
  const result = validateDeclaration(raw)
  if (!result.ok) {
    throw new Error(
      `the test declaration should validate; issues: ${result.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return result.declaration
}

/** A validated fully-connected task. */
export function feedforwardTask(): TaskDeclaration {
  return validated(rawFeedforwardTask())
}

/** A validated convolutional task. */
export function cnnTask(): TaskDeclaration {
  return validated(rawCnnTask())
}

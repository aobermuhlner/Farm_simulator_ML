/**
 * Declarations for screen tests.
 *
 * The apple one is the shipped file, read from disk and put through the real
 * validator — a screen test that passed against a hand-typed stand-in would
 * prove nothing about the declaration students actually get.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConfigurationEntry, PredictionArtifact } from '../../../src/task/artifact.js'
import { coverageIssue, type LoadedIndex } from '../../../src/task/artifactIndex.js'
import type { Loaded } from '../data/load.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'
import { validateDeclaration } from '../../../src/task/validate.js'

const repoRoot = process.cwd()

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as unknown
}

/** The shipped apple declaration, validated. */
export function appleDeclaration(): TaskDeclaration {
  const validated = validateDeclaration(readJson('declarations/apple-harvest.json'))
  if (!validated.ok) {
    throw new Error(
      `The shipped apple declaration does not validate: ${validated.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return validated.declaration
}

/** The shipped prediction fixture. */
export function appleArtifact(): PredictionArtifact {
  return readJson('test/fixtures/apple-predictions.json') as PredictionArtifact
}

/** Ground truth from the shipped pool fixture. */
export function appleTruth(): Readonly<Record<string, CategoryId>> {
  const manifest = readJson('test/fixtures/apple-pool.json') as {
    images: Record<string, { category: CategoryId }>
  }
  return Object.fromEntries(
    Object.entries(manifest.images).map(([id, entry]) => [id, entry.category]),
  )
}

/**
 * A task sharing nothing with the apple lesson — different categories, actions,
 * knobs and vocabulary. If the screens can render this, they are rendering
 * declarations rather than apples.
 */
export function unrelatedDeclaration(): TaskDeclaration {
  const declaration = {
    id: 'skin-screening',
    title: 'Skin Screening',
    schemaVersion: '1.0.0',
    categories: [
      { id: 'healthy', label: 'Healthy patch' },
      { id: 'diseased', label: 'Diseased patch' },
    ],
    actions: [
      { id: 'flag', label: 'Flag for the vet' },
      { id: 'pass', label: 'Pass it' },
    ],
    categoryActions: { healthy: 'pass', diseased: 'flag' },
    policy: { kind: 'highest-probability' },
    pool: 'pools/skin-screening',
    predictions: 'artifacts/skin-screening.json',
    knobs: [
      {
        kind: 'choice',
        id: 'sensitivity',
        label: 'Sensitivity',
        values: ['low', 'high'],
        default: 'low',
        help: 'How readily the screen calls a patch diseased.',
      },
    ],
    payoffs: {
      healthy: { flag: -1, pass: 0 },
      diseased: { flag: 0, pass: -20 },
    },
    teaching: {
      summary: 'Missing a diseased animal costs far more than a needless vet visit.',
      theory: 'When one error is dearer than the other, the best guess is not the best decision.',
    },
    available: true,
  }

  const validated = validateDeclaration(declaration)
  if (!validated.ok) {
    throw new Error(
      `The unrelated test declaration does not validate: ${validated.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return validated.declaration
}

/** A prediction artifact for {@link unrelatedDeclaration}. */
export function unrelatedArtifact(): PredictionArtifact {
  return {
    schemaVersion: '1.0.0',
    taskId: 'skin-screening',
    categories: ['healthy', 'diseased'],
    configurations: {
      sensitivitylow: {
        history: [],
        predictions: {
          training: { 'a-1': [0.9, 0.1] },
          pool: { 'a-1': [0.8, 0.2], 'a-2': [0.3, 0.7], 'a-3': [0.55, 0.45] },
        },
      },
    },
  }
}

/** Ground truth for {@link unrelatedArtifact}'s pool split. */
export function unrelatedTruth(): Readonly<Record<string, CategoryId>> {
  return { 'a-1': 'healthy', 'a-2': 'diseased', 'a-3': 'diseased' }
}

/**
 * A second task declaring its own architecture, sharing nothing with the apple one.
 *
 * Separate from {@link unrelatedDeclaration} rather than folded into it, so the suites
 * that already use that task keep rendering exactly what they rendered before. Its width
 * knob takes strings rather than numbers, which is the point: the drawn counts are keyed
 * by the values a knob permits, whatever those are.
 */
export function diagrammedDeclaration(): TaskDeclaration {
  const base = unrelatedDeclaration()
  const declaration = {
    ...base,
    id: 'skin-screening-drawn',
    title: 'Skin Screening (drawn)',
    knobs: [
      ...base.knobs,
      {
        kind: 'choice',
        id: 'stack',
        label: 'Stages in the stack',
        values: [1, 3],
        default: 1,
        help: 'How many stages the screen puts an image through.',
      },
      {
        kind: 'choice',
        id: 'breadth',
        label: 'Detail per stage',
        values: ['narrow', 'wide'],
        default: 'narrow',
        help: 'How much detail each stage keeps.',
      },
    ],
    diagram: {
      kind: 'feedforward',
      layersKnob: 'stack',
      unitsKnob: 'breadth',
      unitsShown: { narrow: 1, wide: 5 },
      inputsShown: 2,
    },
  }

  const validated = validateDeclaration(declaration)
  if (!validated.ok) {
    throw new Error(
      `the drawn test declaration does not validate: ${validated.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return validated.declaration
}

/**
 * A convolutional task sharing nothing with the apple lesson.
 *
 * Its input resolution, block counts and channel counts are all its own, and it declares
 * two categories rather than three, so a drawing that had quietly kept any of the shipped
 * task's numbers would fail against it. That is the whole point of testing the drawing
 * here rather than only against the lesson that motivated it.
 */
export function convolutionalDeclaration(): TaskDeclaration {
  const base = unrelatedDeclaration()
  const declaration = {
    ...base,
    id: 'skin-screening-convolutional',
    title: 'Skin Screening (convolutional)',
    knobs: [
      ...base.knobs,
      {
        kind: 'choice',
        id: 'stages',
        label: 'Stages in the stack',
        values: [2, 3, 4],
        default: 3,
        help: 'How many stages the screen puts an image through.',
      },
      {
        kind: 'choice',
        id: 'filters',
        label: 'Filters in the first stage',
        values: [4, 8, 16],
        default: 8,
        help: 'How many patterns the first stage looks for.',
      },
    ],
    diagram: {
      kind: 'cnn',
      blocksKnob: 'stages',
      channelsKnob: 'filters',
      inputSize: 64,
      channelsShown: { '4': 2, '8': 3, '16': 4 },
    },
  }

  const validated = validateDeclaration(declaration)
  if (!validated.ok) {
    throw new Error(
      `the convolutional test declaration does not validate: ${validated.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return validated.declaration
}

/**
 * A `loadEntry` over an already-loaded artifact, for screen tests.
 *
 * The shipped app fetches one configuration at a time; a test does not need a server to
 * exercise that, only a function with the same contract — including the refusal for a
 * configuration nothing was trained for, which is the one a student is most likely to
 * meet.
 */
export function entryLoader(artifact: PredictionArtifact) {
  return (configurationId: string): Promise<Loaded<ConfigurationEntry>> => {
    const entry = artifact.configurations[configurationId]
    if (entry === undefined) {
      const issue = coverageIssue(
        { configurations: {}, coverage: [] } as unknown as LoadedIndex,
        configurationId,
      )
      return Promise.resolve({ ok: false, issues: issue === undefined ? [] : [issue] })
    }
    return Promise.resolve({ ok: true, value: entry })
  }
}

/**
 * Declarations for screen tests.
 *
 * The apple one is the shipped file, read from disk and put through the real
 * validator — a screen test that passed against a hand-typed stand-in would
 * prove nothing about the declaration students actually get.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FamilyEntry } from '../../../src/families/index.js'
import {
  entryFromPredictions,
  familyCoverageIssue,
  resolveFamilyEntry,
} from '../../../src/families/index.js'
import type { PredictionArtifact } from '../../../src/task/artifact.js'
import type { Loaded } from '../data/load.js'
import { firstFamily } from '../../../src/task/families.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import { fixtureKinds, fixtureTutorial } from '../../../test/helpers/tutorials.js'

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
 *
 * It declares two actions where the apple task declares three, and that is deliberate
 * rather than left over: a screen that had quietly learned either count would fail against
 * the other. Widen this one and the suite stops proving the screens assume no count at all.
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
    // Its own datasets too, sized and named after nothing an apple has. A screen that
    // renders these is rendering the declaration rather than the lesson that motivated it.
    datasets: [
      {
        id: 'clinic',
        label: 'The clinic’s own photographs',
        size: 40,
        composition: { healthy: 25, diseased: 15 },
        labelQuality: 'checked',
        disclosure: 'Every one of these was confirmed by the vet who took it.',
      },
      {
        id: 'archive',
        label: 'The regional archive',
        size: 120,
        composition: { healthy: 90, diseased: 30 },
        labelQuality: 'some-wrong',
        disclosure: 'Gathered from six practices over as many years. Some of the notes contradict the photograph.',
      },
    ],
    families: [
      {
        id: 'screen-net',
        label: 'Screening network',
        ships: 'predictions',
        predictions: 'artifacts/skin-screening',
        slot: { icon: '\u2695', label: 'Screen' },
        history: { axis: 'pass' },
        teaching: {
          summary: 'A network that looks at the whole photograph at once.',
          theory: 'Its one setting decides how readily it calls a patch diseased.',
        },
        knobs: [
          {
            kind: 'choice',
            id: 'sensitivity',
            label: 'Sensitivity',
            values: ['low', 'high'],
            default: 'low',
            help: 'How readily the screen calls a patch diseased.',
          },
          {
            kind: 'choice',
            id: 'photographs',
            label: 'Photographs to learn from',
            values: ['clinic', 'archive'],
            default: 'clinic',
            help: 'Which set of photographs the screen was fitted on.',
          },
        ],
        // Named rather than found by convention, so nothing infers the fitting set from a
        // knob id: this family calls its dataset knob "photographs".
        datasetKnob: 'photographs',
      },
    ],
    // Its own features, on its own scales, named after nothing an apple has: a screen
    // that renders these is rendering the declaration.
    features: [
      {
        id: 'patchArea',
        label: 'Patch area',
        unit: 'square millimetres, as measured on the photograph',
        range: { min: 0.5, max: 40 },
        contaminatedBy: ['cameraDistance'],
        help: 'How large the patch is in the photograph. Measured from the picture, so a close-up shot makes the same patch measure larger.',
      },
      {
        id: 'edgeRoughness',
        label: 'Edge roughness',
        unit: 'perimeter over the perimeter of a circle of equal area; 1 is smooth',
        range: { min: 1, max: 3.4 },
        contaminatedBy: ['focus'],
        help: 'How ragged the patch outline is. A blurred photograph smooths a ragged edge, so this reads low on a soft picture whatever the patch looks like.',
      },
    ],
    ruleBudget: { maxNodes: 2 },
    payoffs: {
      healthy: { flag: -1, pass: 0 },
      diseased: { flag: 0, pass: -20 },
    },
    // Deliberately unlike the apple task's figures: a screen that had kept either of
    // those numbers would render this task with the wrong one.
    handSorting: { secondsPerImage: 45 },
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
    familyId: 'screen-net',
    categories: ['healthy', 'diseased'],
    configurations: {
      // The tier the family's dataset knob names, appended as every identifier carries it.
      'sensitivitylow-photographsclinic': {
        history: [
          { step: 1, trainLoss: 0.9, valLoss: 0.95, trainAccuracy: 0.4, valAccuracy: 0.35 },
          { step: 2, trainLoss: 0.6, valLoss: 0.68, trainAccuracy: 0.7, valAccuracy: 0.62 },
          { step: 3, trainLoss: 0.4, valLoss: 0.55, trainAccuracy: 0.86, valAccuracy: 0.71 },
        ],
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
 * A task whose categories do not map one-to-one onto its actions.
 *
 * It exists to hold one distinction open, and it is named for that distinction rather than
 * for its domain. Every declaration that ships maps each category to an action of its own,
 * so "the cell this category calls for" and "the cell on the diagonal" pick out the same
 * nine cells everywhere else in this repository — and an implementation that marked the
 * diagonal would pass every other test in the suite while being wrong about what it is
 * marking.
 *
 * Two properties are deliberate and are asserted rather than left to be noticed. Two
 * categories share one action, so a column carries more than one declared cell. And no
 * declared cell lands on the diagonal at all, so a diagonal implementation marks nothing
 * this task calls for rather than merely getting it partly wrong.
 *
 * The third action is the answer to no category, which `decision-policy` permits on purpose:
 * a task may offer a treatment that is never right for a certain image and is reached only
 * when nothing is certain.
 */
export function sharedActionDeclaration(): TaskDeclaration {
  const declaration = {
    id: 'parcel-routing',
    title: 'Parcel Routing',
    schemaVersion: '1.0.0',
    categories: [
      { id: 'local', label: 'Local parcel' },
      { id: 'national', label: 'National parcel' },
      { id: 'overseas', label: 'Overseas parcel' },
    ],
    actions: [
      { id: 'depot', label: 'Send to the depot' },
      { id: 'van', label: 'Load the local van' },
      { id: 'airport', label: 'Drive it to the airport' },
    ],
    // Neither of these three sits on the diagonal, and two of them share a column.
    categoryActions: { local: 'van', national: 'depot', overseas: 'depot' },
    policy: { kind: 'highest-probability' },
    pool: 'pools/parcel-routing',
    datasets: [
      {
        id: 'depotscans',
        label: 'Last month’s depot scans',
        size: 60,
        composition: { local: 30, national: 20, overseas: 10 },
        labelQuality: 'checked',
        disclosure: 'Each of these was checked against where the parcel actually went.',
      },
    ],
    families: [
      {
        id: 'sorter',
        label: 'Label sorter',
        ships: 'predictions',
        predictions: 'artifacts/parcel-routing',
        slot: { icon: '\u{1F4E6}', label: 'Sorter' },
        teaching: {
          summary: 'A sorter that reads the address label off the scan.',
          theory: 'Its one setting decides how long it looks before deciding.',
        },
        knobs: [
          {
            kind: 'choice',
            id: 'care',
            label: 'Care taken',
            values: ['quick', 'careful'],
            default: 'quick',
            help: 'How long the sorter looks at a label before deciding.',
          },
          {
            kind: 'choice',
            id: 'scans',
            label: 'Scans to learn from',
            values: ['depotscans'],
            default: 'depotscans',
            help: 'Which set of scans the sorter was fitted on.',
          },
        ],
        datasetKnob: 'scans',
      },
    ],
    // Different again, and a different budget: nothing may assume the apple task's.
    features: [
      {
        id: 'labelWidth',
        label: 'Label width',
        unit: 'millimetres across the printed label',
        range: { min: 40, max: 210 },
        contaminatedBy: ['scannerAngle'],
        help: 'How wide the address label reads on the scan. A parcel that went through at an angle measures narrower than it is.',
      },
      {
        id: 'inkDarkness',
        label: 'Ink darkness',
        unit: 'how dark the print is against the paper; 0 to 1',
        range: { min: 0.1, max: 0.95 },
        contaminatedBy: ['scannerAngle', 'paperStock'],
        help: 'How dark the printing is against the paper. Measured from the scan, so brown paper makes clear print read faint.',
      },
    ],
    ruleBudget: { maxNodes: 4 },
    // Every row pays most for the action its category is declared to call for, which the
    // validator requires; the airport is close behind on overseas without ever catching it.
    payoffs: {
      local: { depot: 0.2, van: 0.6, airport: -0.5 },
      national: { depot: 0.5, van: -0.1, airport: 0.1 },
      overseas: { depot: 0.3, van: -0.8, airport: 0.25 },
    },
    handSorting: { secondsPerImage: 30 },
    teaching: {
      summary: 'Two of these three parcels take the same road out of the yard.',
      theory: 'A category and a treatment are different things, and nothing says a task must have one of each.',
    },
    available: true,
  }

  const validated = validateDeclaration(declaration)
  if (!validated.ok) {
    throw new Error(
      `The shared-action test declaration does not validate: ${validated.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return validated.declaration
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
  const family = firstFamily(base)
  const declaration = {
    ...base,
    id: 'skin-screening-drawn',
    title: 'Skin Screening (drawn)',
    families: [
      {
        ...family,
        knobs: [
          ...family.knobs,
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
      },
    ],
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
  const family = firstFamily(base)
  const declaration = {
    ...base,
    id: 'skin-screening-convolutional',
    title: 'Skin Screening (convolutional)',
    families: [
      {
        ...family,
        knobs: [
          ...family.knobs,
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
      },
    ],
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
export function entryLoader(declaration: TaskDeclaration, ...artifacts: PredictionArtifact[]) {
  return (familyId: string, configurationId: string): Promise<Loaded<FamilyEntry>> => {
    const family = declaration.families.find((candidate) => candidate.id === familyId)
    const artifact = artifacts.find((candidate) => candidate.familyId === familyId)
    const entry = artifact?.configurations[configurationId]
    if (family === undefined || entry === undefined) {
      const issue =
        family === undefined
          ? {
              code: 'unknown-family',
              field: familyId,
              message: `Task "${declaration.id}" declares no model family "${familyId}".`,
            }
          : familyCoverageIssue(
              family,
              Object.keys(artifact?.configurations ?? {}),
              configurationId,
            )
      return Promise.resolve({ ok: false, issues: issue === undefined ? [] : [issue] })
    }
    return Promise.resolve({ ok: true, value: entryFromPredictions(entry) })
  }
}

/**
 * A task declaring two model families — one that ships predictions, one that ships its
 * model — so the abstraction is under test even though the shipped game declares one.
 *
 * Both families deliberately declare a knob called `depth` with the same values, so the
 * two compose *identical* identifier strings. That is the whole point of the fixture: a
 * lookup that resolved an identifier against the task rather than against the family
 * would answer with the wrong family's model, and would answer with a real, plausible
 * distribution rather than failing. Everything about family scoping is tested here.
 *
 * One family records a history and one records none, so the workshop is exercised both
 * ways: a curve with a declared axis that is not epochs, and no curve at all.
 */
export function twoFamilyDeclaration(): TaskDeclaration {
  const base = unrelatedDeclaration()
  const declaration = {
    ...base,
    id: 'skin-screening-ladder',
    title: 'Skin Screening (ladder)',
    families: [
      {
        id: 'screen-net',
        label: 'Screening network',
        ships: 'predictions',
        predictions: 'artifacts/skin-screening-ladder/screen-net',
        slot: { icon: '⚕', label: 'Screen' },
        history: { axis: 'sweep' },
        teaching: {
          summary: 'A network fitted in advance, whose predictions are shipped.',
          theory: 'Its weights are too large to travel, so what travels is what it said.',
        },
        knobs: [
          {
            kind: 'choice',
            id: 'depth',
            label: 'Layers',
            values: [1, 2],
            default: 1,
            help: 'How many layers the network stacks.',
          },
          {
            kind: 'choice',
            id: 'photographs',
            label: 'Photographs to learn from',
            values: ['clinic', 'archive'],
            default: 'clinic',
            help: 'Which set of photographs the network was fitted on.',
          },
        ],
        datasetKnob: 'photographs',
      },
      {
        id: 'cut-chain',
        label: 'Chain of cuts',
        ships: 'model',
        models: 'artifacts/skin-screening-ladder/cut-chain',
        slot: { icon: '✂', label: 'Cuts' },
        teaching: {
          summary: 'A handful of thresholds on the numbers measured from each photograph.',
          theory: 'Small enough to send, so it is applied in the browser rather than looked up.',
        },
        knobs: [
          {
            kind: 'choice',
            id: 'depth',
            label: 'Questions',
            values: [1, 2],
            default: 1,
            help: 'How many questions the chain asks before it answers.',
          },
          {
            kind: 'choice',
            id: 'photographs',
            label: 'Photographs to learn from',
            values: ['clinic', 'archive'],
            default: 'clinic',
            help: 'Which set of photographs the chain was fitted on.',
          },
        ],
        datasetKnob: 'photographs',
      },
    ],
  }

  const validated = validateDeclaration(declaration)
  if (!validated.ok) {
    throw new Error(
      `the two-family test declaration does not validate: ${validated.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return validated.declaration
}

/**
 * The same ladder, with a tutorial on the family that ships predictions.
 *
 * One family gated and one not, so every screen test can put the two cases side by side
 * and none of them has to assert the ungated behaviour by its absence.
 */
export function tutoredLadderDeclaration(): TaskDeclaration {
  const base = twoFamilyDeclaration()
  const declaration = {
    ...base,
    families: [{ ...base.families[0], tutorial: fixtureTutorial() }, base.families[1]],
  }

  const validated = validateDeclaration(declaration, { tutorialKinds: fixtureKinds })
  if (!validated.ok) {
    throw new Error(
      `the tutored ladder declaration does not validate: ${validated.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return validated.declaration
}

/** The prediction-shipping family's artifact for {@link twoFamilyDeclaration}. */
export function ladderPredictions(): PredictionArtifact {
  return {
    schemaVersion: '1.0.0',
    taskId: 'skin-screening-ladder',
    familyId: 'screen-net',
    categories: ['healthy', 'diseased'],
    configurations: {
      'depth1-photographsclinic': {
        history: [
          { step: 1, trainLoss: 0.9, valLoss: 0.95, trainAccuracy: 0.4, valAccuracy: 0.35 },
          { step: 2, trainLoss: 0.5, valLoss: 0.6, trainAccuracy: 0.8, valAccuracy: 0.7 },
        ],
        predictions: {
          training: { 'a-1': [0.9, 0.1] },
          // Deliberately the opposite of what the chain below says about the same images,
          // so a test can tell which family answered.
          pool: { 'a-1': [0.9, 0.1], 'a-2': [0.9, 0.1], 'a-3': [0.9, 0.1] },
        },
      },
    },
  }
}

/** The model-shipping family's file for `depth1-photographsclinic` of {@link twoFamilyDeclaration}. */
export function ladderModelDocument(): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    taskId: 'skin-screening-ladder',
    familyId: 'cut-chain',
    configurationId: 'depth1-photographsclinic',
    model: {
      splits: [{ feature: 'patchArea', threshold: 10, whenAbove: [0.1, 0.9] }],
      otherwise: [0.2, 0.8],
    },
  }
}

/** Measured features for the images {@link ladderPredictions} covers. */
export function ladderFeatures(): Readonly<Record<string, Readonly<Record<string, number>>>> {
  return {
    'a-1': { patchArea: 2, edgeRoughness: 1.1 },
    'a-2': { patchArea: 30, edgeRoughness: 2.4 },
    'a-3': { patchArea: 20, edgeRoughness: 1.8 },
  }
}

/** Image ids per split for {@link twoFamilyDeclaration}, as a pool manifest holds them. */
export const LADDER_IMAGES: Readonly<Record<string, readonly string[]>> = {
  training: ['a-1'],
  pool: ['a-1', 'a-2', 'a-3'],
}

/**
 * A `loadEntry` over both of {@link twoFamilyDeclaration}'s families.
 *
 * The prediction-shipping family is served from its artifact and the model-shipping one
 * goes through the real registry, so a screen test cannot be passed a model the app
 * itself would refuse — and the two answer differently about the same images, which is
 * what lets a test say which family a screen actually asked.
 */
export function ladderLoader(declaration: TaskDeclaration) {
  const predictions = ladderPredictions()
  return (familyId: string, configurationId: string): Promise<Loaded<FamilyEntry>> => {
    const family = declaration.families.find((candidate) => candidate.id === familyId)
    if (family === undefined) {
      return Promise.resolve({
        ok: false,
        issues: [
          {
            code: 'unknown-family',
            field: familyId,
            message: `Task "${declaration.id}" declares no model family "${familyId}".`,
          },
        ],
      })
    }

    if (family.ships === 'predictions') {
      const entry = predictions.configurations[configurationId]
      if (entry === undefined) {
        const issue = familyCoverageIssue(
          family,
          Object.keys(predictions.configurations),
          configurationId,
        )
        return Promise.resolve({ ok: false, issues: issue === undefined ? [] : [issue] })
      }
      return Promise.resolve({ ok: true, value: entryFromPredictions(entry) })
    }

    const resolved = resolveFamilyEntry({
      declaration,
      family,
      configurationId,
      document: { ...ladderModelDocument(), configurationId },
      imageIds: LADDER_IMAGES,
      features: ladderFeatures(),
    })
    return Promise.resolve(
      resolved.ok ? { ok: true, value: resolved.entry } : { ok: false, issues: resolved.issues },
    )
  }
}

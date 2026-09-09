/**
 * Resolving a configuration against a family: the registry, the two evaluators, and the
 * one shape they both yield.
 *
 * The worst failure available here is a silent one. Two families of one task can compose
 * the same identifier string, so a lookup that resolved it against the wrong family would
 * come back with a real, plausible distribution rather than an error — and a student
 * would be shown one model's harvest under another model's name. Most of what follows is
 * about making that impossible rather than unlikely.
 *
 * See openspec/changes/model-families/specs/model-families/spec.md.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  entryFromPredictions,
  evaluatorFor,
  familyCoverageIssue,
  predictWith,
  readFamilyStore,
  readModelFile,
  resolveFamilyEntry,
} from '../src/families/index.js'
import { chooseAction } from '../src/policy/index.js'
import { resolveArchitecture } from '../src/task/diagram.js'
import { scoreCrop, scoreEntry } from '../src/scoring/index.js'
import { lookupConfiguration } from '../src/task/artifact.js'
import { configurationId } from '../src/task/configId.js'
import { resolveConfiguration } from '../src/task/configuration.js'
import { UNTRAINED_CONFIGURATION } from '../src/task/artifactIndex.js'
import type { CategoryId } from '../src/task/types.js'
import {
  familyOf,
  SHIPS_MODEL,
  SHIPS_PREDICTIONS,
  TWO_FAMILY_IMAGES,
  TWO_FAMILY_SCHEMA,
  twoFamilyArtifact,
  twoFamilyFeatures,
  twoFamilyModelDocument,
  twoFamilyTask,
} from './helpers/families'

const task = twoFamilyTask()

/**
 * The two identifiers this file resolves, spelled once.
 *
 * Both families declare a dataset knob, which is declared last, so every identifier they
 * compose ends in the tier it was fitted on — `dataset-tiers`. Written as constants rather
 * than as twenty literals so the next part appended to an identifier moves one line.
 */
const DEPTH1 = 'depth1-datasetstarter'
const DEPTH2 = 'depth2-datasetstarter'
const network = familyOf(task, SHIPS_PREDICTIONS.id)
const chain = familyOf(task, SHIPS_MODEL.id)
const imageIds: Readonly<Record<string, readonly string[]>> = {
  training: [...TWO_FAMILY_IMAGES.training],
  pool: [...TWO_FAMILY_IMAGES.pool],
}

/** The identifier the family's own defaults compose. */
function defaultId(family = network): string {
  const resolved = resolveConfiguration(task, family, {})
  if (!resolved.ok) throw new Error('the defaults were meant to resolve')
  return configurationId(resolved.configuration)
}

/** One configuration of the prediction-shipping family, resolved through the registry. */
function resolveNetwork(document: unknown = artifactFile()) {
  return resolveFamilyEntry({
    declaration: task,
    family: network,
    configurationId: defaultId(),
    document,
    imageIds,
    index: networkIndex(),
  })
}

/** One configuration of the model-shipping family, resolved through the registry. */
function resolveChain(document: unknown = twoFamilyModelDocument()) {
  return resolveFamilyEntry({
    declaration: task,
    family: chain,
    configurationId: defaultId(chain),
    document,
    imageIds,
    features: twoFamilyFeatures(),
  })
}

/** The stored prediction file the network family's index would name. */
function artifactFile(familyId = network.id): Record<string, unknown> {
  const stored = twoFamilyArtifact().configurations[DEPTH1]
  if (stored === undefined) throw new Error(`the fixture must cover ${DEPTH1}`)
  return {
    schemaVersion: task.schemaVersion,
    taskId: task.id,
    familyId,
    configurationId: DEPTH1,
    history: stored.history,
    predictions: stored.predictions,
  }
}

/** The network family's index, as its store would be read. */
function networkIndex() {
  const read = readFamilyStore(rawIndex(), task, network, POOL)
  if (!read.ok) throw new Error(read.issues.map((issue) => issue.message).join(' '))
  return read.store.index
}

const POOL = { poolId: 'pools/two-family', schemaVersion: TWO_FAMILY_SCHEMA, seed: 7 }

function rawIndex(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: task.schemaVersion,
    taskId: task.id,
    familyId: network.id,
    categories: task.categories.map((category) => category.id),
    pool: POOL,
    encoding: { decimals: 3, sumTolerance: 0.0015 },
    configurations: {
      [DEPTH1]: {
        file: `${DEPTH1}.json`,
        knobs: { depth: 1, dataset: 'starter' },
        tier: 'starter',
        epochs: 2,
        seed: 1,
        pipeline: { revision: '0'.repeat(40), dirty: false },
        architecture: { blocks: 1, channels: [8], spatial: [64], parameters: 10 },
        shaping: [],
      },
    },
    ...over,
  }
}

/** The model index the model-shipping family's store is read from. */
function rawModelIndex(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: task.schemaVersion,
    taskId: task.id,
    familyId: chain.id,
    pool: POOL,
    configurations: { [DEPTH1]: { file: `${DEPTH1}.json`, tier: 'starter' } },
    ...over,
  }
}

describe('configuration identity is scoped to the family that composed it', () => {
  it('composes the same string from two families, and means two models by it', () => {
    expect(defaultId(network)).toBe(defaultId(chain))
    expect(defaultId(network)).toBe(DEPTH1)
  })

  it('resolves that string against each family’s own store and never the other’s', () => {
    const fromNetwork = resolveNetwork()
    const fromChain = resolveChain()

    expect(fromNetwork.ok && fromChain.ok).toBe(true)
    if (!fromNetwork.ok || !fromChain.ok) return

    // The fixture's two families disagree about every image on purpose, so a lookup that
    // had gone to the wrong store would be visible rather than merely possible.
    expect(fromNetwork.entry.distributionFor('pool', 'a-1')).not.toEqual(
      fromChain.entry.distributionFor('pool', 'a-1'),
    )
  })

  it('composes an identifier from one family’s knobs, whatever the others declare', () => {
    // The apple family's identifiers are the property the shipped artifacts rest on: a
    // task gaining families must add nothing to, and remove nothing from, any of them.
    const resolved = resolveConfiguration(task, network, { depth: 2 })
    if (!resolved.ok) throw new Error('depth 2 was meant to resolve')

    expect(configurationId(resolved.configuration)).toBe(DEPTH2)
    expect(resolved.configuration.familyId).toBe(network.id)
  })

  it('refuses a value another family permits but this one does not', () => {
    const resolved = resolveConfiguration(task, network, { depth: 9 })

    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.issues[0]?.code).toBe('knob-value-out-of-range')
  })
})

describe('an artifact says which family it belongs to', () => {
  it('loads when the recorded family is the one being resolved', () => {
    expect(readFamilyStore(rawIndex(), task, network, POOL).ok).toBe(true)
  })

  it('refuses an index recording no family, naming the omission', () => {
    const raw = rawIndex()
    delete raw.familyId

    const read = readFamilyStore(raw, task, network, POOL)

    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.issues.some((issue) => issue.code === 'artifact-family-missing')).toBe(true)
    expect(read.issues.map((issue) => issue.message).join(' ')).toContain('family')
  })

  it('refuses an index recording another family, naming both', () => {
    const read = readFamilyStore(rawIndex({ familyId: chain.id }), task, network, POOL)

    expect(read.ok).toBe(false)
    if (read.ok) return
    const message = read.issues.map((issue) => issue.message).join(' ')
    expect(message).toContain(chain.id)
    expect(message).toContain(network.id)
  })

  it('refuses a declaration pointed at another family’s artifact rather than answering', () => {
    // The mis-wiring this guards: a family whose declaration names the wrong directory.
    // Both families cover the same identifier, so the wrong file would resolve and would
    // be wrong.
    const resolved = resolveNetwork(artifactFile(chain.id))

    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.issues.some((issue) => issue.code === 'artifact-family-mismatch')).toBe(true)
  })

  it('refuses a lookup against the wrong family through the in-memory reader too', () => {
    const resolved = resolveConfiguration(task, network, {})
    if (!resolved.ok) throw new Error('the defaults were meant to resolve')

    const wrong = lookupConfiguration(task, chain, resolved.configuration, twoFamilyArtifact())

    expect(wrong.ok).toBe(false)
    if (wrong.ok) return
    expect(wrong.issues.some((issue) => issue.code === 'artifact-family-mismatch')).toBe(true)
  })

  it('refuses an in-memory artifact recording no family at all', () => {
    const resolved = resolveConfiguration(task, network, {})
    if (!resolved.ok) throw new Error('the defaults were meant to resolve')
    const artifact = { ...twoFamilyArtifact() } as Record<string, unknown>
    delete artifact.familyId

    const wrong = lookupConfiguration(
      task,
      network,
      resolved.configuration,
      artifact as never,
    )

    expect(wrong.ok).toBe(false)
    if (wrong.ok) return
    expect(wrong.issues.some((issue) => issue.code === 'artifact-family-missing')).toBe(true)
  })
})

describe('the registry chooses an evaluator from what a family ships', () => {
  it('gives the two shipped forms two different evaluators', () => {
    expect(evaluatorFor(network)).not.toBe(evaluatorFor(chain))
  })

  it('gives two families of the same shipped form the same evaluator', () => {
    // Nothing branches on a family id: a rung added to the ladder is a declaration, and
    // an evaluator chosen by id would make it a code change.
    const renamed = { ...chain, id: 'another-chain' }

    expect(evaluatorFor(renamed)).toBe(evaluatorFor(chain))
  })

  it('reads a family’s index through the reader its shipped form calls for', () => {
    const predictions = readFamilyStore(rawIndex(), task, network, POOL)
    const models = readFamilyStore(rawModelIndex(), task, chain, POOL)

    expect(predictions.ok && models.ok).toBe(true)
    if (!predictions.ok || !models.ok) return
    expect(predictions.store.coverage).toEqual([DEPTH1])
    expect(models.store.coverage).toEqual([DEPTH1])
    // Only the prediction-shipping family has an artifact index to read against.
    expect(predictions.store.index).toBeDefined()
    expect(models.store.index).toBeUndefined()
  })
})

describe('what a resolution yields', () => {
  it('carries the history and the distributions of one configuration together', () => {
    const resolved = resolveNetwork()

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.entry.history).toHaveLength(2)
    expect(resolved.entry.imageIdsIn('pool')).toEqual([...TWO_FAMILY_IMAGES.pool])
    expect(resolved.entry.distributionFor('pool', 'a-1')).toEqual([0.9, 0.05, 0.05])
  })

  it('resolves a family that records no history, and reports no failure for it', () => {
    const resolved = resolveChain()

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.entry.history).toBeUndefined()
    expect(resolved.entry.distributionFor('pool', 'a-2')).toBeDefined()
  })

  it('yields a valid distribution for every image of both splits, fetching no table', () => {
    const resolved = resolveChain()
    if (!resolved.ok) throw new Error('the chain was meant to resolve')

    for (const split of ['training', 'pool'] as const) {
      expect(resolved.entry.imageIdsIn(split)).toEqual([...TWO_FAMILY_IMAGES[split]])
      for (const imageId of resolved.entry.imageIdsIn(split)) {
        const distribution = resolved.entry.distributionFor(split, imageId)
        expect(distribution, `${split}/${imageId}`).toHaveLength(task.categories.length)
        expect(
          distribution?.reduce((sum, value) => sum + value, 0),
          `${split}/${imageId}`,
        ).toBeCloseTo(1, 9)
      }
    }
  })

  it('applies the shipped model to the numbers measured of each image', () => {
    const document = readModelFile(twoFamilyModelDocument(), task, chain, DEPTH1)
    if (!document.ok) throw new Error(document.issues.map((issue) => issue.message).join(' '))
    const features = twoFamilyFeatures()

    // A red one is above the threshold and a green one is not, so the two exits differ.
    expect(predictWith(document.document.model, features['a-1'] ?? {})).toEqual([0.05, 0.05, 0.9])
    expect(predictWith(document.document.model, features['a-2'] ?? {})).toEqual([0.05, 0.9, 0.05])
  })

  it('yields no action, no label and no outcome', () => {
    const resolved = resolveChain()
    if (!resolved.ok) throw new Error('the chain was meant to resolve')
    const distribution = resolved.entry.distributionFor('pool', 'a-1')
    if (distribution === undefined) throw new Error('a-1 was meant to resolve')

    // What comes out is a distribution over the declared categories, and turning one into
    // an action stays the policy's live computation.
    expect(distribution).toHaveLength(task.categories.length)
    expect(JSON.stringify(resolved.entry)).not.toContain('action')
    expect(task.actions.map((action) => action.id)).toContain(chooseAction(task, distribution))
  })
})

describe('a resolution refuses rather than answering approximately', () => {
  it('refuses a configuration the family has no model for, naming both', () => {
    const issue = familyCoverageIssue(chain, [DEPTH1], DEPTH2)

    expect(issue?.code).toBe(UNTRAINED_CONFIGURATION)
    expect(issue?.message).toContain(DEPTH2)
    expect(issue?.message).toContain(chain.id)
  })

  it('says nothing about a configuration the family does cover', () => {
    expect(familyCoverageIssue(chain, [DEPTH1], DEPTH1)).toBeUndefined()
  })

  it('refuses a shipped model whose leaf is not a distribution, naming where', () => {
    const broken = twoFamilyModelDocument({
      model: {
        splits: [{ feature: 'redness', threshold: 0.5, whenAbove: [0.5, 0.5, 0.5] }],
        otherwise: [0.05, 0.9, 0.05],
      },
    })

    const read = readModelFile(broken, task, chain, DEPTH1)

    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.issues.some((issue) => issue.code === 'malformed-distribution')).toBe(true)
    expect(read.issues.map((issue) => issue.field).join(' ')).toContain('whenAbove')
  })

  it('refuses a shipped model splitting on a number the task does not measure', () => {
    const broken = twoFamilyModelDocument({
      model: {
        splits: [{ feature: 'ripeness', threshold: 0.5, whenAbove: [0.05, 0.05, 0.9] }],
        otherwise: [0.05, 0.9, 0.05],
      },
    })

    const read = readModelFile(broken, task, chain, DEPTH1)

    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.issues.some((issue) => issue.code === 'unknown-feature')).toBe(true)
    expect(read.issues.map((issue) => issue.message).join(' ')).toContain('"ripeness"')
  })

  it('names the image and the cause when a distribution reaching the scoring is unusable', () => {
    const stored = twoFamilyArtifact().configurations[DEPTH1]
    if (stored === undefined) throw new Error(`the fixture must cover ${DEPTH1}`)
    const entry = entryFromPredictions({
      history: stored.history,
      predictions: {
        training: stored.predictions.training,
        pool: { ...stored.predictions.pool, 'a-1': [0.5, 0.5, 0.5] },
      },
    })

    const scored = scoreCrop(task, DEPTH1, entry, [{ imageId: 'a-1', category: 'red' }])

    expect(scored.ok).toBe(false)
    if (scored.ok) return
    expect(scored.issues[0]?.code).toBe('malformed-distribution')
    expect(scored.issues[0]?.field).toBe('a-1')
  })
})

describe('the scoring reads a family entry through its accessors', () => {
  const truth: Readonly<Record<string, CategoryId>> = { 'a-1': 'red', 'a-2': 'green' }

  it('scores a split of a model-shipping family with no prediction table in sight', () => {
    const resolved = resolveChain()
    if (!resolved.ok) throw new Error('the chain was meant to resolve')

    const scored = scoreEntry(task, DEPTH1, resolved.entry, 'pool', truth)

    expect(scored.ok).toBe(true)
    if (!scored.ok) return
    expect(scored.outcome.evaluated).toBe(TWO_FAMILY_IMAGES.pool.length)
  })

  it('scores the same crop differently for the two families, as their models differ', () => {
    const fromNetwork = resolveNetwork()
    const fromChain = resolveChain()
    if (!fromNetwork.ok || !fromChain.ok) throw new Error('both were meant to resolve')
    const pieces = [{ imageId: 'a-1', category: 'red' }, { imageId: 'a-2', category: 'green' }]

    const network = scoreCrop(task, DEPTH1, fromNetwork.entry, pieces)
    const chain = scoreCrop(task, DEPTH1, fromChain.entry, pieces)

    expect(network.ok && chain.ok).toBe(true)
    if (!network.ok || !chain.ok) return
    expect(network.outcome.earnings).not.toBe(chain.outcome.earnings)
  })
})

/**
 * Where a distribution becomes a decision, and where it does not.
 *
 * The proposal turns on this: every *family* yields a distribution, and the farm's own
 * hands remain the one action-producing labour, on the path they already have. Both
 * halves are asserted structurally, because both are claims about which module does what
 * rather than about any one answer it gives.
 */
describe('turning a distribution into an action stays where it was', () => {
  const repoRoot = process.cwd()

  function sourcesUnder(directory: string): { path: string; text: string }[] {
    const found: { path: string; text: string }[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (path.endsWith('.ts')) found.push({ path, text: readFileSync(path, 'utf8') })
      }
    }
    walk(join(repoRoot, directory))
    return found
  }

  it('happens in src/policy/ and nowhere else in the family modules', () => {
    // A family that chose an action would have decided something the declared policy is
    // there to decide, and two places deciding it is how they come to disagree.
    for (const { path, text } of sourcesUnder('src/families')) {
      expect(text, `${path} chooses an action`).not.toContain('chooseAction')
    }
    expect(sourcesUnder('src/families').length).toBeGreaterThan(2)
    expect(readFileSync(join(repoRoot, 'src/policy/index.ts'), 'utf8')).toContain(
      'export function chooseAction',
    )
  })

  it('leaves the farm’s hands scoring actions on their own path', () => {
    // The hands never produced a distribution and still do not: `src/sorting/tally.ts`
    // scores the actions a student took, and this change gave it nothing to do.
    const tally = readFileSync(join(repoRoot, 'src/sorting/tally.ts'), 'utf8')

    expect(tally).not.toContain('chooseAction')
    expect(tally).not.toContain('families')
    expect(tally).toContain('action')
  })

  it('leaves the decision policy itself untouched by families', () => {
    for (const { path, text } of sourcesUnder('src/policy')) {
      expect(text, `${path} knows about families`).not.toContain('family')
      expect(text, `${path} knows about families`).not.toContain('Family')
    }
  })

  it('yields no action, label or outcome from either evaluator', () => {
    for (const { path, text } of sourcesUnder('src/families')) {
      for (const forbidden of ['ActionId', 'trueCategory', 'earnings']) {
        expect(text, `${path} yields ${forbidden}`).not.toContain(forbidden)
      }
    }
  })
})

/**
 * A family's drawing is resolvable from that family's declaration and knob values alone.
 *
 * `network-diagram` anticipated this generalization, and the change owes a demonstration
 * rather than an assumption: no task running, no crop, no selected family, no workshop.
 */
describe('each family’s drawing is separately mountable', () => {
  it('resolves from a family declaration and a set of values and nothing else', () => {
    const drawn = {
      ...network,
      diagram: {
        kind: 'cnn',
        blocksKnob: 'depth',
        channelsKnob: 'depth',
        inputSize: 128,
        channelsShown: { '1': 2, '2': 3 },
      },
    } as const

    const architecture = resolveArchitecture(task, drawn, { depth: 2 })

    expect(architecture?.kind).toBe('cnn')
    expect(architecture?.kind === 'cnn' ? architecture.blocks : []).toHaveLength(2)
  })

  it('draws nothing for a family that declares no architecture, and guesses none', () => {
    expect(chain.diagram).toBeUndefined()
    expect(resolveArchitecture(task, chain, { depth: 1 })).toBeUndefined()
  })
})

/**
 * The tree evaluated over the pool that ships, and over nothing else.
 *
 * Two obligations, and only one of them is about arithmetic.
 *
 * The first is coverage: every one of the 1 200 images the manifest declares reaches
 * exactly one leaf, in the browsable training split and in the evaluation pool alike.
 * That is `prediction-artifacts`' completeness requirement in the structural form a
 * stored model takes it, checked here against the real manifest rather than a fixture,
 * because a fixture of two apples would pass whatever the trees said.
 *
 * The second is what the family may read. It reads the numbers the pool tooling
 * measured, once, where a reviewer could see the measurement — and it reads nothing
 * else: not a pixel, not an atlas, and above all not a generation attribute. The
 * attributes are the answer sheet. `hue` and `wormVisibility` are what the generator
 * used to *make* an apple red or wormy, so a model allowed at them would score
 * beautifully and would have learned nothing. That refusal is asserted structurally,
 * from what the modules can reach, rather than left to a convention somebody keeps.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { predictWith, readModelFile, resolveFamilyEntry } from '../src/families/index.js'
import type { ShippedModel } from '../src/families/index.js'
import { vectorOf } from '../src/features/index.js'
import { readPool } from '../src/pool/index.js'
import { REQUIRED_ATTRIBUTES } from '../src/pool/index.js'
import { chooseAction } from '../src/policy/index.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const apple = appleDeclaration()
const manifest = committedManifest()

const family = apple.families.find((candidate) => candidate.ships === 'model')
if (family === undefined) throw new Error('the apple task declares no model-shipping family')

const pool = (() => {
  const result = readPool(manifest as unknown, apple)
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return result.pool
})()

/** Image ids per split, as the manifest itself enumerates them. */
const imageIds: Readonly<Record<string, readonly string[]>> = {
  training: Object.keys(manifest.images).filter((id) => manifest.images[id]?.split === 'training'),
  pool: Object.keys(manifest.images).filter((id) => manifest.images[id]?.split === 'pool'),
}

/** The measured vectors, exactly as the loader hands them to an evaluator. */
const features = Object.fromEntries(
  Object.keys(manifest.images).map((id) => {
    const vector = vectorOf(apple, pool, id)
    if (vector === undefined) throw new Error(`the manifest records no full vector for ${id}`)
    return [id, vector]
  }),
)

function read<T>(name: string): T {
  return JSON.parse(readFileSync(join(repoRoot, family!.models ?? '', name), 'utf8')) as T
}

const index = read<{ readonly configurations: Readonly<Record<string, { readonly file: string }>> }>(
  'index.json',
)

function treeOf(configurationId: string): ShippedModel {
  const record = index.configurations[configurationId]
  if (record === undefined) throw new Error(`no such configuration: ${configurationId}`)
  const result = readModelFile(read(record.file), apple, family!, configurationId)
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return result.document.model
}

describe('every manifest image of both splits reaches exactly one leaf', () => {
  for (const configurationId of Object.keys(index.configurations)) {
    it(`resolves ${configurationId} over the whole pool`, () => {
      const record = index.configurations[configurationId]
      const resolved = resolveFamilyEntry({
        declaration: apple,
        family: family!,
        configurationId,
        document: read(record?.file ?? ''),
        imageIds,
        features,
      })
      if (!resolved.ok) throw new Error(resolved.issues.map((issue) => issue.message).join(' '))

      let answered = 0
      for (const [split, ids] of Object.entries(imageIds)) {
        for (const imageId of ids) {
          const distribution = resolved.entry.distributionFor(split as 'training' | 'pool', imageId)
          if (distribution === undefined) throw new Error(`${split}/${imageId} reached no leaf`)
          expect(distribution).toHaveLength(apple.categories.length)
          answered += 1
        }
      }
      expect(answered).toBe(Object.keys(manifest.images).length)
    })
  }

  it('answers with one of the tree’s own leaves, and never with something in between', () => {
    // "Exactly one leaf" is stronger than "some distribution": an evaluator that
    // averaged two branches, or interpolated, would satisfy the count above and be a
    // different model from the one drawn on screen.
    const configurationId = Object.keys(index.configurations)[0] ?? ''
    const model = treeOf(configurationId)
    const leaves = [...model.splits.map((split) => split.whenAbove), model.otherwise]

    for (const imageId of Object.keys(manifest.images)) {
      const answer = predictWith(model, features[imageId] ?? {})
      expect(leaves.includes(answer), imageId).toBe(true)
    }
  })

  it('gives the same apple the same answer every time it is asked', () => {
    const model = treeOf(Object.keys(index.configurations)[0] ?? '')
    for (const imageId of Object.keys(manifest.images).slice(0, 50)) {
      const first = predictWith(model, features[imageId] ?? {})
      expect(predictWith(model, features[imageId] ?? {})).toBe(first)
    }
  })
})

describe('the family reads measured features and nothing else', () => {
  const sources = readdirSync(join(repoRoot, 'src/families'))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({
      name,
      code: readFileSync(join(repoRoot, 'src/families', name), 'utf8')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n'),
    }))

  it('has the modules to look at', () => {
    expect(sources.map((source) => source.name)).toContain('model.ts')
  })

  it('never names the record the generation attributes live under', () => {
    for (const source of sources) {
      expect(source.code, source.name).not.toContain('attributes')
    }
  })

  it('imports the feature reader and nothing that could reach an attribute', () => {
    for (const source of sources) {
      const imports = [...source.code.matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? '')
      for (const specifier of imports) {
        expect(specifier, `${source.name} imports ${specifier}`).not.toContain('tools/')
        expect(specifier, `${source.name} imports ${specifier}`).not.toContain('pool/')
      }
    }
  })

  it('is handed vectors carrying the declared features and no attribute', () => {
    // What the loader passes an evaluator is this shape. An attribute that never enters
    // it cannot be read by anything downstream, however the evaluator is later written.
    const declared = apple.features.map((feature) => feature.id).sort()
    for (const vector of Object.values(features)) {
      expect(Object.keys(vector).sort()).toEqual(declared)
    }
  })

  it('refuses a tree naming a generation attribute the task does not measure', () => {
    const attributes = REQUIRED_ATTRIBUTES.filter(
      (attribute) => !apple.features.some((feature) => feature.id === attribute),
    )
    // `hue`, `gloss`, `lighting` and `wormVisibility`: the numbers the generator used to
    // decide what each apple was. A tree cutting on one would be reading the answer.
    expect(attributes.length).toBeGreaterThan(0)

    for (const attribute of attributes) {
      const configurationId = Object.keys(index.configurations)[0] ?? ''
      const document = read<Record<string, any>>(
        index.configurations[configurationId]?.file ?? '',
      )
      document.model.splits[0].feature = attribute

      const result = readModelFile(document, apple, family!, configurationId)
      if (result.ok) throw new Error(`a tree cutting on ${attribute} should be refused`)
      expect(result.issues.some((issue) => issue.code === 'unknown-feature'), attribute).toBe(true)
      expect(result.issues.map((issue) => issue.message).join(' ')).toContain(attribute)
    }
  })

  it('reads the measured value where a feature and an attribute share a name', () => {
    // `roundness` is both: the shape the generator asked for, and the shape the outline
    // was measured to have. They differ per apple, and the family must read the second.
    const declared = apple.features.some((feature) => feature.id === 'roundness')
    expect(declared && REQUIRED_ATTRIBUTES.includes('roundness')).toBe(true)

    const disagreeing = Object.keys(manifest.images).filter(
      (id) => manifest.images[id]?.attributes.roundness !== manifest.images[id]?.features.roundness,
    )
    expect(disagreeing.length).toBeGreaterThan(0)
    for (const id of disagreeing.slice(0, 20)) {
      expect(features[id]?.roundness).toBe(manifest.images[id]?.features.roundness)
    }
  })
})

describe('the leaf says how likely, and the policy says what to do', () => {
  it('produces the action by applying the declared policy to the leaf, not by reading one', () => {
    const model = treeOf(Object.keys(index.configurations)[0] ?? '')
    const actions = new Set(apple.actions.map((action) => action.id))

    for (const imageId of Object.keys(manifest.images).slice(0, 100)) {
      const leaf = predictWith(model, features[imageId] ?? {})
      const action = chooseAction(apple, leaf)
      expect(actions.has(action), imageId).toBe(true)
    }
  })

  it('changes what the robot does when the policy changes, with the tree untouched', () => {
    // The division the family is under: the tree reports how sure it is and the policy
    // decides what to do about it. If a leaf carried the action, this could not be true
    // — the same leaves, read under a different declared rule, would still sort the
    // same way. The rule here demands a certainty no leaf of a smoothed tree reaches,
    // so every apple falls to the declared fallback.
    const model = treeOf(Object.keys(index.configurations)[0] ?? '')
    const demanding = {
      ...apple,
      policy: {
        kind: 'threshold' as const,
        thresholds: Object.fromEntries(apple.categories.map((category) => [category.id, 0.99])),
        fallbackAction: 'discard',
        priority: apple.categories.map((category) => category.id),
      },
    }

    const byHighest = Object.keys(manifest.images).map((id) =>
      chooseAction(apple, predictWith(model, features[id] ?? {})),
    )
    const byThreshold = Object.keys(manifest.images).map((id) =>
      chooseAction(demanding, predictWith(model, features[id] ?? {})),
    )

    expect(new Set(byHighest).size).toBeGreaterThan(1)
    expect(new Set(byThreshold)).toEqual(new Set(['discard']))
    expect(byHighest).not.toEqual(byThreshold)
  })
})

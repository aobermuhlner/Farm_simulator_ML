/**
 * Completeness, in the form a stored model takes it.
 *
 * `prediction-artifacts` asks one thing of every covered configuration: every manifest
 * image of both splits yields exactly one outcome, and a configuration that cannot
 * manage it refuses rather than being scored on the images it happens to resolve. An
 * artifact storing distributions discharges that by enumeration, which
 * `artifact-index.test.ts` already holds it to. An artifact storing a model has no set
 * to enumerate and discharges it structurally, which is what is asserted here.
 *
 * "Exactly one" has two halves and they fail differently. *Not more than one* is free
 * in the shape a shipped model takes — a chain answers with the first question an image
 * says yes to, and never with two — and is asserted anyway, because it is free only for
 * as long as the shape stays a chain. *Not fewer than one* is not free: it needs the
 * numbers the questions ask about to be there, and it needs the chain to end in a leaf.
 */

import { describe, expect, it } from 'vitest'
import { predictWith, readModelFile, resolveFamilyEntry } from '../src/families/index.js'
import type { ShippedModel } from '../src/families/index.js'
import {
  familyOf,
  SHIPS_MODEL,
  TWO_FAMILY_IMAGES,
  twoFamilyFeatures,
  twoFamilyModelDocument,
  twoFamilyTask,
} from './helpers/families'

const task = twoFamilyTask()
const family = familyOf(task, SHIPS_MODEL.id)
const CONFIGURATION = 'depth1-datasetstarter'
const features = twoFamilyFeatures()

function resolve(document: Record<string, unknown>) {
  return resolveFamilyEntry({
    declaration: task,
    family,
    configurationId: CONFIGURATION,
    document,
    imageIds: TWO_FAMILY_IMAGES,
    features,
  })
}

/** Two questions that both claim the same apple, to see which answer comes back. */
const OVERLAPPING: ShippedModel = {
  splits: [
    { feature: 'redness', threshold: 0.5, whenAbove: [1, 0, 0] },
    { feature: 'redness', threshold: 0.2, whenAbove: [0, 1, 0] },
  ],
  otherwise: [0, 0, 1],
}

describe('a stored model spans the pool without enumerating it', () => {
  it('reaches exactly one outcome for every manifest image of every split', () => {
    const resolved = resolve(twoFamilyModelDocument())
    if (!resolved.ok) throw new Error(resolved.issues.map((issue) => issue.message).join(' '))

    for (const [split, ids] of Object.entries(TWO_FAMILY_IMAGES)) {
      for (const imageId of ids) {
        const distribution = resolved.entry.distributionFor(split as 'training' | 'pool', imageId)
        expect(distribution, `${split}/${imageId}`).toBeDefined()
        expect(distribution, `${split}/${imageId}`).toHaveLength(task.categories.length)
      }
    }
  })

  it('answers an image claimed by two questions with the first of them, never with both', () => {
    const answer = predictWith(OVERLAPPING, features['a-1'] ?? {})
    expect(answer).toEqual([1, 0, 0])
    expect(predictWith(OVERLAPPING, features['a-1'] ?? {})).toBe(answer)
  })

  it('refuses a model whose chain ends in no leaf, which would leave an image unanswered', () => {
    const document = twoFamilyModelDocument({
      model: { splits: [{ feature: 'redness', threshold: 0.5, whenAbove: [1, 0, 0] }] },
    })
    const read = readModelFile(document, task, family, CONFIGURATION)
    if (read.ok) throw new Error('expected the model to be refused')
    // Its own refusal rather than a malformed leaf: "this model does not answer" is a
    // different defect from "this model answers with something that is not a
    // distribution", and an author reading the message has to be able to tell them apart.
    expect(read.issues.some((issue) => issue.code === 'non-terminating-model')).toBe(true)
    expect(read.issues.map((issue) => issue.message).join(' ')).toContain(CONFIGURATION)
  })

  it('refuses a model asking about a number the task does not measure', () => {
    const document = twoFamilyModelDocument({
      model: {
        splits: [{ feature: 'wormVisibility', threshold: 0.5, whenAbove: [1, 0, 0] }],
        otherwise: [0, 0, 1],
      },
    })
    const read = readModelFile(document, task, family, CONFIGURATION)
    if (read.ok) throw new Error('expected the model to be refused')
    expect(read.issues.some((issue) => issue.code === 'unknown-feature')).toBe(true)
    expect(read.issues.map((issue) => issue.message).join(' ')).toContain('wormVisibility')
  })

  it('scores nothing at all when it cannot span the pool', () => {
    const gap = { ...features }
    delete (gap as Record<string, unknown>)['a-2']

    const resolved = resolveFamilyEntry({
      declaration: task,
      family,
      configurationId: CONFIGURATION,
      document: twoFamilyModelDocument(),
      imageIds: TWO_FAMILY_IMAGES,
      features: gap,
    })
    // Refused whole. `a-1` resolves perfectly well and is not scored regardless, which
    // is the difference between refusing and shrinking the run.
    expect(resolved.ok).toBe(false)
  })
})

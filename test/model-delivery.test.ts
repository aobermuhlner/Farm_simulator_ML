/**
 * A family fitted on recorded values reads no delivered image.
 *
 * `prediction-artifacts` scopes its pixel-delivery requirement in two halves. A pipeline
 * that reads pixels resolves each image's declared region inside the delivered resource
 * its manifest entry names. A pipeline that reads the values the manifest *records*
 * reads those instead and opens no delivered resource at all — its chain of custody to
 * the pixels is the measurement the pool tooling already performed, once, where it can
 * be reviewed.
 *
 * Both halves are asserted here for the model-shipping side: structurally, that the
 * evaluator cannot reach an atlas; and behaviourally, that a value the manifest does not
 * declare for every image of the split being read is refused rather than worked around.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { modelSpanIssues, resolveFamilyEntry } from '../src/families/index.js'
import {
  familyOf,
  SHIPS_MODEL,
  TWO_FAMILY_IMAGES,
  twoFamilyFeatures,
  twoFamilyModelDocument,
  twoFamilyTask,
} from './helpers/families'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const task = twoFamilyTask()
const family = familyOf(task, SHIPS_MODEL.id)
const CONFIGURATION = 'depth1-datasetstarter'

function resolve(
  document: Record<string, unknown>,
  features: Readonly<Record<string, Readonly<Record<string, number>>>>,
) {
  return resolveFamilyEntry({
    declaration: task,
    family,
    configurationId: CONFIGURATION,
    document,
    imageIds: TWO_FAMILY_IMAGES,
    features,
  })
}

describe('the model evaluator opens no delivered resource', () => {
  const sources = readdirSync(`${repoRoot}src/families`)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, text: readFileSync(`${repoRoot}src/families/${name}`, 'utf8') }))

  it('has the evaluator to look at', () => {
    expect(sources.map((source) => source.name)).toContain('model.ts')
  })

  it('imports nothing from the pool tools, where the pixels are', () => {
    for (const source of sources) {
      const imports = [...source.text.matchAll(/from '([^']+)'/g)].map((match) => match[1])
      for (const specifier of imports) {
        expect(specifier, `src/families/${source.name} imports ${specifier}`).not.toContain('tools/')
      }
    }
  })

  it('names no atlas, no pixel and no rasterizer', () => {
    // Comments are stripped first. Saying in prose that a module reads no atlas is the
    // opposite of reaching for one, and this rule has to leave room to say it.
    for (const source of sources) {
      const code = source.text
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n')
      for (const forbidden of ['atlas', 'pixel', 'Resvg', 'rgba', 'canvas', 'region', 'fetch(']) {
        expect(
          code.toLowerCase(),
          `src/families/${source.name} names ${forbidden}`,
        ).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  it('reads its numbers from the vectors it is handed, and answers from them', () => {
    const resolved = resolve(twoFamilyModelDocument(), twoFamilyFeatures())
    if (!resolved.ok) throw new Error(resolved.issues.map((issue) => issue.message).join(' '))

    // a-1 measures redness 0.9, above the single split's 0.5; a-2 measures 0.1, below it.
    expect(resolved.entry.distributionFor('pool', 'a-1')).toEqual([0.05, 0.05, 0.9])
    expect(resolved.entry.distributionFor('pool', 'a-2')).toEqual([0.05, 0.9, 0.05])
  })
})

describe('a value the manifest does not declare for every image refuses', () => {
  it('refuses when one image of a split carries no vector at all', () => {
    const features = twoFamilyFeatures()
    const missing = { ...features }
    delete (missing as Record<string, unknown>)['a-2']

    const resolved = resolve(twoFamilyModelDocument(), missing)
    if (resolved.ok) throw new Error('expected the configuration to be refused')
    expect(resolved.issues.some((issue) => issue.code === 'incomplete-configuration')).toBe(true)
    expect(resolved.issues.map((issue) => issue.message).join(' ')).toContain('a-2')
  })

  it('refuses when the value the model asks about is missing for one image', () => {
    const features = twoFamilyFeatures()
    const gap = {
      ...features,
      'a-2': Object.fromEntries(
        Object.entries(features['a-2'] ?? {}).filter(([id]) => id !== 'redness'),
      ),
    }

    const resolved = resolve(twoFamilyModelDocument(), gap)
    if (resolved.ok) throw new Error('expected the configuration to be refused')
    expect(resolved.issues.some((issue) => issue.code === 'incomplete-configuration')).toBe(true)
    const message = resolved.issues.map((issue) => issue.message).join(' ')
    expect(message).toContain('redness')
    expect(message).toContain('a-2')
  })

  it('does not mind a value the manifest omits that the model never asks about', () => {
    // Holding a two-question model to the whole declared feature list would refuse a
    // perfectly good model over a number it never reads.
    const features = twoFamilyFeatures()
    const gap = {
      ...features,
      'a-2': Object.fromEntries(
        Object.entries(features['a-2'] ?? {}).filter(([id]) => id !== 'textureVar'),
      ),
    }

    expect(resolve(twoFamilyModelDocument(), gap).ok).toBe(true)
  })

  it('refuses a value that is present but not a finite number', () => {
    const features = twoFamilyFeatures()
    const broken = { ...features, 'a-2': { ...features['a-2'], redness: Number.NaN } }

    expect(
      modelSpanIssues(
        { splits: [{ feature: 'redness', threshold: 0.5, whenAbove: [1, 0, 0] }], otherwise: [0, 1, 0] },
        CONFIGURATION,
        TWO_FAMILY_IMAGES,
        broken,
      ).map((issue) => issue.code),
    ).toEqual(['incomplete-configuration'])
  })
})

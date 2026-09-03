import { describe, expect, it } from 'vitest'
import { lookupConfiguration } from '../src/task/artifact.js'
import { configurationId } from '../src/task/configId.js'
import { defaultConfiguration, resolveConfiguration } from '../src/task/configuration.js'
import {
  applePredictions,
  appleDeclaration,
  OVER_REGULARIZED,
  OVER_SELECTIVE,
} from './helpers/apple'

const apple = appleDeclaration()
const artifact = applePredictions()

function idFor(requested: Record<string, unknown>): string {
  const result = resolveConfiguration(apple, requested)
  if (!result.ok) throw new Error(`expected ${JSON.stringify(requested)} to resolve`)
  return configurationId(result.configuration)
}

describe('deterministic configuration identity', () => {
  it('derives a readable identifier from knob ids and values', () => {
    expect(idFor(OVER_SELECTIVE)).toBe('blocks4-channels32-regularization0-dropout0')
  })

  it('yields the same identifier no matter what order the knobs were set in', () => {
    const first = idFor({ blocks: 3, channels: 16, regularization: 1, dropout: 0.2 })
    const second = idFor({ dropout: 0.2, regularization: 1, channels: 16, blocks: 3 })
    const third = idFor({ channels: 16, dropout: 0.2, blocks: 3, regularization: 1 })
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('is stable across repeated derivation, with no session or machine input', () => {
    const ids = new Set(Array.from({ length: 25 }, () => idFor(OVER_REGULARIZED)))
    expect(ids.size).toBe(1)
  })

  it('gives different knob values different identifiers', () => {
    expect(idFor(OVER_REGULARIZED)).not.toBe(idFor(OVER_SELECTIVE))
  })

  it('distinguishes every configuration in the cross-product', () => {
    const ids = new Set<string>()
    for (const blocks of [2, 3, 4]) {
      for (const channels of [8, 16, 32]) {
        for (const regularization of [0, 1, 2, 3]) {
          for (const dropout of [0, 0.2, 0.5]) {
            ids.add(idFor({ blocks, channels, regularization, dropout }))
          }
        }
      }
    }
    expect(ids.size).toBe(108)
  })

  it('identifies the default configuration too', () => {
    expect(configurationId(defaultConfiguration(apple))).toBe(
      'blocks2-channels16-regularization1-dropout0',
    )
  })
})

describe('artifact lookup by configuration identity', () => {
  function lookup(requested: Record<string, unknown>) {
    const resolved = resolveConfiguration(apple, requested)
    if (!resolved.ok) throw new Error('expected the configuration to resolve')
    return lookupConfiguration(apple, resolved.configuration, artifact)
  }

  it('selects the entry keyed by the configuration identifier', () => {
    const result = lookup(OVER_REGULARIZED)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.configurationId).toBe('blocks2-channels8-regularization3-dropout0.5')
  })

  it('returns predictions and training history from one and the same configuration', () => {
    const result = lookup(OVER_SELECTIVE)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { entry, configurationId: id } = result
    expect(artifact.configurations[id]?.history).toBe(entry.history)
    expect(artifact.configurations[id]?.predictions).toBe(entry.predictions)
    expect(entry.history.length).toBeGreaterThan(0)
  })

  it('refuses a configuration the artifact has no entry for, naming it', () => {
    const result = lookup({ blocks: 3, channels: 8, regularization: 2, dropout: 0.2 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('unknown-configuration')
    expect(result.issues[0]?.message).toContain('blocks3-channels8-regularization2-dropout0.2')
  })

  it('refuses on a schema version mismatch before reading any rows', () => {
    const resolved = resolveConfiguration(apple, OVER_REGULARIZED)
    if (!resolved.ok) throw new Error('expected the configuration to resolve')
    const stale = { ...artifact, schemaVersion: '2.0.0' }
    const result = lookupConfiguration(apple, resolved.configuration, stale)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.code)).toContain('schema-version-mismatch')
  })

  it('refuses an artifact that indexes probabilities by a different category order', () => {
    const resolved = resolveConfiguration(apple, OVER_REGULARIZED)
    if (!resolved.ok) throw new Error('expected the configuration to resolve')
    const reordered = { ...artifact, categories: ['wormy', 'green', 'red'] }
    const result = lookupConfiguration(apple, resolved.configuration, reordered)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.code)).toContain('artifact-category-mismatch')
  })

  it('refuses an artifact belonging to a different task', () => {
    const resolved = resolveConfiguration(apple, OVER_REGULARIZED)
    if (!resolved.ok) throw new Error('expected the configuration to resolve')
    const other = { ...artifact, taskId: 'skin-screening' }
    const result = lookupConfiguration(apple, resolved.configuration, other)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.code)).toContain('artifact-task-mismatch')
  })
})

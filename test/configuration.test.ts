import { describe, expect, it } from 'vitest'
import {
  defaultConfiguration,
  resolveConfiguration,
} from '../src/task/configuration.js'
import { validateDeclaration } from '../src/task/validate.js'
import { checkArtifactVersion, SCHEMA_VERSION_MISMATCH } from '../src/task/version.js'
import { loadRawDeclaration } from './helpers/load-raw'

const validated = validateDeclaration(loadRawDeclaration('apple-harvest'))
if (!validated.ok) throw new Error('the shipped apple declaration must validate')
const apple = validated.declaration

describe('knob value validation', () => {
  it('resolves a configuration whose values the declaration permits', () => {
    const result = resolveConfiguration(apple, {
      blocks: 4,
      channels: 32,
      regularization: 2,
      dropout: 0.2,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a choice value that is not among the knob allowed values', () => {
    const result = resolveConfiguration(apple, { blocks: 5 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.field === 'blocks')
    expect(issue?.code).toBe('knob-value-out-of-range')
    expect(issue?.message).toContain('2, 3, 4')
  })

  it('rejects a slider value that sits off the declared step', () => {
    const result = resolveConfiguration(apple, { regularization: 1.5 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.find((i) => i.field === 'regularization')?.code).toBe(
      'knob-value-out-of-range',
    )
  })

  it('rejects a slider value outside the declared range', () => {
    for (const value of [-1, 4]) {
      const result = resolveConfiguration(apple, { regularization: value })
      expect(result.ok, `regularization ${value} should be refused`).toBe(false)
    }
  })

  it('produces no configuration for an invalid request, so no run can be scored', () => {
    const result = resolveConfiguration(apple, { blocks: 5, regularization: 1.5 })
    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty('configuration')
    if (!result.ok) expect(result.issues).toHaveLength(2)
  })

  it('rejects a knob id the task never declared', () => {
    const result = resolveConfiguration(apple, { learningRate: 0.1 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.find((i) => i.code === 'unknown-knob')?.field).toBe('learningRate')
  })

  it('falls back to a knob declared default when the request omits it', () => {
    const result = resolveConfiguration(apple, { blocks: 2 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.fromEntries(result.configuration.values)).toEqual({
      blocks: 2,
      channels: 16,
      regularization: 1,
      dropout: 0,
    })
  })

  it('starts every knob at its declared default', () => {
    const configuration = defaultConfiguration(apple)
    expect(configuration.taskId).toBe('apple-harvest')
    expect(configuration.values.map(([id]) => id)).toEqual([
      'blocks',
      'channels',
      'regularization',
      'dropout',
    ])
  })

  it('keeps knob values in the declared knob order', () => {
    const result = resolveConfiguration(apple, {
      dropout: 0.5,
      blocks: 2,
      regularization: 3,
      channels: 8,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.configuration.values.map(([id]) => id)).toEqual([
      'blocks',
      'channels',
      'regularization',
      'dropout',
    ])
  })
})

describe('artifact schema versioning', () => {
  it('loads without complaint when the declared and artifact versions are equal', () => {
    expect(checkArtifactVersion('1.0.0', '1.0.0')).toEqual({ ok: true })
  })

  it('refuses a mismatch, naming both versions', () => {
    const result = checkArtifactVersion('1.0.0', '2.0.0')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issue.code).toBe(SCHEMA_VERSION_MISMATCH)
    expect(result.issue.message).toContain('"1.0.0"')
    expect(result.issue.message).toContain('"2.0.0"')
  })

  it('refuses any difference rather than tolerating a close version', () => {
    for (const artifactVersion of ['1.0.1', '1.1.0', '0.9.9']) {
      expect(
        checkArtifactVersion('1.0.0', artifactVersion).ok,
        `artifact version ${artifactVersion} should be refused`,
      ).toBe(false)
    }
  })

  it('checks the version the apple task actually declares', () => {
    expect(checkArtifactVersion(apple.schemaVersion, '1.0.0').ok).toBe(true)
    expect(checkArtifactVersion(apple.schemaVersion, '1.0.1').ok).toBe(false)
  })
})

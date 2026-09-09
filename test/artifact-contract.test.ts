import { describe, expect, it } from 'vitest'
import { chooseAction } from '../src/policy/index.js'
import { lookupConfiguration } from '../src/task/artifact.js'
import { resolveConfiguration } from '../src/task/configuration.js'
import { firstFamily } from '../src/task/families.js'
import type { TaskDeclaration } from '../src/task/types.js'
import {
  applePool,
  applePredictions,
  appleDeclaration,
  OVER_REGULARIZED,
  OVER_SELECTIVE,
} from './helpers/apple'

const apple = appleDeclaration()
const family = firstFamily(apple)
const artifact = applePredictions()

const categoryIds = apple.categories.map((category) => category.id)
const actionIds = apple.actions.map((action) => action.id)

/** Every string leaf under a value, ignoring `_`-prefixed fixture annotations. */
function stringLeaves(value: unknown, path = ''): { path: string; value: string }[] {
  if (typeof value === 'string') return [{ path, value }]
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => stringLeaves(item, `${path}[${index}]`))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_'))
      .flatMap(([key, item]) => stringLeaves(item, path === '' ? key : `${path}.${key}`))
  }
  return []
}

describe('the artifact stores distributions, not decisions', () => {
  it('holds no string values at all inside a configuration entry', () => {
    // A chosen action or a final label could only be stored as a string, so an
    // entry containing none cannot be carrying either.
    for (const [id, entry] of Object.entries(artifact.configurations)) {
      expect(stringLeaves(entry), `configuration ${id} stores non-numeric data`).toEqual([])
    }
  })

  it('names no declared action anywhere in the artifact', () => {
    const serialised = JSON.stringify(
      Object.fromEntries(
        Object.entries(artifact.configurations).map(([id, entry]) => [
          id,
          { history: entry.history, predictions: entry.predictions },
        ]),
      ),
    )
    for (const action of actionIds) {
      expect(serialised).not.toContain(`"${action}"`)
    }
  })

  it('carries no ground truth, which lives in the pool manifest instead', () => {
    const poolImages = applePool().images
    for (const entry of Object.values(artifact.configurations)) {
      for (const split of ['training', 'pool'] as const) {
        for (const [imageId, distribution] of Object.entries(entry.predictions[split])) {
          expect(Array.isArray(distribution)).toBe(true)
          // The truth for this image is only obtainable from the manifest.
          expect(poolImages[imageId]?.category).toBeTypeOf('string')
        }
      }
    }
  })

  it('gives one probability per declared category for every stored image', () => {
    for (const [id, entry] of Object.entries(artifact.configurations)) {
      for (const split of ['training', 'pool'] as const) {
        for (const [imageId, distribution] of Object.entries(entry.predictions[split])) {
          expect(distribution, `${id}/${split}/${imageId}`).toHaveLength(categoryIds.length)
          const total = distribution.reduce((sum, value) => sum + value, 0)
          expect(total, `${id}/${split}/${imageId} must sum to 1`).toBeCloseTo(1, 6)
        }
      }
    }
  })

  it('indexes probabilities by the category order the task declares', () => {
    expect(artifact.categories).toEqual(categoryIds)
  })
})

describe('the artifact covers both splits', () => {
  it('resolves both the training split and the evaluation pool for a configuration', () => {
    for (const knobs of [OVER_REGULARIZED, OVER_SELECTIVE]) {
      const resolved = resolveConfiguration(apple, family, knobs)
      if (!resolved.ok) throw new Error('expected the configuration to resolve')
      const found = lookupConfiguration(apple, family, resolved.configuration, artifact)
      expect(found.ok).toBe(true)
      if (!found.ok) continue

      for (const split of ['training', 'pool'] as const) {
        expect(Object.keys(found.entry.predictions[split]).length).toBeGreaterThan(0)
      }
      expect(found.entry.history.length).toBeGreaterThan(0)
    }
  })

  it('stores an entry for every image the pool manifest declares in each split', () => {
    const images = applePool().images
    for (const [id, entry] of Object.entries(artifact.configurations)) {
      for (const split of ['training', 'pool'] as const) {
        const expected = Object.keys(images).filter((imageId) => images[imageId]?.split === split)
        expect(Object.keys(entry.predictions[split]).sort(), `${id}/${split}`).toEqual(
          expected.sort(),
        )
      }
    }
  })

  it('keeps the evaluation pool larger than the browsable training split', () => {
    for (const entry of Object.values(artifact.configurations)) {
      expect(Object.keys(entry.predictions.pool).length).toBeGreaterThan(
        Object.keys(entry.predictions.training).length,
      )
    }
  })
})

describe('changing the decision rule regenerates nothing', () => {
  it('leaves the artifact byte-identical while the chosen actions change', () => {
    const before = JSON.stringify(artifact)

    const withPolicy = (policy: TaskDeclaration['policy']): string[] => {
      const task: TaskDeclaration = { ...apple, policy }
      const entry = artifact.configurations['blocks2-channels8-regularization3-dropout0.5-datasetstarter']
      if (entry === undefined) throw new Error('fixture configuration missing')
      return Object.values(entry.predictions.pool).map((distribution) =>
        chooseAction(task, distribution),
      )
    }

    const byHighest = withPolicy({ kind: 'highest-probability' })
    const byCost = withPolicy({ kind: 'cost-optimal' })
    const byThreshold = withPolicy({
      kind: 'threshold',
      thresholds: { red: 0.95, green: 0.95, wormy: 0.95 },
      fallbackAction: 'decline',
      priority: ['wormy', 'green', 'red'],
    })

    expect(JSON.stringify(artifact)).toBe(before)
    // Which two of the three rules part company is a property of the declared payoff
    // table, not of the artifact: a table whose fines are mild enough lets the
    // cost-optimal rule agree with the most likely category everywhere. What must hold
    // whatever the table says is that the rule decides the actions while the stored
    // probabilities decide nothing.
    const distinct = new Set([byHighest, byCost, byThreshold].map((actions) => actions.join('|')))
    expect(distinct.size).toBeGreaterThan(1)
    expect(byThreshold.every((action) => action === 'decline')).toBe(true)
  })

  it('changes the chosen actions when only the priority order changes', () => {
    // Priority is declared data over categories, so reordering it is a change to the
    // decision rule and nothing else: the identifier is composed of knob ids and values,
    // and the stored distributions never mention an action at all.
    const before = JSON.stringify(artifact)
    const resolved = resolveConfiguration(apple, family, OVER_REGULARIZED)
    if (!resolved.ok) throw new Error('expected the configuration to resolve')

    const entry = artifact.configurations['blocks2-channels8-regularization3-dropout0.5-datasetstarter']
    if (entry === undefined) throw new Error('fixture configuration missing')

    const byPriority = (priority: string[]): { id: string; actions: string[] } => {
      const task: TaskDeclaration = {
        ...apple,
        policy: {
          kind: 'threshold',
          thresholds: { red: 0.5, green: 0.1, wormy: 0.25 },
          fallbackAction: 'discard',
          priority,
        },
      }
      const looked = lookupConfiguration(task, family, resolved.configuration, artifact)
      if (!looked.ok) throw new Error('expected the configuration to be covered')
      return {
        id: looked.configurationId,
        actions: Object.values(entry.predictions.pool).map((distribution) =>
          chooseAction(task, distribution),
        ),
      }
    }

    const declaredOrder = byPriority(['red', 'green', 'wormy'])
    const wormsFirst = byPriority(['wormy', 'green', 'red'])

    expect(declaredOrder.actions).not.toEqual(wormsFirst.actions)
    expect(wormsFirst.id).toBe(declaredOrder.id)
    expect(JSON.stringify(artifact)).toBe(before)
  })

  it('keeps the configuration identifier unchanged when the policy changes', () => {
    const resolved = resolveConfiguration(apple, family, OVER_REGULARIZED)
    if (!resolved.ok) throw new Error('expected the configuration to resolve')

    const underCostOptimal = lookupConfiguration(
      { ...apple, policy: { kind: 'cost-optimal' } },
      family,
      resolved.configuration,
      artifact,
    )
    const underHighest = lookupConfiguration(apple, family, resolved.configuration, artifact)

    expect(underCostOptimal.ok && underHighest.ok).toBe(true)
    if (!underCostOptimal.ok || !underHighest.ok) return
    expect(underCostOptimal.configurationId).toBe(underHighest.configurationId)
  })
})

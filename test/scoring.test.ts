import { describe, expect, it } from 'vitest'
import { runHarvest } from '../src/scoring/index.js'
import type { CategoryId } from '../src/task/types.js'
import {
  applePool,
  applePredictions,
  appleDeclaration,
  OVER_REGULARIZED,
  OVER_SELECTIVE,
} from './helpers/apple'

const apple = appleDeclaration()
const artifact = applePredictions()

const truth: Record<string, CategoryId> = Object.fromEntries(
  Object.entries(applePool().images).map(([id, entry]) => [id, entry.category]),
)

function run(knobs: Readonly<Record<string, unknown>>, split: 'training' | 'pool') {
  const result = runHarvest(apple, knobs, artifact, split, truth)
  if (!result.ok) {
    throw new Error(`expected the run to score; issues: ${result.issues.map((i) => i.message).join(' ')}`)
  }
  return result
}

describe('earnings are the sum of payoff entries', () => {
  it('loses money on the over-regularized configuration, which sells wormy apples', () => {
    // 3 reds picked at +1.00, one green declined at 0, 2 wormy picked at -2.00.
    const { outcome } = run(OVER_REGULARIZED, 'pool')
    expect(outcome.evaluated).toBe(6)
    expect(outcome.earnings).toBeCloseTo(-1, 10)
  })

  it('earns little on the over-selective configuration, which declines good reds', () => {
    const { outcome } = run(OVER_SELECTIVE, 'pool')
    expect(outcome.earnings).toBeCloseTo(1, 10)
  })

  it('equals the sum of the per-image payoffs it reports', () => {
    for (const knobs of [OVER_REGULARIZED, OVER_SELECTIVE]) {
      const { outcome } = run(knobs, 'pool')
      const summed = outcome.images.reduce((total, image) => total + image.payoff, 0)
      expect(outcome.earnings).toBeCloseTo(summed, 10)
    }
  })

  it('reports identical earnings for the same images, configuration and policy', () => {
    const first = run(OVER_REGULARIZED, 'pool').outcome.earnings
    const second = run(OVER_REGULARIZED, 'pool').outcome.earnings
    expect(second).toBe(first)
  })

  it('scores the training split and the harvest separately for one configuration', () => {
    const training = run(OVER_SELECTIVE, 'training').outcome
    const harvest = run(OVER_SELECTIVE, 'pool').outcome

    const correct = (o: typeof training): number =>
      o.images.filter((image) => image.action === apple.categoryActions[image.trueCategory]).length

    // The memorised configuration acts correctly on all four training images
    // but only four of six pool images: the overfitting gap, shown not asserted.
    expect(correct(training) / training.evaluated).toBe(1)
    expect(correct(harvest) / harvest.evaluated).toBeCloseTo(4 / 6, 10)
    expect(correct(harvest) / harvest.evaluated).toBeLessThan(
      correct(training) / training.evaluated,
    )
  })

  it('shows why accuracy alone understates an over-selective configuration', () => {
    const harvest = run(OVER_SELECTIVE, 'pool').outcome

    // Declining is the correct action for two of the three categories, so a
    // decline-heavy model still scores respectably on accuracy. What it cannot
    // hide is the count of reds it refused.
    const reds = harvest.images.filter((image) => image.trueCategory === 'red')
    expect(reds).toHaveLength(3)
    expect(reds.filter((image) => image.action === 'decline')).toHaveLength(2)
  })
})

describe('outcomes are reported per category and action combination', () => {
  it('reports a count for every combination, not only a total', () => {
    const { outcome } = run(OVER_REGULARIZED, 'pool')
    for (const category of apple.categories) {
      for (const action of apple.actions) {
        expect(outcome.counts[category.id]?.[action.id]).toBeTypeOf('number')
      }
    }
  })

  it('counts every evaluated image exactly once', () => {
    const { outcome } = run(OVER_REGULARIZED, 'pool')
    const total = Object.values(outcome.counts)
      .flatMap((row) => Object.values(row))
      .reduce((sum, count) => sum + count, 0)
    expect(total).toBe(outcome.evaluated)
  })

  it('shows the over-regularized configuration selling two wormy apples', () => {
    const { outcome } = run(OVER_REGULARIZED, 'pool')
    expect(outcome.counts).toEqual({
      red: { pick: 3, decline: 0 },
      green: { pick: 0, decline: 1 },
      wormy: { pick: 2, decline: 0 },
    })
  })

  it('makes an over-selective configuration diagnosable rather than merely low-scoring', () => {
    const { outcome } = run(OVER_SELECTIVE, 'pool')

    // It rarely picks, including on red, where picking is the correct action.
    expect(outcome.counts.red?.pick).toBe(1)
    expect(outcome.counts.red?.decline).toBe(2)

    // The counts where declining was correct are separate cells, so "good at
    // spotting worms" cannot be confused with "declines nearly everything".
    expect(outcome.counts.wormy?.decline).toBe(2)
    expect(outcome.counts.green?.decline).toBe(1)
    expect(outcome.counts.red?.pick).not.toBe(outcome.counts.wormy?.decline)
  })

  it('distinguishes the two failures that a single earnings number would blur', () => {
    const overRegularized = run(OVER_REGULARIZED, 'pool').outcome
    const overSelective = run(OVER_SELECTIVE, 'pool').outcome

    // One sells wormy apples; the other refuses good reds. Neither diagnosis is
    // available from the totals alone.
    expect(overRegularized.counts.wormy?.pick).toBeGreaterThan(0)
    expect(overSelective.counts.wormy?.pick).toBe(0)
    expect(overSelective.counts.red?.decline).toBeGreaterThan(
      overRegularized.counts.red?.decline as number,
    )
  })
})

describe('a run refuses rather than scoring partial data', () => {
  it('scores nothing when a knob value is out of range', () => {
    const result = runHarvest(apple, { ...OVER_REGULARIZED, blocks: 5 }, artifact, 'pool', truth)
    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty('outcome')
    if (!result.ok) expect(result.issues[0]?.code).toBe('knob-value-out-of-range')
  })

  it('scores nothing when the artifact schema version does not match', () => {
    const stale = { ...artifact, schemaVersion: '2.0.0' }
    const result = runHarvest(apple, OVER_REGULARIZED, stale, 'pool', truth)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.map((i) => i.code)).toContain('schema-version-mismatch')
  })

  it('scores nothing when the pool declares no truth for an evaluated image', () => {
    const { 'p-004': _omitted, ...incomplete } = truth
    const result = runHarvest(apple, OVER_REGULARIZED, artifact, 'pool', incomplete)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('missing-ground-truth')
      expect(result.issues[0]?.message).toContain('p-004')
    }
  })

  it('scores nothing when a stored distribution is unusable', () => {
    const corrupt = structuredClone(artifact) as typeof artifact & {
      configurations: Record<string, { predictions: { pool: Record<string, number[]> } }>
    }
    const entry = corrupt.configurations['blocks2-channels8-regularization3-dropout0.5']
    if (entry) entry.predictions.pool['p-001'] = [0.5, 0.2]
    const result = runHarvest(apple, OVER_REGULARIZED, corrupt, 'pool', truth)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.code).toBe('malformed-distribution')
  })
})

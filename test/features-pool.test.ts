import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CONTAMINATION_TOLERANCE,
  DUPLICATE_RANK_TOLERANCE,
  INVERSION_TOLERANCE,
  bestThresholdAccuracy,
  checkContaminationHolds,
  checkNoDuplicates,
  checkNoInversion,
  checkNotConstant,
  checkRanges,
  separations,
} from '../src/features/checks.js'
import {
  applyRule,
  bestRule,
  candidateThresholds,
  scoreActions,
} from '../src/features/rules.js'
import { readPool, type LoadedPool } from '../src/pool/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const read = (path: string): unknown => JSON.parse(readFileSync(`${repoRoot}${path}`, 'utf8'))

const apple: TaskDeclaration = appleDeclaration()

/** The committed pool, through the real reader — a stand-in would prove nothing. */
function loadedPool(): LoadedPool {
  const result = readPool(read('pools/apple-harvest/manifest.json'), apple)
  if (!result.ok) {
    throw new Error(`the shipped pool must load: ${result.issues.map((i) => i.message).join(' ')}`)
  }
  return result.pool
}

const pool = loadedPool()

/** A pool with one image's features replaced, for the checks that must refuse one. */
function poolWith(
  edit: (features: Record<string, number>, imageId: string) => void,
  against: TaskDeclaration = apple,
): LoadedPool {
  const raw = read('pools/apple-harvest/manifest.json') as {
    images: Record<string, { features: Record<string, number> }>
  }
  for (const [id, image] of Object.entries(raw.images)) edit(image.features, id)
  const result = readPool(raw, against)
  if (!result.ok) throw new Error(result.issues.map((i) => i.message).join(' '))
  return result.pool
}

describe('the manifest records exactly the features the task declares', () => {
  it('loads the committed pool against the shipped declaration', () => {
    expect(Object.keys(pool.images)).toHaveLength(1200)
    for (const feature of apple.features) {
      expect(pool.images['t-001']?.features[feature.id]).toBeTypeOf('number')
    }
  })

  it('refuses an image missing a declared feature, naming the feature and the image', () => {
    const raw = read('pools/apple-harvest/manifest.json') as {
      images: Record<string, { features: Record<string, number> }>
    }
    const victim = apple.features[1]?.id ?? ''
    delete (raw.images['p-0042'] as { features: Record<string, number> }).features[victim]

    const result = readPool(raw, apple)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const message = result.issues.map((issue) => issue.message).join(' ')
    expect(message).toContain(victim)
    expect(message).toContain('p-0042')
  })

  it('refuses an image recording a feature the task does not declare, naming both', () => {
    const raw = read('pools/apple-harvest/manifest.json') as {
      images: Record<string, { features: Record<string, number> }>
    }
    ;(raw.images['t-007'] as { features: Record<string, number> }).features.stemLength = 4

    const result = readPool(raw, apple)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const message = result.issues.map((issue) => issue.message).join(' ')
    expect(message).toContain('stemLength')
    expect(message).toContain('t-007')
  })

  it('refuses a contaminant that is not an attribute the pool records', () => {
    const invented = {
      ...apple,
      features: apple.features.map((feature, index) =>
        index === 0 ? { ...feature, contaminatedBy: ['ripeness'] } : feature,
      ),
    }
    const result = readPool(read('pools/apple-harvest/manifest.json'), invented)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.message).join(' ')).toContain('ripeness')
  })
})

describe('no declared feature is a constant or a duplicate', () => {
  it('finds every declared feature moving across the pool', () => {
    expect(checkNotConstant(apple, pool)).toEqual([])
  })

  it('refuses a feature that never moves, naming it', () => {
    // What a `size` feature would be: `bodyPath` fixes the silhouette's width, so a
    // feature measuring it would take one value for all 1 200 apples.
    const flat = poolWith((features) => {
      features[apple.features[0]?.id ?? ''] = 0.5
    })
    const issues = checkNotConstant(apple, flat)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain(apple.features[0]?.id ?? '')
  })

  it('finds no two declared features reducible to one another', () => {
    expect(checkNoDuplicates(apple, pool)).toEqual([])
  })

  it('refuses a greenness declared alongside redness, naming both', () => {
    // `greenness` measured over this pool is `-redness` exactly. Declaring both would
    // hand a student one number under two names.
    const withGreenness: TaskDeclaration = {
      ...apple,
      features: [
        ...apple.features,
        {
          id: 'greenness',
          label: 'Greenness',
          unit: 'green minus red, averaged over the apple; -1 to 1',
          range: { min: -0.6, max: 0.5 },
          contaminatedBy: ['lighting'],
          help: 'How much more green than red the skin is.',
        },
      ],
    }
    const mirrored = poolWith((features) => {
      features.greenness = -(features.redness as number)
    }, withGreenness)

    const issues = checkNoDuplicates(withGreenness, mirrored)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('greenness')
    expect(issues[0]?.message).toContain('redness')
  })

  it('keeps the two spot features apart, which is why the tolerance is where it is', () => {
    // Recorded rather than merely passing: they rank together at 0.938 — close enough
    // that the tolerance has to be argued for, far enough that they are two features.
    expect(DUPLICATE_RANK_TOLERANCE).toBeGreaterThan(0.94)
    expect(checkNoDuplicates(apple, pool, 0.93)).not.toEqual([])
  })
})

describe('every declared contamination holds against the pool', () => {
  it('finds each named attribute moving its feature within some category', () => {
    expect(checkContaminationHolds(apple, pool)).toEqual([])
  })

  it('refuses a contamination the pool does not bear out, naming the feature and the attribute', () => {
    // `hue` does not move the outline measurement within any category: the silhouette is
    // drawn the same shape whatever colour it is filled with.
    const overclaimed: TaskDeclaration = {
      ...apple,
      features: apple.features.map((feature) =>
        feature.id === 'roundness' ? { ...feature, contaminatedBy: ['hue'] } : feature,
      ),
    }
    const issues = checkContaminationHolds(overclaimed, pool)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('roundness')
    expect(issues[0]?.message).toContain('hue')
  })

  it('sets the tolerance below every contamination the shipped set declares', () => {
    expect(CONTAMINATION_TOLERANCE).toBeGreaterThan(0)
    expect(checkContaminationHolds(apple, pool, CONTAMINATION_TOLERANCE)).toEqual([])
  })
})

describe('every measured value falls inside its declared range', () => {
  it('accepts the shipped pool', () => {
    expect(checkRanges(apple, pool)).toEqual([])
  })

  it('refuses a range too narrow for the values measured, naming the feature', () => {
    const narrowed: TaskDeclaration = {
      ...apple,
      features: apple.features.map((feature) =>
        feature.id === 'redness' ? { ...feature, range: { min: 0, max: 0.1 } } : feature,
      ),
    }
    const issues = checkRanges(narrowed, pool)
    expect(issues).not.toEqual([])
    expect(issues[0]?.message).toContain('redness')
  })
})

describe('the separation metric', () => {
  it('scores a perfectly separating feature at one', () => {
    const values = [0, 0, 0, 1, 1, 1]
    expect(bestThresholdAccuracy(values, [false, false, false, true, true, true])).toBe(1)
  })

  it('scores a feature that says nothing at a half', () => {
    const flat = [3, 3, 3, 3, 3, 3]
    expect(bestThresholdAccuracy(flat, [true, true, true, false, false, false])).toBe(0.5)
  })

  it('reads a category low on the feature as separating it, not as failing to', () => {
    const values = [5, 5, 5, 1, 1, 1]
    expect(bestThresholdAccuracy(values, [false, false, false, true, true, true])).toBe(1)
  })

  it('is not fooled by class imbalance, which is the reason it is balanced accuracy', () => {
    // Nineteen negatives and one positive. Calling everything negative is 95% accurate
    // and separates nothing; balanced accuracy says so.
    const values = Array.from({ length: 20 }, (_, i) => i)
    const isPositive = values.map((_, i) => i === 19)
    expect(bestThresholdAccuracy(values, isPositive)).toBe(1)

    const noisy = values.map(() => 1)
    expect(bestThresholdAccuracy(noisy, isPositive)).toBe(0.5)
  })

  it('says nothing about a set with only one category in it', () => {
    expect(bestThresholdAccuracy([1, 2, 3], [true, true, true])).toBe(0.5)
  })
})

describe('no feature separates better on the evaluation split than on the fitted images', () => {
  const measured = separations(apple, pool)

  it('reports both separations for every declared feature', () => {
    expect(measured.map((pair) => pair.feature).sort()).toEqual(
      apple.features.map((feature) => feature.id).sort(),
    )
    for (const pair of measured) {
      expect(pair.fitted).toBeGreaterThanOrEqual(0.5)
      expect(pair.evaluation).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('holds for every declared feature at the fitted tolerance', () => {
    expect(checkNoInversion(apple, pool, INVERSION_TOLERANCE)).toEqual([])
  })

  it('refuses an inverted feature, naming it and both figures', () => {
    // A feature that is noise on the fitted images and separates the evaluation split
    // cleanly: the student inspects their own photos, correctly concludes it is useless,
    // and is punished for reasoning correctly.
    const fitted = new Set(pool.roles.fitted)
    const inverted = poolWith((features, imageId) => {
      if (fitted.has(imageId)) features.redness = 0.1
    })
    const issues = checkNoInversion(apple, inverted, INVERSION_TOLERANCE)
    expect(issues).not.toEqual([])
    expect(issues[0]?.message).toContain('redness')
  })

  it('forbids evaluation above fitted, and permits fitted above evaluation', () => {
    // The direction, named rather than merely exercised. Both pools below are inversions
    // of one another, and only one of them is refused: a feature strong on the images a
    // student browsed and weak on the ones they are scored over is overfitting, which is
    // the lesson the whole pool is built around, and it must stay sayable.
    const fitted = new Set(pool.roles.fitted)

    const evaluationAhead = poolWith((features, imageId) => {
      if (fitted.has(imageId)) features.redness = 0.1
    })
    const fittedAhead = poolWith((features, imageId) => {
      if (!fitted.has(imageId)) features.redness = 0.1
    })

    const refused = checkNoInversion(apple, evaluationAhead, INVERSION_TOLERANCE)
    expect(refused.map((issue) => issue.code)).toContain('separation-inverted')
    expect(refused[0]?.message).toContain('better on the evaluation split')

    const permitted = separations(apple, fittedAhead).find((pair) => pair.feature === 'redness')
    expect(permitted?.fitted ?? 0).toBeGreaterThan(permitted?.evaluation ?? 1)
    expect(checkNoInversion(apple, fittedAhead, INVERSION_TOLERANCE)).toEqual([])
  })

  it('leaves the tolerance no room it does not need', () => {
    const worst = Math.max(...measured.map((pair) => pair.evaluation - pair.fitted))
    expect(INVERSION_TOLERANCE).toBeGreaterThanOrEqual(worst)
    // Recorded so a later change can see how much room the guard had.
    expect(worst).toBeLessThan(INVERSION_TOLERANCE + 0.001)
  })
})

describe('the bounded rule search', () => {
  it('takes thresholds as midpoints between adjacent observed values', () => {
    expect(candidateThresholds([1, 2, 4], 10)).toEqual([1.5, 3])
    expect(candidateThresholds([1, 1, 1], 10)).toEqual([])
  })

  it('subsamples to the declared cap rather than growing with the pool', () => {
    const many = Array.from({ length: 500 }, (_, i) => i)
    expect(candidateThresholds(many, 8).length).toBeLessThanOrEqual(8)
  })

  it('finds a rule over the manifest without rasterizing anything', () => {
    const found = bestRule(apple, pool)
    expect(found.rule.splits.length).toBeGreaterThan(0)
    expect(found.rule.splits.length).toBeLessThanOrEqual(apple.ruleBudget.maxNodes)
    for (const split of found.rule.splits) {
      expect(apple.features.map((feature) => feature.id)).toContain(split.feature)
    }
    expect(found.fitted.overall).toBeGreaterThan(0.5)
  })

  it('scores the rule it reports at the figure it reports', () => {
    const found = bestRule(apple, pool)
    const rescored = scoreActions(apple, pool, pool.roles.fitted, (id) =>
      applyRule(found.rule, pool.images[id]?.features ?? {}),
    )
    expect(rescored).toEqual(found.fitted)
  })
})

// Where the best hand rule stands against the shipped configurations is measured and
// recorded in `test/features-ladder.test.ts`, not refused here. See that file's header, and
// `openspec/changes/measured-features/design.md`, for why the refusal this file used to
// carry was replaced by a pinned recording and a rule about what may be claimed.

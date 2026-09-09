/**
 * Where the best hand-written rule stands against the models the task ships, recorded.
 *
 * Not refused. Whether a rule a student writes by hand beats a trained network is a
 * measurement over this pool and these three configurations, it legitimately moves when any
 * of them moves, and it is designed to reverse when the change that authors harder pixels
 * lands — see `openspec/changes/measured-features/design.md`, where the refusal this
 * replaced is argued out in full. What this file does is take the measurement in both
 * currencies and pin every figure, so that a change moving one has to say so out loud.
 *
 * Both currencies, because they can disagree and because a student reads the second. A
 * score is comparable across changes; earnings are what the harvest report shows, and the
 * delivery term can reorder two models a score ranks the other way. The crop and the
 * valuation come from `helpers/crop.ts`, the same definitions the delivery guards measure
 * through — a comparison is only worth recording if both sides were paid for one crop.
 *
 * Everything here runs against the shipped declaration, the shipped pool and the shipped
 * prediction artifacts. Figures measured against a fixture would pin nothing.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DeclaredCopy, RecordedStanding } from '../src/features/claims.js'
import { CLAIM_PHRASES, checkNoUnrecordedClaim, modelAhead } from '../src/features/claims.js'
import type { ModelScore, Rule, Score } from '../src/features/rules.js'
import {
  applyRule,
  bestRule,
  describeRule,
  ladderComparison,
  pinIssues,
  ruleBatch,
  scoreActions,
} from '../src/features/rules.js'
import { chooseAction } from '../src/policy/index.js'
import { valueDelivery } from '../src/scoring/index.js'
import type { Crop } from '../src/sorting/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple.js'
import { shippedCatalogJson, soundCatalog } from './helpers/catalog.js'
import {
  committedPool,
  cropFor,
  cropSplit,
  farmAt,
  harvestOf,
  pinnedAt,
  shippedConfigurations,
} from './helpers/crop.js'
import { shippedFarm } from './helpers/farm.js'

const apple = appleDeclaration()
const farm = shippedFarm()
const pool = committedPool(apple)
const split = cropSplit(pool)
const LAND = farm.orchard.opening
const CONFIGURATIONS = shippedConfigurations(apple)

/** The best rule the declared budget allows, thresholds fitted on the browsable images. */
const best = bestRule(apple, pool)

/** What that rule scores over the evaluation split — the images nothing was fitted on. */
const ruleScore: Score = scoreActions(apple, pool, pool.order.pool, (id) =>
  applyRule(best.rule, pool.images[id]?.features ?? {}),
)

/** Every shipped configuration over the same split, through the task's declared policy. */
const models: readonly ModelScore[] = CONFIGURATIONS.map(({ id, entry }) => ({
  configurationId: id,
  ...scoreActions(apple, pool, pool.order.pool, (imageId) =>
    chooseAction(apple, entry.predictions.pool[imageId] ?? []),
  ),
}))

/**
 * The two years the earnings are recorded over: the mildest and the wettest declared.
 *
 * The extremes rather than the middle, and pinned rather than drawn, so the figures are the
 * range the declaration permits instead of whatever weather one year happened to bring.
 */
const YEARS = {
  mild: cropFor(apple, farmAt(pinnedAt(farm, 0), 1, LAND), split),
  wet: cropFor(apple, farmAt(pinnedAt(farm, 1), 1, LAND), split),
} as const

/** What one rule earns over one year's crop, under the same delivery term as a network. */
function ruleEarnings(crop: Crop, rule: Rule = best.rule): number {
  return valueDelivery(apple, ruleBatch(apple, pool, crop.pieces, rule)).paid
}

/** Scores to three places, which is a tenth of a percent of a thousand images. */
const score = (value: number): number => Math.round(value * 1000) / 1000
/** Earnings to the whole unit of the farm's currency. */
const money = (value: number): number => Math.round(value)

/**
 * Every figure the recording holds, measured now.
 *
 * Few figures rather than many, deliberately: per-category scores against each
 * configuration and earnings at the two declared extremes, not a table per year. Every
 * change that touches pixels or retrains has to re-record these, and that friction lands on
 * changes which are already expensive.
 */
function measuredFigures(): Record<string, number> {
  const figures: Record<string, number> = {
    'budget.maxNodes': apple.ruleBudget.maxNodes,
    'rule.score.overall': score(ruleScore.overall),
  }
  for (const category of apple.categories) {
    figures[`rule.score.${category.id}`] = score(ruleScore.perCategory[category.id] ?? 0)
  }
  for (const [year, crop] of Object.entries(YEARS)) {
    figures[`rule.earnings.${year}`] = money(ruleEarnings(crop))
  }

  for (const model of models) {
    figures[`${model.configurationId}.score.overall`] = score(model.overall)
    for (const category of apple.categories) {
      figures[`${model.configurationId}.score.${category.id}`] = score(
        model.perCategory[category.id] ?? 0,
      )
    }
  }
  for (const { id, entry } of CONFIGURATIONS) {
    for (const [year, crop] of Object.entries(YEARS)) {
      figures[`${id}.earnings.${year}`] = money(harvestOf(apple, entry, crop).paid)
    }
  }
  return figures
}

const MEASURED = measuredFigures()

/**
 * The recorded ladder position. These are acceptance criteria, not observations.
 *
 * Read them as one table: on the crop as it stands, the best three-node rule over the five
 * declared features is ahead of every shipped network on the overall score, well ahead on
 * red apples, and ahead in money in both declared years. The one figure it is behind on is
 * wormy apples against the widest configuration — 0.356 against 0.408 — and that gap does
 * not save the year, because the rule delivers so many fewer worms that the delivery term
 * never fires. That is a fact about flat synthetic apples measured against three
 * deliberately small networks, and the change that fixes it is `heirloom-cultivars`, which
 * now has a number to aim at.
 *
 * A change that moves any of these fails naming the figure, its recorded value and its
 * measured value. Re-record it, and say in the change why it moved.
 */
const RECORDED: Readonly<Record<string, number>> = {
  'budget.maxNodes': 3,

  'rule.score.overall': 0.825,
  'rule.score.red': 0.972,
  'rule.score.green': 1,
  'rule.score.wormy': 0.356,
  'rule.earnings.mild': 1647,
  'rule.earnings.wet': 1378,

  'blocks2-channels8-regularization1-dropout0.score.overall': 0.766,
  'blocks2-channels8-regularization1-dropout0.score.red': 0.866,
  'blocks2-channels8-regularization1-dropout0.score.green': 1,
  'blocks2-channels8-regularization1-dropout0.score.wormy': 0.332,
  'blocks2-channels8-regularization1-dropout0.earnings.mild': 1476,
  'blocks2-channels8-regularization1-dropout0.earnings.wet': 1215,

  'blocks2-channels16-regularization1-dropout0.score.overall': 0.764,
  'blocks2-channels16-regularization1-dropout0.score.red': 0.856,
  'blocks2-channels16-regularization1-dropout0.score.green': 1,
  'blocks2-channels16-regularization1-dropout0.score.wormy': 0.344,
  'blocks2-channels16-regularization1-dropout0.earnings.mild': 1465,
  'blocks2-channels16-regularization1-dropout0.earnings.wet': 1207,

  'blocks2-channels32-regularization1-dropout0.score.overall': 0.786,
  'blocks2-channels32-regularization1-dropout0.score.red': 0.868,
  'blocks2-channels32-regularization1-dropout0.score.green': 1,
  'blocks2-channels32-regularization1-dropout0.score.wormy': 0.408,
  'blocks2-channels32-regularization1-dropout0.earnings.mild': 1495,
  'blocks2-channels32-regularization1-dropout0.earnings.wet': 1250,
}

describe('the recording has something real to measure', () => {
  it('measures a rule within the declared budget over the shipped configurations', () => {
    expect(CONFIGURATIONS.length).toBeGreaterThanOrEqual(3)
    expect(best.rule.splits.length).toBeGreaterThan(0)
    expect(best.rule.splits.length).toBeLessThanOrEqual(apple.ruleBudget.maxNodes)
    for (const model of models) expect(model.overall).toBeGreaterThan(0.5)
  })

  it('draws the mildest and the wettest year the declaration permits', () => {
    expect(YEARS.wet.composition.wormy ?? 0).toBeGreaterThan(YEARS.mild.composition.wormy ?? 0)
    expect(YEARS.mild.size).toBe(LAND * farm.orchard.piecesPerUnit)
  })
})

describe('the ladder position is recorded, in both currencies', () => {
  it('measures every recorded figure at the value it was recorded at', () => {
    expect(
      pinIssues(RECORDED, MEASURED).map((issue) => issue.message),
      `the rule found was: ${describeRule(best.rule)}`,
    ).toEqual([])
  })

  it('records the rule itself, so a change that finds a different one is visible', () => {
    // The figures alone would not say which rule earned them, and two different rules
    // scoring the same is exactly the case where a reader needs to know.
    expect(describeRule(best.rule)).toBe(
      'if redness > 0.4967 then crate-red; if darkSpotArea > 0.0205 then discard; ' +
        'if redness > 0.4513 then crate-red; otherwise crate-green',
    )
  })

  it('refuses a figure that has moved, naming it, its recorded value and its measured one', () => {
    const moved = pinIssues(RECORDED, { ...MEASURED, 'rule.score.overall': 0.5 })
    expect(moved).toHaveLength(1)
    const message = moved[0]?.message ?? ''
    expect(message).toContain('rule.score.overall')
    expect(message).toContain('0.825')
    expect(message).toContain('0.5')
  })

  it('refuses a figure measured but never recorded, so a new configuration re-records', () => {
    const added = pinIssues(RECORDED, { ...MEASURED, 'blocks3-channels16.score.overall': 0.81 })
    expect(added).toHaveLength(1)
    expect(added[0]?.message).toContain('blocks3-channels16.score.overall')
    expect(added[0]?.code).toBe('figure-not-recorded')
  })

  it('refuses a figure recorded and no longer measured, so dropping one re-records too', () => {
    const dropped = { ...MEASURED }
    delete dropped['rule.earnings.wet']
    const issues = pinIssues(RECORDED, dropped)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('figure-not-measured')
    expect(issues[0]?.message).toContain('rule.earnings.wet')
  })
})

describe('the comparison reports the position rather than refusing it', () => {
  const rows = ladderComparison(apple, ruleScore, models)

  it('reports both figures and the gap, for every configuration and every category', () => {
    expect(rows).toHaveLength(models.length * (1 + apple.categories.length))
    for (const row of rows) {
      expect(row.margin).toBeCloseTo(row.rule - row.model, 10)
    }
  })

  it('finds the hand rule ahead of every shipped configuration overall, and records it', () => {
    // Recorded rather than refused, which is the whole of the decision this replaced. The
    // margin is carried by `redness` on red apples — 0.97 against 0.86 — and `redness`
    // masks nothing by design, so no declared sensitivity lowers it. The cause is the pool.
    const overall = rows.filter((row) => row.figure === 'overall')
    expect(overall).toHaveLength(models.length)
    for (const row of overall) {
      expect(row.margin, `"${row.configurationId}" is ahead of the hand rule`).toBeGreaterThan(0)
    }
  })

  it('records the one figure it is behind on, which is where the currencies disagree', () => {
    // Wormy apples against the widest configuration. Worth recording rather than rounding
    // away: it is the only figure that points the other way, and it does not reach the
    // money, because the rule reaches the same year with far fewer worms in the crates.
    const behind = rows.filter((row) => row.margin < 0)
    expect(behind.map((row) => `${row.configurationId} ${row.figure}`)).toEqual([
      'blocks2-channels32-regularization1-dropout0 wormy',
    ])

    for (const year of ['mild', 'wet'] as const) {
      const rule = RECORDED[`rule.earnings.${year}`] ?? 0
      const model = RECORDED[`blocks2-channels32-regularization1-dropout0.earnings.${year}`] ?? 0
      expect(rule, `the wormy gap costs the rule the ${year} year`).toBeGreaterThan(model)
    }
  })
})

describe('the recording is taken at the largest node budget the task offers', () => {
  it('records the declared budget as one of the pinned figures', () => {
    // So raising it fails the pin above rather than silently leaving the figures behind.
    expect(RECORDED['budget.maxNodes']).toBe(apple.ruleBudget.maxNodes)
  })

  it('fails until the figures are re-recorded when the budget is raised', () => {
    // The whole mechanism, exercised: bump the declared budget and the pin refuses,
    // naming the figure. Nobody can sell a fourth node without re-taking the recording.
    const raised = apple.ruleBudget.maxNodes + 1
    const issues = pinIssues(RECORDED, { ...MEASURED, 'budget.maxNodes': raised })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('budget.maxNodes')
    expect(issues[0]?.message).toContain(String(raised))
  })

  it('searches to exactly the declared budget, and a different budget is a different table', () => {
    // What makes the coupling real rather than bookkeeping: the figures depend on the
    // budget, so a recording taken at a different one would describe a rule nobody can
    // write. Measured downwards, because an exhaustive search one node deeper costs a
    // hundred times this one and shows the same thing.
    //
    // Note what does *not* move: the 160 fitted images are perfectly separable with two
    // nodes, so the score the search maximises is 1.000 at either budget. The extra node
    // buys nothing a student could see while fitting and changes what the rule does on
    // every image they were not shown — which is the whole reason the recording is taken
    // on the evaluation split and on a year's crop rather than on the fitted images.
    expect(best.rule.splits).toHaveLength(apple.ruleBudget.maxNodes)
    expect(best.fitted.overall).toBe(1)

    const smaller: TaskDeclaration = {
      ...apple,
      ruleBudget: { maxNodes: apple.ruleBudget.maxNodes - 1 },
    }
    const below = bestRule(smaller, pool)
    expect(below.rule.splits.length).toBeLessThan(apple.ruleBudget.maxNodes)
    expect(below.fitted.overall).toBe(1)

    const evaluated = scoreActions(apple, pool, pool.order.pool, (id) =>
      applyRule(below.rule, pool.images[id]?.features ?? {}),
    )
    expect(score(evaluated.overall)).not.toBe(RECORDED['rule.score.overall'])
    expect(money(ruleEarnings(YEARS.mild, below.rule))).not.toBe(RECORDED['rule.earnings.mild'])
  })
})

/**
 * The screens, excluding tests and test support.
 *
 * The same walk `web/src/no-task-specific-code.test.tsx` runs, for the same reason: a claim
 * pasted into a component is a claim a student reads, whether or not any declaration
 * carries it.
 */
function screenSources(): string[] {
  const webSrc = join(process.cwd(), 'web/src')
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        if (name !== 'test-support') walk(path)
        continue
      }
      if (!/\.tsx?$/.test(name)) continue
      if (name.includes('.test.')) continue
      files.push(path)
    }
  }
  walk(webSrc)
  return files
}

/** Comments stripped: what a screen renders is the concern, not what it explains. */
function rendered(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** Every piece of copy the game shows: the task's, the market's, and the screens'. */
function shippedCopy(): readonly DeclaredCopy[] {
  const copy: DeclaredCopy[] = [
    { source: 'teaching.summary', text: apple.teaching.summary },
    { source: 'teaching.theory', text: apple.teaching.theory },
    ...apple.families.flatMap((family) => [
      { source: `families.${family.id}.summary`, text: family.teaching.summary },
      { source: `families.${family.id}.theory`, text: family.teaching.theory },
      ...family.knobs.map((knob) => ({
        source: `families.${family.id}.knobs.${knob.id}.help`,
        text: knob.help,
      })),
    ]),
    ...apple.features.map((feature) => ({
      source: `features.${feature.id}.help`,
      text: `${feature.label} ${feature.unit} ${feature.help}`,
    })),
  ]

  for (const item of soundCatalog(shippedCatalogJson(), farm).items) {
    copy.push({
      source: `catalog.${item.id}`,
      text: `${item.label} ${item.copy} ${item.notForSaleReason ?? ''}`,
    })
  }
  for (const file of screenSources()) {
    copy.push({
      source: relative(process.cwd(), file).replace(/\\/g, '/'),
      text: rendered(readFileSync(file, 'utf8')),
    })
  }
  return copy
}

/**
 * What the recording says about each currency: the rule's figure against the best model's.
 *
 * Read off `RECORDED` rather than asserted beside it, so the day a network finally wins on
 * the crop as it stands the vocabulary becomes sayable with no edit to the check.
 */
function standings(): readonly RecordedStanding[] {
  const bestOf = (suffix: string): number =>
    Math.max(
      ...CONFIGURATIONS.map(({ id }) => RECORDED[`${id}.${suffix}`]).filter(
        (value): value is number => value !== undefined,
      ),
    )
  return [
    {
      currency: 'score',
      figure: 'score.overall',
      rule: RECORDED['rule.score.overall'] ?? 0,
      model: bestOf('score.overall'),
    },
    {
      currency: 'earnings',
      figure: 'earnings.mild',
      rule: RECORDED['rule.earnings.mild'] ?? 0,
      model: bestOf('earnings.mild'),
    },
    {
      currency: 'earnings',
      figure: 'earnings.wet',
      rule: RECORDED['rule.earnings.wet'] ?? 0,
      model: bestOf('earnings.wet'),
    },
  ]
}

describe('nothing claims an advantage the recorded figures do not show', () => {
  const standing = standings()
  const copy = shippedCopy()

  it('reads the standing off the recorded figures, in both currencies', () => {
    expect(standing.map((entry) => entry.currency)).toContain('score')
    expect(standing.map((entry) => entry.currency)).toContain('earnings')
    // On the crop as it stands, no shipped configuration is ahead in either currency, so
    // every currency is checked. That is what makes this test a live rule today rather
    // than a rule waiting for copy to exist.
    for (const entry of standing) expect(modelAhead(entry)).toBe(false)
  })

  it('has copy to check, from the declaration, the market and the screens', () => {
    expect(copy.length).toBeGreaterThan(12)
    for (const source of ['teaching.summary', 'teaching.theory']) {
      expect(copy.map((item) => item.source)).toContain(source)
    }
    expect(copy.some((item) => item.source.startsWith('catalog.'))).toBe(true)
    expect(copy.filter((item) => item.source.startsWith('web/src/')).length).toBeGreaterThan(4)
  })

  it('finds no such claim anywhere in what ships', () => {
    expect(checkNoUnrecordedClaim(copy, standing).map((issue) => issue.message)).toEqual([])
  })

  it('refuses copy that claims the network is more accurate, naming the claim and the figure', () => {
    const claimed: DeclaredCopy[] = [
      {
        source: 'catalog.trained-eye',
        text: 'A trained eye is more accurate than any rule you could write by hand.',
      },
    ]
    const issues = checkNoUnrecordedClaim(claimed, standing)
    expect(issues).toHaveLength(1)
    const message = issues[0]?.message ?? ''
    expect(message).toContain('catalog.trained-eye')
    expect(message).toContain('more accurate')
    expect(message).toContain('score.overall')
    expect(message).toContain('0.825')
  })

  it('refuses copy that claims it earns more, in the currency a student reads', () => {
    const claimed: DeclaredCopy[] = [
      { source: 'catalog.trained-eye', text: 'It earns more every year than sorting by number.' },
    ]
    const issues = checkNoUnrecordedClaim(claimed, standing)
    // Once per declared earnings figure, since both years measure the other way.
    expect(issues).toHaveLength(2)
    for (const issue of issues) expect(issue.message).toContain('earns more')
  })

  it('says nothing about a currency the recorded figures do put the model ahead in', () => {
    const ahead: readonly RecordedStanding[] = [
      { currency: 'score', figure: 'score.overall', rule: 0.7, model: 0.9 },
    ]
    const claimed: DeclaredCopy[] = [
      { source: 'catalog.trained-eye', text: 'It is more accurate than a rule.' },
    ]
    expect(checkNoUnrecordedClaim(claimed, ahead)).toEqual([])
  })

  it('leaves the honest sentence about what a model is for sayable', () => {
    // The whole point of the requirement being about claims rather than about copy: the
    // market may say what the network can express, which is true today and is the argument
    // `heirloom-cultivars` arrives to make good on.
    const honest: DeclaredCopy[] = [
      {
        source: 'catalog.trained-eye',
        text:
          'It can ask questions your rules cannot express — the stripes on a heirloom, ' +
          'the shape of a bruise — and it learns them from the pictures rather than from you.',
      },
    ]
    expect(checkNoUnrecordedClaim(honest, standing)).toEqual([])
  })

  it('is not tripped by the "more" the shipped copy is full of', () => {
    // A hundred more trees, more room to memorise, more than one mistake to make: all
    // honest, and all why the check matches constructions rather than single words.
    const innocent: DeclaredCopy[] = [
      { source: 'catalog.orchard', text: 'A hundred trees more to bring in, bearing sixty each.' },
      { source: 'knobs.blocks.help', text: 'A deeper stack has more room to memorise.' },
      { source: 'teaching.theory', text: 'There is more than one mistake to make.' },
    ]
    expect(checkNoUnrecordedClaim(innocent, standing)).toEqual([])
    // "more" on its own is in no phrase list, in either currency.
    for (const phrases of Object.values(CLAIM_PHRASES)) expect(phrases).not.toContain('more')
  })
})

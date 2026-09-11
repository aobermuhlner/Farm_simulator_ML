import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { earningsByCategory, runHarvest } from '../../../src/scoring/index.js'
import type { RunOutcome } from '../../../src/scoring/index.js'
import type { HarvestFigures } from '../../../src/economy/index.js'
import type { TaskDeclaration } from '../../../src/task/types.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import {
  appleArtifact,
  appleDeclaration,
  appleTruth,
  sharedActionDeclaration,
  unrelatedDeclaration,
} from '../test-support/declarations.js'
import { firstFamily } from '../../../src/task/families.js'
import { Report } from './Report.js'

afterEach(cleanup)

const apple = appleDeclaration()

/** Runs one configuration through the engine, so counts are never hand-typed. */
function outcomeFor(
  knobs: Record<string, string | number>,
  declaration: TaskDeclaration = apple,
): {
  id: string
  outcome: RunOutcome
} {
  const result = runHarvest(
    declaration,
    firstFamily(declaration),
    knobs,
    appleArtifact(),
    'pool',
    appleTruth(),
  )
  if (!result.ok) {
    throw new Error(`expected ${JSON.stringify(knobs)} to run: ${result.issues[0]?.message}`)
  }
  return { id: result.configurationId, outcome: result.outcome }
}

const BALANCED = { blocks: 3, channels: 16, regularization: 1, dropout: 0 }
/** Crates no worms, but only because it throws away most ripe reds as well. */
const OVER_SELECTIVE = { blocks: 4, channels: 16, regularization: 1, dropout: 0 }
/** Crates its worms, because it barely tells a worm from a ripe red. */
const OVER_REGULARIZED = { blocks: 2, channels: 8, regularization: 3, dropout: 0.5 }

/** The year every report below belongs to. Any year: the screen states what it is given. */
const YEAR = 12

function renderReport(
  knobs: Record<string, string | number>,
  overrides: Partial<{
    declaration: TaskDeclaration
    money: { gross: string; downgrade: string }
    harvest: HarvestFigures
  }> = {},
) {
  const declaration = overrides.declaration ?? apple
  const { id, outcome } = outcomeFor(knobs, declaration)
  render(
    <Report
      declaration={declaration}
      year={YEAR}
      configurationId={id}
      evaluated={outcome.evaluated}
      earnings={outcome.earnings.toFixed(2)}
      counts={outcome.counts}
      rowEarnings={rowsOf(declaration, outcome)}
      {...(overrides.money === undefined ? {} : { money: overrides.money })}
      {...(overrides.harvest === undefined ? {} : { harvest: overrides.harvest })}
    />,
  )
  return outcome
}

/** What each category's pieces came to, from the engine rather than typed out. */
function rowsOf(
  declaration: TaskDeclaration,
  outcome: RunOutcome,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(earningsByCategory(declaration, outcome.counts)).map(([category, amount]) => [
      category,
      amount.toFixed(2),
    ]),
  )
}

/**
 * The column headers standing for declared actions, in the order they are drawn.
 *
 * The first column names the true category and the last states what that category's
 * pieces earned; neither is an action, and neither is the task's to name. Everything
 * between them is one declared action each, which is the claim these tests are about.
 */
function actionHeaders(): (string | null)[] {
  const headers = [...document.querySelectorAll('thead th[scope="col"]')]
  return headers.slice(1, headers.length - 1).map((header) => header.textContent)
}

/** The count in one category-and-action cell. */
function cell(category: string, action: string): number {
  const found = document.querySelector(`[data-cell="${category}:${action}"] .count`)
  if (found === null) throw new Error(`no cell for ${category} and ${action}`)
  return Number(found.textContent)
}

/** The action a category is declared to call for. */
function mappedTo(category: string): string {
  const action = apple.categoryActions[category]
  if (action === undefined) throw new Error(`no declared action for "${category}"`)
  return action
}

/** Every action the task declares that is not `category`'s own. */
function othersThan(category: string): string[] {
  return apple.actions.map((action) => action.id).filter((id) => id !== mappedTo(category))
}

/** Renders a declaration against an empty outcome, for tasks with no artifact of their own. */
function renderEmpty(declaration: TaskDeclaration) {
  render(
    <Report
      declaration={declaration}
      year={YEAR}
      configurationId="carequick"
      evaluated={0}
      earnings="0.00"
      counts={{}}
      rowEarnings={{}}
    />,
  )
}

describe('the fixture that tells a mapping from a diagonal', () => {
  it('is a declaration the real validator accepts', () => {
    // It goes through `validateDeclaration` inside the fixture, including the rule that a
    // category's declared action must strictly outpay every other action in its row. A
    // fixture that could not load would prove nothing about a screen that renders loaded
    // declarations.
    const shared = sharedActionDeclaration()

    expect(shared.categories.length).toBeGreaterThanOrEqual(3)
    expect(shared.actions.length).toBeGreaterThanOrEqual(2)
    for (const category of shared.categories) {
      const row = shared.payoffs[category.id] ?? {}
      const declared = row[shared.categoryActions[category.id] as string] as number
      for (const action of shared.actions) {
        if (action.id === shared.categoryActions[category.id]) continue
        expect(row[action.id] as number).toBeLessThan(declared)
      }
    }
  })

  it('maps two of its categories onto one action', () => {
    const shared = sharedActionDeclaration()
    const chosen = shared.categories.map((category) => shared.categoryActions[category.id])

    expect(new Set(chosen).size).toBeLessThan(chosen.length)
  })

  it('puts none of its declared cells on the diagonal', () => {
    // This is the whole reason the fixture exists. Marking `categories[i]` against
    // `actions[i]` would mark nothing this task calls for, so an implementation that read
    // position rather than the declared mapping fails outright rather than partly.
    const shared = sharedActionDeclaration()
    const onDiagonal = shared.categories.filter(
      (category, index) => shared.categoryActions[category.id] === shared.actions[index]?.id,
    )

    expect(onDiagonal).toEqual([])
  })

  it('has a column carrying the declared cell of more than one row', () => {
    const shared = sharedActionDeclaration()
    const perAction = new Map<string, number>()
    for (const category of shared.categories) {
      const action = shared.categoryActions[category.id] as string
      perAction.set(action, (perAction.get(action) ?? 0) + 1)
    }

    expect(Math.max(...perAction.values())).toBeGreaterThan(1)
  })
})

describe('the report is the payoff table filled with counts', () => {
  it('shows a cell for every declared category and action combination', () => {
    renderReport(BALANCED)

    expect(apple.categories.length * apple.actions.length).toBe(9)
    for (const category of apple.categories) {
      for (const action of apple.actions) {
        expect(
          document.querySelector(`[data-cell="${category.id}:${action.id}"]`),
          `missing cell for ${category.id} and ${action.id}`,
        ).not.toBeNull()
      }
    }
  })

  it('gives every declared action a column of its own, in declared order', () => {
    renderReport(BALANCED)

    // The first column heads the true-category rows and the last states what that row
    // earned; between them is one column per declared action, one each.
    expect(actionHeaders()).toEqual(apple.actions.map((action) => action.label))
  })

  it('includes combinations that happened zero times', () => {
    const outcome = renderReport(BALANCED)
    const zeroes = apple.categories.flatMap((category) =>
      apple.actions
        .filter((action) => (outcome.counts[category.id]?.[action.id] ?? 0) === 0)
        .map((action) => [category.id, action.id] as const),
    )

    expect(zeroes.length, 'this configuration was expected to leave some cells empty')
      .toBeGreaterThan(0)
    for (const [category, action] of zeroes) {
      expect(cell(category, action)).toBe(0)
    }
  })

  it('labels categories and actions as the task declares them', () => {
    renderReport(BALANCED)

    for (const category of apple.categories) {
      expect(screen.getByRole('rowheader', { name: category.label })).toBeDefined()
    }
    for (const action of apple.actions) {
      expect(screen.getByRole('columnheader', { name: action.label })).toBeDefined()
    }
  })

  it('shows the counts the engine returned, alongside the total', () => {
    const outcome = renderReport(BALANCED)

    for (const category of apple.categories) {
      for (const action of apple.actions) {
        expect(cell(category.id, action.id)).toBe(outcome.counts[category.id]?.[action.id] ?? 0)
      }
    }
    expect(screen.getByText(/Total earnings/).textContent).toContain(
      outcome.earnings.toFixed(2),
    )
  })

  it('carries one column fewer for a task declaring one action fewer', () => {
    // Same component, same file: a narrower task is rendered by the declaration it brings
    // rather than by a screen that was told how many actions to expect.
    const narrower = unrelatedDeclaration()
    expect(narrower.actions.length).toBe(apple.actions.length - 1)

    renderReport(BALANCED)
    const wide = actionHeaders().length
    cleanup()

    render(
      <Report
        declaration={narrower}
        year={YEAR}
        configurationId="sensitivitylow-photographsclinic"
        evaluated={0}
        earnings="0.00"
        counts={{}}
        rowEarnings={{}}
      />,
    )
    const narrow = actionHeaders()

    expect(narrow.length).toBe(wide - 1)
    expect(narrow).toEqual(narrower.actions.map((action) => action.label))
  })
})

/** The cells the rendered report marks, as `category:action` pairs in document order. */
function markedCells(): string[] {
  return [...document.querySelectorAll('[data-called-for]')].map(
    (cell) => cell.getAttribute('data-cell') as string,
  )
}

/** The cells a declaration's mapping names, as the same `category:action` pairs. */
function calledForCells(declaration: TaskDeclaration): string[] {
  return declaration.categories.map(
    (category) => `${category.id}:${declaration.categoryActions[category.id] as string}`,
  )
}

describe('every row identifies the cell its category calls for', () => {
  it('marks one cell per row, and it is the one the mapping names', () => {
    renderReport(BALANCED)

    expect(markedCells()).toEqual(calledForCells(apple))
    expect(markedCells()).toHaveLength(apple.categories.length)
  })

  it('reads the mapping rather than the position, for a task with no diagonal', () => {
    // The fixture maps two categories onto one action and puts no declared cell on the
    // diagonal, so a screen marking `categories[i]` against `actions[i]` would mark three
    // cells this task does not call for and none that it does.
    const shared = sharedActionDeclaration()
    renderEmpty(shared)

    const diagonal = shared.categories.map(
      (category, index) => `${category.id}:${shared.actions[index]?.id as string}`,
    )
    expect(markedCells()).toEqual(calledForCells(shared))
    for (const cellName of diagonal) {
      expect(markedCells()).not.toContain(cellName)
    }
  })

  it('marks a column twice when two categories call for the same action', () => {
    const shared = sharedActionDeclaration()
    renderEmpty(shared)

    const actions = markedCells().map((name) => name.split(':')[1])
    expect(new Set(actions).size).toBeLessThan(actions.length)
  })

  it('marks an empty cell exactly as it marks a full one', () => {
    // The whole point of the mark, on the configuration that earns it: this one crates its
    // worms, so the cell the wormy row is aiming at stands at zero while the red row's is
    // full. A mark that only appeared where something landed would hide exactly the finding
    // the student is here to make.
    renderReport(OVER_REGULARIZED)

    const marked = [...document.querySelectorAll('[data-called-for]')]
    const countIn = (cell: Element) => Number(cell.querySelector('.count')?.textContent)
    const empty = marked.filter((cell) => countIn(cell) === 0)
    const full = marked.filter((cell) => countIn(cell) > 0)

    expect(empty.length, 'this configuration was expected to starve a declared cell')
      .toBeGreaterThan(0)
    expect(full.length).toBeGreaterThan(0)
    for (const cell of [...empty, ...full]) {
      expect(cell.getAttribute('data-called-for')).toBe('')
    }
  })

  it('marks the same cells whatever the run did', () => {
    // The mark is a property of the task, not of the run: it comes from the declaration,
    // so an outcome whose counts contradict it changes nothing about which cells are
    // marked.
    const contradictory: RunOutcome = {
      evaluated: 3,
      earnings: -99,
      counts: Object.fromEntries(
        apple.categories.map((category) => [
          category.id,
          Object.fromEntries(apple.actions.map((action) => [action.id, 7])),
        ]),
      ),
      images: [],
    }
    render(
      <Report
        declaration={apple}
        year={YEAR}
        configurationId="whatever"
        evaluated={contradictory.evaluated}
        earnings={contradictory.earnings.toFixed(2)}
        counts={contradictory.counts}
        rowEarnings={{}}
      />,
    )

    expect(markedCells()).toEqual(calledForCells(apple))
  })
})

/** Property names set by the stylesheet rule that draws the marked cell. */
function markedCellProperties(): string[] {
  const css = readFileSync(join(process.cwd(), 'web/src/styles.css'), 'utf8')
  const rule = /\.report\s+td\[data-called-for\]\s*\{([^}]*)\}/.exec(css)
  if (rule === null) throw new Error('no stylesheet rule draws the marked cell')
  return (rule[1] as string)
    .split(';')
    .map((declaration) => declaration.split(':')[0]?.trim() ?? '')
    .filter((property) => property.length > 0)
}

describe('the mark is not carried by colour alone', () => {
  it('draws the marked cell with something other than a colour', () => {
    // jsdom applies no stylesheet, so a test asserting a computed colour here would assert
    // nothing at all. Reading the rule is the honest way to check that the cue survives a
    // student who cannot see the colour it would otherwise have been drawn in.
    const colourOnly = ['color', 'background', 'background-color', 'border-color', 'outline-color']
    const properties = markedCellProperties()

    expect(properties.length).toBeGreaterThan(0)
    expect(properties.filter((property) => !colourOnly.includes(property))).not.toEqual([])
  })

  it('says in words what the marking means, without naming a task', () => {
    renderReport(BALANCED)

    const caption = document.querySelector('caption')
    expect(caption).not.toBeNull()
    const text = (caption as HTMLElement).textContent ?? ''
    expect(text).toMatch(/outlined|ring|marked/i)
    for (const word of [
      ...apple.categories.map((category) => category.label),
      ...apple.actions.map((action) => action.label),
      'apple',
      'worm',
    ]) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase())
    }
  })

  it('tells a reader going cell by cell which one the row calls for', () => {
    renderReport(BALANCED)

    const marked = document.querySelector('[data-called-for]') as HTMLElement
    const plain = document.querySelector('td:not([data-called-for])') as HTMLElement

    expect(marked.textContent).toMatch(/calls for/i)
    expect(plain.textContent ?? '').not.toMatch(/calls for/i)
  })

  it('keeps the announcement out of the counted value', () => {
    // The hidden wording must not leak into the number a test or a reader takes from the
    // cell, or every count in the marked column would read as NaN.
    renderReport(BALANCED)

    for (const category of apple.categories) {
      for (const action of apple.actions) {
        expect(Number.isNaN(cell(category.id, action.id))).toBe(false)
      }
    }
  })
})

describe('marking the right cells does not become a score', () => {
  it('offers no count or proportion of images treated correctly', () => {
    // Marking the correct cells makes summing them the obvious next move, and that sum is
    // the single headline number this report exists to withhold. The guard is here rather
    // than in a note, because "we simply will not build that" is what gets built later.
    const outcome = renderReport(OVER_REGULARIZED)
    const marked = apple.categories.reduce(
      (sum, category) =>
        sum + (outcome.counts[category.id]?.[apple.categoryActions[category.id] as string] ?? 0),
      0,
    )
    expect(marked).not.toBe(outcome.evaluated)
    // The year is a number the report legitimately states; a collision would make the
    // check below pass or fail for the wrong reason.
    expect(marked, 'the marked total collides with the year on the report').not.toBe(YEAR)

    const section = document.querySelector('.report') as HTMLElement
    const table = section.querySelector('table') as HTMLElement
    const outsideTheTable = (section.textContent ?? '').replace(table.textContent ?? '', '')

    expect(outsideTheTable).not.toMatch(new RegExp(`\\b${marked}\\b`))
    expect(section.textContent ?? '').not.toMatch(/accurac|per cent|%/i)
  })

  it('leaves the total earnings as the only figure standing over the whole run', () => {
    const outcome = renderReport(BALANCED)
    const section = document.querySelector('.report') as HTMLElement
    const paragraphs = [...section.querySelectorAll('p')].map((p) => p.className)

    expect(paragraphs).toEqual(['configuration', 'earnings'])
    expect(screen.getByText(/Total earnings/).textContent).toContain(outcome.earnings.toFixed(2))
  })
})

describe('the declared order survives the marking', () => {
  it('keeps rows and columns as the task declares them, marks or no marks', () => {
    // The fixture's marks do not line up, which is what makes this worth asserting: once
    // the marks exist, sorting the columns to bring them into line is a tempting tidy-up,
    // and it would make the report a picture of itself rather than of the task.
    const shared = sharedActionDeclaration()
    renderEmpty(shared)

    const rows = [...document.querySelectorAll('tbody th[scope="row"]')].map(
      (header) => header.textContent,
    )

    expect(actionHeaders()).toEqual(shared.actions.map((action) => action.label))
    expect(rows).toEqual(shared.categories.map((category) => category.label))
  })
})

describe('an over-selective configuration is diagnosable on screen', () => {
  it('separates the missed reds from the correctly rejected worms', () => {
    const outcome = renderReport(OVER_SELECTIVE)

    // The trap: this configuration looks flawless on wormy apples while barely filling the
    // red crate at all. Both facts have to be visible, and in cells of their own — equal
    // counts would still be two separate readings.
    for (const action of othersThan('wormy')) {
      expect(cell('wormy', action)).toBe(0)
    }
    expect(cell('red', mappedTo('wormy'))).toBeGreaterThan(0)
    expect(cell('wormy', mappedTo('wormy'))).toBeGreaterThan(0)
    expect(document.querySelector(`[data-cell="red:${mappedTo('wormy')}"]`)).not.toBe(
      document.querySelector(`[data-cell="wormy:${mappedTo('wormy')}"]`),
    )
    expect(outcome.earnings).toBeLessThan(outcomeFor(BALANCED).outcome.earnings)
  })

  it('does not collapse the two into one score', () => {
    renderReport(OVER_SELECTIVE)

    const rejected = apple.categories.map((category) => cell(category.id, mappedTo('wormy')))

    expect(new Set(rejected).size).toBeGreaterThan(1)
  })

  it('tells a red in the wrong crate apart from a red on the reject heap', () => {
    // The resolution the third action bought. Under two actions both of these were the
    // same cell, and "downgraded half the crop" read as "refused half the crop".
    renderReport(OVER_SELECTIVE)

    const wrongCrate = othersThan('red').filter((action) => action !== mappedTo('wormy'))
    expect(wrongCrate).toHaveLength(1)
    expect(cell('red', wrongCrate[0] as string)).not.toBe(cell('red', mappedTo('wormy')))
    expect(
      document.querySelector(`[data-cell="red:${wrongCrate[0] as string}"]`),
    ).not.toBe(document.querySelector(`[data-cell="red:${mappedTo('wormy')}"]`))
  })
})

describe('a configuration that crates its worms', () => {
  it('says which crate the worms went into', () => {
    renderReport(OVER_REGULARIZED)

    const crates = othersThan('wormy')
    expect(crates).toHaveLength(2)
    expect(crates.map((action) => cell('wormy', action))).toEqual([2, 0])
    expect(cell('wormy', mappedTo('wormy'))).toBe(0)
  })

  it('counts the two crates separately when the worms go to both', () => {
    // A declared threshold policy, so the same six images are sorted into both crates:
    // p-004 misses the green threshold and is crated as red, p-005 clears it and is crated
    // as green. Two worms, two crates, two counts — and no cell that stands for "crated".
    const split = validateDeclaration({
      ...apple,
      policy: {
        kind: 'threshold',
        thresholds: { red: 0.5, green: 0.12, wormy: 0.9 },
        fallbackAction: mappedTo('wormy'),
        priority: ['green', 'red', 'wormy'],
      },
    })
    if (!split.ok) throw new Error(`the threshold variant must validate: ${split.issues[0]?.message}`)

    renderReport(OVER_REGULARIZED, { declaration: split.declaration })

    const crates = othersThan('wormy')
    expect(crates.map((action) => cell('wormy', action))).toEqual([1, 1])
    expect(cell('wormy', mappedTo('wormy'))).toBe(0)
    expect(document.querySelector(`[data-cell="wormy:${crates[0] as string}"]`)).not.toBe(
      document.querySelector(`[data-cell="wormy:${crates[1] as string}"]`),
    )
  })
})

describe('a report is the record of a year, not a readout of the knobs', () => {
  it('names the year it belongs to alongside the configuration that brought the crop in', () => {
    const { id } = outcomeFor(BALANCED)
    renderReport(BALANCED)

    const configuration = document.querySelector('.configuration') as HTMLElement
    expect(configuration.textContent).toContain(`Year ${String(YEAR)}`)
    expect(configuration.textContent).toContain(id)
    expect(configuration.textContent).toContain('images evaluated')
  })

  it('claims nothing about the knob values currently on screen', () => {
    renderReport(BALANCED)
    const section = document.querySelector('.report') as HTMLElement

    for (const claim of [/changed the knobs since/i, /run again/i, /current/i]) {
      expect(section.textContent ?? '', `the report claims ${String(claim)}`).not.toMatch(claim)
    }
  })

  it('identifies the labour and names no configuration for a crop brought in by hand', () => {
    render(
      <Report
        declaration={apple}
        year={YEAR}
        labour="Your own labour"
        evaluated={10}
        earnings="12.50"
        counts={{}}
        rowEarnings={{}}
      />,
    )

    const configuration = document.querySelector('.configuration') as HTMLElement
    expect(configuration.textContent).toContain('Your own labour')
    expect(configuration.textContent).toContain(`Year ${String(YEAR)}`)
    expect(configuration.querySelector('code')).toBeNull()
    expect(configuration.textContent).not.toMatch(/blocks\d/)
    // No family either: there is none to name, and inventing one would put a model's
    // name on a student's own work.
    for (const family of apple.families) {
      expect(configuration.textContent).not.toContain(family.label)
    }
  })

  it('names the family alongside the configuration for a crop a model brought in', () => {
    const family = firstFamily(apple)
    render(
      <Report
        declaration={apple}
        year={YEAR}
        configurationId="blocks2-channels16-regularization1-dropout0-datasetstarter"
        family={family.label}
        evaluated={10}
        earnings="12.50"
        counts={{}}
        rowEarnings={{}}
      />,
    )

    // An identifier alone no longer names one model: two families of a task can compose
    // the same string, so a report carrying one without the other names nothing traceable.
    const configuration = document.querySelector('.configuration') as HTMLElement
    expect(configuration.textContent).toContain(family.label)
    expect(configuration.querySelector('code')?.textContent).toBe(
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
    )
    expect(configuration.textContent).toContain(`Year ${String(YEAR)}`)
  })

  it('presents the earnings it is handed rather than formatting a figure of its own', () => {
    render(
      <Report
        declaration={apple}
        year={YEAR}
        configurationId="whatever"
        evaluated={3}
        earnings="coins 40"
        counts={{}}
        rowEarnings={{}}
      />,
    )

    expect(screen.getByText(/Total earnings/).textContent).toContain('coins 40')
  })
})

/**
 * A harvest record, with whatever the caller wants to say about the year.
 *
 * Every figure is the caller's: the screen states what it is handed, and a screen test
 * that had to run a whole year to get a warning on screen would be testing the year.
 */
function harvestOf(over: Partial<HarvestFigures> = {}): HarvestFigures {
  return {
    cropSize: 6000,
    composition: { red: 3300, green: 2100, wormy: 600 },
    grossUnits: 138_000,
    downgradeUnits: 0,
    downgraded: false,
    warned: false,
    delivered: 5000,
    measured: 300,
    share: 0.06,
    tolerance: 0.12,
    recurred: true,
    heldPictures: 1000,
    ...over,
  }
}

/** The declaration with a delivery term, so the arithmetic and the line are reachable. */
function withDelivery(): TaskDeclaration {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'declarations/apple-harvest.json'), 'utf8'),
  ) as Record<string, unknown>
  const result = validateDeclaration({
    ...raw,
    delivery: {
      measures: ['wormy'],
      delivering: ['crate-red', 'crate-green'],
      tolerance: 0.12,
      warnAbove: 0.09,
      downgradedValue: 0.05,
    },
  })
  if (!result.ok) throw new Error(`the patched declaration must validate: ${result.issues[0]?.message}`)
  return result.declaration
}

const delivering = withDelivery()

describe('the money is attached to the categories it came from', () => {
  it('states what each category’s pieces earned, in its own row', () => {
    const outcome = renderReport(OVER_REGULARIZED)
    const rows = earningsByCategory(apple, outcome.counts)

    for (const category of apple.categories) {
      const cell = document.querySelector(`[data-row-earnings="${category.id}"]`)
      expect(cell, `no earnings for "${category.id}"`).not.toBeNull()
      expect(cell?.textContent).toBe((rows[category.id] ?? 0).toFixed(2))
    }
  })

  it('has rows that come to the run’s own total rather than to something else', () => {
    const outcome = renderReport(BALANCED)
    const rows = earningsByCategory(apple, outcome.counts)
    const summed = Object.values(rows).reduce((total, amount) => total + amount, 0)
    expect(summed).toBeCloseTo(outcome.earnings, 8)
  })

  it('combines the money of no set of cells, the identified ones least of all', () => {
    // The same guard the count has: a figure summing what went right is the one number a
    // student could stop looking at, and money makes it more tempting rather than less.
    const outcome = renderReport(OVER_REGULARIZED, { harvest: harvestOf() })
    const right = apple.categories.reduce((sum, category) => {
      const action = apple.categoryActions[category.id] as string
      const count = outcome.counts[category.id]?.[action] ?? 0
      return sum + count * (apple.payoffs[category.id]?.[action] ?? 0)
    }, 0)

    const section = document.querySelector('.report') as HTMLElement
    expect(right).not.toBeCloseTo(outcome.earnings, 6)
    expect(section.textContent ?? '').not.toContain(right.toFixed(2))
    expect(section.textContent ?? '').not.toMatch(/accurac/i)
  })
})

describe('the arithmetic of what was paid', () => {
  it('shows the gross, the deduction and the paid figure when a term is declared', () => {
    const outcome = renderReport(BALANCED, {
      declaration: delivering,
      money: { gross: '1 380.00', downgrade: '1 130.00' },
      harvest: harvestOf({ downgraded: true, share: 0.2 }),
    })

    // Three figures whose arithmetic a reader can follow, each presented as handed over.
    expect(document.querySelector('[data-gross]')?.textContent).toBe('1 380.00')
    expect(document.querySelector('[data-downgrade]')?.textContent).toBe('1 130.00')
    expect(document.querySelector('[data-paid]')?.textContent).toContain(
      outcome.earnings.toFixed(2),
    )
  })

  it('shows the total alone when the task declares no term', () => {
    renderReport(BALANCED)
    expect(document.querySelector('[data-gross]')).toBeNull()
    expect(document.querySelector('[data-downgrade]')).toBeNull()
    expect(document.querySelector('[data-paid]')).not.toBeNull()
    expect(document.querySelector('[data-delivery]')).toBeNull()
  })
})

describe('the delivery line', () => {
  it('states the share, the count, the categories and the limit, from the declaration', () => {
    renderReport(BALANCED, { declaration: delivering, harvest: harvestOf() })
    const line = document.querySelector('[data-delivery]') as HTMLElement

    expect(line.querySelector('[data-delivered]')?.textContent).toBe('5000')
    expect(line.querySelector('[data-measured]')?.textContent).toBe('300')
    expect(line.querySelector('[data-share]')?.textContent).toBe('6%')
    expect(line.querySelector('[data-tolerance]')?.textContent).toBe('12%')
    expect(line.querySelector('[data-accepted]')).not.toBeNull()
    expect(line.querySelector('[data-downgraded]')).toBeNull()

    // The measured categories are named by their declared labels, read from the term.
    for (const category of delivering.delivery?.measures ?? []) {
      const label = delivering.categories.find((entry) => entry.id === category)?.label
      expect(line.textContent).toContain(label)
    }
  })

  it('says the delivery was downgraded when it was', () => {
    renderReport(BALANCED, {
      declaration: delivering,
      harvest: harvestOf({ downgraded: true, share: 0.2, downgradeUnits: 113_000 }),
    })
    const line = document.querySelector('[data-delivery]') as HTMLElement
    expect(line.querySelector('[data-downgraded]')).not.toBeNull()
    expect(line.querySelector('[data-accepted]')).toBeNull()
  })

  it('says so rather than showing a share when nothing was delivered', () => {
    renderReport(BALANCED, {
      declaration: delivering,
      harvest: harvestOf({ delivered: 0, measured: 0, share: undefined }),
    })
    const line = document.querySelector('[data-delivery]') as HTMLElement
    expect(line.querySelector('[data-share]')).toBeNull()
    expect(line.textContent).toMatch(/nothing/i)
  })

  it('names nothing belonging to any one task in the screen’s own words', () => {
    // A term measuring a category of another lesson entirely, rendered by the same screen.
    const other = validateDeclaration({
      ...JSON.parse(
        JSON.stringify(unrelatedDeclaration()),
      ) as Record<string, unknown>,
      delivery: {
        measures: ['diseased'],
        delivering: ['pass'],
        tolerance: 0.05,
        warnAbove: 0.02,
        downgradedValue: 0,
      },
    })
    if (!other.ok) throw new Error('the unrelated term must validate')

    render(
      <Report
        declaration={other.declaration}
        year={YEAR}
        configurationId="sensitivitylow-photographsclinic"
        evaluated={0}
        earnings="0.00"
        counts={{}}
        rowEarnings={{}}
        money={{ gross: '0.00', downgrade: '0.00' }}
        harvest={{
          cropSize: 40,
          composition: { healthy: 30, diseased: 10 },
          grossUnits: 0,
          downgradeUnits: 0,
          downgraded: false,
          warned: false,
          delivered: 20,
          measured: 3,
          share: 0.15,
          tolerance: 0.05,
          recurred: false,
        }}
      />,
    )

    const line = document.querySelector('[data-delivery]') as HTMLElement
    expect(line.textContent).toContain('Diseased patch')
    for (const category of apple.categories) {
      expect(line.textContent).not.toContain(category.label)
    }
  })
})

describe('the warning is where the downgrade would be', () => {
  it('appears when the harvest recorded one, beside the delivery line', () => {
    renderReport(BALANCED, {
      declaration: delivering,
      harvest: harvestOf({ warned: true, share: 0.1 }),
    })
    const line = document.querySelector('[data-delivery]') as HTMLElement
    expect(line.querySelector('[data-warned]')).not.toBeNull()
    // Same place a downgrade would be reported, which is what makes it read again later.
    expect(line.querySelector('[data-share]')).not.toBeNull()
  })

  it('is absent when the harvest recorded none', () => {
    renderReport(BALANCED, { declaration: delivering, harvest: harvestOf() })
    expect(document.querySelector('[data-warned]')).toBeNull()
  })
})

describe('the year is stated so a lean year can be attributed', () => {
  it('states the crop’s size and each category’s share, in declared labels', () => {
    renderReport(BALANCED, { declaration: delivering, harvest: harvestOf() })
    const stated = document.querySelector('[data-crop-size]') as HTMLElement

    expect(stated.getAttribute('data-crop-size')).toBe('6000')
    expect(stated.textContent).toContain('6000')
    for (const category of apple.categories) {
      expect(stated.textContent, `"${category.id}" is not stated`).toContain(category.label)
    }
    expect(stated.textContent).toContain('55%')
    expect(stated.textContent).toContain('35%')
    expect(stated.textContent).toContain('10%')
  })

  it('states an opening crop by what it drew, never by the shares it was drawn at', () => {
    // Five apples cannot be 55 / 35 / 10. The crop is two, two and one in every year this
    // farm ever draws, and printing the declared shares beside it would state something
    // untrue at exactly the moment a student is learning whether to trust the numbers.
    renderReport(BALANCED, {
      declaration: delivering,
      harvest: harvestOf({
        cropSize: 5,
        composition: { red: 2, green: 2, wormy: 1 },
        recurred: false,
      }),
    })
    const stated = document.querySelector('[data-crop-size]') as HTMLElement

    expect(stated.getAttribute('data-crop-size')).toBe('5')
    expect(stated.textContent).toContain('40%')
    expect(stated.textContent).toContain('20%')
    for (const declared of ['55%', '35%', '10%']) {
      expect(
        (document.querySelector('.report') as HTMLElement).textContent ?? '',
        `the report states the declared share ${declared} beside a crop that did not draw it`,
      ).not.toContain(declared)
    }
  })

  it('presents the difference between two years as neither noise, variance nor error', () => {
    for (const share of [0.07, 0.14]) {
      renderReport(BALANCED, {
        declaration: delivering,
        harvest: harvestOf({
          composition: { red: 3300, green: 2100, wormy: Math.round(6000 * share) },
        }),
      })
      const section = document.querySelector('.report') as HTMLElement
      for (const word of [/\bnoise\b/i, /\bvariance\b/i, /\berror\b/i, /\brandom\b/i, /\bsampling\b/i]) {
        expect(section.textContent ?? '', `the report calls the year ${String(word)}`).not.toMatch(
          word,
        )
      }
      cleanup()
    }
  })
})

describe('recurring photographs are disclosed', () => {
  it('states that they recur and how many the pool holds', () => {
    renderReport(BALANCED, { declaration: delivering, harvest: harvestOf() })
    const stated = document.querySelector('[data-recurrence]') as HTMLElement
    expect(stated.getAttribute('data-recurrence')).toBe('1000')
    expect(stated.textContent).toContain('1000')
    expect(stated.textContent).toContain('6000')
  })

  it('states nothing for a crop that repeated nothing', () => {
    renderReport(BALANCED, {
      declaration: delivering,
      harvest: harvestOf({ cropSize: 300, composition: { red: 165, green: 105, wormy: 30 }, recurred: false, heldPictures: undefined }),
    })
    expect(document.querySelector('[data-recurrence]')).toBeNull()
  })
})

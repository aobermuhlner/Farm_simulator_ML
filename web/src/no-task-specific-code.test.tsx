import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatUnits } from '../../src/economy/index.js'
import {
  computeAvailability,
  knobAvailability,
  taskAvailability,
} from '../../src/progression/index.js'
import { KnobControl } from './components/KnobControl.js'
import { HandSort } from './screens/HandSort.js'
import { measureSort } from '../../src/sorting/index.js'
import { appleDeclaration, unrelatedDeclaration } from './test-support/declarations.js'
import { farmDeclaration } from './test-support/farm.js'
import { cropOf, loadsCrop } from './test-support/pool.js'
import { shippedCatalog, soundCatalog } from './test-support/progression.js'
import type { SummaryFact } from './components/FarmBar.js'

const repoRoot = process.cwd()
const webSrc = join(repoRoot, 'web/src')

/**
 * The screens, excluding tests, test support, and the data manifest.
 *
 * `data/paths.ts` is the one deliberate exception: something has to say which
 * task this build ships, and a URL to a declaration file is data wiring rather
 * than screen code. Everything else must be able to render a task it has never
 * heard of.
 */
function screenSources(): string[] {
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
      if (relative(webSrc, path).replace(/\\/g, '/') === 'data/paths.ts') continue
      files.push(path)
    }
  }
  walk(webSrc)
  return files
}

const apple = appleDeclaration()
const farm = farmDeclaration()

/**
 * Every word the farm declares — none may appear in the screens.
 *
 * The farm's own vocabulary is under the same rule as a task's: the bar is produced from
 * the declaration and the facts it is supplied, and names nothing of its own. The fact
 * labels are drawn from whatever the bar is supplied, which is nothing yet — the list is
 * built from the supply rather than hard-coded so it grows with the changes that add to
 * it.
 *
 * The name is matched whole. Its individual words are not the farm's to reserve: a farm
 * called anything with "Farm" in it would otherwise outlaw the word on the overview.
 */
const SUPPLIED_FACTS: readonly SummaryFact[] = []

/**
 * The farm's own labour, as its declaration presents it.
 *
 * Under the same rule as the currency: a labour slot is handed an icon and a label and
 * presents them, so a farm calling its hands something else renders through the same
 * screen. A screen that wrote either out would fail here.
 */
const DECLARED_LABOUR_WORDS = [farm.manualLabour?.icon, farm.manualLabour?.label].filter(
  (word): word is string => word !== undefined,
)

const DECLARED_FARM_WORDS = [
  farm.name,
  farm.currency,
  ...DECLARED_LABOUR_WORDS,
  ...SUPPLIED_FACTS.map((fact) => fact.label),
]

/** Reports every declared word that appears in a source's rendered strings. */
function leaks(text: string, vocabulary: readonly string[]): string[] {
  // Comments explain the design; only rendered strings are the concern, so
  // strip line and block comments before looking.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return vocabulary.filter((word) => code.includes(word))
}

const catalog = shippedCatalog()

/**
 * Every id the catalog declares — item ids and group ids.
 *
 * Matched the way a task's ids are: in quotes, or on the left of a comparison. A group id
 * like `data` is an ordinary word inside a path, and an import is wiring rather than
 * rendered text, so anything looser would outlaw `./data/load.js`.
 */
const DECLARED_CATALOG_IDS = [
  ...catalog.items.map((item) => item.id),
  ...catalog.groups.map((group) => group.id),
]

/**
 * Every label the catalog declares — item labels and group labels.
 *
 * Matched whole, the way the farm's name is: a group label like "Data" lives inside
 * `TaskDataPaths`, and its letters are not the catalog's to reserve. Shop copy is not
 * matched at all, because a sentence cannot be pasted into a screen without its label
 * going with it, and the label is what is checked.
 */
const DECLARED_CATALOG_LABELS = [
  ...catalog.items.map((item) => item.label),
  ...catalog.groups.map((group) => group.label),
]

/** Reports every declared label appearing as a whole word in a source. */
function labelLeaks(text: string, vocabulary: readonly string[]): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return vocabulary.filter((word) =>
    new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(code),
  )
}

/**
 * Reports every declared id appearing as a quoted string or on the left of a comparison.
 *
 * Comments go first, for the same reason they do above: `FarmBar`'s own comment quotes
 * §5.1's mockup, which writes "data: 1 000 photos", and a mockup in prose is not a screen
 * branching on a group id.
 */
function idLeaks(text: string, ids: readonly string[]): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return ids.filter((id) => new RegExp(`['"\`]${id}['"\`]|\\b${id}\\b\\s*(===|!==|:)`).test(code))
}

/** Every id the apple declaration declares — none may appear in the screens. */
const DECLARED_IDS = [
  apple.id,
  ...apple.categories.map((category) => category.id),
  ...apple.actions.map((action) => action.id),
  ...apple.knobs.map((knob) => knob.id),
  ...apple.features.map((feature) => feature.id),
]

/**
 * Every feature label the task declares.
 *
 * Under the same rule as a category label: a screen presenting features renders them from
 * the declaration, so adding, removing or renaming one is a data change. Matched whole,
 * the way the catalog labels are — the individual words of "Dark patch area" are not the
 * task's to reserve.
 */
const DECLARED_FEATURE_LABELS = apple.features.map((feature) => feature.label)

describe('the shell contains no task-specific code paths', () => {
  it('has screens to check', () => {
    expect(screenSources().length).toBeGreaterThan(4)
  })

  it('checks the ids the task actually declares, however many actions that is', () => {
    // The vocabulary is built from the declaration, so widening the action set widens what
    // is forbidden without anyone remembering to update a list. The second test task stays
    // at two actions on purpose: between them the suite proves the screens assume neither
    // two nor three.
    expect(DECLARED_IDS).toEqual(expect.arrayContaining(apple.actions.map((a) => a.id)))
    expect(apple.actions).toHaveLength(3)
    expect(unrelatedDeclaration().actions).toHaveLength(2)
  })

  it('names no declared id of the apple task', () => {
    const offences: string[] = []

    for (const file of screenSources()) {
      const text = readFileSync(file, 'utf8')
      for (const id of DECLARED_IDS) {
        // Word-boundary match, so `pick` catches a branch on the action id but
        // not the word "picked" in a comment about the control.
        const pattern = new RegExp(`['"\`]${id}['"\`]|\\b${id}\\b\\s*(===|!==|:)`)
        if (pattern.test(text)) {
          offences.push(`${relative(repoRoot, file)} names "${id}"`)
        }
      }
    }

    expect(offences).toEqual([])
  })

  it('names no declared feature of the apple task, by id or by label', () => {
    // A screen presenting features renders them from the declaration, so dropping one or
    // renaming it is a data change. The ids are already covered by DECLARED_IDS above;
    // this adds the labels, which are what a screen would be tempted to write out.
    expect(DECLARED_FEATURE_LABELS.length).toBeGreaterThan(4)

    const offences: string[] = []
    for (const file of screenSources()) {
      for (const label of labelLeaks(readFileSync(file, 'utf8'), DECLARED_FEATURE_LABELS)) {
        offences.push(`${relative(repoRoot, file)} names "${label}"`)
      }
    }
    expect(offences).toEqual([])
  })

  it('branches on no declared category or action anywhere in the screens', () => {
    const vocabulary = [
      ...apple.categories.map((category) => category.label),
      ...apple.actions.map((action) => action.label),
      'apple',
      'Apple',
      'wormy',
      'orchard',
    ]
    const offences: string[] = []

    for (const file of screenSources()) {
      for (const word of leaks(readFileSync(file, 'utf8'), vocabulary)) {
        offences.push(`${relative(repoRoot, file)} contains "${word}"`)
      }
    }

    expect(offences).toEqual([])
  })
})

describe('the shell contains no farm-specific code paths', () => {
  it('has a farm vocabulary to check', () => {
    expect(DECLARED_FARM_WORDS.length).toBeGreaterThan(1)
    expect(DECLARED_FARM_WORDS).toContain(farm.currency)
    expect(DECLARED_FARM_WORDS).toContain(farm.name)
  })

  it('names no word the farm declares', () => {
    const offences: string[] = []

    for (const file of screenSources()) {
      for (const word of leaks(readFileSync(file, 'utf8'), DECLARED_FARM_WORDS)) {
        offences.push(`${relative(repoRoot, file)} contains "${word}"`)
      }
    }

    expect(offences).toEqual([])
  })

  it('catches a currency label pasted into a screen', () => {
    const pasted = `export function Bar() {
  return <p>${farm.currency} 0.00</p>
}
`
    expect(leaks(pasted, DECLARED_FARM_WORDS)).toEqual([farm.currency])
  })

  it('has the farm’s own labour in its vocabulary, icon and label alike', () => {
    // The slot is the one place a screen would be tempted to write "by hand" and a glyph.
    expect(DECLARED_LABOUR_WORDS.length).toBe(2)
    for (const word of DECLARED_LABOUR_WORDS) expect(DECLARED_FARM_WORDS).toContain(word)
  })

  it('catches the labour’s declared label pasted into a slot', () => {
    const pasted = `export function Slot() {
  return <p className="labour-slot">${farm.manualLabour?.label ?? ''}</p>
}
`
    expect(leaks(pasted, DECLARED_FARM_WORDS)).toEqual([farm.manualLabour?.label])
  })

  it('catches the labour’s declared icon pasted into a slot', () => {
    const pasted = `export function Slot() {
  return <span aria-hidden="true">${farm.manualLabour?.icon ?? ''}</span>
}
`
    expect(leaks(pasted, DECLARED_FARM_WORDS)).toEqual([farm.manualLabour?.icon])
  })

  it('catches the farm’s name pasted into a screen', () => {
    const pasted = `export function Bar() {
  return <h1>${farm.name}</h1>
}
`
    expect(leaks(pasted, DECLARED_FARM_WORDS)).toEqual([farm.name])
  })

  it('names the declared currency label nowhere in the engine either', () => {
    // The spec puts engine code under the same rule as screen code: the label is
    // declared, so nothing may carry a copy of it.
    const engineFiles: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.ts$/.test(name)) engineFiles.push(path)
      }
    }
    walk(join(repoRoot, 'src'))

    const offences: string[] = []
    for (const file of engineFiles) {
      for (const word of leaks(readFileSync(file, 'utf8'), [farm.currency])) {
        offences.push(`${relative(repoRoot, file)} contains "${word}"`)
      }
    }

    expect(offences).toEqual([])
  })

  it('is not fooled by a declared word that only appears in a comment', () => {
    expect(leaks(`// the label is ${farm.currency}
export const x = 1
`, DECLARED_FARM_WORDS)).toEqual(
      [],
    )
  })
})

describe('the shell contains no catalog-specific code paths', () => {
  it('has a catalog vocabulary to check', () => {
    expect(DECLARED_CATALOG_IDS.length).toBeGreaterThan(4)
    expect(DECLARED_CATALOG_LABELS.length).toBeGreaterThan(4)
  })

  it('names no id the catalog declares', () => {
    const offences: string[] = []
    for (const file of screenSources()) {
      for (const id of idLeaks(readFileSync(file, 'utf8'), DECLARED_CATALOG_IDS)) {
        offences.push(`${relative(repoRoot, file)} names "${id}"`)
      }
    }
    expect(offences).toEqual([])
  })

  it('names no label the catalog declares', () => {
    const offences: string[] = []
    for (const file of screenSources()) {
      for (const word of labelLeaks(readFileSync(file, 'utf8'), DECLARED_CATALOG_LABELS)) {
        offences.push(`${relative(repoRoot, file)} contains "${word}"`)
      }
    }
    expect(offences).toEqual([])
  })

  it('catches an item label pasted into a screen', () => {
    const label = catalog.items[0]?.label ?? ''
    const pasted = `export function Row() {
  return <h3>${label}</h3>
}
`
    expect(labelLeaks(pasted, DECLARED_CATALOG_LABELS)).toEqual([label])
  })

  it('catches a group label pasted into a screen', () => {
    const label = catalog.groups[0]?.label ?? ''
    const pasted = `export function Section() {
  return <h2>${label}</h2>
}
`
    expect(labelLeaks(pasted, DECLARED_CATALOG_LABELS)).toEqual([label])
  })

  it('catches an item id branched on in a screen', () => {
    const id = catalog.items[0]?.id ?? ''
    expect(idLeaks(`if (item.id === '${id}') return null`, DECLARED_CATALOG_IDS)).toEqual([id])
  })

  it('is not fooled by a label that only appears in a comment', () => {
    const label = catalog.items[0]?.label ?? ''
    expect(
      labelLeaks(
        `// the row is ${label}
export const x = 1
`,
        DECLARED_CATALOG_LABELS,
      ),
    ).toEqual([])
  })

  it('is not fooled by a group id inside an import path', () => {
    expect(idLeaks(`import { loadTask } from './data/load.js'`, DECLARED_CATALOG_IDS)).toEqual([])
  })
})

describe('no screen names an unlock condition', () => {
  it('pairs no item id with a knob id anywhere in the screens', () => {
    const knobIds = apple.knobs.map((knob) => knob.id)
    const itemIds = catalog.items.map((item) => item.id)
    const offences: string[] = []

    for (const file of screenSources()) {
      const text = readFileSync(file, 'utf8')
      const items = idLeaks(text, itemIds)
      const knobs = idLeaks(text, knobIds)
      if (items.length > 0 && knobs.length > 0) {
        offences.push(
          `${relative(repoRoot, file)} pairs ${items.join(', ')} with ${knobs.join(', ')}`,
        )
      }
      // Neither half may be there at all, which is the stronger claim of the two.
      if (items.length > 0) offences.push(`${relative(repoRoot, file)} names ${items.join(', ')}`)
      if (knobs.length > 0) offences.push(`${relative(repoRoot, file)} names ${knobs.join(', ')}`)
    }

    expect(offences).toEqual([])
  })

  it('reads what opens a locked thing from the catalog, wherever it is shown', () => {
    // A catalog sharing nothing with the shipped one. If the opener's label and price
    // reach the screen, they were read from the value rather than written into a
    // component — which is the only way a market for another farm can render here.
    const knob = apple.knobs[0]
    if (knob === undefined) throw new Error('the task must declare a knob')
    const other = soundCatalog({
      schemaVersion: '1.0.0',
      groups: [{ id: 'toolshed', label: 'Toolshed' }],
      ownedAtStart: [],
      items: [
        {
          id: 'brass-callipers',
          group: 'toolshed',
          label: 'Brass callipers',
          copy: 'For measuring things very precisely.',
          price: 5,
          opens: [{ kind: 'knob-values', task: apple.id, knob: knob.id, values: [3] }],
        },
      ],
    })
    const task = taskAvailability(computeAvailability(other, [apple], []), apple.id)
    if (task === undefined) throw new Error('the availability must cover the task')

    render(
      <KnobControl
        knob={knob}
        value={knob.default}
        onChange={() => undefined}
        availability={knobAvailability(task, knob.id)?.values}
        formatPrice={(units) => formatUnits(units, farm)}
      />,
    )

    const note = screen.getByText(/Brass callipers/)
    expect(note.textContent).toContain('Brass callipers')
    expect(note.textContent).toContain(formatUnits(500, farm))
    cleanup()
  })
})

describe('a farm stage renders a task it has never heard of', () => {
  const other = unrelatedDeclaration()
  const categories = other.categories.map((category) => category.id)

  /** A crop of that task's own categories, two of each, with no pool on disk. */
  const crop = cropOf(
    categories.flatMap((category) => [
      { imageId: `${category}-1`, category },
      { imageId: `${category}-2`, category },
    ]),
  )

  it('is a screen the source rules already cover', () => {
    const covered = screenSources().map((file) => relative(webSrc, file).split(sep).join('/'))
    expect(covered).toContain('screens/HandSort.tsx')
  })

  it('offers that task’s own actions, in its own order, with a key each', async () => {
    render(
      <HandSort
        declaration={other}
        load={loadsCrop(crop)}
        onSettle={() => undefined}
        formatAmount={(amount) => String(amount)}
        onBack={() => undefined}
      />,
    )
    await screen.findByRole('img', { name: 'The piece you are deciding about' })

    const controls = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-action'))
    expect(controls.map((button) => button.getAttribute('data-action'))).toEqual(
      other.actions.map((action) => action.id),
    )
    for (const action of other.actions) {
      expect(screen.getByRole('button', { name: new RegExp(action.label) })).toBeTruthy()
    }
    // Two actions here against the shipped task's three, so a screen that had learned
    // either count would fail against the other.
    expect(other.actions).toHaveLength(2)
    cleanup()
  })

  it('breaks its summary down by that task’s own categories and actions', () => {
    const outcome = measureSort(
      other,
      crop,
      crop.truth,
      crop.presented.map((piece) => ({
        imageId: piece.imageId,
        action: other.actions[0]?.id ?? '',
        elapsedMs: 1000,
      })),
    )

    render(
      <HandSort
        declaration={other}
        load={loadsCrop(crop)}
        outcome={outcome}
        onSettle={() => undefined}
        formatAmount={(amount) => String(amount)}
        onBack={() => undefined}
      />,
    )

    for (const category of other.categories) {
      for (const action of other.actions) {
        expect(
          document.querySelector(`[data-cell="${category.id}:${action.id}"]`),
          `${category.id} × ${action.id} is missing`,
        ).not.toBeNull()
      }
    }
    // And nothing of the shipped lesson's vocabulary is on the screen it renders.
    const text = document.body.textContent ?? ''
    for (const category of apple.categories) expect(text).not.toContain(category.label)
    cleanup()
  })
})

describe('the engine stays framework-free', () => {
  it('imports nothing from the screens and nothing from React', () => {
    const engineFiles: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.ts$/.test(name)) engineFiles.push(path)
      }
    }
    walk(join(repoRoot, 'src'))

    const offences = engineFiles.filter((file) => {
      const text = readFileSync(file, 'utf8')
      return /from ['"][^'"]*web\//.test(text) || /from ['"]react/.test(text)
    })

    expect(engineFiles.length).toBeGreaterThan(4)
    // The economy, the progression module and the save codec are all engine code, so the
    // purity rule has to be seen to cover each of them rather than merely to have walked
    // past it. A module the walk missed would pass this test by being absent.
    for (const [module, least] of [
      ['economy', 3],
      ['progression', 5],
      ['save', 1],
    ] as const) {
      expect(
        engineFiles.filter((file) => relative(repoRoot, file).split(/[\\/]/).includes(module))
          .length,
        `${module} is not covered by the purity walk`,
      ).toBeGreaterThanOrEqual(least)
    }
    expect(offences.map((file) => relative(repoRoot, file))).toEqual([])
  })
})

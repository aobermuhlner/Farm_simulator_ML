import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appleDeclaration } from './test-support/declarations.js'
import { farmDeclaration } from './test-support/farm.js'
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

const DECLARED_FARM_WORDS = [
  farm.name,
  farm.currency,
  ...SUPPLIED_FACTS.map((fact) => fact.label),
]

/** Reports every declared word that appears in a source's rendered strings. */
function leaks(text: string, vocabulary: readonly string[]): string[] {
  // Comments explain the design; only rendered strings are the concern, so
  // strip line and block comments before looking.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return vocabulary.filter((word) => code.includes(word))
}

/** Every id the apple declaration declares — none may appear in the screens. */
const DECLARED_IDS = [
  apple.id,
  ...apple.categories.map((category) => category.id),
  ...apple.actions.map((action) => action.id),
  ...apple.knobs.map((knob) => knob.id),
]

describe('the shell contains no task-specific code paths', () => {
  it('has screens to check', () => {
    expect(screenSources().length).toBeGreaterThan(4)
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
    // The economy is engine code, so the purity rule has to be seen to cover it rather
    // than merely to have walked past it.
    expect(
      engineFiles.filter((file) => relative(repoRoot, file).includes('economy')).length,
    ).toBeGreaterThan(2)
    expect(offences.map((file) => relative(repoRoot, file))).toEqual([])
  })
})

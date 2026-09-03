import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appleDeclaration } from './test-support/declarations.js'

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
      const text = readFileSync(file, 'utf8')
      // Comments explain the design; only rendered strings are the concern, so
      // strip line and block comments before looking.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const word of vocabulary) {
        if (code.includes(word)) offences.push(`${relative(repoRoot, file)} contains "${word}"`)
      }
    }

    expect(offences).toEqual([])
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
    expect(offences.map((file) => relative(repoRoot, file))).toEqual([])
  })
})

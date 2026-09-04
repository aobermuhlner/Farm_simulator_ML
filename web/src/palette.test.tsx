import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RED_GREEN_DEFICIENCIES,
  SCREEN_THRESHOLDS,
  compareSets,
  distance,
  distanceFailure,
} from '../../src/colour-vision/index.js'

/**
 * The stylesheet's palette, measured rather than looked at.
 *
 * `openspec/changes/colour-accessibility/specs/colour-vision-safety/spec.md` — the rule is
 * the same one the pool's images are held to, and it is imported from the same module on
 * purpose: two suites disagreeing about what "distinguishable" means would be worse than
 * one shared check.
 *
 * The stylesheet is parsed as text rather than measured through a rendered DOM, because
 * what has to be verified is the *declaration* — every colour the product may draw a
 * distinction in — and jsdom resolves no custom property it was not told about anyway.
 */

// Read from the repository root rather than from `import.meta.url`: these screen tests
// run under jsdom, where the module URL is not a file URL.
const CSS = readFileSync(resolve(process.cwd(), 'web/src/styles.css'), 'utf8')

/** The two theme blocks a colour can be declared in. */
type Theme = 'light' | 'dark'

/**
 * The palette tokens of one theme.
 *
 * Light is the bare `:root` block at the top; dark is the `:root` nested in the
 * `prefers-color-scheme` media query. Anything outside both is not a declared colour, and
 * the last test in this file is what keeps that true.
 */
function tokenBlock(theme: Theme): string {
  if (theme === 'dark') {
    const media = /@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/.exec(CSS)
    if (media === null) throw new Error('no dark :root block in styles.css')
    return media[1] as string
  }
  const root = /^:root \{([^}]*)\}/m.exec(CSS)
  if (root === null) throw new Error('no light :root block in styles.css')
  return root[1] as string
}

function tokens(theme: Theme): Readonly<Record<string, string>> {
  const found: Record<string, string> = {}
  for (const [, name, value] of tokenBlock(theme).matchAll(
    /(--[a-z-]+)\s*:\s*(#[0-9a-f]{6})\s*;/g,
  )) {
    found[name as string] = value as string
  }
  return found
}

const THEMES: readonly Theme[] = ['light', 'dark']

/**
 * Every pair of tokens that carries a distinction on its own.
 *
 * Declared here because the stylesheet cannot say which of its colours are read against
 * which; a token pair absent from this list is a distinction nothing checks. Today the
 * product draws exactly one: the training replay's two curves. When
 * `three-action-sorting` and `manual-sorting` colour the crates and the confusion matrix,
 * their tokens belong here too.
 */
const DISTINGUISHING_PAIRS: readonly (readonly [string, string])[] = [
  ['--series-fitted', '--series-held-out'],
]

describe('the declared palette under simulated colour vision deficiency', () => {
  it.each(THEMES)('declares every pair it draws a distinction in, in the %s theme', (theme) => {
    const declared = tokens(theme)
    for (const pair of DISTINGUISHING_PAIRS) {
      for (const name of pair) {
        expect(declared[name], `${name} in the ${theme} theme`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it.each(
    THEMES.flatMap((theme) =>
      RED_GREEN_DEFICIENCIES.flatMap((deficiency) =>
        DISTINGUISHING_PAIRS.map((pair) => [theme, deficiency, pair] as const),
      ),
    ),
  )('keeps %s theme %s apart for %s', (theme, deficiency, pair) => {
    const declared = tokens(theme)
    const [one, two] = pair
    const comparison = compareSets(
      [{ name: `${one} (${theme})`, hex: declared[one] as string }],
      [{ name: `${two} (${theme})`, hex: declared[two] as string }],
      deficiency,
    )
    expect(distanceFailure(comparison, SCREEN_THRESHOLDS.deficiency)).toBeUndefined()
  })

  it('records what the series pair measures, so a later edit shows what it moved', () => {
    // `design.md` states 48.6 and 49.0 against the figures the pair replaced: 10.0 in the
    // light theme and 5.1 in the dark one, the latter a pair a deuteranope reads as one
    // colour.
    const measured = Object.fromEntries(
      THEMES.map((theme) => {
        const declared = tokens(theme)
        return [
          theme,
          Math.round(
            distance(
              declared['--series-fitted'] as string,
              declared['--series-held-out'] as string,
              'deuteranopia',
            ) * 10,
          ) / 10,
        ]
      }),
    )
    expect(measured).toEqual({ light: 48.6, dark: 49.0 })
  })

  it('would refuse the warning colour if the held-out series were set back to it', () => {
    // The check has to be the reason the pair moved, not a record of it having moved.
    for (const theme of THEMES) {
      const declared = tokens(theme)
      const regressed = compareSets(
        [{ name: '--series-fitted', hex: declared['--series-fitted'] as string }],
        [{ name: '--warn', hex: declared['--warn'] as string }],
        'deuteranopia',
      )
      expect(distanceFailure(regressed, SCREEN_THRESHOLDS.deficiency)).toBeDefined()
    }
  })

  it('leaves the warning colour where it is read, against paper rather than a series', () => {
    // `--warn` is the colour of a problem, on the issues panel. Nothing in this file
    // governs it, which is why moving the series off it was the fix rather than moving it.
    expect(CSS).toMatch(/\.issues \{[^}]*var\(--warn\)/)
    expect(CSS).toMatch(/\.issues h3 \{[^}]*var\(--warn\)/)
  })
})

describe('a colour the check cannot see cannot be introduced', () => {
  it('declares every colour in the product inside the two palette blocks', () => {
    // A literal further down the file is a colour no pair above can name and no threshold
    // covers. Refusing all of them, rather than trying to guess which ones carry a
    // category, is what makes the coverage structural.
    const blocks = THEMES.map(tokenBlock)
    let rest = CSS
    for (const block of blocks) rest = rest.replace(block, '')

    const literals = [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0])
    expect(
      literals,
      `colour literals outside the palette blocks: ${literals.join(', ')}`,
    ).toEqual([])
  })

  it('names the offending literal when one is introduced', () => {
    // The failure has to say where the colour was found, so the fix is "move it into the
    // palette" rather than "something is wrong with the stylesheet".
    const doctored = `${CSS}\n.crate.red { background: #cc2200; }\n`
    let rest = doctored
    for (const theme of THEMES) rest = rest.replace(tokenBlock(theme), '')
    const literals = [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0])
    expect(literals).toEqual(['#cc2200'])
  })
})

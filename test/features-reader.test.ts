import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { columnOf, declarationOf, featureIds, featureOf, vectorOf } from '../src/features/index.js'
import { readPool, type LoadedPool } from '../src/pool/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const apple: TaskDeclaration = appleDeclaration()

function loadedPool(): LoadedPool {
  const raw = JSON.parse(
    readFileSync(`${repoRoot}pools/apple-harvest/manifest.json`, 'utf8'),
  ) as unknown
  const result = readPool(raw, apple)
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
  return result.pool
}

const pool = loadedPool()

describe('reading a measured feature out of the pool', () => {
  it('returns the value the manifest recorded, unchanged', () => {
    const recorded = pool.images['t-001']?.features.redness
    expect(featureOf(pool, 't-001', 'redness')).toBe(recorded)
  })

  it('returns nothing for an image the pool does not have', () => {
    expect(featureOf(pool, 'not-an-image', 'redness')).toBeUndefined()
    expect(vectorOf(apple, pool, 'not-an-image')).toBeUndefined()
  })

  it('returns a whole vector keyed by the ids the task declares', () => {
    const vector = vectorOf(apple, pool, 't-004')
    expect(Object.keys(vector ?? {}).sort()).toEqual([...featureIds(apple)].sort())
  })

  it('reads a column in the order the images are named', () => {
    const ids = ['t-004', 't-001', 't-007']
    expect(columnOf(pool, ids, 'spotCount')).toEqual(
      ids.map((id) => pool.images[id]?.features.spotCount),
    )
  })

  it('finds the declaration for a feature, and nothing for one the task omits', () => {
    expect(declarationOf(apple, 'redness')?.label).toBe(
      apple.features.find((feature) => feature.id === 'redness')?.label,
    )
    expect(declarationOf(apple, 'greenness')).toBeUndefined()
  })
})

describe('the reader measures nothing', () => {
  const sources = readdirSync(`${repoRoot}src/features`)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, text: readFileSync(`${repoRoot}src/features/${name}`, 'utf8') }))

  it('has the reader and the checks to look at', () => {
    expect(sources.map((source) => source.name)).toContain('index.ts')
  })

  it('imports nothing from the pool tools, where the measurement lives', () => {
    for (const source of sources) {
      // Import statements only. The comments point at `tools/pool/features.ts` on purpose,
      // to say where the measurement went; a reader saying so is the opposite of a reader
      // reaching for it.
      const imports = [...source.text.matchAll(/from '([^']+)'/g)].map((match) => match[1])
      for (const specifier of imports) {
        expect(specifier, `src/features/${source.name} imports ${specifier}`).not.toContain('tools/')
      }
    }
  })

  it('touches no pixel, no atlas and no rasterizer', () => {
    for (const source of sources) {
      const code = source.text
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n')
      for (const forbidden of ['pixel', 'Resvg', 'atlas', 'rgba', 'canvas', 'luminance']) {
        expect(
          code.toLowerCase(),
          `src/features/${source.name} names ${forbidden}`,
        ).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  it('reads every value it reports straight out of the manifest', () => {
    // The strong form of the same claim: for every image and every feature, what the
    // reader returns is identical to what the file says. A reader that recomputed
    // anything — rescaled, clamped, rounded — would differ somewhere in 1 200 rows.
    const raw = JSON.parse(
      readFileSync(`${repoRoot}pools/apple-harvest/manifest.json`, 'utf8'),
    ) as { images: Record<string, { features: Record<string, number> }> }

    for (const [id, image] of Object.entries(raw.images)) {
      for (const feature of apple.features) {
        expect(featureOf(pool, id, feature.id)).toBe(image.features[feature.id])
      }
    }
  })
})

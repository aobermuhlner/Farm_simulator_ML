import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTrainingSplit } from './pool.js'
import { dataUrlFor } from './paths.js'
import { appleDeclaration } from '../test-support/declarations.js'
import { appleManifest } from '../test-support/pool.js'

const apple = appleDeclaration()

const POOL_PATHS = {
  manifest: 'data/pools/apple-harvest/manifest.json',
  atlases: dataUrlFor('pools/apple-harvest') ?? '',
}

/** Serves one manifest body, the way the data plugin would. */
function serve(body: unknown): void {
  vi.stubGlobal('fetch', (input: string) =>
    String(input).endsWith(POOL_PATHS.manifest)
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response)
      : Promise.resolve({ ok: false, status: 404 } as Response),
  )
}

/** The task's smallest tier: what a farm that has bought nothing has selected. */
const STARTER = apple.datasets[0]?.id ?? ''

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetching a task pool', () => {
  it('loads the committed manifest into a drawable training split', async () => {
    serve(appleManifest())

    const loaded = await loadTrainingSplit(POOL_PATHS, apple, STARTER)

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.images).toHaveLength(200)
    expect(loaded.value.categories.map((category) => category.id)).toEqual(
      apple.categories.map((category) => category.id),
    )
  })

  it('resolves each image to an atlas URL under the pool mount', async () => {
    serve(appleManifest())

    const loaded = await loadTrainingSplit(POOL_PATHS, apple, STARTER)

    if (!loaded.ok) throw new Error('the committed manifest should load')
    for (const image of loaded.value.images) {
      expect(image.atlasUrl).toContain(`${POOL_PATHS.atlases}/`)
      expect(image.atlasUrl.endsWith('.png'), image.atlasUrl).toBe(true)
    }
  })

  it('reports an unreachable manifest rather than throwing', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 404 } as Response))

    const loaded = await loadTrainingSplit(POOL_PATHS, apple, STARTER)

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues[0]?.code).toBe('data-unreachable')
    expect(loaded.issues[0]?.message).toContain(POOL_PATHS.manifest)
  })

  it('hands back the reader’s own issues when the reader refuses', async () => {
    serve({ ...appleManifest(), poolId: 'pools/elsewhere' })

    const loaded = await loadTrainingSplit(POOL_PATHS, apple, STARTER)

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues.some((issue) => issue.code === 'pool-mismatch')).toBe(true)
    const message = loaded.issues.map((issue) => issue.message).join(' ')
    expect(message).toContain('pools/elsewhere')
    expect(message).toContain(apple.pool)
  })

  it('returns no split at all from a refusal', async () => {
    serve({ ...appleManifest(), schemaVersion: '9.9.9' })

    const loaded = await loadTrainingSplit(POOL_PATHS, apple, STARTER)

    expect(loaded).not.toHaveProperty('value')
  })
})

describe('what the split carries', () => {
  it('names none of the generation attributes anywhere in the data layer', async () => {
    serve(appleManifest())

    const loaded = await loadTrainingSplit(POOL_PATHS, apple, STARTER)

    if (!loaded.ok) throw new Error('the committed manifest should load')
    const fields = new Set(loaded.value.images.flatMap((image) => Object.keys(image)))
    for (const attribute of ['hue', 'roundness', 'gloss', 'lighting', 'wormVisibility']) {
      expect([...fields], `the split carries ${attribute}`).not.toContain(attribute)
    }
    expect([...fields]).not.toContain('attributes')
  })
})

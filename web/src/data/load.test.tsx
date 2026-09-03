import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DATA_URLS } from './paths.js'
import { loadDeclaration, loadShippedTasks, loadTask } from './load.js'

const repoRoot = process.cwd()

function readSource(path: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as unknown
}

const APPLE = readSource('declarations/apple-harvest.json')
const PREDICTIONS = readSource('test/fixtures/apple-predictions.json')
const POOL = readSource('test/fixtures/apple-pool.json')

/** Serves whatever each data URL is mapped to, the way the plugin would. */
function serve(bodies: Readonly<Record<string, unknown>>): void {
  vi.stubGlobal('fetch', (input: string) => {
    const url = String(input)
    const match = Object.keys(bodies).find((path) => url.endsWith(path))
    if (match === undefined) {
      return Promise.resolve({ ok: false, status: 404 } as Response)
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(bodies[match]),
    } as Response)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loading a task declaration', () => {
  it('loads the shipped apple declaration', async () => {
    serve({
      [DATA_URLS.appleDeclaration]: APPLE,
      [DATA_URLS.applePredictions]: PREDICTIONS,
      [DATA_URLS.applePool]: POOL,
    })

    const loaded = await loadShippedTasks()

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value).toHaveLength(1)
    expect(loaded.value[0]?.declaration.id).toBe('apple-harvest')
    expect(loaded.value[0]?.truth['p-001']).toBe('red')
  })

  it('names the missing field when a required one is absent', async () => {
    const { payoffs: _dropped, ...withoutPayoffs } = APPLE as Record<string, unknown>
    serve({ [DATA_URLS.appleDeclaration]: withoutPayoffs })

    const loaded = await loadDeclaration(DATA_URLS.appleDeclaration)

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues.some((issue) => issue.field === 'payoffs')).toBe(true)
  })

  it('reports an unreachable declaration rather than throwing', async () => {
    serve({})

    const loaded = await loadDeclaration(DATA_URLS.appleDeclaration)

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues[0]?.code).toBe('data-unreachable')
  })
})

describe('loading a prediction artifact', () => {
  it('refuses a schema version mismatch naming both versions', async () => {
    serve({
      [DATA_URLS.appleDeclaration]: APPLE,
      [DATA_URLS.applePredictions]: { ...(PREDICTIONS as object), schemaVersion: '9.9.9' },
      [DATA_URLS.applePool]: POOL,
    })

    const loaded = await loadTask({
      declaration: DATA_URLS.appleDeclaration,
      predictions: DATA_URLS.applePredictions,
      pool: DATA_URLS.applePool,
    })

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    const message = loaded.issues.map((issue) => issue.message).join(' ')
    expect(message).toContain('1.0.0')
    expect(message).toContain('9.9.9')
  })

  it('returns no task data at all from a mismatch', async () => {
    serve({
      [DATA_URLS.appleDeclaration]: APPLE,
      [DATA_URLS.applePredictions]: { ...(PREDICTIONS as object), schemaVersion: '9.9.9' },
      [DATA_URLS.applePool]: POOL,
    })

    const loaded = await loadShippedTasks()

    expect(loaded.ok).toBe(false)
    expect(loaded).not.toHaveProperty('value')
  })
})

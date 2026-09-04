import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHIPPED_TASKS } from './paths.js'
import { loadConfiguration, loadDeclaration, loadShippedTasks, loadTask } from './load.js'

const repoRoot = process.cwd()

function readSource(path: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as unknown
}

const DECLARATION_URL = SHIPPED_TASKS[0] ?? ''
const APPLE = readSource('declarations/apple-harvest.json') as Record<string, unknown>
const MANIFEST = readSource('pools/apple-harvest/manifest.json')
const INDEX = readSource('artifacts/apple-harvest/predictions/index.json') as Record<string, unknown>
const COVERED = Object.keys(INDEX.configurations as Record<string, unknown>)
const FIRST = COVERED[0] ?? ''
const PREDICTIONS = readSource(`artifacts/apple-harvest/predictions/${FIRST}.json`)

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

/** Everything one shipped task needs, from the committed files. */
function shippedBodies(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    [DECLARATION_URL]: APPLE,
    'data/pools/apple-harvest/manifest.json': MANIFEST,
    'data/artifacts/apple-harvest/predictions/index.json': INDEX,
    [`data/artifacts/apple-harvest/predictions/${FIRST}.json`]: PREDICTIONS,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loading a task declaration', () => {
  it('loads the shipped apple declaration', async () => {
    serve(shippedBodies())

    const loaded = await loadShippedTasks()

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value).toHaveLength(1)
    expect(loaded.value[0]?.declaration.id).toBe('apple-harvest')
  })

  it('refuses a declaration the validator rejects, naming the field', async () => {
    const { payoffs: _dropped, ...withoutPayoffs } = APPLE
    serve({ [DECLARATION_URL]: withoutPayoffs })

    const loaded = await loadDeclaration(DECLARATION_URL)

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues.some((issue) => issue.field === 'payoffs')).toBe(true)
  })

  it('reports an unreachable declaration rather than throwing', async () => {
    serve({})

    const loaded = await loadDeclaration(DECLARATION_URL)

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues[0]?.code).toBe('data-unreachable')
  })
})

describe('loading a task', () => {
  it('loads the pool and the artifact index, and no predictions', async () => {
    let fetched: string[] = []
    vi.stubGlobal('fetch', (input: string) => {
      const url = String(input)
      fetched.push(url)
      const bodies = shippedBodies()
      const match = Object.keys(bodies).find((path) => url.endsWith(path))
      return Promise.resolve(
        match === undefined
          ? ({ ok: false, status: 404 } as Response)
          : ({ ok: true, status: 200, json: () => Promise.resolve(bodies[match]) } as Response),
      )
    })

    const loaded = await loadTask(DECLARATION_URL)

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.index.coverage).toEqual(COVERED)
    expect(Object.keys(loaded.value.truth)).toHaveLength(1200)
    expect(loaded.value.imageIds.training).toHaveLength(200)
    // Coverage and provenance arrive; a configuration's 1200 distributions do not.
    expect(fetched.some((url) => url.endsWith(`${FIRST}.json`))).toBe(false)
  })

  it('refuses an artifact schema version mismatch, naming both versions', async () => {
    serve(
      shippedBodies({
        'data/artifacts/apple-harvest/predictions/index.json': {
          ...INDEX,
          schemaVersion: '9.9.9',
        },
      }),
    )

    const loaded = await loadTask(DECLARATION_URL)

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    const message = loaded.issues.map((issue) => issue.message).join(' ')
    expect(message).toContain('1.0.0')
    expect(message).toContain('9.9.9')
  })

  it('refuses an artifact produced from another pool, naming both seeds', async () => {
    serve(
      shippedBodies({
        'data/artifacts/apple-harvest/predictions/index.json': {
          ...INDEX,
          pool: { ...(INDEX.pool as object), seed: 12345 },
        },
      }),
    )

    const loaded = await loadTask(DECLARATION_URL)

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    const message = loaded.issues.map((issue) => issue.message).join(' ')
    expect(message).toContain('12345')
    // Read from the committed manifest, not repeated: the pool seed moves whenever the
    // populations behind the ids do, and a literal here would outlive the pool it names.
    expect(message).toContain(String((MANIFEST as { seed: number }).seed))
  })

  it('returns no task data at all from a mismatch', async () => {
    serve(
      shippedBodies({
        'data/artifacts/apple-harvest/predictions/index.json': {
          ...INDEX,
          schemaVersion: '9.9.9',
        },
      }),
    )

    const loaded = await loadShippedTasks()

    expect(loaded.ok).toBe(false)
    expect(loaded).not.toHaveProperty('value')
  })
})

describe('loading one configuration', () => {
  async function loadedTask() {
    serve(shippedBodies())
    const loaded = await loadTask(DECLARATION_URL)
    if (!loaded.ok) throw new Error(loaded.issues.map((issue) => issue.message).join(' '))
    return loaded.value
  }

  it('fetches the file the index names and reads it against the pool', async () => {
    const task = await loadedTask()

    const entry = await loadConfiguration(task, FIRST)

    expect(entry.ok).toBe(true)
    if (!entry.ok) return
    expect(entry.value.history).toHaveLength(task.index.configurations[FIRST]?.epochs ?? 0)
    expect(Object.keys(entry.value.predictions.pool)).toHaveLength(1000)
  })

  it('refuses an uncovered configuration as untrained, before fetching anything', async () => {
    const task = await loadedTask()
    let fetches = 0
    vi.stubGlobal('fetch', () => {
      fetches += 1
      return Promise.resolve({ ok: false, status: 404 } as Response)
    })

    const entry = await loadConfiguration(task, 'blocks4-channels32-regularization3-dropout0.5')

    expect(entry.ok).toBe(false)
    if (entry.ok) return
    expect(entry.issues[0]?.code).toBe('untrained-configuration')
    expect(entry.issues[0]?.message).toContain('blocks4-channels32-regularization3-dropout0.5')
    expect(fetches).toBe(0)
  })
})

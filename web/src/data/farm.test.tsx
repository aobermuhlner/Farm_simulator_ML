/**
 * Loading the farm declaration over the network.
 *
 * The farm refuses the way a task refuses — issues with the field named, never a throw —
 * because a farm that will not open has to say why on screen.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadFarmDeclaration } from './load.js'
import { SHIPPED_FARM, sourcePathFor } from './paths.js'

const FARM = JSON.parse(
  readFileSync(join(process.cwd(), sourcePathFor(SHIPPED_FARM) ?? ''), 'utf8'),
) as Record<string, unknown>

function serve(bodies: Readonly<Record<string, unknown>>): void {
  vi.stubGlobal('fetch', (input: string) => {
    const url = String(input)
    const match = Object.keys(bodies).find((path) => url.endsWith(path))
    if (match === undefined) return Promise.resolve({ ok: false, status: 404 } as Response)
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

describe('loading the farm', () => {
  it('loads the shipped declaration', async () => {
    serve({ [SHIPPED_FARM]: FARM })
    const loaded = await loadFarmDeclaration()

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.currency).toBe(FARM.currency)
    expect(loaded.value.openingBalance).toBe(FARM.openingBalance)
    expect(loaded.value.openingYear).toBe(FARM.openingYear)
  })

  it('refuses an unreachable declaration with the path named', async () => {
    serve({})
    const loaded = await loadFarmDeclaration()

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues[0]?.code).toBe('data-unreachable')
    expect(loaded.issues[0]?.field).toBe(SHIPPED_FARM)
  })

  it('hands the validator’s issues back rather than throwing', async () => {
    const { currency, ...withoutCurrency } = FARM
    expect(currency).toBeDefined()
    serve({ [SHIPPED_FARM]: withoutCurrency })

    const loaded = await loadFarmDeclaration()
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues.map((issue) => issue.field)).toContain('currency')
  })

  it('refuses a declaration that is not JSON at all', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('unexpected token')),
      } as unknown as Response),
    )

    const loaded = await loadFarmDeclaration()
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.issues[0]?.code).toBe('data-malformed')
  })
})

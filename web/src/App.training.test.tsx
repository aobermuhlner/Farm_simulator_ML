/**
 * The training browser reached through the whole shell, from the farm overview.
 *
 * The point of going through `App` rather than through `ConfigureTask` is the wiring:
 * the pool paths a task ships have to reach the browser, and the manifest has to be
 * fetched only once a student opens it.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.js'
import type { LoadedTask } from './data/load.js'
import { DATA_URLS } from './data/paths.js'
import { appleArtifact, appleDeclaration, appleTruth } from './test-support/declarations.js'
import { appleManifest } from './test-support/pool.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const manifest = appleManifest()

const appleTask: LoadedTask = {
  declaration: appleDeclaration(),
  artifact: appleArtifact(),
  truth: appleTruth(),
  generatedPool: {
    manifest: DATA_URLS.applePoolManifest,
    atlases: DATA_URLS.applePoolAtlases,
  },
}

/** Counts every manifest fetch, so laziness is observable. */
function serveManifest(): { readonly calls: () => number } {
  let calls = 0
  vi.stubGlobal('fetch', (input: string) => {
    if (!String(input).endsWith(DATA_URLS.applePoolManifest)) {
      return Promise.resolve({ ok: false, status: 404 } as Response)
    }
    calls += 1
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(manifest),
    } as Response)
  })
  return { calls: () => calls }
}

describe('the training browser through the shell', () => {
  it('opens the split straight from a task, with no run first', async () => {
    serveManifest()
    render(<App load={() => Promise.resolve({ ok: true as const, value: [appleTask] })} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    expect(screen.queryAllByRole('img')).toHaveLength(200)
    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    expect(screen.queryByText(/Total earnings/)).toBeNull()
  })

  it('fetches the pool only once the browser is opened', async () => {
    const served = serveManifest()
    render(<App load={() => Promise.resolve({ ok: true as const, value: [appleTask] })} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    expect(served.calls()).toBe(0)

    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    expect(served.calls()).toBe(1)
  })

  it('goes back to the settings and on to a run', async () => {
    serveManifest()
    render(<App load={() => Promise.resolve({ ok: true as const, value: [appleTask] })} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Back to the settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Run a month' }))

    expect(screen.getByRole('region', { name: 'Run report' })).toBeDefined()
  })
})

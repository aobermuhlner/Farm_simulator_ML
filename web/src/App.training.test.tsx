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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { App } from './App.js'
import { SHIPPED_FARM } from './data/paths.js'
import { farmDeclaration } from './test-support/farm.js'
import { appleManifest, appleTask } from './test-support/pool.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const manifest = appleManifest()
const task = appleTask()
const farm = farmDeclaration()

/** Every covered configuration's committed predictions, by the file the index names. */
function configurationFiles(): Map<string, unknown> {
  const files = new Map<string, unknown>()
  for (const record of Object.values(task.index.configurations)) {
    files.set(
      record.file,
      JSON.parse(
        readFileSync(join(process.cwd(), `${task.declaration.predictions}/${record.file}`), 'utf8'),
      ) as unknown,
    )
  }
  return files
}

/**
 * Serves the manifest and the predictions a run needs, counting manifest fetches so
 * laziness stays observable.
 */
function serveManifest(): { readonly calls: () => number } {
  let calls = 0
  const predictions = configurationFiles()
  vi.stubGlobal('fetch', (input: string) => {
    const url = String(input)
    if (url.endsWith(SHIPPED_FARM)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(farm),
      } as Response)
    }
    if (url.endsWith('manifest.json')) {
      calls += 1
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(manifest),
      } as Response)
    }
    for (const [file, body] of predictions) {
      if (url.endsWith(file)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        } as Response)
      }
    }
    return Promise.resolve({ ok: false, status: 404 } as Response)
  })
  return { calls: () => calls }
}

describe('the training browser through the shell', () => {
  it('opens the split straight from a task, with no run first', async () => {
    serveManifest()
    render(<App load={() => Promise.resolve({ ok: true as const, value: [task] })} replayMs={0} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    expect(screen.queryAllByRole('img')).toHaveLength(200)
    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    expect(screen.queryByText(/Total earnings/)).toBeNull()
  })

  it('fetches the pool only once the browser is opened', async () => {
    const served = serveManifest()
    render(<App load={() => Promise.resolve({ ok: true as const, value: [task] })} replayMs={0} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    expect(served.calls()).toBe(0)

    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    expect(served.calls()).toBe(1)
  })

  it('goes back to the settings, trains, and on to a run', async () => {
    serveManifest()
    render(<App load={() => Promise.resolve({ ok: true as const, value: [task] })} replayMs={0} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Back to the settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Run a month' }))

    expect(await screen.findByRole('region', { name: 'Run report' })).toBeDefined()
  })
})

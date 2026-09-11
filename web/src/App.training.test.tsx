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
import { firstFamily } from '../../src/task/families.js'
import { App } from './App.js'
import { SHIPPED_CATALOG, SHIPPED_FARM, sourcePathFor } from './data/paths.js'
import { farmDeclaration } from './test-support/farm.js'
import { appleManifest, appleTask } from './test-support/pool.js'
import { memoryStorage, savesTo } from './test-support/progression.js'

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
  const family = firstFamily(task.declaration)
  const directory = family.predictions ?? ''
  for (const file of Object.values(task.families[family.id]?.files ?? {})) {
    files.set(
      file,
      JSON.parse(readFileSync(join(process.cwd(), `${directory}/${file}`), 'utf8')) as unknown,
    )
  }
  return files
}

/**
 * The shipped catalog's item that opens the family the task opens at.
 *
 * Read out of the catalog rather than named, so a rename of the item or a reshuffle of
 * the shelf moves this with it.
 */
const ownsTheFamily = (() => {
  const source = sourcePathFor(SHIPPED_CATALOG) ?? ''
  const raw = JSON.parse(readFileSync(join(process.cwd(), source), 'utf8')) as {
    items: readonly { id: string; opens: readonly Record<string, unknown>[] }[]
  }
  const wanted = firstFamily(task.declaration).id
  const item = raw.items.find((entry) =>
    entry.opens.some((unlock) => unlock.kind === 'model-family' && unlock.family === wanted),
  )
  if (item === undefined) throw new Error(`the shipped catalog opens no family "${wanted}"`)
  return item.id
})()

/**
 * Serves the manifest and the predictions a run needs, counting manifest fetches so
 * laziness stays observable.
 */
function serveManifest(): { readonly calls: () => number } {
  let calls = 0
  const predictions = configurationFiles()
  vi.stubGlobal('fetch', (input: string) => {
    const url = String(input)
    if (url.endsWith(SHIPPED_CATALOG)) {
      // Served from the shipped file rather than a stand-in, so this suite also asserts
      // that the catalog students get passes every check the shell runs on it — with one
      // thing owned that the shipped file gives nobody. The farm opens owning no model at
      // all now, and a workshop with no family selected has no training data to show; what
      // is being held here is the browser, not how the model was paid for.
      const source = sourcePathFor(SHIPPED_CATALOG) ?? ''
      const shippedCatalogJson = JSON.parse(
        readFileSync(join(process.cwd(), source), 'utf8'),
      ) as Record<string, unknown>
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...shippedCatalogJson, ownedAtStart: [ownsTheFamily] }),
      } as Response)
    }
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
    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [task] })}
        {...savesTo(memoryStorage())}
        replayMs={0}
      />,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    expect(screen.queryAllByRole('img')).toHaveLength(200)
    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    expect(screen.queryByText(/Total earnings/)).toBeNull()
  })

  it('fetches the pool only once the browser is opened', async () => {
    const served = serveManifest()
    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [task] })}
        {...savesTo(memoryStorage())}
        replayMs={0}
      />,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    expect(served.calls()).toBe(0)

    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    expect(served.calls()).toBe(1)
  })

  it('shows the tier the knob names, in the words the declaration carries', async () => {
    serveManifest()
    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [task] })}
        {...savesTo(memoryStorage())}
        replayMs={0}
      />,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    const tier = task.declaration.datasets[0]
    if (tier === undefined) throw new Error('the shipped task must declare a tier')
    // The set the model being configured will be fitted on — named and explained in the
    // declaration's own words, so the screen names no tier of its own.
    expect(screen.getByText(tier.label, { exact: false })).toBeDefined()
    expect(screen.getByText(tier.disclosure)).toBeDefined()
    expect(screen.queryAllByRole('img')).toHaveLength(tier.size)
  })

  it('shows what the knob names rather than what the farm owns', async () => {
    serveManifest()
    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [task] })}
        {...savesTo(memoryStorage())}
        replayMs={0}
      />,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))

    // The larger tiers are on screen, so a student can see what there is to earn, and
    // cannot be selected until something opens them.
    const family = firstFamily(task.declaration)
    const knob = family.knobs.find((candidate) => candidate.id === family.datasetKnob)
    if (knob === undefined) throw new Error('the shipped family must declare its dataset knob')
    const tier = task.declaration.datasets[0]
    if (tier === undefined) throw new Error('the shipped task must declare a tier')
    const control = screen.getByLabelText(knob.label) as HTMLSelectElement
    expect([...control.options].map((option) => option.textContent)).toEqual(
      task.declaration.datasets.map((tier) => tier.id),
    )
    expect(control.selectedIndex).toBe(0)
    for (const option of [...control.options].slice(1)) expect(option.disabled).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')

    expect(screen.queryAllByRole('img')).toHaveLength(tier.size)
  })

  it('goes back to the settings and makes a model there', async () => {
    serveManifest()
    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [task] })}
        {...savesTo(memoryStorage())}
        replayMs={0}
      />,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Open Apple Harvest' }))
    await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Back to the settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    expect(await screen.findByRole('button', { name: 'Put this model to work' })).toBeDefined()
  })
})

/**
 * Opening the farm from a save, and writing it back as it changes.
 *
 * The write-through is the part worth going through the whole shell for: a purchase has
 * to be in storage the moment it happens, not when the page is closed, because
 * `beforeunload` does not fire reliably and a lost purchase is what this must not ship.
 *
 * A year is closed here by handing the shell a save that already holds one. Nothing in
 * the app closes a year yet — that arrives with `harvest-scoring` — so the write side of
 * the ledger is the codec's own suite and the read side is below, end to end.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { credit, formatUnits, openFarm, recordHarvest, toUnits } from '../../src/economy/index.js'
import { SAVE_SCHEMA_VERSION, serializeSave, type GameState } from '../../src/save/index.js'
import { firstFamily } from '../../src/task/families.js'
import { App } from './App.js'
import { SAVE_KEY, STORAGE_UNAVAILABLE, type SaveStorage } from './data/save.js'
import { farmDeclaration, loadsFarm } from './test-support/farm.js'
import { appleTask as committedAppleTask, loadEntryFor } from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo, shopCatalog } from './test-support/progression.js'

afterEach(cleanup)

const appleTask = committedAppleTask()

/**
 * The shipped farm with a purse, because these are tests about what is kept.
 *
 * The farm ships broke, and a purchase is the change these tests watch being written,
 * read back and discarded. The money is put there rather than earned so that a save test
 * is not also a sorting test.
 */
const declaration = { ...farmDeclaration(), openingBalance: 2000 }
const catalog = shopCatalog()

function renderApp(storage: SaveStorage, options: { readonly drawSeed?: () => number } = {}) {
  return render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm(declaration)}
      loadShop={loadsCatalog(catalog)}
      {...savesTo(storage)}
      drawSeed={options.drawSeed}
      replayMs={0}
    />,
  )
}

/** What is in storage right now, parsed. */
function stored(storage: SaveStorage): Record<string, unknown> {
  const text = storage.getItem(SAVE_KEY)
  if (text === null) throw new Error('nothing has been stored')
  return JSON.parse(text) as Record<string, unknown>
}

async function buy(label: string): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))
  await userEvent.click(await screen.findByRole('button', { name: `Buy ${label}` }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
}

function shown(label: string): string {
  return screen.getByRole('definition', { name: label }).textContent ?? ''
}

describe('progress is written as it changes', () => {
  it('writes the opening state the moment a new farm is opened', async () => {
    const storage = memoryStorage()
    renderApp(storage)
    await screen.findByRole('region', { name: 'Farm status' })
    await waitFor(() => expect(storage.getItem(SAVE_KEY)).not.toBeNull())

    expect(stored(storage).year).toBe(declaration.openingYear)
    expect(stored(storage).balance).toBe(declaration.openingBalance)
    expect(stored(storage).owned).toEqual(catalog.ownedAtStart)
  })

  it('has a purchase in storage immediately after it happens', async () => {
    const storage = memoryStorage()
    renderApp(storage)
    await buy('Second row')

    expect(stored(storage).owned).toEqual([...catalog.ownedAtStart, 'second-row'])
    expect(stored(storage).balance).toBe(declaration.openingBalance - 10)
    expect(stored(storage).movements).toEqual([{ amount: -10, reason: 'second-row' }])
  })

  it('has a knob value in storage as soon as it is turned', async () => {
    const storage = memoryStorage()
    renderApp(storage)
    await userEvent.click(
      await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
    )
    await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), '32')

    // Per family, because a knob id belongs to a family: tuning one must not disturb
    // another's values, and two families may well declare a knob under the same name.
    const perTask = (stored(storage).knobs as Record<string, Record<string, unknown>>)[
      appleTask.declaration.id
    ]
    expect(perTask?.[firstFamily(appleTask.declaration).id]).toMatchObject({ channels: 32 })
  })

  it('waits on no page-unload event to do it', async () => {
    const listeners: string[] = []
    const spy = vi.spyOn(window, 'addEventListener').mockImplementation(((type: string) => {
      listeners.push(type)
    }) as never)

    const storage = memoryStorage()
    renderApp(storage)
    await screen.findByRole('region', { name: 'Farm status' })
    spy.mockRestore()

    expect(listeners.filter((type) => /unload|pagehide|visibilitychange/.test(type))).toEqual([])
    expect(storage.getItem(SAVE_KEY)).not.toBeNull()
  })
})

describe('returning opens the farm that was left', () => {
  it('opens at the declared state where nothing has been stored', async () => {
    renderApp(memoryStorage())
    await screen.findByRole('region', { name: 'Farm status' })

    expect(shown('Year')).toBe(String(declaration.openingYear))
    expect(shown('Balance')).toBe(formatUnits(openFarm(declaration).balance, declaration))
  })

  it('opens the year, the balance and the ledger a closed year left', async () => {
    const played: GameState = {
      farm: recordHarvest(credit(openFarm(declaration), toUnits(500, 2), 'sales'), toUnits(-120, 2)),
      seed: 99,
      owned: ['starter-plot'],
      knobs: {},
      families: {},
      tutorials: [],
      slots: {},
    }
    const storage = memoryStorage({ [SAVE_KEY]: serializeSave(played) })
    renderApp(storage)
    await screen.findByRole('region', { name: 'Farm status' })

    expect(shown('Year')).toBe(String(declaration.openingYear + 1))
    expect(shown('Balance')).toBe(formatUnits(played.farm.balance, declaration))
    expect((stored(storage).ledger as unknown[]).length).toBe(1)
  })

  it('brings a purchase back after the page is closed and opened again', async () => {
    const storage = memoryStorage()
    renderApp(storage)
    await buy('Second row')
    cleanup()

    renderApp(storage)
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))
    expect(screen.getByTestId('state-second-row').textContent).toBe('Owned')
    expect(shown('Balance')).toBe(formatUnits(toUnits(declaration.openingBalance - 10, 2), declaration))
  })

  it('brings a knob back where the student left it', async () => {
    const storage = memoryStorage()
    renderApp(storage)
    await userEvent.click(
      await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
    )
    await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), '32')
    cleanup()

    renderApp(storage)
    await userEvent.click(
      await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
    )
    expect((screen.getByLabelText('Patterns per block') as HTMLSelectElement).selectedIndex).toBe(2)
  })
})

describe('a farm saved before the datasets were declared', () => {
  const family = firstFamily(appleTask.declaration)

  /** A save written when the workshop had four knobs and no dataset among them. */
  function beforeTiers(over: Partial<GameState> = {}): string {
    return serializeSave({
      farm: credit(openFarm(declaration), toUnits(500, 2), 'sales'),
      seed: 99,
      owned: ['starter-plot'],
      knobs: { [appleTask.declaration.id]: { [family.id]: { blocks: 2, channels: 32 } } },
      families: {},
      tutorials: [],
      slots: {},
      ...over,
    })
  }

  it('opens with its money and its purchases intact', async () => {
    const storage = memoryStorage({ [SAVE_KEY]: beforeTiers() })
    renderApp(storage)
    await screen.findByRole('region', { name: 'Farm status' })

    expect(shown('Balance')).toBe(
      formatUnits(credit(openFarm(declaration), toUnits(500, 2), 'sales').balance, declaration),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go to the market' }))
    expect(screen.getByTestId('state-starter-plot').textContent).toBe('Owned')
  })

  it('opens its workshop with the dataset knob at the set the robot came with', async () => {
    const storage = memoryStorage({ [SAVE_KEY]: beforeTiers() })
    renderApp(storage)
    await userEvent.click(
      await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
    )

    const knob = family.knobs.find((candidate) => candidate.id === family.datasetKnob)
    if (knob === undefined) throw new Error('the shipped family must declare its dataset knob')
    const control = screen.getByLabelText(knob.label) as HTMLSelectElement
    expect(control.selectedIndex).toBe(0)
    // And the knob the save did carry is still where the student left it.
    expect((screen.getByLabelText('Patterns per block') as HTMLSelectElement).selectedIndex).toBe(2)
  })

  it('opens playable when a model was at work under the old identifier', async () => {
    // The old spelling carried no tier, so the knobs can no longer compose it. The farm
    // opens with the slot dropped rather than refusing to load — `game-save`.
    const storage = memoryStorage({
      [SAVE_KEY]: beforeTiers({
        slots: {
          [appleTask.declaration.id]: {
            configurationId: 'blocks2-channels32-regularization1-dropout0',
            family: family.id,
          },
        },
      }),
    })
    renderApp(storage)
    await screen.findByRole('region', { name: 'Farm status' })

    expect(
      await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
    ).toBeDefined()
    expect(screen.queryByText(/could not be read/i)).toBeNull()
  })
})

describe('a save that could not be read is disclosed, never migrated', () => {
  it('warns and opens a new farm when the save is of another schema', async () => {
    const storage = memoryStorage({ [SAVE_KEY]: '{"schemaVersion":"0.0.1","balance":99999}' })
    renderApp(storage)

    expect(await screen.findByText(/could not be read and has been reset/i)).toBeDefined()
    expect(shown('Balance')).toBe(formatUnits(openFarm(declaration).balance, declaration))
  })

  it('leaves the farm playable after a reset', async () => {
    renderApp(memoryStorage({ [SAVE_KEY]: 'not a save at all' }))
    await screen.findByText(/could not be read and has been reset/i)

    await userEvent.click(
      await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    expect(await screen.findByRole('button', { name: 'Put this model to work' })).toBeDefined()
  })

  it('says progress is not being kept when the browser will not store', async () => {
    const refused = {
      code: STORAGE_UNAVAILABLE,
      message: 'This browser would not keep this change, so progress is not being kept this session.',
    }
    render(
      <App
        load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
        loadEntry={loadEntryFor}
        loadFarm={loadsFarm(declaration)}
        loadShop={loadsCatalog(catalog)}
        readSave={() => ({ ok: false as const, issue: refused })}
        writeSave={() => ({ ok: false as const, issue: refused })}
        clearSave={() => ({ ok: false as const, issue: refused })}
        replayMs={0}
      />,
    )

    expect(await screen.findByText(/progress is not being kept/i)).toBeDefined()
    await buy('Second row')
    expect(screen.getByTestId('state-second-row').textContent).toBe('Owned')
  })
})

describe('starting a new farm', () => {
  it('changes nothing when the confirmation is abandoned', async () => {
    const storage = memoryStorage()
    let drawn = 0
    renderApp(storage, { drawSeed: () => (drawn += 1) })
    await buy('Second row')
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    const before = stored(storage)
    await userEvent.click(screen.getByRole('button', { name: 'Start a new farm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Keep this farm' }))

    expect(stored(storage)).toEqual(before)
    expect(stored(storage).owned).toContain('second-row')
  })

  it('discards the farm and draws a new seed when it is confirmed', async () => {
    const storage = memoryStorage()
    let drawn = 0
    renderApp(storage, { drawSeed: () => (drawn += 1) })
    await buy('Second row')
    await userEvent.click(screen.getByRole('button', { name: 'Back to the farm' }))

    const firstSeed = stored(storage).seed
    await userEvent.click(screen.getByRole('button', { name: 'Start a new farm' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard this farm and start again' }),
    )

    expect(stored(storage).seed).not.toBe(firstSeed)
    expect(stored(storage).owned).toEqual(catalog.ownedAtStart)
    expect(stored(storage).balance).toBe(declaration.openingBalance)
    expect(stored(storage).movements).toEqual([])
  })

  it('keeps the seed across a reopen, and never redraws it', async () => {
    const storage = memoryStorage()
    let drawn = 0
    renderApp(storage, { drawSeed: () => (drawn += 1) })
    await screen.findByRole('region', { name: 'Farm status' })
    await waitFor(() => expect(storage.getItem(SAVE_KEY)).not.toBeNull())
    const seed = stored(storage).seed
    cleanup()

    renderApp(storage, { drawSeed: () => (drawn += 1) })
    await screen.findByRole('region', { name: 'Farm status' })
    expect(stored(storage).seed).toBe(seed)
    expect(drawn).toBe(1)
  })
})

describe('nothing defends the save', () => {
  it('opens a hand-edited balance as given', async () => {
    const storage = memoryStorage()
    renderApp(storage)
    await screen.findByRole('region', { name: 'Farm status' })

    const edited = { ...stored(storage), balance: 987654.32 }
    storage.setItem(SAVE_KEY, JSON.stringify(edited))
    cleanup()

    renderApp(storage)
    await screen.findByRole('region', { name: 'Farm status' })
    expect(shown('Balance')).toBe(formatUnits(toUnits(987654.32, 2), declaration))
    expect(screen.queryByText(/could not be read/i)).toBeNull()
  })

  it('opens a save written by hand that fits the schema', async () => {
    const written = JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      seed: 3,
      year: 9,
      balance: 42,
      movements: [],
      ledger: [],
      owned: ['second-row'],
      knobs: {},
      slots: {},
    })
    renderApp(memoryStorage({ [SAVE_KEY]: written }))
    await screen.findByRole('region', { name: 'Farm status' })

    expect(shown('Year')).toBe('9')
    expect(shown('Balance')).toBe(formatUnits(4200, declaration))
    expect(screen.queryByText(/tamper/i)).toBeNull()
  })

  it('hashes, signs and reports on nothing anywhere in the save path', () => {
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.tsx?$/.test(name) && !name.includes('.test.')) files.push(path)
      }
    }
    walk(join(process.cwd(), 'src/save'))
    files.push(join(process.cwd(), 'web/src/data/save.ts'))

    const offences: string[] = []
    for (const file of files) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      if (/\bhash|checksum|signature|\bsign\(|btoa|atob|crypto\b|tamper/i.test(code)) {
        offences.push(relative(process.cwd(), file))
      }
    }

    expect(files.length).toBeGreaterThan(1)
    expect(offences).toEqual([])
  })
})

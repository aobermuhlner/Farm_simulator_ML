/**
 * What a student who buys nothing actually sees in this build.
 *
 * The visible change of `progression-catalog` is not the market — nothing in it is for
 * sale. It is here: three knobs go from freely turnable into a refusal to greyed with a
 * reason, and `channels` stays turnable across exactly the three values a model was
 * trained for. That is the claim, so it is asserted against the shipped catalog and the
 * shipped task rather than against a stand-in.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App.js'
import { loadsFarm } from './test-support/farm.js'
import { appleTask as committedAppleTask, loadEntryFor } from './test-support/pool.js'
import { loadsCatalog, memoryStorage, savesTo, shippedCatalog } from './test-support/progression.js'

afterEach(cleanup)

const appleTask = committedAppleTask()

function renderApp() {
  return render(
    <App
      load={() => Promise.resolve({ ok: true as const, value: [appleTask] })}
      loadEntry={loadEntryFor}
      loadFarm={loadsFarm()}
      loadShop={loadsCatalog(shippedCatalog())}
      {...savesTo(memoryStorage())}
      replayMs={0}
    />,
  )
}

async function openTask(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: `Open ${appleTask.declaration.title}` }),
  )
}

/** The options of the select labelled `label`, and which of them are selectable. */
function optionsOf(label: string): { readonly text: string; readonly enabled: boolean }[] {
  const select = screen.getByLabelText(label) as HTMLSelectElement
  return Array.from(select.options).map((option) => ({
    text: option.textContent ?? '',
    enabled: !option.disabled,
  }))
}

describe('a student who has bought nothing', () => {
  it('still walks the same four stages', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'The farm' })).toBeDefined()

    await openTask()
    expect(screen.getByTestId('current-configuration').textContent).toBe(
      'blocks2-channels16-regularization1-dropout0',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Run a month' }))
    expect(await screen.findByRole('region', { name: 'Run report' })).toBeDefined()
  })

  it('can turn the patterns knob across all three trained values', async () => {
    renderApp()
    await openTask()

    expect(optionsOf('Patterns per block')).toEqual([
      { text: '8', enabled: true },
      { text: '16', enabled: true },
      { text: '32', enabled: true },
    ])

    for (const [index, id] of [
      [0, 'blocks2-channels8-regularization1-dropout0'],
      [2, 'blocks2-channels32-regularization1-dropout0'],
    ] as const) {
      await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), String(index))
      expect(screen.getByTestId('current-configuration').textContent).toBe(id)
      await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
      expect(await screen.findByRole('button', { name: 'Run a month' })).toBeDefined()
    }
  })

  it('finds the deeper stack greyed rather than gone, with a reason beside it', async () => {
    renderApp()
    await openTask()

    expect(optionsOf('Convolutional blocks')).toEqual([
      { text: '2', enabled: true },
      { text: '3', enabled: false },
      { text: '4', enabled: false },
    ])
    // One note per locked value — 3 and 4 — each naming the item that would open it.
    expect(screen.getAllByText(/Deeper stacks/)).toHaveLength(2)
  })

  it('finds dropout greyed rather than gone', async () => {
    renderApp()
    await openTask()

    expect(optionsOf('Dropout')).toEqual([
      { text: '0', enabled: true },
      { text: '0.2', enabled: false },
      { text: '0.5', enabled: false },
    ])
  })

  it('finds the regularization slider sitting at its declared default', async () => {
    renderApp()
    await openTask()

    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.disabled).toBe(true)
    expect(slider.value).toBe('1')
  })

  it('meets no untrained refusal anywhere it can reach', async () => {
    renderApp()
    await openTask()

    for (const index of ['0', '1', '2']) {
      await userEvent.selectOptions(screen.getByLabelText('Patterns per block'), index)
      await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
      expect(await screen.findByRole('button', { name: 'Run a month' })).toBeDefined()
      expect(screen.queryByText(/No model was trained/)).toBeNull()
    }
  })

  it('sees a market with nothing in it for sale, and nothing pretending otherwise', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Go to the market' }))

    expect(screen.queryByRole('button', { name: /^Buy / })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    for (const testId of ['state-deeper-stacks', 'state-stronger-regularization', 'state-dropout-layers']) {
      expect(screen.getByTestId(testId).textContent).toContain('trained')
    }
  })
})

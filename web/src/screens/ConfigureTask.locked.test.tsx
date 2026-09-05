/**
 * The locked check sits ahead of the artifact lookup.
 *
 * The point of testing it here rather than in the engine's own suite is the ordering in
 * the wiring: a locked configuration must never reach a fetch, so a student who has not
 * bought something is told what would open it rather than told that no model exists.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeAvailability, taskAvailability } from '../../../src/progression/index.js'
import { formatUnits } from '../../../src/economy/index.js'
import { ConfigureTask } from './ConfigureTask.js'
import { appleArtifact, appleDeclaration, appleTruth, entryLoader } from '../test-support/declarations.js'
import { farmDeclaration } from '../test-support/farm.js'
import { soundCatalog } from '../test-support/progression.js'

afterEach(cleanup)

const apple = appleDeclaration()
const farm = farmDeclaration()

const catalog = soundCatalog({
  schemaVersion: '1.0.0',
  groups: [{ id: 'models', label: 'Models' }],
  ownedAtStart: [],
  items: [
    {
      id: 'wider-blocks',
      group: 'models',
      label: 'Wider blocks',
      copy: 'More patterns per block.',
      price: 250,
      opens: [{ kind: 'knob-values', task: apple.id, knob: 'channels', values: [8, 32] }],
    },
  ],
})

function availability(owned: readonly string[]) {
  return taskAvailability(computeAvailability(catalog, [apple], owned), apple.id)
}

function renderTask(owned: readonly string[], loadEntry = vi.fn(entryLoader(appleArtifact()))) {
  render(
    <ConfigureTask
      declaration={apple}
      loadEntry={loadEntry}
      truth={appleTruth()}
      availability={availability(owned)}
      formatPrice={(units) => formatUnits(units, farm)}
      initialValues={{ blocks: 2, channels: 8, regularization: 1, dropout: 0 }}
      onBack={() => undefined}
      replayMs={0}
    />,
  )
  return loadEntry
}

describe('a locked configuration never reaches an artifact', () => {
  it('refuses it as locked, naming what opens it, and fetches nothing', async () => {
    const loadEntry = renderTask([])
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    expect(loadEntry).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Wider blocks')
    expect(screen.getByRole('alert').textContent).toContain('not yet owned')
  })

  it('produces no report, no earnings and no training history from the refusal', async () => {
    renderTask([])
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    expect(screen.queryByText(/Total earnings/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Run a month' })).toBeNull()
    expect(screen.queryByRole('img', { name: /training/i })).toBeNull()
  })

  it('shows no configuration identifier for a configuration that cannot be selected', () => {
    renderTask([])
    expect(screen.queryByTestId('current-configuration')).toBeNull()
  })

  it('goes ahead once the item that opens it is owned', async () => {
    const loadEntry = renderTask(['wider-blocks'])
    expect(screen.getByTestId('current-configuration').textContent).toBe(
      'blocks2-channels8-regularization1-dropout0',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    expect(loadEntry).toHaveBeenCalledWith('blocks2-channels8-regularization1-dropout0')
  })
})

describe('the untrained refusal is still reachable', () => {
  it('reports an available but uncovered configuration as untrained, not as locked', async () => {
    // `regularization` is opened by no item, so 3 is available from the first day — and
    // no model was trained for it. Locking is not a way of hiding untrained ground.
    const loadEntry = vi.fn(entryLoader(appleArtifact()))
    render(
      <ConfigureTask
        declaration={apple}
        loadEntry={loadEntry}
        truth={appleTruth()}
        availability={availability(['wider-blocks'])}
        formatPrice={(units) => formatUnits(units, farm)}
        initialValues={{ blocks: 2, channels: 16, regularization: 3, dropout: 0 }}
        onBack={() => undefined}
        replayMs={0}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))

    expect(loadEntry).toHaveBeenCalledWith('blocks2-channels16-regularization3-dropout0')
    expect(screen.getByRole('alert').textContent).toContain('No model was trained')
    expect(screen.getByRole('alert').textContent).not.toContain('not yet owned')
    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
  })
})

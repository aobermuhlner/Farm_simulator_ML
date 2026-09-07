/**
 * Reaching the training browser from the configuration screen, and coming back.
 *
 * Kept apart from `ConfigureTask.test.tsx` because every render here needs a split to
 * browse, and the existing suite is about a screen that has none.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { Loaded } from '../data/load.js'
import type { TrainingSplitView } from '../data/pool.js'
import {
  appleArtifact,
  appleDeclaration,
  appleTruth,
  entryLoader,
} from '../test-support/declarations.js'
import { appleTrainingSplit } from '../test-support/pool.js'
import { ConfigureTask } from './ConfigureTask.js'

afterEach(cleanup)

const apple = appleDeclaration()
const split = appleTrainingSplit()

function renderApple(load: () => Promise<Loaded<TrainingSplitView>> = () =>
  Promise.resolve({ ok: true, value: split })) {
  return render(
    <ConfigureTask
      declaration={apple}
      loadEntry={entryLoader(appleArtifact())}
      loadSplit={load}
      replayMs={0}
      onBack={() => {}}
    />,
  )
}

async function openBrowser(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'See the training data' }))
  await screen.findByRole('table')
}

async function leaveBrowser(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Back to the settings' }))
}

describe('reaching the training data', () => {
  it('offers a way to see the training split from the configuration screen', () => {
    renderApple()

    expect(screen.getByRole('button', { name: 'See the training data' })).toBeDefined()
  })

  it('shows the split when the student asks for it', async () => {
    renderApple()

    await openBrowser()

    expect(screen.getByRole('heading', { name: 'The training data' })).toBeDefined()
    expect(screen.queryAllByRole('img')).toHaveLength(split.images.length)
  })

  it('returns to the configuration screen', async () => {
    renderApple()
    await openBrowser()
    expect(screen.queryByRole('button', { name: 'Train model' })).toBeNull()

    await leaveBrowser()

    expect(screen.getByRole('button', { name: 'Train model' })).toBeDefined()
    for (const knob of apple.knobs) {
      expect(screen.getByLabelText(knob.label), `no control for ${knob.id}`).toBeDefined()
    }
  })

  it('offers nothing to browse for a task that ships no pool', () => {
    render(
      <ConfigureTask
        declaration={apple}
        loadEntry={entryLoader(appleArtifact())}
        replayMs={0}
        onBack={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: 'See the training data' })).toBeNull()
  })
})

describe('reopening it', () => {
  it('shows the same images in the same order the second time in one session', async () => {
    renderApple()
    await openBrowser()
    const first = screen.queryAllByRole('img').map((cell) => cell.getAttribute('data-image'))
    await leaveBrowser()

    await openBrowser()

    expect(screen.queryAllByRole('img').map((cell) => cell.getAttribute('data-image'))).toEqual(
      first,
    )
    expect(first).toHaveLength(split.images.length)
  })
})

describe('the configuration survives the trip', () => {
  it('keeps a changed knob value selected after browsing and returning', async () => {
    renderApple()
    const depthKnob = screen.getByLabelText('Convolutional blocks') as HTMLSelectElement
    await userEvent.selectOptions(depthKnob, '0')
    const chosen = (screen.getByLabelText('Convolutional blocks') as HTMLSelectElement).value
    expect(chosen).not.toBe('1')

    await openBrowser()
    await leaveBrowser()

    expect((screen.getByLabelText('Convolutional blocks') as HTMLSelectElement).value).toBe(chosen)
    expect(screen.getByTestId('current-configuration').textContent).toBe(
      'blocks2-channels16-regularization1-dropout0',
    )
  })

  it('scores no run on the way there and back', async () => {
    renderApple()
    await userEvent.selectOptions(screen.getByLabelText('Convolutional blocks'), '0')

    await openBrowser()
    await leaveBrowser()

    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    expect(screen.queryByText(/Total earnings/)).toBeNull()
  })
})

describe('browsing without running', () => {
  it('shows the split with no report anywhere on screen', async () => {
    renderApple()

    await openBrowser()

    expect(screen.queryAllByRole('img').length).toBeGreaterThan(0)
    expect(screen.queryByRole('region', { name: 'Run report' })).toBeNull()
    expect(screen.queryByText(/Total earnings/)).toBeNull()
  })
})

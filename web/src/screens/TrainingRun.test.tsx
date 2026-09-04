/**
 * The replay: what it shows, and that it shows nothing it was not given.
 *
 * The animation is the reason this screen exists, so it is tested as one — a run with a
 * real duration starts at the first epoch and arrives at the last — rather than only in
 * the collapsed form the other suites use.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainingEpoch } from '../../../src/task/artifact.js'
import { TrainingRun } from './TrainingRun.js'

afterEach(cleanup)

/** A run that falls and then flattens, the way a real one does. */
function history(): readonly TrainingEpoch[] {
  return [
    { epoch: 1, trainLoss: 1.1, valLoss: 1.12, trainAccuracy: 0.33, valAccuracy: 0.3 },
    { epoch: 2, trainLoss: 0.8, valLoss: 0.85, trainAccuracy: 0.55, valAccuracy: 0.5 },
    { epoch: 3, trainLoss: 0.5, valLoss: 0.58, trainAccuracy: 0.78, valAccuracy: 0.7 },
    { epoch: 4, trainLoss: 0.3, valLoss: 0.42, trainAccuracy: 0.92, valAccuracy: 0.8 },
    { epoch: 5, trainLoss: 0.22, valLoss: 0.4, trainAccuracy: 0.96, valAccuracy: 0.825 },
  ]
}

function renderRun(durationMs: number, onFinished?: () => void) {
  return render(
    <TrainingRun
      history={history()}
      configurationId="blocks2-channels16"
      durationMs={durationMs}
      onFinished={onFinished}
    />,
  )
}

/** The points one curve has drawn so far, as pairs. */
function drawnPoints(chart: HTMLElement, series: string): number {
  const polyline = chart.querySelector(`.${series} polyline`)
  const points = polyline?.getAttribute('points') ?? ''
  return points === '' ? 0 : points.trim().split(' ').length
}

function charts(): HTMLElement[] {
  return [...document.querySelectorAll('.curve')] as HTMLElement[]
}

describe('what the finished run shows', () => {
  it('reports the last epoch, as measured', () => {
    renderRun(0)
    const last = history()[history().length - 1]!

    expect(screen.getByTestId('training-epoch').textContent).toBe('Epoch 5 of 5')
    expect(screen.getByTestId('training-accuracy').textContent).toBe('82.5%')
    expect(screen.getByTestId('training-accuracy-fitted').textContent).toBe('96.0%')
    expect(screen.getByTestId('training-loss').textContent).toBe(last.trainLoss.toFixed(3))
    expect(screen.getByTestId('training-loss-held-out').textContent).toBe(last.valLoss.toFixed(3))
  })

  it('says it is replaying a recorded run, and names the configuration', () => {
    renderRun(0)

    expect(screen.getByText(/Replaying the run recorded/)).toBeDefined()
    expect(screen.getByText('blocks2-channels16')).toBeDefined()
    // The wording a student could catch out: nothing here claims to be training now.
    expect(screen.queryByText(/training your model now/i)).toBeNull()
  })

  it('draws every epoch on both curves once the run is over', () => {
    renderRun(0)

    for (const chart of charts()) {
      expect(drawnPoints(chart, 'fitted')).toBe(5)
      expect(drawnPoints(chart, 'held-out')).toBe(5)
    }
  })

  it('separates what the model was fitted on from what was held out of it', () => {
    renderRun(0)

    expect(screen.getByText('Accuracy, held-out images')).toBeDefined()
    expect(screen.getByText('Accuracy, images it was fitted on')).toBeDefined()
  })
})

describe('the run as it plays', () => {
  it('opens on the first epoch rather than the last', () => {
    renderRun(5_000)

    expect(screen.getByTestId('training-epoch').textContent).toBe('Epoch 1 of 5')
    expect(screen.getByTestId('training-accuracy').textContent).toBe('30.0%')
    for (const chart of charts()) expect(drawnPoints(chart, 'fitted')).toBe(1)
  })

  it('reaches the last epoch, and says so', async () => {
    renderRun(60)

    await waitFor(() =>
      expect(screen.getByTestId('training-epoch').textContent).toBe('Epoch 5 of 5'),
    )
    expect(screen.getByRole('heading', { name: 'Training finished' })).toBeDefined()
  })

  it('reports the end of the run once', async () => {
    const finished = vi.fn()
    renderRun(60, finished)

    await waitFor(() => expect(finished).toHaveBeenCalled())
    expect(finished).toHaveBeenCalledTimes(1)
  })

  it('announces its progress to a reader who cannot see the curves', () => {
    renderRun(5_000)

    expect(screen.getByRole('status').textContent).toContain('Epoch 1 of 5')
  })
})

describe("the numbers come from the artifact, not from the screen", () => {
  it('shows no figure the history does not contain', () => {
    renderRun(0)
    const last = history()[history().length - 1]!
    const figures = [...document.querySelectorAll('.live-figures dd')].map(
      (cell) => cell.textContent,
    )

    expect(figures).toEqual([
      `${(last.valAccuracy * 100).toFixed(1)}%`,
      `${(last.trainAccuracy * 100).toFixed(1)}%`,
      last.trainLoss.toFixed(3),
      last.valLoss.toFixed(3),
    ])
  })

  it("scales the loss curve to the run's own worst loss", () => {
    renderRun(0)
    const [lossChart] = charts()
    if (lossChart === undefined) throw new Error('the loss chart should be drawn')

    // The topmost gridline is labelled with the worst loss in the run, so the drop a
    // student sees is the drop that happened rather than one the axis invented.
    expect(within(lossChart).getByText('1.120')).toBeDefined()
  })
})

/**
 * Colour is never the only thing that tells the two curves apart.
 *
 * `colour-vision-safety` requires this independently of how well the palette scores: the
 * verified palette is what makes the images sortable, and this is what keeps the rest of
 * the product legible to the student the palette does not reach. The stroke pattern lives
 * in the stylesheet rather than in the markup, so half of this reads the stylesheet — a
 * jsdom render applies no stylesheet and would report every stroke as identical.
 */
describe('the two series differ by more than their colour', () => {
  const CSS = readFileSync(resolve(process.cwd(), 'web/src/styles.css'), 'utf8')

  it('draws each series in its own group, so a rule can reach exactly one of them', () => {
    renderRun(0)
    for (const chart of charts()) {
      expect(chart.querySelector('.series.fitted polyline')).not.toBeNull()
      expect(chart.querySelector('.series.held-out polyline')).not.toBeNull()
    }
  })

  it('gives one series a dash pattern and the other none', () => {
    const dashed = /\.curve-drawing \.held-out polyline \{[^}]*stroke-dasharray:\s*([^;}]+)/.exec(CSS)
    expect(dashed?.[1]?.trim()).toBe('4 2.5')
    const fitted = /\.curve-drawing \.fitted polyline[^{]*\{([^}]*)\}/.exec(CSS)
    expect(fitted?.[1]).not.toMatch(/stroke-dasharray/)
  })

  it('names both series in the key, in words', () => {
    renderRun(0)
    const legend = document.querySelector('.legend')
    if (legend === null) throw new Error('the replay should carry a key')
    expect(legend.textContent).toContain('images it was fitted on')
    expect(legend.textContent).toContain('images held out of training')
  })

  it('labels the figures and the curves in text as well, not only by colour', () => {
    renderRun(0)
    const labels = [...document.querySelectorAll('.live-figures dt')].map(
      (cell) => cell.textContent,
    )
    expect(labels).toContain('Accuracy, held-out images')
    expect(labels).toContain('Accuracy, images it was fitted on')
  })
})

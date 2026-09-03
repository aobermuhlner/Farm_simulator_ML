/**
 * The training run, played back epoch by epoch.
 *
 * Nothing is trained here. The configuration's run happened once, in the training
 * pipeline, and every number on this screen was measured then: the two losses and the
 * two accuracies of each epoch come straight out of the stored history. The animation
 * decides *when* a student sees each epoch, never what it says — so a student who reads
 * the source finds a replay, which is what the screen claims to be.
 *
 * Playing it out over seconds rather than printing the last row is the lesson: the shape
 * of the curve is the first diagnostic a student gets, and a curve that appears finished
 * is a curve nobody watches. `REPLAY_MS` is the whole of the pacing.
 */

import { useEffect, useRef, useState } from 'react'
import type { TrainingEpoch } from '../../../src/task/artifact.js'

/** How long a replay takes, whatever the epoch count. Short enough to run again. */
export const REPLAY_MS = 5_000

export interface TrainingRunProps {
  readonly history: readonly TrainingEpoch[]
  readonly configurationId: string
  /** Overridden by tests, which have no reason to wait out an animation. */
  readonly durationMs?: number
  /** Called once the last epoch is on screen. */
  readonly onFinished?: () => void
}

const WIDTH = 320
const HEIGHT = 132
const PAD = { top: 10, right: 10, bottom: 20, left: 34 } as const
const INNER_WIDTH = WIDTH - PAD.left - PAD.right
const INNER_HEIGHT = HEIGHT - PAD.top - PAD.bottom

function percentage(share: number): string {
  return `${(share * 100).toFixed(1)}%`
}

function loss(value: number): string {
  return value.toFixed(3)
}

/**
 * Drives the replay clock: the number of epochs on screen, from one to all of them.
 *
 * One timer step per epoch, rather than a frame loop reading a clock. The epoch is the
 * unit a student is watching — the figures change with it and nothing between two
 * epochs is known — and a whole-number step is the same run on every machine. The
 * progress bar smooths the step in CSS, which is where smoothing belongs.
 *
 * A duration of zero puts the whole history up at once, which is how tests see it.
 */
function useReplay(epochs: number, durationMs: number, onFinished?: () => void): number {
  const [shown, setShown] = useState(1)
  // Held in a ref so a caller passing a fresh closure each render does not restart the run.
  const finished = useRef(onFinished)
  finished.current = onFinished

  useEffect(() => {
    // A history of no epochs is a refusal the artifact reader makes, not something to
    // animate — but the screen must not sit on a run that can never end, so it ends.
    if (epochs <= 1 || durationMs <= 0) {
      setShown(epochs)
      finished.current?.()
      return
    }

    setShown(1)
    let at = 1
    const timer = setInterval(
      () => {
        at += 1
        setShown(at)
        if (at >= epochs) {
          clearInterval(timer)
          finished.current?.()
        }
      },
      Math.max(1, Math.round(durationMs / epochs)),
    )
    return () => clearInterval(timer)
  }, [epochs, durationMs])

  return Math.min(shown, epochs)
}

interface Series {
  readonly id: string
  readonly label: string
  readonly values: readonly number[]
}

function x(epoch: number, epochs: number): number {
  if (epochs <= 1) return PAD.left + INNER_WIDTH
  return PAD.left + ((epoch - 1) / (epochs - 1)) * INNER_WIDTH
}

function y(value: number, ceiling: number): number {
  const share = ceiling <= 0 ? 0 : Math.min(1, Math.max(0, value / ceiling))
  return PAD.top + (1 - share) * INNER_HEIGHT
}

/**
 * One chart, drawn only as far as the replay has reached.
 *
 * The vertical axis is fixed to the whole run from the first frame. A curve rescaling
 * under its own values reads as movement that is not there, and the drop is the thing
 * being taught.
 */
function Chart({
  title,
  series,
  ceiling,
  shown,
  epochs,
  format,
}: {
  readonly title: string
  readonly series: readonly Series[]
  readonly ceiling: number
  readonly shown: number
  readonly epochs: number
  readonly format: (value: number) => string
}) {
  const ticks = [0, 0.5, 1]

  return (
    <figure className="curve">
      <figcaption>{title}</figcaption>
      <svg
        className="curve-drawing"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={series
          .map((line) => `${line.label} ${format(line.values[shown - 1] ?? 0)}`)
          .join(', ')}
      >
        <g className="grid">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={PAD.left + INNER_WIDTH}
                y1={y(tick * ceiling, ceiling)}
                y2={y(tick * ceiling, ceiling)}
              />
              <text x={PAD.left - 4} y={y(tick * ceiling, ceiling) + 2.5}>
                {format(tick * ceiling)}
              </text>
            </g>
          ))}
          <text className="axis" x={PAD.left + INNER_WIDTH} y={HEIGHT - 5}>
            {`epoch ${epochs}`}
          </text>
          <text className="axis start" x={PAD.left} y={HEIGHT - 5}>
            1
          </text>
        </g>

        {series.map((line) => {
          const drawn = line.values.slice(0, shown)
          const head = drawn[drawn.length - 1]
          return (
            <g key={line.id} className={`series ${line.id}`}>
              <polyline
                points={drawn
                  .map((value, index) => `${x(index + 1, epochs)},${y(value, ceiling)}`)
                  .join(' ')}
              />
              {head === undefined ? null : (
                <circle className="head" cx={x(shown, epochs)} cy={y(head, ceiling)} r={2.6} />
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export function TrainingRun({
  history,
  configurationId,
  durationMs = REPLAY_MS,
  onFinished,
}: TrainingRunProps) {
  const epochs = history.length
  const shown = useReplay(epochs, durationMs, onFinished)
  const current = history[shown - 1]
  const running = shown < epochs

  if (current === undefined) return null

  const worstLoss = Math.max(...history.map((entry) => Math.max(entry.trainLoss, entry.valLoss)))

  return (
    <section
      className={running ? 'training-run running' : 'training-run finished'}
      aria-labelledby="training-run-heading"
    >
      <h2 id="training-run-heading">
        {running ? 'Training…' : 'Training finished'}
      </h2>

      <p className="replay-note">
        Replaying the run recorded for configuration <code>{configurationId}</code>. Every
        figure below was measured while that model was fitted.
      </p>

      <div className="epoch-line">
        <span className="epoch-count" data-testid="training-epoch">
          Epoch {shown} of {epochs}
        </span>
        <span className="epoch-bar" aria-hidden="true">
          <span className="epoch-bar-fill" style={{ inlineSize: `${(shown / epochs) * 100}%` }} />
        </span>
      </div>

      <p role="status" className="visually-hidden">
        {running
          ? `Epoch ${shown} of ${epochs}.`
          : `Training finished after ${epochs} epochs. Accuracy on held-out images ${percentage(current.valAccuracy)}.`}
      </p>

      <dl className="live-figures">
        <div className="figure headline">
          <dt>Accuracy, held-out images</dt>
          <dd data-testid="training-accuracy">{percentage(current.valAccuracy)}</dd>
        </div>
        <div className="figure">
          <dt>Accuracy, images it was fitted on</dt>
          <dd data-testid="training-accuracy-fitted">{percentage(current.trainAccuracy)}</dd>
        </div>
        <div className="figure">
          <dt>Loss, fitted</dt>
          <dd data-testid="training-loss">{loss(current.trainLoss)}</dd>
        </div>
        <div className="figure">
          <dt>Loss, held out</dt>
          <dd data-testid="training-loss-held-out">{loss(current.valLoss)}</dd>
        </div>
      </dl>

      <div className="curves">
        <Chart
          title="Loss — lower is a better fit"
          series={[
            { id: 'fitted', label: 'fitted', values: history.map((entry) => entry.trainLoss) },
            { id: 'held-out', label: 'held out', values: history.map((entry) => entry.valLoss) },
          ]}
          ceiling={worstLoss}
          shown={shown}
          epochs={epochs}
          format={loss}
        />
        <Chart
          title="Accuracy — share called correctly"
          series={[
            { id: 'fitted', label: 'fitted', values: history.map((entry) => entry.trainAccuracy) },
            { id: 'held-out', label: 'held out', values: history.map((entry) => entry.valAccuracy) },
          ]}
          ceiling={1}
          shown={shown}
          epochs={epochs}
          format={percentage}
        />
      </div>

      <p className="legend" aria-hidden="true">
        <span className="key fitted" /> images it was fitted on
        <span className="key held-out" /> images held out of training
      </p>
    </section>
  )
}

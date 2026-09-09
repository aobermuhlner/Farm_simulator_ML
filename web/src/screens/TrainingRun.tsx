/**
 * The training run, played back one step of its history at a time.
 *
 * Nothing is trained here. The configuration's run happened once, in the training
 * pipeline, and every number on this screen was measured then: the two losses and the
 * two accuracies of each step come straight out of the stored history. The animation
 * decides *when* a student sees each step, never what it says — so a student who reads
 * the source finds a replay, which is what the screen claims to be.
 *
 * Playing it out over seconds rather than printing the last row is the lesson: the shape
 * of the curve is the first diagnostic a student gets, and a curve that appears finished
 * is a curve nobody watches. `REPLAY_MS` is the whole of the pacing.
 */

import { useEffect, useRef, useState } from 'react'
import type { TrainingEpoch } from '../../../src/task/artifact.js'

/** How long a replay takes, whatever the history's length. Short enough to run again. */
export const REPLAY_MS = 5_000

/**
 * What a step of a history is called when nothing declares a name for it.
 *
 * Generic on purpose. It is not any family's word — a family that records a history
 * declares what its axis is called and that is what is shown; this is what a caller with
 * no declaration in hand gets, the same way an undefined availability locks nothing.
 */
export const DEFAULT_AXIS = 'step'

export interface TrainingRunProps {
  readonly history: readonly TrainingEpoch[]
  /**
   * What one step of this history is called, as the family declares it.
   *
   * Declared rather than written here: a fitted tree indexes its growth by splits added,
   * and a screen that said otherwise would put one family's vocabulary on every family's
   * curve.
   */
  readonly axis?: string
  readonly configurationId: string
  /** Overridden by tests, which have no reason to wait out an animation. */
  readonly durationMs?: number
  /** Called once the last step is on screen. */
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
 * Drives the replay clock: the number of history steps on screen, from one to all.
 *
 * One timer tick per recorded step, rather than a frame loop reading a clock. The step is
 * the
 * unit a student is watching — the figures change with it and nothing between two
 * length is known — and a whole-number tick is the same run on every machine. The
 * progress bar smooths the step in CSS, which is where smoothing belongs.
 *
 * A duration of zero puts the whole history up at once, which is how tests see it.
 */
function useReplay(steps: number, durationMs: number, onFinished?: () => void): number {
  const [shown, setShown] = useState(1)
  // Held in a ref so a caller passing a fresh closure each render does not restart the run.
  const finished = useRef(onFinished)
  finished.current = onFinished

  useEffect(() => {
    // An empty history is a refusal the family's own reader makes, not something to
    // animate — but the screen must not sit on a run that can never end, so it ends.
    if (steps <= 1 || durationMs <= 0) {
      setShown(steps)
      finished.current?.()
      return
    }

    setShown(1)
    let at = 1
    const timer = setInterval(
      () => {
        at += 1
        setShown(at)
        if (at >= steps) {
          clearInterval(timer)
          finished.current?.()
        }
      },
      Math.max(1, Math.round(durationMs / steps)),
    )
    return () => clearInterval(timer)
  }, [steps, durationMs])

  return Math.min(shown, steps)
}

interface Series {
  readonly id: string
  readonly label: string
  readonly values: readonly number[]
}

function x(step: number, steps: number): number {
  if (steps <= 1) return PAD.left + INNER_WIDTH
  return PAD.left + ((step - 1) / (steps - 1)) * INNER_WIDTH
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
  steps,
  axis,
  format,
}: {
  readonly title: string
  readonly series: readonly Series[]
  readonly ceiling: number
  readonly shown: number
  readonly steps: number
  readonly axis: string
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
            {`${axis} ${steps}`}
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
                  .map((value, index) => `${x(index + 1, steps)},${y(value, ceiling)}`)
                  .join(' ')}
              />
              {head === undefined ? null : (
                <circle className="head" cx={x(shown, steps)} cy={y(head, ceiling)} r={2.6} />
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
  axis = DEFAULT_AXIS,
  configurationId,
  durationMs = REPLAY_MS,
  onFinished,
}: TrainingRunProps) {
  const steps = history.length
  const shown = useReplay(steps, durationMs, onFinished)
  const current = history[shown - 1]
  const running = shown < steps

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

      <div className="step-line">
        <span className="step-count" data-testid="training-step">
          {axis} {shown} of {steps}
        </span>
        <span className="step-bar" aria-hidden="true">
          <span className="step-bar-fill" style={{ inlineSize: `${(shown / steps) * 100}%` }} />
        </span>
      </div>

      <p role="status" className="visually-hidden">
        {running
          ? `${axis} ${shown} of ${steps}.`
          : `Training finished at ${axis} ${steps}. Accuracy on held-out images ${percentage(current.valAccuracy)}.`}
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
          steps={steps}
          axis={axis}
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
          steps={steps}
          axis={axis}
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

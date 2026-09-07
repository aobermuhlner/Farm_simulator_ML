/**
 * The farm overview: every task this build could load, listed from its own
 * declaration. Nothing here knows what an apple is.
 *
 * It also carries the three things that belong to the farm rather than to any task: the
 * way into the market, the one control that runs the year, and the one that starts again.
 * Starting again states what it discards and asks before it does — §5.1's mockup has a
 * menu, and until there is a second thing to put in one, a control somewhere unambiguous
 * is enough.
 *
 * Running the year is here rather than in a workshop because what it consumes belongs to
 * the farm: every card's labour at once, not one task's model. A card at work by a model
 * is brought in without the student; a card the farm's own labour works sends them to do
 * it. The year closes when the last of them is in.
 *
 * Every word a slot presents is handed to this screen. It chooses no icon and writes no
 * label, so a farm whose labour is called something else renders through it unchanged.
 */

import { useState } from 'react'
import type { TaskDeclaration } from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { Issues } from '../components/Issues.js'

/**
 * One task still to be brought in for the year in progress.
 *
 * `manual` is what decides whether the student is offered the labour. A card at work by a
 * model that could not be brought in stays outstanding and is *not* offered by hand: a
 * robot that will not work is not a person who is not there.
 */
export interface OutstandingTask {
  readonly task: TaskDeclaration
  readonly manual: boolean
}

/**
 * One task whose crop the year could not bring in, and why.
 *
 * Attributed to its task rather than pooled into one list of causes, because the remedy
 * is per card: the job that has to be handed back is *this* card's, and a farm with two
 * refused cards must not offer one control that could mean either.
 */
export interface TaskRefusal {
  readonly task: TaskDeclaration
  readonly issues: readonly ValidationIssue[]
}

/** What fills one task's labour slot, as the overview is handed it. */
export interface LabourSlotView {
  /** A short glyph, where whatever fills the slot declares one. */
  readonly icon?: string
  /** What to call it. Always present: a slot states what fills it or it says nothing. */
  readonly label: string
}

export interface FarmOverviewProps {
  readonly tasks: readonly TaskDeclaration[]
  readonly onSelect: (task: TaskDeclaration) => void
  /** Opens the market. Absent where no catalog was loaded. */
  readonly onMarket?: () => void
  /**
   * What brings each task's crop in.
   *
   * Undefined for a task the shell presents as announced rather than playable: an
   * announced card has no labour and no say in when the year closes.
   */
  readonly slotFor?: (task: TaskDeclaration) => LabourSlotView | undefined
  /** The year the run control will run. */
  readonly year?: number
  /** Runs the year for the whole farm. Confirmed here before it is called. */
  readonly onRunYear?: () => void
  /**
   * The tasks whose crops are still to be brought in, while a year is in progress.
   *
   * Undefined when no year has been run. Empty is not the same thing: it would mean a
   * year in progress with nothing left in it, which closes rather than being shown.
   */
  readonly outstanding?: readonly OutstandingTask[]
  /** Performs the labour one outstanding task's slot calls for. */
  readonly onBringIn?: (task: TaskDeclaration) => void
  /** Opens the closed year's report for a task. Absent when no year has closed. */
  readonly onReport?: (task: TaskDeclaration) => void
  /** The tasks whose crop the most recently closed year holds a report for. */
  readonly reportable?: readonly TaskDeclaration[]
  /** The year the offered reports belong to. */
  readonly reportYear?: number
  /** Why the last attempt to bring a crop in did not happen, per card that did not. */
  readonly refusal?: readonly TaskRefusal[]
  /**
   * Hands one refused card's job back to the farm's own labour.
   *
   * Offered from where the refusal is shown so a year held open by a crop that will not
   * come in can be closed without entering the task. It only moves the labour: nothing
   * here brings the crop in, substitutes the labour on its own, or retries the fetch.
   */
  readonly onHandBack?: (task: TaskDeclaration) => void
  /** Discards this farm and opens a new one. Confirmed here before it is called. */
  readonly onNewFarm?: () => void
}

export function FarmOverview({
  tasks,
  onSelect,
  onMarket,
  slotFor,
  year,
  onRunYear,
  outstanding,
  onBringIn,
  onReport,
  reportable,
  reportYear,
  refusal,
  onHandBack,
  onNewFarm,
}: FarmOverviewProps) {
  const [confirming, setConfirming] = useState(false)
  const [runningYear, setRunningYear] = useState(false)

  const inProgress = outstanding !== undefined
  const stillOut = outstanding ?? []
  const canRun = onRunYear !== undefined && year !== undefined && !inProgress

  return (
    <section aria-labelledby="farm-heading">
      <h1 id="farm-heading">The farm</h1>

      {onMarket === undefined ? null : (
        <p>
          <button type="button" onClick={onMarket}>
            Go to the market
          </button>
        </p>
      )}

      {canRun ? (
        <section className="run-year" aria-label="Run the year">
          {runningYear ? (
            <>
              <p>
                Running year {year} brings in every crop this farm can play. Where a model is
                at work it is brought in for you; where your own labour is, you do it
                yourself. The year is not counted until the last of them is in.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRunningYear(false)
                  onRunYear()
                }}
              >
                Run year {year}
              </button>
              <button type="button" onClick={() => setRunningYear(false)}>
                Not yet
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setRunningYear(true)}>
              Run year {year}
            </button>
          )}
        </section>
      ) : null}

      {inProgress ? (
        <p className="year-in-progress" role="status">
          {stillOut.length === 0
            ? `Year ${String(year)} is being brought in.`
            : `Year ${String(year)} is being brought in. Still to do: ${stillOut
                .map((entry) => entry.task.title)
                .join(', ')}.`}
        </p>
      ) : null}

      {refusal === undefined || refusal.length === 0 ? null : (
        <section className="crop-refused" aria-label="A crop that was not brought in">
          <Issues
            title="This crop was not brought in"
            issues={refusal.flatMap((refused) => refused.issues)}
          />
          {onHandBack === undefined
            ? null
            : refusal.map((refused) => (
                <button
                  key={refused.task.id}
                  type="button"
                  data-hand-back={refused.task.id}
                  onClick={() => onHandBack(refused.task)}
                >
                  Take the model off {refused.task.title} and bring this crop in yourself
                </button>
              ))}
        </section>
      )}

      <ul className="task-list">
        {tasks.map((task) => {
          const slot = slotFor?.(task)
          const waiting = stillOut.some((entry) => entry.task.id === task.id && entry.manual)
          const hasReport =
            onReport !== undefined && (reportable ?? []).some((candidate) => candidate.id === task.id)
          return (
            <li key={task.id} className="task-card">
              <h2>{task.title}</h2>
              <p>{task.teaching.summary}</p>
              {task.available ? (
                <>
                  {slot === undefined ? null : (
                    <p className="labour-slot" data-slot={task.id} title={slot.label}>
                      {slot.icon === undefined ? null : (
                        <span className="slot-icon" aria-hidden="true">
                          {slot.icon}
                        </span>
                      )}
                      <span className="slot-label">{slot.label}</span>
                    </p>
                  )}
                  <button type="button" onClick={() => onSelect(task)}>
                    Open {task.title}
                  </button>
                  {waiting && onBringIn !== undefined ? (
                    <button type="button" data-sort={task.id} onClick={() => onBringIn(task)}>
                      Sort this year’s crop by hand
                    </button>
                  ) : null}
                  {hasReport && onReport !== undefined ? (
                    <button type="button" data-report={task.id} onClick={() => onReport(task)}>
                      See year {reportYear} for {task.title}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="announced" role="note">
                  Announced — not ready to play yet.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {onNewFarm === undefined ? null : (
        <section className="start-again" aria-label="Start a new farm">
          {confirming ? (
            <>
              <p>
                Starting a new farm discards this one: its money, everything it has bought,
                and every year it has recorded. This cannot be undone.
              </p>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                  onNewFarm()
                }}
              >
                Discard this farm and start again
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                Keep this farm
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)}>
              Start a new farm
            </button>
          )}
        </section>
      )}
    </section>
  )
}

/**
 * The farm overview: every task this build could load, listed from its own
 * declaration. Nothing here knows what an apple is.
 *
 * It also carries the two things that belong to the farm rather than to any task: the way
 * into the market, and the one control that starts again. Starting again states what it
 * discards and asks before it does — §5.1's mockup has a menu, and until there is a
 * second thing to put in one, a control somewhere unambiguous is enough.
 */

import { useState } from 'react'
import type { TaskDeclaration } from '../../../src/task/types.js'

export interface FarmOverviewProps {
  readonly tasks: readonly TaskDeclaration[]
  readonly onSelect: (task: TaskDeclaration) => void
  /** Opens the market. Absent where no catalog was loaded. */
  readonly onMarket?: () => void
  /** Discards this farm and opens a new one. Confirmed here before it is called. */
  readonly onNewFarm?: () => void
}

export function FarmOverview({ tasks, onSelect, onMarket, onNewFarm }: FarmOverviewProps) {
  const [confirming, setConfirming] = useState(false)

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

      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className="task-card">
            <h2>{task.title}</h2>
            <p>{task.teaching.summary}</p>
            {task.available ? (
              <button type="button" onClick={() => onSelect(task)}>
                Open {task.title}
              </button>
            ) : (
              <p className="announced" role="note">
                Announced — not ready to play yet.
              </p>
            )}
          </li>
        ))}
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

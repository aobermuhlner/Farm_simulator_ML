/**
 * The farm overview: every task this build could load, listed from its own
 * declaration. Nothing here knows what an apple is.
 */

import type { TaskDeclaration } from '../../../src/task/types.js'

export interface FarmOverviewProps {
  readonly tasks: readonly TaskDeclaration[]
  readonly onSelect: (task: TaskDeclaration) => void
}

export function FarmOverview({ tasks, onSelect }: FarmOverviewProps) {
  return (
    <section aria-labelledby="farm-heading">
      <h1 id="farm-heading">The farm</h1>
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
    </section>
  )
}

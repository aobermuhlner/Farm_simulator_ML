/**
 * Engine refusals, rendered as ordinary content.
 *
 * `design.md` — a refusal is a state, not an exception path. The cause shown is
 * the one the engine reported; the shell adds framing but never a diagnosis of
 * its own, and never a number.
 */

import type { ValidationIssue } from '../../../src/task/validate.js'
import { UNTRAINED_CONFIGURATION } from '../../../src/task/artifactIndex.js'
import { UNKNOWN_CONFIGURATION } from '../model/run.js'

export interface IssuesProps {
  readonly title: string
  readonly issues: readonly ValidationIssue[]
}

export function Issues({ title, issues }: IssuesProps) {
  return (
    <section className="issues" role="alert" aria-labelledby="issues-heading">
      <h3 id="issues-heading">{title}</h3>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.field ?? index}`}>
            <p>{issue.message}</p>
            {issue.code === UNKNOWN_CONFIGURATION || issue.code === UNTRAINED_CONFIGURATION ? (
              <p className="explanation">
                This simulator does not train anything while you wait. Every configuration
                it can run was trained in advance and its results stored, and this
                combination is not among them. Move a knob back to a combination that was
                precomputed, and the run will go ahead.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

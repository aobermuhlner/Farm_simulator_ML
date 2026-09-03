/**
 * The run report: the payoff table filled with counts.
 *
 * Every noun a student reads here comes from the task declaration. The screen
 * itself speaks of images, categories and actions — never apples, so the same
 * table serves a lesson about anything else.
 *
 * One structure behind the score and the explanation, so the report cannot
 * explain a number the scoring did not compute. Structurally this is a
 * confusion matrix with money attached, which is the intended stealth lesson.
 */

import type { RunOutcome } from '../../../src/scoring/index.js'
import type { TaskDeclaration } from '../../../src/task/types.js'

export interface ReportProps {
  readonly declaration: TaskDeclaration
  readonly configurationId: string
  readonly outcome: RunOutcome
  /** Set when knob values moved on after this run; the report is then history. */
  readonly stale: boolean
}

export function Report({
  declaration,
  configurationId,
  outcome,
  stale,
}: ReportProps) {
  return (
    <section className={stale ? 'report stale' : 'report'} aria-labelledby="report-heading">
      <h2 id="report-heading">Run report</h2>

      {stale ? (
        <p className="staleness" role="status">
          These are the results for configuration <code>{configurationId}</code>. You have
          changed the knobs since — run again to see the new configuration&apos;s results.
        </p>
      ) : (
        <p className="configuration">
          Configuration <code>{configurationId}</code>, {outcome.evaluated} images evaluated.
        </p>
      )}

      <p className="earnings">
        Total earnings: <strong>{outcome.earnings.toFixed(2)}</strong>
      </p>

      <table>
        <caption>What the system did, by what each image actually was</caption>
        <thead>
          <tr>
            <th scope="col">Actually</th>
            {declaration.actions.map((action) => (
              <th key={action.id} scope="col">
                {action.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {declaration.categories.map((category) => (
            <tr key={category.id}>
              <th scope="row">{category.label}</th>
              {declaration.actions.map((action) => (
                <td key={action.id} data-cell={`${category.id}:${action.id}`}>
                  {outcome.counts[category.id]?.[action.id] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

    </section>
  )
}

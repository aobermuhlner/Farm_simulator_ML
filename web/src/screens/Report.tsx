/**
 * The report of a year that closed, for one of the farm's cards.
 *
 * Every noun a student reads here comes from the task declaration. The screen
 * itself speaks of images, categories and actions — never apples, so the same
 * table serves a lesson about anything else.
 *
 * One structure behind the score and the explanation, so the report cannot
 * explain a number the scoring did not compute. Structurally this is a
 * confusion matrix with money attached, which is the intended stealth lesson.
 *
 * It is a record rather than a readout: it names the year it belongs to and what brought
 * the crop in, and it never claims to describe the knob values currently on screen. A
 * crop the farm's own labour brought in names that labour and no configuration, because
 * there is no configuration to name and inventing one would put a model's name on a
 * student's work.
 */

import type { ActionId, CategoryId, TaskDeclaration } from '../../../src/task/types.js'

export interface ReportProps {
  readonly declaration: TaskDeclaration
  /** The year this report belongs to. */
  readonly year: number
  /** The configuration the crop was brought in by; absent when labour was. */
  readonly configurationId?: string
  /** What the labour that brought it in is called, when no configuration did. */
  readonly labour?: string
  /** How many pieces were decided about. */
  readonly evaluated: number
  /** What the crop paid, already presented in the farm's own currency. */
  readonly earnings: string
  /** Count of pieces per declared true category and chosen action. */
  readonly counts: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>
}

export function Report({
  declaration,
  year,
  configurationId,
  labour,
  evaluated,
  earnings,
  counts,
}: ReportProps) {
  return (
    <section className="report" aria-labelledby="report-heading">
      <h2 id="report-heading">Run report</h2>

      <p className="configuration">
        {configurationId === undefined ? (
          <>
            Year {year}, brought in by {labour}, {evaluated} images decided.
          </>
        ) : (
          <>
            Year {year}, configuration <code>{configurationId}</code>, {evaluated} images
            evaluated.
          </>
        )}
      </p>

      <p className="earnings">
        Total earnings: <strong>{earnings}</strong>
      </p>

      <table>
        <caption>
          What the system did, by what each image actually was. The outlined cell in each
          row is the action that category calls for.
        </caption>
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
          {declaration.categories.map((category) => {
            const calledFor = declaration.categoryActions[category.id]
            return (
              <tr key={category.id}>
                <th scope="row">{category.label}</th>
                {declaration.actions.map((action) => (
                  <td
                    key={action.id}
                    data-cell={`${category.id}:${action.id}`}
                    data-called-for={action.id === calledFor ? '' : undefined}
                  >
                    <span className="count">{counts[category.id]?.[action.id] ?? 0}</span>
                    {action.id === calledFor ? (
                      <span className="visually-hidden">
                        {' — the action this category calls for'}
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>

    </section>
  )
}

/**
 * The report of a year that closed, for one of the farm's cards.
 *
 * Every noun a student reads here comes from the task declaration. The screen
 * itself speaks of pieces, categories and actions — never of any one lesson's
 * subject, so the same table serves a lesson about anything else.
 *
 * One structure behind the score and the explanation, so the report cannot
 * explain a number the scoring did not compute. Structurally this is a
 * confusion matrix with money attached, which is the intended stealth lesson.
 *
 * It is a record rather than a readout: it names the year it belongs to and what brought
 * the crop in, and it never claims to describe the knob values currently on screen. A
 * crop the farm's own labour brought in names that labour, no family and no
 * configuration, because there is neither to name and inventing one would put a model's
 * name on a student's work.
 *
 * The model family is named beside the configuration because an identifier alone no
 * longer identifies a model: two families of one task can compose the same string, and a
 * report naming one without the other would describe a crop a student cannot trace back
 * to what brought it in. The family's *label* is supplied, never looked up here.
 *
 * Everything below the table is about the year rather than about the model, and that is
 * the point of it being here. A single figure reads "a decent year" whatever happened; the
 * year's own mix, the share measured against the buyer's limit, and the arithmetic of what
 * the deduction cost are what let a leaner year be attributed to the year instead of
 * mistaken for the model changing underneath the student.
 */

import type { HarvestFigures } from '../../../src/economy/index.js'
import type { ActionId, CategoryId, TaskDeclaration } from '../../../src/task/types.js'

export interface ReportProps {
  readonly declaration: TaskDeclaration
  /** The year this report belongs to. */
  readonly year: number
  /** The configuration the crop was brought in by; absent when labour was. */
  readonly configurationId?: string
  /** What the family that made it is called; absent when labour brought the crop in. */
  readonly family?: string
  /** What the labour that brought it in is called, when no configuration did. */
  readonly labour?: string
  /** How many pieces were decided about. */
  readonly evaluated: number
  /** What the crop paid, already presented in the farm's own currency. */
  readonly earnings: string
  /** Count of pieces per declared true category and chosen action. */
  readonly counts: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>
  /**
   * What each category's pieces came to, in the farm's currency, before any deduction.
   *
   * Per category rather than only for the run, because money attached to nothing is a
   * number to hill-climb and money attached to a category is a place to look.
   */
  readonly rowEarnings: Readonly<Record<CategoryId, string>>
  /**
   * The arithmetic of what was paid, where a deduction was possible at all.
   *
   * Present when the task declares a delivery term, absent when it does not — in which
   * case the total stands alone, because a gross and a paid that are always the same
   * figure are two figures saying one thing.
   */
  readonly money?: { readonly gross: string; readonly downgrade: string }
  /** What the harvest recorded about itself, where the year recorded anything. */
  readonly harvest?: HarvestFigures
}

/** A share as a reader reads one: one decimal place, and no more precision than is real. */
function percent(share: number): string {
  return `${Math.round(share * 1000) / 10}%`
}

export function Report({
  declaration,
  year,
  configurationId,
  family,
  labour,
  evaluated,
  earnings,
  counts,
  rowEarnings,
  money,
  harvest,
}: ReportProps) {
  const labelOf = new Map(declaration.categories.map((category) => [category.id, category.label]))
  const measured = (declaration.delivery?.measures ?? []).map(
    (category) => labelOf.get(category) ?? category,
  )
  const share = harvest?.share
  const composition = harvest === undefined ? [] : Object.entries(harvest.composition)

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
            Year {year}, {family}, configuration <code>{configurationId}</code>,{' '}
            {evaluated} images evaluated.
          </>
        )}
      </p>

      {money === undefined ? (
        <p className="earnings">
          Total earnings: <strong data-paid>{earnings}</strong>
        </p>
      ) : (
        <table className="earnings-arithmetic">
          <caption>What the buyer paid for this year’s crop</caption>
          <tbody>
            <tr>
              <th scope="row">Before the buyer’s deduction</th>
              <td data-gross>{money.gross}</td>
            </tr>
            <tr>
              <th scope="row">The deduction</th>
              <td data-downgrade>{money.downgrade}</td>
            </tr>
            <tr>
              <th scope="row">Paid</th>
              <td data-paid>
                <strong>{earnings}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      )}

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
            <th scope="col">Earned</th>
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
                <td className="row-earnings" data-row-earnings={category.id}>
                  {rowEarnings[category.id] ?? ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {harvest?.tolerance === undefined ? null : (
        <p className="delivery" data-delivery>
          {harvest.delivered === 0 || share === undefined ? (
            <>Nothing went to the buyer this year, so there was nothing to measure.</>
          ) : (
            <>
              Of the <span data-delivered>{harvest.delivered}</span> pieces sent to the
              buyer, <span data-measured>{harvest.measured}</span> were{' '}
              {measured.join(', ')} — <span data-share>{percent(share)}</span> against a
              limit of <span data-tolerance>{percent(harvest.tolerance)}</span>.{' '}
              {harvest.downgraded ? (
                <strong data-downgraded>
                  The buyer took the whole delivery at the reduced price.
                </strong>
              ) : (
                <span data-accepted>The delivery was accepted in full.</span>
              )}
            </>
          )}
          {harvest.warned ? (
            <>
              {' '}
              <strong data-warned>
                That is close to the limit. One worse year and the whole delivery goes at
                the reduced price.
              </strong>
            </>
          ) : null}
        </p>
      )}

      {harvest === undefined ? null : (
        <section className="year-crop" aria-labelledby="year-crop-heading">
          <h3 id="year-crop-heading">The year itself</h3>
          <p data-crop-size={harvest.cropSize}>
            This year the land bore {harvest.cropSize} pieces:{' '}
            {composition
              .map(
                ([category, count]) =>
                  `${labelOf.get(category) ?? category} ${count} (${percent(
                    count / harvest.cropSize,
                  )})`,
              )
              .join(', ')}
            . Every year is its own; what the land bears is not what your model does with
            it.
          </p>
          {harvest.recurred && harvest.heldPictures !== undefined ? (
            <p data-recurrence={harvest.heldPictures}>
              This crop is larger than the set of photographs it is shown by:{' '}
              {harvest.cropSize} pieces drawn from {harvest.heldPictures} photographs, so
              some photographs stand for more than one piece of it.
            </p>
          ) : null}
        </section>
      )}
    </section>
  )
}

/**
 * Doing the job by hand: one image at a time, the task's own actions, and what it paid.
 *
 * Everything on this screen comes from the declaration it is handed. The controls are the
 * declared actions in the declared order, the key on each control is that position, and
 * the breakdown afterwards is the declared categories against the declared actions. The
 * screen names none of them and counts none of them, which is what lets a second lesson
 * with a different vocabulary use it unchanged.
 *
 * While a decision is open, the only thing on screen about an image is its picture. Not
 * what it is, not what it was worth, and not whether the last one was right — the wage is
 * what the student earned unaided, and a running verdict would turn the measurement into
 * a lesson and the number into something else. Everything worth seeing is shown once the
 * crop is sorted, which is where the mistakes become worth looking at.
 *
 * That rule is what shapes the offer to stop. Once an apple has been decided the student
 * may deliver what they have and discard the rest, and the figures beside that choice are
 * the argument for buying something that does the job — but the apples being left are
 * still on screen, and their categories are exactly what the student is being paid to work
 * out one picture at a time. So what the remainder is worth comes off the farm's declared
 * composition rather than off those apples, and it is presented as what the orchard bears
 * on that many rather than as what these ones hold.
 *
 * The arithmetic is `src/sorting/`. This screen measures the time, collects the choices
 * and hands them over; it computes no wage of its own.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Decision, SortOutcome } from '../../../src/sorting/index.js'
import { measureSort, whatStoppingCosts } from '../../../src/sorting/index.js'
import type { ActionId, TaskDeclaration } from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { Issues } from '../components/Issues.js'
import type { Loaded } from '../data/load.js'
import type { CropView } from '../data/pool.js'

/** How large the image under decision is drawn, in CSS pixels. */
export const SORT_DISPLAY_PX = 288

/**
 * The keys the controls are bound to, assigned by declared order.
 *
 * Digits first because they are where a hand already is, then letters, so a task
 * declaring more actions than there are digits still binds every one of them. Nothing
 * here knows what any action means; position in the declaration is the whole rule.
 */
export const ACTION_KEYS = '123456789abcdefghijklmnopqrstuvwxyz'

/**
 * The directional gestures, by declared order, for a task small enough to carry them.
 *
 * Only where every declared action can have one of its own: a task with more actions than
 * directions keeps pointer and keyboard, both of which are complete for any number, and
 * invents nothing.
 */
const GESTURES: Readonly<Record<number, readonly string[]>> = {
  2: ['left', 'right'],
  3: ['left', 'down', 'right'],
}

/** How far a pointer must travel before it counts as a gesture rather than a tap. */
const GESTURE_PX = 40

export interface HandSortProps {
  readonly declaration: TaskDeclaration
  /** Fetches this year's crop. Injected so the screen owns its own loading state. */
  readonly load: () => Promise<Loaded<CropView>>
  /**
   * The outcome of a sort already settled for the year this stage was entered for.
   *
   * Present when the year's crop has been brought in: the summary is shown and no
   * decision is open, so a year cannot be sorted a second time for pay.
   */
  readonly outcome?: SortOutcome
  /**
   * Called once, with what the sort came to and the crop it was, when the last image is
   * decided.
   *
   * The crop goes with the outcome because the year's record is about the year: its size,
   * its mix and whether its pictures recurred are the crop's, not the sort's, and a shell
   * that had to fetch the crop again to record them could fetch a different one.
   */
  readonly onSettle: (outcome: SortOutcome, crop: CropView) => void
  /** Presents an amount in the farm's declared currency. */
  readonly formatAmount: (amount: number) => string
  /**
   * What the farm declares its crop is made of, as a share per category.
   *
   * The farm's declaration, never the crop's drawn counts: it prices what the student
   * would be leaving without saying anything about the particular apples they are
   * leaving. See the module note above.
   */
  readonly cropComposition: Readonly<Record<string, number>>
  /** What a purchase that would do this job costs, when the farm declares one. */
  readonly automation?: { readonly label: string; readonly price: string }
  readonly onBack: () => void
  /** The clock. Injected by tests, which need it to be dull. */
  readonly now?: () => number
}

type Loading =
  | { readonly state: 'loading' }
  | { readonly state: 'loaded'; readonly crop: CropView }
  | { readonly state: 'refused'; readonly issues: readonly ValidationIssue[] }

/** A share as a reader reads one: one decimal place, and no more precision than is real. */
function percent(share: number): string {
  return `${Math.round(share * 1000) / 10}%`
}

/** A duration as a student reads one: seconds under two minutes, minutes above. */
export function describeSeconds(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds * 10) / 10} s`
  const minutes = Math.round(seconds / 6) / 10
  if (minutes < 90) return `${minutes} min`
  return `${Math.round(minutes / 6) / 10} h`
}

export function HandSort({
  declaration,
  load,
  outcome,
  onSettle,
  formatAmount,
  cropComposition,
  automation,
  onBack,
  now = Date.now,
}: HandSortProps) {
  const [loading, setLoading] = useState<Loading>({ state: 'loading' })
  const [decisions, setDecisions] = useState<readonly Decision[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const shownAt = useRef<number>(now())

  useEffect(() => {
    let live = true
    void load().then((result) => {
      if (!live) return
      setLoading(
        result.ok
          ? { state: 'loaded', crop: result.value }
          : { state: 'refused', issues: result.issues },
      )
      shownAt.current = now()
    })
    return () => {
      live = false
    }
  }, [load, now])

  const crop = loading.state === 'loaded' ? loading.crop : undefined
  const settled = outcome !== undefined
  const image = settled ? undefined : crop?.presented[decisions.length]

  const choose = useCallback(
    (action: ActionId) => {
      if (crop === undefined || settled || confirming) return
      const current = crop.presented[decisions.length]
      if (current === undefined) return

      const moment = now()
      const decided: readonly Decision[] = [
        ...decisions,
        { imageId: current.imageId, action, elapsedMs: moment - shownAt.current },
      ]
      shownAt.current = moment
      setDecisions(decided)

      if (decided.length === crop.presented.length) {
        onSettle(measureSort(declaration, crop, crop.truth, decided), crop)
      }
    },
    [confirming, crop, decisions, declaration, now, onSettle, settled],
  )

  /**
   * What the student is choosing between, measured over the apples decided so far.
   *
   * Computed by `src/sorting/` rather than here, for the reason the wage is: one
   * arithmetic, in one place, that a test can hold without a renderer.
   */
  const stopping = useMemo(() => {
    if (crop === undefined || settled || decisions.length === 0) return undefined
    const so_far = measureSort(declaration, crop, crop.truth, decisions)
    return whatStoppingCosts(declaration, cropComposition, crop.presented.length, so_far)
  }, [crop, cropComposition, decisions, declaration, settled])

  /** Delivers what has been decided and discards the rest, closing the year. */
  function deliver(): void {
    if (crop === undefined || settled || decisions.length === 0) return
    setConfirming(false)
    onSettle(measureSort(declaration, crop, crop.truth, decisions), crop)
  }

  const gestures = GESTURES[declaration.actions.length]

  // Bound on the window rather than on a control, so no action needs focus first: a
  // student's hand stays on the keys and their eyes stay on the picture.
  useEffect(() => {
    // Silent while the confirmation is open: a key pressed to dismiss it must not decide
    // the apple underneath it.
    if (image === undefined || confirming) return undefined
    const listen = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const index = ACTION_KEYS.indexOf(event.key.toLowerCase())
      const action = index < 0 ? undefined : declaration.actions[index]
      if (action === undefined) return
      event.preventDefault()
      choose(action.id)
    }
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [choose, confirming, declaration.actions, image])

  const from = useRef<{ x: number; y: number } | undefined>(undefined)

  function gestured(x: number, y: number): void {
    const start = from.current
    from.current = undefined
    if (start === undefined || gestures === undefined) return

    const dx = x - start.x
    const dy = y - start.y
    if (Math.abs(dx) < GESTURE_PX && Math.abs(dy) < GESTURE_PX) return

    const direction =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy > 0 ? 'down' : 'up'
    const index = gestures.indexOf(direction)
    const action = index < 0 ? undefined : declaration.actions[index]
    if (action !== undefined) choose(action.id)
  }

  const chosenSoFar = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const action of declaration.actions) counts[action.id] = 0
    for (const decision of decisions) counts[decision.action] = (counts[decision.action] ?? 0) + 1
    return counts
  }, [decisions, declaration.actions])

  const labelOf = useMemo(
    () => new Map(declaration.categories.map((category) => [category.id, category.label])),
    [declaration.categories],
  )
  // The categories the buyer's term measures, named as the task declares them. Read from
  // the declaration, so a lesson measuring something else says so through this screen.
  const measuredLabels = useMemo(
    () =>
      (declaration.delivery?.measures ?? []).map(
        (category) =>
          declaration.categories.find((entry) => entry.id === category)?.label ?? category,
      ),
    [declaration],
  )
  const actionLabelOf = useMemo(
    () => new Map(declaration.actions.map((action) => [action.id, action.label])),
    [declaration.actions],
  )
  const placed = useMemo(
    () => new Map((crop?.presented ?? []).map((piece) => [piece.imageId, piece])),
    [crop],
  )

  return (
    <section className="hand-sort" aria-labelledby="sort-heading">
      <button type="button" onClick={onBack}>
        Back to the farm
      </button>

      <h2 id="sort-heading">Sorting this year’s crop by hand</h2>

      {loading.state === 'loading' ? <p role="status">Fetching this year’s crop…</p> : null}

      {loading.state === 'refused' ? (
        <Issues title="This year’s crop could not be brought in" issues={loading.issues} />
      ) : null}

      {image === undefined || crop === undefined ? null : (
        <div className="sorting">
          <p role="status" data-progress>
            Piece {decisions.length + 1} of {crop.presented.length}
          </p>

          <span
            className="sort-image"
            role="img"
            aria-label="The piece you are deciding about"
            data-image={image.imageId}
            style={{
              inlineSize: `${SORT_DISPLAY_PX}px`,
              blockSize: `${SORT_DISPLAY_PX}px`,
              backgroundImage: `url(${image.atlasUrl})`,
              backgroundSize: `${image.atlasWidth * (SORT_DISPLAY_PX / image.cellSize)}px ${
                image.atlasHeight * (SORT_DISPLAY_PX / image.cellSize)
              }px`,
              backgroundPosition: `${-(image.x * (SORT_DISPLAY_PX / image.cellSize))}px ${-(
                image.y *
                (SORT_DISPLAY_PX / image.cellSize)
              )}px`,
            }}
            onPointerDown={(event) => {
              from.current = { x: event.clientX, y: event.clientY }
            }}
            onPointerUp={(event) => gestured(event.clientX, event.clientY)}
          />

          <ul className="sort-actions">
            {declaration.actions.map((action, index) => (
              <li key={action.id}>
                <button type="button" data-action={action.id} onClick={() => choose(action.id)}>
                  <span className="action-label">{action.label}</span>
                  <span className="action-key" data-key={ACTION_KEYS[index]}>
                    {ACTION_KEYS[index]}
                  </span>
                  {gestures?.[index] === undefined ? null : (
                    <span className="action-gesture" data-gesture={gestures[index]}>
                      swipe {gestures[index]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <table className="sort-tallies">
            <caption>What you have chosen so far</caption>
            <tbody>
              {declaration.actions.map((action) => (
                <tr key={action.id}>
                  <th scope="row">{action.label}</th>
                  <td data-chosen={action.id}>{chosenSoFar[action.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {stopping === undefined ? null : (
            <div className="sort-stop" data-stop>
              <h3>Stop here and deliver?</h3>

              <table className="stop-figures">
                <tbody>
                  <tr>
                    <th scope="row">What you have sorted would pay</th>
                    <td data-stop-wage>{formatAmount(stopping.wage)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Left on the ground</th>
                    <td data-stop-discarded>{stopping.discarded}</td>
                  </tr>
                  <tr>
                    <th scope="row">What the orchard bears on that many</th>
                    <td data-stop-worth>about {formatAmount(stopping.worth)}</td>
                  </tr>
                  <tr>
                    <th scope="row">What they would take you, at your pace</th>
                    <td data-stop-time>{describeSeconds(stopping.seconds)}</td>
                  </tr>
                </tbody>
              </table>

              {automation === undefined ? null : (
                <p data-stop-automation>
                  {automation.label} would do the rest of them, and costs{' '}
                  <span data-stop-automation-price>{automation.price}</span>.
                </p>
              )}

              {confirming ? (
                <div className="stop-confirm" role="alertdialog" aria-label="Deliver and stop" data-stop-confirm>
                  <p>
                    Delivering <span data-confirm-delivered>{decisions.length}</span> sorted,
                    and leaving <span data-confirm-discarded>{stopping.discarded}</span> on the
                    ground. This year closes either way, and the ones you leave do not come
                    back.
                  </p>
                  <button type="button" data-deliver onClick={deliver}>
                    Deliver and close the year
                  </button>
                  <button type="button" data-keep-sorting onClick={() => setConfirming(false)}>
                    Keep sorting
                  </button>
                </div>
              ) : (
                <button type="button" data-stop-offer onClick={() => setConfirming(true)}>
                  Deliver what you have sorted
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {outcome === undefined ? null : (
        <div className="sort-summary">
          <h3>What the crop came to</h3>

          <p>
            You decided {outcome.decided} of {outcome.size}, and got{' '}
            <span data-correct>{outcome.correct}</span> of them right.
          </p>

          <table className="breakdown">
            <caption>What each piece really was, and where you put it</caption>
            <thead>
              <tr>
                <th scope="col">Really</th>
                {declaration.actions.map((action) => (
                  <th scope="col" key={action.id}>
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

          <table className="sort-figures">
            <tbody>
              {outcome.delivery.tolerance === undefined ? null : (
                <tr>
                  <th scope="row">Before the buyer’s deduction</th>
                  <td data-gross>{formatAmount(outcome.delivery.gross)}</td>
                </tr>
              )}
              {outcome.delivery.tolerance === undefined ? null : (
                <tr>
                  <th scope="row">The deduction</th>
                  <td data-downgrade>{formatAmount(outcome.delivery.downgrade)}</td>
                </tr>
              )}
              <tr>
                <th scope="row">Earned</th>
                <td data-wage>{formatAmount(outcome.wage)}</td>
              </tr>
              <tr>
                <th scope="row">A faultless sort of the same pieces</th>
                <td data-faultless>{formatAmount(outcome.faultless)}</td>
              </tr>
              <tr>
                <th scope="row">Time spent</th>
                <td data-elapsed>{describeSeconds(outcome.throughput.seconds)}</td>
              </tr>
              <tr>
                <th scope="row">Pieces a minute</th>
                <td data-rate>{Math.round(outcome.throughput.perMinute * 10) / 10}</td>
              </tr>
              <tr>
                <th scope="row">The whole crop at that rate</th>
                <td data-projection>{describeSeconds(outcome.throughput.wholeCropSeconds)}</td>
              </tr>
            </tbody>
          </table>

          {outcome.delivery.tolerance === undefined ? null : (
            <p className="delivery" data-delivery>
              {outcome.delivery.delivered === 0 || outcome.delivery.share === undefined ? (
                <>You sent the buyer nothing, so there was nothing for them to measure.</>
              ) : (
                <>
                  Of the <span data-delivered>{outcome.delivery.delivered}</span> pieces you
                  sent to the buyer, <span data-measured>{outcome.delivery.measured}</span>{' '}
                  were {measuredLabels.join(', ')} —{' '}
                  <span data-share>{percent(outcome.delivery.share)}</span> against a limit
                  of <span data-tolerance>{percent(outcome.delivery.tolerance)}</span>.{' '}
                  {outcome.delivery.downgraded ? (
                    <strong data-downgraded>
                      The buyer took the whole delivery at the reduced price.
                    </strong>
                  ) : (
                    <span data-accepted>The delivery was accepted in full.</span>
                  )}
                </>
              )}
              {outcome.delivery.warned ? (
                <>
                  {' '}
                  <strong data-warned>
                    That is close to the limit. A little less care and the whole delivery
                    goes at the reduced price.
                  </strong>
                </>
              ) : null}
            </p>
          )}

          {outcome.unsorted === 0 ? null : (
            <p data-unsorted={outcome.unsorted}>
              You never got to {outcome.unsorted} of this year’s crop. They were left where
              they lay and earned nothing.
            </p>
          )}

          {automation === undefined ? null : (
            <p data-automation>
              {automation.label} would do the whole crop, and costs{' '}
              <span data-automation-price>{automation.price}</span>.
            </p>
          )}

          {outcome.mistakes.length === 0 ? (
            <p>You made no mistakes, so there is nothing to look back at.</p>
          ) : (
            <>
              <button type="button" onClick={() => setReviewing((current) => !current)}>
                {reviewing ? 'Hide what you got wrong' : `Look at the ${outcome.mistakes.length} you got wrong`}
              </button>

              {!reviewing ? null : (
                <ul className="image-grid" data-review>
                  {outcome.mistakes.map((mistake) => {
                    const piece = placed.get(mistake.imageId)
                    const scale = piece === undefined ? 1 : 112 / piece.cellSize
                    return (
                      <li key={mistake.imageId}>
                        {piece === undefined ? null : (
                          <span
                            className="cell"
                            role="img"
                            aria-label={labelOf.get(mistake.category) ?? mistake.category}
                            data-image={mistake.imageId}
                            style={{
                              inlineSize: '112px',
                              blockSize: '112px',
                              backgroundImage: `url(${piece.atlasUrl})`,
                              backgroundSize: `${piece.atlasWidth * scale}px ${piece.atlasHeight * scale}px`,
                              backgroundPosition: `${-(piece.x * scale)}px ${-(piece.y * scale)}px`,
                            }}
                          />
                        )}
                        <span className="cell-label">
                          {labelOf.get(mistake.category) ?? mistake.category} —{' '}
                          {actionLabelOf.get(mistake.called) ?? mistake.called}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

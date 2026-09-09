/**
 * The training split, so a student can look at what the models learned from.
 *
 * Every cell is a crop of one atlas rather than an image request of its own, so a whole
 * split costs one decode instead of two hundred round trips. The arithmetic is
 * `design.md`'s: the atlas is scaled by `displayed / cell`, and the cell's own offset
 * within the atlas is scaled by the same factor and applied as a negative background
 * position. The region comes from the pool reader, so this screen resolves no geometry.
 *
 * Labels and counts come from the task declaration joined to what the *selected dataset
 * tier* files each image under, which is not always its true category. That is deliberate
 * — `specs/training-browser/spec.md`: the data a student bought is the data their model
 * will be fitted on, wrong labels and all. Nothing here marks an image as mislabelled or
 * counts how many are, because a student handed the list has learned nothing.
 *
 * There is nothing about an image on screen beyond that label — the generation attributes
 * are not in the data this screen is handed, and the composition counts are counts of what
 * was actually rendered rather than a number copied out of the manifest.
 *
 * Loading and refusal are states of this view, not of the app: the manifest is fetched
 * when a student opens the browser, so this is the only screen that can be waiting on it.
 */

import { useEffect, useState } from 'react'
import type { ValidationIssue } from '../../../src/task/validate.js'
import type { Loaded } from '../data/load.js'
import type { TrainingSplitView } from '../data/pool.js'
import { Issues } from '../components/Issues.js'

/**
 * How large one cell is drawn, in CSS pixels.
 *
 * Below the 128 px the atlas stores, so the grid fits a laptop column without the
 * browser resampling upwards, and large enough that a faint blemish is still findable —
 * which is the whole reason a student is looking.
 */
export const CELL_DISPLAY_PX = 112

export interface TrainingBrowserProps {
  /** Fetches the split. Injected so the screen owns its own loading state. */
  readonly load: () => Promise<Loaded<TrainingSplitView>>
  readonly onBack: () => void
}

type Loading =
  | { readonly state: 'loading' }
  | { readonly state: 'loaded'; readonly split: TrainingSplitView }
  | { readonly state: 'refused'; readonly issues: readonly ValidationIssue[] }

export function TrainingBrowser({ load, onBack }: TrainingBrowserProps) {
  const [loading, setLoading] = useState<Loading>({ state: 'loading' })

  useEffect(() => {
    let live = true
    void load().then((result) => {
      if (!live) return
      setLoading(
        result.ok
          ? { state: 'loaded', split: result.value }
          : { state: 'refused', issues: result.issues },
      )
    })
    return () => {
      live = false
    }
  }, [load])

  const split = loading.state === 'loaded' ? loading.split : undefined

  return (
    <section className="training" aria-labelledby="training-heading">
      <button type="button" onClick={onBack}>
        Back to the settings
      </button>

      <h2 id="training-heading">The training data</h2>

      {loading.state === 'loading' ? (
        <p role="status">Fetching the training images…</p>
      ) : null}

      {loading.state === 'refused' ? (
        <Issues title="The training data could not be loaded" issues={loading.issues} />
      ) : null}

      {split === undefined ? null : (
        <>
          <p data-tier={split.tier.id}>
            Every one of the {split.images.length} photographs in{' '}
            <strong>{split.tier.label}</strong>, the set this model will be fitted on, in
            the order the pool records them.
          </p>

          {/* The tier's own words about how well it was labelled, wherever it is shown. */}
          <p className="disclosure" data-disclosure={split.tier.id}>
            {split.tier.disclosure}
          </p>

          <table className="composition">
            <caption>What this set is made of</caption>
            <tbody>
              {split.categories.map((category) => (
                <tr key={category.id}>
                  <th scope="row">{category.label}</th>
                  <td data-count={category.id}>
                    {split.images.filter((image) => image.category === category.id).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="image-grid">
            {split.images.map((image) => {
              const scale = CELL_DISPLAY_PX / image.cellSize
              return (
                <li key={image.imageId}>
                  <span
                    className="cell"
                    role="img"
                    aria-label={image.label}
                    data-image={image.imageId}
                    style={{
                      inlineSize: `${CELL_DISPLAY_PX}px`,
                      blockSize: `${CELL_DISPLAY_PX}px`,
                      backgroundImage: `url(${image.atlasUrl})`,
                      backgroundSize: `${image.atlasWidth * scale}px ${image.atlasHeight * scale}px`,
                      backgroundPosition: `${-(image.x * scale)}px ${-(image.y * scale)}px`,
                    }}
                  />
                  <span className="cell-label" aria-hidden="true">
                    {image.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

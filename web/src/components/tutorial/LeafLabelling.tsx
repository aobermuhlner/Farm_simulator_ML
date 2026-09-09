/**
 * The puzzle whose questions are given and whose leaves are empty.
 *
 * The interaction *is* the lesson here, so unlike every other screen in this build this one
 * cannot be produced from a declaration — which is the whole reason tutorials come with a
 * registry of bodies rather than a widened declaration type. What it may still not do is
 * supply any of the teaching: the questions, the pictures, what each piece of fruit really
 * is and how many have to be filed correctly are all read from the declared puzzle, and the
 * words for the categories come from the split it is handed.
 *
 * Two gestures put a piece of fruit into a leaf, and they are both here from the start.
 * Dragging is what a tray on screen invites, and it has no keyboard story — so the click
 * path is not a fallback added afterwards but the one that makes the puzzle solvable
 * without a pointer at all. They converge on one operation, *this category, that leaf*, and
 * the judgement never learns which was used.
 *
 * Testing the tree is not answering it. This screen files the declared pieces, shows where
 * each one landed and calls nothing; `onAttempt` is the only route to a judgement and the
 * engine's registered kind is the only judge, so what this screen calls passing and what
 * the gate calls passing are one decision. Reading the answer off the reveal is the
 * intended path rather than a hole — the routing is what the puzzle exists to teach.
 *
 * Fetching is this screen's own state, exactly as it is the training browser's: the pool is
 * fetched when something asks for it, so a body given the loader is the only thing that can
 * be waiting on it. A puzzle whose pictures will not come states the cause and offers no
 * answer, which is the one refusal in this area that cannot happen at load. What passes
 * never depends on them: the questions, the values, the categories and the mark are all
 * declared.
 *
 * See openspec/changes/fitted-tree-tutorial/specs/fitted-tree-tutorial/spec.md.
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { RuleSplit } from '../../../../src/features/rules.js'
import type { LabelTheLeavesPuzzle, LeafLabelling as Labelling } from '../../../../src/tutorials/index.js'
import { itemsByLeaf, leafCount } from '../../../../src/tutorials/index.js'
import type { ValidationIssue } from '../../../../src/task/validate.js'
import type { SplitImageView, TrainingSplitView } from '../../data/pool.js'
import { Issues } from '../Issues.js'
import type { TutorialBodyProps } from './TutorialBody.js'

/**
 * How large one picture is drawn, in CSS pixels.
 *
 * Smaller than the browser's cells: a whole tree, a tray and up to a dozen filed pictures
 * share one column here, and the blemish a student is looking for is the size of the
 * picture rather than the size of the grid.
 */
export const LEAF_CELL_PX = 72

/** Draws one cell of an atlas, the way the training browser does — no geometry resolved here. */
function Picture({ image, size }: { readonly image: SplitImageView; readonly size: number }) {
  const scale = size / image.cellSize
  return (
    <span
      className="cell"
      role="img"
      aria-hidden="true"
      data-image={image.imageId}
      style={{
        inlineSize: `${size}px`,
        blockSize: `${size}px`,
        backgroundImage: `url(${image.atlasUrl})`,
        backgroundSize: `${image.atlasWidth * scale}px ${image.atlasHeight * scale}px`,
        backgroundPosition: `${-(image.x * scale)}px ${-(image.y * scale)}px`,
      }}
    />
  )
}

export interface LeafTreeProps {
  /** The declared questions, asked in order. */
  readonly questions: readonly RuleSplit[]
  /** What sits in the leaf at each exit; one call per leaf, in leaf order. */
  readonly leaf: (index: number) => ReactNode
}

/**
 * The tree itself: every question on its branch, and one exit at every one of them.
 *
 * A pure function of the declared questions. It reads no task declaration, holds no state
 * and decides nothing about labelling, so the shape of the tree on screen and the routing
 * in the engine cannot drift apart — both are the declared chain and nothing else.
 *
 * The question is shown as the feature the declaration names and the number it cuts at. A
 * chain of *n* questions draws *n + 1* leaves, which is the property a student has to be
 * able to see: there is an exit for every answer, and no piece of fruit falls out the bottom.
 */
export function LeafTree({ questions, leaf }: LeafTreeProps) {
  return (
    <ol className="leaf-tree">
      {questions.map((question, index) => (
        <li key={`${question.feature}-${index}`} className="leaf-branch">
          <p className="leaf-question">
            <span data-question={index}>
              {question.feature} &gt; {question.threshold}
            </span>
            <span className="leaf-answer"> — yes:</span>
          </p>
          {leaf(index)}
        </li>
      ))}
      <li className="leaf-branch">
        <p className="leaf-question">
          <span className="leaf-answer">no to all of them:</span>
        </p>
        {leaf(questions.length)}
      </li>
    </ol>
  )
}

type Pictures =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly split: TrainingSplitView }
  | { readonly state: 'refused'; readonly issues: readonly ValidationIssue[] }

/** The picture for one declared image, where the split carries it. */
function pictureOf(split: TrainingSplitView, imageId: string): SplitImageView | undefined {
  return split.images.find((image) => image.imageId === imageId)
}

/**
 * A picture to stand for one category in the tray.
 *
 * Preferring one the puzzle does not itself file, so the tray does not show the same
 * photograph a student is about to be asked to place. Any of that category will do: the
 * tray item means *this category*, and the label beside it is what says which.
 */
function trayPicture(
  split: TrainingSplitView,
  category: string,
  filed: readonly string[],
): SplitImageView | undefined {
  const ofCategory = split.images.filter((image) => image.category === category)
  return ofCategory.find((image) => !filed.includes(image.imageId)) ?? ofCategory[0]
}

export function LeafLabellingBody({ puzzle, onAttempt, loadSplit }: TutorialBodyProps) {
  const declared = puzzle as LabelTheLeavesPuzzle
  const leaves = leafCount(declared)

  const [pictures, setPictures] = useState<Pictures>({ state: 'loading' })
  const [labelling, setLabelling] = useState<Labelling>(() =>
    Array.from({ length: leaves }, () => null),
  )
  /** The category picked up by pointer or by click, waiting for a leaf. */
  const [held, setHeld] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (loadSplit === undefined) {
      setPictures({
        state: 'refused',
        issues: [
          {
            code: 'no-pictures',
            message: 'The pictures this puzzle is about were not offered to it, so there is nothing to place.',
          },
        ],
      })
      return
    }
    let live = true
    void loadSplit().then((result) => {
      if (!live) return
      if (!result.ok) {
        setPictures({ state: 'refused', issues: result.issues })
        return
      }
      // Authored drift rather than a fetch failure, and it lands in the same state for the
      // same reason: a puzzle about a photograph the pool no longer carries cannot be posed,
      // and the cause has to be on screen because no load-time check can see a pool.
      const missing = declared.items.filter(
        (item) => pictureOf(result.value, item.image) === undefined,
      )
      if (missing.length > 0) {
        setPictures({
          state: 'refused',
          issues: missing.map((item) => ({
            code: 'image-missing',
            field: item.image,
            message: `The picture "${item.image}" this puzzle asks about is not among the images this task ships.`,
          })),
        })
        return
      }
      setPictures({ state: 'ready', split: result.value })
    })
    return () => {
      live = false
    }
  }, [loadSplit, declared])

  const split = pictures.state === 'ready' ? pictures.split : undefined
  const filed = declared.items.map((item) => item.image)
  const labelFor = (category: string | null): string | undefined =>
    category === null
      ? undefined
      : split?.categories.find((declaredCategory) => declaredCategory.id === category)?.label

  /**
   * Puts what is held into one leaf, or empties it when nothing is held.
   *
   * One operation, whichever gesture asked for it. A leaf holds one label at a time, so
   * placing into a full leaf replaces what was there — the labelling is a scratchpad until
   * an answer is offered, and there is nothing to undo.
   */
  function place(index: number): void {
    setLabelling((current) => current.map((label, at) => (at === index ? held : label)))
    setHeld(null)
  }

  const answerable = pictures.state === 'ready'

  return (
    <div className="leaf-puzzle">
      {pictures.state === 'loading' ? (
        <p role="status">Fetching the pictures this puzzle is about…</p>
      ) : null}

      {pictures.state === 'refused' ? (
        <Issues title="This puzzle cannot be shown" issues={pictures.issues} />
      ) : null}

      {split === undefined ? null : (
        <>
          <LeafTree
            questions={declared.questions}
            leaf={(index) => {
              const label = labelFor(labelling[index] ?? null)
              const chosen = labelling[index] ?? null
              const chosenPicture =
                chosen === null ? undefined : trayPicture(split, chosen, [])
              const reached = revealed ? (itemsByLeaf(declared)[index] ?? []) : []
              return (
                <div className="leaf-slot">
                  <button
                    type="button"
                    className="leaf"
                    data-leaf={index}
                    aria-label={
                      label === undefined
                        ? `Leaf ${index + 1}: say what this one is for`
                        : `Leaf ${index + 1}: ${label}`
                    }
                    onClick={() => place(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      place(index)
                    }}
                  >
                    {chosenPicture === undefined ? null : (
                      <Picture image={chosenPicture} size={LEAF_CELL_PX} />
                    )}
                    <span className="cell-label">
                      {label ?? 'Put one in here to say what this leaf is for'}
                    </span>
                  </button>

                  {reached.length === 0 ? null : (
                    <ul className="leaf-reached">
                      {reached.map((item) => {
                        const picture = pictureOf(split, item.image)
                        return (
                          <li key={item.image}>
                            {picture === undefined ? null : (
                              <Picture image={picture} size={LEAF_CELL_PX} />
                            )}
                            <span className="cell-label" data-reached={item.image}>
                              {item.image}
                            </span>
                            <span className="cell-label">
                              {declared.questions.map((question) => (
                                <span key={question.feature} className="leaf-value">
                                  {question.feature} {item.features[question.feature]}
                                </span>
                              ))}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            }}
          />

          <ul className="leaf-tray" aria-label="What each leaf could be for">
            {split.categories.map((category) => {
              const picture = trayPicture(split, category.id, filed)
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    className="tray-item"
                    draggable
                    aria-pressed={held === category.id}
                    data-tray={category.id}
                    onDragStart={() => setHeld(category.id)}
                    onDragEnd={() => setHeld(null)}
                    onClick={() => setHeld(held === category.id ? null : category.id)}
                  >
                    {picture === undefined ? null : (
                      <Picture image={picture} size={LEAF_CELL_PX} />
                    )}
                    <span className="cell-label">{category.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <p className="leaf-controls">
            {/*
              Calls nothing. It shows where the declared pieces land under the given
              questions and leaves the labelling exactly as the student left it — which is
              why a student may read the answer off it and still be judged on their merits.
            */}
            <button type="button" onClick={() => setRevealed(true)}>
              Test the tree
            </button>
            <button type="button" disabled={!answerable} onClick={() => onAttempt(labelling)}>
              That is what the leaves are for
            </button>
          </p>
        </>
      )}
    </div>
  )
}

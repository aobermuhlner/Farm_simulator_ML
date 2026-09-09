/**
 * The puzzle on screen: the tree it draws, the two gestures that label a leaf, what testing
 * reveals, and what it refuses to do when the pictures will not come.
 *
 * Run against the authored puzzle and the committed pool rather than a hand-typed pair, for
 * the reason every other screen test in this build is: the tree a student is shown is the
 * one the declaration carries, and a test over invented data would prove nothing about it.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { leafPuzzle, leafTutorial } from '../../../../test/helpers/leaves.js'
import {
  bestLabelling,
  judgeAttempt,
  LABEL_THE_LEAVES,
  TUTORIAL_KINDS,
  type LabelTheLeavesPuzzle,
} from '../../../../src/tutorials/index.js'
import type { Loaded } from '../../data/load.js'
import type { TrainingSplitView } from '../../data/pool.js'
import { appleDeclaration } from '../../test-support/declarations.js'
import { appleTrainingSplit } from '../../test-support/pool.js'
import { LeafLabellingBody, LeafTree } from './LeafLabelling.js'
import { TUTORIAL_BODIES, TutorialBody } from './TutorialBody.js'

afterEach(cleanup)

const puzzle = leafPuzzle()
const categories = appleDeclaration().categories
/** The label each declared category is presented by. Read from the declaration, never typed. */
const labels = new Map(categories.map((category) => [category.id, category.label]))
/** The labelling that clears the mark: one leaf per category, in the order the questions pose them. */
const best = bestLabelling(puzzle).labelling

/**
 * The committed split, projected once for the whole file.
 *
 * Reading and re-projecting a 338 KB manifest per render is the difference between a fast
 * screen suite and one that pushes every other file in the run past its timeout.
 */
const split = appleTrainingSplit()

function loads(): () => Promise<Loaded<TrainingSplitView>> {
  return () => Promise.resolve({ ok: true, value: split })
}

/** The control that offers the labelling for judging. */
function answerButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /that is what/i }) as HTMLButtonElement
}

function refuses(message = 'The pool could not be reached.') {
  return () => Promise.resolve({ ok: false as const, issues: [{ code: 'unreachable', message }] })
}

/** Waits for the pictures, then hands back the tray and the leaves. */
async function open(over: { readonly onAttempt?: (attempt: unknown) => void } = {}) {
  const onAttempt = vi.fn(over.onAttempt)
  render(<LeafLabellingBody puzzle={puzzle} onAttempt={onAttempt} loadSplit={loads()} />)
  await waitFor(() => expect(answerButton().disabled).toBe(false))
  const leaf = (index: number) =>
    document.querySelector<HTMLButtonElement>(`[data-leaf="${index}"]`) as HTMLButtonElement
  const tray = (category: string) =>
    document.querySelector<HTMLButtonElement>(`[data-tray="${category}"]`) as HTMLButtonElement
  return { onAttempt, leaf, tray }
}

describe('the tree it draws', () => {
  it('is posed from the declared questions alone', () => {
    // No task declaration, no split, no screen state — the drawing and the routing are the
    // same declared chain, so they cannot drift apart.
    render(<LeafTree questions={puzzle.questions} leaf={(index) => <b>leaf {index}</b>} />)

    for (const question of puzzle.questions) {
      expect(screen.getByText(new RegExp(`${question.feature}.*${question.threshold}`))).toBeTruthy()
    }
  })

  it('poses one leaf at every exit — one more than there are questions', () => {
    render(<LeafTree questions={puzzle.questions} leaf={(index) => <b>leaf {index}</b>} />)

    expect(screen.getAllByText(/^leaf \d$/)).toHaveLength(puzzle.questions.length + 1)
  })

  it('poses two leaves for a single question, so the count is the chain’s and not this puzzle’s', () => {
    render(
      <LeafTree
        questions={[{ feature: puzzle.questions[0]?.feature ?? '', threshold: 0.5 }]}
        leaf={(index) => <b>leaf {index}</b>}
      />,
    )

    expect(screen.getAllByText(/^leaf \d$/)).toHaveLength(2)
  })

  it('offers no control that changes a question’s feature or its threshold', async () => {
    const { leaf, tray } = await open()
    const controls = screen.getAllByRole('button')

    // Every control on the puzzle is a leaf, a tray item, the reveal or the answer. There is
    // nothing to turn that would move a threshold — which is what makes the disclosure true.
    const accounted = [
      ...puzzle.questions.map((_, index) => leaf(index)),
      leaf(puzzle.questions.length),
      ...categories.map((category) => tray(category.id)),
      screen.getByRole('button', { name: /test the tree/i }),
      screen.getByRole('button', { name: /that is what/i }),
    ]
    expect(controls).toHaveLength(accounted.length)
  })
})

describe('the tray', () => {
  it('holds one item per declared category, each with its declared label as text', async () => {
    const { tray } = await open()

    expect(categories.length).toBeGreaterThan(2)
    for (const category of categories) {
      expect(tray(category.id)).toBeTruthy()
      expect(tray(category.id).textContent).toContain(labels.get(category.id))
    }
  })

  it('distinguishes the categories without relying on the colour of the pictures', async () => {
    const { tray } = await open()

    for (const category of categories) {
      // The words are in the DOM, not merely conveyed by the photograph beside them, and the
      // picture is hidden from assistive technology precisely because the label is the cue.
      const label = tray(category.id).querySelector('.cell-label')
      expect(label?.textContent).toBe(labels.get(category.id))
      expect(tray(category.id).querySelector('[role="img"]')?.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('keeps offering one of every category however many leaves are labelled', async () => {
    const { leaf, tray } = await open()

    await userEvent.click(tray(categories[0]?.id ?? ''))
    await userEvent.click(leaf(0))

    for (const category of categories) expect(tray(category.id)).toBeTruthy()
  })
})

describe('labelling a leaf by dragging', () => {
  it('labels it with the category that was dragged in', async () => {
    const { leaf, tray } = await open()

    fireEvent.dragStart(tray('wormy'))
    fireEvent.drop(leaf(0))

    expect(leaf(0).getAttribute('aria-label')).toContain(labels.get('wormy'))
    expect(leaf(0).textContent).toContain(labels.get('wormy'))
  })

  it('replaces what was there when a second one is dragged in', async () => {
    const { leaf, tray } = await open()

    fireEvent.dragStart(tray('wormy'))
    fireEvent.drop(leaf(0))
    fireEvent.dragStart(tray('green'))
    fireEvent.drop(leaf(0))

    expect(leaf(0).getAttribute('aria-label')).toContain(labels.get('green'))
    expect(leaf(0).textContent).not.toContain(labels.get('wormy'))
  })

  it('holds at most one, and the labelling can still be changed before an answer', async () => {
    const { leaf, tray, onAttempt } = await open()

    fireEvent.dragStart(tray('red'))
    fireEvent.drop(leaf(1))
    expect(leaf(1).querySelectorAll('.cell-label')).toHaveLength(1)

    // Emptied by asking for a leaf with nothing in hand, and then filled again.
    await userEvent.click(leaf(1))
    expect(leaf(1).textContent).not.toContain(labels.get('red'))
    fireEvent.dragStart(tray('red'))
    fireEvent.drop(leaf(1))
    expect(leaf(1).textContent).toContain(labels.get('red'))
    expect(onAttempt).not.toHaveBeenCalled()
  })
})

describe('labelling a leaf by clicking', () => {
  it('produces the same labelling the drag does', async () => {
    const { leaf, tray, onAttempt } = await open()

    for (const [index, category] of best.entries()) {
      await userEvent.click(tray(category ?? ''))
      await userEvent.click(leaf(index))
    }
    await userEvent.click(screen.getByRole('button', { name: /that is what/i }))

    expect(onAttempt).toHaveBeenCalledWith(best)
  })

  it('solves the puzzle end to end with no pointer drag, by keyboard activation alone', async () => {
    const { leaf, tray, onAttempt } = await open()

    for (const [index, category] of best.entries()) {
      tray(category ?? '').focus()
      await userEvent.keyboard('{Enter}')
      leaf(index).focus()
      await userEvent.keyboard('{Enter}')
    }
    screen.getByRole('button', { name: /that is what/i }).focus()
    await userEvent.keyboard('{Enter}')

    expect(onAttempt).toHaveBeenCalledWith(best)
    // And what was offered is what the engine calls a pass, so the keyboard path is a
    // solution rather than merely a sequence of key presses.
    expect(judgeAttempt(leafTutorial(), best)).toBe(true)
  })

  it('shows which item is picked up, so a click path is followable', async () => {
    const { tray } = await open()

    await userEvent.click(tray('red'))

    expect(tray('red').getAttribute('aria-pressed')).toBe('true')
    expect(tray('green').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('testing the tree', () => {
  async function tested() {
    const opened = await open()
    await userEvent.click(screen.getByRole('button', { name: /test the tree/i }))
    return opened
  }

  it('shows every declared item in the leaf it reached', async () => {
    const { leaf } = await tested()

    for (const item of puzzle.items) {
      const shown = document.querySelector(`[data-reached="${item.image}"]`)
      expect(shown, item.image).toBeTruthy()
      // Placed in the leaf the declared questions send it to, and in exactly one.
      expect(document.querySelectorAll(`[data-reached="${item.image}"]`)).toHaveLength(1)
    }
    expect(leaf(0).parentElement?.textContent).toContain(puzzle.items[0]?.image)
  })

  it('places the escapee in the leaf the reds reach, which is the lesson', async () => {
    await tested()

    const escapee = puzzle.items.find(
      (item) => item.category === 'wormy' && item.features.darkSpotArea === 0,
    )
    const slot = document
      .querySelector(`[data-reached="${escapee?.image}"]`)
      ?.closest('.leaf-slot')

    expect(slot?.querySelector('[data-leaf]')?.getAttribute('data-leaf')).toBe('1')
  })

  it('summarises no measured feature over a split — no distribution, range, average or count', async () => {
    await tested()
    const shown = document.body.textContent ?? ''

    expect(shown).not.toMatch(/\b(average|mean|median|range|total|distribution|spread)\b/i)
    expect(shown).not.toMatch(/\d+\s*(of|\/)\s*\d+/)
    expect(shown).not.toMatch(/%/)
    // Nine named items, and nothing said about the two hundred they were drawn from.
    expect(shown).not.toMatch(/\b\d{3}\b/)
  })

  it('leaves the labelling exactly as the student left it', async () => {
    const { leaf, tray } = await open()

    await userEvent.click(tray('wormy'))
    await userEvent.click(leaf(0))
    await userEvent.click(screen.getByRole('button', { name: /test the tree/i }))

    expect(leaf(0).getAttribute('aria-label')).toContain(labels.get('wormy'))
    expect(leaf(1).getAttribute('aria-label')).toMatch(/say what this one is for/i)
  })

  it('neither passes nor fails the tutorial, and offers nothing for judging', async () => {
    const { onAttempt } = await tested()

    expect(onAttempt).not.toHaveBeenCalled()
  })

  it('can be read and then labelled from, and that answer is not marked as such', async () => {
    const { leaf, tray, onAttempt } = await tested()

    for (const [index, category] of best.entries()) {
      await userEvent.click(tray(category ?? ''))
      await userEvent.click(leaf(index))
    }
    await userEvent.click(screen.getByRole('button', { name: /that is what/i }))

    // The labelling and nothing else: no flag saying it was read off the reveal, because the
    // routing is what the puzzle exists to teach.
    expect(onAttempt).toHaveBeenCalledWith(best)
    expect(onAttempt.mock.calls[0]).toHaveLength(1)
  })
})

describe('offering the labelling for judging', () => {
  it('reports the labelling and decides nothing about it', async () => {
    const { leaf, tray, onAttempt } = await open()

    await userEvent.click(tray('green'))
    await userEvent.click(leaf(0))
    await userEvent.click(screen.getByRole('button', { name: /that is what/i }))

    // A labelling that fails, offered all the same: the body has no idea, and nothing on
    // screen says whether it passed. That is the engine's answer to give.
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(document.body.textContent ?? '').not.toMatch(/\b(passed|failed|correct|wrong)\b/i)
  })

  it('is judged by the engine’s registered kind', async () => {
    const tutorial = leafTutorial()

    expect(judgeAttempt(tutorial, best)).toBe(true)
    expect(judgeAttempt(tutorial, [best[1], best[0], best[2]])).toBe(false)
  })
})

describe('while the pictures are outstanding, and when they will not come', () => {
  it('states that it is loading and offers no answer', () => {
    render(
      <LeafLabellingBody puzzle={puzzle} onAttempt={() => {}} loadSplit={() => new Promise(() => {})} />,
    )

    expect(screen.getByRole('status').textContent).toMatch(/fetching/i)
    expect(screen.queryByRole('button', { name: /that is what/i })).toBeNull()
  })

  it('states the cause and offers no answer when they cannot be fetched', async () => {
    render(<LeafLabellingBody puzzle={puzzle} onAttempt={() => {}} loadSplit={refuses()} />)

    await waitFor(() => expect(screen.getByText(/could not be reached/i)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /that is what/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /test the tree/i })).toBeNull()
  })

  it('states the cause when it is offered no pictures at all', async () => {
    render(<LeafLabellingBody puzzle={puzzle} onAttempt={() => {}} />)

    await waitFor(() => expect(screen.getByText(/nothing to place/i)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /that is what/i })).toBeNull()
  })

  it('states the cause when a picture it asks about is not among the task’s images', async () => {
    const short = {
      ...split,
      images: split.images.filter((image) => image.imageId !== puzzle.items[0]?.image),
    }
    render(
      <LeafLabellingBody
        puzzle={puzzle}
        onAttempt={() => {}}
        loadSplit={() => Promise.resolve({ ok: true, value: short })}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(new RegExp(puzzle.items[0]?.image ?? ''))).toBeTruthy(),
    )
    expect(screen.queryByRole('button', { name: /that is what/i })).toBeNull()
  })

  it('can be opened again after a failure, and shows the puzzle when the pictures come', async () => {
    const { unmount } = render(
      <LeafLabellingBody puzzle={puzzle} onAttempt={() => {}} loadSplit={refuses()} />,
    )
    await waitFor(() => expect(screen.getByText(/could not be reached/i)).toBeTruthy())
    unmount()

    render(<LeafLabellingBody puzzle={puzzle} onAttempt={() => {}} loadSplit={loads()} />)

    await waitFor(() => expect(answerButton().disabled).toBe(false))
    expect(screen.queryByText(/could not be reached/i)).toBeNull()
  })
})

describe('what passes does not depend on the pictures', () => {
  it('judges one labelling the same way however the pictures fared', () => {
    // The questions, the values, the categories and the mark are all declared, so the judge
    // never sees a picture. This is the assertion that the frame and the gate cannot come
    // apart over a failed fetch.
    const tutorial = leafTutorial()
    const failing = [best[1], best[0], best[2]]

    expect(judgeAttempt(tutorial, best)).toBe(true)
    expect(judgeAttempt(tutorial, failing)).toBe(false)
    expect((tutorial.puzzle as LabelTheLeavesPuzzle).items.every((item) => 'features' in item)).toBe(
      true,
    )
  })

  it('offers no answer at all while they are missing, rather than a judgement without them', async () => {
    const onAttempt = vi.fn()
    render(<LeafLabellingBody puzzle={puzzle} onAttempt={onAttempt} loadSplit={refuses()} />)

    await waitFor(() => expect(screen.getByText(/could not be reached/i)).toBeTruthy())

    expect(onAttempt).not.toHaveBeenCalled()
    expect(screen.queryAllByRole('button')).toEqual([])
  })
})

describe('the two registries, now that both carry a kind', () => {
  it('carry the same set of kinds', () => {
    expect(Object.keys(TUTORIAL_BODIES).sort()).toEqual(Object.keys(TUTORIAL_KINDS).sort())
    expect(Object.keys(TUTORIAL_BODIES)).toEqual([LABEL_THE_LEAVES])
  })

  it('mounts this body when a declaration names its kind', async () => {
    render(
      <TutorialBody
        kind={LABEL_THE_LEAVES}
        puzzle={puzzle}
        onAttempt={() => {}}
        loadSplit={loads()}
      />,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: /test the tree/i })).toBeTruthy())
  })
})

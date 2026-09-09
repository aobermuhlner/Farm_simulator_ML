/**
 * The mounting: one kind, one body, usable on its own.
 *
 * The same shape `network-diagram` settled for a family's drawing, asserted the same way.
 * A body is handed its declared puzzle data and nothing else — no task declaration, no
 * screen state, no other kind's body — which is what lets a kind be added as a leaf.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TUTORIAL_KINDS } from '../../../../src/tutorials/index.js'
import {
  FIXTURE_ANSWER,
  FIXTURE_KIND,
  fixtureBodies,
  fixtureTutorial,
  onlyPickOne,
  SECOND_KIND,
} from '../../test-support/tutorials.js'
import type { TutorialBodyProps } from './TutorialBody.js'
import { TUTORIAL_BODIES, TutorialBody } from './TutorialBody.js'

afterEach(cleanup)

const puzzle = fixtureTutorial().puzzle

describe('a body is mounted from its declared data alone', () => {
  it('poses the puzzle given nothing but the declared puzzle data', () => {
    render(<TutorialBody kind={FIXTURE_KIND} puzzle={puzzle} onAttempt={() => {}} bodies={onlyPickOne} />)

    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'green' })).toBeTruthy()
  })

  it('offers what the student chose, and judges nothing itself', async () => {
    const onAttempt = vi.fn()
    render(<TutorialBody kind={FIXTURE_KIND} puzzle={puzzle} onAttempt={onAttempt} bodies={onlyPickOne} />)

    await userEvent.click(screen.getByRole('button', { name: 'green' }))

    // The body reports the answer; whether it passes is the engine kind's decision, so
    // that the screen and the gate cannot disagree about what solving the puzzle means.
    expect(onAttempt).toHaveBeenCalledWith('green')
  })

  it('is usable without the other kinds being registered', () => {
    expect(Object.keys(onlyPickOne)).toEqual([FIXTURE_KIND])

    render(<TutorialBody kind={FIXTURE_KIND} puzzle={puzzle} onAttempt={() => {}} bodies={onlyPickOne} />)

    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
  })
})

describe('the browsable split a kind may be given', () => {
  it('leaves a body needing none posed from its declared data alone', () => {
    // Nothing is passed, and the puzzle is still there. That is what keeps the body
    // contract's promise true for a kind whose puzzle is about no picture at all.
    render(<TutorialBody kind={FIXTURE_KIND} puzzle={puzzle} onAttempt={() => {}} bodies={onlyPickOne} />)

    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
  })

  it('is handed to the body it mounts, unread by the dispatcher', () => {
    const loadSplit = vi.fn()
    let given: unknown = 'not given'
    const bodies = {
      [FIXTURE_KIND]: (props: TutorialBodyProps) => {
        given = props.loadSplit
        return null
      },
    }

    render(
      <TutorialBody
        kind={FIXTURE_KIND}
        puzzle={puzzle}
        onAttempt={() => {}}
        loadSplit={loadSplit as unknown as TutorialBodyProps['loadSplit']}
        bodies={bodies}
      />,
    )

    expect(given).toBe(loadSplit)
    // Dispatching is all this file does: whether the pictures are wanted, and what is
    // shown while they are outstanding, is the body's decision.
    expect(loadSplit).not.toHaveBeenCalled()
  })
})

describe('adding a kind', () => {
  it('leaves the first kind rendering exactly as it did', async () => {
    const onAttempt = vi.fn()
    render(<TutorialBody kind={FIXTURE_KIND} puzzle={puzzle} onAttempt={onAttempt} bodies={fixtureBodies} />)

    await userEvent.click(screen.getByRole('button', { name: FIXTURE_ANSWER }))

    expect(onAttempt).toHaveBeenCalledWith(FIXTURE_ANSWER)
    expect(screen.queryByRole('button', { name: 'Guess' })).toBeNull()
  })

  it('is reached by its own kind and by nothing else', () => {
    render(<TutorialBody kind={SECOND_KIND} puzzle={puzzle} onAttempt={() => {}} bodies={fixtureBodies} />)

    expect(screen.getByRole('button', { name: 'Guess' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: FIXTURE_ANSWER })).toBeNull()
  })
})

describe('the two registries', () => {
  it('carry the same set of kinds, so a half-added kind fails here', () => {
    // An engine kind with no body would validate and then render an empty frame; a body
    // with no engine kind could never be reached, because its declaration is refused.
    expect(Object.keys(TUTORIAL_BODIES).sort()).toEqual(Object.keys(TUTORIAL_KINDS).sort())
  })

  it('carry the kinds this build poses, and none a test invented', () => {
    expect(Object.keys(TUTORIAL_BODIES).length).toBeGreaterThan(0)
    expect(Object.keys(TUTORIAL_BODIES)).not.toContain(FIXTURE_KIND)
    expect(Object.keys(TUTORIAL_BODIES)).not.toContain(SECOND_KIND)
  })
})

describe('a kind with no body', () => {
  it('renders nothing rather than taking the page down', () => {
    // Unreachable in a loaded build: the declaration was refused at load. The registry
    // test above is what actually catches a mismatch.
    const { container } = render(
      <TutorialBody kind="drag-the-apples" puzzle={puzzle} onAttempt={() => {}} bodies={fixtureBodies} />,
    )

    expect(container.textContent).toBe('')
  })

  it('is not fooled by a name every object carries', () => {
    const { container } = render(
      <TutorialBody kind="constructor" puzzle={puzzle} onAttempt={() => {}} bodies={fixtureBodies} />,
    )

    expect(container.textContent).toBe('')
  })
})

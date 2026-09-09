/**
 * The frame: what it shows, what it does with an answer, and what it refuses to keep.
 *
 * The two promises worth asserting directly are that a failure costs nothing and that a
 * pass cannot be undone. Between them they are the whole of "free and unlimited, and
 * completion is the whole of the record".
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TutorialDeclaration } from '../../../../src/task/types.js'
import {
  FIXTURE_ANSWER,
  fixtureBodies,
  fixtureKinds,
  fixtureTutorial,
} from '../../test-support/tutorials.js'
import { Tutorial } from './Tutorial.js'

afterEach(cleanup)

function renderTutorial(
  over: {
    readonly tutorial?: TutorialDeclaration
    readonly complete?: boolean
    readonly onComplete?: () => void
    readonly onClose?: () => void
  } = {},
) {
  return render(
    <Tutorial
      tutorial={over.tutorial ?? fixtureTutorial()}
      complete={over.complete ?? false}
      onComplete={over.onComplete ?? (() => {})}
      onClose={over.onClose ?? (() => {})}
      kinds={fixtureKinds}
      bodies={fixtureBodies}
    />,
  )
}

describe('what the frame presents', () => {
  it('shows the declared title, summary and theory, and supplies none of its own', () => {
    const tutorial = fixtureTutorial()
    renderTutorial()

    expect(screen.getByRole('heading', { name: tutorial.title })).toBeTruthy()
    expect(screen.getByText(tutorial.teaching.summary)).toBeTruthy()
    expect(screen.getByText(tutorial.teaching.theory)).toBeTruthy()
  })

  it('renders a differently declared tutorial through the same frame', () => {
    const other = fixtureTutorial({
      id: 'name-the-shapes',
      title: 'Name the shapes',
      teaching: { summary: 'Point at the round one.', theory: 'Shape is a feature too.' },
    })
    renderTutorial({ tutorial: other })

    expect(screen.getByRole('heading', { name: 'Name the shapes' })).toBeTruthy()
    expect(screen.getByText('Point at the round one.')).toBeTruthy()
  })

  it('mounts the body its kind names', () => {
    renderTutorial()

    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
  })
})

describe('what the tutorial simplifies', () => {
  it('is readable without operating any control', () => {
    const tutorial = fixtureTutorial()
    renderTutorial()

    const stated = screen.getByText(tutorial.disclosure)

    // Not inside a disclosure, not inside anything closed, and not behind a button: there
    // is nothing on the screen to press before it can be read.
    expect(stated.closest('details')).toBeNull()
    expect(stated.closest('button')).toBeNull()
    expect(stated.hidden).toBe(false)
  })

  it('appears with the puzzle rather than in place of it', () => {
    renderTutorial()

    expect(screen.getByText(fixtureTutorial().disclosure)).toBeTruthy()
    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
  })

  it('reads whatever the declaration says, and supplies nothing of its own', () => {
    const other = fixtureTutorial({
      disclosure: 'The real one has to find the words for itself.',
    })
    renderTutorial({ tutorial: other })

    expect(screen.getByText('The real one has to find the words for itself.')).toBeTruthy()
    expect(screen.queryByText(fixtureTutorial().disclosure)).toBeNull()
  })

  it('is not satisfied by theory copy, which stays behind its disclosure', () => {
    // The theory is where every screen in this build puts theory, and putting the
    // simplification there instead would be putting it behind a control.
    const tutorial = fixtureTutorial()
    renderTutorial()

    expect(screen.getByText(tutorial.teaching.theory).closest('details')).not.toBeNull()
    expect(screen.getByText(tutorial.disclosure).closest('details')).toBeNull()
  })
})

describe('an attempt', () => {
  it('reports a pass once, and says so', async () => {
    const onComplete = vi.fn()
    renderTutorial({ onComplete })

    await userEvent.click(screen.getByRole('button', { name: FIXTURE_ANSWER }))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/well read/i)).toBeTruthy()
  })

  it('reports nothing when it fails, and can be tried again at once', async () => {
    const onComplete = vi.fn()
    renderTutorial({ onComplete })

    await userEvent.click(screen.getByRole('button', { name: 'green' }))
    await userEvent.click(screen.getByRole('button', { name: 'wormy' }))

    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByText(/costs nothing/i)).toBeTruthy()
    // Nothing was withheld, deducted or delayed: the options are all still there to press.
    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
  })

  it('shows no attempt count, no score and no timing however many are made', async () => {
    renderTutorial()

    await userEvent.click(screen.getByRole('button', { name: 'green' }))
    await userEvent.click(screen.getByRole('button', { name: 'wormy' }))
    await userEvent.click(screen.getByRole('button', { name: 'green' }))

    const shown = document.body.textContent ?? ''
    expect(shown).not.toMatch(/\battempt/i)
    expect(shown).not.toMatch(/\bscore/i)
    expect(shown).not.toMatch(/\b[123]\s*(tries|attempts|of)\b/i)
  })

  it('passes after failing, with the failures having cost nothing', async () => {
    const onComplete = vi.fn()
    renderTutorial({ onComplete })

    await userEvent.click(screen.getByRole('button', { name: 'green' }))
    await userEvent.click(screen.getByRole('button', { name: FIXTURE_ANSWER }))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('a tutorial already passed', () => {
  it('is still opened, still readable and still attemptable', () => {
    renderTutorial({ complete: true })

    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
    expect(screen.getByText(fixtureTutorial().teaching.summary)).toBeTruthy()
    expect(screen.getByText(/already finished/i)).toBeTruthy()
  })

  it('stays passed when an attempt on it fails', async () => {
    const onComplete = vi.fn()
    renderTutorial({ complete: true, onComplete })

    await userEvent.click(screen.getByRole('button', { name: 'green' }))

    // Nothing reports it as un-passed, and nothing was told to un-record it: the frame
    // has no way to say that, which is how "it does not come undone" is kept.
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByText(/already finished/i)).toBeTruthy()
  })
})

describe('leaving', () => {
  it('closes without judging anything', async () => {
    const onClose = vi.fn()
    const onComplete = vi.fn()
    renderTutorial({ onClose, onComplete })

    await userEvent.click(screen.getByRole('button', { name: /back to the workshop/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })
})

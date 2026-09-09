/**
 * The authored puzzle played through the workshop, end to end, with nothing injected.
 *
 * The registries are the shipped ones, the puzzle is the block committed under
 * `declarations/tutorials/`, the pictures are the committed pool and the judge is the
 * engine's registered kind. That combination is the one thing no other test in this change
 * covers: the engine tests judge without a screen, the body tests pose without a gate, and
 * the shell tests gate with a fixture puzzle.
 *
 * The tutorial is hung on the shipped task's family *here in the test* rather than in
 * `declarations/apple-harvest.json`, because the family this lesson belongs to — the fitted
 * tree — is not built yet. `openspec/changes/fitted-tree-tutorial/tasks.md` §6 records the
 * arrangement and the reason: gating the only model the game currently has behind a lesson
 * about a different one would be a wall with the wrong sign on it. What that change adds is
 * the block; that it works is what this asserts.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { leafTutorial } from '../../../test/helpers/leaves.js'
import { firstFamily } from '../../../src/task/families.js'
import type { TaskDeclaration, TutorialId } from '../../../src/task/types.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import { bestLabelling, type LabelTheLeavesPuzzle } from '../../../src/tutorials/index.js'
import { appleArtifact, appleDeclaration, entryLoader } from '../test-support/declarations.js'
import { appleTrainingSplit } from '../test-support/pool.js'
import { ConfigureTask } from './ConfigureTask.js'

afterEach(cleanup)

const TUTORIAL = leafTutorial()
const puzzle = TUTORIAL.puzzle as LabelTheLeavesPuzzle
const best = bestLabelling(puzzle).labelling

/** The shipped task with the authored tutorial hung on its first family, through the real validator. */
function tutoredApple(): TaskDeclaration {
  const apple = appleDeclaration()
  const [first, ...rest] = apple.families
  const result = validateDeclaration({
    ...apple,
    families: [{ ...first, tutorial: TUTORIAL }, ...rest],
  })
  if (!result.ok) {
    throw new Error(
      `the authored tutorial does not load on the shipped task: ${result.issues
        .map((issue) => issue.message)
        .join(' ')}`,
    )
  }
  return result.declaration
}

const apple = tutoredApple()
const family = firstFamily(apple)
const knobLabel = family.knobs[0]?.label ?? ''
const split = appleTrainingSplit()

/**
 * The workshop with the shell's one piece of state around it.
 *
 * Completion lives above this screen in the real app, and the whole question here is what
 * changes when it arrives — so the test has to hold it rather than pass a constant.
 */
function Workshop() {
  const [completed, setCompleted] = useState<readonly TutorialId[]>([])
  return (
    <ConfigureTask
      declaration={apple}
      loadEntry={entryLoader(apple, appleArtifact())}
      loadSplit={() => Promise.resolve({ ok: true, value: split })}
      replayMs={0}
      onBack={() => {}}
      onPutToWork={() => {}}
      completedTutorials={completed}
      onTutorialComplete={(id) => setCompleted((current) => [...current, id])}
    />
  )
}

async function makeModel(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: /train model/i }))
  await screen.findByTestId('training-step')
}

async function openPuzzle(): Promise<void> {
  const [entry] = screen.getAllByRole('button', { name: TUTORIAL.title })
  if (entry === undefined) throw new Error('the workshop offers no tutorial')
  await userEvent.click(entry)
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: /that is what/i }) as HTMLButtonElement).disabled,
    ).toBe(false),
  )
}

/** Labels every leaf with the best labelling, by the click path. */
async function labelLeaves(): Promise<void> {
  for (const [index, category] of best.entries()) {
    const tray = document.querySelector<HTMLButtonElement>(`[data-tray="${category}"]`)
    const leaf = document.querySelector<HTMLButtonElement>(`[data-leaf="${index}"]`)
    if (tray === null || leaf === null) throw new Error(`no tray item or leaf for ${index}`)
    await userEvent.click(tray)
    await userEvent.click(leaf)
  }
}

describe('everything but fielding is open while the lesson is outstanding', () => {
  it('lets the family be selected, its knobs set and its model made', async () => {
    render(<Workshop />)

    const knob = screen.getByLabelText(knobLabel) as HTMLSelectElement
    const other = [...knob.options].map((option) => option.value).find((value) => value !== knob.value)
    if (other !== undefined) await userEvent.selectOptions(knob, other)
    await makeModel()

    expect((screen.getByLabelText(knobLabel) as HTMLSelectElement).value).toBe(other ?? knob.value)
    expect(screen.getByTestId('training-step')).toBeTruthy()
  })

  it('offers no control that puts the model to work, and says the lesson is what is missing', async () => {
    render(<Workshop />)
    await makeModel()

    expect(screen.queryByRole('button', { name: /put this model to work/i })).toBeNull()
    const withheld = document.querySelector('.tutorial-withheld')?.textContent ?? ''
    expect(withheld).toContain(TUTORIAL.title)
    // Something to go and do, not a fault: nothing about money or a configuration that
    // will not run.
    expect(withheld).not.toMatch(/cannot|error|buy|afford/i)
  })

  it('states what the puzzle simplifies in plain view, beside the puzzle', async () => {
    render(<Workshop />)
    await openPuzzle()

    const stated = screen.getByText(TUTORIAL.disclosure)

    expect(stated.closest('details')).toBeNull()
    expect(screen.getByText(TUTORIAL.teaching.theory).closest('details')).not.toBeNull()
  })
})

describe('solving the authored puzzle', () => {
  it('is judged by the shipped kind and opens fielding, and changes nothing else', async () => {
    render(<Workshop />)
    const before = (screen.getByLabelText(knobLabel) as HTMLSelectElement).value
    const configuration = screen.getByTestId('current-configuration').textContent
    await makeModel()

    await openPuzzle()
    await labelLeaves()
    await userEvent.click(screen.getByRole('button', { name: /that is what/i }))
    expect(screen.getByText(/well read/i)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /back to the workshop/i }))

    expect(screen.getByRole('button', { name: /put this model to work/i })).toBeTruthy()
    expect((screen.getByLabelText(knobLabel) as HTMLSelectElement).value).toBe(before)
    expect(screen.getByTestId('current-configuration').textContent).toBe(configuration)
    expect(document.querySelector('.tutorial-withheld')).toBeNull()
  })

  it('withholds fielding for a labelling below the mark, and costs nothing to try again', async () => {
    render(<Workshop />)
    await makeModel()
    await openPuzzle()

    // Every leaf the same: it clears no mark, and the puzzle is there to try again at once.
    for (const index of best.keys()) {
      const tray = document.querySelector<HTMLButtonElement>(`[data-tray="${best[0]}"]`)
      const leaf = document.querySelector<HTMLButtonElement>(`[data-leaf="${index}"]`)
      if (tray === null || leaf === null) throw new Error('the puzzle is not posed')
      await userEvent.click(tray)
      await userEvent.click(leaf)
    }
    await userEvent.click(screen.getByRole('button', { name: /that is what/i }))

    expect(screen.getByText(/costs nothing/i)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /back to the workshop/i }))
    expect(screen.queryByRole('button', { name: /put this model to work/i })).toBeNull()
  })

  it('shows no count, score or share of what was right', async () => {
    render(<Workshop />)
    await openPuzzle()
    await labelLeaves()
    await userEvent.click(screen.getByRole('button', { name: /that is what/i }))

    const shown = document.body.textContent ?? ''
    expect(shown).not.toMatch(/\d+\s*(of|\/)\s*\d+/)
    expect(shown).not.toMatch(/%|\bscore\b|\bmark\b|\battempt/i)
  })

  it('stays passed after a later failed attempt', async () => {
    render(<Workshop />)
    await makeModel()
    await openPuzzle()
    await labelLeaves()
    await userEvent.click(screen.getByRole('button', { name: /that is what/i }))

    // The same puzzle, answered wrongly the second time. Completion does not come undone.
    const tray = document.querySelector<HTMLButtonElement>(`[data-tray="${best[1]}"]`)
    const leaf = document.querySelector<HTMLButtonElement>('[data-leaf="0"]')
    if (tray === null || leaf === null) throw new Error('the puzzle is not posed')
    await userEvent.click(tray)
    await userEvent.click(leaf)
    await userEvent.click(screen.getByRole('button', { name: /that is what/i }))
    await userEvent.click(screen.getByRole('button', { name: /back to the workshop/i }))

    expect(screen.getByRole('button', { name: /put this model to work/i })).toBeTruthy()
  })
})

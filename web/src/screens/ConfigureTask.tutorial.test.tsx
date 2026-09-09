/**
 * The workshop when a family declares a tutorial.
 *
 * The gate bites exactly here — where a model is put to work — and nowhere else. So the
 * cases worth holding are the two edges: everything else about the family is untouched,
 * and the one control that is withheld says what to go and do rather than reporting a
 * fault.
 *
 * Rendered against a task the screens have never seen, so a screen that had learned
 * anything about it would fail here.
 *
 * See openspec/changes/model-tutorials/specs/simulator-shell/spec.md.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ModelFamilyDeclaration,
  TutorialDeclaration,
  TutorialId,
} from '../../../src/task/types.js'
import { ladderLoader, tutoredLadderDeclaration } from '../test-support/declarations.js'
import {
  FIXTURE_ANSWER,
  fixtureBodies,
  fixtureKinds,
} from '../test-support/tutorials.js'
import type { TutorialBodyProps } from '../components/tutorial/TutorialBody.js'
import { appleTrainingSplit } from '../test-support/pool.js'
import { ConfigureTask } from './ConfigureTask.js'

afterEach(cleanup)

const ladder = tutoredLadderDeclaration()

/** The two rungs, in declared order: the first carries a tutorial, the second none. */
function rung(index: number): ModelFamilyDeclaration {
  const family = ladder.families[index]
  if (family === undefined) throw new Error(`the tutored ladder declares no family ${index}`)
  return family
}

const GATED = rung(0)
const UNGATED = rung(1)
function declaredTutorial(family: ModelFamilyDeclaration): TutorialDeclaration {
  if (family.tutorial === undefined) throw new Error('the tutored ladder must declare a tutorial')
  return family.tutorial
}

const TUTORIAL = declaredTutorial(GATED)

const knob = GATED.knobs[0]
if (knob === undefined) throw new Error('the tutored family must declare a knob')
const knobLabel = knob.label

function renderWorkshop(
  over: {
    readonly completedTutorials?: readonly TutorialId[]
    readonly onTutorialComplete?: (id: TutorialId) => void
    readonly onPutToWork?: (familyId: string, configurationId: string) => void
    readonly onHandBack?: () => void
    readonly initialFamily?: string
    readonly atWork?: { readonly family: string; readonly configurationId: string }
  } = {},
) {
  return render(
    <ConfigureTask
      declaration={ladder}
      loadEntry={ladderLoader(ladder)}
      replayMs={0}
      onBack={() => {}}
      initialFamily={over.initialFamily}
      onPutToWork={over.onPutToWork ?? (() => {})}
      onHandBack={over.onHandBack}
      atWork={over.atWork}
      completedTutorials={over.completedTutorials ?? []}
      onTutorialComplete={over.onTutorialComplete}
      tutorialKinds={fixtureKinds}
      tutorialBodies={fixtureBodies}
    />,
  )
}

/**
 * Makes the model for whatever family is showing, so the fielding control is reachable.
 *
 * Waited on by the replay's own step counter rather than by the fielding control, because
 * the whole question here is whether that control appears.
 */
async function makeModel(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: /train model/i }))
  await screen.findByTestId('training-step')
}

function openTutorial(): Promise<void> {
  const [first] = screen.getAllByRole('button', { name: TUTORIAL.title })
  if (first === undefined) throw new Error('the workshop offers no tutorial')
  return userEvent.click(first)
}

describe('the tutorial is offered from the workshop', () => {
  it('offers the selected family’s tutorial beside its knobs', () => {
    renderWorkshop()

    expect(screen.getByRole('button', { name: TUTORIAL.title })).toBeTruthy()
  })

  it('offers it still once it has been passed, so the theory stays reachable', async () => {
    renderWorkshop({ completedTutorials: [TUTORIAL.id] })

    await openTutorial()

    expect(screen.getByText(TUTORIAL.teaching.theory)).toBeTruthy()
    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
  })

  it('offers none for a family that declares none', () => {
    renderWorkshop({ initialFamily: UNGATED.id })

    expect(screen.queryByRole('button', { name: TUTORIAL.title })).toBeNull()
  })

  it('opens nothing unbidden — the puzzle waits to be asked for', () => {
    renderWorkshop()

    expect(screen.queryByRole('heading', { name: TUTORIAL.title })).toBeNull()
    expect(screen.queryByRole('button', { name: FIXTURE_ANSWER })).toBeNull()
  })

  it('leaves the knobs and the family exactly where they were', async () => {
    renderWorkshop()
    const chosen = (screen.getByLabelText(knobLabel) as HTMLSelectElement).value

    await openTutorial()
    await userEvent.click(screen.getByRole('button', { name: /back to the workshop/i }))

    expect((screen.getByLabelText(knobLabel) as HTMLSelectElement).value).toBe(chosen)
  })
})

describe('the pictures the workshop already loads', () => {
  /** Projected once: re-reading the committed manifest per render slows the whole run. */
  const split = appleTrainingSplit()

  /** A body that reports what it was handed, so the wiring can be asserted rather than assumed. */
  function reporting(seen: { current?: unknown }) {
    return {
      [TUTORIAL.kind]: (props: TutorialBodyProps) => {
        seen.current = props.loadSplit
        return <p>posed</p>
      },
    }
  }

  it('are forwarded to the mounted puzzle', async () => {
    const seen: { current?: unknown } = {}
    const loadSplit = () => Promise.resolve({ ok: true as const, value: split })
    render(
      <ConfigureTask
        declaration={ladder}
        loadEntry={ladderLoader(ladder)}
        replayMs={0}
        onBack={() => {}}
        loadSplit={loadSplit}
        completedTutorials={[]}
        tutorialKinds={fixtureKinds}
        tutorialBodies={reporting(seen)}
      />,
    )

    await openTutorial()

    // The workshop narrows the loader to the tier its dataset knob names before handing
    // it on, so what the puzzle receives asks for that tier rather than for the split.
    expect(seen.current).toBeTypeOf('function')
    const asked = await (seen.current as () => Promise<unknown>)()
    expect(asked).toEqual({ ok: true, value: split })
  })

  it('are not forwarded when the task ships none to browse', async () => {
    const seen: { current?: unknown } = { current: 'not given' }
    render(
      <ConfigureTask
        declaration={ladder}
        loadEntry={ladderLoader(ladder)}
        replayMs={0}
        onBack={() => {}}
        completedTutorials={[]}
        tutorialKinds={fixtureKinds}
        tutorialBodies={reporting(seen)}
      />,
    )

    await openTutorial()

    expect(seen.current).toBeUndefined()
  })

  it('carry no measured value and no generation attribute with them', async () => {
    // The projection in `data/pool.ts` closed that boundary; this is the assertion that
    // forwarding the loader to a puzzle did not reopen it.
    const [image] = split.images

    expect(Object.keys(image ?? {}).sort()).toEqual([
      'atlasHeight',
      'atlasUrl',
      'atlasWidth',
      'category',
      'cellSize',
      'imageId',
      'label',
      'x',
      'y',
    ])
    expect(JSON.stringify(split)).not.toContain('wormVisibility')
    expect(JSON.stringify(split)).not.toContain('features')
  })
})

describe('passing it', () => {
  it('reports the tutorial id, once', async () => {
    const onTutorialComplete = vi.fn()
    renderWorkshop({ onTutorialComplete })

    await openTutorial()
    await userEvent.click(screen.getByRole('button', { name: FIXTURE_ANSWER }))

    expect(onTutorialComplete).toHaveBeenCalledWith(TUTORIAL.id)
    expect(onTutorialComplete).toHaveBeenCalledTimes(1)
  })

  it('reports nothing for a failed attempt, which can be retried at once', async () => {
    const onTutorialComplete = vi.fn()
    renderWorkshop({ onTutorialComplete })

    await openTutorial()
    await userEvent.click(screen.getByRole('button', { name: 'green' }))

    expect(onTutorialComplete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: FIXTURE_ANSWER })).toBeTruthy()
  })
})

describe('what an unfinished tutorial withholds', () => {
  it('withholds the control that puts the model to work, however complete the model is', async () => {
    renderWorkshop()

    await makeModel()

    expect(screen.queryByRole('button', { name: /put this model to work/i })).toBeNull()
  })

  it('names the tutorial and offers the way to it', async () => {
    renderWorkshop()

    await makeModel()

    const withheld = document.querySelector('.tutorial-withheld')
    expect(withheld).not.toBeNull()
    expect(withheld?.textContent).toContain(TUTORIAL.title)
    const way = withheld?.querySelector('button')
    if (way === null || way === undefined) throw new Error('nothing offers the way to it')
    await userEvent.click(way)
    expect(screen.getByRole('heading', { name: TUTORIAL.title })).toBeTruthy()
  })

  it('says nothing about a fault, a purchase or a configuration that will not run', async () => {
    renderWorkshop()

    await makeModel()

    const withheld = document.querySelector('.tutorial-withheld')?.textContent ?? ''
    expect(withheld).not.toMatch(/error|cannot|could not|failed|invalid/i)
    expect(withheld).not.toMatch(/buy|price|afford|own/i)
    expect(withheld).not.toMatch(/untrained|no model was trained/i)
  })

  it('withholds nothing else — the family is selected, tuned and its model made', async () => {
    renderWorkshop()

    expect(screen.getByLabelText(knobLabel)).toBeTruthy()
    expect(screen.getByText(GATED.teaching.summary)).toBeTruthy()

    await makeModel()

    expect(screen.getByTestId('training-step')).toBeTruthy()
  })

  it('does not reach a family that declares no tutorial', async () => {
    // Waited on by the fielding control itself: this family records no history, so there
    // is no replay counter to watch for, and the control is what the test is about.
    renderWorkshop({ initialFamily: UNGATED.id })

    await userEvent.click(screen.getByRole('button', { name: /train model/i }))

    expect(await screen.findByRole('button', { name: /put this model to work/i })).toBeTruthy()
    expect(document.querySelector('.tutorial-withheld')).toBeNull()
  })

  it('never withholds handing the job back', async () => {
    const onHandBack = vi.fn()
    renderWorkshop({
      atWork: { family: GATED.id, configurationId: 'depth1-photographsclinic' },
      onHandBack,
    })

    await userEvent.click(screen.getByRole('button', { name: /hand this job back/i }))

    expect(onHandBack).toHaveBeenCalledTimes(1)
  })
})

describe('passing it while a model is already made', () => {
  it('offers the control without the model having to be made again', async () => {
    const onPutToWork = vi.fn()
    const { rerender } = render(
      <ConfigureTask
        declaration={ladder}
        loadEntry={ladderLoader(ladder)}
        replayMs={0}
        onBack={() => {}}
        onPutToWork={onPutToWork}
        completedTutorials={[]}
        tutorialKinds={fixtureKinds}
        tutorialBodies={fixtureBodies}
      />,
    )

    await makeModel()
    expect(screen.queryByRole('button', { name: /put this model to work/i })).toBeNull()

    // The shell records the pass and re-renders; the replay is not restarted.
    rerender(
      <ConfigureTask
        declaration={ladder}
        loadEntry={ladderLoader(ladder)}
        replayMs={0}
        onBack={() => {}}
        onPutToWork={onPutToWork}
        completedTutorials={[TUTORIAL.id]}
        tutorialKinds={fixtureKinds}
        tutorialBodies={fixtureBodies}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /put this model to work/i }))

    expect(onPutToWork).toHaveBeenCalledWith(GATED.id, 'depth1-photographsclinic')
  })
})

describe('selecting another family', () => {
  it('leaves the puzzle behind with the family it belonged to', async () => {
    renderWorkshop()
    await openTutorial()
    expect(screen.getByRole('heading', { name: TUTORIAL.title })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /back to the workshop/i }))
    const other = document.querySelector(`[data-family="${UNGATED.id}"]`)
    if (other === null) throw new Error('the picker offers no second family')
    await userEvent.click(other)

    expect(screen.queryByRole('button', { name: TUTORIAL.title })).toBeNull()
  })
})

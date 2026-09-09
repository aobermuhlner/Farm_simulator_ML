/**
 * The workshop when a task offers more than one kind of model.
 *
 * The picker swaps what the settings panel is about; it commits nothing. That separation
 * is the point of the whole change: opening the picker to look at a tree the student is
 * considering must not take the network off the orchard, and must not move a penny.
 *
 * Everything here is rendered from a task the screens have never seen — its families, its
 * knobs and its vocabulary are all its own — so a screen that had learned any of them
 * would fail against it.
 *
 * See openspec/changes/model-families/specs/simulator-shell/spec.md.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FamilyAvailability } from '../../../src/progression/index.js'
import { firstFamily } from '../../../src/task/families.js'
import type { ModelFamilyDeclaration } from '../../../src/task/types.js'
import {
  appleArtifact,
  appleDeclaration,
  entryLoader,
  ladderLoader,
  twoFamilyDeclaration,
} from '../test-support/declarations.js'
import { ConfigureTask } from './ConfigureTask.js'

afterEach(cleanup)

const ladder = twoFamilyDeclaration()
const apple = appleDeclaration()

/** The two rungs, by the order the declaration puts them in. */
const [SHIPS_PREDICTIONS, SHIPS_MODEL] = ladder.families as readonly ModelFamilyDeclaration[]

function renderLadder(
  over: {
    readonly onPutToWork?: (familyId: string, configurationId: string) => void
    readonly onFamilyChange?: (familyId: string) => void
    readonly onValuesChange?: (familyId: string, values: Record<string, string | number>) => void
    readonly initialFamily?: string
    readonly initialValues?: (familyId: string) => Record<string, string | number> | undefined
    readonly availability?: readonly FamilyAvailability[]
  } = {},
) {
  return render(
    <ConfigureTask
      declaration={ladder}
      loadEntry={ladderLoader(ladder)}
      replayMs={0}
      onBack={() => {}}
      onPutToWork={over.onPutToWork ?? (() => {})}
      onFamilyChange={over.onFamilyChange}
      onValuesChange={over.onValuesChange}
      initialFamily={over.initialFamily}
      initialValues={over.initialValues}
      availability={
        over.availability === undefined
          ? undefined
          : { taskId: ladder.id, knobs: [], families: over.availability }
      }
    />,
  )
}

/** The picker's control for one family. */
function familyButton(family: ModelFamilyDeclaration): HTMLButtonElement {
  const button = document.querySelector(`[data-family="${family.id}"]`)
  if (button === null) throw new Error(`no control for family "${family.id}"`)
  return button as HTMLButtonElement
}

function select(family: ModelFamilyDeclaration): Promise<void> {
  return userEvent.click(familyButton(family))
}

describe('a task offering several families presents them all', () => {
  it('offers every family the declaration carries, by its declared label', () => {
    renderLadder()

    for (const family of ladder.families) {
      expect(familyButton(family).textContent).toContain(family.label)
    }
    expect(ladder.families.length).toBeGreaterThan(1)
  })

  it('offers no family the declaration does not carry', () => {
    renderLadder()

    expect(document.querySelectorAll('[data-family]')).toHaveLength(ladder.families.length)
  })

  it('opens at the first declared family when nothing says otherwise', () => {
    renderLadder()

    expect(familyButton(SHIPS_PREDICTIONS!).getAttribute('aria-pressed')).toBe('true')
    expect(familyButton(SHIPS_MODEL!).getAttribute('aria-pressed')).toBe('false')
  })

  it('opens at the family progress recorded, where it recorded one', () => {
    renderLadder({ initialFamily: SHIPS_MODEL!.id })

    expect(familyButton(SHIPS_MODEL!).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows the selected family’s knobs and its teaching copy, and no other family’s', () => {
    renderLadder()

    expect(screen.getByText(SHIPS_PREDICTIONS!.teaching.summary)).toBeDefined()
    expect(screen.queryByText(SHIPS_MODEL!.teaching.summary)).toBeNull()
    for (const knob of SHIPS_PREDICTIONS!.knobs) {
      expect(screen.getByLabelText(knob.label)).toBeDefined()
    }
  })

  it('swaps the knobs and the copy when a different family is selected', async () => {
    renderLadder()

    await select(SHIPS_MODEL!)

    expect(screen.getByText(SHIPS_MODEL!.teaching.summary)).toBeDefined()
    expect(screen.queryByText(SHIPS_PREDICTIONS!.teaching.summary)).toBeNull()
    for (const knob of SHIPS_MODEL!.knobs) {
      expect(screen.getByLabelText(knob.label)).toBeDefined()
    }
  })

  it('makes a model of whichever family is selected, and says so to the shell', async () => {
    const onPutToWork = vi.fn()
    renderLadder({ onPutToWork })

    await select(SHIPS_MODEL!)
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await screen.findByRole('button', { name: 'Put this model to work' })
    await userEvent.click(screen.getByRole('button', { name: 'Put this model to work' }))

    expect(onPutToWork).toHaveBeenCalledOnce()
    expect(onPutToWork.mock.calls[0]?.[0]).toBe(SHIPS_MODEL!.id)
  })
})

describe('selecting a family is looking, not committing', () => {
  it('puts nothing to work and reports only the selection', async () => {
    const onPutToWork = vi.fn()
    const onFamilyChange = vi.fn()
    renderLadder({ onPutToWork, onFamilyChange })

    await select(SHIPS_MODEL!)

    expect(onPutToWork).not.toHaveBeenCalled()
    expect(onFamilyChange).toHaveBeenCalledWith(SHIPS_MODEL!.id)
  })

  it('withdraws a replay that belonged to the family that was showing', async () => {
    renderLadder()
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await screen.findByRole('button', { name: 'Put this model to work' })

    await select(SHIPS_MODEL!)

    expect(screen.queryByRole('button', { name: 'Put this model to work' })).toBeNull()
  })

  it('keeps each family’s knob values where the student left them', async () => {
    const held: Record<string, Record<string, string | number>> = {}
    renderLadder({
      onValuesChange: (familyId, values) => {
        held[familyId] = values
      },
      initialValues: (familyId) => held[familyId],
    })

    const knob = SHIPS_PREDICTIONS!.knobs[0]
    if (knob?.kind !== 'choice') throw new Error('its first knob should be a choice')
    const other = knob.values.find((value) => value !== knob.default)
    await userEvent.selectOptions(screen.getByLabelText(knob.label), String(other))

    await select(SHIPS_MODEL!)
    await select(SHIPS_PREDICTIONS!)

    expect((screen.getByLabelText(knob.label) as HTMLSelectElement).selectedIndex).toBe(
      knob.values.indexOf(other as string | number),
    )
    // And the family that was never tuned keeps its own declared default.
    expect(held[SHIPS_MODEL!.id]).toBeUndefined()
  })
})

describe('a family the student does not yet have', () => {
  const locked: readonly FamilyAvailability[] = [
    { familyId: SHIPS_PREDICTIONS!.id, available: true },
    {
      familyId: SHIPS_MODEL!.id,
      available: false,
      openedBy: {
        id: 'the-cutting-kit',
        group: 'toolshed',
        label: 'A cutting kit',
        copy: 'Everything you need to make cuts.',
        priceUnits: 2500,
        opens: [],
      },
    },
  ]

  it('is shown rather than hidden, with what opens it and what that costs', () => {
    renderLadder({ availability: locked, ...{} })

    const row = familyButton(SHIPS_MODEL!).parentElement
    expect(row?.textContent).toContain(SHIPS_MODEL!.label)
    expect(row?.textContent).toContain('A cutting kit')
  })

  it('cannot be selected, and selecting it changes nothing', async () => {
    const onFamilyChange = vi.fn()
    renderLadder({ availability: locked, onFamilyChange })

    expect(familyButton(SHIPS_MODEL!).disabled).toBe(true)
    await userEvent.click(familyButton(SHIPS_MODEL!))

    expect(onFamilyChange).not.toHaveBeenCalled()
    expect(familyButton(SHIPS_PREDICTIONS!).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('a task declaring one family is not made to look like a choice', () => {
  it('offers no picker at all, and presents that family’s knobs directly', () => {
    render(
      <ConfigureTask
        declaration={apple}
        loadEntry={entryLoader(apple, appleArtifact())}
        replayMs={0}
        onBack={() => {}}
      />,
    )

    expect(apple.families).toHaveLength(1)
    expect(document.querySelectorAll('[data-family]')).toHaveLength(0)
    for (const knob of firstFamily(apple).knobs) {
      expect(screen.getByLabelText(knob.label)).toBeDefined()
    }
  })
})

describe('the curve is labelled in the words the family declares', () => {
  it('uses the selected family’s own axis term, not a screen’s', async () => {
    renderLadder()

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await screen.findByTestId('training-step')

    const axis = SHIPS_PREDICTIONS!.history?.axis
    expect(axis).toBeDefined()
    expect(screen.getByTestId('training-step').textContent).toContain(axis as string)
  })

  it('presents no history at all for a family that records none', async () => {
    renderLadder({ initialFamily: SHIPS_MODEL!.id })

    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    await screen.findByRole('button', { name: 'Put this model to work' })

    // Nothing reports the absence as a failure: the model is made, and there is no curve.
    expect(SHIPS_MODEL!.history).toBeUndefined()
    expect(screen.queryByTestId('training-step')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

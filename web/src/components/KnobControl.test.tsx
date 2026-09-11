/**
 * A locked knob value: shown, greyed, named with what opens it — never hidden.
 *
 * Seeing what cannot yet be afforded is the motivation system, so what changes when
 * something is bought is which values can be *selected*, not which are on screen.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeAvailability, knobAvailability, taskAvailability } from '../../../src/progression/index.js'
import { formatUnits } from '../../../src/economy/index.js'
import type { ChoiceKnob, SliderKnob } from '../../../src/task/types.js'
import { firstFamily } from '../../../src/task/families.js'
import { KnobControl } from './KnobControl.js'
import { appleDeclaration } from '../test-support/declarations.js'
import { farmDeclaration } from '../test-support/farm.js'
import { soundCatalog } from '../test-support/progression.js'

afterEach(cleanup)

const apple = appleDeclaration()
const farm = farmDeclaration()

/** A catalog that locks two of `channels` and everything of `dropout` beyond its default. */
const catalog = soundCatalog({
  schemaVersion: '1.0.0',
  groups: [{ id: 'models', label: 'Models', soldAt: 'market' }],
  ownedAtStart: [],
  items: [
    {
      id: 'wider-blocks',
      group: 'models',
      label: 'Wider blocks',
      copy: 'More patterns per block.',
      price: 250,
      opens: [{ kind: 'knob-values', task: apple.id, knob: 'channels', values: [8, 32] }],
    },
    {
      id: 'quiet-training',
      group: 'models',
      label: 'Quiet training',
      copy: 'Switches detectors off at random.',
      notForSaleReason: 'Nothing has been trained with it yet.',
      opens: [{ kind: 'knob-values', task: apple.id, knob: 'regularization', values: [0, 2, 3] }],
    },
  ],
})

function valuesFor(knobId: string, owned: readonly string[]) {
  const task = taskAvailability(computeAvailability(catalog, [apple], owned), apple.id)
  if (task === undefined) throw new Error('the availability must cover the task')
  return knobAvailability(task, knobId)?.values
}

function knobNamed(id: string) {
  const knob = firstFamily(apple).knobs.find((candidate) => candidate.id === id)
  if (knob === undefined) throw new Error(`the task declares no knob ${id}`)
  return knob
}

function renderChoice(owned: readonly string[], onChange = vi.fn()) {
  render(
    <KnobControl
      knob={knobNamed('channels') as ChoiceKnob}
      value={16}
      onChange={onChange}
      availability={valuesFor('channels', owned)}
      formatPrice={(units) => formatUnits(units, farm)}
    />,
  )
  return onChange
}

describe('a locked value is shown and cannot be selected', () => {
  it('keeps every declared value on screen', () => {
    renderChoice([])
    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['8', '16', '32'])
  })

  it('marks the locked ones unselectable', () => {
    renderChoice([])
    const disabled = screen
      .getAllByRole('option')
      .filter((option) => (option as HTMLOptionElement).disabled)
      .map((option) => option.textContent)
    expect(disabled).toEqual(['8', '32'])
  })

  it('does not report a locked value even when one is forced onto the control', async () => {
    const onChange = renderChoice([])
    await userEvent.selectOptions(screen.getByRole('combobox'), '0').catch(() => undefined)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('offers the same values once the item is owned', async () => {
    const onChange = renderChoice(['wider-blocks'])
    expect(
      screen.getAllByRole('option').filter((option) => (option as HTMLOptionElement).disabled),
    ).toEqual([])

    await userEvent.selectOptions(screen.getByRole('combobox'), '0')
    expect(onChange).toHaveBeenCalledWith(8)
  })
})

describe('a locked value says what opens it', () => {
  it('names the item and shows its price where it has one', () => {
    renderChoice([])
    const notes = screen.getAllByRole('listitem').map((item) => item.textContent ?? '')

    expect(notes.some((note) => note.includes('Wider blocks'))).toBe(true)
    expect(notes.some((note) => note.includes(formatUnits(25000, farm)))).toBe(true)
  })

  it('names the item with no price at all where it has none', () => {
    render(
      <KnobControl
        knob={knobNamed('regularization') as SliderKnob}
        value={1}
        onChange={vi.fn()}
        availability={valuesFor('regularization', [])}
        formatPrice={(units) => formatUnits(units, farm)}
      />,
    )
    const notes = screen.getAllByRole('listitem').map((item) => item.textContent ?? '')

    expect(notes.some((note) => note.includes('Quiet training'))).toBe(true)
    expect(notes.some((note) => note.includes(farm.currency))).toBe(false)
  })

  it('says nothing about opening anything when nothing is locked', () => {
    renderChoice(['wider-blocks'])
    expect(screen.queryAllByRole('listitem')).toEqual([])
  })
})

describe('a fully locked knob sits at its declared default', () => {
  it('is shown rather than removed, and cannot be moved', () => {
    render(
      <KnobControl
        knob={knobNamed('regularization') as SliderKnob}
        value={1}
        onChange={vi.fn()}
        availability={valuesFor('regularization', [])}
      />,
    )

    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.disabled).toBe(true)
    expect(slider.value).toBe('1')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent?.trim().charAt(0))).toEqual(
      ['0', '2', '3'],
    )
  })
})

describe('a knob with no availability supplied locks nothing', () => {
  it('leaves a choice knob entirely selectable', async () => {
    const onChange = vi.fn()
    render(<KnobControl knob={knobNamed('channels') as ChoiceKnob} value={16} onChange={onChange} />)

    await userEvent.selectOptions(screen.getByRole('combobox'), '0')
    expect(onChange).toHaveBeenCalledWith(8)
    expect(screen.queryAllByRole('listitem')).toEqual([])
  })

  it('leaves a slider at its declared range and enabled', () => {
    render(<KnobControl knob={knobNamed('regularization') as SliderKnob} value={1} onChange={vi.fn()} />)

    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.disabled).toBe(false)
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('3')
  })
})

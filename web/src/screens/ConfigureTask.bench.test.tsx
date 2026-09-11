/**
 * The bench as a stage of the workshop, and the workshop with nothing to tune.
 *
 * Two things are being held apart here. Buying capacity is a purchase — deliberate,
 * confirmed, irreversible — and everything else in the workshop stays free, so entering
 * the bench, reading it and leaving costs nothing. And buying opens a value and selects
 * nothing: a student who buys a deeper stack and comes back finds the knobs as they left
 * them, with more of them selectable.
 *
 * The other case is a task none of whose models the farm owns. That is a farm at the
 * start of the game, not a farm in an invalid state, so the workshop shows what opens
 * each family, offers no knobs, and reports no failure.
 *
 * See openspec/changes/market/specs/model-upgrades/spec.md and
 * openspec/changes/market/specs/model-families/spec.md.
 */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatUnits } from '../../../src/economy/index.js'
import type { Catalog } from '../../../src/progression/index.js'
import { benchView, computeAvailability, taskAvailability } from '../../../src/progression/index.js'
import type { ModelFamilyDeclaration, TaskDeclaration } from '../../../src/task/types.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import { ladderLoader, twoFamilyDeclaration } from '../test-support/declarations.js'
import { farmDeclaration } from '../test-support/farm.js'
import { soundCatalog } from '../test-support/progression.js'
import { ConfigureTask } from './ConfigureTask.js'

afterEach(cleanup)

const farm = farmDeclaration()

/**
 * The fixture ladder, with the two families' same-named knob widened apart.
 *
 * A knob-values unlock names a task and a knob and no family, so an upgrade belongs to
 * whichever family permits the values it opens. The fixture gives both families `depth`
 * over the same two values, which is a catalog the loader refuses — widening the second
 * one is what lets an upgrade sit under exactly one of them.
 */
function widened(): TaskDeclaration {
  const base = twoFamilyDeclaration()
  const [first, second] = base.families as readonly ModelFamilyDeclaration[]
  const validated = validateDeclaration({
    ...base,
    families: [
      first,
      { ...second, knobs: [{ ...second!.knobs[0], values: [1, 3] }, second!.knobs[1]] },
    ],
  })
  if (!validated.ok) throw new Error('the widened ladder was meant to validate')
  return validated.declaration
}

const ladder = widened()
const [network, chain] = ladder.families as readonly ModelFamilyDeclaration[]

/** A catalog that opens the second family in the market and one knob at the bench. */
const catalog: Catalog = soundCatalog(
  {
    schemaVersion: '1.0.0',
    groups: [
      { id: 'models', label: 'Models', soldAt: 'market' },
      { id: 'capacity', label: 'Capacity', soldAt: 'bench' },
    ],
    ownedAtStart: [],
    items: [
      {
        id: 'the-chain',
        group: 'models',
        label: 'A chain of cuts',
        copy: 'A second kind of model.',
        price: 600,
        opens: [{ kind: 'model-family', task: ladder.id, family: chain!.id }],
      },
      {
        id: 'one-more-layer',
        group: 'capacity',
        label: 'One more layer',
        copy: 'Room for a second layer.',
        price: 100,
        opens: [{ kind: 'knob-values', task: ladder.id, knob: 'depth', values: [2] }],
      },
    ],
  },
  farm,
)

/** A catalog under which neither family is available until something is bought. */
const allLocked: Catalog = soundCatalog(
  {
    schemaVersion: '1.0.0',
    groups: [{ id: 'models', label: 'Models', soldAt: 'market' }],
    ownedAtStart: [],
    items: ladder.families.map((family) => ({
      id: `opens-${family.id}`,
      group: 'models',
      label: `Whatever opens ${family.label}`,
      copy: 'A model for this field.',
      price: 600,
      opens: [{ kind: 'model-family', task: ladder.id, family: family.id }],
    })),
  },
  farm,
)

function renderWorkshop(
  over: {
    readonly owned?: readonly string[]
    readonly catalog?: Catalog
    readonly withBench?: boolean
    readonly onBuyUpgrade?: (itemId: string) => void
    readonly onPutToWork?: (familyId: string, configurationId: string) => void
    readonly onFamilyChange?: (familyId: string) => void
    readonly onValuesChange?: (familyId: string, values: Record<string, string | number>) => void
    readonly atWork?: { readonly family: string; readonly configurationId: string }
  } = {},
) {
  const shop = over.catalog ?? catalog
  const owned = over.owned ?? []
  const availability = taskAvailability(computeAvailability(shop, [ladder], owned), ladder.id)
  const onBuyUpgrade = over.onBuyUpgrade ?? vi.fn()

  render(
    <ConfigureTask
      declaration={ladder}
      loadEntry={ladderLoader(ladder)}
      replayMs={0}
      onBack={() => {}}
      availability={availability}
      formatPrice={(units) => formatUnits(units, farm)}
      onPutToWork={over.onPutToWork ?? (() => {})}
      onFamilyChange={over.onFamilyChange}
      onValuesChange={over.onValuesChange}
      atWork={over.atWork}
      {...(over.withBench === false
        ? {}
        : { bench: benchView(ladder, shop, owned, 100000), onBuyUpgrade })}
    />,
  )
  return onBuyUpgrade
}

/** The picker's control for one family. */
function familyButton(family: ModelFamilyDeclaration): HTMLButtonElement {
  const button = document.querySelector(`[data-family="${family.id}"]`)
  if (button === null) throw new Error(`no control for family "${family.id}"`)
  return button as HTMLButtonElement
}

async function enterBench(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Upgrades' }))
}

describe('the bench is reached from the workshop and left again', () => {
  it('shows the task’s families, and the workshop again on leaving', async () => {
    renderWorkshop()
    await enterBench()

    expect(screen.getByRole('heading', { name: 'Upgrades' })).toBeDefined()
    expect(screen.getByRole('region', { name: network!.label })).toBeDefined()
    expect(screen.getByRole('region', { name: chain!.label })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Back to the workshop' }))
    expect(screen.getByRole('button', { name: 'Train model' })).toBeDefined()
  })

  it('lists the same families whichever family is selected', async () => {
    renderWorkshop({ owned: ['the-chain'] })
    await enterBench()
    const first = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)

    await userEvent.click(screen.getByRole('button', { name: 'Back to the workshop' }))
    await userEvent.click(familyButton(chain!))
    await enterBench()

    expect(screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual(
      first,
    )
  })

  it('is reachable with a model at work and with none made', async () => {
    renderWorkshop({ atWork: { family: network!.id, configurationId: 'depth1-photographsclinic' } })
    await enterBench()
    expect(screen.getByRole('heading', { name: 'Upgrades' })).toBeDefined()
  })

  it('selects nothing and puts nothing to work on the way in or out', async () => {
    const onFamilyChange = vi.fn()
    const onPutToWork = vi.fn()
    const onValuesChange = vi.fn()
    renderWorkshop({ onFamilyChange, onPutToWork, onValuesChange })

    await enterBench()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the workshop' }))

    expect(onFamilyChange).not.toHaveBeenCalled()
    expect(onPutToWork).not.toHaveBeenCalled()
    expect(onValuesChange).not.toHaveBeenCalled()
  })

  it('offers no way to run a year or produce a report', async () => {
    renderWorkshop()
    await enterBench()

    for (const word of [/run.*year/i, /report/i, /harvest/i]) {
      expect(screen.queryByRole('button', { name: word }), `${word}`).toBeNull()
    }
  })
})

describe('buying an upgrade opens a value and selects nothing', () => {
  it('leaves every knob holding the value it held', async () => {
    const onBuyUpgrade = renderWorkshop()
    const knob = screen.getByLabelText(network!.knobs[1]!.label) as HTMLSelectElement
    await userEvent.selectOptions(knob, '1')
    const chosen = knob.value

    await enterBench()
    await userEvent.click(screen.getByRole('button', { name: 'Buy One more layer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the workshop' }))

    expect(onBuyUpgrade).toHaveBeenCalledWith('one-more-layer')
    expect((screen.getByLabelText(network!.knobs[1]!.label) as HTMLSelectElement).value).toBe(chosen)
  })

  it('leaves a model already made still made', async () => {
    renderWorkshop()
    await userEvent.click(screen.getByRole('button', { name: 'Train model' }))
    expect(await screen.findByRole('button', { name: 'Put this model to work' })).toBeDefined()

    await enterBench()
    await userEvent.click(screen.getByRole('button', { name: 'Buy One more layer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the workshop' }))

    expect(screen.getByRole('button', { name: 'Put this model to work' })).toBeDefined()
  })

  it('leaves a model at work at work', async () => {
    const atWork = { family: network!.id, configurationId: 'depth1-photographsclinic' }
    renderWorkshop({ atWork })
    await enterBench()
    await userEvent.click(screen.getByRole('button', { name: 'Buy One more layer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to the workshop' }))

    expect(screen.getByTestId('at-work').textContent).toBe(atWork.configurationId)
  })
})

describe('a task none of whose models the farm owns', () => {
  it('selects none, offers no knobs, and reports no failure', () => {
    renderWorkshop({ catalog: allLocked, withBench: false })

    for (const family of ladder.families) {
      expect(screen.queryByLabelText(family.knobs[0]!.label), family.id).toBeNull()
    }
    expect(screen.queryByRole('button', { name: 'Train model' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByTestId('current-configuration')).toBeNull()
  })

  it('presents every family it declares with what opens it', () => {
    renderWorkshop({ catalog: allLocked, withBench: false })

    for (const family of ladder.families) {
      expect(familyButton(family).disabled, family.id).toBe(true)
      expect(document.body.textContent, family.id).toContain(`Whatever opens ${family.label}`)
    }
  })

  it('opens on the first available family as soon as one is owned', () => {
    renderWorkshop({ catalog: allLocked, owned: [`opens-${chain!.id}`], withBench: false })

    expect(familyButton(chain!).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText(chain!.knobs[0]!.label)).toBeDefined()
  })

  it('is still reachable from the bench, so what opens each can be read', async () => {
    renderWorkshop({ catalog: allLocked })
    await enterBench()

    expect(screen.getByRole('heading', { name: 'Upgrades' })).toBeDefined()
    for (const family of ladder.families) {
      expect(screen.getByTestId(`family-state-${family.id}`).textContent, family.id).toContain(
        'Not yours yet',
      )
    }
  })
})

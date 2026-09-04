/**
 * The persistent bar.
 *
 * The figures are queried by their accessible names throughout, because "labelled so a
 * reader hears a named value" is the requirement, and matching loose text would pass
 * whether or not the labelling survives.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { FarmDeclaration } from '../../../src/economy/index.js'
import { credit, openFarm, toUnits } from '../../../src/economy/index.js'
import { FarmBar } from './FarmBar.js'

afterEach(cleanup)

const declaration: FarmDeclaration = {
  name: 'Test Farm',
  currency: 'CHF',
  precision: 2,
  openingBalance: 2000,
  openingYear: 3,
}

/** A second farm, declaring a different name and a different currency. */
const other: FarmDeclaration = {
  name: 'Another Holding',
  currency: 'coins',
  precision: 0,
  openingBalance: 40,
  openingYear: 11,
}

describe('the bar shows the year, the money and the farm', () => {
  it('names its values so they are read as named values', () => {
    render(<FarmBar farm={openFarm(declaration)} />)

    expect(screen.getByRole('definition', { name: 'Year' }).textContent).toBe('3')
    expect(screen.getByRole('definition', { name: 'Balance' }).textContent).toBe('CHF 2 000.00')
    expect(screen.getByRole('definition', { name: 'Farm' }).textContent).toBe('Test Farm')
  })

  it('presents the balance with the declared label and no other', () => {
    render(<FarmBar farm={openFarm(declaration)} />)
    const balance = screen.getByRole('definition', { name: 'Balance' }).textContent ?? ''

    expect(balance).toContain('CHF')
    for (const wrong of ['$', '€', 'USD', 'coins']) expect(balance).not.toContain(wrong)
  })

  it('shows a differently declared farm and currency with no code of its own', () => {
    render(<FarmBar farm={openFarm(other)} />)

    expect(screen.getByRole('definition', { name: 'Farm' }).textContent).toBe('Another Holding')
    expect(screen.getByRole('definition', { name: 'Year' }).textContent).toBe('11')
    expect(screen.getByRole('definition', { name: 'Balance' }).textContent).toBe('coins 40')
  })

  it('shows the balance it is given rather than the one it opened at', () => {
    const earned = credit(openFarm(declaration), toUnits(125.5, 2), 'a picked apple')
    render(<FarmBar farm={earned} />)

    expect(screen.getByRole('definition', { name: 'Balance' }).textContent).toBe('CHF 2 125.50')
  })
})

describe('the summary facts the bar is supplied', () => {
  it('renders both, with their labels, in the order supplied', () => {
    const { container } = render(
      <FarmBar
        farm={openFarm(declaration)}
        facts={[
          { label: 'Trees', value: '300' },
          { label: 'Photos', value: '1 000' },
        ]}
      />,
    )

    const summary = container.querySelector('.farm-summary')
    expect(summary).not.toBeNull()
    expect(within(summary as HTMLElement).getByRole('definition', { name: 'Trees' }).textContent).toBe(
      '300',
    )
    expect(
      within(summary as HTMLElement).getByRole('definition', { name: 'Photos' }).textContent,
    ).toBe('1 000')

    const terms = [...(summary as HTMLElement).querySelectorAll('dt')].map((dt) => dt.textContent)
    expect(terms).toEqual(['Trees', 'Photos'])
  })

  it('renders the name, the year and the balance alone when there are none', () => {
    const { container } = render(<FarmBar farm={openFarm(declaration)} />)

    expect(screen.getByRole('definition', { name: 'Farm' })).toBeDefined()
    expect(screen.getByRole('definition', { name: 'Year' })).toBeDefined()
    expect(screen.getByRole('definition', { name: 'Balance' })).toBeDefined()
    expect(container.querySelector('.farm-summary')).toBeNull()
    expect(screen.getAllByRole('definition')).toHaveLength(3)
  })

  it('renders no empty row for an empty list either', () => {
    const { container } = render(<FarmBar farm={openFarm(declaration)} facts={[]} />)
    expect(container.querySelector('.farm-summary')).toBeNull()
  })
})

/** The fields an interface in the bar's own source declares. */
function fieldsOf(name: string): string[] {
  const source = readFileSync(join(process.cwd(), 'web/src/components/FarmBar.tsx'), 'utf8')
  const match = new RegExp(`export interface ${name} \{([^}]*)\}`).exec(source)
  if (match === null) throw new Error(`FarmBar.tsx declares no interface ${name}`)
  return [...(match[1] ?? '').matchAll(/^\s*(?:readonly\s+)?(\w+)\??:/gm)].map(
    (field) => field[1] ?? '',
  )
}

describe('the bar owns none of the nouns it shows', () => {
  it('takes a fact as a label and a value and nothing else', () => {
    expect(fieldsOf('SummaryFact')).toEqual(['label', 'value'])
  })

  it('has no prop naming a subject of its own', () => {
    expect(fieldsOf('FarmBarProps')).toEqual(['farm', 'facts'])
  })
})

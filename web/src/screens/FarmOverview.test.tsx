/**
 * The overview: the cards, their labour slots, the one control that runs the year, and
 * the report each card offers of the year that closed.
 *
 * Everything the slot presents is handed to the screen. The tests below prove it by
 * rendering two farms whose labour is called different things through the same component
 * and asserting that what appears is what was passed in.
 */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDeclaration } from '../../../src/task/types.js'
import { appleDeclaration, unrelatedDeclaration } from '../test-support/declarations.js'
import { FarmOverview } from './FarmOverview.js'

afterEach(cleanup)

const apple = appleDeclaration()
const other: TaskDeclaration = { ...unrelatedDeclaration(), id: 'second-card', title: 'Skin Screening' }
const announced: TaskDeclaration = {
  ...unrelatedDeclaration(),
  id: 'announced-task',
  title: 'Livestock',
  available: false,
}

/** The manual labour of one farm, as its declaration presents it. */
const HANDS = { icon: '✋', label: 'Sorted by hand' }

/** The card, so a query cannot reach past it into another. */
function card(task: TaskDeclaration): HTMLElement {
  const heading = screen.getByRole('heading', { name: task.title })
  const found = heading.closest('li')
  if (found === null) throw new Error(`no card for ${task.id}`)
  return found
}

/** The slot on one card, or null where it carries none. */
function slot(task: TaskDeclaration): HTMLElement | null {
  return document.querySelector(`[data-slot="${task.id}"]`)
}

describe('the farm overview', () => {
  it('lists tasks by their declared title', () => {
    render(<FarmOverview tasks={[apple, announced]} onSelect={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Apple Harvest' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Livestock' })).toBeDefined()
  })

  it('makes an available task selectable', () => {
    const onSelect = vi.fn()
    render(<FarmOverview tasks={[apple]} onSelect={onSelect} />)

    screen.getByRole('button', { name: /Apple Harvest/ }).click()

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'apple-harvest' })
  })

  it('shows an announced task without making it selectable', () => {
    render(<FarmOverview tasks={[announced]} onSelect={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Livestock' })).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names no task in its own markup', () => {
    // The overview renders from declarations; an empty farm has nothing to say.
    render(<FarmOverview tasks={[]} onSelect={() => {}} />)

    expect(screen.queryByText(/apple/i)).toBeNull()
  })
})

describe('every playable task carries a labour slot', () => {
  it('states the farm’s own labour on a farm that has put no model to work', () => {
    render(<FarmOverview tasks={[apple, other]} onSelect={() => {}} slotFor={() => HANDS} />)

    for (const task of [apple, other]) {
      const filled = slot(task)
      expect(filled, `no slot on ${task.id}`).not.toBeNull()
      expect(filled?.textContent).toContain(HANDS.label)
      expect(filled?.textContent).toContain(HANDS.icon)
      // Reachable on hover as well as read out, so the icon is never the only carrier.
      expect(filled?.getAttribute('title')).toBe(HANDS.label)
    }
  })

  it('states a model on a card at work by one, and leaves the other card alone', () => {
    render(
      <FarmOverview
        tasks={[apple, other]}
        onSelect={() => {}}
        slotFor={(task) =>
          task.id === apple.id ? { label: 'blocks3-channels32-regularization1-dropout0' } : HANDS
        }
      />,
    )

    expect(slot(apple)?.textContent).toContain('blocks3-channels32-regularization1-dropout0')
    expect(slot(apple)?.textContent).not.toContain(HANDS.label)
    expect(slot(other)?.textContent).toContain(HANDS.label)
  })

  it('shows no slot as empty or unset, and none at all on an announced task', () => {
    render(
      <FarmOverview
        tasks={[apple, announced]}
        onSelect={() => {}}
        slotFor={(task) => (task.available ? HANDS : undefined)}
      />,
    )

    expect(slot(apple)?.textContent?.trim().length).toBeGreaterThan(0)
    expect(slot(announced)).toBeNull()
    expect(within(card(announced)).queryByTitle(HANDS.label)).toBeNull()
  })

  it('renders a farm whose labour is called something else through the same screen', () => {
    // Nothing about the two runs differs but the value passed in. A slot that presented
    // any word of its own would show that word here too.
    const elsewhere = { icon: '🧤', label: 'Done by the family' }
    render(<FarmOverview tasks={[apple]} onSelect={() => {}} slotFor={() => elsewhere} />)

    expect(slot(apple)?.textContent).toContain('Done by the family')
    expect(slot(apple)?.textContent).toContain('🧤')
    expect(slot(apple)?.textContent).not.toContain(HANDS.label)
  })

  it('states what fills a slot that declares no icon', () => {
    render(<FarmOverview tasks={[apple]} onSelect={() => {}} slotFor={() => ({ label: 'Hands' })} />)

    expect(slot(apple)?.textContent).toContain('Hands')
  })
})

describe('running the year is one act, reached from the overview', () => {
  it('names the year it will run and asks before running it', async () => {
    const onRunYear = vi.fn()
    render(<FarmOverview tasks={[apple]} onSelect={() => {}} year={3} onRunYear={onRunYear} />)

    await userEvent.click(screen.getByRole('button', { name: 'Run year 3' }))
    expect(onRunYear).not.toHaveBeenCalled()

    await userEvent.click(
      within(screen.getByRole('region', { name: 'Run the year' })).getByRole('button', {
        name: 'Run year 3',
      }),
    )
    expect(onRunYear).toHaveBeenCalledOnce()
  })

  it('runs nothing when the confirmation is declined', async () => {
    const onRunYear = vi.fn()
    render(<FarmOverview tasks={[apple]} onSelect={() => {}} year={3} onRunYear={onRunYear} />)

    await userEvent.click(screen.getByRole('button', { name: 'Run year 3' }))
    await userEvent.click(screen.getByRole('button', { name: 'Not yet' }))

    expect(onRunYear).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Run year 3' })).toBeDefined()
  })

  it('is offered to a farm whose every slot holds its own labour, with no reason it cannot be used', () => {
    render(
      <FarmOverview
        tasks={[apple, other]}
        onSelect={() => {}}
        slotFor={() => HANDS}
        year={1}
        onRunYear={() => {}}
      />,
    )

    const control = screen.getByRole('button', { name: 'Run year 1' })
    expect(control.hasAttribute('disabled')).toBe(false)
    const region = screen.getByRole('region', { name: 'Run the year' })
    expect(region.textContent ?? '').not.toMatch(/cannot|first|before you|need to/i)
  })

  it('names the following year once one has closed', () => {
    render(<FarmOverview tasks={[apple]} onSelect={() => {}} year={4} onRunYear={() => {}} />)

    expect(screen.getByRole('button', { name: 'Run year 4' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Run year 3' })).toBeNull()
  })
})

describe('a year in progress states what is outstanding', () => {
  function renderInProgress(onBringIn = vi.fn()) {
    render(
      <FarmOverview
        tasks={[apple, other]}
        onSelect={() => {}}
        slotFor={() => HANDS}
        year={3}
        onRunYear={() => {}}
        outstanding={[{ task: other, manual: true }]}
        onBringIn={onBringIn}
      />,
    )
    return onBringIn
  }

  it('names the task still to be brought in, without presenting the year as closed', () => {
    renderInProgress()

    const status = screen.getByRole('status')
    expect(status.textContent).toContain(other.title)
    expect(status.textContent).not.toContain(apple.title)
    expect(status.textContent ?? '').not.toMatch(/closed|finished|done for the year/i)
  })

  it('offers no way to run the year again while one is in progress', () => {
    renderInProgress()

    expect(screen.queryByRole('button', { name: /Run year/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Run the year' })).toBeNull()
  })

  it('offers the labour only on the card that is still outstanding', async () => {
    const onBringIn = renderInProgress()

    expect(within(card(apple)).queryByRole('button', { name: /by hand/ })).toBeNull()
    await userEvent.click(within(card(other)).getByRole('button', { name: /by hand/ }))

    expect(onBringIn).toHaveBeenCalledOnce()
    expect(onBringIn.mock.calls[0]?.[0]).toMatchObject({ id: other.id })
  })

  it('shows the cause a crop was not brought in, and substitutes no other labour', () => {
    render(
      <FarmOverview
        tasks={[apple]}
        onSelect={() => {}}
        slotFor={() => ({ label: 'blocks9-channels9-regularization9-dropout9' })}
        year={3}
        onRunYear={() => {}}
        outstanding={[{ task: apple, manual: false }]}
        refusal={[
          {
            task: apple,
            issues: [{ code: 'data-unreachable', message: 'The predictions could not be fetched.' }],
          },
        ]}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('could not be fetched')
    // No `onBringIn`, so nothing offers to do the model's work by hand instead.
    expect(screen.queryByRole('button', { name: /by hand/ })).toBeNull()
    expect(slot(apple)?.textContent).toContain('blocks9-channels9-regularization9-dropout9')
  })
})

/**
 * A crop that will not come in holds the year open, and the only way out is taking the
 * model off. That has to be reachable from the refusal itself: a student told the year
 * cannot close, next to no way to close it, has to deduce that the workshop is the exit.
 */
describe('a refused crop offers its job back where the refusal is shown', () => {
  const unreachable = (task: TaskDeclaration) => ({
    task,
    issues: [{ code: 'data-unreachable', message: `${task.title}: the predictions could not be fetched.` }],
  })

  /** The region the refusal and its remedy are shown in. */
  function refusalRegion(): HTMLElement {
    return screen.getByRole('region', { name: 'A crop that was not brought in' })
  }

  function renderRefused(refused: readonly TaskDeclaration[], onHandBack = vi.fn()) {
    render(
      <FarmOverview
        tasks={[apple, other]}
        onSelect={() => {}}
        slotFor={() => ({ label: 'blocks9-channels9' })}
        year={3}
        onRunYear={() => {}}
        outstanding={refused.map((task) => ({ task, manual: false }))}
        refusal={refused.map(unreachable)}
        onHandBack={onHandBack}
      />,
    )
    return onHandBack
  }

  it('offers the job back for the refused card, saying what it does to the labour', async () => {
    const onHandBack = renderRefused([apple])

    const control = within(refusalRegion()).getByRole('button', { name: /Take the model off/ })
    expect(control.textContent).toContain(apple.title)
    expect(control.textContent).toMatch(/yourself/i)

    await userEvent.click(control)

    expect(onHandBack).toHaveBeenCalledOnce()
    expect(onHandBack.mock.calls[0]?.[0]).toMatchObject({ id: apple.id })
  })

  it('offers it for no card that was not refused', () => {
    renderRefused([apple])

    const controls = within(refusalRegion()).getAllByRole('button', { name: /Take the model off/ })
    expect(controls).toHaveLength(1)
    expect(controls[0]?.textContent).not.toContain(other.title)
  })

  it('names each refused card separately where two were refused', async () => {
    const onHandBack = renderRefused([apple, other])

    const region = refusalRegion()
    expect(region.textContent).toContain(`${apple.title}: the predictions could not be fetched.`)
    expect(region.textContent).toContain(`${other.title}: the predictions could not be fetched.`)

    await userEvent.click(within(region).getByRole('button', { name: new RegExp(other.title) }))

    expect(onHandBack.mock.calls[0]?.[0]).toMatchObject({ id: other.id })
  })

  it('offers nothing of the kind where no crop was refused', () => {
    render(
      <FarmOverview
        tasks={[apple]}
        onSelect={() => {}}
        slotFor={() => HANDS}
        year={3}
        onRunYear={() => {}}
        onHandBack={vi.fn()}
      />,
    )

    expect(screen.queryByRole('region', { name: 'A crop that was not brought in' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Take the model off/ })).toBeNull()
  })
})

describe('a task offers the report of the year it closed', () => {
  it('offers it from the card, naming the year', async () => {
    const onReport = vi.fn()
    render(
      <FarmOverview
        tasks={[apple, other]}
        onSelect={() => {}}
        slotFor={() => HANDS}
        year={4}
        onRunYear={() => {}}
        onReport={onReport}
        reportable={[apple, other]}
        reportYear={3}
      />,
    )

    await userEvent.click(within(card(apple)).getByRole('button', { name: /year 3/ }))

    expect(onReport).toHaveBeenCalledOnce()
    expect(onReport.mock.calls[0]?.[0]).toMatchObject({ id: apple.id })
  })

  it('offers none from a farm that has closed no year, rather than an empty one', () => {
    render(<FarmOverview tasks={[apple]} onSelect={() => {}} slotFor={() => HANDS} year={1} onRunYear={() => {}} />)

    expect(screen.queryByRole('button', { name: /See year/ })).toBeNull()
  })

  it('offers none from a card the closed year holds nothing for', () => {
    render(
      <FarmOverview
        tasks={[apple, other]}
        onSelect={() => {}}
        slotFor={() => HANDS}
        year={4}
        onRunYear={() => {}}
        onReport={() => {}}
        reportable={[apple]}
        reportYear={3}
      />,
    )

    expect(within(card(apple)).getByRole('button', { name: /year 3/ })).toBeDefined()
    expect(within(card(other)).queryByRole('button', { name: /year 3/ })).toBeNull()
  })
})

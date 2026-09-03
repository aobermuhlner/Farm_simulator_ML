import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDeclaration } from '../../../src/task/types.js'
import { appleDeclaration, unrelatedDeclaration } from '../test-support/declarations.js'
import { FarmOverview } from './FarmOverview.js'

afterEach(cleanup)

const announced: TaskDeclaration = {
  ...unrelatedDeclaration(),
  id: 'announced-task',
  title: 'Skin Screening',
  available: false,
}

describe('the farm overview', () => {
  it('lists tasks by their declared title', () => {
    render(<FarmOverview tasks={[appleDeclaration(), announced]} onSelect={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Apple Harvest' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Skin Screening' })).toBeDefined()
  })

  it('makes an available task selectable', () => {
    const onSelect = vi.fn()
    render(<FarmOverview tasks={[appleDeclaration()]} onSelect={onSelect} />)

    screen.getByRole('button', { name: /Apple Harvest/ }).click()

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'apple-harvest' })
  })

  it('shows an announced task without making it selectable', () => {
    render(<FarmOverview tasks={[announced]} onSelect={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Skin Screening' })).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names no task in its own markup', () => {
    // The overview renders from declarations; an empty farm has nothing to say.
    render(<FarmOverview tasks={[]} onSelect={() => {}} />)

    expect(screen.queryByText(/apple/i)).toBeNull()
  })
})

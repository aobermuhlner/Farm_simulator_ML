import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { regionFor } from '../../../src/pool/index.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { DATA_URLS } from '../data/paths.js'
import type { TrainingSplitView } from '../data/pool.js'
import { loadTrainingSplit } from '../data/pool.js'
import { appleDeclaration } from '../test-support/declarations.js'
import { appleManifest, applePool, appleTrainingSplit } from '../test-support/pool.js'
import { CELL_DISPLAY_PX, TrainingBrowser } from './TrainingBrowser.js'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const apple = appleDeclaration()
const repoRoot = process.cwd()

// Read once: the committed manifest describes 1200 images, and re-validating it per
// assertion buys nothing.
const pool = applePool()
const split = appleTrainingSplit()
const manifest = appleManifest()

const POOL_PATHS = {
  manifest: DATA_URLS.applePoolManifest,
  atlases: DATA_URLS.applePoolAtlases,
}

/** The label the task attaches most value to getting right. */
const HIGH_VALUE = [...apple.categories].sort(
  (a, b) => payoffOf(b.id) - payoffOf(a.id),
)[0]

function payoffOf(categoryId: string): number {
  return apple.payoffs[categoryId]?.[apple.categoryActions[categoryId] ?? ''] ?? 0
}

/** Renders the browser over a split that is already in hand. */
async function renderSplit(view: TrainingSplitView = split, fixtureBacked = true): Promise<void> {
  render(
    <TrainingBrowser
      load={() => Promise.resolve({ ok: true, value: view })}
      fixtureBacked={fixtureBacked}
      onBack={() => {}}
    />,
  )
  await screen.findByRole('table')
}

/** Renders the browser over a served manifest, through the real reader. */
async function renderManifest(served: unknown): Promise<void> {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(served),
    } as Response),
  )
  render(
    <TrainingBrowser
      load={() => loadTrainingSplit(POOL_PATHS, apple)}
      fixtureBacked
      onBack={() => {}}
    />,
  )
  await screen.findByRole('alert')
}

/** Every cell in the grid, in the order it was rendered. */
function cells(): HTMLElement[] {
  return screen.queryAllByRole('img')
}

function cellOf(imageId: string): HTMLElement | undefined {
  return cells().find((cell) => cell.getAttribute('data-image') === imageId)
}

describe('the split that is shown', () => {
  it('renders every image the pool enumerates, in that order', async () => {
    await renderSplit()

    expect(cells().map((cell) => cell.getAttribute('data-image'))).toEqual([
      ...pool.order.training,
    ])
  })

  it('renders as many cells as the split has images', async () => {
    await renderSplit()

    expect(cells()).toHaveLength(pool.order.training.length)
    expect(cells()).toHaveLength(200)
  })

  it('shows no image belonging to the evaluation pool', async () => {
    await renderSplit()

    const shown = new Set(cells().map((cell) => cell.getAttribute('data-image')))
    for (const imageId of pool.order.pool) {
      expect(shown.has(imageId), `${imageId} is not a training image`).toBe(false)
    }
  })

  it('shows the same order the second time it is opened', async () => {
    await renderSplit()
    const first = cells().map((cell) => cell.getAttribute('data-image'))
    cleanup()

    await renderSplit()

    expect(cells().map((cell) => cell.getAttribute('data-image'))).toEqual(first)
  })
})

describe('cropping cells out of the atlas', () => {
  it('positions a cell at the region the reader resolves for it', async () => {
    await renderSplit()
    const imageId = pool.order.training[17]
    if (imageId === undefined) throw new Error('the committed split should have an 18th image')
    const region = regionFor(pool, imageId)
    const atlas = pool.atlases[pool.images[imageId]?.atlas ?? '']
    if (region === undefined || atlas === undefined) throw new Error('the reader should place it')
    const scale = CELL_DISPLAY_PX / region.size

    const cell = cellOf(imageId)

    expect(cell?.style.backgroundPosition).toBe(
      `${-(region.x * scale)}px ${-(region.y * scale)}px`,
    )
    expect(cell?.style.backgroundSize).toBe(
      `${atlas.width * scale}px ${atlas.height * scale}px`,
    )
  })

  it('gives two images in one atlas different positions', async () => {
    await renderSplit()
    const [first, second] = pool.order.training
    if (first === undefined || second === undefined) throw new Error('two images expected')
    expect(pool.images[first]?.atlas).toBe(pool.images[second]?.atlas)

    expect(cellOf(first)?.style.backgroundPosition).not.toBe(
      cellOf(second)?.style.backgroundPosition,
    )
  })

  it('issues one image request for the whole split, not one per image', async () => {
    await renderSplit()

    const atlases = new Set(cells().map((cell) => cell.style.backgroundImage))

    expect(atlases.size).toBe(1)
    expect(cells().length).toBeGreaterThan(atlases.size * 100)
  })
})

describe('labels', () => {
  it('labels every cell with the label its task declares for that category', async () => {
    await renderSplit()

    for (const category of apple.categories) {
      const expected = pool.order.training.filter(
        (imageId) => pool.images[imageId]?.category === category.id,
      ).length
      expect(
        screen.getAllByRole('img', { name: category.label }),
        `no cells labelled ${category.label}`,
      ).toHaveLength(expected)
    }
  })

  it('labels an image of the high-value category as that task declares', async () => {
    await renderSplit()
    if (HIGH_VALUE === undefined) throw new Error('the task should declare categories')
    const imageId = pool.order.training.find(
      (candidate) => pool.images[candidate]?.category === HIGH_VALUE.id,
    )
    if (imageId === undefined) throw new Error('the split should carry the high-value category')

    expect(cellOf(imageId)?.getAttribute('aria-label')).toBe(HIGH_VALUE.label)
  })

  it('writes no category id into the screen', () => {
    const source = readFileSync(join(repoRoot, 'web/src/screens/TrainingBrowser.tsx'), 'utf8')

    for (const category of apple.categories) {
      expect(source, `the screen names "${category.id}"`).not.toMatch(
        new RegExp(`['"\`]${category.id}['"\`]`),
      )
    }
  })
})

describe('the composition of the split', () => {
  function countShown(label: string): string | undefined {
    const table = screen.getByRole('table')
    const row = within(table).getByRole('rowheader', { name: label }).parentElement
    return row?.lastElementChild?.textContent ?? undefined
  }

  it('states a count per declared category equal to what it rendered', async () => {
    await renderSplit()

    for (const category of apple.categories) {
      const rendered = cells().filter(
        (cell) => pool.images[cell.getAttribute('data-image') ?? '']?.category === category.id,
      ).length
      expect(countShown(category.label), `${category.label} count`).toBe(String(rendered))
    }
  })

  it('states the composition the committed pool actually has', async () => {
    await renderSplit()

    expect(apple.categories.map((category) => countShown(category.label))).toEqual([
      '100',
      '50',
      '50',
    ])
  })
})

describe('what is deliberately absent', () => {
  const ATTRIBUTES = ['hue', 'roundness', 'gloss', 'lighting', 'wormVisibility'] as const

  it('renders no attribute value the manifest records', async () => {
    const images = (manifest as { images: Record<string, { split: string; attributes: Record<string, number> }> })
      .images
    // Only the fractional values: "0" and "1" are digits that legitimately appear in a
    // count, while a recorded 0.976 could only have come from the manifest.
    const values = new Set<string>()
    for (const entry of Object.values(images)) {
      if (entry.split !== 'training') continue
      for (const attribute of ATTRIBUTES) {
        const value = entry.attributes[attribute]
        if (value !== undefined && !Number.isInteger(value)) values.add(String(value))
      }
    }
    expect(values.size).toBeGreaterThan(100)

    const { container } = render(
      <TrainingBrowser
        load={() => Promise.resolve({ ok: true, value: split })}
        fixtureBacked
        onBack={() => {}}
      />,
    )
    await screen.findByRole('table')
    const text = container.textContent ?? ''

    for (const value of values) {
      expect(text, `the attribute value ${value} reached the screen`).not.toContain(value)
    }
  })

  it('names no attribute in the screen or in the data it is handed', () => {
    for (const file of ['web/src/screens/TrainingBrowser.tsx', 'web/src/data/pool.ts']) {
      const text = readFileSync(join(repoRoot, file), 'utf8')
      for (const attribute of ATTRIBUTES) {
        expect(text, `${file} names ${attribute}`).not.toMatch(new RegExp(`\\b${attribute}\\b`))
      }
    }
  })

  it('declares no attribute field on the view the screen receives', () => {
    const text = readFileSync(join(repoRoot, 'web/src/data/pool.ts'), 'utf8')
    const view = /export interface SplitImageView \{([\s\S]*?)\n\}/.exec(text)?.[1]
    if (view === undefined) throw new Error('SplitImageView should be declared in pool.ts')

    for (const attribute of ATTRIBUTES) {
      expect(view, `SplitImageView carries ${attribute}`).not.toContain(attribute)
    }
    expect(view).not.toContain('attributes')
  })

  it('displays no distribution, range or average of anything', async () => {
    const { container } = render(
      <TrainingBrowser
        load={() => Promise.resolve({ ok: true, value: split })}
        fixtureBacked
        onBack={() => {}}
      />,
    )
    await screen.findByRole('table')

    for (const word of ['average', 'mean', 'range', 'distribution', 'median']) {
      expect(container.textContent, `the screen reports a ${word}`).not.toContain(word)
    }
  })
})

describe('which pool is on screen', () => {
  it('says the images shown are not the images a run scored', async () => {
    await renderSplit(split, true)

    const notice = screen.getByRole('note')

    expect(notice.textContent).toContain('not counts of the images below')
    expect(notice.textContent).toContain('stand-in')
  })

  it('makes no such claim once the run scores this pool', async () => {
    await renderSplit(split, false)

    expect(screen.queryByRole('note')).toBeNull()
  })
})

describe('a pool that will not load', () => {
  function refuses(issues: readonly ValidationIssue[]) {
    return () => Promise.resolve({ ok: false as const, issues })
  }

  it('reports an unreachable manifest and shows no grid', async () => {
    render(
      <TrainingBrowser
        load={refuses([
          {
            code: 'data-unreachable',
            message: `Could not fetch "${POOL_PATHS.manifest}": 404.`,
            field: POOL_PATHS.manifest,
          },
        ])}
        fixtureBacked
        onBack={() => {}}
      />,
    )

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Could not fetch')
    expect(alert.textContent).toContain(POOL_PATHS.manifest)
    expect(cells()).toHaveLength(0)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('refuses a pool declaring a different pool id, naming both', async () => {
    await renderManifest({ ...manifest, poolId: 'pools/elsewhere' })

    const alert = screen.getByRole('alert')

    expect(alert.textContent).toContain('pools/elsewhere')
    expect(alert.textContent).toContain(apple.pool)
    expect(cells()).toHaveLength(0)
  })

  it('refuses a pool generated against a different schema version, naming both', async () => {
    await renderManifest({ ...manifest, schemaVersion: '9.9.9' })

    const alert = screen.getByRole('alert')

    expect(alert.textContent).toContain('9.9.9')
    expect(alert.textContent).toContain(apple.schemaVersion)
    expect(cells()).toHaveLength(0)
  })

  it('draws nothing at all when one image names an unknown atlas', async () => {
    const images = (manifest as { images: Record<string, { split: string; atlas: string }> }).images
    const found = Object.entries(images).find(([, entry]) => entry.split === 'training')
    if (found === undefined) throw new Error('a training image was expected')
    const [imageId, entry] = found

    await renderManifest({
      ...manifest,
      images: { ...images, [imageId]: { ...entry, atlas: 'atlas-that-is-not-there' } },
    })

    const alert = screen.getByRole('alert')

    expect(alert.textContent).toContain('atlas-that-is-not-there')
    expect(alert.textContent).toContain(imageId)
    expect(cells()).toHaveLength(0)
    expect(screen.queryByRole('table')).toBeNull()
  })
})

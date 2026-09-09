import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPool, regionFor } from '../../../src/pool/index.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { dataUrlFor } from '../data/paths.js'
import type { TrainingSplitView } from '../data/pool.js'
import { loadTrainingSplit, trainingSplitView } from '../data/pool.js'
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
  manifest: 'data/pools/apple-harvest/manifest.json',
  atlases: dataUrlFor('pools/apple-harvest') ?? '',
}

/** The label the task attaches most value to getting right. */
const HIGH_VALUE = [...apple.categories].sort(
  (a, b) => payoffOf(b.id) - payoffOf(a.id),
)[0]

function payoffOf(categoryId: string): number {
  return apple.payoffs[categoryId]?.[apple.categoryActions[categoryId] ?? ''] ?? 0
}

/** Renders the browser over a split that is already in hand. */
async function renderSplit(view: TrainingSplitView = split): Promise<void> {
  render(
    <TrainingBrowser
      load={() => Promise.resolve({ ok: true, value: view })}
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
      load={() => loadTrainingSplit(POOL_PATHS, apple, apple.datasets[0]?.id ?? '')}
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

  it('summarises no measured feature per split, any more than it summarises an attribute', () => {
    // A measured feature recovers the attribute it is nominally about closely enough that
    // a per-split average would hand over the authored gap exactly as the attribute's
    // would. Per-image values do not have that problem — one apple's redness reveals one
    // apple — so what is forbidden here is the summary, not the number.
    const features = apple.features.map((feature) => feature.id)
    expect(features.length).toBeGreaterThan(4)

    for (const file of ['web/src/screens/TrainingBrowser.tsx', 'web/src/data/pool.ts']) {
      const text = readFileSync(join(repoRoot, file), 'utf8')
      const code = text
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n')
      for (const feature of features) {
        expect(code, `${file} names the feature ${feature}`).not.toMatch(
          new RegExp(`\\b${feature}\\b`),
        )
      }
      for (const word of ['average', 'mean(', 'distribution', 'histogram', 'median']) {
        expect(code, `${file} computes a ${word}`).not.toContain(word)
      }
    }
  })

  it('declares no measured feature on the view the screen receives', () => {
    const text = readFileSync(join(repoRoot, 'web/src/data/pool.ts'), 'utf8')
    const view = /export interface SplitImageView \{([\s\S]*?)\n\}/.exec(text)?.[1]
    if (view === undefined) throw new Error('SplitImageView should be declared in pool.ts')
    expect(view).not.toContain('features')
    for (const feature of apple.features) {
      expect(view, `SplitImageView carries ${feature.id}`).not.toContain(feature.id)
    }
  })

  it('renders no per-split count of a measured feature', async () => {
    const { container } = render(
      <TrainingBrowser
        load={() => Promise.resolve({ ok: true, value: split })}
        onBack={() => {}}
      />,
    )
    await screen.findByRole('table')
    const text = container.textContent ?? ''

    // Whole distinct values of a measured feature over the training split. Any of them on
    // screen beside a count would be a summary of that feature.
    const values = new Set<string>()
    const images = (manifest as { images: Record<string, { split: string; features: Record<string, number> }> })
      .images
    for (const entry of Object.values(images)) {
      if (entry.split !== 'training') continue
      for (const feature of apple.features) {
        const value = entry.features[feature.id]
        if (value !== undefined && !Number.isInteger(value)) values.add(String(value))
      }
    }
    expect(values.size).toBeGreaterThan(100)
    for (const value of values) {
      expect(text, `the measured value ${value} reached the screen`).not.toContain(value)
    }
  })

  it('displays no distribution, range or average of anything', async () => {
    const { container } = render(
      <TrainingBrowser
        load={() => Promise.resolve({ ok: true, value: split })}
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
  it('makes no claim that these are not the images a run scores', async () => {
    // They are. One pool per task, browsed and scored — so the notice that used to warn
    // otherwise is gone rather than left standing as a stale caveat.
    await renderSplit(split)

    expect(screen.queryByRole('note')).toBeNull()
  })

  it('shows the same images the shipped task is scored over', async () => {
    await renderSplit(split)

    expect(screen.queryAllByRole('img')).toHaveLength(split.images.length)
    expect(split.images.length).toBe(200)
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

/** The task's smallest tier: the one that came with the robot. */
const smallest = (() => {
  const tier = apple.datasets[0]
  if (tier === undefined) throw new Error('the shipped task must declare a tier')
  return tier
})()

describe('the tier the browser is showing', () => {

  /**
   * The committed split projected through a tier that files some apples wrongly.
   *
   * The manifest's labels move and its categories do not, and the task's declared
   * composition moves with the labels — which is what a tier declares. Everything below
   * goes through the real reader and the real projection, so what is asserted is what a
   * student would be shown if the photographs arrived tomorrow.
   */
  function misfiling(): TrainingSplitView {
    const raw = JSON.parse(JSON.stringify(appleManifest())) as {
      images: Record<string, { category: string; tierLabels?: Record<string, string> }>
    }
    let moved = 0
    for (const image of Object.values(raw.images)) {
      if (image.tierLabels?.[smallest.id] !== 'wormy' || moved >= 7) continue
      image.tierLabels[smallest.id] = 'red'
      moved += 1
    }
    expect(moved).toBe(7)

    const filed = {
      ...apple,
      datasets: apple.datasets.map((tier) =>
        tier.id !== smallest.id
          ? tier
          : {
              ...tier,
              label: 'A hurried pile',
              disclosure: 'Filed in an afternoon. Some of what it says is wrong.',
              composition: { red: 107, green: 50, wormy: 43 },
            },
      ),
    }

    const read = readPool(raw, filed)
    if (!read.ok) throw new Error(`the doctored pool must read: ${read.issues[0]?.message}`)
    const view = trainingSplitView(read.pool, filed, POOL_PATHS.atlases, smallest.id)
    if (!view.ok) throw new Error(`the doctored split must project: ${view.issues[0]?.message}`)
    return view.value
  }

  it('names the set on screen by the label its declaration carries', async () => {
    await renderSplit()

    expect(screen.getByText(smallest.label, { exact: false })).toBeDefined()
  })

  it('states the tier’s declared label quality beside its images', async () => {
    await renderSplit()

    expect(screen.getByText(smallest.disclosure)).toBeDefined()
  })

  it('states a hurried tier’s disclosure just as it states a checked one’s', async () => {
    const view = misfiling()
    await renderSplit(view)

    expect(screen.getByText(view.tier.disclosure)).toBeDefined()
    expect(screen.getByText('A hurried pile', { exact: false })).toBeDefined()
  })

  it('labels each image by the category its tier files it under, not by the truth', async () => {
    const view = misfiling()
    const wormy = apple.categories.find((category) => category.id === 'wormy')
    const red = apple.categories.find((category) => category.id === 'red')
    await renderSplit(view)

    // Seven apples the manifest calls wormy are filed as red by this tier, and the
    // browser shows them as red — the browser is showing the dataset, not the orchard.
    const labelled = cells().filter((cell) => cell.getAttribute('aria-label') === red?.label)
    expect(labelled).toHaveLength(107)
    expect(
      cells().filter((cell) => cell.getAttribute('aria-label') === wormy?.label),
    ).toHaveLength(43)
  })

  it('counts the composition by those same labels', async () => {
    const view = misfiling()
    await renderSplit(view)

    const table = screen.getByRole('table')
    expect(within(table).getByText('107')).toBeDefined()
    expect(within(table).getByText('43')).toBeDefined()
    // No count of true categories anywhere: the 50 wormy apples the pool really holds are
    // the discrepancy the harvest reveals, not something the browser gives away.
    expect(within(table).queryAllByText('50')).toHaveLength(1)
  })

  it('marks no image as mislabelled and states no count of them', async () => {
    const view = misfiling()
    await renderSplit(view)

    for (const cell of cells()) {
      expect(cell.getAttribute('data-mislabelled')).toBeNull()
      expect(cell.className).not.toContain('mislabelled')
    }
    expect(screen.queryByText(/mislabel/i)).toBeNull()
    expect(screen.queryByText(/wrongly labelled/i)).toBeNull()
    // Seven is the count that must not be recoverable from the screen.
    expect(screen.queryAllByText('7')).toHaveLength(0)
  })
})

describe('moving up a tier adds photographs and removes none', () => {
  /**
   * The committed pool split into two authored tiers over the same 200 images.
   *
   * The shipped pool authors one tier, so this is the only way to exercise the property
   * before the regeneration: half the images enter at the smaller tier and the rest at
   * the larger, which holds all of them. Sized down from the declaration's 200 and 1 000,
   * because what is under test is the nesting rather than the numbers.
   */
  function twoTiers(): {
    readonly smaller: TrainingSplitView
    readonly larger: TrainingSplitView
  } {
    const raw = JSON.parse(JSON.stringify(appleManifest())) as {
      images: Record<string, { split: string; tier?: string; tierLabels?: Record<string, string> }>
    }
    const training = Object.entries(raw.images).filter(([, image]) => image.split === 'training')
    const half = training.slice(0, 100).map(([id]) => id)

    let redsBelow = 0
    let greensBelow = 0
    let wormsBelow = 0
    for (const [id, image] of training) {
      const filed = image.tierLabels?.[smallest.id]
      if (filed === undefined) continue
      const inSmaller = half.includes(id)
      if (inSmaller) {
        if (filed === 'red') redsBelow += 1
        else if (filed === 'green') greensBelow += 1
        else wormsBelow += 1
      }
      // The smaller tier is where an image of `half` enters; everything else enters at
      // the larger one. Both file it, because membership nests.
      image.tier = inSmaller ? 'half' : 'whole'
      image.tierLabels = inSmaller ? { half: filed, whole: filed } : { whole: filed }
    }

    const declared = {
      ...apple,
      datasets: [
        {
          id: 'half',
          label: 'The first hundred',
          size: 100,
          composition: { red: redsBelow, green: greensBelow, wormy: wormsBelow },
          labelQuality: 'checked' as const,
          disclosure: 'Checked one at a time.',
        },
        {
          id: 'whole',
          label: 'All two hundred',
          size: 200,
          composition: apple.datasets[0]?.composition ?? {},
          labelQuality: 'checked' as const,
          disclosure: 'Checked one at a time, all two hundred of them.',
        },
      ],
      families: apple.families.map((declaredFamily) => ({
        ...declaredFamily,
        knobs: declaredFamily.knobs.map((knob) =>
          knob.id !== declaredFamily.datasetKnob || knob.kind !== 'choice'
            ? knob
            : { ...knob, values: ['half', 'whole'], default: 'half' },
        ),
      })),
    }

    const read = readPool(raw, declared)
    if (!read.ok) throw new Error(`the two-tier pool must read: ${read.issues[0]?.message}`)
    const project = (tier: string): TrainingSplitView => {
      const view = trainingSplitView(read.pool, declared, POOL_PATHS.atlases, tier)
      if (!view.ok) throw new Error(`${tier} must project: ${view.issues[0]?.message}`)
      return view.value
    }
    return { smaller: project('half'), larger: project('whole') }
  }

  it('shows only the smaller tier’s photographs while it is selected', async () => {
    const { smaller } = twoTiers()
    await renderSplit(smaller)

    expect(cells()).toHaveLength(100)
    expect(screen.getByText('The first hundred', { exact: false })).toBeDefined()
  })

  it('still shows every one of them once the larger tier is selected', async () => {
    const { smaller, larger } = twoTiers()
    const before = smaller.images.map((image) => image.imageId)

    await renderSplit(larger)

    const shown = cells().map((cell) => cell.getAttribute('data-image'))
    expect(shown).toHaveLength(200)
    for (const id of before) expect(shown, id).toContain(id)
    // And it adds the rest rather than replacing what was there.
    expect(shown.filter((id) => id !== null && !before.includes(id))).toHaveLength(100)
  })
})

/**
 * The tree as a declared family: what it declares, what gates it, and what is for sale.
 *
 * The point of this file is that everything a second rung needs is *data*. Nothing in
 * `src/` or in a screen names this family, its knob, its puzzle or its price, and the
 * assertions below are all read off the shipped declaration and the shipped catalog
 * rather than written down here twice.
 *
 * The one thing that is written down here is what must *not* be declared: no second
 * capacity knob, and no history. Both are absences, and an absence is exactly the sort
 * of thing that reappears quietly.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { familyCoverageIssue, readFamilyStore, resolveFamilyEntry } from '../src/families/index.js'
import { UNTRAINED_CONFIGURATION } from '../src/task/artifactIndex.js'
import type { PoolBinding } from '../src/task/artifactIndex.js'
import { configurationId } from '../src/task/configId.js'
import { defaultConfiguration, resolveConfiguration } from '../src/task/configuration.js'
import { validateDeclaration } from '../src/task/validate.js'
import { checkCatalogAgainstTasks, checkCatalogCoverage, computeAvailability, computeFieldability, validateCatalog } from '../src/progression/index.js'
import { isTutorialComplete } from '../src/tutorials/index.js'
import { encodeSave, newGame } from '../src/save/index.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'
import { leafTutorial } from './helpers/leaves'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const apple = appleDeclaration()
const manifest = committedManifest()

const tree = apple.families.find((candidate) => candidate.ships === 'model')
const network = apple.families.find((candidate) => candidate.ships === 'predictions')
if (tree === undefined || network === undefined) {
  throw new Error('the apple task must declare a model-shipping family and a prediction one')
}

const binding: PoolBinding = {
  poolId: manifest.poolId,
  schemaVersion: manifest.schemaVersion,
  seed: manifest.seed,
}

function read<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as T
}

const treeIndex = read<Record<string, unknown>>(join(tree.models ?? '', 'index.json'))

function loadedStore() {
  const store = readFamilyStore(treeIndex, apple, tree!, binding)
  if (!store.ok) throw new Error(store.issues.map((issue) => issue.message).join(' '))
  return store.store
}

/** The catalog, validated against the farm it prices things in. */
function catalog() {
  const farm = read<Record<string, unknown>>('declarations/farm.json')
  const validated = validateCatalog(read('declarations/catalog.json'), farm as never)
  if (!validated.ok) throw new Error(validated.issues.map((issue) => issue.message).join(' '))
  return validated.catalog
}

describe('4.1 the family is declared, and declares nothing it should not', () => {
  it('validates as part of the shipped task, through the registry the browser loads', () => {
    const result = validateDeclaration(read('declarations/apple-harvest.json'))
    if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(' '))
    expect(result.declaration.families.map((family) => family.id)).toContain(tree!.id)
  })

  it('says it ships its model, and names where its models are served from', () => {
    expect(tree!.ships).toBe('model')
    expect(tree!.models).toBeTypeOf('string')
    expect(tree!.predictions).toBeUndefined()
  })

  it('carries a label, teaching copy, a labour slot and a drawing of its own', () => {
    expect(tree!.label.length).toBeGreaterThan(0)
    expect(tree!.teaching.summary.length).toBeGreaterThan(20)
    expect(tree!.teaching.theory.length).toBeGreaterThan(20)
    expect(tree!.slot.icon.length).toBeGreaterThan(0)
    expect(tree!.slot.label.length).toBeGreaterThan(0)
    expect(tree!.slot.label.length).toBeLessThan(20)
    expect(tree!.diagram?.kind).toBe('tree')
  })

  it('has the node budget as its only capacity knob, and no depth beside it', () => {
    // One currency for capacity. A depth knob next to a node budget is a second price
    // for the same thing, harder to explain and harder to price.
    const capacity = tree!.knobs.filter((knob) => knob.id !== tree!.datasetKnob)

    expect(capacity).toHaveLength(1)
    expect(capacity[0]?.kind).toBe('choice')
    expect(tree!.knobs.some((knob) => knob.id === 'depth')).toBe(false)
    expect(tree!.knobs.some((knob) => /depth/i.test(knob.label))).toBe(false)
  })

  it('counts its budget in whole questions, and opens on the smallest', () => {
    const capacity = tree!.knobs.find((knob) => knob.id !== tree!.datasetKnob)
    if (capacity?.kind !== 'choice') throw new Error('the budget must be an enumerated choice')

    for (const value of capacity.values) {
      expect(Number.isInteger(value), String(value)).toBe(true)
      expect(Number(value)).toBeGreaterThan(0)
    }
    expect(capacity.default).toBe(Math.min(...capacity.values.map(Number)))
  })

  it('declares no history, because there is no growth to replay', () => {
    // `model-families`: a family that records none declares none, rather than declaring
    // one with an empty axis. The history arrives with the fitting.
    expect(tree!.history).toBeUndefined()
  })

  it('leaves the convolutional family exactly as it was', () => {
    expect(network!.ships).toBe('predictions')
    expect(network!.history?.axis).toBe('epoch')
    expect(network!.tutorial).toBeUndefined()
  })
})

describe('4.2 the puzzle that was waiting is the puzzle that gates it', () => {
  it('declares the archived tutorial by the id that was authored for it', () => {
    expect(tree!.tutorial?.id).toBe('first-tree-leaves')
    expect(tree!.tutorial).toEqual(leafTutorial())
  })

  it('withholds putting the family to work while the puzzle is unsolved', () => {
    const fieldability = computeFieldability([apple], [])
    const entry = fieldability.tasks
      .find((task) => task.taskId === apple.id)
      ?.families.find((family) => family.familyId === tree!.id)

    expect(entry?.fieldable).toBe(false)
    expect(entry?.withheldBy).toBe('first-tree-leaves')
  })

  it('withholds nothing else: it is still selectable once it is owned', () => {
    // Selection stays a function of the catalog and what is owned. The gate touches
    // exactly one thing, and a build where it touched two would have turned a
    // comprehension check into a second paywall.
    const availability = computeAvailability(catalog(), [apple], ['sorting-tree'])
    const family = availability.tasks
      .find((task) => task.taskId === apple.id)
      ?.families.find((candidate) => candidate.familyId === tree!.id)

    expect(family?.available).toBe(true)
  })

  it('lets it be put to work once the puzzle has been passed', () => {
    const fieldability = computeFieldability([apple], ['first-tree-leaves'])
    const entry = fieldability.tasks
      .find((task) => task.taskId === apple.id)
      ?.families.find((family) => family.familyId === tree!.id)

    expect(entry?.fieldable).toBe(true)
    expect(entry?.withheldBy).toBeUndefined()
  })

  it('is recorded once, by the puzzle’s own id and by nothing finer', () => {
    // Completion is a list of tutorial ids: not per family, not per task, and carrying
    // nothing about how well it was solved. A puzzle that recorded a score would be a
    // puzzle a student optimises instead of reads.
    expect(isTutorialComplete(tree!.tutorial, [])).toBe(false)
    expect(isTutorialComplete(tree!.tutorial, ['first-tree-leaves'])).toBe(true)
    expect(isTutorialComplete(tree!.tutorial, ['first-tree-leaves', 'first-tree-leaves'])).toBe(
      true,
    )

    const opened = newGame(read('declarations/farm.json'), catalog(), () => 1)
    const saved = encodeSave({ ...opened, tutorials: ['first-tree-leaves'] })
    expect(saved.tutorials).toEqual(['first-tree-leaves'])
    // That pressing it twice appends nothing is the shell's to keep, and
    // `web/src/App.tutorial.test.tsx` holds it to that.
  })

  it('leaves the other family fieldable, because it declares no gate', () => {
    const fieldability = computeFieldability([apple], [])
    const entry = fieldability.tasks
      .find((task) => task.taskId === apple.id)
      ?.families.find((family) => family.familyId === network!.id)

    expect(entry?.fieldable).toBe(true)
  })
})

describe('4.3 the budget is part of this family’s configuration identity', () => {
  it('puts the budget into the identifier the family resolves to', () => {
    const capacity = tree!.knobs.find((knob) => knob.id !== tree!.datasetKnob)
    if (capacity?.kind !== 'choice') throw new Error('the budget must be an enumerated choice')

    for (const value of capacity.values) {
      const resolved = resolveConfiguration(apple, tree!, {
        [capacity.id]: value,
        [tree!.datasetKnob]: 'starter',
      })
      if (!resolved.ok) throw new Error(resolved.issues.map((issue) => issue.message).join(' '))
      expect(configurationId(resolved.configuration)).toContain(`${capacity.id}${value}`)
    }
  })

  it('cannot compose an identifier the convolutional family also composes', () => {
    // Identity is scoped to the family that made it, and here the two do not even
    // collide as strings: neither family's knob ids are a subset of the other's.
    const treeIds = new Set(
      (tree!.knobs.find((knob) => knob.id !== tree!.datasetKnob) as { values: readonly (string | number)[] }).values.map(
        (value) =>
          configurationId({
            taskId: apple.id,
            familyId: tree!.id,
            values: [
              ['nodes', value],
              [tree!.datasetKnob, 'starter'],
            ],
          }),
      ),
    )

    const networkIds = read<{ readonly configurations: Record<string, unknown> }>(
      join(network!.predictions ?? '', 'index.json'),
    ).configurations

    for (const id of Object.keys(networkIds)) expect(treeIds.has(id)).toBe(false)
    for (const id of treeIds) expect(Object.keys(networkIds)).not.toContain(id)
  })

  it('leaves the three shipped convolutional identifiers resolving exactly as before', () => {
    expect(configurationId(defaultConfiguration(apple, network!))).toBe(
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
    )
    const covered = Object.keys(
      read<{ readonly configurations: Record<string, unknown> }>(
        join(network!.predictions ?? '', 'index.json'),
      ).configurations,
    )
    expect(covered).toEqual([
      'blocks2-channels8-regularization1-dropout0-datasetstarter',
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
      'blocks2-channels32-regularization1-dropout0-datasetstarter',
    ])
  })

  it('resolves each family’s identifiers against its own store and never the other’s', () => {
    const treeCoverage = loadedStore().coverage
    for (const id of treeCoverage) {
      expect(familyCoverageIssue(tree!, treeCoverage, id)).toBeUndefined()
    }
    // The convolutional identifiers are not covered here, and the refusal says which
    // family it is about rather than claiming nothing was ever trained for them.
    const missing = familyCoverageIssue(
      tree!,
      treeCoverage,
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
    )
    expect(missing?.code).toBe(UNTRAINED_CONFIGURATION)
    expect(missing?.message).toContain(tree!.id)
  })
})

describe('4.4 what the catalog sells for this family', () => {
  it('sells the family itself, and names it as the thing it opens', () => {
    const item = catalog().items.find((candidate) =>
      candidate.opens.some(
        (unlock) => unlock.kind === 'model-family' && unlock.family === tree!.id,
      ),
    )

    expect(item).toBeDefined()
    expect(item?.priceUnits).toBeGreaterThan(0)
    expect(item?.group).toBe('models')
  })

  it('sells every budget above the one owned before any purchase, and not that one', () => {
    const capacity = tree!.knobs.find((knob) => knob.id !== tree!.datasetKnob)
    if (capacity?.kind !== 'choice') throw new Error('the budget must be an enumerated choice')

    const sold = catalog()
      .items.flatMap((item) => item.opens)
      .filter((unlock) => unlock.kind === 'knob-values' && unlock.knob === capacity.id)
      .flatMap((unlock) => (unlock.kind === 'knob-values' ? unlock.values : []))

    expect([...sold].sort()).toEqual(
      capacity.values.filter((value) => value !== capacity.default).sort(),
    )
    expect(sold).not.toContain(capacity.default)
  })

  it('resolves every reference it makes into the shipped declaration', () => {
    expect(checkCatalogAgainstTasks(catalog(), [apple])).toEqual([])
  })

  it('opens no configuration no model was made for, in either family', () => {
    // `progression-catalog`'s own rule, run over both families at once. Selling a
    // student a configuration that refuses is worse than not selling it at all.
    const networkIndex = read<{ readonly configurations: Record<string, unknown> }>(
      join(network!.predictions ?? '', 'index.json'),
    )
    const coverage = {
      [apple.id]: {
        [tree!.id]: loadedStore().coverage,
        [network!.id]: Object.keys(networkIndex.configurations),
      },
    }

    expect(checkCatalogCoverage(catalog(), [apple], coverage)).toEqual([])
  })

  it('covers the budget a student holds before they have bought anything', () => {
    expect(loadedStore().coverage).toContain(configurationId(defaultConfiguration(apple, tree!)))
  })

  it('locks the family until its item is owned, and shows what opens it', () => {
    const locked = computeAvailability(catalog(), [apple], [])
      .tasks.find((task) => task.taskId === apple.id)
      ?.families.find((family) => family.familyId === tree!.id)

    expect(locked?.available).toBe(false)
    expect(locked?.openedBy?.priceUnits).toBeGreaterThan(0)
  })

  it('locks the convolutional family too, and shows what opens it', () => {
    // It used to come with the robot, which said of the two models on the shelf that the
    // unreadable one is the free option. Both are bought now, and the eye is the dearer of
    // them by a hundredfold — `smallholding-economy`. A farm that has bought nothing owns
    // neither, and a farm that owned the eye before this change keeps it, because
    // ownership is what the save carries rather than what the catalog gives out.
    const shipped = catalog()
    expect(shipped.ownedAtStart).toEqual([])

    const locked = computeAvailability(shipped, [apple], [])
      .tasks.find((task) => task.taskId === apple.id)
      ?.families.find((family) => family.familyId === network!.id)

    expect(locked?.available).toBe(false)
    expect(locked?.openedBy?.priceUnits).toBeGreaterThan(0)

    // And it is dearer than the tree it is sold against, which is the whole point of it.
    const opensTheTree = computeAvailability(shipped, [apple], [])
      .tasks.find((task) => task.taskId === apple.id)
      ?.families.find((family) => family.familyId === tree!.id)?.openedBy
    expect(locked?.openedBy?.priceUnits).toBeGreaterThan(opensTheTree?.priceUnits ?? 0)
  })

  it('opens the convolutional family once its item is owned', () => {
    const shipped = catalog()
    const opensIt = shipped.items.find((item) =>
      item.opens.some((unlock) => unlock.kind === 'model-family' && unlock.family === network!.id),
    )
    const owned = computeAvailability(shipped, [apple], [opensIt?.id ?? ''])
      .tasks.find((task) => task.taskId === apple.id)
      ?.families.find((family) => family.familyId === network!.id)

    expect(owned?.available).toBe(true)
    expect(owned?.openedBy).toBeUndefined()
  })
})

describe('4.5 a budget outside coverage refuses, and nothing is invented for it', () => {
  const coverage = loadedStore().coverage

  it('refuses as untrained rather than as an invalid configuration', () => {
    // The student chose a value they were offered. The cause is that no model exists
    // for the combination, not that they made a mistake, and the message must not
    // imply otherwise.
    const issue = familyCoverageIssue(tree!, coverage, 'nodes8-datasetstarter')

    expect(issue?.code).toBe(UNTRAINED_CONFIGURATION)
    expect(issue?.message).toContain('nodes8-datasetstarter')
    expect(issue?.message).toContain('knob values are allowed')
  })

  it('refuses a budget on a photograph set no tree was made for', () => {
    const issue = familyCoverageIssue(tree!, coverage, 'nodes2-datasetbulk')

    expect(issue?.code).toBe(UNTRAINED_CONFIGURATION)
    expect(issue?.message).toContain('nodes2-datasetbulk')
  })

  it('produces no tree at run time for an uncovered budget', () => {
    const store = loadedStore()
    expect(store.files['nodes8-datasetstarter']).toBeUndefined()
    expect(store.coverage).not.toContain('nodes8-datasetstarter')
  })

  it('serves no nearby budget in its place', () => {
    // The tree at four questions is not the tree at three, and answering with it would
    // score a run the student never asked for.
    const store = loadedStore()
    const near = store.files['nodes4-datasetstarter']
    expect(near).toBeDefined()

    const resolved = resolveFamilyEntry({
      declaration: apple,
      family: tree!,
      configurationId: 'nodes3-datasetstarter',
      document: read(join(tree!.models ?? '', near ?? '')),
      imageIds: { training: [], pool: [] },
      features: {},
    })

    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.issues.some((issue) => issue.code === 'artifact-configuration-mismatch')).toBe(
      true,
    )
  })
})

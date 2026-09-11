/**
 * Which family a task opens at, once what the farm owns is taken into account.
 *
 * "First declared" was sound while nothing could lock a family, and is one priced item
 * away from opening a task on a model the student cannot select. The rule is now first
 * declared *available*, applied identically to silence and to a recorded family that has
 * since been locked — so a farm always opens on something it can use, and a task with
 * nothing available opens on nothing rather than on something barred.
 *
 * See openspec/changes/market/specs/model-families/spec.md.
 */

import { describe, expect, it } from 'vitest'
import { computeAvailability, taskAvailability } from '../src/progression/index.js'
import type { Catalog } from '../src/progression/index.js'
import { newGame, selectedFamilyFor } from '../src/save/index.js'
import type { GameState } from '../src/save/index.js'
import { firstAvailableFamily, selectableFamily } from '../src/task/families.js'
import { appleDeclaration } from './helpers/apple.js'
import { catalogWith, soundCatalog, testFarm } from './helpers/catalog.js'

const apple = appleDeclaration()
const [network, tree] = apple.families

/** One item opening one family of the shipped task, priced so it can be owned. */
function opens(id: string, family: string): Record<string, unknown> {
  return {
    id,
    group: 'models',
    label: `Whatever opens ${family}`,
    copy: 'A model for the orchard.',
    price: 100,
    opens: [{ kind: 'model-family', task: apple.id, family }],
  }
}

/** A catalog locking whichever families are named, and nothing else. */
function locking(...families: readonly string[]): Catalog {
  return soundCatalog(
    catalogWith(families.map((family, index) => opens(`opener-${index}`, family))),
  )
}

/** Whether a family is available to a farm owning `owned`, under that catalog. */
function availableIn(catalog: Catalog, owned: readonly string[]) {
  const task = taskAvailability(computeAvailability(catalog, [apple], owned), apple.id)
  return (familyId: string): boolean =>
    task?.families.find((entry) => entry.familyId === familyId)?.available ?? true
}

describe('silence selects the first declared family that is available', () => {
  it('selects the first declared one when nothing is locked', () => {
    expect(selectableFamily(apple, undefined, availableIn(locking(), []))?.id).toBe(network!.id)
  })

  it('passes over a locked first family and takes the next declared one', () => {
    const catalog = locking(network!.id)
    expect(selectableFamily(apple, undefined, availableIn(catalog, []))?.id).toBe(tree!.id)
  })

  it('takes the first one back once the item that opens it is owned', () => {
    const catalog = locking(network!.id)
    expect(selectableFamily(apple, undefined, availableIn(catalog, ['opener-0']))?.id).toBe(
      network!.id,
    )
  })

  it('selects none when every family a task declares is locked', () => {
    const catalog = locking(network!.id, tree!.id)
    expect(selectableFamily(apple, undefined, availableIn(catalog, []))).toBeUndefined()
    expect(firstAvailableFamily(apple, availableIn(catalog, []))).toBeUndefined()
  })

  it('locks nothing when no availability is threaded in', () => {
    expect(selectableFamily(apple, undefined)?.id).toBe(network!.id)
    expect(firstAvailableFamily(apple)?.id).toBe(network!.id)
  })
})

describe('a recorded family that has become unavailable falls back the same way', () => {
  it('keeps a recorded family that is still available', () => {
    const catalog = locking(tree!.id)
    expect(selectableFamily(apple, network!.id, availableIn(catalog, []))?.id).toBe(network!.id)
  })

  it('falls back to the first available one when the recorded family is locked', () => {
    const catalog = locking(tree!.id)
    expect(selectableFamily(apple, tree!.id, availableIn(catalog, []))?.id).toBe(network!.id)
  })

  it('falls back to none when nothing at all is available', () => {
    const catalog = locking(network!.id, tree!.id)
    expect(selectableFamily(apple, tree!.id, availableIn(catalog, []))).toBeUndefined()
  })
})

describe('a save reads the same rule', () => {
  /** A new farm against `catalog`, with `families` recorded as its selections. */
  function farm(catalog: Catalog, families: Record<string, string> = {}): GameState {
    return { ...newGame(testFarm, catalog, () => 1), families }
  }

  it('opens a save that records nothing on the first available family', () => {
    const catalog = locking(network!.id)
    const state = farm(catalog)

    expect(selectedFamilyFor(state, apple, availableIn(catalog, state.owned))?.id).toBe(tree!.id)
  })

  it('opens a save whose recorded family has since been locked on the first available', () => {
    const catalog = locking(network!.id)
    const state = farm(catalog, { [apple.id]: network!.id })

    expect(selectedFamilyFor(state, apple, availableIn(catalog, state.owned))?.id).toBe(tree!.id)
  })

  it('answers with nothing when the farm owns no model for the task', () => {
    const catalog = locking(network!.id, tree!.id)
    const state = farm(catalog)

    expect(selectedFamilyFor(state, apple, availableIn(catalog, state.owned))).toBeUndefined()
  })
})

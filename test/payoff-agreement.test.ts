/**
 * The property the agreement rule exists for.
 *
 * `decision-policy` requires that a category's declared action pays strictly more than
 * every other action in that category's row. The point of the rule is a claim about whole
 * runs, not single cells: under it, treating every image as its true category calls for is
 * the best-paying thing that can be done with those images. That is what the whole game
 * rests on, and until the rule landed it was a convention rather than a guarantee.
 *
 * Brute-forced rather than argued, over declarations rather than over the apple task's
 * particular numbers, so a repriced or widened table is still covered.
 */

import { describe, expect, it } from 'vitest'
import type { CategoryId, TaskDeclaration } from '../src/task/types.js'
import { validateDeclaration } from '../src/task/validate.js'
import { appleDeclaration } from './helpers/apple'

/** A small run: one true category per image, with every category represented twice over. */
function imagesOf(declaration: TaskDeclaration): CategoryId[] {
  const ids = declaration.categories.map((category) => category.id)
  return [...ids, ...ids].slice(0, 5)
}

/** What a run earns when image `i` is given `assignment[i]`. */
function earnings(
  declaration: TaskDeclaration,
  images: readonly CategoryId[],
  assignment: readonly string[],
): number {
  return images.reduce((total, category, index) => {
    const cell = declaration.payoffs[category]?.[assignment[index] as string]
    if (cell === undefined) throw new Error(`no payoff for ${category}/${String(assignment[index])}`)
    return total + cell
  }, 0)
}

/** Every way of giving each image one of the declared actions. */
function assignments(declaration: TaskDeclaration, count: number): string[][] {
  const actions = declaration.actions.map((action) => action.id)
  let all: string[][] = [[]]
  for (let index = 0; index < count; index += 1) {
    all = all.flatMap((prefix) => actions.map((action) => [...prefix, action]))
  }
  return all
}

/** The screening task, which declares its own categories, actions and prices. */
function screeningDeclaration(): TaskDeclaration {
  const result = validateDeclaration({
    ...appleDeclaration(),
    id: 'skin-screening',
    title: 'Skin Disease Screening',
    categories: [
      { id: 'healthy', label: 'Healthy' },
      { id: 'diseased', label: 'Diseased' },
    ],
    actions: [
      { id: 'flag', label: 'Flag for the vet' },
      { id: 'pass', label: 'Pass' },
    ],
    categoryActions: { healthy: 'pass', diseased: 'flag' },
    payoffs: {
      healthy: { flag: -5, pass: 0 },
      diseased: { flag: -5, pass: -500 },
    },
    policy: { kind: 'highest-probability' },
  })
  if (!result.ok) {
    throw new Error(`the screening declaration must validate: ${result.issues[0]?.message}`)
  }
  return result.declaration
}

describe('treating every image correctly is the best-paying outcome', () => {
  for (const [name, build] of [
    ['the shipped apple task', appleDeclaration],
    ['the screening task', screeningDeclaration],
  ] as const) {
    it(`beats every other assignment of declared actions, on ${name}`, () => {
      const declaration = build()
      const images = imagesOf(declaration)
      const correct = images.map((category) => declaration.categoryActions[category] as string)
      const best = earnings(declaration, images, correct)

      const rivals = assignments(declaration, images.length).filter(
        (candidate) => candidate.join('|') !== correct.join('|'),
      )
      expect(rivals.length).toBeGreaterThan(0)

      for (const candidate of rivals) {
        expect(
          earnings(declaration, images, candidate),
          `${candidate.join(', ')} must not out-earn the declared treatment`,
        ).toBeLessThan(best)
      }
    })
  }
})

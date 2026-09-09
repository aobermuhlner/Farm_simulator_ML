/**
 * Finding a task's model families.
 *
 * Three one-liners, in one place, because "which family" is a question asked from the
 * workshop, the save, the labour slot and the report, and four copies of "or the first
 * one" would be four places for the silence rule to drift.
 *
 * The silence rule is the specified one: progress that states nothing about which family
 * is selected selects the task's *first declared* family, rather than none. A task with
 * no family cannot be loaded at all — `validate.ts` refuses it — so a declaration in hand
 * always has one to fall back to.
 *
 * See openspec/changes/model-families/specs/model-families/spec.md.
 */

import type {
  FamilyId,
  KnobDeclaration,
  ModelFamilyDeclaration,
  TaskDeclaration,
} from './types.js'

/** The family this task declares under that id, or nothing when it declares none. */
export function familyById(
  declaration: TaskDeclaration,
  familyId: FamilyId | undefined,
): ModelFamilyDeclaration | undefined {
  if (familyId === undefined) return undefined
  return declaration.families.find((family) => family.id === familyId)
}

/**
 * The family a task opens at when nothing says otherwise.
 *
 * Declared order, not alphabetical and not "the cheapest": the declaration is where the
 * ladder's order is written down, and the first rung is the one a student starts on.
 */
export function firstFamily(declaration: TaskDeclaration): ModelFamilyDeclaration {
  const first = declaration.families[0]
  if (first === undefined) {
    throw new Error(`Task "${declaration.id}" declares no model family; the validator refuses one.`)
  }
  return first
}

/**
 * The family selected for this task: the one named, or the first declared.
 *
 * A named family the task no longer declares falls back the same way silence does, so a
 * withdrawn rung leaves a workshop that opens rather than one that refuses. What a
 * withdrawn family does to a *labour slot* is a different question with a different
 * answer — `src/save/` drops the slot and reports it, because a slot is a commitment.
 */
export function selectedFamily(
  declaration: TaskDeclaration,
  familyId: FamilyId | undefined,
): ModelFamilyDeclaration {
  return familyById(declaration, familyId) ?? firstFamily(declaration)
}

/**
 * Every knob any of a task's families declares, once each, in declared order.
 *
 * For the one caller that has a task but no family: the catalog names what it opens as
 * "value 4 of knob blocks of task apple-harvest", with no family in it, because
 * `progression-catalog` predates families and is untouched by their arrival. Two families
 * declaring the same knob id therefore share one entry here, which is the reading the
 * catalog already has. Everything with a family in hand reads `family.knobs` instead.
 */
export function declaredKnobs(declaration: TaskDeclaration): readonly KnobDeclaration[] {
  const seen = new Set<string>()
  const knobs: KnobDeclaration[] = []
  for (const family of declaration.families) {
    for (const knob of family.knobs) {
      if (seen.has(knob.id)) continue
      seen.add(knob.id)
      knobs.push(knob)
    }
  }
  return knobs
}

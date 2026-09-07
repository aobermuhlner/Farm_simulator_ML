/**
 * Who brings a task's crop in.
 *
 * One question, one answer: for a task and a farm's labour slots, either a model that has
 * been put to work or the farm's own hands. Pure data and pure functions — nothing here
 * knows what a screen is, and nothing here reads a declaration's vocabulary.
 *
 * The absence of a slot *is* manual labour, rather than a sentinel written at farm
 * creation. A farm restored from a save that never heard of the field, and a card a
 * declaration added after that save was written, both have no entry — and the correct
 * reading of "no entry" is the one that is always true: nobody has bought anything, so a
 * person does the work. A sentinel would have to be written in two places that could
 * disagree about what an empty farm means.
 *
 * See openspec/changes/workshop-harvest-split/design.md — decisions 1, 3 and 7.
 */

import type { Availability, TaskAvailability } from '../progression/availability.js'
import { taskAvailability } from '../progression/availability.js'
import { declaredValues } from '../progression/knobValues.js'
import { ID_SEPARATOR } from '../task/configId.js'
import type { TaskDeclaration } from '../task/types.js'

/**
 * One model put to work: the configuration it was trained as, and the family that
 * configuration belongs to.
 *
 * A record rather than a bare configuration identifier because `model-families` scopes
 * configuration identity per family, and a field added later would cost a schema bump —
 * which resets every student's farm. `family` is undefined until that change lands.
 *
 * The identifier is stored rather than the knob values it came from: the identifier is
 * what was trained and what the artifact is keyed by, and `progression-catalog`
 * guarantees that unlocking *extends* what identifiers can be selected and reinterprets
 * none of them. Knob values would launder that guarantee away by being re-resolved at
 * harvest time.
 */
export interface FieldedModel {
  readonly configurationId: string
  /** The family the configuration belongs to, once there is more than one. */
  readonly family?: string
}

/** Task id to the model at work for it. A task with no entry is worked by hand. */
export type LabourSlots = Readonly<Record<string, FieldedModel>>

/** What brings one task's crop in. */
export type Labour =
  | { readonly kind: 'manual' }
  | { readonly kind: 'model'; readonly model: FieldedModel }

/** The farm's own hands, which is what every slot holds until something fills it. */
export const MANUAL_LABOUR: Labour = { kind: 'manual' }

/** Who works this task: the model in its slot, or the farm's hands where there is none. */
export function labourFor(slots: LabourSlots | undefined, taskId: string): Labour {
  const model = slots?.[taskId]
  return model === undefined ? MANUAL_LABOUR : { kind: 'model', model }
}

/** True when a model is at work for this task, which is what *working the orchard* means. */
export function isAtWork(slots: LabourSlots | undefined, taskId: string): boolean {
  return labourFor(slots, taskId).kind === 'model'
}

/** The slots with one task's job given to a model. Free and reversible; moves no money. */
export function putToWork(
  slots: LabourSlots,
  taskId: string,
  model: FieldedModel,
): LabourSlots {
  return { ...slots, [taskId]: model }
}

/** The slots with one task's job handed back to the farm's hands. */
export function handBack(slots: LabourSlots, taskId: string): LabourSlots {
  const { [taskId]: _removed, ...rest } = slots
  return rest
}

/**
 * True when progression has opened a way through this task at all.
 *
 * A knob every one of whose declared values is locked leaves the task with no
 * configuration a student may select, so there is nothing to put to work and nothing to
 * configure. Availability the catalog says nothing about opens rather than closes, which
 * is the same default-open rule `computeAvailability` works by.
 */
function unlocked(task: TaskAvailability | undefined): boolean {
  if (task === undefined) return true
  return task.knobs.every((knob) => knob.values.some((value) => value.available))
}

/**
 * True when this task is one the farm can play — declared available, and unlocked.
 *
 * A task the declaration only announces is not played, carries no labour slot and has no
 * say in when the year closes. Omitting the availability locks nothing.
 */
export function isPlayable(task: TaskDeclaration, availability?: Availability): boolean {
  if (!task.available) return false
  return unlocked(availability === undefined ? undefined : taskAvailability(availability, task.id))
}

/** Every task the farm can play, in declared order. */
export function playableTasks(
  tasks: readonly TaskDeclaration[],
  availability?: Availability,
): readonly TaskDeclaration[] {
  return tasks.filter((task) => isPlayable(task, availability))
}

/**
 * True when the task's declarations can still produce this configuration identifier.
 *
 * Read back rather than looked up, because an identifier is composed from the declared
 * knob ids in declared order — `src/task/configId.ts` — so the declaration is the only
 * thing needed to say whether it is still a configuration this build can make. A slot
 * naming one that is not, because a knob was renamed or a value withdrawn, is a stale
 * reference: it hands the job back to the hands rather than refusing the whole farm.
 *
 * The read is a plain split because `task-contract` forbids the separator inside a knob
 * id and inside the written form of any value a knob permits, refused at load. So the
 * separators in an identifier are exactly the joins the composer made: one segment per
 * knob, each the knob's own id followed by one written value, and no part of it can be
 * mistaken for another. Without that constraint this would have to guess where a value
 * ended, and two declared values could make the guess genuinely ambiguous.
 *
 * Deliberately not a check that the *artifact* carries it. That is a card that cannot be
 * brought in, with a cause the engine names at harvest time, and not the same thing at
 * all — see design.md decision 5.
 */
export function configurationResolves(declaration: TaskDeclaration, id: string): boolean {
  const knobs = declaration.knobs
  if (knobs.length === 0) return id.length === 0

  const segments = id.split(ID_SEPARATOR)
  if (segments.length !== knobs.length) return false

  return knobs.every((knob, index) => {
    const segment = segments[index]
    if (segment === undefined || !segment.startsWith(knob.id)) return false
    const written = segment.slice(knob.id.length)
    return declaredValues(knob).some((value) => String(value) === written)
  })
}

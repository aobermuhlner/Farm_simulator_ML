/**
 * Load-time validation of task declarations.
 *
 * Declarations are static data, so a malformed one can ship. Every failure here
 * refuses and names its cause rather than repairing or ignoring the problem: an
 * educational tool that silently shows wrong numbers is worse than one that
 * refuses to start.
 *
 * See openspec/changes/task-abstraction/specs/task-contract/spec.md.
 */

import type { TutorialKinds } from '../tutorials/index.js'
import { TUTORIAL_KINDS, tutorialKind } from '../tutorials/index.js'
import { blockSizes } from './cnn.js'
import { ID_SEPARATOR } from './configId.js'
import { DIAGRAM_KINDS, LABEL_QUALITIES, SHIPPED_FORMS } from './types.js'
import type { KnobDeclaration, TaskDeclaration } from './types.js'

export interface ValidationIssue {
  readonly code: string
  /** The declaration field or knob the issue is about, where there is one. */
  readonly field?: string
  readonly message: string
}

export type DeclarationValidation =
  | { readonly ok: true; readonly declaration: TaskDeclaration }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/** Every field a declaration must carry in order to be playable. */
export const REQUIRED_FIELDS = [
  'id',
  'title',
  'schemaVersion',
  'categories',
  'actions',
  'categoryActions',
  'policy',
  'pool',
  'datasets',
  'families',
  'features',
  'ruleBudget',
  'payoffs',
  'handSorting',
  'teaching',
  'available',
] as const

export const POLICY_KINDS = ['highest-probability', 'threshold', 'cost-optimal'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function permittedBySlider(value: number, min: number, max: number, step: number): boolean {
  if (value < min || value > max) return false
  const steps = (value - min) / step
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

/**
 * Reads a list of id/label entries, reporting malformed and duplicate entries
 * and requiring at least two of them.
 */
function identified(entries: unknown, field: string, issues: ValidationIssue[]): string[] {
  if (!Array.isArray(entries)) {
    issues.push({
      code: 'malformed-field',
      field,
      message: `Field "${field}" must be a list.`,
    })
    return []
  }
  const ids: string[] = []
  entries.forEach((entry, index) => {
    if (!isRecord(entry) || !isNonEmptyString(entry.id) || !isNonEmptyString(entry.label)) {
      issues.push({
        code: 'malformed-entry',
        field: `${field}[${index}]`,
        message: `Entry ${index} of "${field}" needs a non-empty id and label.`,
      })
      return
    }
    if (ids.includes(entry.id)) {
      issues.push({
        code: 'duplicate-id',
        field: `${field}[${index}]`,
        message: `Field "${field}" declares id "${entry.id}" more than once.`,
      })
      return
    }
    ids.push(entry.id)
  })
  if (ids.length < 2) {
    issues.push({
      code: 'too-few',
      field,
      message: `Field "${field}" must declare at least two entries; found ${ids.length}.`,
    })
  }
  return ids
}

/**
 * Where a knob list lives and whose it is.
 *
 * Knobs belong to a model family rather than to a task, so every refusal has to name the
 * family as well as the knob: two families of one task may declare the same knob id, and
 * "knob \"blocks\" permits -1" would then name two different declarations.
 */
interface KnobScope {
  /** Field path of the knob list, e.g. `families[0].knobs`. */
  readonly path: string
  /** The family the knobs belong to, as its refusals name it. */
  readonly family: string
  /**
   * The id of the knob that selects this family's dataset, where it declares one.
   *
   * A knob offering one value is normally not a knob at all, and is refused as one. The
   * dataset knob is the exception, because it does a second job besides offering a choice:
   * it puts the fitting set into the configuration identifier. A task declaring a single
   * tier — which `specs/dataset-tiers/spec.md` permits, since it requires *at least* one —
   * would otherwise be unloadable, and a lesson with nothing to buy is a legitimate lesson.
   */
  readonly datasetKnob?: string
}

function checkKnob(
  knob: unknown,
  index: number,
  scope: KnobScope,
  issues: ValidationIssue[],
): string | undefined {
  const where = `${scope.path}[${index}]`
  const of = ` of family "${scope.family}"`
  if (!isRecord(knob)) {
    issues.push({
      code: 'malformed-knob',
      field: where,
      message: `Knob ${index}${of} must be an object.`,
    })
    return undefined
  }
  const id = isNonEmptyString(knob.id) ? knob.id : undefined
  const named = `knob "${id ?? index}"${of}`

  for (const field of ['id', 'label', 'kind', 'help'] as const) {
    if (!isNonEmptyString(knob[field])) {
      issues.push({
        code: 'missing-knob-field',
        field: `${where}.${field}`,
        message: `Knob ${id ?? index}${of} is missing a non-empty "${field}".`,
      })
    }
  }
  if (knob.default === undefined) {
    issues.push({
      code: 'missing-knob-field',
      field: `${where}.default`,
      message: `Knob ${id ?? index}${of} is missing a "default".`,
    })
  }

  if (knob.kind === 'choice') {
    const fewest = knob.id === scope.datasetKnob ? 1 : 2
    if (!Array.isArray(knob.values) || knob.values.length < fewest) {
      issues.push({
        code: 'malformed-knob-values',
        field: `${where}.values`,
        message: `Choice ${named} must declare at least ${fewest === 1 ? 'one allowed value' : 'two allowed values'}.`,
      })
    } else if (knob.default !== undefined && !knob.values.includes(knob.default)) {
      issues.push({
        code: 'default-not-allowed',
        field: `${where}.default`,
        message: `Choice ${named} has default ${JSON.stringify(knob.default)}, which is not among its allowed values.`,
      })
    }
  } else if (knob.kind === 'slider') {
    const { min, max, step } = knob
    if (typeof min !== 'number' || typeof max !== 'number' || typeof step !== 'number') {
      issues.push({
        code: 'malformed-knob-values',
        field: where,
        message: `Slider ${named} must declare numeric min, max and step.`,
      })
    } else if (max <= min || step <= 0) {
      issues.push({
        code: 'malformed-knob-values',
        field: where,
        message: `Slider ${named} needs max above min and a positive step.`,
      })
    } else if (typeof knob.default === 'number' && !permittedBySlider(knob.default, min, max, step)) {
      issues.push({
        code: 'default-not-allowed',
        field: `${where}.default`,
        message: `Slider ${named} has default ${knob.default}, which its min, max and step do not permit.`,
      })
    }
  } else if (isNonEmptyString(knob.kind)) {
    issues.push({
      code: 'unknown-knob-kind',
      field: `${where}.kind`,
      message: `Knob ${id ?? index}${of} declares unknown kind "${knob.kind}"; expected "choice" or "slider".`,
    })
  }

  checkSeparator(knob, id, index, scope, issues)

  return id
}

/**
 * Refuses a knob that would compose an identifier nobody can read back.
 *
 * `configurationId` joins knob ids and written values with `ID_SEPARATOR`, and a slot
 * naming a configuration reads that identifier back against the declaration. The
 * separator appearing inside either part makes the read bind the wrong value and fail —
 * and a slot that fails to resolve is dropped on restore, so an author adding a
 * well-formed-looking value would silently take every student's model off the task.
 *
 * The values are the ones the knob actually permits rather than the fields it declares,
 * so a slider whose range crosses zero is caught by the negative number it walks to
 * rather than having to be recognised from its bounds. A knob whose own declaration is
 * malformed contributes no values; its issues are already reported.
 */
function checkSeparator(
  knob: Record<string, unknown>,
  id: string | undefined,
  index: number,
  scope: KnobScope,
  issues: ValidationIssue[],
): void {
  const where = `${scope.path}[${index}]`
  const of = ` of family "${scope.family}"`

  if (id !== undefined && id.includes(ID_SEPARATOR)) {
    issues.push({
      code: 'separator-in-identifier',
      field: `${where}.id`,
      message: `Knob id "${id}"${of} contains "${ID_SEPARATOR}", which joins the parts of a configuration identifier and so cannot appear inside one.`,
    })
  }

  const offending = (permittedValues(knob) ?? []).find((value) =>
    String(value).includes(ID_SEPARATOR),
  )
  if (offending !== undefined) {
    issues.push({
      code: 'separator-in-identifier',
      field: knob.kind === 'choice' ? `${where}.values` : where,
      message: `Knob ${id ?? index}${of} permits value ${JSON.stringify(offending)}, whose written form "${String(offending)}" contains "${ID_SEPARATOR}" — the character that joins the parts of a configuration identifier, so it cannot appear inside one.`,
    })
  }
}

function checkPayoffs(
  payoffs: unknown,
  categoryIds: readonly string[],
  actionIds: readonly string[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(payoffs)) {
    issues.push({
      code: 'malformed-field',
      field: 'payoffs',
      message: 'Field "payoffs" must be an object.',
    })
    return
  }
  for (const category of categoryIds) {
    const row = payoffs[category]
    for (const action of actionIds) {
      const cell = isRecord(row) ? row[action] : undefined
      if (typeof cell !== 'number' || !Number.isFinite(cell)) {
        issues.push({
          code: 'incomplete-payoff-table',
          field: `payoffs.${category}.${action}`,
          message: `Payoff table is missing a value for category "${category}" and action "${action}".`,
        })
      }
    }
  }
}

/**
 * The action a category is declared to call for must be that category's best-paying one.
 *
 * `categoryActions` says what is *correct* and `payoffs` says what is *paid*. When the two
 * disagree the task pays for a mistake: hill-climbing earnings stops agreeing with learning
 * the lesson, and the report labels as correct a cell the run pays less for. A tie counts as
 * a disagreement — an action paying exactly as much as the correct one makes the correct one
 * optional.
 *
 * Only rows `checkPayoffs` found complete are examined, so a missing cell is reported once as
 * a hole rather than a second time as a disagreement.
 */
function checkPayoffAgreement(
  payoffs: unknown,
  mapping: unknown,
  categoryIds: readonly string[],
  actionIds: readonly string[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(payoffs) || !isRecord(mapping)) return

  for (const category of categoryIds) {
    const row = payoffs[category]
    if (!isRecord(row)) continue

    const declared = mapping[category]
    if (typeof declared !== 'string' || !actionIds.includes(declared)) continue

    const paid = (action: string): number | undefined => {
      const cell = row[action]
      return typeof cell === 'number' && Number.isFinite(cell) ? cell : undefined
    }
    if (actionIds.some((action) => paid(action) === undefined)) continue

    const declaredValue = paid(declared) as number
    for (const action of actionIds) {
      if (action === declared) continue
      const value = paid(action) as number
      if (value < declaredValue) continue
      issues.push({
        code: 'payoff-contradicts-mapping',
        field: `payoffs.${category}.${action}`,
        message:
          `Category "${category}" is declared to call for action "${declared}", but action ` +
          `"${action}" pays ${value} against ${declaredValue} in that category's row. A ` +
          `category's declared action must pay strictly more than every other declared action.`,
      })
    }
  }
}

function checkPolicy(
  policy: unknown,
  categoryIds: readonly string[],
  actionIds: readonly string[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(policy) || !isNonEmptyString(policy.kind)) {
    issues.push({
      code: 'malformed-field',
      field: 'policy',
      message: 'Field "policy" must declare a "kind".',
    })
    return
  }
  if (!(POLICY_KINDS as readonly string[]).includes(policy.kind)) {
    issues.push({
      code: 'unknown-policy',
      field: 'policy.kind',
      message: `Unknown decision policy "${policy.kind}"; expected one of ${POLICY_KINDS.join(', ')}.`,
    })
    return
  }
  if (policy.kind !== 'threshold') return

  const thresholds = policy.thresholds
  if (!isRecord(thresholds)) {
    issues.push({
      code: 'malformed-field',
      field: 'policy.thresholds',
      message: 'Threshold policy must declare a threshold per category.',
    })
  } else {
    for (const category of categoryIds) {
      const value = thresholds[category]
      if (typeof value !== 'number' || value < 0 || value > 1) {
        issues.push({
          code: 'malformed-threshold',
          field: `policy.thresholds.${category}`,
          message: `Threshold policy needs a threshold between 0 and 1 for category "${category}".`,
        })
      }
    }
  }
  if (!isNonEmptyString(policy.fallbackAction) || !actionIds.includes(policy.fallbackAction)) {
    issues.push({
      code: 'malformed-field',
      field: 'policy.fallbackAction',
      message: 'Threshold policy must declare a fallbackAction that is one of the declared actions.',
    })
  }

  checkPriority(policy.priority, categoryIds, issues)
}

/**
 * The order that decides when several categories clear their thresholds at once.
 *
 * Required of every threshold task, not only of one declaring more than two actions: a
 * rule that changes shape with the action count is the hidden binary assumption over
 * again, one level up. Each defect names the category at fault, because "the priority
 * order is wrong" tells the author of a declaration nothing they can act on.
 */
function checkPriority(
  priority: unknown,
  categoryIds: readonly string[],
  issues: ValidationIssue[],
): void {
  if (!Array.isArray(priority)) {
    issues.push({
      code: 'malformed-priority',
      field: 'policy.priority',
      message:
        'Threshold policy must declare a priority order naming every declared category exactly once.',
    })
    return
  }

  const named: string[] = []
  priority.forEach((entry, index) => {
    if (typeof entry !== 'string' || !categoryIds.includes(entry)) {
      issues.push({
        code: 'malformed-priority',
        field: `policy.priority[${index}]`,
        message: `Threshold policy's priority order names ${JSON.stringify(entry)}, which is not a declared category.`,
      })
      return
    }
    if (named.includes(entry)) {
      issues.push({
        code: 'malformed-priority',
        field: `policy.priority[${index}]`,
        message: `Threshold policy's priority order names category "${entry}" more than once.`,
      })
      return
    }
    named.push(entry)
  })

  for (const category of categoryIds) {
    if (named.includes(category)) continue
    issues.push({
      code: 'malformed-priority',
      field: 'policy.priority',
      message: `Threshold policy's priority order does not name category "${category}".`,
    })
  }
}

function checkCategoryActions(
  mapping: unknown,
  categoryIds: readonly string[],
  actionIds: readonly string[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(mapping)) {
    issues.push({
      code: 'malformed-field',
      field: 'categoryActions',
      message: 'Field "categoryActions" must be an object keyed by category id.',
    })
    return
  }
  for (const category of categoryIds) {
    const action = mapping[category]
    if (action === undefined) {
      issues.push({
        code: 'unmapped-category',
        field: `categoryActions.${category}`,
        message: `Category "${category}" is not mapped to an action.`,
      })
    } else if (typeof action !== 'string' || !actionIds.includes(action)) {
      issues.push({
        code: 'unknown-action',
        field: `categoryActions.${category}`,
        message: `Category "${category}" maps to "${String(action)}", which is not a declared action.`,
      })
    }
  }
  for (const key of Object.keys(mapping)) {
    if (!categoryIds.includes(key)) {
      issues.push({
        code: 'unknown-category',
        field: `categoryActions.${key}`,
        message: `Field "categoryActions" maps "${key}", which is not a declared category.`,
      })
    }
  }
}

/**
 * Validates one family's knob list.
 *
 * Uniqueness is scoped to the family and not to the task, deliberately: an identifier is
 * composed from one family's knobs and resolved only against that family, so two families
 * declaring a knob called `depth` collide nowhere.
 */
function checkKnobs(knobs: unknown, scope: KnobScope, issues: ValidationIssue[]): void {
  if (!Array.isArray(knobs) || knobs.length === 0) {
    issues.push({
      code: 'malformed-field',
      field: scope.path,
      message: `Field "${scope.path}" must be a non-empty list.`,
    })
    return
  }
  const seen: string[] = []
  knobs.forEach((knob, index) => {
    const id = checkKnob(knob, index, scope, issues)
    if (id === undefined) return
    if (seen.includes(id)) {
      issues.push({
        code: 'duplicate-id',
        field: `${scope.path}[${index}].id`,
        message: `Family "${scope.family}" declares knob id "${id}" more than once.`,
      })
    }
    seen.push(id)
  })
}

/** Decimal places a step is written to, so a generated slider value reads as authored. */
function decimalsOf(step: number): number {
  const written = String(step)
  const point = written.indexOf('.')
  return point === -1 ? 0 : written.length - point - 1
}

/**
 * Every value a knob permits.
 *
 * A choice knob lists them. A slider's are generated from its min, max and step, rounded
 * to the step's own precision so that a generated value matches the one a range control
 * hands back: three additions of 0.1 do not make 0.3, and a mapping keyed by the numbers
 * an author wrote would otherwise miss.
 *
 * Returns nothing for a knob whose own declaration is malformed. Its issues are the
 * cause and `checkKnob` has already reported them.
 */
function permittedValues(knob: Record<string, unknown>): (string | number)[] | undefined {
  if (knob.kind === 'choice') {
    return Array.isArray(knob.values) ? (knob.values as (string | number)[]) : undefined
  }
  if (knob.kind === 'slider') {
    const { min, max, step } = knob
    if (typeof min !== 'number' || typeof max !== 'number' || typeof step !== 'number') {
      return undefined
    }
    if (max <= min || step <= 0) return undefined
    const places = decimalsOf(step)
    const values: number[] = []
    for (let index = 0; min + index * step <= max + 1e-9; index += 1) {
      values.push(Number((min + index * step).toFixed(places)))
    }
    return values
  }
  return undefined
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Validates a task's optional architecture diagram against its own knobs.
 *
 * Every check here exists to make a hole in the drawing impossible rather than merely
 * unlikely. A width value with no drawn count would render a layer of nothing, and a
 * depth knob permitting 2.5 would ask for half a layer. Both refuse at load, where the
 * author of a declaration can see them, rather than at render time in front of a student.
 *
 * The block is discriminated by kind, and each kind is checked against its own required
 * fields only: a field the fully-connected kind needs is not asked of a convolutional
 * declaration, and vice versa. An unrecognised kind stops there rather than being
 * measured against a shape it never claimed to have.
 */
function checkDiagram(
  diagram: unknown,
  scope: KnobScope,
  knobs: readonly Record<string, unknown>[],
  issues: ValidationIssue[],
): void {
  const at = `${scope.path.slice(0, scope.path.lastIndexOf('.'))}.diagram`
  const of = ` of family "${scope.family}"`
  if (!isRecord(diagram)) {
    issues.push({
      code: 'malformed-field',
      field: at,
      message: `Field "${at}" must be an object.`,
    })
    return
  }

  const kind = diagram.kind
  if (kind === undefined || kind === null) {
    issues.push({
      code: 'missing-field',
      field: `${at}.kind`,
      message: `Task declaration is missing required field "${at}.kind".`,
    })
    return
  }
  if (!DIAGRAM_KINDS.includes(kind as never)) {
    issues.push({
      code: 'unknown-diagram-kind',
      field: `${at}.kind`,
      message: `Field "${at}.kind"${of} declares unknown kind ${JSON.stringify(kind)}; expected ${DIAGRAM_KINDS.map((known) => `"${known}"`).join(', ')}.`,
    })
    return
  }

  const drawn: DiagramScope = { at, of, knobs, family: scope.family }
  if (kind === 'feedforward') checkFeedforwardDiagram(diagram, drawn, issues)
  else if (kind === 'cnn') checkCnnDiagram(diagram, drawn, issues)
  else checkTreeDiagram(diagram, drawn, issues)
}

/**
 * Refuses a tree drawing that cannot name its own budget.
 *
 * There is almost nothing to check, and that is the kind's whole character: what a tree
 * looks like is in the shipped model rather than in the declaration, so the only thing
 * declared is which knob the budget is, and the only thing it is used for is that knob's
 * label. The budget has to be a whole count of questions all the same — half a question
 * is not one, and the drawing sizes itself on the number.
 */
function checkTreeDiagram(
  diagram: Record<string, unknown>,
  scope: DiagramScope,
  issues: ValidationIssue[],
): void {
  requireDiagramFields(diagram, ['nodesKnob'], scope, issues)
  const knob = diagramKnob(diagram, 'nodesKnob', scope, issues)
  if (knob === undefined) return
  wholeCountsOf(knob, 'nodesKnob', 'questions', scope, issues)
}

/**
 * Where a diagram lives, whose it is, and the knobs it may name.
 *
 * `knobs` is that family's own knob list rather than the task's: a diagram naming a knob
 * a *different* family declares is refused, because each family's drawing has to be
 * resolvable from that family's declaration and knob values alone.
 */
interface DiagramScope {
  /** Field path of the diagram block, e.g. `families[0].diagram`. */
  readonly at: string
  /** ` of family "x"`, appended to a message that names a knob. */
  readonly of: string
  readonly knobs: readonly Record<string, unknown>[]
  readonly family: string
}

/** Reports the fields a diagram of some kind must carry and does not. */
function requireDiagramFields(
  diagram: Record<string, unknown>,
  fields: readonly string[],
  scope: DiagramScope,
  issues: ValidationIssue[],
): void {
  for (const field of fields) {
    if (diagram[field] === undefined || diagram[field] === null) {
      issues.push({
        code: 'missing-field',
        field: `${scope.at}.${field}`,
        message: `Task declaration is missing required field "${scope.at}.${field}".`,
      })
    }
  }
}

/**
 * The knob a diagram field names, reporting one the task does not declare.
 *
 * Shared by both kinds: which field holds the name differs, the rule does not.
 */
function diagramKnob(
  diagram: Record<string, unknown>,
  field: string,
  scope: DiagramScope,
  issues: ValidationIssue[],
): Record<string, unknown> | undefined {
  const id = diagram[field]
  if (id === undefined) return undefined
  const knob = scope.knobs.find((candidate) => candidate.id === id)
  if (knob === undefined) {
    issues.push({
      code: 'unknown-knob',
      field: `${scope.at}.${field}`,
      message: `Field "${scope.at}.${field}" names knob ${JSON.stringify(id)}, which family "${scope.family}" does not declare.`,
    })
  }
  return knob
}

/**
 * Every value the knob setting a depth permits, as whole counts.
 *
 * Returns the counts when they are all whole and at least one, and reports each value
 * that is not. A knob permitting 2.5 asks for half a layer or half a block.
 */
function wholeCountsOf(
  knob: Record<string, unknown>,
  field: string,
  noun: string,
  scope: DiagramScope,
  issues: ValidationIssue[],
): number[] {
  const counts: number[] = []
  let usable = true
  for (const value of permittedValues(knob) ?? []) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      usable = false
      issues.push({
        code: 'malformed-diagram',
        field: `${scope.at}.${field}`,
        message: `Knob "${String(knob.id)}"${scope.of} sets the number of ${noun} but permits ${JSON.stringify(value)}, which is not a whole number of ${noun}.`,
      })
      continue
    }
    counts.push(value)
  }
  return usable ? counts : []
}

/**
 * The drawn-count map of a diagram, checked for coverage of its knob's values.
 *
 * Both kinds declare one: the fully-connected kind draws units per layer, the
 * convolutional kind draws a channel depth. The rule is the same in both — every value
 * the knob permits has a positive whole count, and nothing is drawn for a value the knob
 * does not permit.
 */
function checkDrawnCounts(
  diagram: Record<string, unknown>,
  field: string,
  knob: Record<string, unknown> | undefined,
  noun: string,
  scope: DiagramScope,
  issues: ValidationIssue[],
): void {
  const shown = diagram[field]
  if (!isRecord(shown)) {
    if (shown !== undefined) {
      issues.push({
        code: 'malformed-field',
        field: `${scope.at}.${field}`,
        message: `Field "${scope.at}.${field}" must be an object keyed by the values its knob permits.`,
      })
    }
    return
  }

  for (const [value, count] of Object.entries(shown)) {
    if (!isPositiveInteger(count)) {
      issues.push({
        code: 'malformed-diagram',
        field: `${scope.at}.${field}.${value}`,
        message: `Field "${scope.at}.${field}" draws ${JSON.stringify(count)} ${noun} for value "${value}"; a drawn count must be a positive whole number.`,
      })
    }
  }

  if (knob === undefined) return
  for (const value of permittedValues(knob) ?? []) {
    if (shown[String(value)] === undefined) {
      issues.push({
        code: 'unmapped-knob-value',
        field: `${scope.at}.${field}`,
        message: `Knob "${String(knob.id)}"${scope.of} permits value ${JSON.stringify(value)}, which "${scope.at}.${field}" gives no drawn count for.`,
      })
    }
  }
}

/** The fields only a fully-connected diagram carries. */
const FEEDFORWARD_DIAGRAM_FIELDS = ['layersKnob', 'unitsKnob', 'unitsShown', 'inputsShown'] as const

function checkFeedforwardDiagram(
  diagram: Record<string, unknown>,
  scope: DiagramScope,
  issues: ValidationIssue[],
): void {
  requireDiagramFields(diagram, FEEDFORWARD_DIAGRAM_FIELDS, scope, issues)

  if (diagram.inputsShown !== undefined && !isPositiveInteger(diagram.inputsShown)) {
    issues.push({
      code: 'malformed-diagram',
      field: `${scope.at}.inputsShown`,
      message: `Field "${scope.at}.inputsShown" must be a positive whole number; found ${JSON.stringify(diagram.inputsShown)}.`,
    })
  }

  const layersKnob = diagramKnob(diagram, 'layersKnob', scope, issues)
  const unitsKnob = diagramKnob(diagram, 'unitsKnob', scope, issues)

  if (layersKnob !== undefined) wholeCountsOf(layersKnob, 'layersKnob', 'layers', scope, issues)
  checkDrawnCounts(diagram, 'unitsShown', unitsKnob, 'units', scope, issues)
}

/** The fields only a convolutional diagram carries. */
const CNN_DIAGRAM_FIELDS = ['blocksKnob', 'channelsKnob', 'inputSize', 'channelsShown'] as const

/**
 * Validates a convolutional diagram, including the bound the input resolution puts on
 * the block count.
 *
 * The bound is the check with no counterpart in the fully-connected kind. Hidden layers
 * can be stacked without limit; convolutional blocks cannot, because each one halves the
 * feature map and a stack deep enough to pool it away describes a model that cannot be
 * built. Refusing at load names the resolution, the count and the knob, so an author
 * raising the block count sees why rather than getting a drawing of an impossible stack.
 */
function checkCnnDiagram(
  diagram: Record<string, unknown>,
  scope: DiagramScope,
  issues: ValidationIssue[],
): void {
  requireDiagramFields(diagram, CNN_DIAGRAM_FIELDS, scope, issues)

  const inputSize = diagram.inputSize
  const sizeUsable = isPositiveInteger(inputSize)
  if (inputSize !== undefined && !sizeUsable) {
    issues.push({
      code: 'malformed-diagram',
      field: `${scope.at}.inputSize`,
      message: `Field "${scope.at}.inputSize" must be a positive whole number of pixels; found ${JSON.stringify(inputSize)}.`,
    })
  }

  const blocksKnob = diagramKnob(diagram, 'blocksKnob', scope, issues)
  const channelsKnob = diagramKnob(diagram, 'channelsKnob', scope, issues)

  if (blocksKnob !== undefined) {
    const counts = wholeCountsOf(blocksKnob, 'blocksKnob', 'blocks', scope, issues)
    if (sizeUsable) {
      for (const blocks of counts) {
        if (blockSizes(inputSize as number, blocks) === undefined) {
          issues.push({
            code: 'unbuildable-block-count',
            field: `${scope.at}.blocksKnob`,
            message: `Knob "${String(blocksKnob.id)}"${scope.of} permits ${blocks} convolutional blocks, which pools a ${String(inputSize)}px input below a single spatial position.`,
          })
        }
      }
    }
  }

  // A convolutional task's channels knob differs from a fully-connected task's width
  // knob: its value is the base channel count itself, not a label mapped to a drawn one,
  // because the true channel counts are stated on screen. "wide" is not a channel count
  // the architecture can be built at, so it is refused here rather than resolving to
  // nothing at render time.
  if (channelsKnob !== undefined) {
    wholeCountsOf(channelsKnob, 'channelsKnob', 'channels', scope, issues)
  }

  checkDrawnCounts(diagram, 'channelsShown', channelsKnob, 'channels', scope, issues)
}

/**
 * The knob declarations, when every one of them is well formed enough to be referred to.
 *
 * The diagram checks need each knob's id and the values it permits. When a knob is
 * missing either, its own issues are the cause, and a diagram issue on top of them would
 * report the same problem twice.
 */
function referrableKnobs(knobs: unknown): readonly Record<string, unknown>[] | undefined {
  if (!Array.isArray(knobs) || knobs.length === 0) return undefined
  const usable: Record<string, unknown>[] = []
  for (const knob of knobs) {
    if (!isRecord(knob) || !isNonEmptyString(knob.id)) return undefined
    if (permittedValues(knob) === undefined) return undefined
    usable.push(knob)
  }
  return usable
}

/**
 * Validates what a task declares about doing its job by hand.
 *
 * One value, and one value that cannot work is refused by name rather than clamped: a
 * time cap of zero or less would make the measured rate either infinite or negative,
 * which is worse than no rate at all.
 *
 * Nothing declares how many images one person may be shown any more, and a declaration
 * still carrying the field it used to is refused rather than ignored. A number left in a
 * file that nothing reads is the worst of both: an author would go on believing it bounds
 * the sort, and the only place that belief could be corrected is a screen that offers the
 * whole crop regardless.
 */
function checkHandSorting(handSorting: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(handSorting)) {
    issues.push({
      code: 'malformed-field',
      field: 'handSorting',
      message: 'Field "handSorting" must be an object.',
    })
    return
  }

  if (handSorting.perHarvest !== undefined) {
    issues.push({
      code: 'unknown-field',
      field: 'handSorting.perHarvest',
      message:
        'Field "handSorting.perHarvest" is no longer read: hand sorting offers the whole crop, the student decides when to stop, and what bounds it is how many distinct photographs the evaluation split holds. Remove it.',
    })
  }

  const secondsPerImage = handSorting.secondsPerImage
  if (
    typeof secondsPerImage !== 'number' ||
    !Number.isFinite(secondsPerImage) ||
    secondsPerImage <= 0
  ) {
    issues.push({
      code: 'malformed-field',
      field: 'handSorting.secondsPerImage',
      message: `Field "handSorting.secondsPerImage" must be a finite number of seconds greater than zero; found ${JSON.stringify(secondsPerImage)}.`,
    })
  }
}

/** Every field a declared feature must carry before a student can pick a threshold on it. */
export const REQUIRED_FEATURE_FIELDS = [
  'id',
  'label',
  'unit',
  'range',
  'contaminatedBy',
  'help',
] as const

/**
 * Validates the declared feature list.
 *
 * `specs/measured-features/spec.md` — a feature missing any of its fields is refused
 * naming it and the field, because a screen renders the list from this and a student
 * sets a threshold by hand on what it says. The contamination list is required and
 * required to be non-empty: a feature that names no contaminating attribute is claiming
 * to be a clean read of one, which is an attribute under another name.
 *
 * Which attributes exist, and whether the named ones actually move the feature, are both
 * questions about the pool rather than about this file. The names are checked against the
 * manifest in `src/pool`, and the movement against the measured values in
 * `test/features-pool.test.ts`. This function refuses what can be seen from the
 * declaration alone.
 */
function checkFeatures(features: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(features)) {
    issues.push({
      code: 'malformed-field',
      field: 'features',
      message: 'Field "features" must be a list.',
    })
    return
  }
  if (features.length === 0) {
    issues.push({
      code: 'empty-field',
      field: 'features',
      message: 'Field "features" declares no features, so nothing can be measured or shown.',
    })
    return
  }

  const seen = new Set<string>()
  features.forEach((feature, index) => {
    const where = `features[${index}]`
    if (!isRecord(feature)) {
      issues.push({ code: 'malformed-entry', field: where, message: `${where} must be an object.` })
      return
    }
    const name = isNonEmptyString(feature.id) ? `"${feature.id}"` : where

    for (const field of REQUIRED_FEATURE_FIELDS) {
      if (feature[field] === undefined || feature[field] === null) {
        issues.push({
          code: 'missing-field',
          field: `${where}.${field}`,
          message: `Feature ${name} declares no ${field}.`,
        })
      }
    }

    for (const field of ['id', 'label', 'unit', 'help'] as const) {
      if (feature[field] !== undefined && !isNonEmptyString(feature[field])) {
        issues.push({
          code: 'malformed-field',
          field: `${where}.${field}`,
          message: `Feature ${name} declares a ${field} that is not a non-empty string.`,
        })
      }
    }

    if (isNonEmptyString(feature.id)) {
      if (seen.has(feature.id)) {
        issues.push({
          code: 'duplicate-id',
          field: `${where}.id`,
          message: `Feature "${feature.id}" is declared more than once.`,
        })
      }
      seen.add(feature.id)
    }

    if (feature.range !== undefined) {
      const range = feature.range
      if (
        !isRecord(range) ||
        typeof range.min !== 'number' ||
        typeof range.max !== 'number' ||
        !Number.isFinite(range.min) ||
        !Number.isFinite(range.max)
      ) {
        issues.push({
          code: 'malformed-field',
          field: `${where}.range`,
          message: `Feature ${name} declares a range that is not two finite numbers.`,
        })
      } else if (range.min >= range.max) {
        // A range that does not span anything would let a constant feature ship with a
        // declared range that happened to contain it.
        issues.push({
          code: 'empty-range',
          field: `${where}.range`,
          message: `Feature ${name} declares the range ${range.min}..${range.max}, which spans nothing.`,
        })
      }
    }

    if (feature.contaminatedBy !== undefined) {
      const contaminants = feature.contaminatedBy
      if (!Array.isArray(contaminants)) {
        issues.push({
          code: 'malformed-field',
          field: `${where}.contaminatedBy`,
          message: `Feature ${name} declares a contaminatedBy that is not a list.`,
        })
      } else if (contaminants.length === 0) {
        issues.push({
          code: 'no-contamination-declared',
          field: `${where}.contaminatedBy`,
          message: `Feature ${name} names no contaminating attribute. A feature that recovers one attribute cleanly is that attribute under a different name.`,
        })
      } else {
        for (const attribute of contaminants) {
          if (!isNonEmptyString(attribute)) {
            issues.push({
              code: 'malformed-field',
              field: `${where}.contaminatedBy`,
              message: `Feature ${name} names a contaminant that is not a non-empty string.`,
            })
          }
        }
      }
    }
  })
}

/**
 * Validates the declared ceiling on hand-written rules.
 *
 * Required rather than optional: the ladder guard is checked at this number, and a task
 * that declares none has no budget for the guard to be meaningful at.
 */
function checkRuleBudget(ruleBudget: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(ruleBudget)) {
    issues.push({
      code: 'malformed-field',
      field: 'ruleBudget',
      message: 'Field "ruleBudget" must be an object.',
    })
    return
  }
  if (!isPositiveInteger(ruleBudget.maxNodes)) {
    issues.push({
      code: 'malformed-field',
      field: 'ruleBudget.maxNodes',
      message: `Field "ruleBudget.maxNodes" must be a whole number of decision nodes, one or more; found ${JSON.stringify(ruleBudget.maxNodes)}.`,
    })
  }
}

/** Every field a declared delivery term must carry. */
export const REQUIRED_DELIVERY_FIELDS = [
  'measures',
  'delivering',
  'tolerance',
  'warnAbove',
  'downgradedValue',
] as const

/**
 * Validates a declared delivery term against the categories and actions the task declares.
 *
 * Four refusals, and each is about a term that would be a fine wearing a threshold's
 * clothes.
 *
 * A term naming a category or an action the task does not declare measures something
 * nothing can produce, so the share it reports is meaningless rather than merely wrong.
 *
 * A term whose delivering actions are every declared action has a denominator that is the
 * whole crop, and no decision available to a student can move an image out of it. There
 * is then no way to escape the term by working well, which is a flat fine on the whole
 * batch and is what a payoff entry is already for.
 *
 * A term measuring only categories whose declared action is itself a delivering one
 * prices correct work: doing the task perfectly maximises the measured share, so the
 * lesson runs backwards.
 *
 * A tolerance of zero downgrades a faultless delivery, and a warning at or above the
 * tolerance is never seen before the downgrade it exists to precede. Both are values that
 * can only have been a mistake, so both are named rather than clamped.
 */
function checkDelivery(
  delivery: unknown,
  mapping: unknown,
  categoryIds: readonly string[],
  actionIds: readonly string[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(delivery)) {
    issues.push({
      code: 'malformed-field',
      field: 'delivery',
      message: 'Field "delivery" must be an object declaring the term the batch is priced by.',
    })
    return
  }

  for (const field of REQUIRED_DELIVERY_FIELDS) {
    if (delivery[field] === undefined || delivery[field] === null) {
      issues.push({
        code: 'missing-field',
        field: `delivery.${field}`,
        message: `A declared delivery term is missing required field "delivery.${field}".`,
      })
    }
  }

  const named = (
    field: 'measures' | 'delivering',
    declared: readonly string[],
    what: string,
    code: string,
  ): string[] | undefined => {
    const value = delivery[field]
    if (value === undefined || value === null) return undefined
    if (!Array.isArray(value) || value.some((entry) => !isNonEmptyString(entry))) {
      issues.push({
        code: 'malformed-field',
        field: `delivery.${field}`,
        message: `Field "delivery.${field}" must be a list of declared ${what} ids.`,
      })
      return undefined
    }
    if (value.length === 0) {
      issues.push({
        code: 'too-few',
        field: `delivery.${field}`,
        message: `Field "delivery.${field}" names no ${what}, so the term measures nothing.`,
      })
      return undefined
    }
    const ids = value as string[]
    let sound = true
    for (const id of ids) {
      if (declared.includes(id)) continue
      sound = false
      issues.push({
        code,
        field: `delivery.${field}`,
        message: `The delivery term names ${what} "${id}", which this task does not declare.`,
      })
    }
    return sound ? ids : undefined
  }

  const measures = named('measures', categoryIds, 'category', 'unknown-category')
  const delivering = named('delivering', actionIds, 'action', 'unknown-action')

  if (delivering !== undefined && actionIds.length > 0) {
    const outside = actionIds.filter((action) => !delivering.includes(action))
    if (outside.length === 0) {
      issues.push({
        code: 'delivery-has-no-way-out',
        field: 'delivery.delivering',
        message:
          `The delivery term names every declared action — ${delivering.join(', ')} — as ` +
          'delivering, so the share it measures is over the whole crop and no decision can ' +
          'escape it. That is a fine rather than a threshold.',
      })
    }
  }

  if (measures !== undefined && delivering !== undefined && isRecord(mapping)) {
    const priced = measures.filter((category) => {
      const called = mapping[category]
      return typeof called === 'string' && !delivering.includes(called)
    })
    if (priced.length === 0) {
      issues.push({
        code: 'delivery-prices-correct-work',
        field: 'delivery.measures',
        message:
          `Every category the delivery term measures — ${measures.join(', ')} — is declared ` +
          'to call for a delivering action, so the term prices correct work rather than a ' +
          'mistake. At least one measured category must call for an action outside the ' +
          'delivering ones.',
      })
    }
  }

  const tolerance = delivery.tolerance
  const toleranceUsable =
    typeof tolerance === 'number' && Number.isFinite(tolerance) && tolerance > 0
  if (tolerance !== undefined && tolerance !== null && !toleranceUsable) {
    issues.push({
      code: 'delivery-tolerance-unusable',
      field: 'delivery.tolerance',
      message: `Field "delivery.tolerance" must be a share greater than zero; found ${JSON.stringify(tolerance)}. A tolerance of zero downgrades a faultless delivery.`,
    })
  }

  const warnAbove = delivery.warnAbove
  if (warnAbove !== undefined && warnAbove !== null) {
    const usable = typeof warnAbove === 'number' && Number.isFinite(warnAbove) && warnAbove > 0
    if (!usable) {
      issues.push({
        code: 'delivery-warning-unusable',
        field: 'delivery.warnAbove',
        message: `Field "delivery.warnAbove" must be a share greater than zero; found ${JSON.stringify(warnAbove)}.`,
      })
    } else if (toleranceUsable && warnAbove >= (tolerance as number)) {
      issues.push({
        code: 'delivery-warning-unusable',
        field: 'delivery.warnAbove',
        message: `Field "delivery.warnAbove" is ${warnAbove} against a tolerance of ${String(tolerance)}, so the warning would never be seen before the downgrade it exists to precede. It must be strictly below the tolerance.`,
      })
    }
  }

  const downgraded = delivery.downgradedValue
  if (
    downgraded !== undefined &&
    downgraded !== null &&
    (typeof downgraded !== 'number' || !Number.isFinite(downgraded))
  ) {
    issues.push({
      code: 'malformed-field',
      field: 'delivery.downgradedValue',
      message: `Field "delivery.downgradedValue" must be a finite amount; found ${JSON.stringify(downgraded)}.`,
    })
  }
}

function checkTeaching(teaching: unknown, at: string, issues: ValidationIssue[]): void {
  if (!isRecord(teaching)) {
    issues.push({
      code: 'malformed-field',
      field: at,
      message: `Field "${at}" must be an object.`,
    })
    return
  }
  for (const field of ['summary', 'theory'] as const) {
    if (!isNonEmptyString(teaching[field])) {
      issues.push({
        code: 'missing-field',
        field: `${at}.${field}`,
        message: `Task declaration is missing required field "${at}.${field}".`,
      })
    }
  }
}

/** Every field a dataset tier must carry in order to be offered or explained. */
export const REQUIRED_DATASET_FIELDS = [
  'id',
  'label',
  'size',
  'composition',
  'labelQuality',
  'disclosure',
] as const

/**
 * Validates the dataset tiers a task declares, returning their ids smallest first.
 *
 * `specs/dataset-tiers/spec.md` — the ordering is load-bearing rather than cosmetic. Every
 * family's dataset knob must default to *the smallest tier*, and a screen naming "the
 * larger set" has to have exactly one of them to mean, so tiers are required in ascending
 * order of size with no two the same size. Two tiers of 1 000 photos would leave both
 * phrases ambiguous and nothing able to say which was meant.
 *
 * Label quality is checked as a declared value and never derived. A tier the pool holds no
 * images for is entirely legitimate — it is how a tier is shown and explained before it is
 * authored — so there is no image here to infer anything from.
 */
function checkDatasets(
  datasets: unknown,
  categoryIds: readonly string[],
  issues: ValidationIssue[],
): readonly string[] {
  if (!Array.isArray(datasets) || datasets.length === 0) {
    issues.push({
      code: 'no-datasets',
      field: 'datasets',
      message:
        'Field "datasets" must declare at least one dataset tier; a task with none offers no photographs for a model to be fitted on.',
    })
    return []
  }

  const ids: string[] = []
  const sizes: (number | undefined)[] = []

  datasets.forEach((tier, index) => {
    const where = `datasets[${index}]`
    if (!isRecord(tier)) {
      issues.push({
        code: 'malformed-dataset',
        field: where,
        message: `Dataset tier ${index} must be an object.`,
      })
      sizes.push(undefined)
      return
    }

    const named = isNonEmptyString(tier.id) ? tier.id : String(index)
    for (const field of REQUIRED_DATASET_FIELDS) {
      if (tier[field] === undefined || tier[field] === null) {
        issues.push({
          code: 'missing-field',
          field: `${where}.${field}`,
          message: `Dataset tier "${named}" is missing required field "${field}".`,
        })
      }
    }

    for (const field of ['id', 'label', 'disclosure'] as const) {
      if (tier[field] !== undefined && !isNonEmptyString(tier[field])) {
        issues.push({
          code: 'malformed-field',
          field: `${where}.${field}`,
          message: `Field "${where}.${field}" must be a non-empty string.`,
        })
      }
    }

    if (isNonEmptyString(tier.id)) {
      if (ids.includes(tier.id)) {
        issues.push({
          code: 'duplicate-id',
          field: `${where}.id`,
          message: `Field "datasets" declares id "${tier.id}" more than once.`,
        })
      } else {
        ids.push(tier.id)
      }
      // A tier id ends up inside a configuration identifier, through the value of the
      // knob that selects it, so it is held to the same separator rule every knob value is.
      if (tier.id.includes(ID_SEPARATOR)) {
        issues.push({
          code: 'separator-in-id',
          field: `${where}.id`,
          message: `Dataset tier "${tier.id}" contains "${ID_SEPARATOR}", which separates the parts of a configuration identifier and so cannot appear inside one.`,
        })
      }
    }

    if (tier.labelQuality !== undefined && !LABEL_QUALITIES.includes(tier.labelQuality as never)) {
      issues.push({
        code: 'unknown-label-quality',
        field: `${where}.labelQuality`,
        message: `Dataset tier "${named}" declares label quality ${JSON.stringify(tier.labelQuality)}; the declared qualities are ${LABEL_QUALITIES.map((quality) => `"${quality}"`).join(' and ')}.`,
      })
    }

    const size = tier.size
    if (size !== undefined && !isPositiveInteger(size)) {
      issues.push({
        code: 'malformed-field',
        field: `${where}.size`,
        message: `Dataset tier "${named}" declares a size of ${JSON.stringify(size)}; it must be a whole number of photographs above zero.`,
      })
      sizes.push(undefined)
    } else {
      sizes.push(size as number | undefined)
    }

    if (tier.composition !== undefined) {
      checkComposition(tier.composition, named, where, size, categoryIds, issues)
    }
  })

  // Ascending and distinct, checked against the tier before rather than by sorting: the
  // declared order is what a screen presents and what "the smallest tier" reads off, so a
  // declaration whose order disagrees with its sizes is refused rather than reordered.
  for (let index = 1; index < sizes.length; index += 1) {
    const previous = sizes[index - 1]
    const size = sizes[index]
    if (previous === undefined || size === undefined) continue
    if (size > previous) continue
    const before = (datasets[index - 1] as Record<string, unknown>).id
    const here = (datasets[index] as Record<string, unknown>).id
    issues.push({
      code: 'datasets-out-of-order',
      field: `datasets[${index}].size`,
      message: `Dataset tier "${String(here)}" declares ${size} photographs, which does not exceed the ${previous} of "${String(before)}" declared before it; tiers must be declared in ascending order of size and no two may share a size.`,
    })
  }

  return ids
}

/**
 * Checks one tier's composition against the categories the task declares.
 *
 * A count per declared category and no others, summing to the declared size. Both halves
 * are refusals rather than repairs: a composition that names a category the task does not
 * declare came from a different task's vocabulary, and one that does not add up to its
 * size leaves two declared figures for the same set of photographs with nothing able to
 * say which is right.
 */
function checkComposition(
  composition: unknown,
  named: string,
  where: string,
  size: unknown,
  categoryIds: readonly string[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(composition)) {
    issues.push({
      code: 'malformed-field',
      field: `${where}.composition`,
      message: `Field "${where}.composition" must be an object of counts keyed by category.`,
    })
    return
  }

  let total = 0
  let complete = true
  for (const category of categoryIds) {
    const count = composition[category]
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      issues.push({
        code: 'malformed-composition',
        field: `${where}.composition.${category}`,
        message: `Dataset tier "${named}" declares ${JSON.stringify(count)} photographs of category "${category}"; it must declare a whole count of every declared category.`,
      })
      complete = false
      continue
    }
    total += count
  }

  for (const category of Object.keys(composition)) {
    if (categoryIds.includes(category)) continue
    issues.push({
      code: 'unknown-category',
      field: `${where}.composition.${category}`,
      message: `Dataset tier "${named}" declares a count for category "${category}", which the task does not declare.`,
    })
    complete = false
  }

  if (complete && typeof size === 'number' && total !== size) {
    issues.push({
      code: 'composition-mismatch',
      field: `${where}.composition`,
      message: `Dataset tier "${named}" declares ${size} photographs but a composition of ${total}.`,
    })
  }
}

/** Every field a model family must carry in order to be offered. */
export const REQUIRED_FAMILY_FIELDS = [
  'id',
  'label',
  'ships',
  'knobs',
  'datasetKnob',
  'teaching',
  'slot',
] as const

/**
 * Validates one declared model family.
 *
 * Everything a family owns is checked against that family and nothing wider: its knob ids
 * are unique within it rather than across the task, its separator refusals name it, and
 * its diagram may only name knobs it declares itself. That scoping is the whole point of
 * the family being a declared entity — two rungs of one ladder share a job, not a model.
 */
function checkFamily(
  family: unknown,
  index: number,
  kinds: TutorialKinds,
  declared: TaskDeclaration,
  datasetIds: readonly string[],
  issues: ValidationIssue[],
): string | undefined {
  const where = `families[${index}]`
  if (!isRecord(family)) {
    issues.push({
      code: 'malformed-family',
      field: where,
      message: `Model family ${index} must be an object.`,
    })
    return undefined
  }

  const id = isNonEmptyString(family.id) ? family.id : undefined
  const named = id ?? String(index)

  for (const field of REQUIRED_FAMILY_FIELDS) {
    if (family[field] === undefined || family[field] === null) {
      issues.push({
        code: 'missing-field',
        field: `${where}.${field}`,
        message: `Model family "${named}" is missing required field "${field}".`,
      })
    }
  }

  for (const field of ['id', 'label'] as const) {
    if (family[field] !== undefined && !isNonEmptyString(family[field])) {
      issues.push({
        code: 'malformed-field',
        field: `${where}.${field}`,
        message: `Field "${where}.${field}" must be a non-empty string.`,
      })
    }
  }

  checkShips(family, named, where, issues)
  checkSlot(family.slot, named, where, issues)
  if (family.teaching !== undefined) checkTeaching(family.teaching, `${where}.teaching`, issues)
  checkHistory(family.history, named, where, issues)
  checkTutorial(family.tutorial, named, where, kinds, declared, issues)

  // Refused where a declaration written against the wrong half of the split would put
  // them, naming where they belong: the photographs describe the job, so they are the
  // task's, and every family of one task is fitted on the same declared tiers.
  for (const field of BELONGS_TO_TASK) {
    if (family[field] === undefined) continue
    issues.push({
      code: 'belongs-to-task',
      field: `${where}.${field}`,
      message: `Model family "${named}" declares "${field}", which belongs to the task rather than to a family: the photographs describe the job and are the same photographs whatever is fitted to them. A family declares only which of its knobs selects one, in "datasetKnob".`,
    })
  }

  const scope: KnobScope = {
    path: `${where}.knobs`,
    family: named,
    ...(isNonEmptyString(family.datasetKnob) ? { datasetKnob: family.datasetKnob } : {}),
  }
  if (family.knobs !== undefined) checkKnobs(family.knobs, scope, issues)
  checkDatasetKnob(family, named, where, datasetIds, issues)

  // Optional, so absence is not an issue. Checked only against knobs sound enough to
  // refer to; otherwise the knob issues already name the cause.
  if (family.diagram !== undefined) {
    const referrable = referrableKnobs(family.knobs)
    if (referrable !== undefined) checkDiagram(family.diagram, scope, referrable, issues)
  }

  return id
}

/**
 * Refuses a family whose dataset knob cannot select a tier the task declares.
 *
 * `specs/dataset-tiers/spec.md` — the knob must be an enumerated choice, every one of its
 * values must be a declared tier id, and its default must be the task's smallest tier. The
 * default is held to the smallest rather than to any tier because that is the one that
 * comes with the robot: a family opening on a tier a student has not bought would present
 * a configuration nothing has been fitted for, and progress that records no value falls to
 * the declared default.
 *
 * A slider is refused outright. Tier ids are names, so "every value between" means nothing
 * and a slider would let a student select a set that does not exist.
 */
function checkDatasetKnob(
  family: Record<string, unknown>,
  named: string,
  where: string,
  datasetIds: readonly string[],
  issues: ValidationIssue[],
): void {
  const knobId = family.datasetKnob
  if (knobId === undefined || knobId === null) return
  if (!isNonEmptyString(knobId)) {
    issues.push({
      code: 'malformed-field',
      field: `${where}.datasetKnob`,
      message: `Field "${where}.datasetKnob" must be a non-empty string.`,
    })
    return
  }

  const knobs = referrableKnobs(family.knobs)
  // Knobs unsound enough to refer to already name their own cause; naming this one too
  // would report the same defect twice under two codes.
  if (knobs === undefined) return

  const knob = knobs.find((candidate) => candidate.id === knobId)
  if (knob === undefined) {
    issues.push({
      code: 'unknown-dataset-knob',
      field: `${where}.datasetKnob`,
      message: `Model family "${named}" selects its photographs with knob "${knobId}", which it does not declare.`,
    })
    return
  }

  if (knob.kind !== 'choice' || !Array.isArray(knob.values)) {
    issues.push({
      code: 'dataset-knob-not-a-choice',
      field: `${where}.datasetKnob`,
      message: `Model family "${named}" selects its photographs with knob "${knobId}", which offers a range rather than a fixed set of choices; a dataset is named, so there is nothing between two of them to select.`,
    })
    return
  }

  // Nothing to hold the values to when the task's tiers were themselves refused; those
  // issues name the cause.
  if (datasetIds.length === 0) return

  for (const value of knob.values) {
    if (datasetIds.includes(String(value))) continue
    issues.push({
      code: 'unknown-dataset-tier',
      field: `${where}.datasetKnob`,
      message: `Knob "${knobId}" of model family "${named}" permits ${JSON.stringify(value)}, which is the id of no dataset tier the task declares.`,
    })
  }

  const smallest = datasetIds[0]
  if (knob.default !== undefined && String(knob.default) !== smallest) {
    issues.push({
      code: 'dataset-knob-default',
      field: `${where}.datasetKnob`,
      message: `Knob "${knobId}" of model family "${named}" defaults to ${JSON.stringify(knob.default)}, but a dataset knob must default to the task's smallest tier, which is "${String(smallest)}".`,
    })
  }
}

/**
 * Refuses a family that does not say what it ships, or says something unsupported.
 *
 * Declared rather than inferred from the family's id, its knobs, its architecture or
 * whether an artifact happens to be present — inferring it would make adding a file
 * change behaviour, and would make a typo in an id silently switch how a model predicts.
 */
function checkShips(
  family: Record<string, unknown>,
  named: string,
  where: string,
  issues: ValidationIssue[],
): void {
  const ships = family.ships
  if (ships === undefined || ships === null) return
  if (!SHIPPED_FORMS.includes(ships as never)) {
    issues.push({
      code: 'unknown-shipped-form',
      field: `${where}.ships`,
      message: `Model family "${named}" declares that it ships ${JSON.stringify(ships)}; the supported forms are ${SHIPPED_FORMS.map((form) => `"${form}"`).join(' and ')}.`,
    })
    return
  }

  // The reference each form needs, and only that one: a family shipping predictions is
  // looked up in an artifact, one shipping its model fetches the model. A missing
  // reference is a family whose configurations could never be resolved at all.
  const field = ships === 'predictions' ? 'predictions' : 'models'
  if (!isNonEmptyString(family[field])) {
    issues.push({
      code: 'missing-field',
      field: `${where}.${field}`,
      message: `Model family "${named}" ships ${JSON.stringify(ships)} and so must name where its ${field} are served from.`,
    })
  }
}

/** Refuses a family that cannot be recognised in a labour slot. */
function checkSlot(
  slot: unknown,
  named: string,
  where: string,
  issues: ValidationIssue[],
): void {
  if (slot === undefined || slot === null) return
  if (!isRecord(slot)) {
    issues.push({
      code: 'malformed-field',
      field: `${where}.slot`,
      message: `Field "${where}.slot" must be an object.`,
    })
    return
  }
  for (const field of ['icon', 'label'] as const) {
    if (!isNonEmptyString(slot[field])) {
      issues.push({
        code: 'missing-field',
        field: `${where}.slot.${field}`,
        message: `Model family "${named}" declares no non-empty slot ${field}, so nothing could name it on the farm.`,
      })
    }
  }
}

/**
 * Refuses a declared history with nothing to call its axis.
 *
 * The block is optional — a family that records no history declares none, and is not
 * presented with an empty curve. Declaring one without an axis is the case that would
 * leave a screen to supply a term of its own, which is exactly what moving the label into
 * the declaration exists to stop.
 */
function checkHistory(
  history: unknown,
  named: string,
  where: string,
  issues: ValidationIssue[],
): void {
  if (history === undefined || history === null) return
  if (!isRecord(history)) {
    issues.push({
      code: 'malformed-field',
      field: `${where}.history`,
      message: `Field "${where}.history" must be an object.`,
    })
    return
  }
  if (!isNonEmptyString(history.axis)) {
    issues.push({
      code: 'missing-field',
      field: `${where}.history.axis`,
      message: `Model family "${named}" records a training history but names nothing for its axis, so no screen could label it.`,
    })
  }
}

/**
 * Every field a tutorial must carry before it can be posed.
 *
 * `disclosure` is among them rather than optional. A tutorial simplifies the model it
 * teaches — that is what makes it a tutorial — and a simplification a student would
 * notice by reading the source has to be stated where the puzzle is. Requiring the field
 * is what makes that obligation hold for every kind added later, rather than resting on
 * one body's prose.
 */
export const REQUIRED_TUTORIAL_FIELDS = [
  'id',
  'title',
  'teaching',
  'disclosure',
  'kind',
  'puzzle',
] as const

/**
 * Refuses a tutorial the frame could not pose, or a puzzle its kind could not be solved.
 *
 * Three layers, in order, because each depends on the one before it. The envelope is the
 * frame's business — an id to record completion against, a title and copy to present, a
 * kind to dispatch on. Past `kind` nothing here understands the data, so it is handed to
 * the registered kind: first to be checked for shape, and then, only if that passed, to be
 * asked whether it can be solved at all.
 *
 * The winnability question is asked here rather than left to a screen because a student
 * locked out by authored data is locked out somewhere no screen can explain. It is the same
 * argument that puts every other structural impossibility in this file.
 */
function checkTutorial(
  tutorial: unknown,
  named: string,
  where: string,
  kinds: TutorialKinds,
  declared: TaskDeclaration,
  issues: ValidationIssue[],
): void {
  // Optional, and a family declaring none is fielded the moment it is owned.
  if (tutorial === undefined || tutorial === null) return
  const at = `${where}.tutorial`
  if (!isRecord(tutorial)) {
    issues.push({
      code: 'malformed-field',
      field: at,
      message: `Field "${at}" must be an object.`,
    })
    return
  }

  for (const field of REQUIRED_TUTORIAL_FIELDS) {
    if (tutorial[field] === undefined || tutorial[field] === null) {
      issues.push({
        code: 'missing-field',
        field: `${at}.${field}`,
        message: `The tutorial of model family "${named}" is missing required field "${field}".`,
      })
    }
  }

  for (const field of ['id', 'title', 'disclosure', 'kind'] as const) {
    if (tutorial[field] !== undefined && !isNonEmptyString(tutorial[field])) {
      issues.push({
        code: 'malformed-field',
        field: `${at}.${field}`,
        message: `Field "${at}.${field}" must be a non-empty string.`,
      })
    }
  }

  if (tutorial.teaching !== undefined) checkTeaching(tutorial.teaching, `${at}.teaching`, issues)

  if (!isNonEmptyString(tutorial.kind)) return
  const kind = tutorialKind(tutorial.kind, kinds)
  if (kind === undefined) {
    // Refused rather than ignored: a tutorial that silently poses nothing is a gate that
    // silently opens, and the family behind it would be fielded without the lesson.
    issues.push({
      code: 'unknown-tutorial-kind',
      field: `${at}.kind`,
      message: `The tutorial of model family "${named}" is of kind ${JSON.stringify(tutorial.kind)}, which this build does not carry.`,
    })
    return
  }

  if (tutorial.puzzle === undefined || tutorial.puzzle === null) return
  const defects = kind.check(tutorial.puzzle, `${at}.puzzle`, declared)
  if (defects.length > 0) {
    // The kind's own cause, kept verbatim, with the family named in front of it. Every
    // other refusal in here names the family, and an author reading "the puzzle names
    // category X, which this task does not declare" against a task with several families
    // would otherwise have to count array indices to find which one said it.
    issues.push(
      ...defects.map((defect) => ({
        ...defect,
        message: `In the tutorial of model family "${named}": ${defect.message}`,
      })),
    )
    // Winnability over malformed data would report a second, derived cause for the same
    // defect, and the author would have to guess which one to fix.
    return
  }

  const winnable = kind.winnable(tutorial.puzzle)
  if (!winnable.ok) {
    issues.push({
      code: 'unwinnable-tutorial',
      field: `${at}.puzzle`,
      message: `The tutorial ${JSON.stringify(isNonEmptyString(tutorial.id) ? tutorial.id : '')} of model family "${named}" cannot be solved: ${winnable.cause}`,
    })
  }
}

/**
 * Refuses two families that declare one tutorial id and disagree about what it is.
 *
 * Completion is recorded against the tutorial's id and nothing else, so that a student
 * meets each lesson exactly once however many families teach it. That only holds while one
 * id means one puzzle: two that disagree would let passing either stand for both, and
 * nothing could say which lesson the student actually sat.
 *
 * Deep equality over the declared JSON, because a tutorial is declared data all the way
 * down and two authors writing "the same" puzzle twice is precisely the mistake worth
 * catching at load.
 */
function checkTutorialAgreement(families: readonly unknown[], issues: ValidationIssue[]): void {
  const seen = new Map<string, unknown>()
  families.forEach((family, index) => {
    if (!isRecord(family)) return
    const tutorial = family.tutorial
    if (!isRecord(tutorial) || !isNonEmptyString(tutorial.id)) return
    const first = seen.get(tutorial.id)
    if (first === undefined) {
      seen.set(tutorial.id, tutorial)
      return
    }
    if (JSON.stringify(first) === JSON.stringify(tutorial)) return
    issues.push({
      code: 'disagreeing-tutorial',
      field: `families[${index}].tutorial.id`,
      message: `Tutorial id ${JSON.stringify(tutorial.id)} is declared twice with different content; one completion cannot stand for two different puzzles.`,
    })
  })
}

/**
 * Validates the families a task declares.
 *
 * At least one, because a task with no family offers no model and could never be
 * configured; and no two sharing an id, because an id is what a labour slot, a save and
 * an artifact all name a family by.
 */
function checkFamilies(
  families: unknown,
  kinds: TutorialKinds,
  declared: TaskDeclaration,
  datasetIds: readonly string[],
  issues: ValidationIssue[],
): void {
  if (!Array.isArray(families) || families.length === 0) {
    issues.push({
      code: 'no-families',
      field: 'families',
      message: 'Field "families" must declare at least one model family; a task with none offers no model to make.',
    })
    return
  }

  checkTutorialAgreement(families, issues)

  const seen: string[] = []
  families.forEach((family, index) => {
    const id = checkFamily(family, index, kinds, declared, datasetIds, issues)
    if (id === undefined) return
    if (seen.includes(id)) {
      issues.push({
        code: 'duplicate-id',
        field: `families[${index}].id`,
        message: `Field "families" declares id "${id}" more than once.`,
      })
    }
    seen.push(id)
  })
}

/**
 * Fields that were the task's and are now each family's.
 *
 * Refused rather than ignored: a declaration still carrying task-level knobs would load
 * with them silently dropped, and its author would see a workshop with the wrong controls
 * rather than a message naming where they moved to.
 */
const MOVED_TO_FAMILY = ['knobs', 'predictions', 'diagram'] as const

/**
 * Fields a family may not declare, because they are the task's.
 *
 * The test for the split is whether two families of one task could disagree about the
 * field. They cannot disagree about which photographs of the orchard exist, and they must
 * be able to disagree about which of them each is fitted on — so the tiers are the task's
 * and the knob that picks one is the family's.
 */
const BELONGS_TO_TASK = ['datasets'] as const

/**
 * Validates a candidate declaration. On success the input is returned narrowed
 * to `TaskDeclaration`; on failure every issue found is reported, each naming
 * the field it concerns.
 */
export interface ValidationOptions {
  /**
   * The tutorial kinds to check declared tutorials against.
   *
   * Threaded rather than reached for, so that a test can pose a fixture puzzle without a
   * test-only kind having to ship in the registry the browser loads.
   */
  readonly tutorialKinds?: TutorialKinds
}

export function validateDeclaration(
  input: unknown,
  options: ValidationOptions = {},
): DeclarationValidation {
  const kinds = options.tutorialKinds ?? TUTORIAL_KINDS
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ code: 'malformed-declaration', message: 'A task declaration must be an object.' }],
    }
  }

  const issues: ValidationIssue[] = []

  for (const field of REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null) {
      issues.push({
        code: 'missing-field',
        field,
        message: `Task declaration is missing required field "${field}".`,
      })
    }
  }

  for (const field of ['id', 'title', 'pool'] as const) {
    if (input[field] !== undefined && !isNonEmptyString(input[field])) {
      issues.push({
        code: 'malformed-field',
        field,
        message: `Field "${field}" must be a non-empty string.`,
      })
    }
  }

  if (input.schemaVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(String(input.schemaVersion))) {
    issues.push({
      code: 'malformed-field',
      field: 'schemaVersion',
      message: `Field "schemaVersion" must look like "1.0.0"; found ${JSON.stringify(input.schemaVersion)}.`,
    })
  }

  const categoryIds =
    input.categories === undefined ? [] : identified(input.categories, 'categories', issues)
  const actionIds = input.actions === undefined ? [] : identified(input.actions, 'actions', issues)

  if (input.categoryActions !== undefined) {
    checkCategoryActions(input.categoryActions, categoryIds, actionIds, issues)
  }
  // Refused where they used to be declared, naming where they now belong. A declaration
  // written against the old shape is a real thing an author will have in front of them.
  for (const field of MOVED_TO_FAMILY) {
    if (input[field] === undefined) continue
    issues.push({
      code: 'belongs-to-family',
      field,
      message: `Field "${field}" is declared by each model family rather than by the task, because a task offers several families and they share none of them. Move it into "families".`,
    })
  }
  // The declaration is handed down as declared rather than as validated: a family's
  // tutorial is checked in the same pass that checks the vocabulary it is held to, and a
  // kind reads that vocabulary defensively for exactly that reason.
  // Tiers are read before the families, because every family's dataset knob is held to
  // the ids they declare and to which of them is smallest.
  const datasetIds =
    input.datasets === undefined ? [] : checkDatasets(input.datasets, categoryIds, issues)
  if (input.families !== undefined) {
    checkFamilies(input.families, kinds, input as unknown as TaskDeclaration, datasetIds, issues)
  }
  if (input.features !== undefined) checkFeatures(input.features, issues)
  if (input.ruleBudget !== undefined) checkRuleBudget(input.ruleBudget, issues)
  if (input.payoffs !== undefined) {
    checkPayoffs(input.payoffs, categoryIds, actionIds, issues)
    checkPayoffAgreement(input.payoffs, input.categoryActions, categoryIds, actionIds, issues)
  }
  if (input.handSorting !== undefined) {
    checkHandSorting(input.handSorting, issues)
  }
  if (input.policy !== undefined) checkPolicy(input.policy, categoryIds, actionIds, issues)

  // Optional, so absence is not an issue and nothing is reported as missing for a task
  // that declares none — which is the whole of what "a task without one behaves as though
  // the concept did not exist" means at load time.
  if (input.delivery !== undefined && input.delivery !== null) {
    checkDelivery(input.delivery, input.categoryActions, categoryIds, actionIds, issues)
  }
  if (input.teaching !== undefined) checkTeaching(input.teaching, 'teaching', issues)

  if (input.available !== undefined && typeof input.available !== 'boolean') {
    issues.push({
      code: 'malformed-field',
      field: 'available',
      message: 'Field "available" must be true or false.',
    })
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, declaration: input as unknown as TaskDeclaration }
}

/** True when a knob's own declaration permits `value`. */
export function knobPermits(knob: KnobDeclaration, value: unknown): boolean {
  if (knob.kind === 'choice') return knob.values.includes(value as string | number)
  if (typeof value !== 'number') return false
  return permittedBySlider(value, knob.min, knob.max, knob.step)
}

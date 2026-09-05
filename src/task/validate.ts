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

import { blockSizes } from './cnn.js'
import { DIAGRAM_KINDS } from './types.js'
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
  'predictions',
  'knobs',
  'payoffs',
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

function checkKnob(knob: unknown, index: number, issues: ValidationIssue[]): string | undefined {
  const where = `knobs[${index}]`
  if (!isRecord(knob)) {
    issues.push({
      code: 'malformed-knob',
      field: where,
      message: `Knob ${index} must be an object.`,
    })
    return undefined
  }
  const id = isNonEmptyString(knob.id) ? knob.id : undefined
  const named = `knob "${id ?? index}"`

  for (const field of ['id', 'label', 'kind', 'help'] as const) {
    if (!isNonEmptyString(knob[field])) {
      issues.push({
        code: 'missing-knob-field',
        field: `${where}.${field}`,
        message: `Knob ${id ?? index} is missing a non-empty "${field}".`,
      })
    }
  }
  if (knob.default === undefined) {
    issues.push({
      code: 'missing-knob-field',
      field: `${where}.default`,
      message: `Knob ${id ?? index} is missing a "default".`,
    })
  }

  if (knob.kind === 'choice') {
    if (!Array.isArray(knob.values) || knob.values.length < 2) {
      issues.push({
        code: 'malformed-knob-values',
        field: `${where}.values`,
        message: `Choice ${named} must declare at least two allowed values.`,
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
      message: `Knob ${id ?? index} declares unknown kind "${knob.kind}"; expected "choice" or "slider".`,
    })
  }

  return id
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

function checkKnobs(knobs: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(knobs) || knobs.length === 0) {
    issues.push({
      code: 'malformed-field',
      field: 'knobs',
      message: 'Field "knobs" must be a non-empty list.',
    })
    return
  }
  const seen: string[] = []
  knobs.forEach((knob, index) => {
    const id = checkKnob(knob, index, issues)
    if (id === undefined) return
    if (seen.includes(id)) {
      issues.push({
        code: 'duplicate-id',
        field: `knobs[${index}].id`,
        message: `Field "knobs" declares id "${id}" more than once.`,
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

function isPositiveInteger(value: unknown): boolean {
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
  knobs: readonly Record<string, unknown>[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(diagram)) {
    issues.push({
      code: 'malformed-field',
      field: 'diagram',
      message: 'Field "diagram" must be an object.',
    })
    return
  }

  const kind = diagram.kind
  if (kind === undefined || kind === null) {
    issues.push({
      code: 'missing-field',
      field: 'diagram.kind',
      message: 'Task declaration is missing required field "diagram.kind".',
    })
    return
  }
  if (!DIAGRAM_KINDS.includes(kind as never)) {
    issues.push({
      code: 'unknown-diagram-kind',
      field: 'diagram.kind',
      message: `Field "diagram.kind" declares unknown kind ${JSON.stringify(kind)}; expected ${DIAGRAM_KINDS.map((known) => `"${known}"`).join(', ')}.`,
    })
    return
  }

  if (kind === 'feedforward') checkFeedforwardDiagram(diagram, knobs, issues)
  else checkCnnDiagram(diagram, knobs, issues)
}

/** Reports the fields a diagram of some kind must carry and does not. */
function requireDiagramFields(
  diagram: Record<string, unknown>,
  fields: readonly string[],
  issues: ValidationIssue[],
): void {
  for (const field of fields) {
    if (diagram[field] === undefined || diagram[field] === null) {
      issues.push({
        code: 'missing-field',
        field: `diagram.${field}`,
        message: `Task declaration is missing required field "diagram.${field}".`,
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
  knobs: readonly Record<string, unknown>[],
  issues: ValidationIssue[],
): Record<string, unknown> | undefined {
  const id = diagram[field]
  if (id === undefined) return undefined
  const knob = knobs.find((candidate) => candidate.id === id)
  if (knob === undefined) {
    issues.push({
      code: 'unknown-knob',
      field: `diagram.${field}`,
      message: `Field "diagram.${field}" names knob ${JSON.stringify(id)}, which the task does not declare.`,
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
  issues: ValidationIssue[],
): number[] {
  const counts: number[] = []
  let usable = true
  for (const value of permittedValues(knob) ?? []) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      usable = false
      issues.push({
        code: 'malformed-diagram',
        field: `diagram.${field}`,
        message: `Knob "${String(knob.id)}" sets the number of ${noun} but permits ${JSON.stringify(value)}, which is not a whole number of ${noun}.`,
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
  issues: ValidationIssue[],
): void {
  const shown = diagram[field]
  if (!isRecord(shown)) {
    if (shown !== undefined) {
      issues.push({
        code: 'malformed-field',
        field: `diagram.${field}`,
        message: `Field "diagram.${field}" must be an object keyed by the values its knob permits.`,
      })
    }
    return
  }

  for (const [value, count] of Object.entries(shown)) {
    if (!isPositiveInteger(count)) {
      issues.push({
        code: 'malformed-diagram',
        field: `diagram.${field}.${value}`,
        message: `Field "diagram.${field}" draws ${JSON.stringify(count)} ${noun} for value "${value}"; a drawn count must be a positive whole number.`,
      })
    }
  }

  if (knob === undefined) return
  for (const value of permittedValues(knob) ?? []) {
    if (shown[String(value)] === undefined) {
      issues.push({
        code: 'unmapped-knob-value',
        field: `diagram.${field}`,
        message: `Knob "${String(knob.id)}" permits value ${JSON.stringify(value)}, which "diagram.${field}" gives no drawn count for.`,
      })
    }
  }
}

/** The fields only a fully-connected diagram carries. */
const FEEDFORWARD_DIAGRAM_FIELDS = ['layersKnob', 'unitsKnob', 'unitsShown', 'inputsShown'] as const

function checkFeedforwardDiagram(
  diagram: Record<string, unknown>,
  knobs: readonly Record<string, unknown>[],
  issues: ValidationIssue[],
): void {
  requireDiagramFields(diagram, FEEDFORWARD_DIAGRAM_FIELDS, issues)

  if (diagram.inputsShown !== undefined && !isPositiveInteger(diagram.inputsShown)) {
    issues.push({
      code: 'malformed-diagram',
      field: 'diagram.inputsShown',
      message: `Field "diagram.inputsShown" must be a positive whole number; found ${JSON.stringify(diagram.inputsShown)}.`,
    })
  }

  const layersKnob = diagramKnob(diagram, 'layersKnob', knobs, issues)
  const unitsKnob = diagramKnob(diagram, 'unitsKnob', knobs, issues)

  if (layersKnob !== undefined) wholeCountsOf(layersKnob, 'layersKnob', 'layers', issues)
  checkDrawnCounts(diagram, 'unitsShown', unitsKnob, 'units', issues)
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
  knobs: readonly Record<string, unknown>[],
  issues: ValidationIssue[],
): void {
  requireDiagramFields(diagram, CNN_DIAGRAM_FIELDS, issues)

  const inputSize = diagram.inputSize
  const sizeUsable = isPositiveInteger(inputSize)
  if (inputSize !== undefined && !sizeUsable) {
    issues.push({
      code: 'malformed-diagram',
      field: 'diagram.inputSize',
      message: `Field "diagram.inputSize" must be a positive whole number of pixels; found ${JSON.stringify(inputSize)}.`,
    })
  }

  const blocksKnob = diagramKnob(diagram, 'blocksKnob', knobs, issues)
  const channelsKnob = diagramKnob(diagram, 'channelsKnob', knobs, issues)

  if (blocksKnob !== undefined) {
    const counts = wholeCountsOf(blocksKnob, 'blocksKnob', 'blocks', issues)
    if (sizeUsable) {
      for (const blocks of counts) {
        if (blockSizes(inputSize as number, blocks) === undefined) {
          issues.push({
            code: 'unbuildable-block-count',
            field: 'diagram.blocksKnob',
            message: `Knob "${String(blocksKnob.id)}" permits ${blocks} convolutional blocks, which pools a ${String(inputSize)}px input below a single spatial position.`,
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
  if (channelsKnob !== undefined) wholeCountsOf(channelsKnob, 'channelsKnob', 'channels', issues)

  checkDrawnCounts(diagram, 'channelsShown', channelsKnob, 'channels', issues)
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

function checkTeaching(teaching: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(teaching)) {
    issues.push({
      code: 'malformed-field',
      field: 'teaching',
      message: 'Field "teaching" must be an object.',
    })
    return
  }
  for (const field of ['summary', 'theory'] as const) {
    if (!isNonEmptyString(teaching[field])) {
      issues.push({
        code: 'missing-field',
        field: `teaching.${field}`,
        message: `Task declaration is missing required field "teaching.${field}".`,
      })
    }
  }
}

/**
 * Validates a candidate declaration. On success the input is returned narrowed
 * to `TaskDeclaration`; on failure every issue found is reported, each naming
 * the field it concerns.
 */
export function validateDeclaration(input: unknown): DeclarationValidation {
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

  for (const field of ['id', 'title', 'pool', 'predictions'] as const) {
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
  if (input.knobs !== undefined) checkKnobs(input.knobs, issues)
  if (input.payoffs !== undefined) {
    checkPayoffs(input.payoffs, categoryIds, actionIds, issues)
    checkPayoffAgreement(input.payoffs, input.categoryActions, categoryIds, actionIds, issues)
  }
  if (input.policy !== undefined) checkPolicy(input.policy, categoryIds, actionIds, issues)
  if (input.teaching !== undefined) checkTeaching(input.teaching, issues)

  // Optional, so absence is not an issue. Checked only against knobs sound enough to
  // refer to; otherwise the knob issues already name the cause.
  if (input.diagram !== undefined) {
    const referrable = referrableKnobs(input.knobs)
    if (referrable !== undefined) checkDiagram(input.diagram, referrable, issues)
  }

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

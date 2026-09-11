/**
 * Reading a prediction artifact that is spread over several files.
 *
 * `artifact.ts` describes the shape a configuration resolves to. This module is the
 * on-disk contract around it: an index carrying coverage, the pool binding, the encoding
 * and the provenance, plus one file per configuration holding that configuration's
 * history and distributions.
 *
 * Everything here refuses rather than repairs, and one refusal is deliberately its own
 * kind: a configuration whose knob values are all permitted but which no model was
 * trained for is `untrained-configuration`, not an invalid configuration. The student
 * made no error, so the message must not imply they did — and nothing may quietly
 * substitute a nearby configuration for the one they chose.
 *
 * See openspec/changes/prediction-artifacts/specs/prediction-artifacts/spec.md.
 */

import type { ConfigurationEntry, SplitPredictions, TrainingStep } from './artifact.js'
import { ID_SEPARATOR } from './configId.js'
import type { ModelFamilyDeclaration, TaskDeclaration } from './types.js'
import type { ValidationIssue } from './validate.js'
import { checkArtifactVersion } from './version.js'

/** The pool an artifact must be bound to, as the manifest declares it. */
export interface PoolBinding {
  readonly poolId: string
  readonly schemaVersion: string
  readonly seed: number
}

/** How probabilities are stored, declared by the artifact rather than assumed. */
export interface Encoding {
  readonly decimals: number
  readonly sumTolerance: number
}

/** What a run recorded about itself. */
export interface ConfigurationRecord {
  readonly file: string
  readonly knobs: Readonly<Record<string, string | number>>
  /**
   * The dataset tier this configuration was fitted on.
   *
   * Recorded rather than read off the identifier's spelling: two configurations differing
   * only in their tier are the comparison the tiers exist to teach, and a reviewer holding
   * the artifact should be able to say which fitting set produced which curve. Checked
   * against the identifier at load, so the two cannot drift apart.
   */
  readonly tier: string
  /**
   * How many steps the run performed, or nothing when it performed none.
   *
   * A step, not an epoch: what one *is* comes from the model family, so a reviewer can
   * count a run's steps without knowing which family produced it. Optional because a
   * family may record no history at all — a fitted tree that is authored rather than
   * grown has no run to count — and `model-families` already requires that such a
   * family declare no history rather than declare an empty one.
   *
   * Absent here and present in the file, or the other way round, is the disagreement
   * `readConfigurationFile` refuses: the provenance and the history are two statements
   * about one run and they may not differ.
   */
  readonly steps?: number
  readonly seed: number
  readonly pipeline: { readonly revision: string; readonly dirty: boolean }
  readonly architecture: {
    readonly blocks: number
    readonly channels: readonly number[]
    readonly spatial: readonly number[]
    readonly parameters: number
  }
  readonly shaping: readonly { readonly step: string; readonly configurations: readonly string[] }[]
}

export interface LoadedIndex {
  readonly schemaVersion: string
  readonly taskId: string
  /** The model family these predictions were made by. */
  readonly familyId: string
  readonly categories: readonly string[]
  readonly pool: PoolBinding
  readonly encoding: Encoding
  readonly configurations: Readonly<Record<string, ConfigurationRecord>>
  /** Every configuration this artifact covers, without reading a prediction entry. */
  readonly coverage: readonly string[]
}

export type IndexValidation =
  | { readonly ok: true; readonly index: LoadedIndex }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

export type EntryValidation =
  | { readonly ok: true; readonly entry: ConfigurationEntry }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

export const UNTRAINED_CONFIGURATION = 'untrained-configuration'

/** Field names that would make an artifact state ground truth or a decision. */
const FORBIDDEN_FIELDS = ['category', 'truth', 'label', 'action', 'correct']

/**
 * What every record must carry, whatever its family records about its run.
 *
 * The step count is not among them, and its absence is the statement that the run
 * performed no steps. It is read separately, under either spelling — see `stepsIn`.
 */
const REQUIRED_RECORD_FIELDS = [
  'file',
  'knobs',
  'tier',
  'seed',
  'pipeline',
  'architecture',
  'shaping',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

/** Every forbidden field name present anywhere in a document, with its path. */
export function truthFieldsIn(value: unknown, path = ''): readonly string[] {
  const found: string[] = []
  if (Array.isArray(value)) {
    for (const item of value) found.push(...truthFieldsIn(item, path))
  } else if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const where = path === '' ? key : `${path}.${key}`
      if (FORBIDDEN_FIELDS.includes(key)) found.push(where)
      found.push(...truthFieldsIn(nested, where))
    }
  }
  return found
}

/**
 * The value an identifier carries for one knob, or nothing when it carries none.
 *
 * Read off the identifier rather than off the recorded knobs, because the identifier is
 * what a lookup resolves and the recorded knobs are provenance beside it. The parts are
 * `knobId + value` joined by the separator, so the tier part is the suffix that follows
 * the knob's id — and the dataset knob is declared last precisely so that this is a
 * suffix rather than a scan.
 */
function tierIn(configurationId: string, knobId: string): string | undefined {
  const parts = configurationId.split(ID_SEPARATOR)
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index] as string
    if (part.startsWith(knobId) && part.length > knobId.length) {
      return part.slice(knobId.length)
    }
  }
  return undefined
}

/**
 * How many steps a record says its run performed, or nothing when it says none.
 *
 * `steps` is the vocabulary; `epochs` is what the three shipped convolutional records
 * still write, and reading both is what lets the word move without a retrain. REMOVE
 * THE `epochs` FALLBACK with the `heirloom-cultivars` retrain, alongside the one in
 * `stepOf`.
 */
function stepsIn(raw: Record<string, unknown>): unknown {
  return raw.steps ?? raw.epochs
}

function readRecord(
  id: string,
  raw: unknown,
  issues: ValidationIssue[],
): ConfigurationRecord | undefined {
  if (!isRecord(raw)) {
    issues.push(issue('malformed-entry', `Configuration "${id}" is not an object.`, id))
    return undefined
  }

  let complete = true
  for (const field of REQUIRED_RECORD_FIELDS) {
    if (raw[field] === undefined) {
      issues.push(
        issue(
          'missing-provenance',
          `Configuration "${id}" records no ${field}, so what produced it cannot be repeated.`,
          id,
        ),
      )
      complete = false
    }
  }
  if (!complete) return undefined

  const steps = stepsIn(raw)
  if (steps !== undefined && (typeof steps !== 'number' || !Number.isInteger(steps) || steps < 1)) {
    issues.push(
      issue(
        'malformed-provenance',
        `Configuration "${id}" records ${JSON.stringify(steps)} steps, which is not a count of them.`,
        id,
      ),
    )
    return undefined
  }

  const pipeline = raw.pipeline
  if (!isRecord(pipeline) || typeof pipeline.revision !== 'string' || pipeline.revision === '') {
    issues.push(
      issue('missing-provenance', `Configuration "${id}" records no producing revision.`, id),
    )
    return undefined
  }

  if (!Array.isArray(raw.shaping)) {
    issues.push(issue('malformed-entry', `Configuration "${id}" records no shaping list.`, id))
    return undefined
  }
  for (const step of raw.shaping) {
    // Shaping that names no step, or does not say it touched this configuration, leaves
    // a reader unable to tell measured figures from shaped ones — which is the whole
    // purpose of recording it.
    if (!isRecord(step) || typeof step.step !== 'string' || !Array.isArray(step.configurations)) {
      issues.push(
        issue('unattributed-shaping', `Configuration "${id}" records a shaping step with no name or configurations.`, id),
      )
      return undefined
    }
    if (!step.configurations.includes(id)) {
      issues.push(
        issue(
          'unattributed-shaping',
          `Configuration "${id}" records shaping step "${step.step}", which does not name it.`,
          id,
        ),
      )
      return undefined
    }
  }

  // Normalized onto `steps`, so nothing past the reader has to know which spelling the
  // record it came from happened to use.
  return { ...(raw as unknown as ConfigurationRecord), steps: steps as number | undefined }
}

/**
 * Reads an artifact index against the task and the pool it claims to belong to.
 *
 * The pool binding is checked here, at load, because predictions keyed to the image ids
 * of one pool say nothing about the images another pool generated under the same ids —
 * and that failure would otherwise surface as a plausible-looking harvest.
 */
export function readArtifactIndex(
  raw: unknown,
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  pool: PoolBinding,
): IndexValidation {
  const issues: ValidationIssue[] = []

  if (!isRecord(raw)) {
    return { ok: false, issues: [issue('data-malformed', 'A prediction artifact index must be an object.')] }
  }

  for (const field of ['schemaVersion', 'taskId', 'categories', 'pool', 'encoding', 'configurations'] as const) {
    if (raw[field] === undefined) {
      issues.push(issue('missing-field', `The artifact index declares no ${field}.`, field))
    }
  }
  // Its own refusal, not one of the list above: an artifact recording no family is not
  // read as belonging to the family that happens to be asking for it, because two
  // families of one task can compose the same identifiers and the wrong one would answer.
  if (raw.familyId === undefined) {
    issues.push(
      issue(
        'artifact-family-missing',
        'The artifact index records no model family id, and no family is assumed for it.',
        'familyId',
      ),
    )
  }
  if (issues.length > 0) return { ok: false, issues }

  const version = checkArtifactVersion(declaration.schemaVersion, String(raw.schemaVersion))
  if (!version.ok) issues.push(version.issue)

  if (raw.taskId !== declaration.id) {
    issues.push(
      issue(
        'artifact-task-mismatch',
        `Artifact belongs to task "${String(raw.taskId)}", not "${declaration.id}".`,
        'taskId',
      ),
    )
  }

  if (raw.familyId !== family.id) {
    issues.push(
      issue(
        'artifact-family-mismatch',
        `Artifact belongs to model family "${String(raw.familyId)}", not "${family.id}".`,
        'familyId',
      ),
    )
  }

  const declared = declaration.categories.map((category) => category.id)
  const categories = Array.isArray(raw.categories) ? raw.categories.map(String) : []
  if (categories.join(',') !== declared.join(',')) {
    issues.push(
      issue(
        'artifact-category-mismatch',
        `Artifact indexes probabilities by [${categories.join(', ')}], but the task declares [${declared.join(', ')}].`,
        'categories',
      ),
    )
  }

  const binding = raw.pool
  if (!isRecord(binding)) {
    issues.push(issue('missing-field', 'The artifact records no pool binding.', 'pool'))
  } else {
    for (const [field, expected] of [
      ['poolId', pool.poolId],
      ['schemaVersion', pool.schemaVersion],
      ['seed', pool.seed],
    ] as const) {
      if (binding[field] !== expected) {
        issues.push(
          issue(
            'artifact-pool-mismatch',
            `Artifact was produced from pool ${field} "${String(binding[field])}", but the loaded pool declares "${String(expected)}".`,
            `pool.${field}`,
          ),
        )
      }
    }
  }

  const encoding = raw.encoding
  if (!isRecord(encoding) || typeof encoding.decimals !== 'number' || typeof encoding.sumTolerance !== 'number') {
    issues.push(issue('missing-field', 'The artifact declares no usable encoding.', 'encoding'))
  } else {
    // Quantization is not a licence to ship a vector that is not a distribution: a
    // tolerance tighter than the stated precision can meet would refuse honest data,
    // and one that hides the precision's error would accept dishonest data.
    const worst = (declared.length * 10 ** -encoding.decimals) / 2
    if (encoding.sumTolerance < worst) {
      issues.push(
        issue(
          'encoding-tolerance-too-tight',
          `The artifact stores probabilities at ${encoding.decimals} decimals, whose worst rounding error is ${worst}, but declares a tolerance of ${encoding.sumTolerance}.`,
          'encoding.sumTolerance',
        ),
      )
    }
  }

  const stated = truthFieldsIn(raw)
  for (const field of stated) {
    issues.push(
      issue(
        'artifact-states-truth',
        `The artifact index carries field "${field}", which names a category as true or an action as chosen.`,
        field,
      ),
    )
  }

  const configurations: Record<string, ConfigurationRecord> = {}
  if (!isRecord(raw.configurations)) {
    issues.push(issue('malformed-field', 'The artifact declares no configurations.', 'configurations'))
  } else {
    for (const [id, value] of Object.entries(raw.configurations)) {
      const record = readRecord(id, value, issues)
      if (record === undefined) continue
      // The recorded tier and the identifier's own must agree, or the artifact offers two
      // answers to "which photographs was this fitted on" and nothing can say which.
      const carried = tierIn(id, family.datasetKnob)
      if (carried !== record.tier) {
        issues.push(
          issue(
            'artifact-tier-mismatch',
            `Configuration "${id}" records dataset tier "${record.tier}", but its identifier carries "${String(carried)}".`,
            id,
          ),
        )
        continue
      }
      configurations[id] = record
    }
    if (Object.keys(raw.configurations).length === 0) {
      issues.push(
        issue('empty-coverage', 'The artifact covers no configuration, so nothing can be run.', 'configurations'),
      )
    }
  }

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    index: {
      schemaVersion: String(raw.schemaVersion),
      taskId: String(raw.taskId),
      familyId: String(raw.familyId),
      categories,
      pool: binding as unknown as PoolBinding,
      encoding: encoding as unknown as Encoding,
      configurations,
      coverage: Object.keys(configurations),
    },
  }
}

/**
 * Whether a configuration is covered, and why not when it is not.
 *
 * The refusal is `untrained-configuration` rather than an invalid-configuration code:
 * every knob value the student chose was one they were offered, so the cause is that no
 * model exists for the combination, not that they made a mistake.
 */
export function coverageIssue(index: LoadedIndex, configurationId: string): ValidationIssue | undefined {
  if (index.configurations[configurationId] !== undefined) return undefined
  return {
    code: UNTRAINED_CONFIGURATION,
    field: configurationId,
    message:
      `No model was trained for configuration "${configurationId}", so this run cannot be scored. ` +
      'These knob values are allowed; the configuration has simply not been trained in advance.',
  }
}

/**
 * Which step one history entry describes, whichever key it is written under.
 *
 * The vocabulary is "step" and the on-disk key still says `epoch` for the three
 * convolutional artifacts already shipped. Renaming the key now would invalidate all
 * three and force a retrain this change exists not to cause, so the reader accepts both
 * and prefers `step`.
 *
 * REMOVE THE `epoch` FALLBACK when `heirloom-cultivars` retrains the convolutional
 * artifacts (§11, change 14). That retrain rewrites every shipped file anyway, so it is
 * the moment the old key stops existing and this branch stops earning its keep.
 */
function stepOf(entry: Record<string, unknown>): unknown {
  return entry.step ?? entry.epoch
}

function readHistory(
  id: string,
  raw: unknown,
  steps: number,
  issues: ValidationIssue[],
): readonly TrainingStep[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    issues.push(issue('missing-history', `Configuration "${id}" carries no training history.`, id))
    return undefined
  }
  if (raw.length !== steps) {
    issues.push(
      issue(
        'history-length-mismatch',
        `Configuration "${id}" records ${steps} steps but its history holds ${raw.length}.`,
        id,
      ),
    )
    return undefined
  }
  const history: TrainingStep[] = []
  for (let index = 0; index < raw.length; index += 1) {
    const entry: unknown = raw[index]
    const expected = index + 1
    if (!isRecord(entry) || stepOf(entry) !== expected) {
      issues.push(
        issue(
          'history-not-contiguous',
          `Configuration "${id}" has no entry for step ${expected}; steps must run from 1 to ${steps} with none missing or repeated.`,
          id,
        ),
      )
      return undefined
    }
    for (const field of ['trainLoss', 'valLoss'] as const) {
      if (typeof entry[field] !== 'number' || !Number.isFinite(entry[field])) {
        issues.push(
          issue('malformed-history', `Configuration "${id}" step ${expected} records no usable ${field}.`, id),
        )
        return undefined
      }
    }
    // Accuracies are shares, and a value outside 0..1 is not one — refused rather than
    // clamped, because a replay showing 140% is a broken artifact, not a display bug.
    for (const field of ['trainAccuracy', 'valAccuracy'] as const) {
      const value = entry[field]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        issues.push(
          issue(
            'malformed-history',
            `Configuration "${id}" step ${expected} records no usable ${field}; accuracies are shares in 0 to 1.`,
            id,
          ),
        )
        return undefined
      }
    }
    // Normalized to the step vocabulary on the way in, so nothing past the reader has to
    // know which key the file it came from happened to use.
    history.push({
      step: expected,
      trainLoss: entry.trainLoss as number,
      valLoss: entry.valLoss as number,
      trainAccuracy: entry.trainAccuracy as number,
      valAccuracy: entry.valAccuracy as number,
    })
  }
  return history
}

/**
 * One split's stored distributions, checked against the manifest's own enumeration.
 *
 * The enumerated half of completeness. An artifact that *stores* its distributions
 * satisfies "every manifest image of both splits, exactly once" by being counted against
 * the pool: a name the manifest does not declare, a manifest image the entry set omits,
 * or a repeat is a refusal naming the configuration and the defect.
 *
 * An artifact that stores a fitted *model* has no set to count and satisfies the same
 * requirement structurally instead — see `modelSpanIssues` in `src/families/model.ts`.
 * The two forms are deliberately separate functions rather than one with a mode: what
 * they check has nothing in common but the sentence they are both discharging.
 */
function readSplit(
  id: string,
  split: string,
  raw: unknown,
  imageIds: readonly string[],
  encoding: Encoding,
  categories: number,
  issues: ValidationIssue[],
): SplitPredictions | undefined {
  if (!isRecord(raw)) {
    issues.push(issue('missing-split', `Configuration "${id}" carries no "${split}" predictions.`, id))
    return undefined
  }

  const present = new Set(Object.keys(raw))
  for (const imageId of imageIds) {
    if (!present.has(imageId)) {
      issues.push(
        issue(
          'incomplete-configuration',
          `Configuration "${id}" has no distribution for image "${imageId}", and a run is not scored on the images that happen to be present.`,
          id,
        ),
      )
      return undefined
    }
  }
  for (const imageId of present) {
    if (!imageIds.includes(imageId)) {
      issues.push(
        issue(
          'unknown-image',
          `Configuration "${id}" predicts image "${imageId}", which the pool manifest does not declare in "${split}".`,
          id,
        ),
      )
      return undefined
    }
  }

  const quantum = 10 ** -encoding.decimals
  for (const [imageId, vector] of Object.entries(raw)) {
    if (!Array.isArray(vector) || vector.length !== categories) {
      issues.push(
        issue(
          'malformed-distribution',
          `Configuration "${id}", image "${imageId}": expected ${categories} probabilities.`,
          imageId,
        ),
      )
      return undefined
    }
    let sum = 0
    for (const value of vector) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        issues.push(
          issue(
            'malformed-distribution',
            `Configuration "${id}", image "${imageId}": value ${String(value)} is outside zero to one.`,
            imageId,
          ),
        )
        return undefined
      }
      if (Math.abs(Math.round(value / quantum) * quantum - value) > 1e-9) {
        issues.push(
          issue(
            'malformed-distribution',
            `Configuration "${id}", image "${imageId}": value ${value} is not stored at the declared ${encoding.decimals} decimals.`,
            imageId,
          ),
        )
        return undefined
      }
      sum += value
    }
    if (Math.abs(sum - 1) > encoding.sumTolerance) {
      issues.push(
        issue(
          'malformed-distribution',
          `Configuration "${id}", image "${imageId}": probabilities sum to ${sum}, outside the declared tolerance of ${encoding.sumTolerance}.`,
          imageId,
        ),
      )
      return undefined
    }
  }

  return raw as SplitPredictions
}

/**
 * Reads one configuration's file against the index that named it and the pool it covers.
 *
 * `imageIds` is the manifest's own enumeration per split, so completeness is judged
 * against the pool rather than against whatever the file happens to contain.
 *
 * `tierImages` is the same enumeration narrowed per dataset tier. Passed in rather than
 * derived, for the same reason: only the pool knows which photographs a tier holds. A
 * caller that omits it holds the configuration to the whole training split, which is what
 * the contract said before tiers existed and what a tier spanning it still means.
 */
export function readConfigurationFile(
  raw: unknown,
  declaration: TaskDeclaration,
  index: LoadedIndex,
  configurationId: string,
  imageIds: Readonly<Record<string, readonly string[]>>,
  tierImages?: Readonly<Record<string, readonly string[]>>,
): EntryValidation {
  const issues: ValidationIssue[] = []
  const record = index.configurations[configurationId]
  if (record === undefined) {
    const missing = coverageIssue(index, configurationId)
    return { ok: false, issues: missing === undefined ? [] : [missing] }
  }

  if (!isRecord(raw)) {
    return {
      ok: false,
      issues: [issue('data-malformed', `Configuration "${configurationId}" is not an object.`, configurationId)],
    }
  }

  if (raw.configurationId !== configurationId) {
    issues.push(
      issue(
        'artifact-configuration-mismatch',
        `A file listed for "${configurationId}" identifies itself as "${String(raw.configurationId)}".`,
        configurationId,
      ),
    )
  }
  if (raw.taskId !== declaration.id) {
    issues.push(
      issue(
        'artifact-task-mismatch',
        `Configuration "${configurationId}" belongs to task "${String(raw.taskId)}", not "${declaration.id}".`,
        configurationId,
      ),
    )
  }
  if (raw.familyId !== index.familyId) {
    issues.push(
      issue(
        'artifact-family-mismatch',
        `Configuration "${configurationId}" belongs to model family "${String(raw.familyId)}", not "${index.familyId}".`,
        configurationId,
      ),
    )
  }
  const version = checkArtifactVersion(declaration.schemaVersion, String(raw.schemaVersion))
  if (!version.ok) issues.push(version.issue)

  for (const field of truthFieldsIn(raw)) {
    issues.push(
      issue(
        'artifact-states-truth',
        `Configuration "${configurationId}" carries field "${field}", which names a category as true or an action as chosen.`,
        field,
      ),
    )
  }

  if (issues.length > 0) return { ok: false, issues }

  // A record that counts no steps describes a configuration with no run to replay, and
  // its file carries no history. The two statements must agree in both directions: a
  // history beside a record that counts nothing is as much a disagreement as a record
  // counting forty beside a history of ten, and neither is repaired into the other.
  let history: readonly TrainingStep[] | undefined
  if (record.steps === undefined) {
    if (raw.history !== undefined) {
      issues.push(
        issue(
          'history-length-mismatch',
          `Configuration "${configurationId}" records no steps but carries a history, so nothing can say how long its run was.`,
          configurationId,
        ),
      )
    }
  } else {
    history = readHistory(configurationId, raw.history, record.steps, issues)
  }
  const predictions: Record<string, SplitPredictions> = {}
  const rows = isRecord(raw.predictions) ? raw.predictions : undefined
  if (rows === undefined) {
    issues.push(
      issue('missing-field', `Configuration "${configurationId}" carries no predictions.`, configurationId),
    )
  } else {
    for (const [split, ids] of Object.entries(imageIds)) {
      // A configuration covers its own tier's training images and the whole evaluation
      // pool. Carrying the rest of a large training split would pay for pictures its
      // student cannot browse and its workshop never reports on — `prediction-artifacts`.
      const held = split === 'training' ? tierImages?.[record.tier] : undefined
      const expected = held ?? ids
      const outside =
        held === undefined
          ? []
          : Object.keys(rows[split] ?? {}).filter(
              (imageId) => !held.includes(imageId) && ids.includes(imageId),
            )
      if (outside.length > 0) {
        issues.push(
          issue(
            'image-outside-tier',
            `Configuration "${configurationId}" predicts training image "${String(outside[0])}", which dataset tier "${record.tier}" does not hold.`,
            configurationId,
          ),
        )
        continue
      }
      const split_ = readSplit(
        configurationId,
        split,
        rows[split],
        expected,
        index.encoding,
        index.categories.length,
        issues,
      )
      if (split_ !== undefined) predictions[split] = split_
    }
    for (const split of Object.keys(rows)) {
      if (imageIds[split] === undefined) {
        issues.push(
          issue(
            'unknown-split',
            `Configuration "${configurationId}" predicts split "${split}", which the pool does not declare.`,
            configurationId,
          ),
        )
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    entry: {
      ...(history === undefined ? {} : { history }),
      predictions: predictions as ConfigurationEntry['predictions'],
    },
  }
}

/**
 * Load-time validation of an image pool manifest.
 *
 * The manifest is static data, so a malformed one can ship — the same reasoning as
 * `src/task/validate.ts`, and the same behaviour: every failure refuses and names its
 * cause rather than repairing it or reading around it. A pool that half-loads is the
 * worst outcome available here, because the harvest would score whichever images
 * happened to survive and report a plausible number for them.
 *
 * The manifest is also the only place an image's true category is written. Nothing in
 * here may fall back to a label from the prediction artifact, because the artifact is
 * required not to carry one.
 *
 * See openspec/changes/dataset-generation/specs/image-pool/spec.md.
 */

import type { CategoryId, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'

/** The splits a pool declares, named as the prediction artifact names them. */
export const POOL_SPLITS = ['training', 'pool'] as const
export type PoolSplit = (typeof POOL_SPLITS)[number]

/**
 * The role a training image plays while a model is fitted.
 *
 * Roles live *inside* the training split and are deliberately not members of
 * `POOL_SPLITS`: all 200 training images stay browsable and stay under the `training`
 * key of a prediction artifact, whichever role they play. A third split name here would
 * be the mistake the spec spends a whole requirement refusing.
 */
export const TRAINING_ROLES = ['fitted', 'heldOut'] as const
export type TrainingRole = (typeof TRAINING_ROLES)[number]

/** Every field an atlas descriptor must carry. */
export const REQUIRED_ATLAS_FIELDS = [
  'file',
  'split',
  'width',
  'height',
  'cellSize',
  'grid',
  'capacity',
] as const

/** Every attribute an image must record. */
export const REQUIRED_ATTRIBUTES = [
  'hue',
  'roundness',
  'gloss',
  'lighting',
  'wormVisibility',
] as const

export interface PoolAtlas {
  readonly file: string
  readonly split: PoolSplit
  readonly width: number
  readonly height: number
  readonly cellSize: number
  readonly grid: number
  readonly capacity: number
}

export interface PoolImage {
  readonly split: PoolSplit
  readonly category: CategoryId
  readonly attributes: Readonly<Record<(typeof REQUIRED_ATTRIBUTES)[number], number>>
  readonly atlas: string
  readonly cell: number
  /** Training images only. An evaluation-pool image carrying one is refused. */
  readonly role?: TrainingRole
}

/** A pool that loaded, with the lookups its consumers need. */
export interface LoadedPool {
  readonly poolId: string
  readonly schemaVersion: string
  /** The seed the pool was generated from, which a prediction artifact is bound to. */
  readonly seed: number
  readonly atlases: Readonly<Record<string, PoolAtlas>>
  readonly images: Readonly<Record<string, PoolImage>>
  /** True category per image id — the only source of ground truth in the system. */
  readonly truth: Readonly<Record<string, CategoryId>>
  /** Image ids per split, in the manifest's order, which never varies. */
  readonly order: Readonly<Record<PoolSplit, readonly string[]>>
  /**
   * Training image ids per role, in the same order.
   *
   * Kept beside `order` rather than inside it: `order` is keyed by split, and a reader
   * enumerating its keys must find two splits, not four.
   */
  readonly roles: Readonly<Record<TrainingRole, readonly string[]>>
}

export type PoolValidation =
  | { readonly ok: true; readonly pool: LoadedPool }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

/** The pixel region an image occupies, derived from its atlas and cell. */
export function regionFor(
  pool: LoadedPool,
  imageId: string,
): { readonly x: number; readonly y: number; readonly size: number } | undefined {
  const image = pool.images[imageId]
  if (image === undefined) return undefined
  const atlas = pool.atlases[image.atlas]
  if (atlas === undefined) return undefined
  return {
    x: (image.cell % atlas.grid) * atlas.cellSize,
    y: Math.floor(image.cell / atlas.grid) * atlas.cellSize,
    size: atlas.cellSize,
  }
}

function readAtlases(
  raw: unknown,
  issues: ValidationIssue[],
): Readonly<Record<string, PoolAtlas>> {
  if (!isRecord(raw)) {
    issues.push(issue('missing-field', 'The pool declares no atlases.', 'atlases'))
    return {}
  }

  const atlases: Record<string, PoolAtlas> = {}
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      issues.push(issue('malformed-entry', `Atlas "${id}" is not an object.`, `atlases.${id}`))
      continue
    }
    let complete = true
    for (const field of REQUIRED_ATLAS_FIELDS) {
      if (value[field] === undefined) {
        issues.push(
          issue('missing-field', `Atlas "${id}" declares no ${field}.`, `atlases.${id}.${field}`),
        )
        complete = false
      }
    }
    if (!complete) continue

    if (!POOL_SPLITS.includes(value.split as PoolSplit)) {
      issues.push(
        issue(
          'unknown-split',
          `Atlas "${id}" serves split "${String(value.split)}", which is not a declared split.`,
          `atlases.${id}.split`,
        ),
      )
      continue
    }
    const atlas = value as unknown as PoolAtlas
    if (atlas.grid * atlas.cellSize !== atlas.width) {
      issues.push(
        issue(
          'malformed-atlas',
          `Atlas "${id}" declares a ${atlas.grid}x${atlas.grid} grid of ${atlas.cellSize}px cells, which does not fill its ${atlas.width}px width.`,
          `atlases.${id}.grid`,
        ),
      )
      continue
    }
    atlases[id] = atlas
  }
  return atlases
}

function readImage(
  id: string,
  value: unknown,
  atlases: Readonly<Record<string, PoolAtlas>>,
  categories: readonly CategoryId[],
  issues: ValidationIssue[],
): PoolImage | undefined {
  if (!isRecord(value)) {
    issues.push(issue('malformed-entry', `Image "${id}" is not an object.`, id))
    return undefined
  }

  let complete = true
  for (const field of ['split', 'category', 'attributes', 'atlas', 'cell'] as const) {
    if (value[field] === undefined) {
      issues.push(issue('missing-field', `Image "${id}" declares no ${field}.`, id))
      complete = false
    }
  }
  if (!complete) return undefined

  if (!POOL_SPLITS.includes(value.split as PoolSplit)) {
    issues.push(
      issue(
        'unknown-split',
        `Image "${id}" belongs to split "${String(value.split)}", which is not a declared split.`,
        id,
      ),
    )
    return undefined
  }
  if (!categories.includes(value.category as CategoryId)) {
    issues.push(
      issue(
        'unknown-category',
        `Image "${id}" declares category "${String(value.category)}", which the task does not declare.`,
        id,
      ),
    )
    return undefined
  }

  if (!isRecord(value.attributes)) {
    issues.push(issue('malformed-field', `Image "${id}" declares no attributes.`, id))
    return undefined
  }
  for (const attribute of REQUIRED_ATTRIBUTES) {
    const recorded = value.attributes[attribute]
    if (typeof recorded !== 'number' || !Number.isFinite(recorded)) {
      issues.push(
        issue(
          'malformed-field',
          `Image "${id}" records no usable ${attribute}; the split gap cannot be checked without it.`,
          id,
        ),
      )
      return undefined
    }
  }

  const atlas = atlases[String(value.atlas)]
  if (atlas === undefined) {
    issues.push(
      issue('unknown-atlas', `Image "${id}" names atlas "${String(value.atlas)}", which the pool does not declare.`, id),
    )
    return undefined
  }
  if (atlas.split !== value.split) {
    issues.push(
      issue(
        'split-mismatch',
        `Image "${id}" is in split "${String(value.split)}" but its atlas "${String(value.atlas)}" serves "${atlas.split}".`,
        id,
      ),
    )
    return undefined
  }

  // The role is the training split's alone. Both mistakes are silent if permitted: a
  // role on an evaluation image suggests a validation loss measured over images no
  // training run ever saw, and a training image without one belongs to neither role, so
  // the losses would quietly be measured over a subset of what the manifest declares.
  if (value.split === 'training') {
    if (value.role === undefined) {
      issues.push(
        issue('missing-role', `Training image "${id}" declares no role.`, id),
      )
      return undefined
    }
    if (!TRAINING_ROLES.includes(value.role as TrainingRole)) {
      issues.push(
        issue(
          'unknown-role',
          `Training image "${id}" declares role "${String(value.role)}", which is not a declared role.`,
          id,
        ),
      )
      return undefined
    }
  } else if (value.role !== undefined) {
    issues.push(
      issue(
        'role-outside-training',
        `Image "${id}" is in split "${String(value.split)}" but declares training role "${String(value.role)}".`,
        id,
      ),
    )
    return undefined
  }

  const cell = value.cell
  if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell >= atlas.capacity) {
    issues.push(
      issue(
        'cell-out-of-bounds',
        `Image "${id}" sits at cell ${String(cell)} of atlas "${String(value.atlas)}", which holds ${atlas.capacity} cells.`,
        id,
      ),
    )
    return undefined
  }

  return value as unknown as PoolImage
}

/**
 * Cross-checks a convolutional task's declared input resolution against the images.
 *
 * The resolution is declared on the task rather than read from here because a
 * declaration is validated at load while a manifest arrives asynchronously — deriving it
 * would move a structural check into render time, where nothing can refuse. Declaring it
 * costs the possibility of disagreement, which is what this check spends. The two
 * disagreeing means either the drawing states spatial sizes the model does not have, or
 * the model is built for images this pool does not contain; both are silent wrongness of
 * the kind the whole loader exists to refuse.
 */
function checkInputResolution(
  declaration: TaskDeclaration,
  atlases: Readonly<Record<string, PoolAtlas>>,
  issues: ValidationIssue[],
): void {
  const diagram = declaration.diagram
  if (diagram === undefined || diagram.kind !== 'cnn') return

  for (const [id, atlas] of Object.entries(atlases)) {
    if (atlas.cellSize !== diagram.inputSize) {
      issues.push(
        issue(
          'input-size-mismatch',
          `The task declares a ${diagram.inputSize}px input, but atlas "${id}" provides ${atlas.cellSize}px images.`,
          `atlases.${id}.cellSize`,
        ),
      )
    }
  }
}

/**
 * Checks what the training split declares about its roles against the images assigned.
 *
 * The declared counts exist so that this disagreement is expressible: a manifest whose
 * roles were assigned by one rule and counted by another is a generation mistake, and
 * the alternative — counting the images and calling that the truth — would make the
 * mistake invisible.
 */
function checkRoles(
  declaredTraining: unknown,
  roles: Readonly<Record<TrainingRole, readonly string[]>>,
  images: Readonly<Record<string, PoolImage>>,
  categories: readonly CategoryId[],
  issues: ValidationIssue[],
): void {
  const declaredRoles = isRecord(declaredTraining) ? declaredTraining.roles : undefined
  if (!isRecord(declaredRoles)) {
    issues.push(
      issue(
        'missing-field',
        'The training split declares no roles, so no validation loss can be attributed.',
        'splits.training.roles',
      ),
    )
    return
  }

  for (const role of TRAINING_ROLES) {
    const declared = declaredRoles[role]
    if (!isRecord(declared) || typeof declared.count !== 'number') {
      issues.push(
        issue('missing-field', `Role "${role}" declares no count.`, `splits.training.roles.${role}`),
      )
      continue
    }
    const present = roles[role].length
    if (declared.count !== present) {
      issues.push(
        issue(
          'role-count-mismatch',
          `Role "${role}" declares ${declared.count} images but ${present} are assigned to it.`,
          `splits.training.roles.${role}`,
        ),
      )
    }
    if (present === 0) {
      issues.push(
        issue('empty-role', `Role "${role}" has no images.`, `splits.training.roles.${role}`),
      )
    }
    // A validation loss measured over categories the fitted images do not cover, or a
    // category held out entirely, measures something other than what was trained.
    for (const category of categories) {
      if (!roles[role].some((id) => images[id]?.category === category)) {
        issues.push(
          issue(
            'category-missing-from-role',
            `No image in role "${role}" has category "${category}".`,
            `splits.training.roles.${role}`,
          ),
        )
      }
    }
  }
}

/**
 * Reads a manifest against the task that references it.
 *
 * The declaration is a parameter rather than an assumption because three of the
 * requirements are about agreement between the two: the pool id, the schema version, and
 * the categories. Checking them here means a mismatch is caught once, at load, instead of
 * surfacing later as a missing category or an unexplained refusal mid-harvest.
 *
 * Note on the "an image in two splits" case: this encoding keys images by id, so an image
 * cannot appear twice. What is checked instead is that each image names a declared split
 * and that each split's declared count matches the images actually present.
 */
export function readPool(raw: unknown, declaration: TaskDeclaration): PoolValidation {
  const issues: ValidationIssue[] = []

  if (!isRecord(raw)) {
    return { ok: false, issues: [issue('malformed-manifest', 'The pool manifest is not an object.')] }
  }

  for (const field of ['poolId', 'schemaVersion', 'seed', 'splits', 'atlases', 'images'] as const) {
    if (raw[field] === undefined) {
      issues.push(issue('missing-field', `The pool manifest declares no ${field}.`, field))
    }
  }
  if (issues.length > 0) return { ok: false, issues }

  if (raw.poolId !== declaration.pool) {
    issues.push(
      issue(
        'pool-mismatch',
        `The task references pool "${declaration.pool}", but this manifest declares "${String(raw.poolId)}".`,
        'poolId',
      ),
    )
  }
  if (raw.schemaVersion !== declaration.schemaVersion) {
    issues.push(
      issue(
        'pool-version-mismatch',
        `The task declares schema version "${declaration.schemaVersion}", but this pool was generated with "${String(raw.schemaVersion)}".`,
        'schemaVersion',
      ),
    )
  }

  // The seed is what a prediction artifact binds itself to, so an unusable one is
  // refused here rather than surfacing later as an artifact that cannot state which pool
  // it was trained against.
  if (typeof raw.seed !== 'number' || !Number.isFinite(raw.seed)) {
    issues.push(
      issue(
        'malformed-field',
        `The pool manifest records seed "${String(raw.seed)}", which is not a number.`,
        'seed',
      ),
    )
  }

  const atlases = readAtlases(raw.atlases, issues)
  checkInputResolution(declaration, atlases, issues)

  if (!isRecord(raw.images)) {
    issues.push(issue('malformed-field', 'The pool manifest declares no images.', 'images'))
    return { ok: false, issues }
  }

  const categories = declaration.categories.map((category) => category.id)
  const images: Record<string, PoolImage> = {}
  const truth: Record<string, CategoryId> = {}
  const order: Record<PoolSplit, string[]> = { training: [], pool: [] }
  const roles: Record<TrainingRole, string[]> = { fitted: [], heldOut: [] }

  for (const [id, value] of Object.entries(raw.images)) {
    const image = readImage(id, value, atlases, categories, issues)
    if (image === undefined) continue
    images[id] = image
    truth[id] = image.category
    order[image.split].push(id)
    if (image.role !== undefined) roles[image.role].push(id)
  }

  if (!isRecord(raw.splits)) {
    issues.push(issue('malformed-field', 'The pool manifest declares no splits.', 'splits'))
    return { ok: false, issues }
  }

  // Exactly two splits. A third one is not a harmless extra key: whatever produced it
  // believes there is a population this reader will never present or score.
  for (const declaredSplit of Object.keys(raw.splits)) {
    if (!POOL_SPLITS.includes(declaredSplit as PoolSplit)) {
      issues.push(
        issue(
          'unknown-split',
          `The pool manifest declares split "${declaredSplit}", which is not a declared split.`,
          `splits.${declaredSplit}`,
        ),
      )
    }
  }

  for (const split of POOL_SPLITS) {
    const declared = raw.splits[split]
    if (!isRecord(declared) || typeof declared.count !== 'number') {
      issues.push(issue('missing-field', `Split "${split}" declares no count.`, `splits.${split}`))
      continue
    }
    const present = order[split].length
    if (declared.count !== present) {
      issues.push(
        issue(
          'split-count-mismatch',
          `Split "${split}" declares ${declared.count} images but ${present} are described.`,
          `splits.${split}`,
        ),
      )
    }
    // Both splits must carry every category, or training and harvest performance
    // stop being comparable per category.
    for (const category of categories) {
      if (!order[split].some((id) => images[id]?.category === category)) {
        issues.push(
          issue(
            'category-missing-from-split',
            `No image in split "${split}" has category "${category}".`,
            `splits.${split}`,
          ),
        )
      }
    }
  }

  checkRoles(raw.splits.training, roles, images, categories, issues)

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    pool: {
      poolId: String(raw.poolId),
      schemaVersion: String(raw.schemaVersion),
      seed: Number(raw.seed),
      atlases,
      images,
      truth,
      order: { training: order.training, pool: order.pool },
      roles: { fitted: roles.fitted, heldOut: roles.heldOut },
    },
  }
}

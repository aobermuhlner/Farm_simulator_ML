/**
 * Builds the pool manifest.
 *
 * `specs/image-pool/spec.md` — the manifest is the only source of ground truth, so this
 * is where an image's true category is written and the prediction artifact is not
 * allowed to repeat it. It is also what makes the authored gap checkable: the attributes
 * every image was drawn from are recorded, not just its label.
 *
 * Cell position is stored as an atlas id plus a cell index rather than pixel
 * coordinates. The atlas descriptor carries the cell size and the grid, so a region is
 * derived, and "outside the atlas" reduces to `cell >= capacity` — one comparison
 * instead of four numbers a generator could get wrong.
 */

import type { ImageAttributes } from './bands.js'
import type { FeatureVector } from './features.js'
import { ATLAS_GRID, cellOrigin, type AtlasPlan } from './atlas.js'
import {
  ATLAS_PX,
  CELLS_PER_ATLAS,
  CELL_PX,
  POOL_ID,
  SEED,
  SPLIT_SIZES,
  type PoolCategory,
  type SplitName,
  type TrainingRole,
} from './params.js'
import { assertRolesCanShowTheGap, roleCounts, rolesOf } from './roles.js'

/** How one atlas file is described to a client. */
export interface AtlasDescriptor {
  readonly file: string
  readonly split: SplitName
  readonly width: number
  readonly height: number
  readonly cellSize: number
  readonly grid: number
  readonly capacity: number
}

/**
 * One image's entry: its truth, what it was drawn from, and where its pixels are.
 *
 * `role` is written for training images only. An evaluation-pool image playing a
 * training role is a contradiction the reader refuses, so it is not expressible here
 * either — the field is absent rather than set to something meaningless.
 */
export interface ManifestImage {
  readonly split: SplitName
  readonly category: PoolCategory
  readonly attributes: ImageAttributes
  /**
   * What the delivered pixels turn out to look like when somebody measures them.
   *
   * `specs/image-pool/spec.md` — the manifest now carries three kinds of number per
   * image and they are not interchangeable. The category is ground truth, the attributes
   * are what produced the pixels, and these are an observation of the result. Recorded
   * here so the observation is made once and made identically for everything that
   * consumes the pool, rather than in a browser where two devices could disagree.
   */
  readonly features: FeatureVector
  readonly atlas: string
  readonly cell: number
  readonly role?: TrainingRole
}

/** What a split declares about itself. */
export interface SplitDescriptor {
  readonly count: number
}

/**
 * The training split additionally declares how its images divide between the roles.
 *
 * Declared rather than counted so the reader has something to disagree with: a count
 * that does not match the images assigned to it is a generation mistake worth refusing
 * loudly, and there would be nothing to check if the file only listed the roles.
 */
export interface TrainingSplitDescriptor extends SplitDescriptor {
  readonly roles: Readonly<Record<TrainingRole, SplitDescriptor>>
}

/** The manifest as it is written to disk. */
export interface PoolManifestFile {
  readonly poolId: string
  readonly schemaVersion: string
  readonly seed: number
  readonly splits: {
    readonly training: TrainingSplitDescriptor
    readonly pool: SplitDescriptor
  }
  readonly atlases: Readonly<Record<string, AtlasDescriptor>>
  readonly images: Readonly<Record<string, ManifestImage>>
}

/** The file name an atlas is written under. */
export function atlasFile(id: string): string {
  return `${id}.png`
}

/**
 * Why this declaration and this generator disagree, or `undefined` if they do not.
 *
 * The generator refuses to write a pool the task declaration does not point at, because
 * a manifest stamped with the wrong id or version is worse than no manifest: the reader
 * would refuse it at load and the cause would look like a runtime bug rather than a
 * generation mistake.
 */
export function declarationDisagreement(
  declaration: { readonly pool?: unknown; readonly schemaVersion?: unknown },
  poolId: string = POOL_ID,
): string | undefined {
  if (declaration.pool !== poolId) {
    return `the declaration references pool "${String(declaration.pool)}", but this generator writes "${poolId}"`
  }
  if (typeof declaration.schemaVersion !== 'string' || declaration.schemaVersion === '') {
    return 'the declaration declares no schemaVersion, so the pool cannot be stamped with one'
  }
  return undefined
}

/**
 * Assembles the manifest from the atlas plans.
 *
 * Images are written in id order, which is also the order the training split enumerates
 * in — the spec requires that order to be stable, and taking it from the file rather
 * than recomputing it means there is only one order to be stable.
 */
export function buildManifest(
  plans: readonly AtlasPlan[],
  schemaVersion: string,
  features: Readonly<Record<string, FeatureVector>>,
): PoolManifestFile {
  const atlases: Record<string, AtlasDescriptor> = {}
  const images: Record<string, ManifestImage> = {}

  // Roles are read here, from the images the plans already hold, so the generator has one
  // order to be stable in and the caller cannot pass an assignment made from a different
  // sample. The sampler decided them; this checks that what it decided can still show a
  // generalization gap before the pool is written.
  const sampled = plans.flatMap((plan) => plan.images)
  assertRolesCanShowTheGap(sampled)
  const roles = rolesOf(sampled)
  const counts = roleCounts(roles)

  for (const plan of plans) {
    atlases[plan.id] = {
      file: atlasFile(plan.id),
      split: plan.split,
      width: ATLAS_PX,
      height: ATLAS_PX,
      cellSize: CELL_PX,
      grid: ATLAS_GRID,
      capacity: CELLS_PER_ATLAS,
    }
    plan.images.forEach((image, cell) => {
      const role: TrainingRole | undefined = roles[image.id]
      // A manifest missing one image's feature vector is refused at load, so the
      // generator refuses to write one at all: the cause is legible here and would look
      // like a runtime bug there.
      const measured = features[image.id]
      if (measured === undefined) {
        throw new Error(`no feature vector was measured for image "${image.id}"`)
      }
      images[image.id] = {
        split: image.split,
        category: image.category,
        attributes: image.attributes,
        features: measured,
        atlas: plan.id,
        cell,
        ...(role === undefined ? {} : { role }),
      }
    })
  }

  return {
    poolId: POOL_ID,
    schemaVersion,
    seed: SEED,
    splits: {
      training: {
        count: SPLIT_SIZES.training,
        roles: {
          fitted: { count: counts.fitted },
          heldOut: { count: counts.heldOut },
        },
      },
      pool: { count: SPLIT_SIZES.pool },
    },
    atlases,
    images,
  }
}

/** The pixel region a manifest entry refers to, for a client that wants it spelled out. */
export function regionOf(
  manifest: PoolManifestFile,
  imageId: string,
): { readonly x: number; readonly y: number; readonly size: number } | undefined {
  const image = manifest.images[imageId]
  if (image === undefined) return undefined
  const atlas = manifest.atlases[image.atlas]
  if (atlas === undefined) return undefined
  const { x, y } = cellOrigin(image.cell)
  return { x, y, size: atlas.cellSize }
}

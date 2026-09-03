/**
 * A task's training split, in the shape a screen can draw.
 *
 * Fetched here rather than in `loadTask` — `design.md`. Adding it to the farm's startup
 * path would put a 338 KB manifest and a 544 KB atlas in front of the first paint of the
 * overview, for a view a student opens once and may not open at all.
 *
 * The view built below carries image ids, categories, labels and atlas regions, and
 * nothing else. The generation attributes the manifest records are dropped at this
 * boundary rather than merely left unrendered: the distribution difference between the
 * splits is what the lessons exist to teach, so a screen that could print one of those
 * numbers is one edit away from giving the lesson away.
 *
 * No geometry is invented here either. `regionFor` in the pool reader resolves an image's
 * cell to pixels and everything below passes that through, so a shape problem is fixed in
 * `src/pool/` where the refusals already live.
 */

import type { LoadedPool } from '../../../src/pool/index.js'
import { readPool, regionFor } from '../../../src/pool/index.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import { dataUrl, fetchJson, type Loaded } from './load.js'
import type { PoolPaths } from './paths.js'

/** One image of a split, with what it takes to draw it and nothing more. */
export interface SplitImageView {
  readonly imageId: string
  readonly category: CategoryId
  /** The label the task declares for this image's true category. */
  readonly label: string
  readonly atlasUrl: string
  readonly atlasWidth: number
  readonly atlasHeight: number
  /** Top-left of this image's cell within its atlas, in atlas pixels. */
  readonly x: number
  readonly y: number
  readonly cellSize: number
}

/** A declared category, so a screen can state a split's composition in order. */
export interface SplitCategoryView {
  readonly id: CategoryId
  readonly label: string
}

export interface TrainingSplitView {
  readonly categories: readonly SplitCategoryView[]
  readonly images: readonly SplitImageView[]
}

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

/**
 * Projects a loaded pool's training split onto its task's vocabulary.
 *
 * Refuses rather than skipping an image it cannot place or label. The reader has already
 * rejected any manifest that would get here, so this is unreachable — but a grid quietly
 * one image short is precisely the half-drawn outcome the refusals exist to prevent, and
 * that promise should not rest on a loop that drops what it cannot handle.
 */
export function trainingSplitView(
  pool: LoadedPool,
  declaration: TaskDeclaration,
  atlases: string,
): Loaded<TrainingSplitView> {
  const labels = new Map(declaration.categories.map((category) => [category.id, category.label]))
  const images: SplitImageView[] = []

  for (const imageId of pool.order.training) {
    const image = pool.images[imageId]
    const region = regionFor(pool, imageId)
    const atlas = image === undefined ? undefined : pool.atlases[image.atlas]
    const label = image === undefined ? undefined : labels.get(image.category)

    if (image === undefined || region === undefined || atlas === undefined || label === undefined) {
      return {
        ok: false,
        issues: [
          issue(
            'image-unplaceable',
            `Image "${imageId}" cannot be placed in an atlas this pool declares, or carries a category this task does not.`,
            imageId,
          ),
        ],
      }
    }

    images.push({
      imageId,
      category: image.category,
      label,
      atlasUrl: dataUrl(`${atlases}/${atlas.file}`),
      atlasWidth: atlas.width,
      atlasHeight: atlas.height,
      x: region.x,
      y: region.y,
      cellSize: region.size,
    })
  }

  return {
    ok: true,
    value: {
      categories: declaration.categories.map((category) => ({
        id: category.id,
        label: category.label,
      })),
      images,
    },
  }
}

/**
 * Fetches a task's pool manifest and reads it against that task.
 *
 * Every failure comes back as issues naming their cause — an unreachable manifest, a
 * mismatched pool id or schema version, an image the pool cannot place — because the
 * browser renders a refusal as content the way every other screen does.
 */
export async function loadTrainingSplit(
  paths: PoolPaths,
  declaration: TaskDeclaration,
): Promise<Loaded<TrainingSplitView>> {
  const raw = await fetchJson(paths.manifest)
  if (!raw.ok) return raw

  const read = readPool(raw.value, declaration)
  if (!read.ok) return { ok: false, issues: read.issues }

  return trainingSplitView(read.pool, declaration, paths.atlases)
}

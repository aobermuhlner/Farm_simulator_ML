/**
 * Where task data lives, for the app and for the build.
 *
 * `design.md` — declarations and fixtures are fetched at runtime, never
 * imported into the bundle, so that the app exercises the runtime validator on
 * real input and adding a lesson stays a data change. These constants are the
 * single place that knows the mapping; `vite.config.ts` serves and copies from
 * the same table.
 */

/** URL mount to repo-relative source directory. */
export const DATA_MOUNTS = {
  'data/declarations': 'declarations',
  'data/fixtures': 'test/fixtures',
  'data/pools': 'pools',
} as const

/**
 * The content type a served data file is sent with.
 *
 * The dev middleware sent `application/json` for everything, which held only while every
 * mounted file was JSON. The image pool mounts PNG atlases, and a PNG served as JSON is
 * a broken image with no error to explain it.
 */
export function contentTypeFor(path: string): string {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

/**
 * The task data this build ships. Paths are relative, for a Pages subpath.
 *
 * `applePool` stays on the fixture deliberately: the shipped prediction fixture is keyed
 * to the fixture's ten image ids, so a run scored over the generated pool would refuse
 * every image. The generated pool is what the training browser reads, which needs no
 * predictions to be worth looking at. `prediction-artifacts` is what closes that gap.
 *
 * The atlas entry is a directory rather than a file because a manifest names its own
 * atlas files; the URL is that prefix joined to the name the manifest gives.
 */
export const DATA_URLS = {
  appleDeclaration: 'data/declarations/apple-harvest.json',
  applePredictions: 'data/fixtures/apple-predictions.json',
  applePool: 'data/fixtures/apple-pool.json',
  applePoolManifest: 'data/pools/apple-harvest/manifest.json',
  applePoolAtlases: 'data/pools/apple-harvest',
} as const

/** Where a generated pool's manifest and its atlas images are served from. */
export interface PoolPaths {
  readonly manifest: string
  readonly atlases: string
}

/** The files one task is made of. */
export interface TaskDataPaths {
  readonly declaration: string
  readonly predictions: string
  readonly pool: string
  /**
   * The generated pool the training browser reads, when the task ships one.
   *
   * Optional because it is fetched lazily and separately from the three files a task
   * needs before it can be run at all: a task with no generated pool still loads,
   * configures and scores, and simply offers nothing to browse.
   */
  readonly generatedPool?: PoolPaths
}

/**
 * Which tasks this build ships.
 *
 * This is the only place in `web/` that names a particular lesson. The screens
 * and the loader work from whatever this list contains, which is what keeps
 * adding a lesson a data change.
 */
export const SHIPPED_TASKS: readonly TaskDataPaths[] = [
  {
    declaration: DATA_URLS.appleDeclaration,
    predictions: DATA_URLS.applePredictions,
    pool: DATA_URLS.applePool,
    generatedPool: {
      manifest: DATA_URLS.applePoolManifest,
      atlases: DATA_URLS.applePoolAtlases,
    },
  },
]

/** The on-disk file a data URL is served from, relative to the repo root. */
export function sourcePathFor(url: string): string | undefined {
  for (const [mount, dir] of Object.entries(DATA_MOUNTS)) {
    if (url.startsWith(`${mount}/`)) return `${dir}/${url.slice(mount.length + 1)}`
  }
  return undefined
}

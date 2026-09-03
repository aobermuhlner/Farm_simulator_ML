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

/** The task data this build ships. Paths are relative, for a Pages subpath. */
export const DATA_URLS = {
  appleDeclaration: 'data/declarations/apple-harvest.json',
  applePredictions: 'data/fixtures/apple-predictions.json',
  applePool: 'data/fixtures/apple-pool.json',
} as const

/** The three files one task is made of. */
export interface TaskDataPaths {
  readonly declaration: string
  readonly predictions: string
  readonly pool: string
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
  },
]

/** The on-disk file a data URL is served from, relative to the repo root. */
export function sourcePathFor(url: string): string | undefined {
  for (const [mount, dir] of Object.entries(DATA_MOUNTS)) {
    if (url.startsWith(`${mount}/`)) return `${dir}/${url.slice(mount.length + 1)}`
  }
  return undefined
}

/**
 * Where task data lives, for the app and for the build.
 *
 * `design.md` — declarations and artifacts are fetched at runtime, never imported into
 * the bundle, so that the app exercises the runtime validator on real input and adding a
 * lesson stays a data change. These constants are the single place that knows the
 * mapping; `vite.config.ts` serves and copies from the same table.
 *
 * A task's pool and its prediction artifact are *derived* from the declaration rather
 * than listed beside it. The declaration already names both (`pool`, `predictions`), and
 * a second copy here could disagree with it — which is how a build ends up browsing one
 * pool and scoring another.
 */

/** URL mount to repo-relative source directory. */
export const DATA_MOUNTS = {
  'data/declarations': 'declarations',
  'data/pools': 'pools',
  'data/artifacts': 'artifacts',
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

/** Where a generated pool's manifest and its atlas images are served from. */
export interface PoolPaths {
  readonly manifest: string
  readonly atlases: string
}

/**
 * The files one task is made of.
 *
 * One `pool` entry, not two. The images a student browses and the images a run is scored
 * over are the same pool by construction here, which is a requirement of
 * `prediction-artifacts` and cheaper to keep true in the type than in review.
 */
export interface TaskDataPaths {
  readonly declaration: string
  readonly pool: PoolPaths
  /** The artifact index; one file per configuration sits beside it. */
  readonly predictions: string
}

/**
 * Which tasks this build ships, as the declarations that describe them.
 *
 * This is the only place in `web/` that names a particular lesson. Everything else about
 * a task comes out of the file named here.
 */
export const SHIPPED_TASKS: readonly string[] = ['data/declarations/apple-harvest.json']

/** The on-disk file a data URL is served from, relative to the repo root. */
export function sourcePathFor(url: string): string | undefined {
  for (const [mount, dir] of Object.entries(DATA_MOUNTS)) {
    if (url.startsWith(`${mount}/`)) return `${dir}/${url.slice(mount.length + 1)}`
  }
  return undefined
}

/**
 * The URL a repo-relative path is served at — the inverse of `sourcePathFor`.
 *
 * Undefined for a path no mount covers, which is what makes a declaration pointing at
 * unserved data a refusal rather than a 404 at run time.
 */
export function dataUrlFor(sourcePath: string): string | undefined {
  for (const [mount, dir] of Object.entries(DATA_MOUNTS)) {
    if (sourcePath === dir) return mount
    if (sourcePath.startsWith(`${dir}/`)) return `${mount}/${sourcePath.slice(dir.length + 1)}`
  }
  return undefined
}

/** The artifact file a configuration record names, beside its index. */
export function configurationUrl(predictionsUrl: string, file: string): string {
  return `${predictionsUrl.slice(0, predictionsUrl.lastIndexOf('/'))}/${file}`
}

/**
 * Where one task's data is served from, given the declaration that describes it.
 *
 * Refuses by returning undefined rather than guessing a path: a declaration naming a
 * pool or an artifact this build does not serve is a build mistake, and a fabricated URL
 * would turn it into a fetch failure with no cause attached.
 */
export function taskDataPaths(
  declarationUrl: string,
  declaration: { readonly pool: string; readonly predictions: string },
): TaskDataPaths | undefined {
  const pool = dataUrlFor(declaration.pool)
  const predictions = dataUrlFor(declaration.predictions)
  if (pool === undefined || predictions === undefined) return undefined
  return {
    declaration: declarationUrl,
    pool: { manifest: `${pool}/manifest.json`, atlases: pool },
    predictions: `${predictions}/index.json`,
  }
}

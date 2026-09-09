/**
 * Where task data lives, for the app and for the build.
 *
 * `design.md` — declarations and artifacts are fetched at runtime, never imported into
 * the bundle, so that the app exercises the runtime validator on real input and adding a
 * lesson stays a data change. These constants are the single place that knows the
 * mapping; `vite.config.ts` serves and copies from the same table.
 *
 * A task's pool and each family's store are *derived* from the declaration rather than
 * listed beside them. The declaration already names both — `pool` on the task, and
 * `predictions` or `models` on each family — and a second copy here could disagree with
 * it, which is how a build ends up browsing one pool and scoring another.
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
 *
 * One entry per declared family, because each family has its own store and nothing
 * belonging to one may be fetched for another — which is also what keeps selecting a
 * family from transferring the whole ladder.
 */
export interface TaskDataPaths {
  readonly declaration: string
  readonly pool: PoolPaths
  /** Family id to that family's index; one file per configuration sits beside it. */
  readonly families: Readonly<Record<string, string>>
}

/**
 * Which tasks this build ships, as the declarations that describe them.
 *
 * This is the only place in `web/` that names a particular lesson. Everything else about
 * a task comes out of the file named here.
 */
export const SHIPPED_TASKS: readonly string[] = ['data/declarations/apple-harvest.json']

/**
 * The farm itself, declared beside the tasks.
 *
 * One farm, because there is one balance, one year and one ledger across every task.
 * It sits under the same mount, so it is served and copied with no build change.
 */
export const SHIPPED_FARM = 'data/declarations/farm.json'

/**
 * The catalog of everything the farm can buy, declared beside the farm it prices.
 *
 * One catalog, because there is one balance to spend and one set of things to spend it
 * on. It sits under the same mount as the declarations, so it is served and copied with
 * no build change — the same thing `farm.json` proved one change ago.
 */
export const SHIPPED_CATALOG = 'data/declarations/catalog.json'

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

/** The file a configuration record names, beside the index that listed it. */
export function configurationUrl(indexUrl: string, file: string): string {
  return `${indexUrl.slice(0, indexUrl.lastIndexOf('/'))}/${file}`
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
  declaration: {
    readonly pool: string
    readonly families: readonly {
      readonly id: string
      readonly predictions?: string
      readonly models?: string
    }[]
  },
): TaskDataPaths | undefined {
  const pool = dataUrlFor(declaration.pool)
  if (pool === undefined) return undefined

  const families: Record<string, string> = {}
  for (const family of declaration.families) {
    // Whichever the family names — the declaration's own `ships` decides which it has,
    // and the validator has already refused a family carrying neither.
    const directory = dataUrlFor(family.predictions ?? family.models ?? '')
    if (directory === undefined) return undefined
    families[family.id] = `${directory}/index.json`
  }

  return {
    declaration: declarationUrl,
    pool: { manifest: `${pool}/manifest.json`, atlases: pool },
    families,
  }
}

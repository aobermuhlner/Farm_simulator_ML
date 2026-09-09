import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateDeclaration } from '../../../src/task/validate.js'
import { configurationUrl, dataUrlFor, SHIPPED_TASKS, sourcePathFor, taskDataPaths } from './paths.js'

// `import.meta.url` is an http URL under the jsdom environment these screen
// tests run in, so the repo root comes from the runner's working directory.
const repoRoot = process.cwd()

function declarationOf(url: string) {
  const source = sourcePathFor(url)
  if (source === undefined) throw new Error(`no mount serves ${url}`)
  const validated = validateDeclaration(
    JSON.parse(readFileSync(join(repoRoot, source), 'utf8')) as unknown,
  )
  if (!validated.ok) throw new Error(`${url} does not validate`)
  return validated.declaration
}

describe('task data is served as assets, not bundled', () => {
  it('maps every shipped task to files that exist', () => {
    for (const url of SHIPPED_TASKS) {
      const declaration = declarationOf(url)
      const paths = taskDataPaths(url, declaration)
      expect(paths, `no mount serves the data ${declaration.id} names`).toBeDefined()
      if (paths === undefined) continue

      for (const served of [
        paths.declaration,
        paths.pool.manifest,
        ...Object.values(paths.families),
      ]) {
        const source = sourcePathFor(served)
        expect(source, `no mount serves ${served}`).toBeDefined()
        expect(existsSync(join(repoRoot, source ?? '')), `${source} is missing`).toBe(true)
      }
    }
  })

  it('derives a task’s data from the declaration rather than a second list', () => {
    const url = SHIPPED_TASKS[0] ?? ''
    const declaration = declarationOf(url)
    const paths = taskDataPaths(url, declaration)

    expect(paths?.pool.manifest).toBe(`${dataUrlFor(declaration.pool)}/manifest.json`)
    for (const family of declaration.families) {
      expect(paths?.families[family.id]).toBe(
        `${dataUrlFor(family.predictions ?? family.models ?? '')}/index.json`,
      )
    }
  })

  it('browses and scores one pool, because there is only one to name', () => {
    const url = SHIPPED_TASKS[0] ?? ''
    const paths = taskDataPaths(url, declarationOf(url))

    expect(paths?.pool.atlases).toBe(dataUrlFor('pools/apple-harvest'))
    expect(paths?.pool.manifest.startsWith(paths.pool.atlases)).toBe(true)
  })

  it('places a configuration file beside its index', () => {
    expect(
      configurationUrl('data/artifacts/apple/predictions/index.json', 'blocks2-channels8.json'),
    ).toBe('data/artifacts/apple/predictions/blocks2-channels8.json')
  })

  it('refuses a declaration naming data this build serves from nowhere', () => {
    const declaration = {
      pool: 'elsewhere/pool',
      families: [{ id: 'somewhere', predictions: 'elsewhere/predictions' }],
    }
    expect(taskDataPaths('data/declarations/x.json', declaration)).toBeUndefined()
  })

  it('refuses a URL no mount covers', () => {
    expect(sourcePathFor('data/elsewhere/secrets.json')).toBeUndefined()
  })

  it('imports none of that data through the bundler', () => {
    // A bundler import would type-check and bundle, defeating the point: the
    // app must exercise the runtime validator on fetched input.
    const sources = ['App.tsx', 'main.tsx', 'data/paths.ts']
    for (const file of sources) {
      const text = readFileSync(join(repoRoot, 'web/src', file), 'utf8')
      expect(text, `${file} imports task data through the bundler`).not.toMatch(
        /^\s*import[^\n]*\.json['"]/m,
      )
    }
  })
})

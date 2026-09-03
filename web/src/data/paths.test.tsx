import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DATA_URLS, sourcePathFor } from './paths.js'

// `import.meta.url` is an http URL under the jsdom environment these screen
// tests run in, so the repo root comes from the runner's working directory.
const repoRoot = process.cwd()

describe('task data is served as assets, not bundled', () => {
  it('maps every data URL the app uses to a file that exists', () => {
    for (const url of Object.values(DATA_URLS)) {
      const source = sourcePathFor(url)
      expect(source, `no mount serves ${url}`).toBeDefined()
      expect(existsSync(join(repoRoot, source ?? '')), `${source} is missing`).toBe(true)
    }
  })

  it('serves the generated pool manifest from the pool mount', () => {
    expect(sourcePathFor(DATA_URLS.applePoolManifest)).toBe('pools/apple-harvest/manifest.json')
  })

  it('leaves what a run is scored from on the fixture pool', () => {
    // The training browser reads the generated pool; the harvest still does not, because
    // the shipped predictions are keyed to the fixture's image ids.
    expect(DATA_URLS.applePool).toBe('data/fixtures/apple-pool.json')
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

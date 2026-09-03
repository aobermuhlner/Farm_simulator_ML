import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Reads a declaration straight off disk as untyped JSON. Declarations are
 * static data validated at load, so tests deliberately look at the raw shape
 * rather than a conveniently typed import.
 */
export function loadRawDeclaration(name: string): Record<string, unknown> {
  const text = readFileSync(`${repoRoot}declarations/${name}.json`, 'utf8')
  return JSON.parse(text) as Record<string, unknown>
}

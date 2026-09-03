import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { PoolManifestFile } from '../../tools/pool/manifest.js'
import { OUTPUT_DIR } from '../../tools/pool/params.js'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

/**
 * The committed manifest, read off disk.
 *
 * Tests that assert the authored distribution read this rather than re-running the
 * generator, because the point is that the *shipped* pool still has those properties.
 * A generator that drifts from its parameters passes a test over its own output and
 * fails this one.
 */
export function committedManifest(): PoolManifestFile {
  return JSON.parse(readFileSync(`${repoRoot}${OUTPUT_DIR}/manifest.json`, 'utf8')) as PoolManifestFile
}

/** The size in bytes of one committed pool file. */
export function poolFileSize(name: string): number {
  return statSync(`${repoRoot}${OUTPUT_DIR}/${name}`).size
}

/** The bytes of one committed pool file. */
export function poolFile(name: string): Buffer {
  return readFileSync(`${repoRoot}${OUTPUT_DIR}/${name}`)
}

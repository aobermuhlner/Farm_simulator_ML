/**
 * Generates the apple pool: atlases plus the manifest that describes them.
 *
 * Run with `npm run pool:generate`. Output is committed, so a run that changes nothing
 * must leave the working tree clean — see `design.md`, which makes that the practical
 * test of reproducibility.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

import { cellPixels, planAtlases, rasterizeAtlas } from './atlas.js'
import { measureCell, type FeatureVector } from './features.js'
import { atlasFile, buildManifest, declarationDisagreement } from './manifest.js'
import { CELL_PX, OUTPUT_DIR, POOL_ID, SEED } from './params.js'
import { samplePool } from './sample.js'

// `import.meta.dirname` needs Node 20.11+; this form works on the Node 18 the project's
// `engines` field still allows, the same way `vite.config.ts` does it.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Proves the rasterizer is usable on this Node before any real work depends on it.
 *
 * `@resvg/resvg-js` ships prebuilt binaries, which is why it was chosen over `sharp` or
 * `node-canvas`: the project's `engines` field still allows Node 18 and no contributor
 * should need a toolchain to regenerate apples.
 */
export function rasterizerSelfCheck(): number {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_PX}" height="${CELL_PX}"><circle cx="64" cy="64" r="48" fill="#c0392b"/></svg>`
  return new Resvg(svg).render().asPng().byteLength
}

/** The schema version the pool is stamped with, taken from the task that consumes it. */
async function declaredSchemaVersion(): Promise<string> {
  const path = join(repoRoot, 'declarations', 'apple-harvest.json')
  const declaration = JSON.parse(await readFile(path, 'utf8')) as {
    pool?: unknown
    schemaVersion?: unknown
  }

  const disagreement = declarationDisagreement(declaration, POOL_ID)
  if (disagreement !== undefined) {
    throw new Error(`declarations/apple-harvest.json: ${disagreement}`)
  }
  return declaration.schemaVersion as string
}

async function main(): Promise<void> {
  rasterizerSelfCheck()

  const schemaVersion = await declaredSchemaVersion()
  const plans = planAtlases(samplePool())
  const outputDir = join(repoRoot, OUTPUT_DIR)
  await mkdir(outputDir, { recursive: true })

  let bytes = 0
  // Measurement sits between rasterizing and assembling the manifest, and reads the very
  // pixels that are written out. PNG is lossless, so measuring here and measuring a
  // decode of the delivered file are the same measurement — and the generator needs no
  // decoder to prove it.
  const features: Record<string, FeatureVector> = {}
  for (const plan of plans) {
    const atlas = rasterizeAtlas(plan)
    bytes += atlas.png.byteLength
    await writeFile(join(outputDir, atlasFile(plan.id)), atlas.png)
    plan.images.forEach((image, cell) => {
      features[image.id] = measureCell(cellPixels(atlas, cell), CELL_PX)
    })
    process.stdout.write(
      `${atlasFile(plan.id)}  ${plan.images.length} cells  ${(atlas.png.byteLength / 1024).toFixed(0)} KB  measured\n`,
    )
  }

  const manifest = buildManifest(plans, schemaVersion, features)
  // Two-space JSON with a trailing newline: readable in a diff, and stable, because
  // `design.md` keeps this file hand-inspectable rather than compact.
  await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  const count = Object.keys(manifest.images).length
  process.stdout.write(
    `manifest.json  ${count} images  seed ${SEED}  schema ${schemaVersion}\n` +
      `total ${(bytes / 1024 / 1024).toFixed(2)} MB of atlases in ${OUTPUT_DIR}\n`,
  )
}

await main()

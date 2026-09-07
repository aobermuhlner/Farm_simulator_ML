/**
 * Measures one image of the pool and prints its feature vector.
 *
 * Run with `npx vite-node tools/pool/measure.ts -- --image t-001`. It exists so that a
 * feature value can be inspected without regenerating the pool, and so that
 * `test/pool-measurement.test.ts` can check the same cell from a second process: a
 * measurement that came out differently there would be reading something the pixels do
 * not carry.
 */

import { cellPixels, planAtlases, rasterizeAtlas } from './atlas.js'
import { measureCell } from './features.js'
import { CELL_PX } from './params.js'
import { samplePool } from './sample.js'

const requested = process.argv[process.argv.indexOf('--image') + 1]
const imageId = process.argv.includes('--image') && requested !== undefined ? requested : 't-001'

const plans = planAtlases(samplePool())
for (const plan of plans) {
  const cell = plan.images.findIndex((image) => image.id === imageId)
  if (cell < 0) continue
  const atlas = rasterizeAtlas(plan)
  process.stdout.write(`${JSON.stringify(measureCell(cellPixels(atlas, cell), CELL_PX))}\n`)
  process.exit(0)
}

process.stderr.write(`no image "${imageId}" in this pool\n`)
process.exit(1)

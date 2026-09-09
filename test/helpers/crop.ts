/**
 * A year's crop of the shipped farm, and what a batch of it is worth.
 *
 * Extracted so that the delivery guards and the recorded ladder position measure earnings
 * through one definition of what a year is. Two copies of "the wettest year the declaration
 * permits" would eventually be two different years, and a comparison between a hand rule
 * and a network is only worth recording if both were paid for the same crop.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Farm, FarmDeclaration } from '../../src/economy/index.js'
import { openFarm } from '../../src/economy/index.js'
import type { LoadedPool } from '../../src/pool/index.js'
import { readPool } from '../../src/pool/index.js'
import { scoreCrop, valueDelivery } from '../../src/scoring/index.js'
import type { DeliveryValuation } from '../../src/scoring/index.js'
import type { Crop, CropSplit } from '../../src/sorting/index.js'
import { drawCrop } from '../../src/sorting/index.js'
import { entryFromPredictions } from '../../src/families/index.js'
import type { ConfigurationEntry } from '../../src/task/artifact.js'
import { firstFamily } from '../../src/task/families.js'
import type { TaskDeclaration } from '../../src/task/types.js'

/** The committed pool, through the real reader — a stand-in would prove nothing. */
export function committedPool(declaration: TaskDeclaration): LoadedPool {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'pools/apple-harvest/manifest.json'), 'utf8'),
  ) as unknown
  const read = readPool(raw, declaration)
  if (!read.ok) throw new Error(`the committed pool must read: ${read.issues[0]?.message}`)
  return read.pool
}

/** The evaluation split a crop is drawn from, with its ground truth. */
export function cropSplit(pool: LoadedPool): CropSplit {
  return { imageIds: pool.order.pool, truth: pool.truth }
}

/**
 * The composition the declared ranges permit at one end of them.
 *
 * `pinnedAt(0)` is the mildest year the farm can draw and `pinnedAt(1)` the wettest, because
 * a range is read as `min + draw * (max - min)`. A composition pinned this way has no
 * variation left in it, so a figure measured over it is measured over the extreme itself
 * rather than over whatever year happened to come up.
 */
export function pinnedAt(farm: FarmDeclaration, extreme: number): FarmDeclaration {
  const declared = farm.cropComposition
  const variation = farm.yearVariation ?? {}
  const pinned: Record<string, number> = {}
  let taken = 0
  for (const [category, range] of Object.entries(variation)) {
    pinned[category] = range.min + extreme * (range.max - range.min)
    taken += pinned[category] as number
  }
  const holding = Object.keys(declared).filter((category) => variation[category] === undefined)
  const weight = holding.reduce((sum, category) => sum + (declared[category] as number), 0)
  for (const category of holding) {
    pinned[category] = ((1 - taken) * (declared[category] as number)) / weight
  }
  return { ...farm, cropComposition: pinned, yearVariation: undefined }
}

/** A farm opened on one composition, at one year and one amount of land. */
export function farmAt(composition: FarmDeclaration, year: number, land: number): Farm {
  return { ...openFarm(composition), year, land }
}

/** The crop that farm draws from that split, at one seed. */
export function cropFor(
  declaration: TaskDeclaration,
  state: Farm,
  split: CropSplit,
  seed = 4242,
): Crop {
  const draw = drawCrop(declaration, state, split, seed)
  if (!draw.ok) throw new Error(`the crop was meant to draw: ${draw.issues[0]?.message}`)
  return draw.crop
}

/** What one shipped configuration makes of one crop, valued under the declared term. */
export function harvestOf(
  declaration: TaskDeclaration,
  entry: ConfigurationEntry,
  crop: Crop,
): DeliveryValuation {
  const scored = scoreCrop(declaration, 'guard', entryFromPredictions(entry), crop.pieces)
  if (!scored.ok) throw new Error(`the crop was meant to score: ${scored.issues[0]?.message}`)
  return valueDelivery(declaration, scored.outcome)
}

/** Every configuration the shipped artifact holds predictions for, with its entry. */
export function shippedConfigurations(
  declaration: TaskDeclaration,
): { readonly id: string; readonly entry: ConfigurationEntry }[] {
  const directory = firstFamily(declaration).predictions ?? ''
  const index = JSON.parse(
    readFileSync(join(process.cwd(), `${directory}/index.json`), 'utf8'),
  ) as { configurations: Record<string, { file: string }> }

  return Object.entries(index.configurations).map(([id, record]) => ({
    id,
    entry: JSON.parse(
      readFileSync(join(process.cwd(), `${directory}/${record.file}`), 'utf8'),
    ) as ConfigurationEntry,
  }))
}

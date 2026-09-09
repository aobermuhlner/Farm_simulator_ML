/**
 * What a harvest records about itself.
 *
 * One function, and it exists so that there is exactly one place where a crop, a
 * valuation and the farm's precision are put together into the record a closed year
 * keeps. Both labours reach it — a model at work and a pair of hands — because the report
 * a student reads afterwards must not be able to tell which of them brought the crop in,
 * beyond naming who did.
 *
 * Amounts cross into whole units here, once, through `toUnits`. The shares do not cross
 * anything: a share is a share at any precision, and rounding one to the currency's
 * decimals would make a tolerance of 0.12 into a figure about money.
 */

import { toUnits } from '../economy/amounts.js'
import type { HarvestFigures } from '../economy/year.js'
import type { Crop } from '../sorting/crop.js'
import type { DeliveryValuation } from './delivery.js'

/**
 * The record of one harvest: the year's crop, what it grossed, and what it finally paid.
 *
 * `heldPictures` is carried only when pictures actually recurred. It is there to be shown
 * beside the disclosure that they did — *this crop is six thousand apples drawn from a
 * thousand photographs* — and a count with nothing to explain would be a number on screen
 * for its own sake.
 */
export function recordHarvestFigures(
  // Narrower than a whole crop: what a harvest records about the year is its size, its
  // mix and whether its pictures recurred, and both the drawn crop and the view a screen
  // holds carry exactly those. Asking for the pieces as well would make the sorting
  // screen turn its view back into a crop in order to record what it already knows.
  crop: Pick<Crop, 'size' | 'composition' | 'recurred' | 'held'>,
  value: DeliveryValuation,
  precision: number,
): HarvestFigures {
  const held = Object.values(crop.held).reduce((sum, count) => sum + count, 0)
  return {
    cropSize: crop.size,
    composition: crop.composition,
    grossUnits: toUnits(value.gross, precision),
    downgradeUnits: toUnits(value.downgrade, precision),
    downgraded: value.downgraded,
    warned: value.warned,
    ...(value.delivered === undefined ? {} : { delivered: value.delivered }),
    ...(value.measured === undefined ? {} : { measured: value.measured }),
    ...(value.share === undefined ? {} : { share: value.share }),
    ...(value.tolerance === undefined ? {} : { tolerance: value.tolerance }),
    recurred: crop.recurred,
    ...(crop.recurred ? { heldPictures: held } : {}),
  }
}

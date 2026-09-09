/**
 * Hand sorting: the crop a student is shown, and what their decisions came to.
 *
 * Pure arithmetic over declared data. No React, no storage, and no clock of its own —
 * the screen measures the time and hands it in, which is what makes the wage and the
 * rate testable without a renderer or a stopwatch.
 */

export type { Crop, CropDraw, CropImage, CropSplit } from './crop.js'
export {
  allocate,
  CROP_COMPOSITION_INCOMPLETE,
  CROP_COMPOSITION_MISSING,
  CROP_IMAGES_EXHAUSTED,
  CROP_SIZE_MISSING,
  CROP_TOO_SMALL,
  drawCrop,
  drawShares,
} from './crop.js'

export type { Decision, Mistake, SortOutcome, Throughput } from './tally.js'
export { measureSort } from './tally.js'

export type { Stream } from './random.js'
export { createStream, streamFor } from './random.js'

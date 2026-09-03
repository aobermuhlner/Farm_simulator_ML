/**
 * The arithmetic of a convolutional stack.
 *
 * Its own module because two callers have to agree on it exactly. `validate.ts` refuses
 * a declaration whose block count this arithmetic cannot support, and `diagram.ts` states
 * the resulting sizes on screen as exact numbers. A second copy of the halving rule could
 * disagree with the first, and the disagreement would surface as a drawing of a model
 * nothing had refused.
 *
 * Pooling floors, as 2x2 max pooling does, so an odd size loses its last row and column
 * rather than producing a fractional one.
 *
 * See openspec/changes/cnn-architecture/specs/model-architecture/spec.md.
 */

/**
 * The spatial size of each block's feature map, in order from the first block.
 *
 * Undefined for a stack that cannot be built: a block count that would pool the input
 * below a single spatial position has no sizes to report, and is the load-time refusal
 * `checkDiagram` names rather than something to clamp.
 */
export function blockSizes(inputSize: number, blocks: number): readonly number[] | undefined {
  if (!Number.isInteger(inputSize) || inputSize < 1) return undefined
  if (!Number.isInteger(blocks) || blocks < 1) return undefined

  const sizes: number[] = []
  let size = inputSize
  for (let block = 0; block < blocks; block += 1) {
    size = Math.floor(size / 2)
    if (size < 1) return undefined
    sizes.push(size)
  }
  return sizes
}

/** The channel count of each block: the base count, doubling once per block. */
export function blockChannels(baseChannels: number, blocks: number): readonly number[] {
  return Array.from({ length: blocks }, (_, block) => baseChannels * 2 ** block)
}

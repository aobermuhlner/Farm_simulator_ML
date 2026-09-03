/**
 * A convolutional stack, drawn beside the knobs that describe it.
 *
 * Geometry only, on the same terms as the fully-connected drawing: everything about which
 * knob means what is already resolved in `src/task/diagram.ts`, including the spatial
 * sizes, so this file receives numbers and turns them into boxes.
 *
 * Three decisions here are requirements rather than taste.
 *
 * The spatial sizes are stated exactly and drawn compressively. Drawing them to scale
 * would put a four-pixel box beside a fifty-pixel one at four blocks, so `sideFor` uses a
 * logarithmic scale: strictly monotone, and nothing like the true ratio. The number under
 * each volume is the true one, which is why the copy underneath disclaims the channel
 * depth and never the sizes.
 *
 * Adjacent volumes are joined by a receptive-field patch and never by full connectivity.
 * Drawing every position of one volume connected to every position of the next would
 * state exactly the property this architecture gives up, and giving it up is why it works
 * on images at all.
 *
 * The head is drawn rather than skipped. A drawing that jumped from the last volume to the
 * outputs would hide the pooling that discards position and the stage where a dropout
 * knob acts.
 *
 * The stage names in `data-stage` are generic on purpose. Naming the knob a stage belongs
 * to would put a declared knob id in a screen, which `no-task-specific-code.test.tsx`
 * forbids and which would tie this drawing to one lesson's vocabulary.
 */

import type { ResolvedBlock, ResolvedCnn } from '../../../../src/task/diagram.js'

/** Drawn side of the largest volume, in viewBox units. */
const MAX_SIDE = 50
/** Drawn side of the smallest volume a compressive scale ever reaches. */
const MIN_SIDE = 20
/** Offset between the drawn faces of one volume, which is how depth is portrayed. */
const DEPTH_STEP = 3.4
const BLOCK_COLUMN = 80
const HEAD_COLUMN = 64
const PADDING = 12
const CENTRE_Y = 58
const SPAN_Y = 128
/** Side of the receptive-field patch drawn on a volume's front face. */
const PATCH = 9
const VECTOR_WIDTH = 10
const VECTOR_HEIGHT = 46
const OUTPUT_RADIUS = 6
const OUTPUT_SPACING = 18

export interface CnnDiagramProps {
  readonly architecture: ResolvedCnn
}

/**
 * The drawn side of a volume whose feature map is `size` across.
 *
 * Logarithmic in the true size, so a halving always shrinks the box and never by half.
 * The requirement is that each volume is drawn smaller than the one before it, not that
 * the drawing preserves the ratio — which it cannot, at any usable size.
 */
function sideFor(size: number, inputSize: number): number {
  const span = Math.log2(Math.max(inputSize, 2))
  const share = Math.log2(Math.max(size, 1)) / span
  return MIN_SIDE + (MAX_SIDE - MIN_SIDE) * share
}

/** The front face of a volume: the one the patch is drawn on. */
interface Face {
  readonly left: number
  readonly top: number
  readonly side: number
}

function frontFace(centreX: number, side: number, faces: number): Face {
  const half = ((faces - 1) * DEPTH_STEP) / 2
  return { left: centreX - side / 2 - half, top: CENTRE_Y - side / 2 + half, side }
}

/** One volume: a stack of faces, back to front, so the front one is drawn on top. */
function Volume({
  centreX,
  side,
  faces,
}: {
  readonly centreX: number
  readonly side: number
  readonly faces: number
}) {
  const front = frontFace(centreX, side, faces)
  return (
    <>
      {Array.from({ length: faces }, (_, face) => faces - 1 - face).map((face) => (
        <rect
          key={face}
          data-face={face}
          className={face === 0 ? 'face front' : 'face'}
          x={front.left + face * DEPTH_STEP}
          y={front.top - face * DEPTH_STEP}
          width={side}
          height={side}
        />
      ))}
    </>
  )
}

export function CnnDiagram({ architecture }: CnnDiagramProps) {
  const { inputSize, head } = architecture
  const stack = architecture.blocks
  const lastBlock = stack[stack.length - 1]

  // Column centres: the input, one per block, then the three head stages.
  const centres: number[] = [PADDING + MAX_SIDE / 2]
  for (let column = 0; column < stack.length; column += 1) {
    centres.push((centres[centres.length - 1] ?? 0) + BLOCK_COLUMN)
  }
  for (let stage = 0; stage < 3; stage += 1) {
    centres.push((centres[centres.length - 1] ?? 0) + HEAD_COLUMN)
  }
  const spanX = (centres[centres.length - 1] ?? 0) + MAX_SIDE / 2 + PADDING

  const inputCentre = centres[0] ?? 0
  const blockCentre = (block: number): number => centres[block + 1] ?? 0
  const stageCentre = (stage: number): number => centres[stack.length + 1 + stage] ?? 0

  const sideOf = (block: ResolvedBlock): number => sideFor(block.size, inputSize)
  const labelY = CENTRE_Y + MAX_SIDE / 2 + 20
  const captionY = labelY + 9

  /** The face a receptive-field patch is drawn on, per column. */
  const faceOf = (column: number): Face => {
    if (column === 0) return frontFace(inputCentre, sideFor(inputSize, inputSize), 1)
    const block = stack[column - 1]
    if (block === undefined) return frontFace(inputCentre, MAX_SIDE, 1)
    return frontFace(blockCentre(column - 1), sideOf(block), block.drawnDepth)
  }

  const channelList = stack.map((block) => block.channels).join(', ')
  const label =
    `A convolutional network over a ${inputSize} by ${inputSize} image: ` +
    `${stack.length} blocks of ${channelList} channels, ` +
    `reducing the picture to ${lastBlock?.size ?? inputSize} by ${lastBlock?.size ?? inputSize}, ` +
    `then global average pooling, dropout and a dense classifier with ${head.outputs} outputs. ` +
    `Each block's channel depth is drawn as ${stack.map((block) => block.drawnDepth).join(', ')} ` +
    `stacked faces, which is a stand-in.`

  return (
    <div className="network">
      <svg
        className="network-drawing cnn-drawing"
        role="img"
        aria-label={label}
        viewBox={`0 0 ${spanX} ${SPAN_Y}`}
        width={spanX}
        height={SPAN_Y}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Locality first, so the volumes sit on top of it. */}
        <g className="receptive-fields">
          {Array.from({ length: stack.length }, (_, pair) => {
            const from = faceOf(pair)
            const to = faceOf(pair + 1)
            const patchLeft = from.left + from.side * 0.18
            const patchTop = from.top + from.side * 0.18
            const targetX = to.left + to.side * 0.34
            const targetY = to.top + to.side * 0.34
            const corners = [
              [patchLeft, patchTop],
              [patchLeft + PATCH, patchTop],
              [patchLeft, patchTop + PATCH],
              [patchLeft + PATCH, patchTop + PATCH],
            ] as const

            return (
              <g key={pair} data-patch={pair} data-from={pair} data-to={pair + 1}>
                {corners.map(([x, y], corner) => (
                  <line key={corner} x1={x} y1={y} x2={targetX} y2={targetY} />
                ))}
                <rect
                  className="patch"
                  x={patchLeft}
                  y={patchTop}
                  width={PATCH}
                  height={PATCH}
                />
                <circle className="position" cx={targetX} cy={targetY} r={1.8} />
              </g>
            )
          })}
        </g>

        <g data-volume={0} data-volume-kind="input" data-size={inputSize} className="volume input">
          <Volume
            centreX={inputCentre}
            side={sideFor(inputSize, inputSize)}
            faces={1}
          />
        </g>

        {stack.map((block, index) => (
          <g
            key={index}
            data-volume={index + 1}
            data-volume-kind="block"
            data-size={block.size}
            data-channels={block.channels}
            data-drawn-depth={block.drawnDepth}
            className="volume block"
          >
            <Volume
              centreX={blockCentre(index)}
              side={sideOf(block)}
              faces={block.drawnDepth}
            />
          </g>
        ))}

        {/* The head: what happens between the last volume and the outputs. */}
        <g data-stage="pooling" className="stage pooling">
          <rect
            x={stageCentre(0) - VECTOR_WIDTH / 2}
            y={CENTRE_Y - VECTOR_HEIGHT / 2}
            width={VECTOR_WIDTH}
            height={VECTOR_HEIGHT}
          />
        </g>
        <g data-stage="regularizer" className="stage regularizer">
          <rect
            x={stageCentre(1) - VECTOR_WIDTH / 2}
            y={CENTRE_Y - VECTOR_HEIGHT / 2}
            width={VECTOR_WIDTH}
            height={VECTOR_HEIGHT}
          />
          {[-14, 2, 14].map((offset) => (
            <g key={offset} className="dropped">
              <line
                x1={stageCentre(1) - 4}
                y1={CENTRE_Y + offset - 4}
                x2={stageCentre(1) + 4}
                y2={CENTRE_Y + offset + 4}
              />
              <line
                x1={stageCentre(1) + 4}
                y1={CENTRE_Y + offset - 4}
                x2={stageCentre(1) - 4}
                y2={CENTRE_Y + offset + 4}
              />
            </g>
          ))}
        </g>
        <g data-stage="classifier" className="stage classifier">
          {Array.from({ length: head.outputs }, (_, output) => (
            <circle
              key={output}
              data-output={output}
              cx={stageCentre(2)}
              cy={CENTRE_Y + (output - (head.outputs - 1) / 2) * OUTPUT_SPACING}
              r={OUTPUT_RADIUS}
            />
          ))}
        </g>

        {/* Every stated spatial size is the true one. */}
        <g className="volume-labels">
          <text x={inputCentre} y={labelY}>{`${inputSize}×${inputSize}`}</text>
          <text x={inputCentre} y={captionY} className="caption">
            picture
          </text>
          {stack.map((block, index) => (
            <g key={index}>
              <text data-size-label={index + 1} x={blockCentre(index)} y={labelY}>
                {`${block.size}×${block.size}`}
              </text>
              <text
                data-channel-label={index + 1}
                x={blockCentre(index)}
                y={captionY}
                className="caption"
              >
                {`${block.channels} channels`}
              </text>
            </g>
          ))}
          <text x={stageCentre(0)} y={labelY} className="caption">
            pooled
          </text>
          <text x={stageCentre(0)} y={captionY} className="caption">
            {`${head.pooledChannels} values`}
          </text>
          <text x={stageCentre(1)} y={labelY} className="caption">
            Dropout
          </text>
          <text x={stageCentre(2)} y={labelY} className="caption">
            classifier
          </text>
          <text x={stageCentre(2)} y={captionY} className="caption">
            {`${head.outputs} out`}
          </text>
        </g>
      </svg>

      <p className="exact">
        <strong>
          {architecture.blocksLabel}: {stack.length}
        </strong>{' '}
        — drawn exactly. Every picture size under the boxes ({stack.map((block) => block.size).join(', ')}) is
        exact too: each block halves what it was given.
      </p>
      <p className="abstracted">
        <strong>
          {architecture.channelsLabel}: {architecture.declaredChannels}
        </strong>
        , doubling to {lastBlock?.channels ?? architecture.declaredChannels} by the last block
        — drawn as {stack[0]?.drawnDepth ?? 0} stacked faces growing to{' '}
        {lastBlock?.drawnDepth ?? 0}. That depth is a stand-in so the stack fits on screen,
        not a count of what is there.
      </p>
    </div>
  )
}

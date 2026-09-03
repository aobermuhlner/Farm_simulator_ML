/**
 * A fully-connected network, drawn beside the knobs that describe it.
 *
 * Geometry only. Which knob sets the depth, which sets the units and what a given value
 * should draw are all resolved in `src/task/diagram.ts`, because a lookup by knob id in a
 * screen is exactly the per-task code the shell forbids. This component receives a
 * resolved architecture of this one family and turns it into circles and lines — no
 * declaration, no knob values, no screen state — which is what lets any page mount it.
 *
 * The drawing sizes itself through its `viewBox` and the stylesheet rather than through
 * inline style objects. That is partly good practice and partly a trap: a knob id that is
 * also the name of a CSS sizing property would make an inline style object setting that
 * property fail `no-task-specific-code.test.tsx`. SVG presentation attributes are safe; a
 * style object is not.
 *
 * The depth is exact and the widths are stand-ins, so the copy underneath says which is
 * which and states the value the configuration actually specifies. A student who reads
 * eight circles as eight units has been misinformed by the screen.
 */

import { layersOf, type ResolvedFeedforward } from '../../../../src/task/diagram.js'

/** Distance between the centres of adjacent layers, in viewBox units. */
const LAYER_SPACING = 46
/** Distance between the centres of units within a layer, in viewBox units. */
const UNIT_SPACING = 26
const UNIT_RADIUS = 8
const PADDING = UNIT_RADIUS + 3

export interface FeedforwardDiagramProps {
  readonly architecture: ResolvedFeedforward
}

/** What each drawn layer is, so the drawing can be read back without counting columns. */
function kindOf(index: number, total: number): 'input' | 'hidden' | 'output' {
  if (index === 0) return 'input'
  return index === total - 1 ? 'output' : 'hidden'
}

export function FeedforwardDiagram({ architecture }: FeedforwardDiagramProps) {
  const layers = layersOf(architecture)
  const widest = Math.max(...layers)

  const spanX = (layers.length - 1) * LAYER_SPACING + PADDING * 2
  const spanY = (widest - 1) * UNIT_SPACING + PADDING * 2

  const centreX = (index: number): number => PADDING + index * LAYER_SPACING
  const centreY = (unit: number, units: number): number =>
    spanY / 2 + (unit - (units - 1) / 2) * UNIT_SPACING

  const drawn = architecture.hidden[0] ?? 0
  const label =
    `A feed-forward network: ${architecture.inputs} inputs, ` +
    `${architecture.hidden.length} hidden layers of ${architecture.declaredUnits}, ` +
    `${architecture.outputs} outputs. Each hidden layer is drawn as ${drawn} units.`

  return (
    <div className="network">
      <svg
        className="network-drawing"
        role="img"
        aria-label={label}
        viewBox={`0 0 ${spanX} ${spanY}`}
        width={spanX}
        height={spanY}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Connections first, so the units sit on top of them. */}
        <g className="connections">
          {layers.slice(0, -1).flatMap((units, index) => {
            const next = layers[index + 1] ?? 0
            return Array.from({ length: units }, (_, from) =>
              Array.from({ length: next }, (_, to) => (
                <line
                  key={`${index}-${from}-${to}`}
                  data-from={index}
                  data-to={index + 1}
                  x1={centreX(index)}
                  y1={centreY(from, units)}
                  x2={centreX(index + 1)}
                  y2={centreY(to, next)}
                />
              )),
            ).flat()
          })}
        </g>

        {layers.map((units, index) => (
          <g
            key={index}
            data-layer={index}
            data-layer-kind={kindOf(index, layers.length)}
            className={`layer ${kindOf(index, layers.length)}`}
          >
            {Array.from({ length: units }, (_, unit) => (
              <circle
                key={unit}
                data-unit={unit}
                cx={centreX(index)}
                cy={centreY(unit, units)}
                r={UNIT_RADIUS}
              />
            ))}
          </g>
        ))}
      </svg>

      <p className="exact">
        <strong>
          {architecture.layersLabel}: {architecture.hidden.length}
        </strong>{' '}
        — drawn exactly.
      </p>
      <p className="abstracted">
        <strong>
          {architecture.unitsLabel}: {architecture.declaredUnits}
        </strong>{' '}
        — drawn as {drawn} per layer. That is a stand-in so the network fits on screen, not
        a count of what is there.
      </p>
    </div>
  )
}

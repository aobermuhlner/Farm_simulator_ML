/**
 * A shipped tree, drawn from the structure that scores the harvest.
 *
 * Geometry only, on the same terms as the other two drawings: `src/task/diagram.ts` has
 * already turned the model into labelled questions and labelled leaves, so this file
 * receives words and numbers and turns them into boxes. It names no feature, no
 * category and no knob — every one of those comes down resolved.
 *
 * Three decisions here are requirements rather than taste.
 *
 * The chain is drawn as a staircase and not as a balanced tree. That is what the shipped
 * shape actually is: each question claims the apples that answer yes and passes the rest
 * down to the next one. Drawing two even branches at every node would show a tree the
 * model does not have, and a student tracing an apple would be tracing a fiction.
 *
 * A leaf shows every declared category's share rather than the largest one. The largest
 * share is a decision, and the decision is the policy's — a leaf that showed only its
 * winner would be a leaf that had chosen, which is exactly what a leaf may not do.
 *
 * A traced path is drawn over the tree rather than instead of it. The point of tracing
 * one apple is that a student sees the questions it answered no to on the way down, so
 * the route has to be visible against the whole of what was available.
 */

import type { ResolvedLeaf, ResolvedTree, TreePath } from '../../../../src/task/diagram.js'

/** Height of one question's row, in viewBox units. */
const ROW = 62
const WIDTH = 320
const PADDING = 10
/** Where the trunk runs: every question hangs off it and the fallback ends it. */
const TRUNK_X = 96
const NODE_WIDTH = 150
const NODE_HEIGHT = 34
const LEAF_WIDTH = 132
const LEAF_HEIGHT = 40
const BAR_HEIGHT = 7

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** A leaf said out loud, for the drawing's text alternative. */
function describe(leaf: ResolvedLeaf): string {
  return leaf.shares
    .map((share) => `${share.categoryLabel} ${percentage(share.probability)}`)
    .join(', ')
}

/**
 * A leaf: one bar per declared category, in the order the task declares them.
 *
 * Bars rather than numbers alone, because "how sure" is the thing a leaf says and a row
 * of three percentages reads as three unrelated facts. The numbers are there as well:
 * `colour-vision-safety` will not have a share carried by length alone.
 */
function Leaf({
  leaf,
  x,
  y,
  onPath,
}: {
  readonly leaf: ResolvedLeaf
  readonly x: number
  readonly y: number
  readonly onPath: boolean
}) {
  return (
    <g className={onPath ? 'tree-leaf on-path' : 'tree-leaf'} data-testid="tree-leaf">
      <rect x={x} y={y} width={LEAF_WIDTH} height={LEAF_HEIGHT} rx={4} />
      {leaf.shares.map((share, index) => (
        <g key={share.categoryLabel}>
          <rect
            className="tree-share"
            data-share={share.categoryLabel}
            x={x + 6}
            y={y + 5 + index * (BAR_HEIGHT + 3)}
            width={Math.max(1, (LEAF_WIDTH - 52) * share.probability)}
            height={BAR_HEIGHT}
          />
          <text className="tree-share-value" x={x + LEAF_WIDTH - 6} y={y + 11 + index * (BAR_HEIGHT + 3)}>
            {percentage(share.probability)}
          </text>
        </g>
      ))}
    </g>
  )
}

export interface TreeDiagramProps {
  readonly architecture: ResolvedTree
  /**
   * One apple's route through the tree, when there is an apple to trace.
   *
   * Optional: the tree is worth drawing on its own, and a drawing that needed an apple
   * before it would show anything would leave the workshop blank until one was chosen.
   */
  readonly path?: TreePath
}

export function TreeDiagram({ architecture, path }: TreeDiagramProps) {
  const height = PADDING * 2 + (architecture.questions.length + 1) * ROW
  const claimed = path?.claimedBy
  const passed = new Set(path?.answeredNo ?? [])

  const label =
    `A tree of ${architecture.questions.length} questions, asked in order. ` +
    architecture.questions
      .map(
        (question, index) =>
          `Question ${index + 1}: is ${question.featureLabel} above ${question.threshold}? ` +
          `If yes, ${describe(question.whenAbove)}.`,
      )
      .join(' ') +
    ` Anything no question claims: ${describe(architecture.otherwise)}.`

  return (
    <div className="network">
      <svg
        className="network-drawing tree-drawing"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
      >
        {architecture.questions.map((question, index) => {
          const top = PADDING + index * ROW
          const centre = top + NODE_HEIGHT / 2
          const walked = path !== undefined && (passed.has(index) || claimed === index)
          return (
            <g
              key={`${question.featureLabel}-${index}`}
              className={walked ? 'tree-question walked' : 'tree-question'}
              data-question={index}
            >
              {/* The trunk down to the next question, which the apples answering no take. */}
              <line
                className={path !== undefined && passed.has(index) ? 'tree-trunk walked' : 'tree-trunk'}
                x1={TRUNK_X}
                y1={centre}
                x2={TRUNK_X}
                y2={top + ROW + NODE_HEIGHT / 2}
              />
              {/* The branch across to the leaf, which the apples answering yes take. */}
              <line
                className={claimed === index ? 'tree-branch walked' : 'tree-branch'}
                x1={TRUNK_X + NODE_WIDTH / 2}
                y1={centre}
                x2={WIDTH - PADDING - LEAF_WIDTH}
                y2={centre}
              />
              <rect
                x={TRUNK_X - NODE_WIDTH / 2}
                y={top}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={4}
              />
              <text className="tree-feature" x={TRUNK_X} y={top + 14}>
                {question.featureLabel}
              </text>
              <text className="tree-threshold" x={TRUNK_X} y={top + 27}>
                {`above ${question.threshold}?`}
              </text>
              <Leaf
                leaf={question.whenAbove}
                x={WIDTH - PADDING - LEAF_WIDTH}
                y={centre - LEAF_HEIGHT / 2}
                onPath={claimed === index}
              />
            </g>
          )
        })}

        <g className="tree-question tree-fallback" data-question="otherwise">
          <Leaf
            leaf={architecture.otherwise}
            x={WIDTH - PADDING - LEAF_WIDTH}
            y={PADDING + architecture.questions.length * ROW + NODE_HEIGHT / 2 - LEAF_HEIGHT / 2}
            onPath={path !== undefined && claimed === undefined}
          />
          <line
            className={
              path !== undefined && claimed === undefined ? 'tree-branch walked' : 'tree-branch'
            }
            x1={TRUNK_X}
            y1={PADDING + architecture.questions.length * ROW + NODE_HEIGHT / 2}
            x2={WIDTH - PADDING - LEAF_WIDTH}
            y2={PADDING + architecture.questions.length * ROW + NODE_HEIGHT / 2}
          />
        </g>
      </svg>
      <p>{`${architecture.nodesLabel}: ${architecture.nodes}.`}</p>
      <p className="abstracted">
        Each question cuts one measured number at one value. A picture takes the first
        branch whose question it answers yes to, and comes to rest in exactly one leaf;
        the leaf says how likely each kind is, and the declared rule decides from there.
      </p>
    </div>
  )
}

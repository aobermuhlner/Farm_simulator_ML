/**
 * The architecture a task's current knob values describe.
 *
 * This is the whole of the "which knob means what" reasoning, kept out of the screen
 * that draws it: `simulator-shell` forbids a screen from naming a knob id, and the
 * mapping from a declared value to a drawable quantity is declared per task. A component
 * given one of the shapes below does geometry and nothing else — every number it needs is
 * already computed here, including the convolutional stack's spatial sizes, because a
 * derivation done in the drawing is a derivation nothing can refuse.
 *
 * Two things are deliberately not decided here. The output count is the task's declared
 * category count rather than anything the diagram declares, because a network really
 * does have one output per category and a second declared number could only disagree
 * with the first. And whether the values are permitted at all is `resolveConfiguration`'s
 * question, not a second opinion formed here.
 *
 * See openspec/changes/cnn-architecture/specs/network-diagram/spec.md.
 */

import { blockChannels, blockSizes } from './cnn.js'
import { resolveConfiguration } from './configuration.js'
import type { CnnDiagram, FeedforwardDiagram, TaskDeclaration } from './types.js'

/** A fully-connected architecture, ready to draw. */
export interface ResolvedFeedforward {
  readonly kind: 'feedforward'
  /** Input units to draw, as a stand-in for the task's real input. */
  readonly inputs: number
  /** Units per hidden layer. Its length is the exact number of hidden layers. */
  readonly hidden: readonly number[]
  /** Output units: one per declared category, and literally true. */
  readonly outputs: number
  /** The units-per-layer value the configuration actually specifies. */
  readonly declaredUnits: string | number
  /** Declared label of the knob setting the depth, for the screen's copy. */
  readonly layersLabel: string
  /** Declared label of the knob setting the width, for the screen's copy. */
  readonly unitsLabel: string
}

/** One convolutional block of a resolved stack. */
export interface ResolvedBlock {
  /** Channels the block really has: the base count, doubled once per earlier block. */
  readonly channels: number
  /** Spatial size of the block's feature map. Exact, not a stand-in. */
  readonly size: number
  /** Channel depth to draw. A stand-in: no drawing shows 128 channels. */
  readonly drawnDepth: number
}

/**
 * The stages between the last block and the outputs.
 *
 * `appliesDropout` is a fixed property of this architecture rather than something the
 * task declares, and it is `true` for every convolutional task: the head applies dropout
 * to the pooled channel vector, so a task declaring a dropout knob always has somewhere
 * for it to act. Which knob drives it is the task author's claim and not derivable — the
 * diagram declaration names capacity knobs only — so nothing here pretends to know.
 */
export interface ResolvedCnnHead {
  /** Length of the vector global average pooling reduces the last block to. */
  readonly pooledChannels: number
  /** The head applies dropout to that vector. Always true for this architecture. */
  readonly appliesDropout: true
  /** Dense classifier outputs: one per declared category, and literally true. */
  readonly outputs: number
}

/** A convolutional architecture, ready to draw. */
export interface ResolvedCnn {
  readonly kind: 'cnn'
  /** Spatial resolution of the input, in pixels per side. Exact. */
  readonly inputSize: number
  /** The blocks in order from the input. Its length is the exact number of blocks. */
  readonly blocks: readonly ResolvedBlock[]
  readonly head: ResolvedCnnHead
  /** The base channel count the configuration actually specifies. */
  readonly declaredChannels: number
  /** Declared label of the knob setting the block count, for the screen's copy. */
  readonly blocksLabel: string
  /** Declared label of the knob setting the base channels, for the screen's copy. */
  readonly channelsLabel: string
}

export type ResolvedArchitecture = ResolvedFeedforward | ResolvedCnn

/** Declared label of a knob, or nothing when the task does not declare it. */
function labelOf(declaration: TaskDeclaration, knobId: string): string | undefined {
  return declaration.knobs.find((knob) => knob.id === knobId)?.label
}

/** A value that is a count of something: whole and at least one. */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

/**
 * Resolves the architecture to draw for a task at some knob values.
 *
 * Returns nothing — rather than a best effort — in every case where there is no honest
 * drawing to make: the task declares no diagram, or the values are not ones its knobs
 * permit. The second is unreachable through the configuration screen, whose controls
 * offer declared values only, but a drawing beside a refused configuration would show a
 * student an architecture the engine has just declined to run.
 *
 * Which family a task belongs to comes from its own declaration. Nothing here substitutes
 * a family for a task that declares none, or reads one family's fields off the other.
 */
export function resolveArchitecture(
  declaration: TaskDeclaration,
  values: Readonly<Record<string, unknown>>,
): ResolvedArchitecture | undefined {
  const diagram = declaration.diagram
  if (diagram === undefined) return undefined

  const resolved = resolveConfiguration(declaration, values)
  if (!resolved.ok) return undefined

  const selected = new Map(resolved.configuration.values)
  return diagram.kind === 'feedforward'
    ? resolveFeedforward(declaration, diagram, selected)
    : resolveCnn(declaration, diagram, selected)
}

function resolveFeedforward(
  declaration: TaskDeclaration,
  diagram: FeedforwardDiagram,
  selected: ReadonlyMap<string, string | number>,
): ResolvedFeedforward | undefined {
  const layersValue = selected.get(diagram.layersKnob)
  const unitsValue = selected.get(diagram.unitsKnob)
  if (layersValue === undefined || unitsValue === undefined) return undefined

  // Guaranteed by `checkDiagram`, which refuses a layers knob permitting anything but
  // whole numbers and a width value with no drawn count. Checked again rather than
  // asserted, so the promise does not rest on validation having run.
  if (!isCount(layersValue)) return undefined
  const units = diagram.unitsShown[String(unitsValue)]
  if (!isCount(units)) return undefined

  const layersLabel = labelOf(declaration, diagram.layersKnob)
  const unitsLabel = labelOf(declaration, diagram.unitsKnob)
  if (layersLabel === undefined || unitsLabel === undefined) return undefined

  return {
    kind: 'feedforward',
    inputs: diagram.inputsShown,
    hidden: Array.from({ length: layersValue }, () => units),
    outputs: declaration.categories.length,
    declaredUnits: unitsValue,
    layersLabel,
    unitsLabel,
  }
}

/**
 * Resolves a convolutional declaration into the stack it describes.
 *
 * The spatial sizes come from `blockSizes`, the same arithmetic the validator refused an
 * unbuildable block count with, so what is drawn cannot disagree with what was accepted.
 * The channel counts are the base value doubling per block; the drawn depth is seeded by
 * the declared stand-in and incremented per block, which is what makes each volume drawn
 * deeper than the one before it however small the stand-in is.
 */
function resolveCnn(
  declaration: TaskDeclaration,
  diagram: CnnDiagram,
  selected: ReadonlyMap<string, string | number>,
): ResolvedCnn | undefined {
  const blocksValue = selected.get(diagram.blocksKnob)
  const channelsValue = selected.get(diagram.channelsKnob)
  if (blocksValue === undefined || channelsValue === undefined) return undefined

  // Each of these is guaranteed by `checkDiagram` and checked again all the same, for the
  // same reason as in the fully-connected path.
  if (!isCount(blocksValue) || !isCount(channelsValue)) return undefined
  const sizes = blockSizes(diagram.inputSize, blocksValue)
  if (sizes === undefined) return undefined
  const drawnDepth = diagram.channelsShown[String(channelsValue)]
  if (!isCount(drawnDepth)) return undefined

  const blocksLabel = labelOf(declaration, diagram.blocksKnob)
  const channelsLabel = labelOf(declaration, diagram.channelsKnob)
  if (blocksLabel === undefined || channelsLabel === undefined) return undefined

  const channels = blockChannels(channelsValue, blocksValue)
  const blocks: ResolvedBlock[] = sizes.map((size, block) => ({
    channels: channels[block] ?? channelsValue,
    size,
    drawnDepth: drawnDepth + block,
  }))

  return {
    kind: 'cnn',
    inputSize: diagram.inputSize,
    blocks,
    head: {
      pooledChannels: blocks[blocks.length - 1]?.channels ?? channelsValue,
      appliesDropout: true,
      outputs: declaration.categories.length,
    },
    declaredChannels: channelsValue,
    blocksLabel,
    channelsLabel,
  }
}

/** Every layer of a resolved fully-connected architecture, input first, in drawing order. */
export function layersOf(architecture: ResolvedFeedforward): readonly number[] {
  return [architecture.inputs, ...architecture.hidden, architecture.outputs]
}

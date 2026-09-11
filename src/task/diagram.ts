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
import type {
  CnnDiagram,
  FeedforwardDiagram,
  ModelFamilyDeclaration,
  TaskDeclaration,
  TreeDiagram,
} from './types.js'

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

/**
 * The shape a shipped model has, as this module needs to read it.
 *
 * Declared structurally rather than imported from `src/families/`, because that module
 * imports this one's task types and a real import would close the circle. It is the
 * same shape `ShippedModel` has, and a change to that shape fails here at the call.
 */
export interface DrawableModel {
  readonly splits: readonly {
    readonly feature: string
    readonly threshold: number
    readonly whenAbove: readonly number[]
  }[]
  readonly otherwise: readonly number[]
}

/** One exit of a drawn tree: how likely each declared category is, in that order. */
export interface ResolvedLeaf {
  readonly shares: readonly { readonly categoryLabel: string; readonly probability: number }[]
}

/**
 * One question a drawn tree asks, in the words the task declares for the number it cuts.
 *
 * The feature's *label* and *unit*, never its id. A drawing is read by a student, and a
 * screen handed an id would either print it or hold a table of prettier names — which
 * is the per-task screen code the whole abstraction exists to make unnecessary.
 */
export interface ResolvedQuestion {
  readonly featureLabel: string
  readonly unit: string
  readonly threshold: number
  /** Where an apple that answers yes comes to rest. */
  readonly whenAbove: ResolvedLeaf
}

/**
 * A tree, ready to draw, resolved from the model that scores the harvest.
 *
 * Not from the knobs. Two trees at one budget can ask entirely different questions, so
 * there is nothing in the declaration to derive this from — and resolving it from the
 * shipped structure is what makes the tree drawn and the tree fielded one object.
 */
export interface ResolvedTree {
  readonly kind: 'tree'
  /** The questions in the order they are asked. Its length is the budget it was made at. */
  readonly questions: readonly ResolvedQuestion[]
  /** Where an apple no question claimed comes to rest. */
  readonly otherwise: ResolvedLeaf
  /** The budget the configuration specifies. Exact: it is the question count. */
  readonly nodes: number
  /** Declared label of the knob setting the budget, for the screen's copy. */
  readonly nodesLabel: string
}

export type ResolvedArchitecture = ResolvedFeedforward | ResolvedCnn | ResolvedTree

/**
 * The path one apple takes through a drawn tree, as question indices.
 *
 * Indices rather than features, so a caller can highlight the drawing without being
 * handed a feature id it has no business knowing. `answeredNo` is every question the
 * apple passed through; `claimedBy` is the question that stopped it, or `undefined`
 * when nothing did and it came to rest in the fallback leaf.
 *
 * Exactly one of those outcomes happens for every apple, which is the structural
 * guarantee `prediction-artifacts` asks a stored model for, stated as a return type.
 */
export interface TreePath {
  readonly answeredNo: readonly number[]
  readonly claimedBy?: number
}

/**
 * Which way one apple goes at each question, from the numbers measured of it.
 *
 * The same walk `predictWith` performs, over the same structure, so a traced path and a
 * scored distribution cannot disagree about where an apple landed. It is separate from
 * the prediction because a drawing needs the route and the scorer needs the leaf.
 */
export function traceTree(
  model: DrawableModel,
  features: Readonly<Record<string, number>>,
): TreePath {
  const answeredNo: number[] = []
  for (const [index, split] of model.splits.entries()) {
    const value = features[split.feature]
    if (value !== undefined && value > split.threshold) return { answeredNo, claimedBy: index }
    answeredNo.push(index)
  }
  return { answeredNo }
}

/** Declared label of a knob, or nothing when the family does not declare it. */
function labelOf(family: ModelFamilyDeclaration, knobId: string): string | undefined {
  return family.knobs.find((knob) => knob.id === knobId)?.label
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
  family: ModelFamilyDeclaration,
  values: Readonly<Record<string, unknown>>,
  model?: DrawableModel,
): ResolvedArchitecture | undefined {
  const diagram = family.diagram
  if (diagram === undefined) return undefined

  const resolved = resolveConfiguration(declaration, family, values)
  if (!resolved.ok) return undefined

  const selected = new Map(resolved.configuration.values)
  if (diagram.kind === 'feedforward') {
    return resolveFeedforward(declaration, family, diagram, selected)
  }
  if (diagram.kind === 'cnn') return resolveCnn(declaration, family, diagram, selected)
  // A tree with no structure in hand is not drawn at all, rather than drawn as an empty
  // frame: until the model is fetched there is nothing true to say about what it asks,
  // and an outline with no questions in it would read as a tree that asks none.
  return model === undefined ? undefined : resolveTree(declaration, family, diagram, model)
}

/**
 * Resolves a shipped tree into the drawing of it, in the task's declared words.
 *
 * Everything a screen needs is turned into labels here — the feature's name and unit,
 * each category's name — for the same reason the convolutional stack's spatial sizes
 * are computed here: a derivation done inside a drawing is a derivation nothing can
 * refuse, and a lookup done inside a drawing is a screen that has learned a vocabulary.
 *
 * A question cutting a feature the task does not declare is not drawn, and neither is
 * the tree. That is unreachable through the reader, which refuses such a model before
 * it is ever resolved; checked again rather than asserted, so the promise does not rest
 * on validation having run.
 */
function resolveTree(
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  diagram: TreeDiagram,
  model: DrawableModel,
): ResolvedTree | undefined {
  const nodesLabel = labelOf(family, diagram.nodesKnob)
  if (nodesLabel === undefined) return undefined

  const leafOf = (distribution: readonly number[]): ResolvedLeaf | undefined => {
    if (distribution.length !== declaration.categories.length) return undefined
    return {
      shares: declaration.categories.map((category, index) => ({
        categoryLabel: category.label,
        probability: distribution[index] ?? 0,
      })),
    }
  }

  const questions: ResolvedQuestion[] = []
  for (const split of model.splits) {
    const feature = declaration.features.find((candidate) => candidate.id === split.feature)
    const whenAbove = leafOf(split.whenAbove)
    if (feature === undefined || whenAbove === undefined) return undefined
    questions.push({
      featureLabel: feature.label,
      unit: feature.unit,
      threshold: split.threshold,
      whenAbove,
    })
  }

  const otherwise = leafOf(model.otherwise)
  if (otherwise === undefined) return undefined

  return { kind: 'tree', questions, otherwise, nodes: questions.length, nodesLabel }
}

function resolveFeedforward(
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
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

  const layersLabel = labelOf(family, diagram.layersKnob)
  const unitsLabel = labelOf(family, diagram.unitsKnob)
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
  family: ModelFamilyDeclaration,
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

  const blocksLabel = labelOf(family, diagram.blocksKnob)
  const channelsLabel = labelOf(family, diagram.channelsKnob)
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

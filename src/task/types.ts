/**
 * Shapes of a task declaration.
 *
 * A task is data, not code: every field below is something a declaration must
 * carry in order to be playable. Field-by-field enforcement lives in
 * `validate.ts` — these types only describe the shape.
 *
 * See openspec/changes/task-abstraction/specs/task-contract/spec.md.
 */

export type CategoryId = string
export type ActionId = string
export type KnobId = string

/** A ground-truth category an image can belong to. At least two per task. */
export interface CategoryDeclaration {
  readonly id: CategoryId
  readonly label: string
}

/** An action available to the automated system. At least two per task. */
export interface ActionDeclaration {
  readonly id: ActionId
  readonly label: string
}

/** A knob offering a fixed set of values. */
export interface ChoiceKnob {
  readonly kind: 'choice'
  readonly id: KnobId
  readonly label: string
  readonly values: readonly (string | number)[]
  readonly default: string | number
  readonly help: string
}

/** A knob offering a continuous range. */
export interface SliderKnob {
  readonly kind: 'slider'
  readonly id: KnobId
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly default: number
  readonly help: string
}

/**
 * A hyperparameter exposed to the student. The configuration screen is rendered
 * from these declarations alone, which is why label, kind, allowed values,
 * default and help copy are all required rather than optional.
 */
export type KnobDeclaration = ChoiceKnob | SliderKnob

/** Chooses the action mapped from the most probable category. */
export interface HighestProbabilityPolicy {
  readonly kind: 'highest-probability'
}

/**
 * Chooses a category's action once that category's probability meets its
 * threshold. When several clear at once the declared `priority` decides;
 * nothing clearing any threshold falls back to `fallbackAction`.
 */
export interface ThresholdPolicy {
  readonly kind: 'threshold'
  readonly thresholds: Readonly<Record<CategoryId, number>>
  readonly fallbackAction: ActionId
  /**
   * Which category decides when more than one clears its threshold, earliest first.
   * Names every declared category exactly once.
   *
   * Declared rather than read off `categories`, and that is not a convenience. The
   * declared category order is not the task's to choose for this purpose:
   * `prediction-artifacts` indexes every stored probability vector by it, so a task with
   * shipped predictions could not reorder its categories to express a change of priority
   * without invalidating an artifact that has nothing to do with the decision rule. Nor
   * is priority inferred from the thresholds, which would fuse two independent
   * declarations and silently reorder the policy whenever a threshold moved.
   */
  readonly priority: readonly CategoryId[]
}

/** Chooses the action with the greatest expected payoff over the distribution. */
export interface CostOptimalPolicy {
  readonly kind: 'cost-optimal'
}

export type DecisionPolicyDeclaration =
  | HighestProbabilityPolicy
  | ThresholdPolicy
  | CostOptimalPolicy

/**
 * A value for every (true category, action) cell, as a currency amount so that
 * expected-payoff reasoning reads as farm economics. Indexed
 * `payoffs[categoryId][actionId]`.
 */
export type PayoffTable = Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>

/** The architectures a task can ask to have drawn. */
export const DIAGRAM_KINDS = ['feedforward', 'cnn'] as const
export type DiagramKind = (typeof DIAGRAM_KINDS)[number]

/**
 * How a fully-connected task's architecture should be drawn beside its knobs.
 *
 * The depth is drawn faithfully and the width is drawn as a stand-in, because no
 * diagram can usefully show 256 units. Which knob means what, and what each of its
 * values should draw, is declared here rather than known by a screen: that is what keeps
 * the drawing task-agnostic, and it is the only reason a second lesson can draw its own
 * architecture without a screen change.
 *
 * There is deliberately no output count. A network has one output per declared category,
 * so declaring the number again would create a second source of truth that can disagree
 * with `categories` — and when it does, nothing can say which is right. Inputs are
 * declared because the real input is an image, with no small number to derive from.
 */
export interface FeedforwardDiagram {
  readonly kind: 'feedforward'
  /** Knob whose current value is the number of hidden layers. Drawn exactly. */
  readonly layersKnob: KnobId
  /** Knob whose current value sets the units per layer. Drawn as a stand-in. */
  readonly unitsKnob: KnobId
  /** Units to draw per hidden layer, keyed by the value of `unitsKnob`. */
  readonly unitsShown: Readonly<Record<string, number>>
  /** Input units to draw, as a stand-in for the image input. */
  readonly inputsShown: number
}

/**
 * How a convolutional task's architecture should be drawn beside its knobs.
 *
 * The abstraction inverts here. A convolutional stack's spatial sizes are derived from
 * the input resolution by halving once per block, so they are both small enough to state
 * exactly and impossible to disagree with — which is why no per-block size is declared.
 * The channel depth is what cannot be drawn at 128 channels, so it is this kind's
 * stand-in: `channelsShown` seeds the drawn depth of the first block and each later block
 * is drawn one deeper.
 *
 * `inputSize` is declared rather than read from the pool manifest because a manifest
 * loads asynchronously in the browser while a declaration is validated at load. Deriving
 * it would move a structural check into render time, where nothing can refuse. It is
 * declared here and cross-checked against the manifest when the pool loads — `design.md`.
 *
 * As with the feedforward kind there is deliberately no output count: a network has one
 * output per declared category, and a second declared number could only disagree.
 */
export interface CnnDiagram {
  readonly kind: 'cnn'
  /** Knob whose current value is the number of convolutional blocks. Drawn exactly. */
  readonly blocksKnob: KnobId
  /** Knob whose current value sets the first block's channel count. Drawn as a stand-in. */
  readonly channelsKnob: KnobId
  /** Spatial resolution of the task's input, in pixels per side. */
  readonly inputSize: number
  /** Channel depth to draw for the first block, keyed by the value of `channelsKnob`. */
  readonly channelsShown: Readonly<Record<string, number>>
}

export type DiagramDeclaration = FeedforwardDiagram | CnnDiagram

/** Task-level explanatory copy. Knob-level copy lives on each knob's `help`. */
export interface TeachingCopy {
  readonly summary: string
  readonly theory: string
}

export interface TaskDeclaration {
  /** Stable id, used to reference this task across artifacts. */
  readonly id: string
  readonly title: string
  /** Schema version the precomputed artifacts were generated against. */
  readonly schemaVersion: string
  readonly categories: readonly CategoryDeclaration[]
  readonly actions: readonly ActionDeclaration[]
  /** The action each category calls for. Keyed by category id. */
  readonly categoryActions: Readonly<Record<CategoryId, ActionId>>
  readonly policy: DecisionPolicyDeclaration
  /** Reference to the image pool this task draws from. */
  readonly pool: string
  /** Reference to the precomputed prediction artifact. */
  readonly predictions: string
  readonly knobs: readonly KnobDeclaration[]
  readonly payoffs: PayoffTable
  readonly teaching: TeachingCopy
  /**
   * How to draw the architecture the knobs describe. Optional: a task declaring none is
   * drawn none, rather than having one guessed for it.
   */
  readonly diagram?: DiagramDeclaration
  /** False for a task that is announced on the farm overview but not playable. */
  readonly available: boolean
}

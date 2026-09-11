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

/**
 * What the batch as a whole is worth, over and above what its images are worth one at a
 * time.
 *
 * A payoff table prices a mistake per image, and a price list that can be reasoned about
 * one image at a time can be hill-climbed one image at a time. A buyer does not work that
 * way: they open the crates, find the share of them that is spoiled, and reprice the
 * whole delivery. That is what makes a rare category worth more than the sum of its
 * images, which is the lesson of imbalanced classification and is not expressible as a
 * sum.
 *
 * Every field is general over what the task declares. Nothing here knows what the
 * measured categories are or why delivering them is a mistake — `measures` names
 * categories the task declares, `delivering` names actions it declares, and
 * `task-contract` refuses a term that names anything else, that leaves no action outside
 * the delivering ones, or that measures only categories the delivering actions were the
 * right answer for.
 *
 * Optional on a task. A task whose mistakes are all priced adequately per image needs
 * none, and one that declares none is valued exactly as though the concept did not exist.
 */
export interface DeliveryTerm {
  /** The categories whose presence in a delivery is counted. At least one. */
  readonly measures: readonly CategoryId[]
  /** The actions that put an image into the delivery. At least one, never all of them. */
  readonly delivering: readonly ActionId[]
  /**
   * The share of the delivery, at or above which the whole of it is repriced.
   *
   * Reached rather than exceeded: a buyer who accepts one in eight rejects the eighth.
   */
  readonly tolerance: number
  /** The share at which the delivery is warned about, strictly below the tolerance. */
  readonly warnAbove: number
  /** What each delivered image is paid instead, once the tolerance is reached. */
  readonly downgradedValue: number
}

/** The architectures a task can ask to have drawn. */
export const DIAGRAM_KINDS = ['feedforward', 'cnn', 'tree'] as const
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

/**
 * How a family that ships its own model should have that model drawn.
 *
 * The abstraction inverts again, and further than it did for the convolutional stack.
 * The other two kinds declare which knob stands for which drawable quantity, because
 * the architecture is a function of the knobs and nothing but the knobs. A tree is not:
 * two trees at the same budget can ask entirely different questions, and which ones
 * they ask is in the shipped model rather than in any declaration. So this kind
 * declares almost nothing, and the drawing is resolved from the structure that scores
 * the harvest — which is what makes the tree on screen and the tree in the field one
 * object that cannot disagree.
 *
 * `nodesKnob` is here for its *label* alone. The drawing has to say what the budget is
 * called in the words the task chose, and a screen that wrote those words itself would
 * be a screen that had learned one family's vocabulary.
 */
export interface TreeDiagram {
  readonly kind: 'tree'
  /** Knob whose current value is the number of questions the tree may ask. */
  readonly nodesKnob: KnobId
}

export type DiagramDeclaration = FeedforwardDiagram | CnnDiagram | TreeDiagram

/**
 * The one thing a task declares about doing its job by hand.
 *
 * Nothing here bounds how many pictures a person may be shown. The whole of the year's
 * crop is offered, the student decides when to stop, and what they run out of past that
 * is distinct photographs in the evaluation split — a real shortage rather than a
 * declared one. A declared cap made hand sorting a formality: a crop of six thousand
 * offered sixty, and the throughput argument for automating the job cannot be made by a
 * screen that stopped the student long before they were tired.
 *
 * Required of every task. A task with no figure for it cannot be timed at all, and a
 * screen is a worse place to discover that than a validator.
 */
export interface HandSortingDeclaration {
  /**
   * The most seconds any one image may contribute to the measured rate.
   *
   * A screen left standing over lunch would otherwise make the throughput figure absurd,
   * and the throughput figure is the argument for automating the job.
   */
  readonly secondsPerImage: number
}

export type FeatureId = string

/** The span a feature's values cover across the pool, inclusive at both ends. */
export interface FeatureRange {
  readonly min: number
  readonly max: number
}

/**
 * One number measured from an image's pixels, declared so a student can pick a threshold
 * on it.
 *
 * `specs/measured-features/spec.md` — a bare id is not enough, because 0.06 has to mean
 * something before it can be chosen. Every field here is required: the unit says what
 * scale the number lives on, the range says where the pool's values actually fall, and
 * the help says what the number means and how it can be wrong.
 *
 * `contaminatedBy` is the field that keeps a feature honest. It names the generation
 * attributes that move the value without being the thing the feature is nominally about
 * — a red apple in shadow measuring less red. A feature naming none is refused, because
 * a feature that recovers one attribute cleanly is that attribute under another name and
 * teaches nothing a measured feature exists to teach. What it names is checked against
 * the pool rather than taken on trust.
 */
export interface FeatureDeclaration {
  readonly id: FeatureId
  readonly label: string
  /** The unit or scale the values are expressed on, in words a student reads. */
  readonly unit: string
  readonly range: FeatureRange
  /** Generation attributes that measurably move this feature without being its subject. */
  readonly contaminatedBy: readonly string[]
  readonly help: string
}

/**
 * How large a rule this task offers a student to write by hand.
 *
 * Declared here rather than by whichever screen offers the rule builder, because the
 * recorded position of hand-written rules against trained ones is taken at this number: a
 * recording taken at a smaller budget would say nothing about the budget a student can
 * actually reach. The two are coupled rather than fixed — a change that offers more nodes
 * re-records the figures, which is what makes raising this number a decision somebody has
 * to take deliberately instead of a screen's default.
 */
export interface RuleBudgetDeclaration {
  /** Decision nodes, not leaves. Three nodes is a rule with three questions in it. */
  readonly maxNodes: number
}

/** Task-level explanatory copy. Knob-level copy lives on each knob's `help`. */
export interface TeachingCopy {
  readonly summary: string
  readonly theory: string
}

export type DatasetTierId = string

/**
 * How faithfully a dataset tier files the images it holds.
 *
 * Two values, declared rather than derived. `specs/dataset-tiers/spec.md` — label quality
 * "SHALL NOT be inferred from the tier's price, its size, its id, or whether any image
 * currently disagrees", because a tier that ships before its images exist has no image to
 * disagree with and would then read as checked by default. The one thing a student must be
 * told about a cheap dataset would be the one thing that arrives last.
 */
export const LABEL_QUALITIES = ['checked', 'some-wrong'] as const
export type LabelQuality = (typeof LABEL_QUALITIES)[number]

/**
 * One dataset a student can be fitting on: how many photos, of what mix, filed how well.
 *
 * The task's rather than the family's. The photos describe the job — they are the same
 * photos whatever is fitted to them — while *choosing* among them is a decision a student
 * makes per model, through the knob each family names in `datasetKnob`.
 *
 * `size` counts the photos the tier ends up with, not the ones it adds: membership nests,
 * so a larger tier holds every image of every smaller one and buying photos adds to the
 * set a student holds rather than replacing it.
 */
export interface DatasetTierDeclaration {
  /** Stable id, unique within the task. Appears in a configuration identifier. */
  readonly id: DatasetTierId
  /** What the set is called wherever it is offered, priced or browsed. */
  readonly label: string
  /** Training photos held, counting the ones the smaller tiers hold too. */
  readonly size: number
  /** How many of them this tier files under each declared category. Keyed by category id. */
  readonly composition: Readonly<Record<CategoryId, number>>
  readonly labelQuality: LabelQuality
  /**
   * The words that state this tier's label quality to a student.
   *
   * Declared rather than composed by a screen, so that no screen has to know what a tier
   * or a label quality is. It says *that* some labels are wrong and never *which*:
   * naming them would hand over the thing a student is meant to find by looking.
   */
  readonly disclosure: string
}

export type FamilyId = string

/**
 * What the pipeline sends to the browser for one family.
 *
 * `model` and `predictions`, not `artifact` and `live`. "Live" is not a source — it is
 * what every family except a convolutional one does; the convolutional family precomputes
 * *because its model cannot ship*, so the real distinction is whether the pipeline sends
 * the model itself or a table of the predictions it made. Two values and no third: a
 * student-authored source would need one, and there is no such family.
 */
export const SHIPPED_FORMS = ['model', 'predictions'] as const
export type ShippedForm = (typeof SHIPPED_FORMS)[number]

/**
 * How a family is recognised in a task's labour slot on the farm overview.
 *
 * Declared rather than supplied by the screen, so the farm can be read at a glance for
 * which family is working which crop without a screen learning the word "tree".
 */
export interface SlotAppearance {
  /** A short glyph, as the farm's manual labour already declares one. */
  readonly icon: string
  /** A word or two, short enough to sit on a card. */
  readonly label: string
}

/**
 * That a family records a training history, and what that history is indexed by.
 *
 * The axis is declared because it is not always epochs: a fitted tree indexes its growth
 * by splits added, deliberately, so that its curve is in the same units as the network's.
 * `web/src/screens/TrainingRun.tsx` used to write `epoch <n>` itself, which is one
 * family's vocabulary hardcoded in a screen.
 *
 * A family that records no history declares no block at all, rather than declaring one
 * with an empty axis — so "has a history" and "has an axis label" cannot disagree.
 */
export interface HistoryDeclaration {
  /** What one step of the history is called, in words a student reads. */
  readonly axis: string
}

/**
 * Identifies one tutorial across every declaration loaded.
 *
 * Not the family's id and not the task's: a family id is only unique within its task, and
 * completion is recorded once globally, so neither could be the key. Two families that
 * declare this same id declare the same tutorial and share one completion.
 */
export type TutorialId = string

/**
 * The comprehension gate between owning a model family and putting it to work.
 *
 * Free, unlimited, and passed once. What is recorded is that it was passed and nothing
 * else — a puzzle that records how well it was solved is a puzzle a student optimises
 * instead of reads.
 *
 * `puzzle` is deliberately opaque here. The frame poses, judges, records and gates without
 * knowing what a solution is; only the registered kind reads past `kind`. That is what
 * lets a body be added as a leaf under `src/tutorials/` rather than as a widening of this
 * type, which is the same bargain `DiagramDeclaration` makes for a family's drawing —
 * except that a drawing's kinds are closed and a tutorial's are not, because the
 * interaction *is* the lesson and cannot be data-driven.
 */
export interface TutorialDeclaration {
  readonly id: TutorialId
  /** What the puzzle is called, in words a student reads. */
  readonly title: string
  /** What it teaches, and the theory beside it. The family's copy is the model's. */
  readonly teaching: TeachingCopy
  /**
   * What this puzzle withholds or simplifies relative to the model it teaches.
   *
   * Its own field rather than a passage inside `teaching.theory`, and required rather
   * than optional. Theory sits behind a disclosure on every screen in this build and is
   * read by whoever opens it; this is the one sentence a tutorial says about *itself*,
   * and a student who never opened the theory would otherwise be left believing the
   * simplification. Giving it a field makes the obligation structural for every kind that
   * is ever added, instead of a property of one body's prose a later author can drop.
   */
  readonly disclosure: string
  /** Which registered kind poses, checks and judges it. */
  readonly kind: string
  /** Everything past `kind`: this kind's own data, read by nothing else. */
  readonly puzzle: unknown
}

/**
 * One rung of the learning ladder: a kind of model a task offers.
 *
 * A family owns everything that is about the *model* — the knobs, the drawing, where its
 * predictions or its model come from, and the words that explain it. The task owns
 * everything about the *job*. The test for the split is whether two families of one task
 * could disagree about a field: they cannot disagree about what a wormy apple is worth,
 * and they must be able to disagree about what knobs they have.
 *
 * See openspec/changes/model-families/specs/model-families/spec.md.
 */
export interface ModelFamilyDeclaration {
  /** Stable id, unique within its task. Scopes this family's configuration identity. */
  readonly id: FamilyId
  readonly label: string
  /** Whether the pipeline ships this family's model or a table of its predictions. */
  readonly ships: ShippedForm
  readonly knobs: readonly KnobDeclaration[]
  /**
   * Which of this family's knobs selects the dataset it is fitted on.
   *
   * Named explicitly rather than found by convention, the same bargain `ships` makes: a
   * family may call the knob whatever its teaching copy wants, and nothing infers the
   * fitting set from a knob id or from which values happen to look like tier ids.
   *
   * Required of every family. A model is always fitted on something, and letting a family
   * omit it would put a silent default in the one place tiers exist to make explicit — and
   * `specs/dataset-tiers/spec.md` forbids reading the tier off what a student owns, since
   * an identifier whose meaning moved on the day photos were bought would re-key every
   * artifact already shipped.
   */
  readonly datasetKnob: KnobId
  /** What this family is and what turning its knobs does. The task's copy is the job's. */
  readonly teaching: TeachingCopy
  readonly slot: SlotAppearance
  /**
   * Reference to this family's precomputed prediction artifact. Required of a family
   * that ships predictions, and meaningless to one that ships its model.
   *
   * On the family rather than on the task: two families of one task compose the same
   * identifier strings from different knobs, so one artifact could never serve both.
   */
  readonly predictions?: string
  /**
   * Reference to this family's shipped models, one small file per configuration.
   * Required of a family that ships its model.
   */
  readonly models?: string
  /**
   * How to draw the architecture this family's knobs describe. Optional: a family
   * declaring none is drawn none, rather than having one guessed for it.
   */
  readonly diagram?: DiagramDeclaration
  /** Present exactly when this family records a training history. */
  readonly history?: HistoryDeclaration
  /**
   * The puzzle a student passes once before this family may be put to work.
   *
   * Optional: a family declaring none is fielded as soon as it is owned, exactly as every
   * family was before tutorials existed. It sits here rather than on the task because two
   * families of one task can disagree about which lesson explains them — the same test
   * that put the knobs, the drawing and the history here.
   */
  readonly tutorial?: TutorialDeclaration
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
  /**
   * The dataset tiers the task's training split is divided into, smallest first.
   *
   * At least one, in ascending order of size and no two the same size, so that "the
   * smaller tier" and "the smallest tier" each name exactly one of them — which is what
   * the declared default of every family's dataset knob is held to.
   */
  readonly datasets: readonly DatasetTierDeclaration[]
  /**
   * The kinds of model this task offers, in the order they are presented. At least one.
   *
   * The knobs, the drawing and where predictions come from all live here rather than on
   * the task, because a task offers several families and they share none of the three.
   */
  readonly families: readonly ModelFamilyDeclaration[]
  /** The numbers measured from each image's pixels, as a student is shown them. */
  readonly features: readonly FeatureDeclaration[]
  /** The largest hand-written rule this task will ever offer. */
  readonly ruleBudget: RuleBudgetDeclaration
  readonly payoffs: PayoffTable
  /** What one person can get through doing this task's job by hand. */
  readonly handSorting: HandSortingDeclaration
  readonly teaching: TeachingCopy
  /**
   * How the batch as a whole is priced. Optional: a task declaring none is valued as the
   * sum of its payoff entries, exactly as though the concept did not exist.
   */
  readonly delivery?: DeliveryTerm
  /** False for a task that is announced on the farm overview but not playable. */
  readonly available: boolean
}

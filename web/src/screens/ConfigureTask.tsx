/**
 * The workshop: where a model is made, and where one is put to work.
 *
 * Every control on this screen comes from the task's knob declarations, and
 * every word of explanation comes from its teaching copy. Adding a knob, or a
 * whole lesson, changes nothing in this file.
 *
 * Nothing here runs the year and nothing here moves money. That is the split
 * `workshop-harvest-split` exists for: hypotheses have to be cheap or they will not be
 * formed, so a student may enter, browse, and make a model as often as they like at no
 * cost. The year is one deliberate act belonging to the whole farm, and it is run from
 * the overview.
 */

import { useMemo, useState } from 'react'
import type { FamilyEntry } from '../../../src/families/index.js'
import type { BenchView, TaskAvailability } from '../../../src/progression/index.js'
import { knobAvailability } from '../../../src/progression/index.js'
import { resolveArchitecture } from '../../../src/task/diagram.js'
import { selectableFamily, selectedFamily } from '../../../src/task/families.js'
import type { TaskDeclaration, TutorialId } from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import type { TutorialKinds } from '../../../src/tutorials/index.js'
import { isTutorialComplete } from '../../../src/tutorials/index.js'
import type { Loaded } from '../data/load.js'
import type { TrainingSplitView } from '../data/pool.js'
import { FamilyPicker } from '../components/FamilyPicker.js'
import { HelpDisclosure } from '../components/HelpDisclosure.js'
import { Issues } from '../components/Issues.js'
import { KnobControl } from '../components/KnobControl.js'
import { ArchitectureDiagram } from '../components/architecture/ArchitectureDiagram.js'
import { Tutorial } from '../components/tutorial/Tutorial.js'
import type { TutorialBodies } from '../components/tutorial/TutorialBody.js'
import { defaultKnobValues, identifyConfiguration, type KnobValues } from '../model/run.js'
import { TrainingBrowser } from './TrainingBrowser.js'
import { TrainingRun } from './TrainingRun.js'
import { UpgradeBench } from './UpgradeBench.js'

export interface ConfigureTaskProps {
  readonly declaration: TaskDeclaration
  /**
   * Fetches one configuration of one family.
   *
   * A function rather than loaded data: a family ships one file per configuration, so
   * opening a task transfers coverage and provenance, and running one transfers that
   * configuration alone — and nothing belonging to the task's other families.
   */
  readonly loadEntry: (familyId: string, configurationId: string) => Promise<Loaded<FamilyEntry>>
  readonly onBack: () => void
  /**
   * Fetches this task's training split, when the task ships one to browse.
   *
   * Given here rather than opened as a stage of its own: leaving the browser has to
   * leave the knob values selected, and they live in this screen's state. A sibling
   * stage would unmount it — `design.md`.
   *
   * Forwarded to a mounted tutorial as well, for a puzzle that is about particular
   * pictures of that split. The same loader rather than a second one: nothing about the
   * pool should be fetched twice, and what crosses this boundary has already had the
   * generation attributes and the measured values dropped from it.
   */
  readonly loadSplit?: (tier: string) => Promise<Loaded<TrainingSplitView>>
  /**
   * How long the training replay takes. Injected by tests, which have no reason to
   * sit through it; the screen otherwise uses the pacing the replay declares.
   */
  readonly replayMs?: number
  /**
   * Which of each knob's declared values this farm may select, and what opens the rest.
   *
   * Passed in rather than worked out here: the progression module is the only place
   * unlock rules live, and a screen that decided for itself would be a screen that could
   * disagree with the one that refuses the run.
   */
  readonly availability?: TaskAvailability
  /** Presents a price in the farm's declared currency, for a locked value that has one. */
  readonly formatPrice?: (units: number) => string
  /**
   * Which family to open at — what progress recorded, where it recorded one.
   *
   * Undefined opens at the task's first declared family, which is the specified rule for
   * progress that says nothing.
   */
  readonly initialFamily?: string
  /** Reports a family being selected, so the shell can keep it between visits. */
  readonly onFamilyChange?: (familyId: string) => void
  /**
   * The knob values to open each family at — what the student last left, per family.
   *
   * Per family because tuning one family must not lose another's: a family this records
   * nothing for opens at its declared defaults.
   */
  readonly initialValues?: (familyId: string) => KnobValues | undefined
  /** Reports every change, so the shell can keep them between visits. */
  readonly onValuesChange?: (familyId: string, values: KnobValues) => void
  /**
   * The configuration already at work for this task, where one is.
   *
   * What is *at work* and what is in the knobs are deliberately different state. The
   * knobs are a scratchpad a student may move freely; the slot is a commitment the year
   * reads. Tinkering with one must not silently change the other — `design.md`,
   * decision 2.
   */
  readonly atWork?: { readonly family: string; readonly configurationId: string }
  /** Puts the model just made to work for this task. Offered only once it is made. */
  readonly onPutToWork?: (familyId: string, configurationId: string) => void
  /** Hands this task's job back to the farm's manual labour. */
  readonly onHandBack?: () => void
  /**
   * Which of this task's tutorials this farm has passed, by tutorial id.
   *
   * Passed in rather than worked out here, for the same reason availability is: whether a
   * family may be fielded is `src/progression/`'s answer, and a screen that decided for
   * itself could offer a control the labour resolver would then refuse.
   */
  readonly completedTutorials?: readonly TutorialId[]
  /** Reports a tutorial passed, so the shell can keep it between visits. */
  readonly onTutorialComplete?: (tutorialId: TutorialId) => void
  /** Injected by tests, which judge a fixture puzzle no shipped build carries. */
  readonly tutorialKinds?: TutorialKinds
  /** Injected by tests, which mount a fixture body no shipped build carries. */
  readonly tutorialBodies?: TutorialBodies
  /**
   * What the upgrade bench sells for this task, when the shell offers one.
   *
   * A stage of the workshop rather than a screen beside it, for the reason the browser
   * is one: leaving it has to leave the knob values, the replay and the family selection
   * exactly as they were, and a sibling stage would unmount this screen.
   */
  readonly bench?: BenchView
  /** Buys one item at the bench. The same `purchase()` the market's control calls. */
  readonly onBuyUpgrade?: (itemId: string) => void
  /** Why the last purchase at the bench did not happen, as the engine reported it. */
  readonly purchaseRefusal?: readonly ValidationIssue[]
}

/**
 * How far the student has got with the configuration in the knobs.
 *
 * A model is made first and read on its curves, and only then may it be put to work.
 * Gating the commitment on the replay having played is what makes the diagnostic
 * unskippable at the moment it matters; being *at work* is not gated the same way, or a
 * slot would empty itself on every reload.
 */
type Stage =
  | { readonly kind: 'untrained' }
  | { readonly kind: 'fetching' }
  /** The replay is playing, or has played, for this configuration's fetched entry. */
  | {
      readonly kind: 'training' | 'trained'
      readonly familyId: string
      readonly configurationId: string
      readonly entry: FamilyEntry
    }

export function ConfigureTask({
  declaration,
  loadEntry,
  onBack,
  loadSplit,
  replayMs,
  availability,
  formatPrice,
  initialFamily,
  onFamilyChange,
  initialValues,
  onValuesChange,
  atWork,
  onPutToWork,
  onHandBack,
  completedTutorials = [],
  onTutorialComplete,
  tutorialKinds,
  tutorialBodies,
  bench,
  onBuyUpgrade,
  purchaseRefusal,
}: ConfigureTaskProps) {
  /**
   * Whether a family may be selected. Silence locks nothing, which is what a shell that
   * supplies no availability means and what every build meant before anything could
   * lock a family.
   */
  const isAvailable =
    availability === undefined
      ? undefined
      : (candidate: string) =>
          availability.families.find((entry) => entry.familyId === candidate)?.available ?? true

  const [familyId, setFamilyId] = useState<string | undefined>(
    () => selectableFamily(declaration, initialFamily, isAvailable)?.id,
  )
  // The first declared *available* family, so a task whose first rung is still in the
  // market opens on one the student can use. Undefined is a real answer: a task none of
  // whose families is owned is a farm at the start of the game, not a farm in error.
  const family = selectableFamily(declaration, familyId, isAvailable)
  const [values, setValues] = useState<KnobValues>(() =>
    family === undefined ? {} : (initialValues?.(family.id) ?? defaultKnobValues(declaration, family)),
  )
  const [refusal, setRefusal] = useState<readonly ValidationIssue[] | undefined>(undefined)
  const [browsing, setBrowsing] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'untrained' })
  const [sitting, setSitting] = useState(false)
  const [atBench, setAtBench] = useState(false)

  // The one question the gate turns on. A family declaring no tutorial is fielded the
  // moment it is owned, which is what every family did before tutorials existed.
  const tutorial = family?.tutorial
  const tutorialDone = isTutorialComplete(tutorial, completedTutorials)

  const identified =
    family === undefined ? undefined : identifyConfiguration(declaration, family, values, availability)
  const currentId = identified?.ok === true ? identified.id : undefined
  // Derived, not stored: the drawing is a function of the values already held above, so
  // there is no second copy of the configuration to keep in step. Undefined for a family
  // declaring no diagram, and beside a configuration the engine will not resolve.
  // A family that ships its model is drawn from the model, which arrives with the entry
  // — so its drawing appears once the configuration has been fetched and not before.
  // The entry is passed rather than fetched again, which is what makes the tree on
  // screen and the tree that scores the harvest the same object.
  const architecture =
    family === undefined
      ? undefined
      : resolveArchitecture(
          declaration,
          family,
          values,
          stage.kind === 'training' || stage.kind === 'trained' ? stage.entry.structure : undefined,
        )

  /**
   * The photographs of the tier the dataset knob currently names.
   *
   * The knob rather than what is owned: a student owning the largest set and having
   * selected the smallest is shown the smallest, because that is the set the model in
   * front of them will be fitted on — `specs/training-browser/spec.md`. Memoised on the
   * selected value, so changing the tier refetches and changing anything else does not.
   *
   * Sits above every early return below, because a hook has to run on every render.
   */
  const selectedTier = family === undefined ? '' : String(values[family.datasetKnob] ?? '')
  /** The declared tier that value names, for the copy shown beside the knobs. */
  const browsedTier = declaration.datasets.find((tier) => tier.id === selectedTier)
  const browseSelectedTier = useMemo(
    () => (loadSplit === undefined ? undefined : () => loadSplit(selectedTier)),
    [loadSplit, selectedTier],
  )

  function setKnob(id: string, value: string | number): void {
    if (family === undefined) return
    const next = { ...values, [id]: value }
    setValues(next)
    // Reported from the handler rather than from inside the updater: a state updater must
    // stay a pure function of what it is given, and React may call one twice.
    onValuesChange?.(family.id, next)
    // Clearing the refusal, so a stale explanation never sits under new knob values.
    setRefusal(undefined)
    // A trained model belongs to its configuration even more strictly than a report
    // does: there is no honest way to show one configuration's curves under another's
    // knobs, so the replay goes and the student trains again.
    setStage({ kind: 'untrained' })
  }

  /**
   * Shows a different family: its own knobs, at its own remembered values.
   *
   * Free, and it commits nothing. No money moves, no ledger record is written, the year
   * stands where it stood, and whatever is at work stays at work — looking at a family is
   * not putting it to work. What it does clear is the replay, which belonged to the
   * family that was showing.
   */
  function selectFamily(next: string): void {
    if (next === familyId) return
    const chosen = selectedFamily(declaration, next)
    setFamilyId(chosen.id)
    setValues(initialValues?.(chosen.id) ?? defaultKnobValues(declaration, chosen))
    onFamilyChange?.(chosen.id)
    setRefusal(undefined)
    setStage({ kind: 'untrained' })
    // The puzzle showing belonged to the family that was showing.
    setSitting(false)
  }

  async function train(): Promise<void> {
    if (family === undefined) return
    const identified = identifyConfiguration(declaration, family, values, availability)
    if (!identified.ok) {
      // Not repeated as a second refusal: the settings block below already carries these
      // issues for as long as the values that caused them are the ones in the knobs.
      setRefusal(undefined)
      setStage({ kind: 'untrained' })
      return
    }

    setStage({ kind: 'fetching' })
    // Fetched per run rather than held: a student who never chooses a configuration
    // never transfers it, and one they return to is served from the browser's cache.
    const loaded = await loadEntry(family.id, identified.id)
    if (!loaded.ok) {
      setRefusal(loaded.issues)
      setStage({ kind: 'untrained' })
      return
    }

    setRefusal(undefined)
    setStage({
      kind: 'training',
      familyId: family.id,
      configurationId: identified.id,
      entry: loaded.value,
    })
  }

  // Mounted the way the browser is, and for the same reason: leaving the puzzle has to
  // leave the knob values, the replay and the family selection exactly as they were.
  if (sitting && tutorial !== undefined) {
    return (
      <section aria-labelledby="task-heading">
        <h1 id="task-heading">{declaration.title}</h1>
        <Tutorial
          tutorial={tutorial}
          loadSplit={browseSelectedTier}
          complete={tutorialDone}
          onComplete={() => onTutorialComplete?.(tutorial.id)}
          onClose={() => setSitting(false)}
          kinds={tutorialKinds}
          bodies={tutorialBodies}
        />
      </section>
    )
  }

  // Mounted the way the browser and the puzzle are, and for the same reason: buying an
  // upgrade must leave the knobs exactly as the student left them, with more of their
  // values selectable. Reaching the bench selects nothing and commits nothing.
  if (atBench && bench !== undefined) {
    return (
      <section aria-labelledby="task-heading">
        <h1 id="task-heading">{declaration.title}</h1>
        <UpgradeBench
          view={bench}
          formatPrice={formatPrice ?? ((units) => String(units))}
          onBuy={(itemId) => onBuyUpgrade?.(itemId)}
          onBack={() => setAtBench(false)}
          refusal={purchaseRefusal}
        />
      </section>
    )
  }

  // This screen stays mounted while the browser is open, so the knob values, the run
  // and its refusal are all still here when the student comes back.
  if (browsing && browseSelectedTier !== undefined) {
    return (
      <section aria-labelledby="task-heading">
        <h1 id="task-heading">{declaration.title}</h1>
        <TrainingBrowser
          load={browseSelectedTier}
          onBack={() => setBrowsing(false)}
        />
      </section>
    )
  }

  return (
    <section aria-labelledby="task-heading">
      <button type="button" onClick={onBack}>
        Back to the farm
      </button>

      <h1 id="task-heading">{declaration.title}</h1>
      <p>{declaration.teaching.summary}</p>
      <HelpDisclosure label="What am I actually changing?">
        {declaration.teaching.theory}
      </HelpDisclosure>

      <FamilyPicker
        families={declaration.families}
        selected={family?.id}
        onSelect={selectFamily}
        availability={availability?.families}
        formatPrice={formatPrice}
      />

      {bench === undefined ? null : (
        <p className="bench-offer">
          <button type="button" onClick={() => setAtBench(true)}>
            Upgrades
          </button>
        </p>
      )}

      {/*
        A task none of whose models the farm owns. Something to go and buy, not a fault:
        the picker above has already said what opens each, so this says only that there
        is nothing to tune yet and offers no knobs, no model to make and no refusal.
      */}
      {family === undefined ? (
        <p className="no-family">
          Nothing here is yours yet. Each of these is opened by what is beside it.
        </p>
      ) : (
        <>
      <p className="family-summary">{family.teaching.summary}</p>
      <HelpDisclosure label={`How does ${family.label} work?`}>
        {family.teaching.theory}
      </HelpDisclosure>

      {/*
        Offered whether or not it has been passed, so its theory copy stays reachable
        afterwards, and offered here rather than sprung on a purchase — the market has
        already promised that money is the only key to what it sells.
      */}
      {tutorial === undefined ? null : (
        <p className="tutorial-offer">
          <button type="button" onClick={() => setSitting(true)}>
            {tutorial.title}
          </button>
          {tutorialDone ? <span> — finished</span> : null}
        </p>
      )}

      {loadSplit === undefined ? null : (
        <p>
          <button type="button" onClick={() => setBrowsing(true)}>
            See the training data
          </button>
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void train()
        }}
      >
        <div className="configure-columns">
          <fieldset>
            <legend>Settings</legend>
            {(family?.knobs ?? []).map((knob) => (
              <KnobControl
                key={knob.id}
                knob={knob}
                value={values[knob.id] ?? knob.default}
                onChange={(value) => setKnob(knob.id, value)}
                availability={
                  availability === undefined
                    ? undefined
                    : knobAvailability(availability, knob.id)?.values
                }
                formatPrice={formatPrice}
              />
            ))}
            {/*
              The set the dataset knob currently names, said in its own declared words.
              `specs/dataset-tiers/spec.md` — a tier's label quality is stated wherever the
              tier is offered for selection, not only where its images are browsed, so a
              student is told before they fit rather than after the harvest disagrees.
            */}
            {browsedTier === undefined ? null : (
              <p className="disclosure" data-disclosure={browsedTier.id}>
                <strong>{browsedTier.label}.</strong> {browsedTier.disclosure}
              </p>
            )}
          </fieldset>

          {architecture === undefined ? null : <ArchitectureDiagram architecture={architecture} />}
        </div>

        {currentId === undefined ? null : (
          <p className="configuration">
            This is configuration <code data-testid="current-configuration">{currentId}</code>.
          </p>
        )}

        <button type="submit" disabled={stage.kind === 'fetching' || stage.kind === 'training'}>
          {stage.kind === 'fetching'
            ? 'Loading the model…'
            : stage.kind === 'training'
              ? 'Training…'
              : 'Train model'}
        </button>
      </form>

      {identified === undefined || identified.ok ? null : (
        <Issues title="These settings cannot be used" issues={identified.issues} />
      )}

      {refusal === undefined ? null : (
        <Issues title="This model could not be made" issues={refusal} />
      )}

      {stage.kind === 'training' || stage.kind === 'trained' ? (
        <TrainingRun
          key={`${stage.familyId}-${stage.configurationId}`}
          history={stage.entry.history ?? []}
          axis={family.history?.axis}
          configurationId={stage.configurationId}
          durationMs={replayMs}
          onFinished={() =>
            setStage((current) =>
              current.kind === 'training' ? { ...current, kind: 'trained' } : current,
            )
          }
        />
      ) : null}

      {stage.kind === 'trained' && onPutToWork !== undefined && tutorialDone ? (
        <p>
          <button
            type="button"
            onClick={() => {
              if (stage.kind !== 'trained') return
              onPutToWork(stage.familyId, stage.configurationId)
            }}
          >
            Put this model to work
          </button>
        </p>
      ) : null}

      {/*
        Something to go and do, not a fault. The student owns this family and has made the
        model; what is missing is a lesson, so this names it, offers the way to it, and
        says nothing about buying anything or about a configuration that will not run.
      */}
      {stage.kind === 'trained' && onPutToWork !== undefined && tutorial !== undefined && !tutorialDone ? (
        <p className="tutorial-withheld">
          <span>
            Before this one goes out to the orchard, finish {tutorial.title}.
          </span>
          <button type="button" onClick={() => setSitting(true)}>
            {tutorial.title}
          </button>
        </p>
      ) : null}

        </>
      )}

      {atWork === undefined ? null : (
        <p className="at-work">
          <span>
            {selectedFamily(declaration, atWork.family).label}, configuration{' '}
            <code data-testid="at-work">{atWork.configurationId}</code>, is at work here.
          </span>
          {onHandBack === undefined ? null : (
            <button type="button" onClick={onHandBack}>
              Hand this job back
            </button>
          )}
        </p>
      )}
    </section>
  )
}

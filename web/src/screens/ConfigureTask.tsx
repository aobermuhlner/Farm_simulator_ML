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

import { useState } from 'react'
import type { ConfigurationEntry } from '../../../src/task/artifact.js'
import type { TaskAvailability } from '../../../src/progression/index.js'
import { knobAvailability } from '../../../src/progression/index.js'
import { resolveArchitecture } from '../../../src/task/diagram.js'
import type { TaskDeclaration } from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import type { Loaded } from '../data/load.js'
import type { TrainingSplitView } from '../data/pool.js'
import { HelpDisclosure } from '../components/HelpDisclosure.js'
import { Issues } from '../components/Issues.js'
import { KnobControl } from '../components/KnobControl.js'
import { ArchitectureDiagram } from '../components/architecture/ArchitectureDiagram.js'
import { defaultKnobValues, identifyConfiguration, type KnobValues } from '../model/run.js'
import { TrainingBrowser } from './TrainingBrowser.js'
import { TrainingRun } from './TrainingRun.js'

export interface ConfigureTaskProps {
  readonly declaration: TaskDeclaration
  /**
   * Fetches one configuration's predictions and history.
   *
   * A function rather than loaded data: the artifact ships one file per configuration,
   * so opening a task transfers coverage and provenance, and running one transfers that
   * configuration alone.
   */
  readonly loadEntry: (configurationId: string) => Promise<Loaded<ConfigurationEntry>>
  readonly onBack: () => void
  /**
   * Fetches this task's training split, when the task ships one to browse.
   *
   * Given here rather than opened as a stage of its own: leaving the browser has to
   * leave the knob values selected, and they live in this screen's state. A sibling
   * stage would unmount it — `design.md`.
   */
  readonly loadSplit?: () => Promise<Loaded<TrainingSplitView>>
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
  /** The knob values to open at — what the student last left, where a save kept them. */
  readonly initialValues?: KnobValues
  /** Reports every change, so the shell can keep them between visits. */
  readonly onValuesChange?: (values: KnobValues) => void
  /**
   * The configuration already at work for this task, where one is.
   *
   * What is *at work* and what is in the knobs are deliberately different state. The
   * knobs are a scratchpad a student may move freely; the slot is a commitment the year
   * reads. Tinkering with one must not silently change the other — `design.md`,
   * decision 2.
   */
  readonly atWork?: string
  /** Puts the model just made to work for this task. Offered only once it is made. */
  readonly onPutToWork?: (configurationId: string) => void
  /** Hands this task's job back to the farm's manual labour. */
  readonly onHandBack?: () => void
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
      readonly configurationId: string
      readonly entry: ConfigurationEntry
    }

export function ConfigureTask({
  declaration,
  loadEntry,
  onBack,
  loadSplit,
  replayMs,
  availability,
  formatPrice,
  initialValues,
  onValuesChange,
  atWork,
  onPutToWork,
  onHandBack,
}: ConfigureTaskProps) {
  const [values, setValues] = useState<KnobValues>(
    () => initialValues ?? defaultKnobValues(declaration),
  )
  const [refusal, setRefusal] = useState<readonly ValidationIssue[] | undefined>(undefined)
  const [browsing, setBrowsing] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'untrained' })

  const identified = identifyConfiguration(declaration, values, availability)
  const currentId = identified.ok ? identified.id : undefined
  // Derived, not stored: the drawing is a function of the values already held above, so
  // there is no second copy of the configuration to keep in step. Undefined for a task
  // declaring no diagram, and beside a configuration the engine will not resolve.
  const architecture = resolveArchitecture(declaration, values)

  function setKnob(id: string, value: string | number): void {
    const next = { ...values, [id]: value }
    setValues(next)
    // Reported from the handler rather than from inside the updater: a state updater must
    // stay a pure function of what it is given, and React may call one twice.
    onValuesChange?.(next)
    // Clearing the refusal, so a stale explanation never sits under new knob values.
    setRefusal(undefined)
    // A trained model belongs to its configuration even more strictly than a report
    // does: there is no honest way to show one configuration's curves under another's
    // knobs, so the replay goes and the student trains again.
    setStage({ kind: 'untrained' })
  }

  async function train(): Promise<void> {
    const identified = identifyConfiguration(declaration, values, availability)
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
    const loaded = await loadEntry(identified.id)
    if (!loaded.ok) {
      setRefusal(loaded.issues)
      setStage({ kind: 'untrained' })
      return
    }

    setRefusal(undefined)
    setStage({ kind: 'training', configurationId: identified.id, entry: loaded.value })
  }

  // This screen stays mounted while the browser is open, so the knob values, the run
  // and its refusal are all still here when the student comes back.
  if (browsing && loadSplit !== undefined) {
    return (
      <section aria-labelledby="task-heading">
        <h1 id="task-heading">{declaration.title}</h1>
        <TrainingBrowser
          load={loadSplit}
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
            {declaration.knobs.map((knob) => (
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

      {identified.ok ? null : (
        <Issues title="These settings cannot be used" issues={identified.issues} />
      )}

      {refusal === undefined ? null : (
        <Issues title="This model could not be made" issues={refusal} />
      )}

      {stage.kind === 'training' || stage.kind === 'trained' ? (
        <TrainingRun
          key={stage.configurationId}
          history={stage.entry.history}
          configurationId={stage.configurationId}
          durationMs={replayMs}
          onFinished={() =>
            setStage((current) =>
              current.kind === 'training' ? { ...current, kind: 'trained' } : current,
            )
          }
        />
      ) : null}

      {stage.kind === 'trained' && onPutToWork !== undefined ? (
        <p>
          <button
            type="button"
            onClick={() => {
              if (stage.kind !== 'trained') return
              onPutToWork(stage.configurationId)
            }}
          >
            Put this model to work
          </button>
        </p>
      ) : null}

      {atWork === undefined ? null : (
        <p className="at-work">
          <span>
            Configuration <code data-testid="at-work">{atWork}</code> is at work here.
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

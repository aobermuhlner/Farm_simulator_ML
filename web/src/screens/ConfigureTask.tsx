/**
 * Configure a task and run it.
 *
 * Every control on this screen comes from the task's knob declarations, and
 * every word of explanation comes from its teaching copy. Adding a knob, or a
 * whole lesson, changes nothing in this file.
 */

import { useState } from 'react'
import type { ConfigurationEntry } from '../../../src/task/artifact.js'
import { resolveArchitecture } from '../../../src/task/diagram.js'
import type { RunOutcome } from '../../../src/scoring/index.js'
import type { CategoryId, TaskDeclaration } from '../../../src/task/types.js'
import type { ValidationIssue } from '../../../src/task/validate.js'
import type { Loaded } from '../data/load.js'
import type { TrainingSplitView } from '../data/pool.js'
import { HelpDisclosure } from '../components/HelpDisclosure.js'
import { Issues } from '../components/Issues.js'
import { KnobControl } from '../components/KnobControl.js'
import { ArchitectureDiagram } from '../components/architecture/ArchitectureDiagram.js'
import { defaultKnobValues, identifyConfiguration, runPool, type KnobValues } from '../model/run.js'
import { Report } from './Report.js'
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
  readonly truth: Readonly<Record<string, CategoryId>>
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
}

/** A finished run, remembered with the configuration that produced it. */
interface Finished {
  readonly configurationId: string
  readonly outcome: RunOutcome
}

/**
 * How far the student has got with the configuration in the knobs.
 *
 * Two phases, deliberately separated: a model is trained first and read on its curves,
 * and only then can a month be run over it. Pressing one button and reading earnings
 * conflates "is this model any good" with "did the farm make money", which is the
 * question the curves are there to answer first.
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
  truth,
  onBack,
  loadSplit,
  replayMs,
}: ConfigureTaskProps) {
  const [values, setValues] = useState<KnobValues>(() => defaultKnobValues(declaration))
  const [finished, setFinished] = useState<Finished | undefined>(undefined)
  const [refusal, setRefusal] = useState<readonly ValidationIssue[] | undefined>(undefined)
  const [browsing, setBrowsing] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'untrained' })

  const identified = identifyConfiguration(declaration, values)
  const currentId = identified.ok ? identified.id : undefined
  // Derived, not stored: the drawing is a function of the values already held above, so
  // there is no second copy of the configuration to keep in step. Undefined for a task
  // declaring no diagram, and beside a configuration the engine will not resolve.
  const architecture = resolveArchitecture(declaration, values)

  function setKnob(id: string, value: string | number): void {
    setValues((previous) => ({ ...previous, [id]: value }))
    // A report belongs to the configuration that produced it. Clearing the
    // refusal too, so a stale explanation never sits under new knob values.
    setRefusal(undefined)
    // A trained model belongs to its configuration even more strictly than a report
    // does: there is no honest way to show one configuration's curves under another's
    // knobs, so the replay goes and the student trains again.
    setStage({ kind: 'untrained' })
  }

  async function train(): Promise<void> {
    const identified = identifyConfiguration(declaration, values)
    if (!identified.ok) {
      setRefusal(identified.issues)
      setFinished(undefined)
      setStage({ kind: 'untrained' })
      return
    }

    setStage({ kind: 'fetching' })
    setFinished(undefined)
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

  /** Runs the month over the model just trained — the entry is already in hand. */
  function harvest(): void {
    if (stage.kind !== 'trained') return

    const result = runPool(declaration, values, stage.entry, truth)
    if (!result.ok) {
      setRefusal(result.issues)
      setFinished(undefined)
      return
    }
    setRefusal(undefined)
    setFinished({ configurationId: result.configurationId, outcome: result.outcome })
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
        <Issues title="This run did not happen" issues={refusal} />
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

      {stage.kind === 'trained' ? (
        <p>
          <button type="button" onClick={harvest}>
            Run a month
          </button>
        </p>
      ) : null}

      {finished === undefined ? null : (
        <Report
          declaration={declaration}
          configurationId={finished.configurationId}
          outcome={finished.outcome}
          stale={finished.configurationId !== currentId}
        />
      )}
    </section>
  )
}

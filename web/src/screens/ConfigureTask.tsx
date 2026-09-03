/**
 * Configure a task and run it.
 *
 * Every control on this screen comes from the task's knob declarations, and
 * every word of explanation comes from its teaching copy. Adding a knob, or a
 * whole lesson, changes nothing in this file.
 */

import { useState } from 'react'
import type { PredictionArtifact } from '../../../src/task/artifact.js'
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

export interface ConfigureTaskProps {
  readonly declaration: TaskDeclaration
  readonly artifact: PredictionArtifact
  readonly truth: Readonly<Record<string, CategoryId>>
  readonly fixtureBacked: boolean
  readonly onBack: () => void
  /**
   * Fetches this task's training split, when the task ships one to browse.
   *
   * Given here rather than opened as a stage of its own: leaving the browser has to
   * leave the knob values selected, and they live in this screen's state. A sibling
   * stage would unmount it — `design.md`.
   */
  readonly loadSplit?: () => Promise<Loaded<TrainingSplitView>>
}

/** A finished run, remembered with the configuration that produced it. */
interface Finished {
  readonly configurationId: string
  readonly outcome: RunOutcome
}

export function ConfigureTask({
  declaration,
  artifact,
  truth,
  fixtureBacked,
  onBack,
  loadSplit,
}: ConfigureTaskProps) {
  const [values, setValues] = useState<KnobValues>(() => defaultKnobValues(declaration))
  const [finished, setFinished] = useState<Finished | undefined>(undefined)
  const [refusal, setRefusal] = useState<readonly ValidationIssue[] | undefined>(undefined)
  const [browsing, setBrowsing] = useState(false)

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
  }

  function run(): void {
    const result = runPool(declaration, values, artifact, truth)
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
          fixtureBacked={fixtureBacked}
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
          run()
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

        <button type="submit">Run a month</button>
      </form>

      {identified.ok ? null : (
        <Issues title="These settings cannot be used" issues={identified.issues} />
      )}

      {refusal === undefined ? null : (
        <Issues title="This run did not happen" issues={refusal} />
      )}

      {finished === undefined ? null : (
        <Report
          declaration={declaration}
          configurationId={finished.configurationId}
          outcome={finished.outcome}
          fixtureBacked={fixtureBacked}
          stale={finished.configurationId !== currentId}
        />
      )}
    </section>
  )
}

/**
 * The four stages of the simulator: overview, configuration, run, report.
 *
 * The flow is view state rather than routes — `design.md`, no router at this
 * size. Loading refuses the way everything else does: issues on screen, naming
 * their cause, never a blank page.
 */

import { useEffect, useMemo, useState } from 'react'
import { Issues } from './components/Issues.js'
import type { ConfigurationEntry } from '../../src/task/artifact.js'
import type { LoadedTask } from './data/load.js'
import { loadConfiguration, loadShippedTasks } from './data/load.js'
import { loadTrainingSplit } from './data/pool.js'
import type { ValidationIssue } from '../../src/task/validate.js'
import type { TaskDeclaration } from '../../src/task/types.js'
import { ConfigureTask } from './screens/ConfigureTask.js'
import { FarmOverview } from './screens/FarmOverview.js'

export interface AppProps {
  /** Injected by tests; the app loads its own tasks otherwise. */
  readonly load?: () => Promise<
    | { ok: true; value: readonly LoadedTask[] }
    | { ok: false; issues: readonly ValidationIssue[] }
  >
  /**
   * Fetches one configuration's predictions for a loaded task.
   *
   * Injected by tests for the same reason `load` is: the shell's job is to route a
   * refusal to the screen, and that is worth testing without a server in the way.
   */
  readonly loadEntry?: (
    task: LoadedTask,
    configurationId: string,
  ) => Promise<
    | { ok: true; value: ConfigurationEntry }
    | { ok: false; issues: readonly ValidationIssue[] }
  >
}

type Loading =
  | { readonly state: 'loading' }
  | { readonly state: 'loaded'; readonly tasks: readonly LoadedTask[] }
  | { readonly state: 'refused'; readonly issues: readonly ValidationIssue[] }

export function App({ load = loadShippedTasks, loadEntry = loadConfiguration }: AppProps) {
  const [loading, setLoading] = useState<Loading>({ state: 'loading' })
  const [selected, setSelected] = useState<string | undefined>(undefined)

  useEffect(() => {
    let live = true
    void load().then((result) => {
      if (!live) return
      setLoading(
        result.ok
          ? { state: 'loaded', tasks: result.value }
          : { state: 'refused', issues: result.issues },
      )
    })
    return () => {
      live = false
    }
  }, [load])

  const open =
    loading.state === 'loaded'
      ? loading.tasks.find((task) => task.declaration.id === selected)
      : undefined

  // Memoised per open task because the browser fetches when this identity changes; a
  // fresh closure on every render would refetch the manifest on every keystroke.
  const loadSplit = useMemo(() => {
    const declaration = open?.declaration
    if (open === undefined || declaration === undefined) return undefined
    return () => loadTrainingSplit(open.paths.pool, declaration)
  }, [open])

  return (
    <main>
      {loading.state === 'loading' ? <p role="status">Opening the farm…</p> : null}

      {loading.state === 'refused' ? (
        <Issues title="The farm could not be opened" issues={loading.issues} />
      ) : null}

      {loading.state === 'loaded' && open === undefined ? (
        <FarmOverview
          tasks={loading.tasks.map((task) => task.declaration)}
          onSelect={(task: TaskDeclaration) => setSelected(task.id)}
        />
      ) : null}

      {open === undefined ? null : (
        <ConfigureTask
          declaration={open.declaration}
          loadEntry={(configurationId) => loadEntry(open, configurationId)}
          truth={open.truth}
          loadSplit={loadSplit}
          onBack={() => setSelected(undefined)}
        />
      )}
    </main>
  )
}

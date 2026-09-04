/**
 * The four stages of the simulator: overview, configuration, run, report.
 *
 * The flow is view state rather than routes — `design.md`, no router at this
 * size. Loading refuses the way everything else does: issues on screen, naming
 * their cause, never a blank page.
 */

import { useEffect, useMemo, useState } from 'react'
import { FarmBar } from './components/FarmBar.js'
import { Issues } from './components/Issues.js'
import type { ConfigurationEntry } from '../../src/task/artifact.js'
import type { Farm, FarmDeclaration } from '../../src/economy/index.js'
import { openFarm } from '../../src/economy/index.js'
import type { LoadedTask } from './data/load.js'
import { loadConfiguration, loadFarmDeclaration, loadShippedTasks } from './data/load.js'
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
  /**
   * Fetches the farm declaration — the currency, the name and the state play opens at.
   *
   * Injected by tests for the same reason `load` is. A farm that will not load is a
   * refusal on screen rather than a farm with a currency the code invented, so the
   * shell has to be able to be handed one that refuses.
   */
  readonly loadFarm?: () => Promise<
    | { ok: true; value: FarmDeclaration }
    | { ok: false; issues: readonly ValidationIssue[] }
  >
  /** Passed through to the task screen; injected by tests to skip the replay. */
  readonly replayMs?: number
}

type Loading =
  | { readonly state: 'loading' }
  | { readonly state: 'loaded'; readonly tasks: readonly LoadedTask[] }
  | { readonly state: 'refused'; readonly issues: readonly ValidationIssue[] }

/**
 * The farm the money, the year and the ledger live in.
 *
 * `design.md` — one `useState` in the only component that renders every stage, rather
 * than a context for a single consumer or a store that `progression-catalog` would have
 * to unpick when it moves this state into a save. The economy value is immutable, so a
 * movement is a `setState` with the value the module returned.
 */
type Farming =
  | { readonly state: 'loading' }
  | { readonly state: 'loaded'; readonly farm: Farm }
  | { readonly state: 'refused'; readonly issues: readonly ValidationIssue[] }

export function App({
  load = loadShippedTasks,
  loadEntry = loadConfiguration,
  loadFarm = loadFarmDeclaration,
  replayMs,
}: AppProps) {
  const [loading, setLoading] = useState<Loading>({ state: 'loading' })
  const [farming, setFarming] = useState<Farming>({ state: 'loading' })
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

  useEffect(() => {
    let live = true
    void loadFarm().then((result) => {
      if (!live) return
      setFarming(
        result.ok
          ? { state: 'loaded', farm: openFarm(result.value) }
          : { state: 'refused', issues: result.issues },
      )
    })
    return () => {
      live = false
    }
  }, [loadFarm])

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

  // Either half refusing is the farm refusing: a farm with no currency and a farm with
  // no tasks are both farms that cannot be opened, and neither gets a bar.
  const refused =
    loading.state === 'refused'
      ? loading.issues
      : farming.state === 'refused'
        ? farming.issues
        : undefined
  const opening = refused === undefined && (loading.state === 'loading' || farming.state === 'loading')

  return (
    <main>
      {opening ? <p role="status">Opening the farm…</p> : null}

      {refused === undefined ? null : (
        <Issues title="The farm could not be opened" issues={refused} />
      )}

      {refused === undefined && farming.state === 'loaded' ? (
        <FarmBar farm={farming.farm} />
      ) : null}

      {refused === undefined && loading.state === 'loaded' && open === undefined ? (
        <FarmOverview
          tasks={loading.tasks.map((task) => task.declaration)}
          onSelect={(task: TaskDeclaration) => setSelected(task.id)}
        />
      ) : null}

      {refused !== undefined || open === undefined ? null : (
        <ConfigureTask
          declaration={open.declaration}
          loadEntry={(configurationId) => loadEntry(open, configurationId)}
          truth={open.truth}
          loadSplit={loadSplit}
          replayMs={replayMs}
          onBack={() => setSelected(undefined)}
        />
      )}
    </main>
  )
}

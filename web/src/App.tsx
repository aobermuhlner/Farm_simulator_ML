/**
 * The stages of the simulator: overview, market, configuration, run, report.
 *
 * The flow is view state rather than routes — `design.md`, no router at this
 * size. Loading refuses the way everything else does: issues on screen, naming
 * their cause, never a blank page.
 *
 * Everything play changes lives in one `useState` here — the farm, the seed, what is
 * owned, and the knob values per task — and one effect writes it to storage after every
 * change. Writing on change rather than on unload is deliberate: `beforeunload` does not
 * fire reliably, and a lost purchase is exactly what must not ship.
 *
 * The catalog is loaded after the tasks because it is checked against them: an item
 * naming a knob no task declares refuses the farm rather than quietly locking nothing.
 */

import { useEffect, useMemo, useState } from 'react'
import { FarmBar } from './components/FarmBar.js'
import { Issues } from './components/Issues.js'
import type { ConfigurationEntry } from '../../src/task/artifact.js'
import type { FarmDeclaration } from '../../src/economy/index.js'
import { formatUnits } from '../../src/economy/index.js'
import type { Catalog } from '../../src/progression/index.js'
import {
  buyItem,
  computeAvailability,
  marketView,
  taskAvailability,
} from '../../src/progression/index.js'
import type { GameState } from '../../src/save/index.js'
import { knobValuesFor, newGame, parseSave, serializeSave } from '../../src/save/index.js'
import type { LoadedTask } from './data/load.js'
import { loadCatalog, loadConfiguration, loadFarmDeclaration, loadShippedTasks } from './data/load.js'
import { loadTrainingSplit } from './data/pool.js'
import { clearStoredSave, readStoredSave, writeStoredSave } from './data/save.js'
import type { ValidationIssue } from '../../src/task/validate.js'
import type { TaskDeclaration } from '../../src/task/types.js'
import type { KnobValues } from './model/run.js'
import { ConfigureTask } from './screens/ConfigureTask.js'
import { FarmOverview } from './screens/FarmOverview.js'
import { Market } from './screens/Market.js'

type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

export interface AppProps {
  /** Injected by tests; the app loads its own tasks otherwise. */
  readonly load?: () => Promise<Loaded<readonly LoadedTask[]>>
  /**
   * Fetches one configuration's predictions for a loaded task.
   *
   * Injected by tests for the same reason `load` is: the shell's job is to route a
   * refusal to the screen, and that is worth testing without a server in the way.
   */
  readonly loadEntry?: (task: LoadedTask, configurationId: string) => Promise<Loaded<ConfigurationEntry>>
  /**
   * Fetches the farm declaration — the currency, the name and the state play opens at.
   *
   * Injected by tests for the same reason `load` is. A farm that will not load is a
   * refusal on screen rather than a farm with a currency the code invented, so the
   * shell has to be able to be handed one that refuses.
   */
  readonly loadFarm?: () => Promise<Loaded<FarmDeclaration>>
  /** Fetches the catalog, checked against the farm and the tasks that were loaded. */
  readonly loadShop?: (
    farm: FarmDeclaration,
    tasks: readonly LoadedTask[],
  ) => Promise<Loaded<Catalog>>
  /** Passed through to the task screen; injected by tests to skip the replay. */
  readonly replayMs?: number
  /** The browser edge of the save. Injected by tests, which have no browser to speak of. */
  readonly readSave?: () => ReturnType<typeof readStoredSave>
  readonly writeSave?: (text: string) => ReturnType<typeof writeStoredSave>
  readonly clearSave?: () => ReturnType<typeof clearStoredSave>
  /** Where a new farm's seed comes from. Injected by tests, which need it to be dull. */
  readonly drawSeed?: () => number
}

/** Everything the farm needs before it can be played, loaded and checked against itself. */
interface OpenedFarm {
  readonly tasks: readonly LoadedTask[]
  readonly declaration: FarmDeclaration
  readonly catalog: Catalog
}

type Opening =
  | { readonly state: 'loading' }
  | { readonly state: 'loaded'; readonly opened: OpenedFarm }
  | { readonly state: 'refused'; readonly issues: readonly ValidationIssue[] }

export function App({
  load = loadShippedTasks,
  loadEntry = loadConfiguration,
  loadFarm = loadFarmDeclaration,
  loadShop = loadCatalog,
  replayMs,
  readSave = readStoredSave,
  writeSave = writeStoredSave,
  clearSave = clearStoredSave,
  drawSeed,
}: AppProps) {
  const [opening, setOpening] = useState<Opening>({ state: 'loading' })
  const [game, setGame] = useState<GameState | undefined>(undefined)
  const [notices, setNotices] = useState<readonly ValidationIssue[]>([])
  const [refusal, setRefusal] = useState<readonly ValidationIssue[] | undefined>(undefined)
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [inMarket, setInMarket] = useState(false)

  useEffect(() => {
    let live = true

    void (async () => {
      const tasks = await load()
      if (!live) return
      if (!tasks.ok) {
        setOpening({ state: 'refused', issues: tasks.issues })
        return
      }

      const farm = await loadFarm()
      if (!live) return
      if (!farm.ok) {
        setOpening({ state: 'refused', issues: farm.issues })
        return
      }

      const catalog = await loadShop(farm.value, tasks.value)
      if (!live) return
      if (!catalog.ok) {
        setOpening({ state: 'refused', issues: catalog.issues })
        return
      }

      const declarations = tasks.value.map((task) => task.declaration)
      const fresh = () => newGame(farm.value, catalog.value, drawSeed)
      const found: ValidationIssue[] = []

      // The seed is drawn only where a new farm is actually opened. Drawing one and
      // throwing it away on every restore would be harmless today and wrong the moment
      // anything counts draws — and "reopening does not redraw" is the specified rule.
      const stored = readSave()
      let restored: GameState | undefined
      if (!stored.ok) {
        found.push(stored.issue)
      } else if (stored.text !== undefined) {
        const outcome = parseSave(stored.text, {
          declaration: farm.value,
          catalog: catalog.value,
          tasks: declarations,
        })
        if (outcome.kind === 'reset') found.push(outcome.cause)
        else {
          restored = outcome.state
          found.push(...outcome.dropped)
        }
      }
      const state = restored ?? fresh()

      setOpening({
        state: 'loaded',
        opened: { tasks: tasks.value, declaration: farm.value, catalog: catalog.value },
      })
      setGame(state)
      setNotices(found)
    })()

    return () => {
      live = false
    }
  }, [load, loadFarm, loadShop, readSave, drawSeed])

  // Written after every change to the year, the balance, the movements, the ledger, what
  // is owned or the knob values — the whole of what a save holds is this one value, so
  // one dependency covers all of them. A failed write is disclosed and the change stands.
  useEffect(() => {
    if (game === undefined) return
    const written = writeSave(serializeSave(game))
    if (written.ok) return
    setNotices((current) =>
      current.some((issue) => issue.code === written.issue.code)
        ? current
        : [...current, written.issue],
    )
  }, [game, writeSave])

  const opened = opening.state === 'loaded' ? opening.opened : undefined
  const open =
    opened === undefined ? undefined : opened.tasks.find((task) => task.declaration.id === selected)

  const availability = useMemo(() => {
    if (opened === undefined || game === undefined) return undefined
    return computeAvailability(
      opened.catalog,
      opened.tasks.map((task) => task.declaration),
      game.owned,
    )
  }, [opened, game])

  // Memoised per open task because the browser fetches when this identity changes; a
  // fresh closure on every render would refetch the manifest on every keystroke.
  const loadSplit = useMemo(() => {
    const declaration = open?.declaration
    if (open === undefined || declaration === undefined) return undefined
    return () => loadTrainingSplit(open.paths.pool, declaration)
  }, [open])

  function formatPrice(units: number): string {
    return opened === undefined ? String(units) : formatUnits(units, opened.declaration)
  }

  function buy(itemId: string): void {
    if (opened === undefined || game === undefined) return
    const bought = buyItem(opened.catalog, game.farm, game.owned, itemId)
    if (!bought.ok) {
      setRefusal(bought.issues)
      return
    }
    setRefusal(undefined)
    setGame({ ...game, farm: bought.farm, owned: bought.owned })
  }

  function startNewFarm(): void {
    if (opened === undefined) return
    clearSave()
    setSelected(undefined)
    setInMarket(false)
    setRefusal(undefined)
    // What could not be stored stays true of the new farm; what an old save said does not.
    setNotices((current) => current.filter((issue) => issue.code === 'storage-unavailable'))
    setGame(newGame(opened.declaration, opened.catalog, drawSeed))
  }

  function rememberKnobs(taskId: string, values: KnobValues): void {
    setGame((current) =>
      current === undefined ? current : { ...current, knobs: { ...current.knobs, [taskId]: values } },
    )
  }

  const refusedIssues = opening.state === 'refused' ? opening.issues : undefined
  const loading = refusedIssues === undefined && (opening.state === 'loading' || game === undefined)

  return (
    <main>
      {loading ? <p role="status">Opening the farm…</p> : null}

      {refusedIssues === undefined ? null : (
        <Issues title="The farm could not be opened" issues={refusedIssues} />
      )}

      {notices.length === 0 ? null : <Issues title="About your saved progress" issues={notices} />}

      {game === undefined || opened === undefined ? null : <FarmBar farm={game.farm} />}

      {opened === undefined || game === undefined || open !== undefined || inMarket ? null : (
        <FarmOverview
          tasks={opened.tasks.map((task) => task.declaration)}
          onSelect={(task: TaskDeclaration) => setSelected(task.id)}
          onMarket={() => {
            setRefusal(undefined)
            setInMarket(true)
          }}
          onNewFarm={startNewFarm}
        />
      )}

      {opened === undefined || game === undefined || !inMarket ? null : (
        <Market
          view={marketView(opened.catalog, game.owned, game.farm.balance)}
          formatPrice={formatPrice}
          onBuy={buy}
          onBack={() => {
            setRefusal(undefined)
            setInMarket(false)
          }}
          refusal={refusal}
        />
      )}

      {open === undefined || game === undefined ? null : (
        <ConfigureTask
          declaration={open.declaration}
          loadEntry={(configurationId) => loadEntry(open, configurationId)}
          truth={open.truth}
          loadSplit={loadSplit}
          replayMs={replayMs}
          availability={
            availability === undefined ? undefined : taskAvailability(availability, open.declaration.id)
          }
          formatPrice={formatPrice}
          initialValues={knobValuesFor(game, open.declaration)}
          onValuesChange={(values) => rememberKnobs(open.declaration.id, values)}
          onBack={() => setSelected(undefined)}
        />
      )}
    </main>
  )
}

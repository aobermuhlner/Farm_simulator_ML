/**
 * The stages of the simulator: overview, market, workshop, labour and report.
 *
 * The year loop lives here. Running the year is one act belonging to the whole farm: each
 * playable card is brought in by whatever its labour slot holds, what each brings in is
 * held outside the money until the last of them is in, and only then is the harvest
 * recorded — one settlement, one ledger record, one year advanced.
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
import type { Farm, FarmDeclaration, YearInProgress } from '../../src/economy/index.js'
import {
  bringIn,
  broughtIn,
  closeYear,
  formatUnits,
  isComplete,
  openYear,
  outstanding,
  toUnits,
} from '../../src/economy/index.js'
import type { Catalog } from '../../src/progression/index.js'
import {
  buyItem,
  computeAvailability,
  itemById,
  marketView,
  taskAvailability,
} from '../../src/progression/index.js'
import { handBack, labourFor, playableTasks, putToWork } from '../../src/labour/index.js'
import type { SortOutcome } from '../../src/sorting/index.js'
import type { GameState } from '../../src/save/index.js'
import { knobValuesFor, newGame, parseSave, serializeSave } from '../../src/save/index.js'
import type { LoadedTask } from './data/load.js'
import { loadCatalog, loadConfiguration, loadFarmDeclaration, loadShippedTasks } from './data/load.js'
import { loadCrop, loadTrainingSplit } from './data/pool.js'
import { clearStoredSave, readStoredSave, writeStoredSave } from './data/save.js'
import type { ValidationIssue } from '../../src/task/validate.js'
import type { TaskDeclaration } from '../../src/task/types.js'
import type { KnobValues } from './model/run.js'
import { runFielded } from './model/run.js'
import { ConfigureTask } from './screens/ConfigureTask.js'
import type { LabourSlotView, OutstandingTask, TaskRefusal } from './screens/FarmOverview.js'
import { FarmOverview } from './screens/FarmOverview.js'
import { HandSort } from './screens/HandSort.js'
import { Market } from './screens/Market.js'
import { Report } from './screens/Report.js'

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
  /**
   * The clock the sorting stage times a student by.
   *
   * Injected for the same reason the seed is: a suite that measured the milliseconds
   * between two simulated clicks would report a rate no hand could reach, and the rate is
   * one of the figures the numbers pass is set against.
   */
  readonly now?: () => number
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
  now,
}: AppProps) {
  const [opening, setOpening] = useState<Opening>({ state: 'loading' })
  const [game, setGame] = useState<GameState | undefined>(undefined)
  const [notices, setNotices] = useState<readonly ValidationIssue[]>([])
  const [refusal, setRefusal] = useState<readonly ValidationIssue[] | undefined>(undefined)
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [inMarket, setInMarket] = useState(false)
  // The stage remembers the farm it was entered with, not the farm as it stands: bringing
  // the crop in advances the year, and the summary that follows is about the year that
  // closed. Reading the current year here would redraw the crop under the summary.
  const [sorting, setSorting] = useState<{ readonly task: LoadedTask; readonly farm: Farm } | undefined>(
    undefined,
  )
  const [settled, setSettled] = useState<Readonly<Record<number, SortOutcome>>>({})
  /** The card whose closed-year report is open, by task id. */
  const [reporting, setReporting] = useState<string | undefined>(undefined)
  /**
   * Why a card could not be brought in, per card that could not. Never substitutes labour.
   *
   * Kept per card rather than as one list of causes so the remedy can be per card too: the
   * overview offers the job of *this* refused card back, and a flat list could not say
   * which card a control belonged to.
   */
  const [harvestRefusals, setHarvestRefusals] = useState<readonly TaskRefusal[]>([])

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

  // The loader is memoised on the stage rather than on the farm, so settling the year —
  // which advances it — does not send the screen off to fetch a different crop while its
  // summary is on the page.
  const loadThisCrop = useMemo(() => {
    if (sorting === undefined || game === undefined) return undefined
    const { task, farm } = sorting
    const seed = game.seed
    return () => loadCrop(task.paths.pool, task.declaration, farm, seed)
  }, [sorting, game?.seed])

  function formatPrice(units: number): string {
    return opened === undefined ? String(units) : formatUnits(units, opened.declaration)
  }

  /** An amount as the declarations write it, presented in the farm's own currency. */
  function formatAmount(amount: number): string {
    if (opened === undefined) return String(amount)
    return formatUnits(toUnits(amount, opened.declaration.precision), opened.declaration)
  }

  /**
   * What the farm has bought that does this job, and whether it owns it.
   *
   * Both come from the declarations: the farm names the item, the catalog prices it. A
   * farm that names nothing has no automation and no price to show.
   *
   * Owning it decides nothing about who works: that is the labour slot's answer, and
   * reading it from ownership was the defect this change names.
   */
  const automates = opened?.declaration.automation?.item
  const automation = useMemo(() => {
    if (opened === undefined || automates === undefined) return undefined
    const item = itemById(opened.catalog, automates)
    if (item === undefined || item.priceUnits === undefined) return undefined
    return { label: item.label, price: formatUnits(item.priceUnits, opened.declaration) }
  }, [opened, automates])

  /** Every card this farm can play, in declared order. */
  const playable = useMemo(
    () =>
      opened === undefined
        ? []
        : playableTasks(
            opened.tasks.map((task) => task.declaration),
            availability,
          ),
    [opened, availability],
  )

  /**
   * Records what a year in progress has come to, closing it once the last card is in.
   *
   * Closing is the only step that reaches the economy's harvest, and it reaches it once —
   * with the total across every card. Until then nothing has been credited, which is what
   * makes a year abandoned half way cost nothing and pay nothing.
   */
  function commit(state: GameState, year: YearInProgress): GameState {
    if (!isComplete(year, playable.map((task) => task.id))) {
      return { ...state, pending: year }
    }
    const { farm, closed } = closeYear(state.farm, year)
    return { ...state, farm, pending: undefined, lastYear: closed }
  }

  /**
   * The year's crop is in for the card being worked by hand: what it paid is held against
   * the year in progress, and the outcome is kept so re-entering shows it rather than
   * drawing a fresh crop to be paid for a second time.
   */
  function settle(outcome: SortOutcome): void {
    if (game === undefined || sorting === undefined) return
    const closing = game.farm.year
    const precision = game.farm.declaration.precision
    setSettled((current) => ({ ...current, [closing]: outcome }))
    setGame(
      commit(
        game,
        bringIn(game.pending ?? openYear(game.farm), {
          taskId: sorting.task.declaration.id,
          paidUnits: toUnits(outcome.wage, precision),
          evaluated: outcome.decided,
          counts: outcome.counts,
        }),
      ),
    )
  }

  /**
   * Runs the year for the whole farm: every card at work by a model, without the student.
   *
   * A card whose configuration will not fetch or resolve is refused with the cause the
   * engine named. The year stays open and no other labour is put in its place — a robot
   * that cannot work is not a person who is not there.
   */
  async function runYear(): Promise<void> {
    if (opened === undefined || game === undefined) return

    let year = game.pending ?? openYear(game.farm)
    const precision = game.farm.declaration.precision
    const refused: TaskRefusal[] = []

    for (const declaration of playable) {
      if (broughtIn(year, declaration.id) !== undefined) continue

      const labour = labourFor(game.slots, declaration.id)
      if (labour.kind !== 'model') continue

      const loaded = opened.tasks.find((task) => task.declaration.id === declaration.id)
      if (loaded === undefined) continue

      const fetched = await loadEntry(loaded, labour.model.configurationId)
      if (!fetched.ok) {
        refused.push({ task: declaration, issues: fetched.issues })
        continue
      }

      const scored = runFielded(
        declaration,
        labour.model.configurationId,
        fetched.value,
        loaded.truth,
      )
      if (!scored.ok) {
        refused.push({ task: declaration, issues: scored.issues })
        continue
      }

      year = bringIn(year, {
        taskId: declaration.id,
        configurationId: labour.model.configurationId,
        paidUnits: toUnits(scored.outcome.earnings, precision),
        evaluated: scored.outcome.evaluated,
        counts: scored.outcome.counts,
      })
    }

    setHarvestRefusals(refused)
    setGame((current) => (current === undefined ? current : commit(current, year)))
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

  /**
   * The playable cards still to be brought in, each saying whose labour it waits on.
   *
   * A card at work by a model that could not be brought in stays outstanding and is not
   * offered by hand: the refusal names its cause and no other labour is substituted.
   */
  function outstandingTasks(year: YearInProgress): readonly OutstandingTask[] {
    const ids = outstanding(
      year,
      playable.map((task) => task.id),
    )
    return playable
      .filter((task) => ids.includes(task.id))
      .map((task) => ({ task, manual: labourFor(game?.slots, task.id).kind === 'manual' }))
  }

  /** The cards the most recently closed year holds a report for. */
  const reportable = useMemo(() => {
    const closed = game?.lastYear
    if (closed === undefined) return []
    return playable.filter((task) => broughtIn(closed, task.id) !== undefined)
  }, [game?.lastYear, playable])

  /** The report the student has open: the card, the year, and what that card did. */
  const reported = useMemo(() => {
    const closed = game?.lastYear
    if (opened === undefined || closed === undefined || reporting === undefined) return undefined
    const loaded = opened.tasks.find((task) => task.declaration.id === reporting)
    const crop = broughtIn(closed, reporting)
    if (loaded === undefined || crop === undefined) return undefined
    return { declaration: loaded.declaration, year: closed.year, crop }
  }, [opened, game?.lastYear, reporting])

  /**
   * What the farm's own labour is called, as the declaration presents it.
   *
   * The fallback is generic on purpose: it names no farm's vocabulary, and a slot must
   * state what fills it rather than be shown as empty when nothing is declared.
   */
  const manualLabel = opened?.declaration.manualLabour?.label ?? 'Your own labour'

  /** What fills one card's slot. Undefined for a card that is announced, not played. */
  function slotFor(task: TaskDeclaration): LabourSlotView | undefined {
    if (game === undefined) return undefined
    if (!playable.some((candidate) => candidate.id === task.id)) return undefined

    const labour = labourFor(game.slots, task.id)
    // A model's icon and label come from what declares it, which nothing does yet; until
    // then the configuration it was trained as is what there is to state, and that is
    // declared data rather than a word this file made up.
    if (labour.kind === 'model') return { label: labour.model.configurationId }
    const icon = opened?.declaration.manualLabour?.icon
    return icon === undefined ? { label: manualLabel } : { icon, label: manualLabel }
  }

  /** The configuration at work for one task, or undefined when its hands are. */
  function atWorkFor(taskId: string): string | undefined {
    if (game === undefined) return undefined
    const labour = labourFor(game.slots, taskId)
    return labour.kind === 'model' ? labour.model.configurationId : undefined
  }

  function startNewFarm(): void {
    if (opened === undefined) return
    clearSave()
    setSelected(undefined)
    setInMarket(false)
    setSorting(undefined)
    setSettled({})
    setRefusal(undefined)
    setReporting(undefined)
    setHarvestRefusals([])
    // What could not be stored stays true of the new farm; what an old save said does not.
    setNotices((current) => current.filter((issue) => issue.code === 'storage-unavailable'))
    setGame(newGame(opened.declaration, opened.catalog, drawSeed))
  }

  /**
   * Puts a configuration to work for one task, and hands the job back again.
   *
   * Both are free and both are reversible: they write the labour slot and nothing else,
   * so neither can touch the balance, the ledger or the year. That is the workshop's
   * guarantee, made structural rather than remembered.
   */
  function setAtWork(taskId: string, configurationId: string): void {
    setGame((current) =>
      current === undefined
        ? current
        : { ...current, slots: putToWork(current.slots, taskId, { configurationId }) },
    )
  }

  function clearAtWork(taskId: string): void {
    setGame((current) =>
      current === undefined ? current : { ...current, slots: handBack(current.slots, taskId) },
    )
    // The card is no longer at work by the model the refusal was about, so the cause has
    // stopped being true. Dropped wherever the job is handed back from, because a refusal
    // left standing beside a card the hands now work states something false.
    setHarvestRefusals((current) => current.filter((refused) => refused.task.id !== taskId))
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

      {opened === undefined ||
      game === undefined ||
      open !== undefined ||
      inMarket ||
      reporting !== undefined ||
      sorting !== undefined ? null : (
        <FarmOverview
          tasks={opened.tasks.map((task) => task.declaration)}
          onSelect={(task: TaskDeclaration) => setSelected(task.id)}
          onMarket={() => {
            setRefusal(undefined)
            setInMarket(true)
          }}
          slotFor={slotFor}
          year={game.pending?.year ?? game.farm.year}
          onRunYear={() => {
            setHarvestRefusals([])
            void runYear()
          }}
          outstanding={
            game.pending === undefined
              ? undefined
              : outstandingTasks(game.pending)
          }
          onBringIn={(task: TaskDeclaration) => {
            // The labour a card's slot calls for. Reached only while its year is open,
            // which is what stops a closed year being sorted again for pay.
            const loaded = opened.tasks.find((candidate) => candidate.declaration.id === task.id)
            if (loaded === undefined) return
            setRefusal(undefined)
            setSorting({ task: loaded, farm: game.farm })
          }}
          onReport={
            game.lastYear === undefined ? undefined : (task: TaskDeclaration) => setReporting(task.id)
          }
          reportable={reportable}
          reportYear={game.lastYear?.year}
          refusal={harvestRefusals}
          onHandBack={(task: TaskDeclaration) => clearAtWork(task.id)}
          onNewFarm={startNewFarm}
        />
      )}

      {reported === undefined || opened === undefined || game === undefined ? null : (
        <section aria-labelledby="report-stage-heading">
          <button type="button" onClick={() => setReporting(undefined)}>
            Back to the farm
          </button>
          <h1 id="report-stage-heading">{reported.declaration.title}</h1>
          <Report
            declaration={reported.declaration}
            year={reported.year}
            configurationId={reported.crop.configurationId}
            labour={manualLabel}
            evaluated={reported.crop.evaluated}
            earnings={formatUnits(reported.crop.paidUnits, opened.declaration)}
            counts={reported.crop.counts}
          />
        </section>
      )}

      {sorting === undefined || loadThisCrop === undefined ? null : (
        <HandSort
          declaration={sorting.task.declaration}
          load={loadThisCrop}
          outcome={settled[sorting.farm.year]}
          onSettle={settle}
          formatAmount={formatAmount}
          automation={automation}
          onBack={() => setSorting(undefined)}
          now={now}
        />
      )}

      {opened === undefined || game === undefined || !inMarket || sorting !== undefined ? null : (
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
          loadSplit={loadSplit}
          replayMs={replayMs}
          availability={
            availability === undefined ? undefined : taskAvailability(availability, open.declaration.id)
          }
          formatPrice={formatPrice}
          initialValues={knobValuesFor(game, open.declaration)}
          onValuesChange={(values) => rememberKnobs(open.declaration.id, values)}
          atWork={atWorkFor(open.declaration.id)}
          onPutToWork={(configurationId) => setAtWork(open.declaration.id, configurationId)}
          onHandBack={
            atWorkFor(open.declaration.id) === undefined
              ? undefined
              : () => clearAtWork(open.declaration.id)
          }
          onBack={() => setSelected(undefined)}
        />
      )}
    </main>
  )
}

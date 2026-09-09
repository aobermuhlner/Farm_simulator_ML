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
import type { FamilyEntry } from '../../src/families/index.js'
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
  maxLand,
  taskAvailability,
} from '../../src/progression/index.js'
import { handBack, labourFor, playableTasks, putToWork } from '../../src/labour/index.js'
import { earningsByCategory, recordHarvestFigures, valueDelivery } from '../../src/scoring/index.js'
import type { SortOutcome } from '../../src/sorting/index.js'
import { drawCrop } from '../../src/sorting/index.js'
import type { GameState } from '../../src/save/index.js'
import {
  knobValuesFor,
  newGame,
  parseSave,
  selectedFamilyFor,
  serializeSave,
} from '../../src/save/index.js'
import type { LoadedTask } from './data/load.js'
import type { CropView } from './data/pool.js'
import { loadCatalog, loadConfiguration, loadFarmDeclaration, loadShippedTasks } from './data/load.js'
import { loadCrop, loadTrainingSplit } from './data/pool.js'
import { clearStoredSave, readStoredSave, writeStoredSave } from './data/save.js'
import type { ValidationIssue } from '../../src/task/validate.js'
import { familyById, selectedFamily } from '../../src/task/families.js'
import type { TutorialKinds } from '../../src/tutorials/index.js'
import type { TutorialBodies } from './components/tutorial/TutorialBody.js'
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
  readonly loadEntry?: (
    task: LoadedTask,
    familyId: string,
    configurationId: string,
  ) => Promise<Loaded<FamilyEntry>>
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
  /**
   * The tutorial kinds this build recognises, and the bodies that pose them.
   *
   * Injected for the same reason the loaders are: the shipped registries are empty until
   * a body change fills them, so the only way to exercise the gate end to end is to be
   * handed a kind. Passing them separately keeps a test-only puzzle out of the build a
   * student loads.
   */
  readonly tutorialKinds?: TutorialKinds
  readonly tutorialBodies?: TutorialBodies
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
  tutorialKinds,
  tutorialBodies,
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

  /**
   * The orchard, as the persistent bar's first supplied summary fact.
   *
   * Every word of it is declared — the orchard's own name and the name of a unit of its
   * land — so a farm measured in hectares of vines renders through this unchanged and
   * the screen names no unit of its own.
   *
   * The maximum comes from the catalog rather than the farm, because the largest orchard
   * reachable is whatever is still for sale towards it. A catalog that sells no land
   * gives no maximum, and the land held is then shown alone rather than against a limit
   * invented for it — "100 / 100 trees" would state a ceiling nothing declared.
   */
  const orchardFact = useMemo(() => {
    if (opened === undefined || game === undefined) return undefined
    const { label, unit, opening } = opened.declaration.orchard
    const reach = maxLand(opened.catalog, opened.declaration)
    return {
      label,
      value: reach > opening ? `${game.farm.land} / ${reach} ${unit}` : `${game.farm.land} ${unit}`,
    }
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
  function settle(outcome: SortOutcome, crop: CropView): void {
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
          // The same record the automated path writes, from the same function: the report
          // of a closed year must not be able to tell which labour brought the crop in.
          harvest: recordHarvestFigures(crop, outcome.delivery, precision),
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

      const fetched = await loadEntry(loaded, labour.model.family, labour.model.configurationId)
      if (!fetched.ok) {
        refused.push({ task: declaration, issues: fetched.issues })
        continue
      }

      // The farm's crop for this year, drawn from what the task already holds: the pool
      // manifest was read when the task loaded, and drawing needs its image ids and their
      // true categories and nothing else. Same draw, same seed and same year as the one a
      // pair of hands would be given, so the two labours bring in the same apples.
      const crop = drawCrop(
        declaration,
        game.farm,
        { imageIds: loaded.imageIds.pool ?? [], truth: loaded.truth },
        game.seed,
      )
      if (!crop.ok) {
        refused.push({ task: declaration, issues: crop.issues })
        continue
      }

      const scored = runFielded(
        declaration,
        labour.model.configurationId,
        fetched.value,
        crop.crop.pieces,
      )
      if (!scored.ok) {
        refused.push({ task: declaration, issues: scored.issues })
        continue
      }

      const value = valueDelivery(declaration, scored.outcome)

      year = bringIn(year, {
        taskId: declaration.id,
        configurationId: labour.model.configurationId,
        family: labour.model.family,
        paidUnits: toUnits(value.paid, precision),
        evaluated: scored.outcome.evaluated,
        counts: scored.outcome.counts,
        harvest: recordHarvestFigures(crop.crop, value, precision),
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

    // Every figure below is the engine's: the rows come from the payoff table over the
    // counts the year recorded, and the two amounts either side of the deduction come off
    // the harvest record rather than being recomputed from a farm that has since moved on.
    const declaration = loaded.declaration
    const precision = opened.declaration.precision
    const rows = earningsByCategory(declaration, crop.counts)
    const rowEarnings = Object.fromEntries(
      Object.entries(rows).map(([category, amount]) => [
        category,
        formatUnits(toUnits(amount, precision), opened.declaration),
      ]),
    )
    const harvest = crop.harvest
    const money =
      declaration.delivery === undefined || harvest === undefined
        ? undefined
        : {
            gross: formatUnits(harvest.grossUnits, opened.declaration),
            downgrade: formatUnits(harvest.downgradeUnits, opened.declaration),
          }

    // The family the crop was brought in by, as that family's declaration labels it —
    // the year's own record, not what the workshop happens to have selected now.
    const family =
      crop.family === undefined ? undefined : selectedFamily(declaration, crop.family).label

    return { declaration, year: closed.year, crop, rowEarnings, money, family }
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
    // A model's icon and short label are the family's own declaration, so a farm working
    // an orchard by tree and a screen by network reads at a glance without this file
    // learning either word.
    if (labour.kind === 'model') {
      const { slot } = selectedFamily(task, labour.model.family)
      return { icon: slot.icon, label: slot.label }
    }
    const icon = opened?.declaration.manualLabour?.icon
    return icon === undefined ? { label: manualLabel } : { icon, label: manualLabel }
  }

  /** The model at work for one task, or undefined when its hands are. */
  function atWorkFor(taskId: string): { family: string; configurationId: string } | undefined {
    if (game === undefined) return undefined
    const labour = labourFor(game.slots, taskId)
    return labour.kind === 'model' ? { ...labour.model } : undefined
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
  function setAtWork(taskId: string, family: string, configurationId: string): void {
    setGame((current) => {
      if (current === undefined) return current
      const declared = open?.declaration.id === taskId ? open.declaration : undefined
      const fielded = putToWork(
        current.slots,
        taskId,
        { configurationId, family },
        {
          tutorial: declared === undefined ? undefined : familyById(declared, family)?.tutorial,
          completed: current.tutorials,
        },
      )
      // Withheld leaves the farm exactly as it was. The workshop does not offer the
      // control while a tutorial is outstanding, so reaching here means something went
      // round it — and the right answer to that is to change nothing.
      return fielded.ok ? { ...current, slots: fielded.slots } : current
    })
  }

  /**
   * Records a tutorial passed. Free, and it happens at most once.
   *
   * Completion and nothing else — no score, no attempt count, no timing. Passing one
   * already passed writes nothing, which is what keeps "it does not come undone" and
   * "nothing but completion is recorded" the same sentence.
   */
  function completeTutorial(tutorialId: string): void {
    setGame((current) =>
      current === undefined || current.tutorials.includes(tutorialId)
        ? current
        : { ...current, tutorials: [...current.tutorials, tutorialId] },
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

  /**
   * Keeps one family's knob values, leaving every other family's exactly as they were.
   *
   * Nested rather than flat, because tuning the network must not lose the tree's budget —
   * and because a knob id is unique only within a family, so one map per task would let
   * two families' values collide under one name.
   */
  function rememberKnobs(taskId: string, familyId: string, values: KnobValues): void {
    setGame((current) =>
      current === undefined
        ? current
        : {
            ...current,
            knobs: {
              ...current.knobs,
              [taskId]: { ...(current.knobs[taskId] ?? {}), [familyId]: values },
            },
          },
    )
  }

  /** Keeps which family a task is showing. Free, and it puts nothing to work. */
  function rememberFamily(taskId: string, familyId: string): void {
    setGame((current) =>
      current === undefined
        ? current
        : { ...current, families: { ...current.families, [taskId]: familyId } },
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

      {game === undefined || opened === undefined ? null : (
        <FarmBar farm={game.farm} facts={orchardFact === undefined ? [] : [orchardFact]} />
      )}

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
            family={reported.family}
            labour={manualLabel}
            evaluated={reported.crop.evaluated}
            earnings={formatUnits(reported.crop.paidUnits, opened.declaration)}
            counts={reported.crop.counts}
            rowEarnings={reported.rowEarnings}
            money={reported.money}
            harvest={reported.crop.harvest}
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
          loadEntry={(familyId, configurationId) => loadEntry(open, familyId, configurationId)}
          loadSplit={loadSplit}
          replayMs={replayMs}
          availability={
            availability === undefined ? undefined : taskAvailability(availability, open.declaration.id)
          }
          formatPrice={formatPrice}
          initialFamily={selectedFamilyFor(game, open.declaration).id}
          onFamilyChange={(familyId) => rememberFamily(open.declaration.id, familyId)}
          initialValues={(familyId) =>
            knobValuesFor(game, open.declaration, selectedFamily(open.declaration, familyId))
          }
          onValuesChange={(familyId, values) =>
            rememberKnobs(open.declaration.id, familyId, values)
          }
          atWork={atWorkFor(open.declaration.id)}
          onPutToWork={(familyId, configurationId) =>
            setAtWork(open.declaration.id, familyId, configurationId)
          }
          onHandBack={
            atWorkFor(open.declaration.id) === undefined
              ? undefined
              : () => clearAtWork(open.declaration.id)
          }
          completedTutorials={game.tutorials}
          onTutorialComplete={completeTutorial}
          tutorialKinds={tutorialKinds}
          tutorialBodies={tutorialBodies}
          onBack={() => setSelected(undefined)}
        />
      )}
    </main>
  )
}

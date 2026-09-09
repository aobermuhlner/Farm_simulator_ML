/**
 * The farm's economy: the declared currency, the balance, the year and the ledger.
 *
 * Pure arithmetic over declared data. Nothing here knows what a task, a tree or a
 * cultivar is, and nothing here reaches a screen except through a value it returns.
 */

export type {
  CropComposition,
  FarmAutomation,
  FarmDeclaration,
  FarmValidation,
  ManualLabourDeclaration,
  OrchardDeclaration,
  ShareRange,
  YearVariation,
} from './declaration.js'
export {
  OPTIONAL_FARM_FIELDS,
  REQUIRED_FARM_FIELDS,
  validateFarmDeclaration,
} from './declaration.js'
export { formatUnits, toAmount, toUnits } from './amounts.js'
export type { Farm, FarmChange, Movement, YearRecord } from './farm.js'
export {
  credit,
  cropSize,
  debit,
  INSUFFICIENT_FUNDS,
  movementsThisYear,
  openFarm,
  recordHarvest,
} from './farm.js'
export type { ClosedYear, CropBroughtIn, HarvestFigures, YearInProgress } from './year.js'
export {
  bringIn,
  broughtIn,
  closeYear,
  isComplete,
  openYear,
  outstanding,
  totalPaid,
} from './year.js'

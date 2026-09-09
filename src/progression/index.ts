/**
 * Progression: the declared catalog, what a farm owns, and what that opens.
 *
 * Pure data and pure functions. Nothing here knows what a screen is, and nothing here
 * touches storage — a purchase returns a new farm and a new owned list, and the React
 * side is a `setState` with what came back.
 */

export type {
  Catalog,
  CatalogItem,
  CatalogValidation,
  FarmLandUnlock,
  GroupDeclaration,
  KnobValuesUnlock,
  Unlock,
} from './catalog.js'
export {
  itemById,
  maxLand,
  repeatLimit,
  REQUIRED_CATALOG_FIELDS,
  REQUIRED_ITEM_FIELDS,
  UNLOCK_KINDS,
  validateCatalog,
} from './catalog.js'

export type { FamilyCoverage } from './check.js'
export { checkCatalogAgainstTasks, checkCatalogCoverage } from './check.js'

export type {
  Fieldability,
  FamilyFieldability,
  TaskFieldability,
} from './fieldable.js'
export {
  computeFieldability,
  familyFieldability,
  taskFieldability,
  withheldBy,
} from './fieldable.js'

export { declaredValues } from './knobValues.js'

export type {
  Availability,
  FamilyAvailability,
  KnobAvailability,
  TaskAvailability,
  ValueAvailability,
} from './availability.js'
export {
  computeAvailability,
  familyAvailability,
  knobAvailability,
  lockedValue,
  taskAvailability,
} from './availability.js'

export type { Purchase } from './purchase.js'
export { ALREADY_OWNED, buyItem, countOwned, NOT_FOR_SALE, UNKNOWN_ITEM } from './purchase.js'

export type { SelectableConfiguration } from './locked.js'
export { LOCKED_CONFIGURATION, lockedIssues, resolveSelectable } from './locked.js'

export type { MarketGroup, MarketItem, MarketItemState, MarketView } from './market.js'
export { marketView } from './market.js'

/**
 * The task's model families, and which one the workshop is showing.
 *
 * Rendered from the declared families and the availability it is supplied, and from
 * nothing else — there is no lookup by family id here for the same reason `KnobControl`
 * has none by knob id: a mapping keyed by id is exactly the per-family screen code the
 * abstraction exists to make unnecessary.
 *
 * A family the student does not yet have is shown where it would be shown if they did,
 * greyed rather than removed, with the label of the item that opens it and that item's
 * price where it has one — the same presentation a locked knob value gets. Seeing what
 * cannot yet be reached is how a student learns there is something to earn.
 *
 * A task declaring one family renders nothing at all. One choice is not a choice, and a
 * picker with a single entry would make the shipped lesson look like a decision it is not.
 */

import type { FamilyAvailability } from '../../../src/progression/index.js'
import type { ModelFamilyDeclaration } from '../../../src/task/types.js'

export interface FamilyPickerProps {
  readonly families: readonly ModelFamilyDeclaration[]
  readonly selected: string
  readonly onSelect: (familyId: string) => void
  /** Which families may be selected, and what opens the rest. Undefined locks nothing. */
  readonly availability?: readonly FamilyAvailability[]
  /** Presents a price in the farm's declared currency, for a locked family that has one. */
  readonly formatPrice?: (units: number) => string
}

function entryFor(
  availability: readonly FamilyAvailability[] | undefined,
  familyId: string,
): FamilyAvailability | undefined {
  return availability?.find((candidate) => candidate.familyId === familyId)
}

export function FamilyPicker({
  families,
  selected,
  onSelect,
  availability,
  formatPrice,
}: FamilyPickerProps) {
  if (families.length < 2) return null

  return (
    <fieldset className="family-picker">
      <legend>Kind of model</legend>
      <ul>
        {families.map((family) => {
          const entry = entryFor(availability, family.id)
          const available = entry?.available ?? true
          const openedBy = entry?.openedBy
          return (
            <li key={family.id} className={available ? 'family' : 'family locked'}>
              <button
                type="button"
                data-family={family.id}
                aria-pressed={family.id === selected}
                disabled={!available}
                onClick={() => onSelect(family.id)}
              >
                <span aria-hidden="true">{family.slot.icon}</span> {family.label}
              </button>
              {available || openedBy === undefined ? null : (
                <span className="locked-opener">
                  {' — opened by '}
                  {openedBy.label}
                  {openedBy.priceUnits === undefined || formatPrice === undefined
                    ? ''
                    : `, ${formatPrice(openedBy.priceUnits)}`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

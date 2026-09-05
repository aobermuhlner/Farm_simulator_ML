/**
 * One control for one declared knob.
 *
 * `design.md` — the control is chosen by the knob's declared `kind` and by
 * nothing else. There is deliberately no lookup by knob id here: a mapping
 * keyed by id is exactly the per-task screen code this slice exists to prove
 * unnecessary. If a knob needs more than the declaration carries, that is a
 * `task-contract` gap, not a special case to add below.
 *
 * A locked value is shown where the same value would be shown unlocked, greyed rather
 * than removed, with the label of the item that opens it and that item's price where it
 * has one. Seeing what cannot yet be afforded is how a student learns there is something
 * to earn — so buying changes which values can be *selected*, never which are on screen.
 * What opens a locked value is read from the availability, never decided here.
 */

import { useId } from 'react'
import type { ValueAvailability } from '../../../src/progression/index.js'
import type { KnobDeclaration } from '../../../src/task/types.js'
import { HelpDisclosure } from './HelpDisclosure.js'

export interface KnobControlProps {
  readonly knob: KnobDeclaration
  readonly value: string | number
  readonly onChange: (value: string | number) => void
  /**
   * Which of the knob's declared values may be selected, and what opens the rest.
   *
   * Undefined locks nothing. That is the default-open rule the progression module works
   * by, expressed where a caller with no catalog in hand meets it.
   */
  readonly availability?: readonly ValueAvailability[]
  /** Presents a price in the farm's declared currency. Absent where there is no farm. */
  readonly formatPrice?: (units: number) => string
}

/** The availability entry for one value, or undefined when nothing was supplied. */
function entryFor(
  availability: readonly ValueAvailability[] | undefined,
  value: string | number,
): ValueAvailability | undefined {
  return availability?.find((candidate) => String(candidate.value) === String(value))
}

function isAvailable(
  availability: readonly ValueAvailability[] | undefined,
  value: string | number,
): boolean {
  return entryFor(availability, value)?.available ?? true
}

export function KnobControl({
  knob,
  value,
  onChange,
  availability,
  formatPrice,
}: KnobControlProps) {
  const id = useId()

  const locked = (availability ?? []).filter((entry) => !entry.available)

  // A slider cannot grey one of its steps, so its range shrinks to what is open and its
  // handle refuses a locked step in between. The locked steps are still on screen, named
  // below the control — shown, and not selectable. Undefined availability leaves the
  // declared range exactly as it was.
  const openSteps =
    knob.kind === 'slider' && availability !== undefined
      ? availability.filter((entry) => entry.available).map((entry) => Number(entry.value))
      : undefined
  const range =
    knob.kind === 'slider'
      ? openSteps === undefined || openSteps.length === 0
        ? { min: knob.min, max: knob.max }
        : { min: Math.min(...openSteps), max: Math.max(...openSteps) }
      : { min: 0, max: 0 }

  return (
    <div className="knob">
      <label htmlFor={id}>{knob.label}</label>

      {knob.kind === 'choice' ? (
        <select
          id={id}
          value={String(knob.values.indexOf(value))}
          onChange={(event) => {
            const picked = knob.values[Number(event.target.value)]
            if (picked !== undefined && isAvailable(availability, picked)) onChange(picked)
          }}
        >
          {knob.values.map((option, index) => (
            <option
              key={String(option)}
              value={String(index)}
              disabled={!isAvailable(availability, option)}
            >
              {String(option)}
            </option>
          ))}
        </select>
      ) : (
        <span className="slider">
          <input
            id={id}
            type="range"
            min={range.min}
            max={range.max}
            step={knob.step}
            value={Number(value)}
            disabled={openSteps !== undefined && openSteps.length <= 1}
            onChange={(event) => {
              const picked = Number(event.target.value)
              if (isAvailable(availability, picked)) onChange(picked)
            }}
          />
          <output htmlFor={id}>{String(value)}</output>
        </span>
      )}

      {locked.length === 0 ? null : (
        <ul className="locked-values">
          {locked.map((entry) => (
            <li key={String(entry.value)} className="locked">
              <span className="locked-value">{String(entry.value)}</span>
              {entry.openedBy === undefined ? null : (
                <span className="locked-opener">
                  {' — opened by '}
                  {entry.openedBy.label}
                  {entry.openedBy.priceUnits === undefined || formatPrice === undefined
                    ? ''
                    : `, ${formatPrice(entry.openedBy.priceUnits)}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <HelpDisclosure label={`What does ${knob.label} do?`}>{knob.help}</HelpDisclosure>
    </div>
  )
}

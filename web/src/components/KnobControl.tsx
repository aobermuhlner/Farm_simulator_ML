/**
 * One control for one declared knob.
 *
 * `design.md` — the control is chosen by the knob's declared `kind` and by
 * nothing else. There is deliberately no lookup by knob id here: a mapping
 * keyed by id is exactly the per-task screen code this slice exists to prove
 * unnecessary. If a knob needs more than the declaration carries, that is a
 * `task-contract` gap, not a special case to add below.
 */

import { useId } from 'react'
import type { KnobDeclaration } from '../../../src/task/types.js'
import { HelpDisclosure } from './HelpDisclosure.js'

export interface KnobControlProps {
  readonly knob: KnobDeclaration
  readonly value: string | number
  readonly onChange: (value: string | number) => void
}

export function KnobControl({ knob, value, onChange }: KnobControlProps) {
  const id = useId()

  return (
    <div className="knob">
      <label htmlFor={id}>{knob.label}</label>

      {knob.kind === 'choice' ? (
        <select
          id={id}
          value={String(knob.values.indexOf(value))}
          onChange={(event) => {
            const picked = knob.values[Number(event.target.value)]
            if (picked !== undefined) onChange(picked)
          }}
        >
          {knob.values.map((option, index) => (
            <option key={String(option)} value={String(index)}>
              {String(option)}
            </option>
          ))}
        </select>
      ) : (
        <span className="slider">
          <input
            id={id}
            type="range"
            min={knob.min}
            max={knob.max}
            step={knob.step}
            value={Number(value)}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <output htmlFor={id}>{String(value)}</output>
        </span>
      )}

      <HelpDisclosure label={`What does ${knob.label} do?`}>{knob.help}</HelpDisclosure>
    </div>
  )
}

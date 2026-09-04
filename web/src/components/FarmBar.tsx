/**
 * The bar every screen of an opened farm carries: the farm's name, the year, the
 * balance, and a row of whatever else currently describes the farm.
 *
 * The summary facts are supplied, not owned. `Game_design.md` §5.1 writes that row as
 * "300 trees · model: hand-built tree (5 nodes) · data: 1 000 photos", and every noun in
 * it belongs to a change that does not exist yet. Fields named `trees`, `model` and
 * `data` would hard-code three nouns into a component whose whole point is that it names
 * nothing — so a fact is a label and a value, and the changes that have facts supply
 * their own. Nothing supplies any yet, which is why an empty list renders no row at all
 * rather than an empty one.
 *
 * Every figure is labelled programmatically as well as visually: a definition list
 * associates a term with its value on screen, but that association is not reliably
 * exposed, so each value also carries the label it is read out with.
 *
 * See openspec/changes/game-economy/specs/simulator-shell/spec.md.
 */

import type { Farm } from '../../../src/economy/index.js'
import { formatUnits } from '../../../src/economy/index.js'

/** One thing that is currently true about the farm. A label and its value, nothing more. */
export interface SummaryFact {
  readonly label: string
  readonly value: string
}

export interface FarmBarProps {
  readonly farm: Farm
  readonly facts?: readonly SummaryFact[]
}

/** A term and its value, labelled for a reader who cannot see the pairing. */
function Figure({ label, value }: SummaryFact) {
  return (
    <div className="figure">
      <dt>{label}</dt>
      <dd aria-label={label}>{value}</dd>
    </div>
  )
}

export function FarmBar({ farm, facts = [] }: FarmBarProps) {
  return (
    <section className="farm-bar" aria-label="Farm status">
      <dl className="farm-figures">
        <Figure label="Farm" value={farm.declaration.name} />
        <Figure label="Year" value={String(farm.year)} />
        <Figure label="Balance" value={formatUnits(farm.balance, farm.declaration)} />
      </dl>

      {facts.length === 0 ? null : (
        <dl className="farm-summary">
          {facts.map((fact) => (
            <Figure key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </dl>
      )}
    </section>
  )
}

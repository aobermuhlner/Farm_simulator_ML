/**
 * Configuration identity.
 *
 * An identifier is composed from knob ids and their values in the task's
 * declared knob order, so it is deterministic, greppable inside artifacts and
 * diffable in version control. A content hash would satisfy determinism just as
 * well but be opaque at exactly the moment an author needs to hand-adjust a
 * specific configuration's data.
 *
 * design.md illustrates the shape as `d8-w64-r3-do0`. This uses full knob ids
 * (`depth8-width64-...`) rather than abbreviations: any rule short enough to
 * produce `d`/`do` either collides (depth and dropout both start with `d`) or
 * has to consider the whole knob set, which would silently change existing
 * identifiers whenever a knob is added — invalidating every artifact keyed by
 * them.
 */

import type { ResolvedConfiguration } from './configuration.js'

/**
 * The character an identifier joins its parts with.
 *
 * Named here rather than written inline because the composer and the declaration
 * validator have to agree about it: `task-contract` forbids this character in a knob id
 * and in the written form of any value a knob permits, which is what makes an identifier
 * readable back to exactly one configuration. Two literals could drift apart and turn
 * that guarantee into a silently unresolvable slot.
 */
export const ID_SEPARATOR = '-'

function formatValue(value: string | number): string {
  return typeof value === 'number' ? String(value) : value
}

/**
 * The deterministic identifier for a resolved configuration. Identical knob
 * values always produce an identical identifier, independent of the order the
 * student set them in, the session, or the machine.
 */
export function configurationId(configuration: ResolvedConfiguration): string {
  return configuration.values
    .map(([id, value]) => `${id}${formatValue(value)}`)
    .join(ID_SEPARATOR)
}

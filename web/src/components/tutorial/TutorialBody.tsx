/**
 * Picks the body that belongs to a tutorial's declared kind.
 *
 * This file dispatches and does nothing else, which is the point of it — the same shape,
 * and for the same reason, as `components/architecture/ArchitectureDiagram.tsx`. Each
 * kind's body stays usable on its own, given that tutorial's declared puzzle data and
 * nothing else, and a kind added later is a new leaf plus one entry here rather than an
 * edit inside a body that already works.
 *
 * A body may name the family it teaches, because in a tutorial the interaction *is* the
 * lesson and cannot be data-driven. Nothing above this line may: the frame poses, judges
 * and records without knowing which family it is gating.
 *
 * See openspec/changes/model-tutorials/specs/model-tutorials/spec.md —
 * "Each kind of puzzle is separately mountable, and only it names its family".
 */

import type { ReactElement } from 'react'
import { LABEL_THE_LEAVES } from '../../../../src/tutorials/index.js'
import type { Loaded } from '../../data/load.js'
import type { TrainingSplitView } from '../../data/pool.js'
import { LeafLabellingBody } from './LeafLabelling.js'

export interface TutorialBodyProps {
  /** This tutorial's declared puzzle data, as its kind declared it. */
  readonly puzzle: unknown
  /**
   * Offers the student's answer for judging.
   *
   * The body owns the interaction and nothing else. It does not decide whether an answer
   * passes — the engine's registered kind does, so that the screen and the gate can never
   * disagree about what solving the puzzle means.
   */
  readonly onAttempt: (attempt: unknown) => void
  /**
   * The task's browsable split, for a kind whose puzzle is about particular pictures of it.
   *
   * Optional, and given only where a kind declares it needs it: a body that needs none is
   * still posed from its declared data alone, which is what keeps *used directly* true.
   * The same loader the training browser is given, so there is no second fetch path and no
   * second projection — and `data/pool.ts` has already dropped the generation attributes
   * and the measured feature values, so neither travels here with the pictures. A puzzle
   * that turns on a measurement carries that measurement in its own declared data.
   *
   * Fetching is the body's own state, exactly as it is the browser's: the pool is fetched
   * when a screen asks for it, so a body given this is the only thing that can be waiting.
   */
  readonly loadSplit?: () => Promise<Loaded<TrainingSplitView>>
}

export type TutorialBodyComponent = (props: TutorialBodyProps) => ReactElement | null

export type TutorialBodies = Readonly<Record<string, TutorialBodyComponent>>

/**
 * The bodies this build carries.
 *
 * One, and its key set must match the engine registry's — `src/tutorials/` — or a
 * declaration would validate and then render nothing. A test holds the two together.
 */
export const TUTORIAL_BODIES: TutorialBodies = { [LABEL_THE_LEAVES]: LeafLabellingBody }

export interface TutorialBodyMountProps extends TutorialBodyProps {
  readonly kind: string
  /** Injected by tests, which pose a fixture puzzle no shipped build carries. */
  readonly bodies?: TutorialBodies
}

export function TutorialBody({
  kind,
  puzzle,
  onAttempt,
  loadSplit,
  bodies = TUTORIAL_BODIES,
}: TutorialBodyMountProps) {
  const Body = Object.prototype.hasOwnProperty.call(bodies, kind) ? bodies[kind] : undefined
  // A kind with no body never reaches here: the declaration was refused at load. Rendering
  // nothing rather than throwing keeps a build mismatch from taking the whole page down,
  // and the registry test is what actually catches it.
  if (Body === undefined) return null
  // Passed through unread. Whether the pictures are wanted, and what is done while they
  // are outstanding, belongs to the body; this file dispatches and does nothing else.
  return <Body puzzle={puzzle} onAttempt={onAttempt} loadSplit={loadSplit} />
}

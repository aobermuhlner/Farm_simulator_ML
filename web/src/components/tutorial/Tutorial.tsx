/**
 * The frame around a tutorial: what it is called, the theory beside it, the puzzle, and
 * the one thing that comes of solving it.
 *
 * Names no family, and must not. Everything on screen here is read from the declaration
 * the frame is handed, and the interaction belongs entirely to the mounted body — which is
 * the only place a family may be named.
 *
 * Free and unlimited. There is no attempt counter, no score, no timer and nowhere to put
 * one: a puzzle that recorded how well it was solved would be a puzzle a student optimises
 * instead of reads. A failed attempt costs nothing and can be repeated at once, and a
 * tutorial already passed stays open and readable — passing it again, or failing it again,
 * changes nothing.
 *
 * See openspec/changes/model-tutorials/specs/model-tutorials/spec.md.
 */

import { useState } from 'react'
import type { TutorialDeclaration } from '../../../../src/task/types.js'
import type { Loaded } from '../../data/load.js'
import type { TrainingSplitView } from '../../data/pool.js'
import type { TutorialKinds } from '../../../../src/tutorials/index.js'
import { judgeAttempt } from '../../../../src/tutorials/index.js'
import { HelpDisclosure } from '../HelpDisclosure.js'
import type { TutorialBodies } from './TutorialBody.js'
import { TutorialBody } from './TutorialBody.js'

export interface TutorialProps {
  readonly tutorial: TutorialDeclaration
  /**
   * The task's browsable split, for a kind whose puzzle is about particular pictures.
   *
   * Passed straight to the mounted body and never read here. The frame poses, judges,
   * records and gates without knowing what a puzzle is, and that includes not knowing
   * whether this one is about photographs.
   */
  readonly loadSplit?: () => Promise<Loaded<TrainingSplitView>>
  /** Whether this farm has already passed it. A passed tutorial is still opened and read. */
  readonly complete: boolean
  /** Reports a passing attempt. Called again on a re-pass; recording it twice is a no-op. */
  readonly onComplete: () => void
  readonly onClose: () => void
  /** Injected by tests, which judge a fixture puzzle no shipped build carries. */
  readonly kinds?: TutorialKinds
  /** Injected by tests, which mount a fixture body no shipped build carries. */
  readonly bodies?: TutorialBodies
}

/**
 * What the last attempt did, for this visit only.
 *
 * Deliberately not persisted and deliberately not counted. It exists so a student can see
 * that the answer they just gave was read; the moment the modal closes it is gone, which
 * is the whole difference between feedback and a score.
 */
type Attempted = 'none' | 'passed' | 'failed'

export function Tutorial({
  tutorial,
  loadSplit,
  complete,
  onComplete,
  onClose,
  kinds,
  bodies,
}: TutorialProps) {
  const [attempted, setAttempted] = useState<Attempted>('none')

  function attempt(answer: unknown): void {
    // Judged by the engine's registered kind rather than by the body, so that what the
    // screen calls passing and what the gate calls passing are one decision.
    if (judgeAttempt(tutorial, answer, kinds)) {
      setAttempted('passed')
      onComplete()
      return
    }
    setAttempted('failed')
  }

  return (
    <section className="tutorial" aria-label={tutorial.title}>
      <h2>{tutorial.title}</h2>
      <p>{tutorial.teaching.summary}</p>
      <HelpDisclosure label="The theory behind this">{tutorial.teaching.theory}</HelpDisclosure>

      <TutorialBody
        kind={tutorial.kind}
        puzzle={tutorial.puzzle}
        onAttempt={attempt}
        loadSplit={loadSplit}
        bodies={bodies}
      />

      {/*
        In plain view, under the puzzle, never collapsed. A tutorial simplifies the model
        it teaches, and a student who would notice that by reading the source has to be
        told where the puzzle is — the theory disclosure above is opened by whoever opens
        it, which is not the same thing. One sentence that is read beats three paragraphs
        that are not.
      */}
      <p className="tutorial-disclosure">{tutorial.disclosure}</p>

      {attempted === 'passed' ? <p className="tutorial-passed">That is it — well read.</p> : null}
      {attempted === 'failed' ? (
        <p className="tutorial-failed">Not quite. Try it again — it costs nothing.</p>
      ) : null}
      {complete && attempted !== 'passed' ? (
        <p className="tutorial-complete">You have already finished this one.</p>
      ) : null}

      <p>
        <button type="button" onClick={onClose}>
          Back to the workshop
        </button>
      </p>
    </section>
  )
}

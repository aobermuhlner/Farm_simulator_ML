/**
 * A tutorial body for the screen tests, paired with the engine kind the tests judge by.
 *
 * The kind itself comes from `test/helpers/tutorials.ts` rather than being written twice:
 * the whole point of the frame is that one kind supplies both the checking and the
 * judging, and two fixtures that could drift would let a screen test pass against a rule
 * the engine does not hold.
 *
 * This body names its family nowhere, which is a fixture's privilege rather than a rule —
 * a real body may name the one family it teaches. What matters for the tests is that
 * everything above it names none.
 */

import { FIXTURE_KIND, type PickOnePuzzle } from '../../../test/helpers/tutorials.js'
import type { TutorialBodies, TutorialBodyProps } from '../components/tutorial/TutorialBody.js'

export {
  FIXTURE_ANSWER,
  FIXTURE_KIND,
  fixtureKinds,
  fixtureTutorial,
} from '../../../test/helpers/tutorials.js'

/** One button per declared option; pressing one offers it for judging. */
function PickOneBody({ puzzle, onAttempt }: TutorialBodyProps) {
  const { options } = puzzle as PickOnePuzzle
  return (
    <ul>
      {options.map((option) => (
        <li key={option}>
          <button type="button" onClick={() => onAttempt(option)}>
            {option}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** A second kind, for the test that adding one leaves the first alone. */
function AlwaysWrongBody({ onAttempt }: TutorialBodyProps) {
  return (
    <button type="button" onClick={() => onAttempt('never right')}>
      Guess
    </button>
  )
}

export const SECOND_KIND = 'always-wrong'

export const fixtureBodies: TutorialBodies = {
  [FIXTURE_KIND]: PickOneBody,
  [SECOND_KIND]: AlwaysWrongBody,
}

/** Just the one body, for the test that a kind is mountable on its own. */
export const onlyPickOne: TutorialBodies = { [FIXTURE_KIND]: PickOneBody }

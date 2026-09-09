/**
 * What the game is allowed to claim about one way of deciding an apple against another.
 *
 * The recorded ladder position replaced a refusal, and this is the half of that refusal
 * worth keeping. A student who buys a model on a promise of better accuracy and then
 * measures worse accuracy has been taught that measurement does not settle things — the
 * opposite of the whole exercise, and a lesson far more expensive than a bad harvest. So
 * while the recorded figures do not show a trained model ahead, no copy and no screen may
 * present one as better; what it is *for* is expressiveness the declared features cannot
 * reach, and that is a different sentence.
 *
 * The check is a vocabulary check and says so. Nothing here parses English or knows who a
 * sentence is about: it looks for the constructions a comparative performance claim reaches
 * for, in the currencies the ladder position is recorded in, and refuses them while the
 * recording does not bear them out. That is the same instrument `orchard-scale` used to keep
 * the copy that sells land away from the vocabulary of performance, and it is deliberately
 * blunt — a claim can only be made in words, and these are the words.
 *
 * See openspec/changes/measured-features/specs/measured-features/spec.md.
 */

import type { ValidationIssue } from '../task/validate.js'

/** The two currencies the ladder position is recorded in. */
export type ClaimCurrency = 'score' | 'earnings'

/**
 * The constructions a comparative claim reaches for, per currency.
 *
 * Phrases rather than single words, and that is the whole reason the check is usable. The
 * shipped copy is full of "more" — a hundred more trees, more room to memorise, more than
 * one mistake to make — and every one of those is honest. What is not sayable is a
 * comparative bound to a performance noun: "more accurate", "earns more". Matched
 * case-insensitively against the copy as delivered.
 */
export const CLAIM_PHRASES: Readonly<Record<ClaimCurrency, readonly string[]>> = {
  score: [
    'more accurate',
    'most accurate',
    'better at',
    'best at',
    'fewer mistakes',
    'gets more right',
    'higher accuracy',
    'improves accuracy',
    'more reliable',
    'outperform',
    'better than',
    'sharper eye',
  ],
  earnings: [
    'earn more',
    'earns more',
    'earning more',
    'higher earnings',
    'improves earnings',
    'more money',
    'more profitable',
    'out-earn',
    'pays better',
    'pays more',
    'worth more',
  ],
}

/**
 * One currency's recorded standing: what the best hand rule got, and the best a model got.
 *
 * Both numbers rather than a verdict, so the direction is read off the recording instead of
 * being asserted beside it. When `heirloom-cultivars` lands and a network finally wins on
 * the crop as it stands, the recorded figures change and the vocabulary becomes sayable
 * with no edit to this check.
 */
export interface RecordedStanding {
  readonly currency: ClaimCurrency
  /** The recorded figure the standing is read off, named as the recording names it. */
  readonly figure: string
  /** What the best rule within the declared node budget was recorded at. */
  readonly rule: number
  /** The best figure any shipped configuration was recorded at. */
  readonly model: number
}

/** True when the recording shows a trained configuration ahead of the best hand rule. */
export function modelAhead(standing: RecordedStanding): boolean {
  return standing.model > standing.rule
}

/** A piece of copy the game shows, and where it came from. */
export interface DeclaredCopy {
  /** Where this text lives, for a refusal that has to name the claim. */
  readonly source: string
  readonly text: string
}

/**
 * Refuses copy that claims an advantage the recorded figures do not show.
 *
 * A currency whose recording already puts a model ahead is not checked at all — there the
 * claim is true, and saying so is the honest thing. Everything else is refused naming the
 * phrase, where it was found, and the recorded figures that contradict it.
 */
export function checkNoUnrecordedClaim(
  copy: readonly DeclaredCopy[],
  standings: readonly RecordedStanding[],
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const standing of standings) {
    if (modelAhead(standing)) continue
    for (const item of copy) {
      const text = item.text.toLowerCase()
      for (const phrase of CLAIM_PHRASES[standing.currency]) {
        if (!text.includes(phrase)) continue
        issues.push({
          code: 'unrecorded-claim',
          field: item.source,
          message:
            `"${item.source}" claims "${phrase}", which the recorded figure "${standing.figure}" ` +
            `measures the other way: the best hand rule is recorded at ${standing.rule} and the ` +
            `best shipped configuration at ${standing.model}.`,
        })
      }
    }
  }
  return issues
}

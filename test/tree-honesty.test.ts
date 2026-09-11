/**
 * Nothing claims a fit that did not happen.
 *
 * The prototype rule permits shipping a model that is not fitted. It does not permit
 * saying one was, and the difference matters most for exactly the model that is easiest
 * to misread: a tree a student can follow, whose questions look chosen, arriving on a
 * screen with a button marked *train*.
 *
 * Two things are checked, and both are structural rather than a matter of taste in
 * wording. The provenance says the trees were authored, which is the fact everything
 * downstream reads instead of inferring. And no declared copy states or implies that
 * the shipped trees were fitted to any photographs — checked against the copy, because
 * the copy is data and data is where the claim would be made.
 *
 * The forbidden phrasings below are a floor, not a proof. A determined author can still
 * mislead in words this does not match; what this catches is the way it would actually
 * happen, which is copy written for the fitted trees arriving before they do.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readModelIndex } from '../src/families/modelIndex.js'
import type { PoolBinding } from '../src/task/artifactIndex.js'
import { appleDeclaration } from './helpers/apple'
import { committedManifest } from './helpers/pool'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const apple = appleDeclaration()
const manifest = committedManifest()

const tree = apple.families.find((family) => family.ships === 'model')
if (tree === undefined) throw new Error('the apple task declares no model-shipping family')

const binding: PoolBinding = {
  poolId: manifest.poolId,
  schemaVersion: manifest.schemaVersion,
  seed: manifest.seed,
}

function index() {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, tree!.models ?? '', 'index.json'), 'utf8'),
  ) as unknown
  const read = readModelIndex(raw, apple, tree!, binding)
  if (!read.ok) throw new Error(read.issues.map((issue) => issue.message).join(' '))
  return read.index
}

/** Every word a student can be shown about this family, from the declaration alone. */
function declaredCopy(): readonly { readonly where: string; readonly text: string }[] {
  const copy = [
    { where: 'teaching.summary', text: tree!.teaching.summary },
    { where: 'teaching.theory', text: tree!.teaching.theory },
    { where: 'label', text: tree!.label },
    { where: 'slot.label', text: tree!.slot.label },
    ...tree!.knobs.map((knob, at) => ({ where: `knobs[${at}].help`, text: knob.help })),
  ]
  const tutorial = tree!.tutorial
  if (tutorial !== undefined) {
    copy.push(
      { where: 'tutorial.teaching.summary', text: tutorial.teaching.summary },
      { where: 'tutorial.teaching.theory', text: tutorial.teaching.theory },
      { where: 'tutorial.disclosure', text: tutorial.disclosure },
    )
  }
  return copy
}

/**
 * Ways of saying a fit happened.
 *
 * Two shapes. The first is a claim about the *student's* photographs, which is the
 * strongest form of the lie and the one that would be most convincing. The second is a
 * bare past-tense claim about the model itself.
 */
const CLAIMS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'fitted to your photographs', pattern: /fitted to (your|these|the) (photograph|photo|picture|image)/i },
  { name: 'learned from your photographs', pattern: /learn(ed|s|t) from (your|these|the) (photograph|photo|picture|image)/i },
  { name: 'trained on your photographs', pattern: /trained on (your|these|the) (photograph|photo|picture|image)/i },
  { name: 'this tree was fitted', pattern: /th(is|e) tree (was|has been) (fitted|trained|learned)/i },
  { name: 'we fitted it', pattern: /we (fitted|trained) (it|this|the tree)/i },
  { name: 'it chose its own questions', pattern: /(chose|worked out|found) (its|their) own (questions|cuts|thresholds)/i },
]

/** Copy that would be a lie, one line per claim, to keep the patterns from going dead. */
const DISHONEST: readonly string[] = [
  'This tree was fitted to your photographs overnight.',
  'It learned from the photographs that came with the robot.',
  'The model you see was trained on these pictures.',
  'The tree was fitted at the budget you chose.',
  'We fitted it for you before you arrived.',
  'It chose its own questions from the numbers it measured.',
]

describe('the shipped trees record that they were authored', () => {
  it('records an origin for every covered configuration, and it is not a fit', () => {
    const configurations = Object.entries(index().configurations)

    expect(configurations.length).toBeGreaterThan(0)
    for (const [id, record] of configurations) {
      expect(record.provenance.origin, id).toBe('authored')
      expect(record.provenance.pipeline, id).toBeUndefined()
      expect(record.provenance.seed, id).toBeUndefined()
    }
  })

  it('names what authored them, so nothing downstream has to infer it', () => {
    // Not from an absent history, not from a missing seed, not from the date on a
    // file. Inference is how a placeholder quietly becomes load-bearing.
    for (const [id, record] of Object.entries(index().configurations)) {
      const by = record.provenance.authoredBy ?? ''
      expect(by.length, id).toBeGreaterThan(20)
      expect(by.toLowerCase(), id).toContain('hand')
    }
  })
})

describe('no declared copy claims a fit that did not happen', () => {
  it('has copy to check', () => {
    // A vacuous pass would be worse than a failure: the copy is where the claim would
    // be made, so a family declaring none would make this test meaningless.
    const copy = declaredCopy()
    expect(copy.length).toBeGreaterThan(4)
    expect(copy.every((entry) => entry.text.length > 0)).toBe(true)
  })

  for (const claim of CLAIMS) {
    it(`says nothing that reads as "${claim.name}"`, () => {
      for (const entry of declaredCopy()) {
        expect(entry.text, `${entry.where} reads as ${claim.name}`).not.toMatch(claim.pattern)
      }
    })
  }

  it('says plainly, somewhere a student can read it, that these were written by hand', () => {
    // The honest form of the same fact. `CLAUDE.md`'s honesty line is not satisfied by
    // omitting the claim; a student reading the theory has to be able to find out.
    const theory = tree!.teaching.theory.toLowerCase()

    expect(theory).toMatch(/written out by hand|authored by hand|written by hand/)
    expect(theory).toMatch(/not.{0,60}(from your photographs|worked out from your)/)
  })

  it('describes fitting in the conditional, as something a fit would do', () => {
    // The theory explains what fitting a tree is, which it must: the family is where
    // the word is introduced. What it may not do is say that this happened.
    expect(tree!.teaching.theory).toMatch(/would/i)
  })

  it('keeps the tutorial’s own disclosure about what it withholds', () => {
    // `model-tutorials` requires one sentence the puzzle says about *itself*, and this
    // one's is that the questions were given rather than chosen — which is the same
    // honesty the family is under, one rung down.
    expect(tree!.tutorial?.disclosure.length ?? 0).toBeGreaterThan(20)
  })
})

describe('the check would catch the claim it is looking for', () => {
  it('matches every sentence that would be a lie', () => {
    // Without this the suite could go green because the patterns stopped matching
    // anything at all, which is the failure mode of every forbidden-words check.
    for (const line of DISHONEST) {
      expect(
        CLAIMS.some((claim) => claim.pattern.test(line)),
        line,
      ).toBe(true)
    }
  })

  it('matches nothing in the honest description of what a fit would do', () => {
    for (const claim of CLAIMS) {
      expect(
        claim.pattern.test('What fitting one would do is choose the questions itself.'),
        claim.name,
      ).toBe(false)
    }
  })
})

describe('the catalog does not sell a fit either', () => {
  it('promises no model fitted to the student’s photographs', () => {
    const catalog = JSON.parse(
      readFileSync(join(repoRoot, 'declarations/catalog.json'), 'utf8'),
    ) as { readonly items: readonly { readonly id: string; readonly copy: string }[] }

    const models = catalog.items.filter((item) => /tree/i.test(item.id))
    expect(models.length).toBeGreaterThan(0)
    for (const item of models) {
      for (const claim of CLAIMS) {
        expect(item.copy, `${item.id} reads as ${claim.name}`).not.toMatch(claim.pattern)
      }
    }
  })
})

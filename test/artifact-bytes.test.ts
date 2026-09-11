/**
 * The shipped convolutional artifacts did not move.
 *
 * `fitted-tree` generalizes the artifact contract to admit a family that ships a model
 * rather than a table of predictions, and generalizes the vocabulary from epochs to
 * steps. Both changes had to leave the three artifacts already shipped exactly as they
 * are: renaming a key on disk would invalidate all three and force a retrain, which is
 * the one thing the change must not cause.
 *
 * A pinned digest rather than an intention. The reader is free to accept a new spelling;
 * it is not free to require one, and the only way to tell the difference from outside is
 * to weigh the bytes.
 *
 * Line endings are normalized before hashing. Git rewrites them on checkout depending on
 * the machine, and a test that failed on Windows and passed on Linux would say nothing
 * about whether the artifact's content had changed — which is what is being asserted.
 */

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const SHIPPED = join(repoRoot, 'artifacts/apple-harvest/predictions')

/**
 * The content of each shipped file as it stood before the family abstraction gained a
 * second rung. Regenerating any of these is a retrain, and a retrain is a change of its
 * own — so a digest here moving is a question to answer, not a number to update.
 */
const DIGESTS: Readonly<Record<string, string>> = {
  'index.json': '53ef3f8bb2e6bbe9c7c6c5797a992d326b7d63eb26d470b215479b9c01a406e5',
  'blocks2-channels8-regularization1-dropout0.json':
    '11c307b215073681a027338b61309d7fa8bbfab983171ba11c95ae5f118b0b60',
  'blocks2-channels16-regularization1-dropout0.json':
    'b6c29aa61e735136d070fe09d9bde4b65f6779a53c4fc0d9e88e9ef7e9b81837',
  'blocks2-channels32-regularization1-dropout0.json':
    '635a1f90d4681c4e822d77cbe39aa81bba470b4f62c55ed654214b02207796d0',
  'blocks2-channels8-regularization1-dropout0-datasetstarter.json':
    '86f09567b02603983aa5baf5d1f472a9993c910ea7e68991a459cce29ddbd882',
  'blocks2-channels16-regularization1-dropout0-datasetstarter.json':
    'a2497272689a7d44d2eb0d9f7965fe13d3553859dc36ffe7697772e0ba715e38',
  'blocks2-channels32-regularization1-dropout0-datasetstarter.json':
    'f870e3eed165ae586938fad11eab723b36ca45258a1256e1911e11d0b2e17c26',
}

function digestOf(name: string): string {
  const content = readFileSync(join(SHIPPED, name), 'utf8').replace(/\r\n/g, '\n')
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

describe('the shipped convolutional artifacts are byte-identical', () => {
  it('holds exactly the files it held, and no others', () => {
    expect(readdirSync(SHIPPED).sort()).toEqual(Object.keys(DIGESTS).sort())
  })

  for (const [name, digest] of Object.entries(DIGESTS)) {
    it(`leaves ${name} untouched`, () => {
      expect(digestOf(name)).toBe(digest)
    })
  }

  it('still writes its step key as `epoch`, which is why the reader accepts both', () => {
    const file = JSON.parse(
      readFileSync(join(SHIPPED, 'blocks2-channels16-regularization1-dropout0-datasetstarter.json'), 'utf8'),
    ) as { readonly history: readonly Record<string, unknown>[] }

    expect(file.history[0]).toHaveProperty('epoch')
    expect(file.history[0]).not.toHaveProperty('step')
  })
})

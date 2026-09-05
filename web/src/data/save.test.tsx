/**
 * The browser edge of the save.
 *
 * Four ways it can go, and none of them throws: it works, there is no storage at all, the
 * read throws, the write throws. A screen has to be able to render every one of them, so
 * every one of them is a value.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  browserStorage,
  clearStoredSave,
  readStoredSave,
  SAVE_KEY,
  STORAGE_UNAVAILABLE,
  writeStoredSave,
  type SaveStorage,
} from './save.js'
import { memoryStorage } from '../test-support/progression.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Storage that throws on everything, the way a browser blocking site data does. */
function hostileStorage(): SaveStorage {
  return {
    getItem: () => {
      throw new Error('site data is blocked')
    },
    setItem: () => {
      throw new Error('the quota is full')
    },
    removeItem: () => {
      throw new Error('site data is blocked')
    },
  }
}

describe('a storage that works', () => {
  it('reads back what it wrote', () => {
    const storage = memoryStorage()
    expect(writeStoredSave('{"a":1}', storage)).toEqual({ ok: true })
    expect(readStoredSave(storage)).toEqual({ ok: true, text: '{"a":1}' })
  })

  it('reports nothing stored as nothing rather than as a failure', () => {
    expect(readStoredSave(memoryStorage())).toEqual({ ok: true, text: undefined })
  })

  it('discards what it kept', () => {
    const storage = memoryStorage({ [SAVE_KEY]: '{"a":1}' })
    expect(clearStoredSave(storage)).toEqual({ ok: true })
    expect(readStoredSave(storage)).toEqual({ ok: true, text: undefined })
  })

  it('keeps its key to itself, because the origin is shared', () => {
    const storage = memoryStorage()
    writeStoredSave('{"a":1}', storage)
    expect(storage.getItem(SAVE_KEY)).toBe('{"a":1}')
    expect(SAVE_KEY.startsWith('farm-simulator-ml')).toBe(true)
  })
})

describe('a storage that will not have it', () => {
  it('reports absent storage as a value, not an exception', () => {
    vi.stubGlobal('localStorage', undefined)
    const read = readStoredSave()
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.issue.code).toBe(STORAGE_UNAVAILABLE)
    expect(read.issue.message).toContain('progress is not being kept')
  })

  it('reports a read that throws', () => {
    const read = readStoredSave(hostileStorage())
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.issue.code).toBe(STORAGE_UNAVAILABLE)
    expect(read.issue.message).toContain('site data is blocked')
  })

  it('reports a write that throws', () => {
    const written = writeStoredSave('{"a":1}', hostileStorage())
    expect(written.ok).toBe(false)
    if (written.ok) return
    expect(written.issue.code).toBe(STORAGE_UNAVAILABLE)
    expect(written.issue.message).toContain('the quota is full')
  })

  it('reports a discard that throws', () => {
    expect(clearStoredSave(hostileStorage()).ok).toBe(false)
  })

  it('reports a write with nowhere to put it', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(writeStoredSave('{}').ok).toBe(false)
    expect(clearStoredSave().ok).toBe(false)
  })

  it('finds the browser’s own storage under jsdom', () => {
    expect(browserStorage()).toBeDefined()
  })
})

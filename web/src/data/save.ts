/**
 * The browser edge of the save: twenty lines that touch `localStorage`.
 *
 * Everything about what a save *means* is `src/save/`. This module only reads and writes
 * text, and it returns storage failure as a value rather than letting an exception cross
 * the boundary — "playable, and says so" is a rendering decision, and a screen cannot
 * render an exception.
 *
 * There are three ways storage refuses and all of them are ordinary: a browser with the
 * API missing, an access that throws because site data is blocked, and a write that
 * throws because the quota is full or the session is private. Each is caught here.
 *
 * The key is namespaced to this app. GitHub Pages serves every project of a user from one
 * origin, so an unprefixed key would collide with any other page that user hosts.
 */

import type { ValidationIssue } from '../../../src/task/validate.js'

/** Where this app's save lives. Namespaced, because the origin is shared. */
export const SAVE_KEY = 'farm-simulator-ml:save'

/** Storage that would not read or write. Never fatal; disclosed instead. */
export const STORAGE_UNAVAILABLE = 'storage-unavailable'

export type StoredRead =
  /** `text` is undefined when nothing has been stored yet, which is a new farm. */
  | { readonly ok: true; readonly text: string | undefined }
  | { readonly ok: false; readonly issue: ValidationIssue }

export type StoredWrite =
  | { readonly ok: true }
  | { readonly ok: false; readonly issue: ValidationIssue }

/** A place to put text. `localStorage` satisfies it; so does a test's own object. */
export interface SaveStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * The browser's own storage, or undefined where there is none.
 *
 * Reaching for `localStorage` is itself what throws in a browser set to block site data,
 * so even the lookup is guarded.
 */
export function browserStorage(): SaveStorage | undefined {
  try {
    const storage = globalThis.localStorage as SaveStorage | undefined | null
    return storage ?? undefined
  } catch {
    return undefined
  }
}

function unavailable(what: string, cause?: unknown): ValidationIssue {
  return {
    code: STORAGE_UNAVAILABLE,
    field: SAVE_KEY,
    message:
      `This browser would not ${what}, so progress is not being kept this session.` +
      (cause === undefined ? '' : ` (${String(cause)})`),
  }
}

/** What is stored, or the reason nothing could be read. */
export function readStoredSave(storage = browserStorage()): StoredRead {
  if (storage === undefined) return { ok: false, issue: unavailable('give a place to keep progress') }
  try {
    return { ok: true, text: storage.getItem(SAVE_KEY) ?? undefined }
  } catch (cause) {
    return { ok: false, issue: unavailable('read what it had kept', cause) }
  }
}

/** Stores `text`, or reports that it could not be stored. The change still stands. */
export function writeStoredSave(text: string, storage = browserStorage()): StoredWrite {
  if (storage === undefined) return { ok: false, issue: unavailable('give a place to keep progress') }
  try {
    storage.setItem(SAVE_KEY, text)
    return { ok: true }
  } catch (cause) {
    return { ok: false, issue: unavailable('keep this change', cause) }
  }
}

/** Discards what is stored, for a student starting a new farm. */
export function clearStoredSave(storage = browserStorage()): StoredWrite {
  if (storage === undefined) return { ok: false, issue: unavailable('give a place to keep progress') }
  try {
    storage.removeItem(SAVE_KEY)
    return { ok: true }
  } catch (cause) {
    return { ok: false, issue: unavailable('discard what it had kept', cause) }
  }
}

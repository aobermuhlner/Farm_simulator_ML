/**
 * Artifact schema version checking.
 *
 * Best-effort partial loading is the worst available behaviour here: using
 * whatever rows match and skipping the rest produces a plausible-looking
 * harvest that teaches something untrue. A mismatch refuses, naming both
 * versions, and there is deliberately no partial-data path to fall back to.
 */

import type { ValidationIssue } from './validate.js'

export type VersionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly issue: ValidationIssue }

export const SCHEMA_VERSION_MISMATCH = 'schema-version-mismatch'

/**
 * Compares the version a task declares against the version its prediction
 * artifact was generated with. Equal versions load; anything else refuses.
 */
export function checkArtifactVersion(declared: string, artifact: string): VersionCheck {
  if (declared === artifact) return { ok: true }
  return {
    ok: false,
    issue: {
      code: SCHEMA_VERSION_MISMATCH,
      field: 'schemaVersion',
      message:
        `Declared schema version "${declared}" does not match prediction artifact ` +
        `version "${artifact}". The artifact must be regenerated; partial data is not used.`,
    },
  }
}

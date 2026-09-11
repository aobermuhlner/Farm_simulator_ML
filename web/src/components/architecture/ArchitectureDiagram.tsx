/**
 * Picks the drawing that belongs to a resolved architecture's family.
 *
 * This file dispatches and does nothing else, which is the point of it. Each family's
 * drawing stays usable on its own — a page presenting only a plain network imports
 * `FeedforwardDiagram` and carries no convolutional code with it — and a family added
 * later is a new leaf plus one line here rather than an edit inside a drawing that
 * already works.
 *
 * See openspec/changes/cnn-architecture/specs/network-diagram/spec.md.
 */

import type { ResolvedArchitecture, TreePath } from '../../../../src/task/diagram.js'
import { CnnDiagram } from './CnnDiagram.js'
import { FeedforwardDiagram } from './FeedforwardDiagram.js'
import { TreeDiagram } from './TreeDiagram.js'

export interface ArchitectureDiagramProps {
  readonly architecture: ResolvedArchitecture
  /** One apple's route through the drawing, for a kind that can trace one. */
  readonly path?: TreePath
}

export function ArchitectureDiagram({ architecture, path }: ArchitectureDiagramProps) {
  if (architecture.kind === 'feedforward') {
    return <FeedforwardDiagram architecture={architecture} />
  }
  if (architecture.kind === 'cnn') return <CnnDiagram architecture={architecture} />
  return <TreeDiagram architecture={architecture} path={path} />
}

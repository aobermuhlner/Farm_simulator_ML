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

import type { ResolvedArchitecture } from '../../../../src/task/diagram.js'
import { CnnDiagram } from './CnnDiagram.js'
import { FeedforwardDiagram } from './FeedforwardDiagram.js'

export interface ArchitectureDiagramProps {
  readonly architecture: ResolvedArchitecture
}

export function ArchitectureDiagram({ architecture }: ArchitectureDiagramProps) {
  if (architecture.kind === 'feedforward') {
    return <FeedforwardDiagram architecture={architecture} />
  }
  return <CnnDiagram architecture={architecture} />
}

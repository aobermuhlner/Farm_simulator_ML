/**
 * The tree drawing, rendered from a resolved tree and from nothing else.
 *
 * Everything here is given to the component already resolved — labelled questions,
 * labelled leaves, a budget label — so what is being tested is geometry and markup. The
 * resolution itself is the engine's, and `test/tree-drawing.test.ts` holds it to the
 * shipped structure.
 *
 * The tree used is deliberately not the apple task's. Its questions cut numbers no
 * lesson in this build measures and its categories are not apples, so a component that
 * had learned any of the shipped vocabulary would draw this one wrongly.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ResolvedTree, TreePath } from '../../../../src/task/diagram.js'
import { TreeDiagram } from './TreeDiagram.js'

afterEach(cleanup)

const tree: ResolvedTree = {
  kind: 'tree',
  nodes: 3,
  nodesLabel: 'Questions allowed',
  questions: [
    {
      featureLabel: 'Rust patch area',
      unit: 'share of the panel; 0 to 1',
      threshold: 0.12,
      whenAbove: {
        shares: [
          { categoryLabel: 'Sound panel', probability: 0.05 },
          { categoryLabel: 'Rusted panel', probability: 0.9 },
          { categoryLabel: 'Bent panel', probability: 0.05 },
        ],
      },
    },
    {
      featureLabel: 'Edge straightness',
      unit: 'millimetres of deviation',
      threshold: 2.5,
      whenAbove: {
        shares: [
          { categoryLabel: 'Sound panel', probability: 0.1 },
          { categoryLabel: 'Rusted panel', probability: 0.1 },
          { categoryLabel: 'Bent panel', probability: 0.8 },
        ],
      },
    },
    {
      featureLabel: 'Surface gloss',
      unit: 'reflectance; 0 to 1',
      threshold: 0.7,
      whenAbove: {
        shares: [
          { categoryLabel: 'Sound panel', probability: 0.7 },
          { categoryLabel: 'Rusted panel', probability: 0.2 },
          { categoryLabel: 'Bent panel', probability: 0.1 },
        ],
      },
    },
  ],
  otherwise: {
    shares: [
      { categoryLabel: 'Sound panel', probability: 0.6 },
      { categoryLabel: 'Rusted panel', probability: 0.25 },
      { categoryLabel: 'Bent panel', probability: 0.15 },
    ],
  },
}

function questions(): readonly Element[] {
  return [...document.querySelectorAll('[data-question]')]
}

describe('the tree is drawn as the chain it is', () => {
  it('draws one node per question, plus the leaf an unclaimed apple reaches', () => {
    render(<TreeDiagram architecture={tree} />)

    expect(questions()).toHaveLength(tree.questions.length + 1)
    expect(document.querySelector('[data-question="otherwise"]')).not.toBeNull()
    // One leaf per question and one at the end: every path terminates in exactly one.
    expect(screen.getAllByTestId('tree-leaf')).toHaveLength(tree.questions.length + 1)
  })

  it('says each question in the words it was handed, with the value it cuts at', () => {
    render(<TreeDiagram architecture={tree} />)

    for (const question of tree.questions) {
      expect(screen.getByText(question.featureLabel)).toBeDefined()
      expect(screen.getByText(`above ${question.threshold}?`)).toBeDefined()
    }
  })

  it('shows every category’s share in a leaf, not only the largest', () => {
    // A leaf that showed its winner would be a leaf that had chosen, and choosing is
    // the decision policy's to do.
    render(<TreeDiagram architecture={tree} />)

    const first = screen.getAllByTestId('tree-leaf')[0]
    const shares = [...(first?.querySelectorAll('[data-share]') ?? [])]

    expect(shares.map((share) => share.getAttribute('data-share'))).toEqual(
      tree.questions[0]?.whenAbove.shares.map((share) => share.categoryLabel),
    )
    expect(screen.getAllByText('90%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5%').length).toBeGreaterThan(0)
  })

  it('names the budget in the words it was handed', () => {
    render(<TreeDiagram architecture={tree} />)

    expect(screen.getByText(`${tree.nodesLabel}: ${tree.nodes}.`)).toBeDefined()
  })

  it('carries a text alternative that says the whole tree', () => {
    render(<TreeDiagram architecture={tree} />)
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''

    for (const question of tree.questions) expect(label).toContain(question.featureLabel)
    for (const share of tree.otherwise.shares) expect(label).toContain(share.categoryLabel)
  })

  it('grows taller as the budget grows, and draws the smaller tree whole', () => {
    const { unmount } = render(<TreeDiagram architecture={{ ...tree, nodes: 1, questions: tree.questions.slice(0, 1) }} />)
    expect(questions()).toHaveLength(2)
    unmount()

    render(<TreeDiagram architecture={tree} />)
    expect(questions()).toHaveLength(4)
  })
})

describe('one apple’s path drawn over the tree', () => {
  it('marks the questions it answered no to and the one that claimed it', () => {
    const path: TreePath = { answeredNo: [0, 1], claimedBy: 2 }
    render(<TreeDiagram architecture={tree} path={path} />)

    expect(document.querySelector('[data-question="0"]')?.getAttribute('class')).toContain('walked')
    expect(document.querySelector('[data-question="1"]')?.getAttribute('class')).toContain('walked')
    expect(document.querySelector('[data-question="2"]')?.getAttribute('class')).toContain('walked')
  })

  it('marks exactly one leaf as the one the apple came to rest in', () => {
    render(<TreeDiagram architecture={tree} path={{ answeredNo: [0, 1], claimedBy: 2 }} />)

    const resting = screen.getAllByTestId('tree-leaf').filter((leaf) =>
      (leaf.getAttribute('class') ?? '').includes('on-path'),
    )
    expect(resting).toHaveLength(1)
    expect(resting[0]?.querySelector('[data-share="Sound panel"]')).not.toBeNull()
  })

  it('rests an apple no question claimed in the last leaf, and no other', () => {
    render(<TreeDiagram architecture={tree} path={{ answeredNo: [0, 1, 2] }} />)

    const resting = screen.getAllByTestId('tree-leaf').filter((leaf) =>
      (leaf.getAttribute('class') ?? '').includes('on-path'),
    )
    expect(resting).toHaveLength(1)
    // The last one drawn, which is the fallback's.
    expect(resting[0]).toBe(screen.getAllByTestId('tree-leaf')[tree.questions.length])
  })

  it('leaves the tree unmarked when there is no apple to trace', () => {
    render(<TreeDiagram architecture={tree} />)

    expect(document.querySelectorAll('.walked')).toHaveLength(0)
    expect(document.querySelectorAll('.on-path')).toHaveLength(0)
  })

  it('draws the same tree whether an apple is traced through it or not', () => {
    const { unmount } = render(<TreeDiagram architecture={tree} />)
    const bare = questions().length
    const leaves = screen.getAllByTestId('tree-leaf').length
    unmount()

    render(<TreeDiagram architecture={tree} path={{ answeredNo: [0], claimedBy: 1 }} />)
    expect(questions()).toHaveLength(bare)
    expect(screen.getAllByTestId('tree-leaf')).toHaveLength(leaves)
  })
})

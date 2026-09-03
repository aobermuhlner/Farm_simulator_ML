/**
 * Theory behind a help affordance, as the project definition asks for.
 *
 * The copy always comes from the task declaration; nothing explanatory about a
 * task is written into screen code.
 */

import type { ReactNode } from 'react'

export interface HelpDisclosureProps {
  readonly label: string
  readonly children: ReactNode
}

export function HelpDisclosure({ label, children }: HelpDisclosureProps) {
  return (
    <details className="help">
      <summary>{label}</summary>
      <p>{children}</p>
    </details>
  )
}

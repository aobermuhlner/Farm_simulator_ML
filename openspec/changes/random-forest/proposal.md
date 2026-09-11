# STUB — not yet authored

Scaffolded 2026-09-04 from `Game_design.md` §2 (rung 3) and its caution about how the
ceiling is built. Depends on `fitted-tree`. Read §2's paragraph beginning "One caution
about how the ceiling is built" before filling this in — it is the whole reason this
change needs care rather than just a knob.

## Why

Rung 3, and it is there for the pun as much as anything: you own an orchard, and now your
model gets a forest. It makes exactly one point, and the point is worth a rung — more
trees buys accuracy, never a feature you did not measure. The ceiling is the feature set,
not the node count.

It also carries the year the design document builds its pivot around. The forest is the
model that is comfortably good enough on ordinary apples and then meets the heirloom
block, and that is what turns the student from asking *what should I buy* into asking
*what is my model actually doing*.

## What Changes

- A forest family with the number of trees as its knob, and ensembling as the thing it
  demonstrates: accuracy improves, the feature ceiling does not move.
- **State the ceiling correctly.** It is tempting to say the forest cannot *run* on a
  bigger orchard. That fails §1.1 in an awkward direction — a random forest is genuinely
  *cheaper* per image than a convolutional network, and a curious student who later learns
  that will find we had it backwards. The honest version produces the same pressure at the
  same moment: the forest does not stop working, it stops being *good enough*, because the
  same error rate that was harmless starts pushing wormy apples past the co-op's
  tolerance. Same wall, same year, and it is true.
- The knob must show diminishing returns honestly. If more trees kept helping, "ensembling
  does not buy new features" would be a claim the screen contradicts.
- Optional rung: §2 says cut rungs 2–3 first if scope bites. It is worth recording in
  `design.md` what the ladder loses if it goes — chiefly the year that telegraphs the
  pivot, and the cheapest available demonstration that accuracy and expressiveness are
  different things.

## Capabilities

### New Capabilities
- `random-forest`: provisional. The family, its tree-count knob, the diminishing return
  it must exhibit, and the ceiling it must not misattribute.

### Modified Capabilities
<!-- To be determined. Expected none beyond what fitted-tree establishes. -->

## Impact

To be determined. A family declaration, a fitting step or an evaluator alongside
`fitted-tree`'s, catalog entries, and its diagram. Shares whatever `fitted-tree` settles
about artifact-versus-live, and should not settle it differently.

## Note added 2026-09-10

`CLAUDE.md` now carries a prototype-first rule: build the frame before the contents. This
change inherits it. "The knob must show diminishing returns honestly" is a measurement, and
measurements wait until the frame is complete — a forest family with placeholder members is
the version to author first, and the honest diminishing return arrives with the fitting that
`fitted-tree` defers. Read `fitted-tree`'s proposal, including its *Deferred* section, before
filling this in.

Its dependency on `fitted-tree` is unchanged. `decision-tree-builder`, which `fitted-tree`
previously depended on, is withdrawn — the node budget is declared by the tree family itself.

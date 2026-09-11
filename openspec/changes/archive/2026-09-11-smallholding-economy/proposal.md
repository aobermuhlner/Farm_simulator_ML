# Smallholding economy

## Why

The farm opens rich and fully equipped. Two thousand francs, a hundred trees, six thousand
apples, and the convolutional network already owned — none of it earned, and all of it handed
over before the student has sorted a single apple. The one loop that exists to teach what the
robot's job actually *is* pays out over sixty of those six thousand apples and leaves five
thousand nine hundred and forty on the ground. Hand sorting is not the ladder's first rung
today; it is a seventeen-franc formality performed once, beside a model that was a gift.

Two consequences follow, and both are teaching failures. The black box is free while the
readable model costs six hundred, so the first thing the game says about machine learning is
that comprehensibility is the expensive option. And because the crop is a hundred and twenty
times what one person is allowed to sort, the throughput argument for automating — the whole
point of sorting by hand — never arrives as a number the student produced themselves.

This change rebuilds the opening. One tree, five apples, no money, no model. Every capability
on the farm becomes something bought with apples the student sorted, and the purchase that
ends the clicking is the model they can read from end to end.

## What Changes

**The opening** — **BREAKING** for every saved farm and every fixture carrying the old figures.

- The farm opens at a balance of zero, holding one tree bearing five apples.
- The catalog declares that a new farm owns nothing. The convolutional eye stops being a gift
  and goes on sale at 10 000.
- The sorting tree drops from 600 to 100 and becomes the farm's declared automation, so the
  hand-sort summary states its price against the wage the student just earned.

**The orchard ladder.** One repeatable `+100 trees` at 1 000 is replaced by a progression of
five rungs — `+4`, `+5`, `+10`, `+30`, `+50`, then `+100` three times — so the orchard reads
1 → 5 → 10 → 20 → 50 → 100 → 200 → 300 → 400. Every rung is a separately declared item, which
keeps `progression-catalog`'s rule that money is the only key to a purchase: nothing is gated
on owning a previous rung, the prices simply ascend. The ladder terminates at 400 trees, so
the land the orchard *could* reach stays a real figure on screen.

**What apples pay.** The payoff table triples (a ripe red delivered red goes 0.40 → 1.20) and
the downgraded delivery price goes 0.05 → 0.15. Perfect play moves from 0.29 to 0.87 a
piece. Without this the 10 000 eye needs an orchard of roughly 1 200 trees to be reachable,
and the ladder would have no end to show.

**Stop and sell** — **BREAKING** for the task declaration.

- `handSorting.perHarvest` is removed. Nothing declares how many apples one person may sort.
- The crop presented for hand sorting is the whole crop, bounded only by how many distinct
  photographs the evaluation split holds.
- At any point after the first decision the student may deliver what they have sorted and
  discard the rest. The wage is what it always was — the payoff sum over the apples actually
  decided — so the arithmetic does not change; only who draws the line does.
- Before delivering, the screen states how many apples would be left, roughly what the orchard
  bears on them, how long the rest would take at the student's own measured pace, and what the
  automation costs. That is the throughput argument, in the student's own numbers.

**A crop too small to express its shares.** One tree bears five apples, and five apples cannot
be 55/35/10. The existing allocation forces every declared category to appear at least once, so
the opening crop is 2 red / 2 green / 1 wormy every year and the declared composition is not
what was drawn. This is kept — five apples containing all three kinds is the right first
lesson — but it is written down, and no screen may present the declared composition as the
crop it drew.

**Rebased prices.** Two more tree questions 400 → 150; two more again 700 → 400.

## Capabilities

### New Capabilities

None. Every behaviour this change moves already has a spec that owns it.

### Modified Capabilities

- `manual-sorting`: the declared cap on what one person may sort is removed and replaced by a
  boundary the student draws; delivering early is specified, including what the figures shown
  beside that choice may and may not reveal about apples not yet decided.
- `harvest-run`: what a crop does when it is too small to express its declared composition, and
  what may then be claimed about it.
- `orchard-scale`: the argument that hand sorting plateaus is re-grounded. It no longer rests on
  a declared cap that makes the wage refuse to move; it rests on the evaluation split running
  out of distinct photographs, which caps hand sorting at a thousand apples however patient the
  student is.

## Impact

- **Declarations.** `declarations/farm.json` (opening balance, orchard, `automation`),
  `declarations/apple-harvest.json` (payoffs, delivery, `handSorting`),
  `declarations/catalog.json` (`ownedAtStart`, five expansion rungs, the eye and tree prices,
  the rebased node upgrades, and the shop copy that currently says the eye came with the robot).
- **Validation.** `src/task/validate.ts` stops requiring `handSorting.perHarvest`.
  `src/economy/declaration.ts` already admits a zero opening balance.
- **Engine.** `src/sorting/crop.ts` no longer clamps the presented crop to a declared number.
  `src/sorting/tally.ts` gains the remainder figures the deliver-now choice is made against.
- **Screens.** `web/src/screens/HandSort.tsx` gains the deliver control and its summary panel.
- **Fixtures and tests.** Every test carrying 2 000 / 100 trees / 60 apples / 60-per-harvest or
  a payoff figure. This is the bulk of the work and it is mechanical.
- **Not in scope.** The bank advance from the design document's anti-grind rule 3; any change to
  which model families exist or what they predict; any re-fitting or re-shaping of artifacts.

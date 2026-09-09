## Why

The market sells nothing. Every item in `declarations/catalog.json` carries a
`notForSaleReason`, the `orchard` group is declared and empty, and a farm that opens with
2 000 CHF has no way to spend a franc of it. There is a ledger, a year counter, a balance
and a report with money in it, and no reason to look at any of them twice.

`harvest-scoring` cut the socket for the fix and left it unwired. `Farm.cropSize` is
already state rather than a declared constant, already saved, already what the crop is
drawn to, and its own comment says why: *"the crop grows as the land does. It opens at the
declared figure and whatever comes to sell more land moves it; nothing here knows what such
a purchase looks like, only that the number can change."* Nothing moves it. This change is
the thing that moves it.

What that buys is the first working half of §4.3, the truest sentence in the design
document: **the cost of a model's errors scales with how widely you deploy it.** Six
thousand apples at 9 % wrong is pocket change. Thirty-six thousand at 9 % wrong is the same
9 %, six times the money, and a number in the "wrongly crated" column that a student can
feel. Growth is also the one purchase that pays for itself in the year it is made, so the
student is never punished for it — it just quietly raises the bar the model has to clear.

## What Changes

- **The farm declares an orchard instead of a crop size.** `openingCrop: 6000` becomes
  `orchard: { label, unit, opening, piecesPerUnit }` — 100 trees bearing 60 apples each.
  The crop the land bears is derived from the orchard rather than declared beside it, so
  the two cannot disagree. **BREAKING** for `declarations/farm.json`; no saved farm
  predates it.

- **One repeatable catalog item grows the orchard.** `+100 trees` at 1 000 CHF, buyable
  five times, to 600 trees and 36 000 apples. The catalog gains a second unlock kind — one
  that grows the farm rather than opening a knob — and a declared repeat limit. Ownership
  becomes a multiset: the same id may appear in the owned list more than once, which is
  what `buyItem`'s "the owned list is only ever appended to" already promised and what
  keeps the saved shape unchanged. An item declaring no limit is bought once, exactly as
  every item is today.

- **The price is 1 000, not §4.5's 1 200, and the reason is measured.** At 6 000 apples the
  three shipped configurations earn 1 215 / 1 207 / 1 250 CHF in the wettest declared year
  (`test/delivery-guards.test.ts`). Against 1 200 the weakest model pays an expansion back
  with 7 CHF to spare — technically inside anti-grind rule 1 and nowhere near it in feel,
  and a fragile thing to assert in a test. At 1 000 the worst case returns 1.21× within the
  year and the best 1.47×. §4.5's figures were authored against a hand-sorting income of
  ~1 450 a year that the shipped 60-apple cap does not produce; measurement wins.

- **Nothing bars expansion but money.** §4.5 wants trees gated on owning the robot, and
  `progression-catalog`'s *"money is the only key to a purchase"* forbids gating one item on
  another. This change does not make the exception, for two reasons. No change in the
  sequence ships the robot — `farm.automation` is a cosmetic pointer read only by
  `HandSort.tsx`, and nothing in the engine requires it to put a model to work — so the
  gate would name an item that does not exist. And the gate is already redundant: hand
  sorting reaches 60 apples and *"growing past what one person can sort does not raise the
  wage"*, so a student who expands before automating watches the crop double, the wage stay
  at ~14 CHF, and the count of apples left on the ground go from 5 940 to 11 940 — stated
  on screen, because `manual-sorting` already requires it. Anti-grind rule 2 is enforced by
  arithmetic the student can read rather than by a barred button. When the robot lands and
  is priced, whether to add the bar is one field in the catalog.

- **Growth multiplies the money and not the rates, and no screen may imply otherwise.**
  §4.3 is the section most easily got backwards, and getting it backwards hands a student a
  false claim: *more data breaks a model.* It does not. 9 % of 6 000 is 9 % of 36 000, so a
  percentage rule like the delivery tolerance is not breached by growth alone — what breaks
  a model is the crop *changing*, which is `heirloom-cultivars`. The report already carries
  the pair that shows this honestly: the measured share of the delivery, which growth
  leaves where it was, beside the money, which growth multiplies. This change requires that
  nothing anywhere presents growth as changing a rate, an error, an accuracy or a risk.

- **Growth takes effect on the next crop brought in.** Mirroring `farm-labour`'s rule for
  putting a model to work: expanding does not re-draw a crop already brought in inside an
  open year, and does not touch a closed one.

- **The orchard is shown in the persistent bar as a supplied summary fact** — "Orchard:
  300 / 600 trees", from the farm's declared label and unit. `simulator-shell` already
  specifies that row generically and no change has supplied a fact to it yet, so this needs
  no shell modification. §5.2's orchard *card* on the overview is deliberately deferred: the
  market is already the farm's buying stage, and a second purchase path on the overview
  would duplicate it before there are three cards to justify one.

Out of scope, deliberately: the picking robot and its price; per-block orchards, so that
`heirloom-cultivars` restructures `Farm.cropSize` into per-block state when it needs to
rather than this change guessing the shape; the bank advance that anti-grind rule 3 asks
for; and §10.7, which the stub assigned here — the Year 3 step down belongs to
`decision-tree-builder`, the change that ships the hand-built tree. This change supplies
the answer to it (*you bought scale, not accuracy — and the next year proves it*) without
owning the question.

Also honest about a claim the stub made that measurement does not support: **expansion
pays back within the year only while the delivery is accepted.** Under a downgrade,
delivered apples pay 0.05 each, so +6 000 apples returns ~270 CHF against a price of 1 000
— a four-year payback, arriving exactly in §4.6's Year 8. The specs and the copy therefore
say that growth multiplies whatever the harvest earns, including a bad harvest, rather than
that growth always pays. No new screen behaviour; the qualification is in the wording.

## Capabilities

### New Capabilities
- `orchard-scale`: the orchard as owned, purchasable state — how it is declared, how the
  crop the land bears follows it, when growth takes effect, and what the game may and may
  not claim about scale.

### Modified Capabilities
- `harvest-run`: *The crop's size follows the orchard* opens at the size the declared
  *orchard bears* rather than at a size the farm declares. This is the only spec sentence
  anywhere that mentioned a declared crop size, and it is one clause; the rest of the
  requirement was written for this change and needs no word altered.
- `progression-catalog`: *A purchase moves money once and cannot be undone* — buying what
  is owned is refused only past a declared repeat limit, and what a purchase opens is given
  on every purchase. *Money is the only key to a purchase* — a repeatable item shows how
  many it has given and how many remain, and one bought to its limit offers nothing further
  without being called unaffordable. *The catalog is checked against what it claims to
  open* admits a kind that grows the farm, whose integrity check is a whole amount of land
  and which accumulates rather than colliding.
- `game-save`: the land held is progress and is recorded; the crop size is derived and is
  not. An owned id may be recorded more than once, and a count the catalog no longer permits
  is trimmed — without taking back the land those purchases gave — in the shape a dropped
  reference already takes.

Not modified, against the stub's expectation: `game-economy`, which turns out to say
nothing about the crop at all — its declaration requirement covers the currency, the
precision, the opening balance and the opening year, and the orchard's own declaration and
refusals live wholly in the new capability. And `simulator-shell`, whose persistent bar
already specifies a generic row of supplied summary facts that no change has used yet.

## Impact

`declarations/farm.json` replaces `openingCrop` with `orchard`, and `declarations/catalog.json`
gains its first priced item. `src/economy/declaration.ts` validates the orchard and the
`yearVariation` crowd-out check measures against the derived opening crop instead of the
declared one; `src/economy/farm.ts` derives `cropSize` at `openFarm` and grows it;
`src/progression/catalog.ts` gains the unlock kind and the repeat limit with their load
checks; `src/progression/purchase.ts` counts occurrences instead of testing membership and
applies the growth; `src/progression/market.ts` reports how many of a repeatable item are
held; `src/save/index.ts` stops deduplicating the owned list and trims an over-count.
`web/src/App.tsx` supplies the bar's first summary fact and applies a purchase's growth to
the farm. Every fixture that builds a farm declaration moves, and the earnings figures in
`test/delivery-guards.test.ts` gain a scaling assertion. No pool change, no retraining, no
new prediction artifact: the crop draw already tiles the evaluation split and discloses
that it does.

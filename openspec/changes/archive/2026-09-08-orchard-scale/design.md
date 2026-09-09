## Context

See `proposal.md` — Why. The ground this lands on:

- `Farm.cropSize` is already state, already saved, already what `drawCrop` reads
  (`src/sorting/crop.ts:205`). Nothing moves it.
- The farm declares `openingCrop: 6000` as a bare figure. The only spec sentence anywhere
  that mentions it is one clause of `harvest-run`'s *The crop's size follows the orchard*.
- `owned` is `readonly string[]` throughout, and every consumer asks membership:
  `availability.ts:78`, `market.ts:45`, `locked.ts`. The save codec at `save/index.ts:651`
  deduplicates it on restore.
- `buyItem` already returns the farm as well as the ownership, so it is already the one
  place a purchase's effect on the farm can land.
- `UNLOCK_KINDS = ['knob-values']`, and the catalog's docblock already names trees as one of
  the five nouns it was written to avoid five gating systems for.
- The persistent bar already specifies a generic row of supplied `{ label, value }` facts,
  and `FarmBar.tsx` says of it: *"the changes that have facts supply them."* None has yet.
- Measured acceptance figures for the shipped configurations exist, at 6 000 apples, in
  `test/delivery-guards.test.ts:301-323`.

## Goals / Non-Goals

**Goals:**

- One number moves, by one mechanism, from one place.
- Growth's effect on money is exact and its effect on every rate is nil, provably.
- Nothing that reads `owned` today changes meaning.
- The declaration gains a shape a farm measured in something other than trees can use.

**Non-Goals:**

- Per-block orchards. `heirloom-cultivars` wants land with its own per-apple value; guessing
  that shape now costs more than restructuring one number later.
- Any change to how a crop is drawn, tiled, or disclosed. Growth only changes the size
  handed to `drawCrop`.
- Reconciling §4.5's full price list. Only the price of land is set here, and it is set from
  measurement rather than from the table.

## Decisions

### 1. `Farm.land` is the state and the crop size is a function, not a field

`Farm.cropSize: number` becomes `Farm.land: number` — units of land held — plus
`cropSize(farm)` in `src/economy/farm.ts`, returning `land × declaration.orchard.piecesPerUnit`.

*Alternative considered:* keep `cropSize` as a field and recompute it on every change. Rejected
for the reason the declaration itself refuses a crop size beside an orchard: two fields that
must agree, with nothing able to say which is right when a code path updates one. Making it a
function makes disagreement unrepresentable.

`SavedHarvest.cropSize` stays exactly as it is. A closed year's figures are its own — *"nothing
is re-derived from the current state of the farm"* — so a harvest record keeps the size it
closed with while the farm keeps only its land.

`drawCrop`'s guard on an unusable size is kept and its code path is untouched: the product of a
corrupt `land` and the declared yield is not a whole number of one or more either, so the
existing refusal fires with the size it found, exactly as `harvest-run` requires.

### 2. `owned` becomes a multiset, not a map of counts

An id may appear in `owned` more than once. The type `readonly string[]` does not change, the
saved shape does not change, and `owned.includes(id)` keeps its meaning everywhere it is
already written — availability, locked-value checks, market state. `purchase.ts`'s promise
that *"the owned list is only ever appended to"* becomes literally rather than incidentally
true.

*Alternative considered:* `Record<string, number>`, which is what the shape looks like from
outside. It is the same behaviour at four times the blast radius: every `includes` call site,
the save schema, the market view, App state and their fixtures. The multiset is the same
contract with one changed line in the codec and one changed predicate in `buyItem`.

Two consequences to implement deliberately. `save/index.ts:651` currently reads
`if (!owned.includes(id)) owned.push(id)` — the dedupe has to go, replaced by a per-id count
clamped to the catalog's declared limit, which is where `game-save`'s trimming requirement is
satisfied. And `buyItem`'s `ALREADY_OWNED` becomes a count test against the limit, defaulting
to 1 when no limit is declared, so every existing item behaves precisely as it does today.

### 3. There is no declared ceiling; the catalog's repeat limit is the ceiling

The farm declares `orchard: { label, unit, opening, piecesPerUnit }` and nothing about a
maximum. The largest orchard reachable is derived: `opening + Σ (repeat × units)` over the
**priced** items that grow the farm.

*Alternative considered:* declare `maxUnits: 600` on the farm and validate the catalog against
it. Rejected as decision 1 was — a declared ceiling and a repeat limit are two statements of
one fact, and the load-time check that they agree is a check that only exists because they can
disagree. Deriving it removes the failure mode instead of reporting it.

Unpriced growth items are excluded because nothing can buy them, which is the same reading
`progression-catalog` already gives an unpriced item. A farm with no catalog has no derived
maximum, and the spec says the land held is then shown alone rather than against a limit
invented for it.

### 4. The price is 1 000, and §4.5's 1 200 is the figure being overridden

Read from the acceptance figures asserted at 6 000 apples, and proportional in the orchard, so
`+100 trees` adds the same again:

```
                       mildest year   median   wettest year
  channels8                  1 476     1 333          1 215
  channels16                 1 465     1 325          1 207
  channels32                 1 495     1 360          1 250

  return within the year on an expansion priced at
      1 200   ->   1.23x         1.10x          1.006x   <- 7 CHF of margin
      1 000   ->   1.47x         1.33x          1.21x
```

At 1 200 the weakest shipped configuration pays an expansion back in the wettest declared year
with 7 CHF to spare. That satisfies anti-grind rule 1 on paper and satisfies nothing in feel,
and asserting it in a test spends the entire margin on the first retune of a payoff. At 1 000
the worst case returns a fifth over its price inside the year it was bought, and the assertion
has room to survive the next model that is trained.

§4.5's figures were authored against a hand-sorting income of ~1 450 a year. The shipped
60-apple cap produces ~14. The table is illustrative by its own admission; the measurement is
not.

**What that price does to the arc, stated rather than discovered.** Opening at 2 000 CHF and
100 trees, a student can buy two expansions before running anything, and reach 600 trees in
two harvests. The orchard therefore fills up fast — because it is the only thing for sale.
That is the interim this change ships into, not a pacing claim: the robot, the datasets, the
node budget and the model families are all still unpriced, and §11's acceptance playthrough is
what re-tunes the curve once they are not. The alternative — pricing land high enough to pace
the game on its own — would break the payback claim that is the whole point of it.

### 5. Growth is applied inside `buyItem`, so no screen learns what growth is

`buyItem` already debits the farm and returns it. It gains one step: for each unlock of the
land kind on the item bought, return a farm with `land` increased by that many units. App code
stores the returned farm and the returned ownership as it already does, and never branches on
an unlock kind.

This also settles *growth takes effect on the next crop brought in* without a mechanism for it.
The crop is drawn when a task's crop is brought in, from the farm as it stands; crops already
brought in inside the open year are recorded with their own figures and are not re-derived; a
closed year's record is immutable. Buying land and then running the year pays that year, which
is what makes "growing pays, immediately" true rather than aspirational.

### 6. Proportionality is asserted at a whole multiple, and it is exact in the counts but not in the money

The spec's *doubling the orchard doubles the money* is tested by holding the farm's seed and
year — so the drawn shares are identical — and scaling the land by a whole factor. Each
category's count is then that factor times the count at the smaller size, up to the rounding of
one drawn share to whole pieces. That part is exact, and measured: red goes 3 268 → 6 536 →
9 805 → 19 609 across factors of 1, 2, 3 and 6, every figure within one piece of the multiple.

The money is not exact, and the reason is `deal` (`src/sorting/crop.ts:182`). A category is
filled with `floor(wanted / held)` whole passes over the split plus a *random subset* of size
`wanted % held`. Since `floor(2w/h)` is not `2·floor(w/h)`, a crop of twice the size is not two
copies of the smaller crop: at 6 000 pieces red is six full passes plus 268 of a seventh
shuffle, and at 12 000 it is thirteen full passes plus 36 of a fourteenth. Same count, different
mix of individual pictures — and a different mix scores differently. Measured across the three
shipped configurations at factors of 2, 3 and 6, the money lands **0.12 % to 0.26 % below** the
exact multiple, always below, because the larger crop's mix regresses towards the pool mean
while the opening crop's partial pass happens to be a favourable subset. The measured share of
the delivery term moves by at most 0.67 % of itself, 0.0724 → 0.0729.

*Alternative considered:* redefining the deal so a larger crop is a scaled copy of a smaller
one. Rejected twice over. It is arithmetically unreachable while a crop is a whole multiset
over a finite split — only a `wanted` that is a multiple of `held` scales exactly — and
changing how a crop is dealt is a stated non-goal that would move every earnings figure in the
repository, including the acceptance table this change's price was read from.

So the claim is stated as what it is: proportional to a fraction of a percent, with the
fraction recorded in the test. 0.26 % against the ~9 % that separates the configurations is two
orders of magnitude, so nothing a student could read is affected — but a reader of the spec is
owed the true statement rather than a tidier one.

This is also why the requirement is phrased over *the same year of the same farm* rather than
over two years. Across years the composition moves, and the earnings move ~76 CHF per percentage
point of worm share — nine times the lever the configurations are. A proportionality claim
tested across years would be measuring the weather.

### 7. The orchard goes in the bar, not on a new overview card

One supplied summary fact: `{ label: orchard.label, value: "300 / 600 trees" }`, or
`"300 trees"` where no catalog gives a maximum. Both words come from the declaration, so the
`no-task-specific-code` guard holds and a farm measured in hectares renders unchanged.

§5.2's orchard card with its own `[upgrade 1200]` button is deferred. The market is already
specified as *the* farm stage for spending money, and a second purchase path would be a second
place for the price and the limit to be rendered — and to disagree. The card earns its place
when there are three of them, which is `heirloom-cultivars`.

### 8. The robot gate is declined, not deferred-by-omission

`progression-catalog`'s *money is the only key* is restated in the delta with its claim intact,
and the new capability states positively that no other item's ownership bars expansion. This is
a decision with a stated reason, so a later reader does not find a missing gate and assume an
oversight: the robot does not exist to gate on, and `manual-sorting` already bounds the wage
and states the count left unbrought, so the arithmetic teaches anti-grind rule 2 without a
barred control. Adding the bar later is one declared field.

## Risks / Trade-offs

- **A 36 000-piece crop is materialised as objects, and hand sorting materialises it to show
  60.** → Measure rather than restructure. `drawCrop` allocates one entry per piece; at the
  largest reachable orchard that is 36 000 small objects and one pass to score them, which is
  a few megabytes and a few milliseconds. A test asserts the draw at the maximum orchard
  completes inside a fixed budget, so the day a larger orchard or a second block makes this
  false, it fails loudly rather than slowly.

- **The report's absolute counts grow while its rates do not, and a student could read the
  bigger number as a worse model.** → This is the exact §4.3 inversion the change exists to
  prevent, and it is handled by the pair already on the report: the delivery's measured share
  sits beside the money, and the crop's size and per-category shares are stated. The spec
  forbids presenting growth as a change in error, accuracy, risk or variance anywhere. It is
  the one line of this change worth reviewing copy for by hand.

- **A student can spend to a zero balance on land while hand-sorting, and hand sorting pays
  ~14 CHF.** → Not a soft-lock, and worth confirming rather than assuming: putting a model to
  work costs nothing and is available from the first year, so the way out is always open and
  free. The specs make no promise that spending is well-advised, only that it is never barred
  and never punished with a failure state. Anti-grind rule 3's bank advance stays unbuilt and
  unneeded.

- **Lowering a repeat limit later leaves farms holding land they could not now buy.** →
  Deliberate, spec'd, and the honest reading of "there is no way to sell, refund or return".
  Land is recorded as land, not as a tally of purchases, so trimming the tally cannot take the
  land back.

- **`owned` as a multiset is a shape change that no type flags.** → The compiler will not catch
  a consumer that assumed uniqueness. The three that exist all ask membership and are
  unaffected; the mitigation is a test that a farm owning a repeatable item twice reports
  identical availability to one owning it once, so a future consumer that starts counting has
  something to break.

## Migration Plan

No saved farm can be affected, and this is provable rather than assumed: nothing has ever sold
land, so no save records any. A save carrying `cropSize` and no `land` therefore opens at the
declared opening land, losing nothing, which is what `game-save`'s new scenario specifies. The
saved `cropSize` field is simply no longer read.

The declaration edits land with the validator that accepts them, in one commit, so no
intermediate state has a `farm.json` the build refuses. Rollback is reverting `farm.json`,
`catalog.json`, and the `land`-for-`cropSize` rename; the unlock kind and the repeat limit are
additive and inert without a declaration that uses them.

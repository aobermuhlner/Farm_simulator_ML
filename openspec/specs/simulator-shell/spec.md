## Purpose

Defines the screens a student moves through — the farm overview, a task's workshop, the
labour that brings a crop in, and the report of a year that closed — and requires that
each is derived from task declarations rather than written per task, so that the task
contract's promise holds in front of a student and not only in tests.

## Requirements

### Requirement: The workshop is where a model is made, and the year is run from the overview

The shell SHALL present a task as a workshop: the task's declared knobs, whatever it
declares to browse, and the making of a model from them. Running the year SHALL NOT be
reachable from the workshop. A student SHALL be able to return from the workshop to the
overview and enter it again without losing the knob values they left there.

The workshop SHALL be enterable and re-enterable as often as a student likes, and every
stage of it SHALL be reachable without a task's crop having been brought in.

#### Scenario: The workshop is reached from the overview and left again
- **WHEN** a student opens a task from the overview and then leaves it
- **THEN** the task's knobs and its declared teaching copy were presented
- **AND** the overview is shown again on leaving

#### Scenario: The year cannot be run from the workshop
- **WHEN** a student is in a task's workshop with a model made
- **THEN** no control there runs the year or brings in a crop
- **AND** no earnings figure and no report of a harvest is shown there

#### Scenario: Knob values survive leaving and returning
- **WHEN** a student changes a knob, returns to the overview, and opens the same task again
- **THEN** the knobs hold the values they were left at

#### Scenario: A configuration can be revised and a model made again
- **WHEN** a student changes a knob after making a model
- **THEN** that model is no longer presented as the model of the current knob values
- **AND** a model can be made again for the new values

### Requirement: The workshop moves no money

No stage of the workshop SHALL credit or debit the balance, append a record for a year, or
advance the year, with one exception: a purchase made at the upgrade bench, which is a
purchase like any other and debits like any other. Entering the workshop, browsing what a
task declares, making a model any number of times, sitting a tutorial any number of times,
putting a model to work, and entering the bench to read what it sells SHALL all leave the
balance and the year exactly as they were.

Hypotheses have to be cheap or they will not be formed. A workshop that charged for a model
would teach a student to guess once rather than to look, and a tutorial that charged for an
attempt would teach them to guess at the puzzle rather than read it. Buying capacity is not
an attempt at anything: it is the deliberate, confirmed, irreversible act
`progression-catalog` specifies, and it is put beside the knobs because that is where its
price can be read against what it moves. What must stay free is trying things; what is paid
for is having more things to try.

No stage of the workshop SHALL advance the year, and the bench SHALL NOT be an exception to
that.

#### Scenario: Making a model costs nothing

- **WHEN** a student makes a model in the workshop any number of times
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Putting a model to work costs nothing

- **WHEN** a student puts a model to work and hands the job back again
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Sitting a tutorial costs nothing

- **WHEN** a student opens a tutorial and attempts it any number of times, passing or failing
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: Reading the bench costs nothing

- **WHEN** a student enters the bench, reads what it sells and leaves without confirming a purchase
- **THEN** the balance is unchanged
- **AND** the year is unchanged and no record is appended

#### Scenario: A purchase at the bench is the one thing that moves money

- **WHEN** a purchase is confirmed at the bench
- **THEN** the balance falls by exactly that price and one debit is recorded with the item as its reason
- **AND** the year is unchanged

### Requirement: Every playable task carries a labour slot

The overview SHALL present, for each task it offers as playable, a slot stating what
brings that task's crop in. The slot SHALL hold either the farm's manual labour or one
model that has been put to work for that task. A slot that has never been filled SHALL
state the manual labour rather than being empty, absent, or presented as a setting the
student still has to make.

A task the shell presents as announced rather than playable SHALL carry no slot.

The slot SHALL be readable from the overview without entering the task.

#### Scenario: A farm that has bought nothing still states its labour
- **WHEN** a farm that has put no model to work is shown on the overview
- **THEN** every playable task's slot states the farm's manual labour
- **AND** no slot is shown as empty or as unset

#### Scenario: A task at work by a model states that instead
- **WHEN** a model has been put to work for a task
- **THEN** that task's slot states that model rather than the manual labour
- **AND** the slots of other tasks are unchanged

#### Scenario: An announced task has no slot
- **WHEN** the overview presents a task as announced rather than playable
- **THEN** that task carries no labour slot

### Requirement: What fills a labour slot is presented from declarations

The slot SHALL present what fills it using an icon and a label taken from declared data,
and SHALL identify neither by anything written into screen code. The manual labour's icon
and label SHALL be read from the farm's declaration, because manual labour is the absence
of a model rather than a model and no model's declaration can supply them. A model's icon
and label SHALL be read from what declares that model.

WHEN a slot's icon or label is not declared, the slot SHALL still state what fills it
rather than being shown as empty.

#### Scenario: The manual labour is named by the farm, not by the screen
- **WHEN** a farm declaring its manual labour's icon and label is opened
- **THEN** the slot presents both of them
- **AND** neither is written into screen code

#### Scenario: A differently declared farm renders through the same slot
- **WHEN** a farm declaring a different icon and a different label for its manual labour is opened
- **THEN** the slot presents those instead
- **AND** no screen code is added or changed for it

### Requirement: A model is put to work from the workshop, and can be handed back

The workshop SHALL offer, beside the making of a model, a control that puts the model just
made to work for that task. That control SHALL be offered only once that model's making has
completed, so that a configuration cannot be put to work without its training having been
presented. Putting a model to work SHALL fill that task's labour slot and SHALL be
reflected on the overview.

WHEN the selected family declares a tutorial that has not been completed, that control
SHALL NOT be offered however complete the model's making is, and what withholds it SHALL be
stated as that tutorial to sit. That statement SHALL name the tutorial and SHALL offer the
way to it, and SHALL NOT be presented as an error, as a thing to buy, or as a configuration
that cannot be run. Completing the tutorial SHALL make the control available without the
model having to be made again.

A task whose slot holds a model SHALL be able to have the job handed back to the farm's
manual labour. Putting a model to work and handing the job back SHALL both be reversible
and SHALL take effect from the next crop brought in, never retroactively over a year
already closed. Handing a job back SHALL never be withheld by a tutorial, so that a
tutorial can never leave a task stuck with a model on it.

What a student is working on in the workshop SHALL NOT change what is at work. Changing
knob values, browsing declared data, sitting a tutorial, or making a different model SHALL
leave the labour slot as it was until the student puts something to work.

#### Scenario: A model cannot be put to work before it is made

- **WHEN** a student is in the workshop with no model made for the current knob values
- **THEN** no control puts a model to work

#### Scenario: Putting a model to work fills the slot

- **WHEN** a student puts a made model to work and returns to the overview
- **THEN** that task's slot states that model

#### Scenario: The job can be handed back

- **WHEN** a student hands a task's job back from a model at work
- **THEN** that task's slot states the farm's manual labour again

#### Scenario: Tinkering does not change what is at work

- **WHEN** a student changes knob values and makes a different model without putting it to work
- **THEN** the task's labour slot states what it stated before
- **AND** the overview shows no change to what is at work

#### Scenario: An unfinished tutorial withholds the control and says so

- **WHEN** a model is made for a family whose declared tutorial is incomplete
- **THEN** no control puts it to work
- **AND** the tutorial to sit is named and the way to it is offered

#### Scenario: Completing the tutorial offers the control without remaking the model

- **WHEN** the tutorial is completed with a model already made
- **THEN** the control that puts that model to work is offered
- **AND** the model does not have to be made again

#### Scenario: A tutorial never traps a model on a task

- **WHEN** a task worked by a model has that family's tutorial made incomplete
- **THEN** handing the job back to the farm's manual labour is still offered


### Requirement: Running the year is one act, reached from the overview

The overview SHALL offer one control that runs the year for the whole farm, naming the
year it will run. It SHALL be confirmed before it runs. Running the year SHALL bring in
each playable task's crop by whatever that task's labour slot holds: a task at work by a
model SHALL be brought in without the student deciding anything further, and a task whose
slot holds the manual labour SHALL require that labour to be performed.

The control SHALL NOT be conditional on any model having been put to work, because a
labour slot is never empty and every playable task therefore always has labour.

A year already closed SHALL NOT be run again.

#### Scenario: The year is run from the overview
- **WHEN** a student runs the year from the overview and confirms it
- **THEN** the year named on the control is the year that is run

#### Scenario: A farm that has put no model to work can still run its year
- **WHEN** a farm whose every slot holds the manual labour runs its year
- **THEN** the control was available and named no reason it could not be used

#### Scenario: A model at work needs no further decisions
- **WHEN** the year is run for a task whose slot holds a model
- **THEN** that task's crop is brought in without the student deciding anything for it

#### Scenario: Manual labour must be performed
- **WHEN** the year is run for a task whose slot holds the manual labour
- **THEN** that labour is presented to be performed
- **AND** that task's crop is not brought in until it has been

#### Scenario: A closed year is not run twice
- **WHEN** a year has been closed
- **THEN** running the year names the following year, and the closed one cannot be run again

### Requirement: A year in progress states what is outstanding

WHEN the year has been run but not every playable task's crop has been brought in, the
overview SHALL state which tasks are still outstanding. It SHALL NOT present the year as
closed, SHALL NOT show a balance changed by the crops already brought in, and SHALL NOT
offer to run the year again.

WHEN a task at work by a model cannot be brought in — its configuration cannot be fetched
or resolved — the refusal SHALL be presented with the cause the engine named, the year
SHALL stay open, and that task SHALL NOT be brought in by the manual labour in its place.

#### Scenario: An outstanding task is named
- **WHEN** the year has been run and one task's manual labour has not been performed
- **THEN** the overview states that that task is still outstanding
- **AND** the year is not presented as closed

#### Scenario: A year in progress cannot be run again
- **WHEN** the year has been run and a task is still outstanding
- **THEN** no control runs the year again

#### Scenario: A task that cannot be brought in leaves the year open
- **WHEN** a task at work by a model has a configuration that cannot be fetched
- **THEN** the refusal is shown with the cause that was reported
- **AND** the year stays open and no other labour is substituted for that task

### Requirement: A task offers the report of the year it closed

WHEN a year has closed, the overview SHALL offer, for each playable task, the report of
what that task's crop did in that year. The report SHALL be reached from that task rather
than from the workshop, and entering it SHALL neither run anything nor change what is at
work.

The report offered SHALL be the one for the most recently closed year, and SHALL state
which year that is. A farm that has closed no year SHALL offer no report rather than an
empty one.

#### Scenario: A closed year's report is reached from its task
- **WHEN** a year has closed and a student opens a task's report from the overview
- **THEN** that task's report for the closed year is shown, naming the year
- **AND** nothing was run and no labour slot changed

#### Scenario: A farm with no closed year offers no report
- **WHEN** no year has yet closed
- **THEN** no task offers a report

### Requirement: The market is a stage of the farm, not of a task

The shell SHALL present a market, reachable from the farm overview without a task being
selected and leavable back to it. The market SHALL be rendered from the declared catalog
alone: each item under its declared group with its declared label, its shop copy, and its
price where it has one, together with which of owned, buyable now, not yet affordable, or
not for sale it currently is.

Groups SHALL be gathered into sections by the part of the farm they belong to. A group that
names a task SHALL be shown under a heading that is that task's own declared title; groups
naming no task SHALL be shown under the farm rather than under any one part of it, after the
parts. Sections SHALL appear in the order their first group is declared and groups within a
section in the order they are declared, so that the order of the shelves stays one fact in
one place. No section heading and no group heading SHALL be written into the screen: a task's
heading is its declared title, and a second task's shelf SHALL appear with no screen change.

A group with no items SHALL NOT be shown as an empty section, and a section whose groups all
have no items SHALL NOT be shown at all. Items sold at the workshop's upgrade bench SHALL
NOT be shown in the market.

The balance SHALL be readable from the market as it is from every other screen, and a
purchase SHALL be reflected in the balance and in that item's state without leaving the
market. WHEN the catalog cannot be loaded, the market SHALL NOT be shown and the refusal
SHALL be presented with its cause instead.

#### Scenario: The market is reached from the overview and left again
- **WHEN** a student opens the market from the farm overview and then leaves it
- **THEN** the market is shown without any task having been selected
- **AND** the overview is shown again on leaving

#### Scenario: Items render under their declared groups, in declared order
- **WHEN** the catalog declares two groups with items in each
- **THEN** both groups are shown in the order declared, each with its own items
- **AND** no group name or item name is written into the screen

#### Scenario: A group belonging to a task is shown under that task's title
- **WHEN** a group names a task
- **THEN** its items are shown under a heading that is that task's declared title

#### Scenario: A group belonging to no task is shown under the farm
- **WHEN** a group names no task
- **THEN** its items are shown under the farm rather than under a part of it
- **AND** that section comes after the sections belonging to parts of the farm

#### Scenario: A second task's shelf needs no screen change
- **WHEN** a catalog declares a group naming a task the shell has never presented
- **THEN** that task's section is shown with its declared title and that group's items
- **AND** no screen code is added or changed for it

#### Scenario: An empty section is not shown
- **WHEN** every group of one section has no items
- **THEN** that section is not shown

#### Scenario: The four states are distinguishable on screen
- **WHEN** the catalog holds an owned item, an affordable one, one beyond the balance and one with no price
- **THEN** each is presented as owned, as buyable, as not yet affordable, or as not for sale
- **AND** no two of those read the same

#### Scenario: Upgrades are not in the market
- **WHEN** the catalog holds items sold at the workshop's upgrade bench
- **THEN** none of them is shown in the market

#### Scenario: Buying is reflected without leaving the market
- **WHEN** a purchase is confirmed in the market
- **THEN** the balance shown falls by the price and the item is shown as owned
- **AND** the student is still in the market

#### Scenario: A catalog that cannot be loaded has no market
- **WHEN** the catalog is missing or refused
- **THEN** the refusal is shown with the cause that was reported
- **AND** no market is shown

### Requirement: A persistent bar shows the year, the money and what the farm currently is

Every screen of an opened farm SHALL carry a bar showing the farm's declared name, the
current year, and the current balance with its declared currency label. The bar SHALL also
present a row of summary facts about the farm, each a label and its value, rendered in the
order they are supplied; WHEN no facts are supplied the bar SHALL show the name, the year
and the balance alone rather than an empty row. The bar SHALL show the current values on
whichever screen the student is on, with no navigation needed to read them. WHEN the farm
cannot be opened, no bar SHALL be shown and the refusal SHALL be presented with its cause
instead.

#### Scenario: The bar is present on every stage
- **WHEN** a student moves from the overview through configuration and a run to a report
- **THEN** the year and the balance are shown on each of those screens

#### Scenario: The bar follows the money
- **WHEN** the balance changes while a student is on a screen
- **THEN** that screen's bar shows the new balance
- **AND** the student did not have to navigate to see it

#### Scenario: Summary facts are rendered as supplied
- **WHEN** two summary facts are supplied to the bar
- **THEN** both are shown with their labels, in the order supplied
- **AND** no fact's subject is named by the bar itself

#### Scenario: A farm with nothing to summarise shows no empty row
- **WHEN** no summary facts are supplied
- **THEN** the bar shows the farm's name, the year and the balance
- **AND** no empty summary row is rendered

#### Scenario: A farm that cannot be opened has no bar
- **WHEN** the farm's declaration is missing or refused
- **THEN** the refusal is shown with the cause that was reported
- **AND** no bar, no year and no balance are shown

### Requirement: A report identifies the configuration that produced it

Every report of a task brought in by a model SHALL name the model family and the
configuration identifier it was produced from, and every report SHALL name the year it
belongs to. A report of a task brought in by the farm's manual labour SHALL identify that
labour rather than naming a family or a configuration.

The family is named because an identifier alone no longer identifies a model: two families
of one task can compose the same identifier string. A report naming an identifier without
its family would describe a crop the student cannot trace back to what brought it in.

A report SHALL describe the year it belongs to and SHALL NOT be presented as describing
the current state of the workshop. WHEN knob values change, a different family is selected,
or a different model is put to work, a report already shown SHALL continue to describe the
year, the family and the configuration it was produced from, and SHALL NOT be re-presented
as the result of the current knob values.

#### Scenario: Report names its configuration
- **WHEN** a report of a task brought in by a model is shown
- **THEN** it displays the model family and the configuration identifier that crop was brought in by
- **AND** it displays the year it belongs to

#### Scenario: A stale report is not passed off as current
- **WHEN** a knob value is changed, a different family is selected, or a different model is put to work, after a report has been shown
- **THEN** that report still names the family, the configuration and the year it was produced from
- **AND** it is not presented as the result of the current knob values

#### Scenario: A hand-brought crop's report identifies the labour
- **WHEN** a report of a task brought in by the farm's manual labour is shown
- **THEN** it identifies that labour
- **AND** it names no family and no configuration identifier
### Requirement: Engine refusals are shown with the cause the engine named

WHEN the engine refuses — an unresolvable configuration, a schema version mismatch, a
malformed stored distribution, or an incomplete declaration — the shell SHALL present the
refusal together with the cause the engine reported. It SHALL NOT show a blank screen, a
partial result, or any earnings figure for a refused run.

WHEN the refusal is a played task's crop that could not be brought in by the model at work
for it, the shell SHALL additionally offer, from where that refusal is shown, a way to hand
that task's job back to the farm's manual labour. The shell SHALL NOT require the student to
enter the task to reach it, and SHALL NOT bring the crop in by hand of its own accord. Once
the job is handed back, that task SHALL be offered to the student as their own labour, so a
year held open by a refused crop can be closed from where the refusal appears.

#### Scenario: A configuration with no precomputed entry is explained
- **WHEN** a student selects a knob combination the prediction artifact has no entry for
- **THEN** the shell reports that this configuration has not been precomputed, naming the configuration identifier
- **AND** no report and no earnings figure are shown

#### Scenario: A version mismatch stops the task rather than degrading it
- **WHEN** a task's declared schema version differs from its prediction artifact's version
- **THEN** the shell reports the mismatch naming both versions
- **AND** the task cannot be run

#### Scenario: A refused crop offers the job back where the refusal is shown
- **WHEN** running the year refuses a played task's crop because the model at work for it could not be brought in
- **THEN** the refusal is shown with its cause
- **AND** a way to hand that task's job back to the manual labour is offered alongside it

#### Scenario: Handing back from the refusal lets the year be closed
- **WHEN** the student hands the job back from where that refusal is shown
- **THEN** that task is offered to them as their own labour
- **AND** bringing its crop in that way closes the year

#### Scenario: The shell substitutes no labour of its own
- **WHEN** a played task's crop is refused and the student has not handed the job back
- **THEN** that task is still shown as at work by that model
- **AND** the shell does not offer its crop to be brought in by hand

### Requirement: The report is the payoff table filled with counts

The report SHALL present a cell for every combination of declared true category and
declared action, showing the count of evaluated images in that cell, alongside the total
earnings for the run. Categories and actions SHALL be labelled with the labels their task
declares.

Every declared action SHALL be given its own column however many the task declares. No two
actions SHALL be combined into one column, and no cell SHALL be omitted, collapsed into a
"wrong" or "other" total, or dropped for want of room, because two images treated
differently and wrongly are two different mistakes and the report is where that difference
has to be visible.

In every row the report SHALL identify the cell whose action is the one that row's category
is declared to call for. Which cell that is SHALL be read from the task's declared
category-to-action mapping and SHALL NOT be inferred from the cell's position. A task
mapping two categories onto one action therefore has one identified cell in each of those
rows and no diagonal at all, and a task whose mapping is one-to-one gets a diagonal as a
consequence of what it declares rather than as a rule about where the marks go.

The identification SHALL be carried by text or by shape and SHALL NOT be carried by colour
alone, and it SHALL be available to a reader using assistive technology rather than being a
visual cue only. A grid read one cell at a time is precisely where "which of these was the
right answer" cannot be recovered from position, so a mark that only a sighted reader can
see is a mark that has not been made.

Rows and columns SHALL stay in the order their task declares. No cell SHALL be moved,
grouped or reordered so that the identified cells line up, because the order of a task's
actions is the task's statement and not the report's to rearrange.

The report SHALL NOT present a count or proportion of images treated correctly, nor any
combined figure over the identified cells. Identifying which cell was right tells a student
where to look; a single figure summing those cells would let them stop looking, which is
the one thing this report exists to prevent.

The report SHALL additionally carry money and the year's own circumstances:

- **What each row earned.** Every category's row SHALL state what that category's apples
  came to, so the money is attached to the categories it came from rather than only to the
  run. No figure SHALL combine only the identified cells' money, for the same reason no
  count may.
- **The arithmetic of what was paid.** WHEN the task declares a delivery term, the report
  SHALL show the gross, what the downgrade took off it, and what the harvest paid, as three
  figures whose arithmetic a reader can follow. WHEN it declares none, the total earnings
  stand alone.
- **The delivery line.** WHEN the task declares a delivery term, the report SHALL state the
  measured share, the count and the categories it was measured over, the tolerance it was
  measured against, and whether the delivery was accepted or downgraded. WHEN nothing was
  delivered, it SHALL say so rather than showing a share.
- **The warning.** WHEN the harvest recorded a warning, the report SHALL say how close the
  measured share came to the tolerance, in the same place the downgrade would be reported,
  so the sentence a student reads before a bad year is in the place they will read it again
  during one.
- **The year's crop.** The report SHALL state the size of the crop and the share of it each
  declared category held that year, in that task's declared category labels. This is what
  lets a leaner year be attributed to the year. It SHALL NOT be labelled as noise, variance
  or error.
- **Recurring photographs.** WHEN photographs recurred in the crop, the report SHALL state
  that they did and how many the pool holds.

None of these SHALL be expressed in vocabulary belonging to any particular task. The
categories a delivery term measures, the actions that count as delivering, and the labels
of both are read from the declaration, so a task measuring something other than worms
reports through the same screen.

#### Scenario: Every combination is present in the report
- **WHEN** a report is shown for a task with three categories and three actions
- **THEN** all nine category-and-action counts are displayed, including combinations with a count of zero
- **AND** the total earnings are displayed alongside them

#### Scenario: Two ways of being wrong about one image are separate cells
- **WHEN** a task declares two actions that are both incorrect for the same category
- **THEN** the report shows that category's count under each of them in its own cell
- **AND** neither is folded into the other or into a combined error figure

#### Scenario: An over-selective configuration is diagnosable on screen
- **WHEN** a configuration rarely chooses the high-value action
- **THEN** the report distinguishes the count for the category where that action was correct from the counts where the low-value action was correct

#### Scenario: A wider action set needs no screen change
- **WHEN** a task declaring one more action than another is reported on
- **THEN** its report carries one more column, labelled from its declaration
- **AND** no screen code is added or changed for it

#### Scenario: Each row identifies the cell its category calls for
- **WHEN** a report is shown for a task declaring a category-to-action mapping
- **THEN** exactly one cell in every row is identified as that category's declared action
- **AND** the identified cell is the one the mapping names

#### Scenario: A mapping that is not one-to-one has no diagonal
- **WHEN** a task maps two of its categories onto the same action
- **THEN** both of those rows identify that action's cell
- **AND** the identified cells do not form a diagonal, and none is placed as though they should

#### Scenario: The identification survives the colours being removed
- **WHEN** the report is read with its colours removed
- **THEN** the identified cell in each row is still distinguishable from the other cells in that row

#### Scenario: The identification reaches a screen reader
- **WHEN** the report's table is read cell by cell by assistive technology
- **THEN** the identified cell is announced as the one its category calls for

#### Scenario: Declared order is not rearranged to align the marks
- **WHEN** a task's declared action order places the identified cells out of line with each other
- **THEN** the columns stay in the task's declared order
- **AND** no cell is moved or grouped to align them

#### Scenario: No accuracy figure is offered
- **WHEN** a report is shown
- **THEN** no count or proportion of correctly treated images is presented
- **AND** no figure combining the identified cells is presented

#### Scenario: The money is attached to the categories it came from
- **WHEN** a report is shown
- **THEN** each category's row states what that category's apples earned
- **AND** no figure combines the money of the identified cells alone

#### Scenario: A downgraded delivery shows its arithmetic
- **WHEN** a harvest whose delivery was downgraded is reported
- **THEN** the gross, the amount the downgrade took off, and what the harvest paid are all shown
- **AND** the gross less the downgrade equals what it paid

#### Scenario: An accepted delivery still shows the line
- **WHEN** a harvest whose measured share stayed below the tolerance is reported
- **THEN** the measured share and the tolerance are shown, and the delivery is stated as accepted

#### Scenario: The warning is where the downgrade would be
- **WHEN** a harvest that recorded a warning is reported
- **THEN** how close the measured share came to the tolerance is stated
- **AND** it appears in the same place a downgrade is reported

#### Scenario: The breakdown contradicts the headline
- **WHEN** a delivery is downgraded by the apples of one rare category
- **THEN** the total paid is shown alongside the count of those apples and what the downgrade cost
- **AND** the cost of that category's cells is legible against the size of the crop

#### Scenario: The year is stated so a lean year can be attributed
- **WHEN** two closed years' reports for one unchanged configuration are read
- **THEN** each states its crop's size and the share each category held
- **AND** neither presents the difference between them as noise, variance or error

#### Scenario: Recurring photographs are disclosed on the report
- **WHEN** a harvest whose crop repeated photographs is reported
- **THEN** the report states that photographs recur and how many the pool holds

#### Scenario: A task with no delivery term reports no delivery line
- **WHEN** a harvest for a task declaring no delivery term is reported
- **THEN** no share, tolerance, downgrade or warning appears
- **AND** the total earnings are shown as one figure

#### Scenario: The delivery line names nothing task-specific in the shell
- **WHEN** a task whose delivery term measures a category unrelated to apples is reported on
- **THEN** the measured categories and delivering actions are named from that task's declaration
- **AND** no screen code is added or changed for it

### Requirement: Declared teaching copy is reachable from the screens

A task's declared task-level copy SHALL be reachable from its configuration screen, and
every rendered knob SHALL offer an affordance that shows that knob's declared help copy.
No explanatory copy about a task SHALL be written into screen code.

#### Scenario: Every knob offers its declared help
- **WHEN** the configuration screen renders a task's knobs
- **THEN** each knob offers a help affordance
- **AND** activating it shows that knob's declared help copy

### Requirement: The shell contains no task-specific code paths

No task id, category id, action id or knob id declared by a task SHALL appear in screen
code, and no screen SHALL branch on one. A task's screens SHALL be produced from its
declaration alone. This SHALL hold for every stage the shell presents, including stages that
belong to the farm rather than to a task run and that render a task's images, labels or
actions.

The same rule SHALL hold over what a model family declares: no family id, family label,
shipped form, slot icon, slot label or history axis label SHALL appear in screen code, and
no screen SHALL branch on one. The workshop, the family picker, the labour slot and the
report SHALL be produced from the declared families and the facts they are supplied. A
family's own drawing and a family's own tutorial body MAY each name that family and SHALL
name no other; every other screen, the tutorial frame included, SHALL name none.

The same rule SHALL hold over what the farm declares: no farm name, no currency label and
no summary fact's label SHALL appear in screen code, and no screen SHALL branch on one.
The persistent bar SHALL be produced from the farm declaration and the facts it is
supplied, and SHALL name nothing of its own.

The same rule SHALL hold over what the catalog declares: no item id, item label, group id,
group label or shop copy SHALL appear in screen code, and no screen SHALL branch on one.
No screen SHALL name an unlock condition — which item opens which thing SHALL be read from
the catalog, never written into a screen, so that a market for an entirely different farm
renders through the same screens.

#### Scenario: An unrelated task renders without screen changes

- **WHEN** a second task declaring unrelated categories and actions is added as a declaration
- **THEN** it renders its overview entry, workshop and report through the same screens
- **AND** every farm stage that presents its images or actions renders them from its declaration through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: An unrelated family renders without screen changes

- **WHEN** a task is declared with a model family whose id, label, knobs and shipped form the shell has never presented
- **THEN** it is offered in the picker, configured in the workshop, shown in the labour slot and named in the report through the same screens
- **AND** no screen code is added or changed for it

#### Scenario: No screen branches on what a family ships

- **WHEN** screen code is inspected
- **THEN** nothing branches on whether a family ships its model or its predictions
- **AND** nothing names a family outside that family's own drawing and that family's own tutorial body

#### Scenario: The tutorial frame names no family

- **WHEN** the code that opens, presents, judges and records a tutorial is inspected
- **THEN** no family id and no family label appears in it
- **AND** nothing branches on which family is being taught

#### Scenario: A farm declaring a different currency renders without screen changes

- **WHEN** the farm declares a different name and a different currency label
- **THEN** the bar shows both of them
- **AND** no screen code is added or changed for it

#### Scenario: An unrelated catalog renders without screen changes

- **WHEN** a catalog declaring different groups, items and prices is loaded
- **THEN** the market renders it, and locked things name the items that open them
- **AND** no screen code is added or changed for it

### Requirement: Fixture-backed data is disclosed as such

WHEN the predictions a run reads are fixture stand-ins rather than generated artifacts,
the shell SHALL say so where the results are shown, so that no student or reviewer reads
a fixture result as a real model outcome.

#### Scenario: A fixture-backed report is labelled
- **WHEN** a report is produced from fixture predictions
- **THEN** the report indicates that it was produced from fixture data

### Requirement: The farm presents stages that belong to no task

The shell SHALL be able to present stages that belong to the farm rather than to a task run —
a stage a student enters from the overview, works through, and returns from. Such a stage
SHALL be reachable from the overview, SHALL be leavable back to it, and SHALL NOT be enterable
when the state of the farm does not offer it. Entering one SHALL NOT select a task for
configuration, run a task, or produce a report of a run.

The four task stages are unchanged by this: a farm stage sits beside them rather than inside
them, and carries the persistent bar as every other stage does.

#### Scenario: A farm stage is entered from the overview
- **WHEN** the farm offers a stage that is not a task run
- **THEN** it is reachable from the overview
- **AND** entering it neither scores a run nor shows a report

#### Scenario: Leaving returns to the overview
- **WHEN** a student leaves a farm stage
- **THEN** the overview is shown again

#### Scenario: A stage the farm does not offer is not enterable
- **WHEN** the state of the farm does not offer a stage
- **THEN** that stage cannot be entered

#### Scenario: The bar is present there too
- **WHEN** a student is on a farm stage
- **THEN** the year and the balance are shown on it

#### Scenario: The task stages are untouched
- **WHEN** a task is selected from an overview that also offers a farm stage
- **THEN** configuration, run and report proceed as they did before

### Requirement: The workshop offers the task's families, and choosing one is not committing it

WHEN a task declares more than one model family, the workshop SHALL present the families it
declares and SHALL let the student select among the ones that are available to them. The
selected family SHALL decide which knobs and which drawing the workshop presents.

Selecting a family SHALL NOT put it to work, SHALL NOT take the model already at work off
the task, and SHALL move no money. Putting a model to work SHALL remain the separate,
deliberate act `farm-labour` specifies, so that opening the picker to look at a family the
student is considering never changes who brings the crop in.

A family the student does not yet have available SHALL be shown with what opens it rather
than hidden, exactly as a locked knob value is, and SHALL NOT be selectable. A task
declaring one family SHALL NOT be made to look like a choice.

#### Scenario: The picker renders the declared families
- **WHEN** a task declaring several families is opened in the workshop
- **THEN** each declared family is presented with its declared label
- **AND** the selected family's knobs and drawing are the ones shown

#### Scenario: Looking at a family does not field it
- **WHEN** a family is selected while a model of another family is at work
- **THEN** the task's labour is still that model
- **AND** no money moves and the year is unchanged

#### Scenario: An unavailable family is shown with what opens it
- **WHEN** a task declares a family the student does not have available
- **THEN** it is shown together with what opens it
- **AND** it cannot be selected

#### Scenario: A single family is not presented as a choice
- **WHEN** a task declaring exactly one family is opened in the workshop
- **THEN** its knobs are presented directly
- **AND** no family choice is offered

### Requirement: The tutorial is reached from the workshop, never sprung in the market

WHEN the selected family declares a tutorial, the workshop SHALL offer it beside that
family's knobs, whether or not it has been completed, so that its theory copy stays
reachable after it is passed. Nothing SHALL open it unbidden while a student is tuning
knobs, making a model, or buying at the bench.

Neither counter SHALL present a tutorial, open one on a purchase, or condition a purchase on
one. Buying a family and being ambushed by a puzzle is the shop telling a student that money
was not the key, which is a thing the shop has already promised it will never say.

#### Scenario: The workshop offers the selected family's tutorial

- **WHEN** a family declaring a tutorial is selected in the workshop
- **THEN** that tutorial is offered beside its knobs

#### Scenario: A completed tutorial is still offered

- **WHEN** the selected family's tutorial has been completed
- **THEN** it is still offered from the workshop
- **AND** opening it presents its puzzle and its theory copy

#### Scenario: Buying a family opens no puzzle

- **WHEN** an item that opens a family declaring a tutorial is bought
- **THEN** the market shows the purchase and nothing else
- **AND** no tutorial is presented until the student reaches the workshop

#### Scenario: Buying an upgrade opens no puzzle

- **WHEN** an upgrade for a family declaring a tutorial is bought at the bench
- **THEN** the bench shows the purchase and nothing else
- **AND** no tutorial is opened

#### Scenario: A family declaring no tutorial offers none

- **WHEN** a family declaring no tutorial is selected in the workshop
- **THEN** no tutorial is offered
- **AND** the workshop is as it was before tutorials existed

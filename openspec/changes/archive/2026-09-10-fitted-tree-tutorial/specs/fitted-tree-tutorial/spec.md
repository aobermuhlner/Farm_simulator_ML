## Purpose

Defines the puzzle that stands between owning a fitted tree and putting it to work: a tree
whose questions are given and whose leaves are empty, labelled by dropping one apple per
declared category into each leaf, tested against real apples out of the browsable set, and
marked on the labelling rather than on how many apples it files correctly — so that a student
who has never met a tree owns the one claim it rests on, and meets the apple it still gets
wrong in the same breath.

## ADDED Requirements

### Requirement: The puzzle is a declared chain of questions with one empty leaf at every exit

The puzzle SHALL declare an ordered, non-empty list of questions, each naming one of the
task's declared features and one threshold on it. It SHALL pose one leaf for every question —
reached when that question is the first answered yes — plus one final leaf reached when every
question is answered no, so a chain of *n* questions has *n + 1* leaves.

An apple SHALL be filed by asking the questions in the declared order and following the first
one it answers yes to; an apple answering no to all of them SHALL reach the final leaf. Every
apple therefore SHALL reach exactly one leaf, and which one SHALL depend on nothing but the
declared questions and that apple's declared values.

How many questions the puzzle asks SHALL be read from the puzzle's own declaration. It SHALL
NOT be read from the task's declared rule budget, which sizes a rule that is searched for
rather than one that is written down; resizing this puzzle SHALL leave that budget, and every
figure measured against it, untouched.

A puzzle declaring no questions, a question naming a feature the task does not declare, or a
threshold that is not a number SHALL be refused at load with the defect named, and the task
SHALL NOT be loaded.

#### Scenario: An apple follows the first question it answers yes to

- **WHEN** an apple's value for the first question's feature is above that question's threshold
- **THEN** it is filed in the leaf belonging to that question
- **AND** no later question is asked of it

#### Scenario: An apple answering no to every question reaches the final leaf

- **WHEN** an apple's value is at or below the threshold of every declared question
- **THEN** it is filed in the final leaf

#### Scenario: Every declared apple reaches exactly one leaf

- **WHEN** the declared apples are filed
- **THEN** each one appears in exactly one leaf
- **AND** no apple is unfiled

#### Scenario: The puzzle's question count is its own

- **WHEN** the puzzle declares a different number of questions
- **THEN** the task's declared rule budget is unchanged
- **AND** no figure measured against that budget is re-recorded

#### Scenario: A question naming an undeclared feature is refused

- **WHEN** a declared question names a feature the task does not declare
- **THEN** the refusal names that feature
- **AND** the task is not loaded

### Requirement: Every apple is declared with the values the questions read, and they are the pool's

The puzzle SHALL declare each of its apples by the pool image it is, the declared category it
truly belongs to, and its measured value for each feature the declared questions ask about.
Values for features no question asks about SHALL NOT be declared, and SHALL NOT be shown.

Those declared values SHALL be the values the pool recorded for that image. Because the pool
is not available where a declaration is validated, this SHALL be held by a check over the
shipped pool rather than at load; a declared value that no longer matches the pool SHALL fail
that check naming the image, the feature, the declared value and the recorded one.

An apple naming a category the task does not declare, or omitting a value for a feature a
declared question asks about, SHALL be refused at load with the defect named, and the task
SHALL NOT be loaded.

#### Scenario: Only the features the questions ask about are declared and shown

- **WHEN** an apple is presented
- **THEN** the values shown for it are those of the features the declared questions ask about
- **AND** no other measured value appears for it anywhere in the puzzle

#### Scenario: A declared value that has drifted from the pool fails the check

- **WHEN** the pool records a different value for a declared apple's feature
- **THEN** the check fails naming the image, the feature, the declared value and the recorded value

#### Scenario: An apple naming an undeclared category is refused

- **WHEN** a declared apple names a category the task does not declare
- **THEN** the refusal names that category
- **AND** the task is not loaded

#### Scenario: An apple missing a value a question reads is refused

- **WHEN** a declared apple omits its value for a feature a declared question asks about
- **THEN** the refusal names that apple and that feature
- **AND** the task is not loaded

### Requirement: A leaf is labelled by dropping an apple, and the label names a category

The student SHALL label a leaf by placing into it one apple from a tray holding exactly one
apple per category the task declares. A labelled leaf SHALL mean that the leaf says that
category, and a leaf SHALL hold at most one label at a time. Replacing a leaf's label and
clearing it SHALL both be possible at any time before an answer is offered.

A label SHALL name a declared **category** and never an action. The puzzle SHALL present no
outcome vocabulary of its own; where an outcome is stated at all it SHALL be the action the
task declares for that category, read from the task's declared category-to-action mapping.

#### Scenario: Dropping an apple labels the leaf with that category

- **WHEN** the student places the tray's wormy apple into a leaf
- **THEN** that leaf says the wormy category
- **AND** the tray still offers one apple per declared category

#### Scenario: A leaf holds one label, and it can be changed

- **WHEN** a second apple is placed into a leaf that already carries a label
- **THEN** the leaf carries only the second category
- **AND** the labelling can still be changed before an answer is offered

#### Scenario: The puzzle names no action of its own

- **WHEN** the puzzle is presented
- **THEN** no action appears that the task does not declare for a category
- **AND** any outcome stated for a labelled leaf is the one the task's category-to-action mapping gives

### Requirement: Every apple carries its declared category label, so colour is never the only cue

Every apple the puzzle presents — in the tray, in a leaf, and wherever a filed apple is shown
— SHALL carry its category's declared label as text beside its picture. The categories a
student chooses between SHALL NOT be distinguished by the colour of the apples alone.

This is stated rather than assumed because the puzzle's whole conceit is that the apple *is*
the label, which is precisely what invites dropping the words.

#### Scenario: A tray apple shows its declared label

- **WHEN** the tray is presented
- **THEN** each apple in it shows its category's declared label as text
- **AND** the categories are distinguishable without relying on the apples' colour

#### Scenario: A labelled leaf shows the declared label

- **WHEN** a leaf has been labelled
- **THEN** the leaf shows that category's declared label as text

### Requirement: Testing files every apple and shows where each one landed, and judges nothing

The puzzle SHALL offer a way to run its declared apples through its declared questions and
show, for each apple individually, which leaf it reached. That reveal SHALL be available
before an answer is offered, after a failed answer, and after the tutorial has been completed.

Testing SHALL NOT be an answer. It SHALL neither pass nor fail the tutorial, SHALL record
nothing, and SHALL leave the labelling as the student left it. Reading the leaves and then
labelling them accordingly SHALL be a permitted route to solving the puzzle, because the
routing is what the puzzle exists to teach.

What the reveal shows SHALL be per apple. It SHALL NOT show any distribution, range, average
or count of a measured feature over a split of the pool.

#### Scenario: Testing shows each apple's leaf

- **WHEN** the student tests the tree
- **THEN** each declared apple is shown in the leaf it reached
- **AND** the leaf each one reached is the one the declared questions send it to

#### Scenario: Testing is not an answer

- **WHEN** the student tests the tree
- **THEN** the tutorial is neither passed nor failed by it
- **AND** the labelling is unchanged
- **AND** nothing is recorded

#### Scenario: Testing after labelling from the reveal still solves it

- **WHEN** the student tests the tree, labels the leaves from what it showed, and offers that answer
- **THEN** the answer is judged on its merits
- **AND** nothing marks it as having been read off the reveal

#### Scenario: The reveal summarises no feature over a split

- **WHEN** the reveal is presented
- **THEN** no distribution, range, average or count of a measured feature is shown for either split of the pool

### Requirement: The mark is a declared count of apples filed correctly, and nothing finer is kept

The puzzle SHALL declare, as a number, the minimum count of its apples that must be filed
correctly for an answer to pass. An apple SHALL count as filed correctly when the label on the
leaf it reaches names the category it truly belongs to. An answer reaching that count SHALL
pass and an answer below it SHALL fail.

Nothing but pass or fail SHALL leave the judgement. The count reached SHALL NOT be recorded,
and SHALL NOT be presented as a score, a share, a grade or a tally of which apples were right.
A student MAY see where each apple landed, through the reveal above; that is the routing, not a
mark.

#### Scenario: A labelling reaching the mark passes

- **WHEN** the student offers a labelling under which the declared minimum number of apples are filed correctly
- **THEN** the answer passes

#### Scenario: A labelling below the mark fails

- **WHEN** the student offers a labelling under which fewer apples than the declared minimum are filed correctly
- **THEN** the answer fails
- **AND** the puzzle can be attempted again immediately

#### Scenario: The count reached is not kept or shown

- **WHEN** an answer has been judged
- **THEN** what is recorded is at most that the tutorial is complete
- **AND** no count, score, share or per-apple tally of correctness is presented

### Requirement: A puzzle that cannot reach its mark, or that reaches it perfectly, is refused at load

The best labelling available under a puzzle's declared questions SHALL be computed by giving
each leaf the category that most of the apples reaching it truly belong to, which is decidable
because a leaf's best label depends on no other leaf.

A puzzle whose best labelling files fewer apples correctly than its declared mark SHALL be
refused at load, naming the family, the tutorial, the best achievable count and the mark. A
student locked out by authored data is locked out where no screen can say why.

A puzzle whose best labelling files **every** declared apple correctly SHALL also be refused at
load, naming the family and the tutorial, because the lesson requires that a correctly labelled
tree still gets an apple wrong. The declared apples SHALL therefore include at least one that
the best labelling misfiles.

#### Scenario: A mark the best labelling cannot reach refuses the task

- **WHEN** a puzzle's best labelling files fewer apples correctly than its declared mark
- **THEN** the refusal names that family, that tutorial, the best achievable count and the mark
- **AND** the task is not loaded

#### Scenario: A puzzle with nothing to get wrong refuses the task

- **WHEN** a puzzle's best labelling files every declared apple correctly
- **THEN** the refusal names that family and that tutorial
- **AND** the task is not loaded

#### Scenario: A puzzle the best labelling solves short of perfectly loads

- **WHEN** a puzzle's best labelling reaches its declared mark and misfiles at least one apple
- **THEN** the task loads
- **AND** the puzzle is presented

### Requirement: What the puzzle withholds is that it did not choose the questions

This puzzle's declared disclosure SHALL state that the questions were given to the student and
that the model this tutorial introduces chooses its own questions. Choosing the questions is
what fitting is, and it is what the student is about to buy; a puzzle that let a student
believe a tree's questions are handed down would teach the wrong half of the lesson.

The disclosure SHALL NOT be softened into a claim that the puzzle is the model, and the puzzle
SHALL NOT offer any way to change a question, so that what is disclosed and what is on screen
agree.

#### Scenario: The disclosure states who chooses the questions

- **WHEN** the puzzle is presented
- **THEN** its disclosure states that the questions were given and that the real model chooses its own

#### Scenario: No question can be changed

- **WHEN** the puzzle is presented
- **THEN** no control changes a declared question's feature or its threshold

### Requirement: The pictures are fetched when the puzzle is opened, and a failure is stated

The apples' pictures SHALL be fetched when the puzzle is opened rather than before, since a
student may never open it. While they are being fetched, the puzzle SHALL say so and SHALL
offer no answer.

Where the pictures cannot be fetched, the puzzle SHALL state that, naming the cause, and SHALL
offer no answer — labelling leaves with apples that cannot be seen is not the lesson. This
SHALL be a state of the puzzle rather than of the farm: the workshop, the family, the knobs and
everything else about the task SHALL be unaffected, and the tutorial SHALL remain openable
again.

Whether an answer passes SHALL NOT depend on the pictures. The questions, the apples' values,
the categories and the mark are all declared, so the same answer SHALL be judged the same way
however the pictures fared.

#### Scenario: The puzzle says it is loading and offers no answer

- **WHEN** the puzzle is opened and its pictures have not arrived
- **THEN** the puzzle states that it is loading
- **AND** no answer can be offered

#### Scenario: Pictures that cannot be fetched are stated with their cause

- **WHEN** the puzzle's pictures cannot be fetched
- **THEN** the puzzle states the cause
- **AND** no answer can be offered
- **AND** the tutorial can be opened again

#### Scenario: A failure to fetch leaves the rest of the task alone

- **WHEN** the puzzle's pictures cannot be fetched
- **THEN** the workshop, the family's knobs and the making of its model are as they were
- **AND** nothing about the farm is reported as broken

#### Scenario: Judgement does not depend on the pictures

- **WHEN** one labelling is judged
- **THEN** it passes or fails on the declared questions, values, categories and mark alone

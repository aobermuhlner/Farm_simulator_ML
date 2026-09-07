## MODIFIED Requirements

### Requirement: Generation attributes are not displayed

The browser SHALL NOT display the generation attributes the manifest records per image —
hue, roundness, gloss, lighting or worm visibility — nor any statistic derived from them.
The distribution difference between the splits is what the lessons exist to teach; naming
it on screen forfeits that.

Measured features are a different thing and are treated differently. The browser MAY
display an image's measured feature values, because a student who has to pick a threshold
on a number needs to see that number on apples they can look at; a feature list without
values attached to visible examples reduces threshold-picking to guessing. A displayed
feature value SHALL be presented as a measurement of the picture rather than as a fact
about the apple, so that a student reading a wrong value sees a measurement that was fooled
rather than a label that lied.

The prohibition on summaries covers both kinds. The browser SHALL NOT display any
per-split summary — a distribution, a range, an average or a count — of a generation
attribute or of a measured feature. A measured feature recovers the attribute it is
nominally about closely enough that summarising it per split would hand over the authored
gap exactly as summarising the attribute would, and that gap is the lesson. Per-image
values do not have this problem: one apple's redness reveals one apple.

#### Scenario: A student sees apples, not parameters
- **WHEN** an image is shown in the browser
- **THEN** no attribute value for that image appears on screen

#### Scenario: No summary reveals the authored gap
- **WHEN** the training split is browsed
- **THEN** no attribute distribution, range or average is displayed for either split

#### Scenario: An image's measured features may be shown
- **WHEN** an image is shown in the browser
- **THEN** its measured feature values may appear on screen
- **AND** each is presented as a measurement of the picture

#### Scenario: No per-split summary of a measured feature
- **WHEN** the training split is browsed
- **THEN** no distribution, range, average or count of any measured feature is displayed for either split

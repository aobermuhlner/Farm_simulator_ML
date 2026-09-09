## Purpose

Defines what a student can see of a task's training split — which images, labelled how,
delivered how, and with what said about which pool is on screen — so that the data a
model learned from is inspectable rather than merely promised.

## Requirements

### Requirement: The training split is browsable from configuration

A task's configuration screen SHALL offer a way to view that task's training split, and
the view SHALL be leavable so the student returns to configuration with their knob values
intact. Viewing the split SHALL NOT require running the task first.

#### Scenario: A student reaches the training data before tuning
- **WHEN** a student opens a task's configuration screen and asks to see the training data
- **THEN** the training split is shown

#### Scenario: Leaving the browser keeps the configuration
- **WHEN** a student views the training split and then returns to configuration
- **THEN** the knob values they had selected are still selected
- **AND** no run has been scored

### Requirement: Every image of the training split is shown with its declared label

The browser SHALL present every image in the task's training split, and each image SHALL
carry the display label its task declares for that image's true category. It SHALL NOT
present images from the evaluation pool.

#### Scenario: The whole split is present
- **WHEN** the training split of a task with 200 training images is browsed
- **THEN** 200 images are presented

#### Scenario: Labels come from the task declaration
- **WHEN** an image whose true category is the task's high-value category is shown
- **THEN** it is labelled with the label that task declares for that category
- **AND** no category name is written into screen code

#### Scenario: The harvest is not on display
- **WHEN** the training split is browsed
- **THEN** no image belonging to the evaluation pool is shown

### Requirement: The composition of the split is stated

The browser SHALL state how many images of each declared category the training split
contains, so that the mix is a fact on screen rather than something a student counts by
eye.

#### Scenario: Counts are shown per category
- **WHEN** a training split of 100 red, 50 green and 50 wormy images is browsed
- **THEN** each category's count is displayed against that category's declared label

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

### Requirement: Images are delivered by cropping the atlas

The browser SHALL obtain each image by cropping its region out of the atlas its manifest
entry names, rather than requesting an image per entry. Presenting a whole split SHALL
cost a number of image requests that does not grow with the number of images in it.

#### Scenario: Browsing a split is a bounded number of requests
- **WHEN** all images of the training split are presented
- **THEN** the number of image requests issued is bounded and independent of the image count

#### Scenario: Each image shows its own region
- **WHEN** two images in the same atlas are shown
- **THEN** each displays the region its manifest entry resolves to

### Requirement: The browser says which pool it is showing

WHEN the pool the browser presents is not the pool the current run scores, the browser
SHALL say so on screen. A student SHALL NOT be able to read the browsed images as the
images a report counted when they are not.

#### Scenario: A student is told the browsed data is not what was scored
- **WHEN** the browser shows a generated pool while runs are scored from fixture predictions
- **THEN** the browser states that the images shown are not the images the current run scored

#### Scenario: No such claim once they agree
- **WHEN** the pool the browser shows is the pool the run scores
- **THEN** no mismatch notice is shown

### Requirement: A pool that will not load refuses with its cause

WHEN the pool cannot be loaded — it is unreachable, incomplete, mismatched with the task,
or structurally invalid — the browser SHALL present the refusal together with the cause
reported by the pool reader. It SHALL NOT show a partial grid, blank cells, or images
without labels.

#### Scenario: An unreachable manifest is explained
- **WHEN** the pool manifest cannot be fetched
- **THEN** the browser reports that the training data could not be loaded, naming the cause
- **AND** no image grid is shown

#### Scenario: A mismatched pool is refused rather than partly drawn
- **WHEN** the pool manifest declares a different pool id or schema version than the task
- **THEN** the browser reports the mismatch naming both values
- **AND** no images are shown

#### Scenario: An image the pool cannot place is not drawn blank
- **WHEN** the pool reader refuses the manifest because an image names an unknown atlas
- **THEN** the refusal is shown and no partial grid is rendered

### Requirement: The order images appear in is stable

The browser SHALL present the training split in the order the pool enumerates it, so that
every student sees the same images in the same order and a student returning to the
browser finds it unchanged.

#### Scenario: The same order every time
- **WHEN** a student opens the training browser twice in a session
- **THEN** the images appear in the same order both times

#### Scenario: The order is the pool's, not the screen's
- **WHEN** the browser renders the split
- **THEN** the sequence of image ids matches the order the pool enumerates for that split

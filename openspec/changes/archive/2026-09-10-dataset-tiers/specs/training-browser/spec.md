## ADDED Requirements

### Requirement: The browser shows the tier the workshop has selected

The browser SHALL present the images of the dataset tier the selected family's dataset knob
currently names, and SHALL name that tier on screen using its declared label. Changing the
tier and returning to the browser SHALL show that tier's images.

Which tier is shown SHALL follow the knob, not what is owned. A student who owns the largest
tier and has selected the smallest SHALL be shown the smallest, because it is the set the
model they are configuring will be fitted on, and a browser showing anything else would
describe a different model than the workshop is building.

#### Scenario: The browsed tier is the selected one
- **WHEN** the training data is browsed with a tier selected on the family's dataset knob
- **THEN** the images shown are the images that tier holds
- **AND** that tier's declared label names the set on screen

#### Scenario: A student owning more sees what they selected
- **WHEN** a student owning a larger tier browses with the smaller one selected
- **THEN** only the smaller tier's images are shown

#### Scenario: Selecting a larger tier adds images and removes none
- **WHEN** a larger tier is selected and the training data is browsed again
- **THEN** every image the smaller tier showed is still shown
- **AND** the images the larger tier adds are shown alongside them

### Requirement: The browser states the label quality of the tier it is showing

The browser SHALL display the selected tier's declared label-quality copy alongside its
images. A tier that files some images under a category other than their true one SHALL be
shown as such before a student reads a single label as fact.

The browser SHALL NOT mark which images are mislabelled, nor state how many are. A student
who spots one has learned to look at their data; a student handed the list has learned
nothing, and the count alone would let one be inferred by subtraction.

#### Scenario: A hurried tier is disclosed as it is browsed
- **WHEN** a tier declaring that some of its labels are wrong is browsed
- **THEN** its declared label-quality copy is displayed with the images

#### Scenario: A checked tier is disclosed too
- **WHEN** a tier declaring that every label is correct is browsed
- **THEN** its declared label-quality copy is displayed with the images

#### Scenario: No image is flagged as mislabelled
- **WHEN** a mislabelling tier is browsed
- **THEN** no image carries a mark distinguishing it as wrongly labelled
- **AND** no count of wrongly labelled images is displayed

## MODIFIED Requirements

### Requirement: Every image of the training split is shown with its declared label

The browser SHALL present every image of the selected dataset tier, and each image SHALL
carry the display label its task declares for the category *that tier files it under*, which
is not always the image's true category. It SHALL NOT present images from the evaluation
pool, and it SHALL NOT present a training image the selected tier does not hold.

Showing the tier's label rather than the truth is the point. The data a student bought is
the data their model will be fitted on, wrong labels and all, and a browser quietly
correcting it would hide the only thing that distinguishes a cheap dataset from an expensive
one.

#### Scenario: The whole split is present
- **WHEN** the training data is browsed with a tier of 200 images selected
- **THEN** 200 images are presented

#### Scenario: Labels come from the task declaration
- **WHEN** an image the selected tier files under the task's high-value category is shown
- **THEN** it is labelled with the label that task declares for that category
- **AND** no category name is written into screen code

#### Scenario: The harvest is not on display
- **WHEN** the training split is browsed
- **THEN** no image belonging to the evaluation pool is shown

#### Scenario: A mislabelled apple is shown as its tier files it
- **WHEN** a tier files a wormy apple under the high-value category and its images are browsed
- **THEN** that image carries the high-value category's declared label
- **AND** nothing on screen contradicts it for that image

### Requirement: The composition of the split is stated

The browser SHALL state how many images of each declared category the selected tier
contains, so that the mix is a fact on screen rather than something a student counts by
eye.

The counts SHALL be of the labels the tier files its images under, not of their true
categories, because those are the counts a student could arrive at themselves from what they
were sold. A tier that under-counts a category because it filed some of it elsewhere SHALL
report the count it filed, and the discrepancy SHALL stay something the harvest reveals
rather than something the browser gives away.

#### Scenario: Counts are shown per category
- **WHEN** a selected tier files 100 images as red, 50 as green and 50 as wormy and is browsed
- **THEN** each category's count is displayed against that category's declared label

#### Scenario: Counts follow the tier's labels, not the truth
- **WHEN** a mislabelling tier is browsed
- **THEN** the counts shown are of the labels that tier files its images under
- **AND** no count of true categories is displayed

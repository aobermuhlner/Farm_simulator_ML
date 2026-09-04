# colour-vision-safety Specification

## Purpose
Keeps the colours the lessons are built on legible to a student with a red/green
deficiency: every colour that carries category meaning, in a pool's images or on a screen,
is verified distinguishable under simulated deficiency by a check rather than by eye, and
no category is ever distinguished by colour alone.

## Requirements

### Requirement: A colour that carries category meaning is verified under simulated deficiency

Any colour that distinguishes one declared category from another — in the images of a pool
or on a screen — SHALL be verified distinguishable under simulated deuteranopia and under
simulated protanopia, each at full severity, against declared distance thresholds. The
verification SHALL be an automated check over the declared colours rather than a judgement
made by looking, because the people it protects are not the people authoring it.

A pair falling below a threshold SHALL fail the check naming both colours, the deficiency
simulated and the measured distance, so that the failure says which colour to move rather
than that something is wrong.

The colours a surface may use for a category SHALL be declared in one place per surface —
the pool's palette parameters, the stylesheet's palette tokens — so that the check covers
every one of them by construction. A category colour written anywhere else SHALL fail the
check naming where it was found: a colour the check cannot see is a colour the check does
not protect.

#### Scenario: Both red/green deficiencies are simulated
- **WHEN** the category colours are checked
- **THEN** each pair is measured under simulated deuteranopia and under simulated protanopia
- **AND** each measurement is compared against the declared threshold for that surface

#### Scenario: A pair below the threshold fails, naming it
- **WHEN** two category colours simulate to a distance below the declared threshold
- **THEN** the check fails naming both colours, the deficiency and the measured distance

#### Scenario: The pool's palette is covered by the same check
- **WHEN** the check runs
- **THEN** the colours the pool's images are drawn with are measured by it, not only the colours on screens

#### Scenario: A category colour outside the declared palette fails the check
- **WHEN** a screen draws a category in a colour that is not one of the declared palette tokens
- **THEN** the check fails naming where that colour was found

### Requirement: The check compares colours the way a viewer meets them

The comparison SHALL be made between the colours two images of different categories can
actually show, over the full range of every attribute they are drawn from — including two
images drawn under different lighting. Comparing only images lit alike would pass a palette
that is unreadable in practice, because per-image lighting moves apparent lightness further
than the categories differ from each other.

Under each simulated deficiency the lightness ranges of two categories' body colours SHALL
NOT overlap, and SHALL be separated by the declared margin. This is the property that makes
the distinction survive an illumination difference: a dichromat has lightness and little
else, so two categories whose lightness ranges interleave are two categories that cannot be
told apart, whatever their hues were chosen to be.

A specular highlight SHALL be excluded from the comparison and SHALL cover at most a sixth
of the body it sits on, so that it reads as a highlight rather than as the body's colour. A
highlight allowed past that bound is a second body colour and SHALL be compared as one.

#### Scenario: Differently lit images are compared
- **WHEN** the category colours of a pool are checked
- **THEN** the measurement covers pairs drawn from different lighting values, not only pairs drawn from the same one

#### Scenario: Overlapping simulated lightness ranges fail the check
- **WHEN** two categories' body colours simulate to overlapping lightness ranges under either deficiency
- **THEN** the check fails naming the two categories and the overlap

#### Scenario: The lightness ranges keep the declared margin
- **WHEN** the two categories' simulated lightness ranges are compared
- **THEN** the gap between them is at least the declared margin

#### Scenario: The specular highlight stays a highlight
- **WHEN** an image is drawn at the largest highlight its attributes allow
- **THEN** the highlight covers at most a sixth of the body
- **AND** it is excluded from the colour comparison

### Requirement: Colour category is carried by colour alone in a pool's images

The hue an image is drawn from SHALL determine the colour its body is filled with and
nothing else about the drawing. No other part — the silhouette, the shading, the highlight,
or any pattern a later pool adds — SHALL vary with hue.

Colour deficiency SHALL therefore be answered by the palette, never by marking one colour
differently from another. A pattern that distinguished red from green would let a model
reach a colour judgement through a pattern feature, which collapses the feature-model
ceiling authored on the premise that pattern carries cultivar identity and nothing else.
Whatever pattern a later pool introduces, it SHALL be independent of hue.

#### Scenario: Hue moves the body colour and nothing else
- **WHEN** two images differing only in hue are drawn
- **THEN** only the colour their bodies are filled with differs
- **AND** the silhouette, the shading and the highlight are identical

#### Scenario: A pattern correlated with hue is refused
- **WHEN** a pool draws a pattern whose presence or strength depends on the hue an image was drawn from
- **THEN** generation is refused naming that dependency

### Requirement: A marking that carries a category stays visible against the body it marks

Where a category is carried by a marking drawn over an image's body rather than by the
body's colour, at least one element of that marking SHALL clear the declared distance from
every body colour it can be drawn over, under each simulated deficiency. A marking that
clears the distance only under normal vision SHALL fail the check naming the element and
the body colour it disappears against.

Not every element need clear it. A marking is a shape made of parts, and it is enough that
the part carrying the shape stays visible; requiring it of every part would forbid the
shadowed detail that makes the shape read at all.

#### Scenario: The marking clears the threshold under both deficiencies
- **WHEN** the marking is measured against every body colour it can be drawn over
- **THEN** at least one of its elements clears the declared distance under each simulated deficiency

#### Scenario: A marking visible only to normal vision fails the check
- **WHEN** every element of a marking falls below the declared distance under a simulated deficiency
- **THEN** the check fails naming that marking and the body colour it disappears against

### Requirement: Colour is never a category's only cue on a screen

Every distinction a screen draws in colour — a category, an action, a series on a chart —
SHALL also be carried by text or by shape, so that the screen stays readable with its
colours removed. A colour-coded key SHALL name in words what it keys.

This holds however well the palette scores. The verified palette is what makes the images
sortable; this requirement is what keeps the rest of the product legible to the student the
palette does not reach, and it costs nothing to keep.

#### Scenario: A chart's series differ by more than colour
- **WHEN** two series are drawn on the same chart
- **THEN** they differ in stroke pattern as well as in colour

#### Scenario: A key names its series in words
- **WHEN** a colour key is presented
- **THEN** each entry carries the text naming what that colour stands for

#### Scenario: A category shown in colour is also named
- **WHEN** a screen presents a category
- **THEN** the category's declared label is present as text alongside whatever colour carries it

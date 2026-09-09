## MODIFIED Requirements

### Requirement: The crop's size follows the orchard

The number of apples in a year's crop SHALL be read from the state of the farm, opening at
the size the farm's declared orchard bears and growing as that orchard does, so that the
crop harvested is the crop the farm actually bears. A farm recording no usable size SHALL
refuse to draw a crop, naming the size it found.

The farm no longer declares a crop size for the crop to open at. It declares land and what
a unit of land bears, and the opening size is their product — so the sentence "the crop
harvested is the crop the farm actually bears" is now true by construction rather than by
two declared figures agreeing.

#### Scenario: A bigger orchard is a bigger crop
- **WHEN** the farm's orchard grows between one year and the next
- **THEN** the later year's crop holds more apples

#### Scenario: The opening crop is what the declared orchard bears
- **WHEN** a farm is opened and its first crop is drawn
- **THEN** the crop holds the declared opening land times the declared yield per unit of land
- **AND** no separately declared crop size was consulted

#### Scenario: An unusable size refuses rather than assumes
- **WHEN** the farm records no usable crop size
- **THEN** no crop is drawn and the refusal names the size that was found

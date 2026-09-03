"""What a knob value means to the optimizer, and every choice a run does not expose.

Two things live here and nowhere else:

* The knob ids this task's regularization is carried by. The app's screens are forbidden
  from naming a particular lesson's knobs; the trainer is authoring tooling and is
  allowed to, but it is confined to this module so that a second task turns it into
  declared data in one place rather than in a training loop.
* Every fixed hyperparameter. A run may depend on nothing it does not record, so these
  are constants that get written into the artifact's provenance verbatim — not defaults
  scattered through the code, and not an operator's remembered command line.
"""

from __future__ import annotations

#: The declared knob whose value becomes weight decay.
REGULARIZATION_KNOB = "regularization"

#: The declared knob whose value becomes the head's dropout probability.
DROPOUT_KNOB = "dropout"

#: Slider position to weight decay. The scale is logarithmic because the interesting
#: range is: nothing, a nudge, a real pull, and enough to flatten a small model.
WEIGHT_DECAY = {0: 0.0, 1: 1e-4, 2: 1e-3, 3: 1e-2}

#: Everything else a run depends on.
EPOCHS = 40
BATCH_SIZE = 32
LEARNING_RATE = 1e-3
OPTIMIZER = "adam"
LOSS = "cross-entropy"
AUGMENTATION = "none"

#: The seed a run uses unless one is passed. Committed rather than remembered.
RUN_SEED = 20260903


def weight_decay_for(value: float | int) -> float:
    """Weight decay for a declared regularization value, refusing an unmapped one."""
    key = int(value)
    if key != value or key not in WEIGHT_DECAY:
        raise KeyError(f"no weight decay is declared for regularization value {value!r}")
    return WEIGHT_DECAY[key]

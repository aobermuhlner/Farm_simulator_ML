"""Storing a probability distribution so that it decodes back into one.

Three decimals, as plain JSON numbers: ~40 KB per configuration, greppable by image id
and diffable when a configuration is retrained — which matters, because someone has to
read these numbers and decide whether the lesson lands.

Rounding three components independently can move their sum by up to 3 x 0.0005, which is
the tolerance the artifact declares. This encoder does better than the tolerance:
largest-remainder rounding distributes the leftover quanta to the components with the
largest fractional parts, so a stored vector sums to exactly 1.000 and the declared
tolerance is headroom rather than the normal case.

Quantization is not a licence to ship something that is not a distribution: a vector that
will not decode is refused, naming the configuration, the image and the defect.
"""

from __future__ import annotations

from math import floor, isfinite

#: Decimal places a probability is stored at.
DECIMALS = 3

#: One quantum of the stored precision.
QUANTUM = 10**-DECIMALS

#: The declared sum tolerance: the worst rounding error `DECIMALS` can produce over
#: three categories. Never tighter than the precision can meet.
SUM_TOLERANCE = 0.0015

_UNITS = 10**DECIMALS


class EncodingError(RuntimeError):
    """A vector that is not a distribution, named down to the image."""


def encoding_record(categories: int) -> dict:
    """What the artifact declares about how its probabilities are stored."""
    return {
        "decimals": DECIMALS,
        "sumTolerance": max(SUM_TOLERANCE, categories * QUANTUM / 2),
    }


def quantize(
    values: list[float],
    *,
    categories: int,
    configuration: str,
    image_id: str,
) -> list[float]:
    """One distribution, stored at the declared precision and summing to exactly one."""
    if len(values) != categories:
        raise EncodingError(
            f'configuration "{configuration}", image "{image_id}": {len(values)} values '
            f"for {categories} declared categories"
        )
    for value in values:
        if not isfinite(value) or value < 0.0 or value > 1.0:
            raise EncodingError(
                f'configuration "{configuration}", image "{image_id}": value {value!r} is outside [0, 1]'
            )

    total = sum(values)
    if abs(total - 1.0) > 0.01:
        raise EncodingError(
            f'configuration "{configuration}", image "{image_id}": values sum to {total!r}, not one'
        )

    scaled = [value / total * _UNITS for value in values]
    units = [floor(value) for value in scaled]
    remaining = _UNITS - sum(units)

    # Largest remainder: the leftover quanta go to the components that lost the most to
    # flooring, so no component moves by more than one quantum.
    order = sorted(range(len(values)), key=lambda index: scaled[index] - units[index], reverse=True)
    for index in order[:remaining]:
        units[index] += 1

    stored = [round(unit / _UNITS, DECIMALS) for unit in units]
    decoded = sum(stored)
    if abs(decoded - 1.0) > SUM_TOLERANCE:
        raise EncodingError(
            f'configuration "{configuration}", image "{image_id}": stored values sum to {decoded!r}'
        )
    return stored

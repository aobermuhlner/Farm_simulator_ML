"""The convolutional stack a configuration resolves to.

`openspec/specs/model-architecture/spec.md` fixes the form: a sequence of blocks, each
two 3x3 convolutions with a rectified activation after each and then 2x2 max pooling;
channels double from block to block; global average pooling and a dense classifier with
one output per declared category follow, and the dropout knob acts on that head.

The block arithmetic is duplicated here from `src/task/cnn.ts`, which has no shared
runtime with Python. The duplication is made checkable rather than trusted: `architecture`
below is recorded into every artifact, and a Vitest case recomputes it from the
declaration and refuses a divergence, naming the configuration.

Pooling floors, as 2x2 max pooling does, so an odd size loses its last row and column.
"""

from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import nn

from .declaration import Declaration


class ArchitectureError(RuntimeError):
    """A configuration that cannot be built at this task's input resolution."""


@dataclass(frozen=True)
class Architecture:
    """What a run actually built, as it is recorded in the artifact's provenance."""

    blocks: int
    channels: tuple[int, ...]
    spatial: tuple[int, ...]
    parameters: int

    def as_record(self) -> dict:
        return {
            "blocks": self.blocks,
            "channels": list(self.channels),
            "spatial": list(self.spatial),
            "parameters": self.parameters,
        }


def block_channels(base_channels: int, blocks: int) -> tuple[int, ...]:
    """The channel count of each block: the base count, doubling once per block."""
    return tuple(base_channels * 2**block for block in range(blocks))


def block_sizes(input_size: int, blocks: int) -> tuple[int, ...]:
    """The spatial size after each block. Refuses a stack this input cannot support."""
    sizes: list[int] = []
    size = input_size
    for _ in range(blocks):
        size //= 2
        if size < 1:
            raise ArchitectureError(
                f"a {blocks}-block stack pools a {input_size}px input below one spatial position"
            )
        sizes.append(size)
    return tuple(sizes)


class ConvBlock(nn.Module):
    """Two 3x3 convolutions with ReLU, then 2x2 max pooling."""

    def __init__(self, in_channels: int, out_channels: int) -> None:
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.body(x)


class FarmNet(nn.Module):
    """The stack, its global average pooling, and the classifier head."""

    def __init__(self, blocks: int, base_channels: int, dropout: float, categories: int) -> None:
        super().__init__()
        channels = block_channels(base_channels, blocks)

        stack: list[nn.Module] = []
        in_channels = 3
        for out_channels in channels:
            stack.append(ConvBlock(in_channels, out_channels))
            in_channels = out_channels
        self.features = nn.Sequential(*stack)

        self.pool = nn.AdaptiveAvgPool2d(1)
        # Dropout sits on the head, which is the stage the declared knob names. A knob
        # with nowhere to act would teach that the concept does not matter.
        self.dropout = nn.Dropout(p=dropout)
        self.classifier = nn.Linear(channels[-1], categories)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.pool(x).flatten(1)
        return self.classifier(self.dropout(x))


def build_model(
    declaration: Declaration,
    blocks: int,
    base_channels: int,
    dropout: float,
) -> tuple[FarmNet, Architecture]:
    """The model for one configuration, and the architecture record it is built from."""
    sizes = block_sizes(declaration.input_size, blocks)
    channels = block_channels(base_channels, blocks)
    model = FarmNet(
        blocks=blocks,
        base_channels=base_channels,
        dropout=dropout,
        categories=len(declaration.categories),
    )
    parameters = sum(parameter.numel() for parameter in model.parameters())
    return model, Architecture(blocks=blocks, channels=channels, spatial=sizes, parameters=parameters)

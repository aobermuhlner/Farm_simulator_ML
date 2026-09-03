"""The built stack is the one the declaration and the architecture spec describe."""

from __future__ import annotations

import pytest
import torch

from farm_training.declaration import load_declaration
from farm_training.model import ArchitectureError, block_channels, block_sizes, build_model


@pytest.fixture(scope="module")
def declaration():
    return load_declaration("apple-harvest")


def test_channels_double_from_block_to_block(declaration):
    for base in declaration.knob("channels").values:
        channels = block_channels(base, 4)
        assert channels[0] == base
        for earlier, later in zip(channels, channels[1:]):
            assert later == earlier * 2


def test_each_block_halves_the_feature_map(declaration):
    sizes = block_sizes(declaration.input_size, 4)
    assert sizes == (64, 32, 16, 8)
    for earlier, later in zip((declaration.input_size,) + sizes, sizes):
        assert later == earlier // 2


def test_a_stack_the_input_cannot_support_is_refused(declaration):
    with pytest.raises(ArchitectureError, match="8px"):
        block_sizes(8, 5)


def test_builds_a_model_at_every_permitted_width(declaration):
    for base in declaration.knob("channels").values:
        model, architecture = build_model(declaration, blocks=2, base_channels=base, dropout=0.0)
        assert architecture.blocks == 2
        assert architecture.channels == (base, base * 2)
        assert architecture.spatial == (64, 32)
        assert architecture.parameters > 0

        output = model(torch.zeros(2, 3, declaration.input_size, declaration.input_size))
        assert output.shape == (2, len(declaration.categories))


def test_capacity_grows_with_either_knob(declaration):
    def parameters(blocks: int, base: int) -> int:
        return build_model(declaration, blocks=blocks, base_channels=base, dropout=0.0)[1].parameters

    assert parameters(2, 16) > parameters(2, 8)
    assert parameters(3, 16) > parameters(2, 16)


def test_the_head_carries_the_declared_dropout(declaration):
    model, _ = build_model(declaration, blocks=2, base_channels=16, dropout=0.5)
    assert model.dropout.p == 0.5


def test_the_classifier_follows_the_declared_categories(declaration):
    model, _ = build_model(declaration, blocks=2, base_channels=8, dropout=0.0)
    assert model.classifier.out_features == len(declaration.categories)

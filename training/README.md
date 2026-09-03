# Training workspace

Authoring tooling. Trains the models behind each task configuration and writes the
prediction artifacts the web app reads. **Nothing here ships** — the browser trains
nothing and never loads a checkpoint. It reads the JSON artifact this produces.

Kept as its own uv project rather than folded into the repo root, which is a Node
project: the two dependency trees have nothing to say to each other, and the web build
never needs a Python interpreter present.

## Setup

Managed by [uv](https://docs.astral.sh/uv/). The interpreter is pinned in
`.python-version` and uv installs it if it is missing — no system Python is used.

```sh
cd training
uv sync
```

`torch` resolves from PyTorch's CPU wheel index, pinned in `pyproject.toml`. The default
PyPI wheel bundles a CUDA runtime measured in gigabytes, for models that train in under
a minute on a laptop CPU.

Run anything through uv, so the pinned environment is the one that executes:

```sh
uv run python <script>
```

## What it costs

Measured on this machine (8 CPU threads), forward and backward at batch 32, 128px input:

| blocks | parameters | 40 epochs over 160 images |
| --- | --- | --- |
| 2 | 16,755 | ~33 s |
| 3 | 72,275 | ~34 s |
| 4 | 293,907 | ~42 s |

So the whole declared knob grid — 108 configurations — is roughly two hours unattended.
The first run is scoped to three configurations for reviewability, not for compute:
someone has to look at each resulting curve and decide it teaches what it should.

## Layout

- `runs/<configuration-id>/` — checkpoints and review plots per training run. Gitignored:
  authoring by-products, not deliverables.
- The shipped artifact is written to the `predictions` path the task declaration names,
  and is committed.

See `openspec/changes/prediction-artifacts/` for the contract this tooling has to meet.

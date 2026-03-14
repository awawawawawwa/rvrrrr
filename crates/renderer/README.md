# rvrrrr-renderer

Terminal renderer for rvrrrr — consumes widget JSON over stdin, paints to terminal via crossterm with double-buffered cell-level diffing.

## Install

```bash
cargo install rvrrrr-renderer
```

## Usage

This binary is automatically managed by the `@rvrrrr/core` npm package. You don't need to run it directly unless you're developing or using an unsupported platform.

The renderer communicates via NDJSON over stdin/stdout:
- **Receives:** `render`, `resize`, `shutdown`, `error` messages
- **Sends:** `ready`, `rendered`, `error`, `fatal` messages

## Building from source

```bash
cd crates/renderer
cargo build --release
```

The binary will be at `target/release/rvrrrr-renderer`.

# Research Summary: tui-engine

## Stack Consensus

**JS side:** `react-reconciler@0.32.0` + React 19, `yoga-layout@3.2.1` (official Facebook WASM, replaces dead `yoga-wasm-web`), `tsup` for dual CJS/ESM bundling, `vitest` for testing.

**Rust side:** `crossterm@0.29.0` (not ratatui — it conflicts with Yoga's layout role), `tokio` async runtime, `serde`/`serde_json` for deserialization.

**Bridge:** napi-rs v3 as primary (direct function calls, ~22M ops/sec) with stdin/stdout JSON as debug/fallback mode. Child process likely correct for v1 since Rust needs exclusive terminal access (raw mode, alternate screen).

**Distribution:** napi-rs platform packages (7 targets, one npm sub-package per platform, zero postinstall scripts). Plus standalone `tui-engine-renderer` crate on crates.io.

## Table Stakes (Must Replicate from Ink)

- **5 components:** Box (full flexbox + borders), Text (styles + wrapping/truncation), Newline, Spacer, Transform
- **5 hooks:** useInput, useApp, useStdin, useFocus, useFocusManager
- **render() API:** Full Instance (rerender, unmount, waitUntilExit, clear, cleanup)
- **Static component:** Permanent output above dynamic content
- **renderToString():** Synchronous string render
- **Layout:** Full Yoga flexbox, measureElement, terminal resize, text wrapping

Ink's API is small and focused. The hard part is the reconciler + Yoga fork, not the API surface.

## Key Differentiators (Why Switch from Ink)

1. **Zero-flicker rendering** — Ink's biggest pain point (issues #450, #359, #413 span years). Rust renderer with cell-level diffing + synchronized output (Mode 2026) solves this completely.
2. **Sub-millisecond render cycles** — Ratatui achieves sub-ms. Ink's JS output serialization is a bottleneck.
3. **Character-level diffing** — Ink does line-level; Rust can do character-level at native speed.
4. **Color downsampling** — Auto-detect terminal color depth and degrade gracefully.
5. **Kitty keyboard protocol** — Progressive enhancement for modern terminals.

Lead marketing with "zero-flicker."

## Critical Pitfalls

1. **Bridge architecture is the biggest decision** — napi-rs (in-process) vs child process (separate). Child process likely correct since Rust needs terminal ownership. Design transport-agnostic abstraction.
2. **JSON serialization can be a bottleneck** — Full tree at 60fps eats 82% of frame budget. Plan for diff-based protocol or binary encoding.
3. **Text measurement callback** — Bridges JS, Rust, Yoga, and Unicode width. The single most critical function. Must strip ANSI, handle CJK/emoji.
4. **Raw mode restoration** — Broken terminal is worst UX failure. Must survive panics, signals, parent death.
5. **Stdin ownership** — If Rust owns terminal, Rust must parse input and forward to JS. Affects useInput implementation.
6. **Ink defaults differ from CSS** — flexDirection defaults to column, flexShrink to 1. Must match exactly.

## Recommended Build Order

1. Fork Ink's DOM + reconciler (JS) — extract cleanly, resolve hidden coupling
2. Verify Yoga layout integration works independently
3. Design JSON protocol based on actual Yoga output
4. Build Rust renderer (buffer, painter, diff, ANSI emitter)
5. Connect bridge (child process with NDJSON for v1)
6. Implement Ink-compatible render() API
7. Full component + hook parity
8. npm distribution pipeline

The Rust and JS sides can be built in parallel once the JSON schema is agreed upon.

## Anti-Features (Do NOT Build)

- Built-in widgets (tables, charts, forms) — let community packages handle this
- Cell-based rendering frame — throws away Yoga's work
- Custom component API / DSL — React IS the component API
- Own state management — React already has this
- Plugin/middleware system — API surfaces are forever
- GPU rendering — solving the wrong layer

---
*Synthesized: 2026-03-11*

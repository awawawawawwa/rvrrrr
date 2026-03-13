---
phase: 05-bridge-process-management
plan: 01
subsystem: rust-renderer
tags: [ipc, protocol, async, tokio, crossterm, ndjson, tty]
dependency_graph:
  requires: []
  provides: [async-ipc-renderer, input-event-forwarding, headless-mode]
  affects: [bridge-ts-side, integration-tests]
tech_stack:
  added: [futures 0.3, crossterm event-stream feature, tokio rt-multi-thread]
  patterns: [tokio::select! bidirectional IPC, TTY device separation, NDJSON framing]
key_files:
  created:
    - crates/renderer/src/input.rs
  modified:
    - crates/renderer/src/protocol.rs
    - crates/renderer/src/terminal.rs
    - crates/renderer/src/main.rs
    - crates/renderer/src/lib.rs
    - crates/renderer/Cargo.toml
    - crates/renderer/tests/pipeline.rs
    - crates/renderer/tests/render_cycle.rs
decisions:
  - "Use Box<dyn Write + Send> for Terminal writer to support both TTY file and null sink without generics"
  - "Detect TTY via stderr.is_terminal() since stdin/stdout are piped in child-process mode"
  - "Open /dev/tty (Unix) or CONOUT$ (Windows) for rendering writes, keeping stdout free for NDJSON"
  - "Remove ctrlc dependency — crossterm event-stream handles Ctrl+C as a key event naturally"
  - "Use synchronous stdout lock for write_ndjson — single async task writes, no concurrent access"
metrics:
  duration: ~35 minutes
  completed: 2026-03-13T17:22:56Z
  tasks_completed: 3
  files_modified: 8
---

# Phase 05 Plan 01: Bidirectional IPC Protocol Summary

**One-liner:** Async tokio renderer with NDJSON bidirectional IPC — ready/rendered acks, input event forwarding, TTY device separation, and headless CI mode.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend protocol types and add input event mapping | 4f6af1b | protocol.rs, input.rs, lib.rs, tests/ |
| 2 | Add TTY detection to terminal.rs for headless CI support | 32d0e4f | terminal.rs |
| 3 | Refactor main.rs to async tokio with bidirectional IPC | 7ac3043 | main.rs, Cargo.toml |

## What Was Built

### Protocol Types (protocol.rs)
- Renamed `ProtocolMessage` → `InMessage` (JS→Rust) with new `Resize`, `Shutdown` variants and `frameId: u64` on `Render`
- Added `OutMessage` (Rust→JS): `Ready`, `Rendered{frameId}`, `Input{event}`, `Error`, `Fatal`
- All existing tests updated with `frameId` in JSON fixtures; new tests for `OutMessage` serialization

### Input Event Mapping (input.rs)
- `InputEvent` / `KeyInfo` structs in Ink-compatible camelCase JSON shape
- `#[serde(rename = "return")]` on `return_key` to avoid Rust keyword conflict
- `map_crossterm_event()`: maps `KeyEventKind::Press` events only; returns `None` for mouse/resize/release
- Full test coverage: char, Ctrl+C, all arrows, Enter, Escape, Tab, BackTab, Backspace, Delete

### TTY Detection (terminal.rs)
- `Terminal::init()` detects TTY via `std::io::stderr().is_terminal()` (stderr check because stdin/stdout are piped in IPC mode)
- TTY path: opens `/dev/tty` (Unix) or `CONOUT$` (Windows) as rendering writer — keeps stdout free for NDJSON
- Headless path: logs diagnostic to stderr, uses `/dev/null` or `io::sink()` as no-op writer
- `writer()` returns `&mut Box<dyn Write + Send>` — `Box<dyn Write>` is `Sized` and implements `Write`, compatible with `emit_diff`
- `cleanup()` is a no-op in headless mode; panic hook detects TTY before attempting terminal restore

### Async Main Loop (main.rs)
- `#[tokio::main] async fn run()` replaces sync `BufRead::lines()` loop
- Emits `{"type":"ready"}` on stdout immediately after `Terminal::init()`
- TTY mode: `tokio::select!` over `BufReader::new(stdin).lines()` AND `crossterm::event::EventStream`
- Headless mode: stdin-only loop (no EventStream — no terminal to read from)
- stdin EOF → clean exit (BRDG-02); `{"type":"shutdown"}` → clean exit
- `write_ndjson()` uses sync stdout lock — single writer, no races
- Removed `ctrlc` dependency; added `futures = "0.3"` and `crossterm event-stream` feature

## Verification

- `cargo test`: **76 tests, 0 failures** (62 unit + 14 integration)
- Smoke test: piping render + shutdown message produces clean NDJSON on stdout:
  ```
  {"type":"ready"}
  {"type":"rendered","frameId":1}
  ```
  No ANSI/control bytes embedded in output lines

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Integration tests used old ProtocolMessage type**
- Found during: Task 1 verification
- Issue: `tests/pipeline.rs` and `tests/render_cycle.rs` imported `ProtocolMessage` which no longer exists
- Fix: Updated both files to use `InMessage` and added `frameId` to all render JSON fixtures
- Files modified: `tests/pipeline.rs`, `tests/render_cycle.rs`
- Commit: 4f6af1b

**2. [Rule 3 - Blocking] emit_diff incompatible with &mut dyn Write (Sized constraint)**
- Found during: Task 2 build
- Issue: `emit_diff<W: Write>(writer: &mut W)` requires W to be `Sized`; `&mut dyn Write` is not Sized
- Fix: Changed `Terminal::writer()` to return `&mut Box<dyn Write + Send>` — `Box<dyn Write>` is Sized and implements Write
- Files modified: `terminal.rs`
- Commit: 32d0e4f

**3. [Rule 3 - Blocking] tokio::main requires rt-multi-thread feature**
- Found during: Task 3 build
- Issue: Default `#[tokio::main]` requires `rt-multi-thread` feature; original Cargo.toml only had `rt`
- Fix: Added `rt-multi-thread` to tokio features in Cargo.toml
- Files modified: `Cargo.toml`
- Commit: 7ac3043

## Self-Check: PASSED

All key files exist. Task commits verified:
- 4f6af1b: Task 1 (protocol types + input mapping)
- 32d0e4f: Task 2 (TTY detection)
- 7ac3043: Task 3 (async tokio IPC)

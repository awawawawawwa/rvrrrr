# Project State: tui-engine

## Project Reference
See: .gsd/PROJECT.md (updated 2026-03-11)
**Core value:** Ink-compatible DX with Rust-level rendering performance
**Current focus:** Phase 5

## Progress
| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Reconciler & Yoga Layout Foundation | In Progress | 0/0 |
| 2 | Component Layer | In Progress | 0/0 |
| 3 | Widget Protocol | In Progress | 0/0 |
| 4 | Rust Renderer | In Progress | 0/0 |
| 5 | Bridge & Process Management | Complete | 3/3 complete |
| 6 | API Parity — Hooks, Render API & Integration | Pending | 0/0 |
| 7 | Distribution & Packaging | Pending | 0/0 |

## Current Phase
**Phase 5: Bridge & Process Management**
Status: Complete
Current Plan: 05-03 (complete)
Next Plan: Phase 6

## Decisions
- Bridge encodes messages inline with JSON.stringify rather than extending Phase 3 encodeMessage — bridge adds frameId, resize, shutdown, rendered, fatal message types not in ProtocolMessage union
- Single-slot frame coalescing: pendingFrame overwritten on each enqueueRender — ensures latest state wins with no queue buildup
- setInterval send loop uses unref() so Node process exits naturally; 100ms safety timeout prevents stall if rendered ack is missed
- Kill timeout of 2s after shutdown message before SIGKILL
- vitest.config.ts extended to include src/**/__tests__/**/*.test.{ts,tsx} so co-located tests are discovered
- Poll loop (50ms interval) used for ack verification in integration tests to avoid exposing new EventEmitter API

## Memory
- src/bridge/ module complete: IpcRendererBridge class (ipc-child.ts), resolveBinaryPath (binary-resolver.ts), types (types.ts), public index (index.ts)
- src/bridge/__tests__/ test suite: binary-resolver.test.ts (4 tests), ipc-child.test.ts (8 integration tests)
- All Phase 5 requirements fulfilled: BRDG-01, BRDG-02, BRDG-03, BRDG-04, PROT-05
- All bridge code type-checks cleanly with strict TypeScript
- 05-01: Async tokio renderer with NDJSON IPC complete. InMessage/OutMessage enums, input.rs with crossterm→Ink key mapping, TTY detection, headless CI mode.
- 05-01 commits: 4f6af1b (protocol+input), 32d0e4f (TTY detection), 7ac3043 (async main)
- 05-02: IpcRendererBridge + resolveBinaryPath + bridge types complete.
- 05-03: Integration tests passing (12 total). Binary headless mode ensures CI compatibility.

---
*Last updated: 2026-03-13 after 05-03 execution*

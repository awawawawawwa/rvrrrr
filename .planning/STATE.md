---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 06-05 (complete)
status: in_progress
last_updated: "2026-03-14T00:07:59.983Z"
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 11
  completed_plans: 9
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 06-05 (complete)
status: in_progress
last_updated: "2026-03-13T22:12:00.000Z"
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 8
  completed_plans: 8
  percent: 100
  bar: "[██████████] 100%"
---

# Project State: tui-engine

## Project Reference
See: .gsd/PROJECT.md (updated 2026-03-11)
**Core value:** Ink-compatible DX with Rust-level rendering performance
**Current focus:** Phase 6

## Progress
| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Reconciler & Yoga Layout Foundation | In Progress | 0/0 |
| 2 | Component Layer | In Progress | 0/0 |
| 3 | Widget Protocol | In Progress | 0/0 |
| 4 | Rust Renderer | In Progress | 0/0 |
| 5 | Bridge & Process Management | Complete | 3/3 complete |
| 6 | API Parity — Hooks, Render API & Integration | Complete | 5/5 complete |
| 7 | Distribution & Packaging | Pending | 0/0 |

## Current Phase
**Phase 6: API Parity — Hooks, Render API & Integration**
Status: Complete
Current Plan: 06-05 (complete)
Next Plan: Phase 7 (Distribution & Packaging)

## Decisions
- Bridge encodes messages inline with JSON.stringify rather than extending Phase 3 encodeMessage — bridge adds frameId, resize, shutdown, rendered, fatal message types not in ProtocolMessage union
- Single-slot frame coalescing: pendingFrame overwritten on each enqueueRender — ensures latest state wins with no queue buildup
- setInterval send loop uses unref() so Node process exits naturally; 100ms safety timeout prevents stall if rendered ack is missed
- Kill timeout of 2s after shutdown message before SIGKILL
- vitest.config.ts extended to include src/**/__tests__/**/*.test.{ts,tsx} so co-located tests are discovered
- Poll loop (50ms interval) used for ack verification in integration tests to avoid exposing new EventEmitter API
- [Phase 06]: Named createContext import used instead of default React.createContext — required by tsconfig moduleResolution:bundler
- [Phase 06]: createSetRawMode exported as factory function — keeps ref-count state isolated per stdin stream, supports multiple render() calls in tests
- [Phase 06]: parseKeypress accepts Buffer (stdin 'data' event type) and converts with toString('utf8') internally; CSI modifier table: param2=2 shift, 3 meta, 5 ctrl
- [Phase 06-03]: render() entry point: calculateLayout inline, serializeTree.root passed to enqueueRender, FocusManager imperative pattern
- [Phase 06-03]: createContainer cast as any — @types/react-reconciler arg7 typing mismatch with React 19
- [Phase 06]: Stable handler ref in useInput: useRef(handler) updated each render, effect depends only on [isActive, stdin, setRawMode]
- [Phase 06]: @vitest-environment jsdom docblock per test file avoids globally switching non-hook tests to DOM
- [Phase 06]: useFocus generates stable ids via module-level counter held in useRef — survives re-renders without effect re-run
- [Phase 06]: flushSyncFromReconciler required for synchronous DOM commit in renderToString — updateContainerSync alone insufficient
- [Phase 06]: internal_static prop stored directly on DOMElement node (not in attributes Map) — handled specially in reconciler createInstance/commitUpdate
- [Phase 06-05]: src/index.ts replaced with consumer-facing public API barrel — internal index previously exported reconciler/DOM/protocol internals, now exports only the Ink-compatible public surface
- [Phase 07-distribution-packaging]: Crate renamed from tui-engine-renderer to rvrrrr-renderer; internal use paths updated in main.rs; repository URL is placeholder github.com/rvrrrr/rvrrrr

## Memory
- src/bridge/ module complete: IpcRendererBridge class (ipc-child.ts), resolveBinaryPath (binary-resolver.ts), types (types.ts), public index (index.ts)
- src/bridge/__tests__/ test suite: binary-resolver.test.ts (4 tests), ipc-child.test.ts (8 integration tests)
- All Phase 5 requirements fulfilled: BRDG-01, BRDG-02, BRDG-03, BRDG-04, PROT-05
- All bridge code type-checks cleanly with strict TypeScript
- 05-01: Async tokio renderer with NDJSON IPC complete. InMessage/OutMessage enums, input.rs with crossterm→Ink key mapping, TTY detection, headless CI mode.
- 05-01 commits: 4f6af1b (protocol+input), 32d0e4f (TTY detection), 7ac3043 (async main)
- 05-02: IpcRendererBridge + resolveBinaryPath + bridge types complete.
- 05-03: Integration tests passing (12 total). Binary headless mode ensures CI compatibility.

## Phase 6 Memory
- src/contexts/ created: app-context.ts (AppContext), stdin-context.ts (StdinContext + createSetRawMode), focus-context.ts (FocusContext), index.ts re-exports
- src/hooks/types.ts: Key type with 14 boolean fields matching Ink's interface
- src/hooks/parse-keypress.ts: full escape sequence parser — CSI, meta prefix, ctrl+a-z, return, tab, backspace, escape, plain chars
- src/hooks/__tests__/parse-keypress.test.ts: 17 passing tests
- All Phase 6 contexts type-check cleanly; npx tsc --noEmit passes
- HOOK-01 through HOOK-05 requirements marked complete
- src/render/ created: types.ts (RenderOptions, Instance), render.ts (render() entry point), __tests__/render.test.ts (8 tests)
- render() wires reconciler -> Yoga layout -> serializeTree -> bridge.enqueueRender
- resize event on stdout triggers re-layout + re-render + bridge.sendResize
- unmount() removes all listeners, shuts down bridge, resolves waitUntilExit promise
- RAPI-01 through RAPI-05, LYOT-07, RUST-10 requirements marked complete
- ansi-escapes added as dependency for Instance.clear()
- 06-04: Output (character grid), renderToString (flushSyncFromReconciler pattern), measureElement, Static, patchConsole, render/index.ts all complete
- RAPI-06 through RAPI-09 requirements marked complete
- 27 tests passing across render and component suites (TDD: 19 new + 8 pre-existing)
- 06-05: src/index.ts wired as public API barrel — 164/164 tests pass, tsc --noEmit clean
- RAPI-01, RAPI-06, RAPI-07 requirements marked complete via 06-05
- Phase 6 COMPLETE: full Ink-compatible API parity achieved

---
*Last updated: 2026-03-13 after 06-05 execution*

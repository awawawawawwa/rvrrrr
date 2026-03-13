---
phase: 05-bridge-process-management
plan: 02
subsystem: bridge
tags: [ipc, child_process, process-lifecycle, throttling, ndjson, typescript]

# Dependency graph
requires:
  - phase: 05-bridge-process-management
    provides: Phase context and research on bridge design
  - phase: 03-widget-protocol
    provides: WidgetNode, ProtocolMessage types used in render messages

provides:
  - IpcRendererBridge class with spawn, ready-wait, render throttling, graceful shutdown
  - resolveBinaryPath: 3-tier binary lookup (explicit path, cargo dev build, PATH)
  - Bridge TypeScript types (BridgeOptions, BridgeState, InputEvent, KeyInfo, RendererMessageIn, RendererMessageOut)
  - Public bridge module at src/bridge/index.ts

affects: [06-api-hooks-render, phase-wiring, integration-testing]

# Tech tracking
tech-stack:
  added: [node:child_process, node:fs, node:path, node:url]
  patterns:
    - Single-slot frame coalescing (newer frames overwrite pending — no queue buildup)
    - setInterval throttled send loop with backpressure ack tracking
    - NDJSON line buffering with partial-line accumulation
    - Signal handler registration with cleanup references to prevent listener leaks

key-files:
  created:
    - src/bridge/types.ts
    - src/bridge/binary-resolver.ts
    - src/bridge/ipc-child.ts
    - src/bridge/index.ts
  modified: []

key-decisions:
  - "Encode bridge messages inline with JSON.stringify + '\\n' rather than extending encodeMessage — bridge types include frameId and new message types not in the original Phase 3 protocol"
  - "Single-slot frame coalescing: pendingFrame is overwritten by each enqueueRender call, ensuring latest state always wins and no unbounded queue can form"
  - "Backpressure: send loop skips if lastAckedFrameId < lastSentFrameId unless 100ms safety timeout elapses, preventing Rust from being overwhelmed"
  - "Kill timeout of 2 seconds after shutdown message before SIGKILL ensures graceful cleanup window"
  - "unref() on send interval so Node process can exit naturally without waiting for the interval"

patterns-established:
  - "NDJSON bridge: JSON.stringify + newline over child.stdin, parse on child.stdout with line-buffer accumulation"
  - "Signal handler lifecycle: register in constructor with stored references, remove in shutdown() to prevent leaks"
  - "BridgeState machine: starting -> ready -> running -> stopping -> stopped (or crashed on unexpected exit)"

requirements-completed: [BRDG-01, BRDG-03, BRDG-04]

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 05 Plan 02: Bridge Types, Binary Resolver, and IpcRendererBridge Summary

**Node.js IPC bridge that spawns the Rust renderer binary, waits for ready signal, throttles render frames at configurable FPS via single-slot coalescing, and shuts down gracefully on signals or unmount**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-13T09:17:02Z
- **Completed:** 2026-03-13T09:25:00Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments
- IpcRendererBridge class with full process lifecycle: spawn, ready-wait, render enqueue, graceful shutdown
- 3-tier binary resolver: explicit path override, cargo debug/release output, system PATH lookup
- Single-slot frame coalescing with setInterval throttling at configurable maxFps (default 30)
- Backpressure tracking via lastAckedFrameId / lastSentFrameId with 100ms safety timeout
- Signal handlers for SIGINT, SIGTERM, and uncaughtException with proper cleanup on shutdown

## Task Commits

Each task was committed atomically:

1. **Task 1: Bridge types, binary resolver, and protocol extensions** - `3d05cae` (feat)
2. **Task 2: IpcRendererBridge class with lifecycle, shutdown, and throttling** - `75f8451` (feat)

## Files Created/Modified
- `src/bridge/types.ts` - BridgeOptions, BridgeState, InputEvent, KeyInfo, RendererMessageIn/Out union types
- `src/bridge/binary-resolver.ts` - resolveBinaryPath() with 3-tier lookup strategy
- `src/bridge/ipc-child.ts` - IpcRendererBridge class (spawn, ready-wait, throttled send loop, shutdown, signals)
- `src/bridge/index.ts` - Public re-exports for the bridge module

## Decisions Made
- Did not modify `src/protocol/types.ts` or `src/protocol/ndjson.ts` — bridge uses inline JSON.stringify since it adds frameId and new message types (resize, shutdown, rendered, fatal) not in the Phase 3 ProtocolMessage union
- Used `unref()` on the setInterval so the Node process is not kept alive solely by the send loop
- Safety timeout of 100ms in the send loop prevents indefinite stall if a rendered ack is missed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/bridge/` module is complete and type-checks cleanly
- IpcRendererBridge is ready to be wired into the render API (Phase 6)
- Phase 6 useInput hook can subscribe to onInput callback on the bridge instance

---
*Phase: 05-bridge-process-management*
*Completed: 2026-03-13*

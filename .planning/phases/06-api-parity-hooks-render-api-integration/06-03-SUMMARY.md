---
phase: 06-api-parity-hooks-render-api-integration
plan: 03
subsystem: render
tags: [react, render, bridge, lifecycle, yoga, resize, instance]

# Dependency graph
requires:
  - phase: 06-01
    provides: AppContext, StdinContext, FocusContext, createSetRawMode, parseKeypress
  - phase: 05-bridge-process-management
    provides: IpcRendererBridge with enqueueRender, sendResize, shutdown, waitForReady
  - phase: 01-reconciler
    provides: reconciler.createContainer + updateContainer
  - phase: 03-widget-protocol
    provides: serializeTree
provides:
  - render() entry point wiring reconciler -> Yoga layout -> serializeTree -> bridge.enqueueRender
  - Instance with rerender, unmount, waitUntilExit, clear
  - Terminal resize: stdout 'resize' -> re-layout + re-render + bridge.sendResize
  - AppContext, StdinContext, FocusContext provisioned per render() call
  - RenderOptions and Instance TypeScript types
affects: [06-04-hooks, src/index.ts]

# Tech tracking
tech-stack:
  added:
    - ansi-escapes@7.x (clearTerminal for Instance.clear())
  patterns:
    - Imperative FocusManager (plain object with getter properties) — avoids React state outside component tree
    - Pitfall 4 guard: bridge.waitForReady().then(() => rootNode.onRender()) — pushes dropped first frame
    - createContainer cast as any — @types/react-reconciler typing mismatch on arg 7
    - TDD RED -> GREEN with vi.mock for IpcRendererBridge — no real Rust binary in tests

key-files:
  created:
    - src/render/types.ts
    - src/render/render.ts
    - src/render/__tests__/render.test.ts
  modified:
    - package.json (added ansi-escapes dependency)

key-decisions:
  - "calculateLayout implemented inline in render.ts (not as a shared module) — Yoga.DIRECTION_LTR called on rootNode.yogaNode.calculateLayout"
  - "serializeTree returns RenderMessage; bridge.enqueueRender takes WidgetNode — onRender passes tree.root (not full message)"
  - "FocusContext managed imperatively (plain object with getter properties) rather than React state — state lives outside React tree"
  - "createContainer called as (reconciler as any).createContainer to avoid @types/react-reconciler arg7 type mismatch"
  - "unmount() guards double-call with unmounted flag — safe to call multiple times"

patterns-established:
  - "Pattern: waitForReady().then(onRender) — handles first-frame drop when reconciler commits before bridge is ready"
  - "Pattern: stdout.on/off resize in render/unmount pair — listener cleanup prevents MaxListeners warning in tests"

requirements-completed: [RAPI-01, RAPI-02, RAPI-03, RAPI-04, RAPI-05, LYOT-07, RUST-10]

# Metrics
duration: 10min
completed: 2026-03-13
---

# Phase 6 Plan 03: Render API — render() Entry Point and Instance Lifecycle Summary

**render() entry point wiring reconciler -> Yoga layout -> serializeTree -> bridge.enqueueRender, with full Instance lifecycle (rerender, unmount, waitUntilExit, clear) and terminal resize handling**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-13T21:45:00Z
- **Completed:** 2026-03-13T21:51:53Z
- **Tasks:** 2
- **Files modified:** 4 (types.ts, render.ts, render.test.ts, package.json)

## Accomplishments

- `src/render/types.ts`: `RenderOptions` and `Instance` interfaces exported with full Ink-compatible shape
- `src/render/render.ts`: `render()` wires all building blocks from Phases 1-5 into the complete pipeline
- Terminal resize listener: `stdout.on('resize')` → `onComputeLayout` → `onRender` → `bridge.sendResize(cols, rows)` — resize first (immediate), render queued
- Context provisioning: each `render()` call provides `AppContext`, `StdinContext` (with ref-counted `setRawMode`), `FocusContext` (imperative manager)
- Pitfall 4 guard: `bridge.waitForReady().then(() => rootNode.onRender?.())` pushes any frame dropped during bridge startup
- Instance lifecycle: `unmount()` removes resize and ctrl+C listeners, calls `reconciler.updateContainer(null)`, then `bridge.shutdown()`, then resolves `waitUntilExit()` promise
- 8 tests pass with mocked `IpcRendererBridge` — no real Rust binary needed

## Task Commits

1. **Task 1: Define render types** - `5133151` (feat)
2. **Task 2: TDD RED — failing render() tests** - `45b2414` (test)
3. **Task 2: TDD GREEN — implement render()** - `7045f03` (feat)

## Files Created/Modified

- `src/render/types.ts` — `RenderOptions` and `Instance` interface definitions
- `src/render/render.ts` — `render()` function with full pipeline wiring and Instance implementation
- `src/render/__tests__/render.test.ts` — 8 tests: Instance API, unmount lifecycle, clear(), resize, rerender
- `package.json` — added `ansi-escapes` dependency for `clearTerminal`

## Decisions Made

- `calculateLayout` inline in render.ts using `rootNode.yogaNode!.calculateLayout(width, height, Yoga.DIRECTION_LTR)` — no separate module needed
- `serializeTree(rootNode)` returns `RenderMessage`; `bridge.enqueueRender` takes `WidgetNode` — pass `tree.root`
- `FocusManager` is an imperative plain object with getter properties for `activeId` and `isFocusEnabled` — avoids needing React state outside the component tree
- `(reconciler as any).createContainer(...)` — `@types/react-reconciler` incorrectly types argument 7 as a callback; cast resolves it
- `unmounted` guard flag on `Instance.unmount()` prevents double-unmount in test teardown

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Type Safety] Cast createContainer as any**
- **Found during:** Task 2 GREEN phase type check
- **Issue:** `@types/react-reconciler` typed arg 7 of `createContainer` as `(error: Error) => void`, but the correct React 19 argument is `{}` (transition context)
- **Fix:** Added `(reconciler as any).createContainer(...)` cast — same pattern will be needed by other callers
- **Files modified:** `src/render/render.ts`
- **Commit:** `7045f03`

## Self-Check: PASSED

- `src/render/types.ts` — FOUND
- `src/render/render.ts` — FOUND
- `src/render/__tests__/render.test.ts` — FOUND
- Commits: `5133151`, `45b2414`, `7045f03` — all in git log
- All 8 tests pass: `npx vitest run src/render/__tests__/render.test.ts`

## Next Phase Readiness

- `render()` is complete and ready for integration with hooks (Plan 02/04) and the public `src/index.ts` export
- All RAPI-01 through RAPI-05, LYOT-07, RUST-10 requirements fulfilled
- No blockers

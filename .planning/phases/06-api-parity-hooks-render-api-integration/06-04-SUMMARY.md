---
phase: 06-api-parity-hooks-render-api-integration
plan: "04"
subsystem: render-api
tags: [render, output, static, console-patch, testing]
dependency_graph:
  requires: ["06-02", "06-03"]
  provides: [renderToString, measureElement, Output, Static, patchConsole, render-index]
  affects: [src/render/index.ts, src/components/index.ts]
tech_stack:
  added: []
  patterns:
    - "flushSyncFromReconciler for synchronous DOM population in renderToString"
    - "Character grid (Map<row, Map<col, char>>) for Output class"
    - "useRef previousCount for incremental Static rendering"
key_files:
  created:
    - src/render/output.ts
    - src/render/render-to-string.ts
    - src/render/measure-element.ts
    - src/render/patch-console.ts
    - src/render/index.ts
    - src/components/Static.tsx
    - src/render/__tests__/render-to-string.test.ts
    - src/render/__tests__/measure-element.test.ts
    - src/render/__tests__/patch-console.test.ts
    - src/components/__tests__/static.test.tsx
  modified:
    - src/reconciler/reconciler.ts
    - src/components/index.ts
    - src/components/ink-jsx.d.ts
decisions:
  - "flushSyncFromReconciler (not updateContainerSync or batchedUpdates) is required to flush the React reconciler synchronously for renderToString — updateContainerSync alone does not commit work to the DOM"
  - "Output class stores ANSI escape sequences in the column Map at their logical position with zero display-width advancement, preserving them in final output"
  - "Static component returns null for empty items to avoid empty ink-box nodes in the tree"
  - "internal_static prop handled specially in reconciler createInstance/commitUpdate — stored on node directly, not in node.attributes"
metrics:
  duration_seconds: 541
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 10
  files_modified: 3
---

# Phase 06 Plan 04: Static, renderToString, measureElement, patchConsole Summary

One-liner: JS-side Output character grid + synchronous renderToString via flushSyncFromReconciler, plus Static incremental rendering and console interception.

## What Was Built

### Task 1: Output, renderToString, measureElement

**src/render/output.ts** — Character grid renderer. Uses `Map<row, Map<col, char>>` to place characters at (x, y) positions. Handles ANSI escape sequences (zero display width, preserved in output). `get(width, height)` builds the final newline-joined string and trims trailing empty rows.

**src/render/render-to-string.ts** — Synchronous string renderer. Uses `flushSyncFromReconciler` to guarantee the React reconciler commits work to the DOM before layout is calculated. Walks the committed DOM tree and paints `ink-text` nodes to an `Output` instance via `squashTextNodes` + `wrapText`. Cleans up by unmounting after painting.

**src/render/measure-element.ts** — Reads `yogaNode.getComputedWidth()` and `getComputedHeight()` from a ref. Returns `{width: 0, height: 0}` for unmounted/missing nodes.

### Task 2: Static, patchConsole, render index

**src/components/Static.tsx** — Generic component that tracks `previousCount` via `useRef` and only renders newly-added items. Sets `internal_static={true}` on its root `ink-box` to signal the render pipeline.

**src/render/patch-console.ts** — Saves originals of `console.log/warn/error`, replaces them with wrappers that call `util.format(...args) + '\n'` and pass to `write`. Returns restore function.

**src/render/index.ts** — Public re-export: `render`, `renderToString`, `measureElement`, `patchConsole`, `RenderOptions`, `Instance`.

**src/reconciler/reconciler.ts** — Added `internal_static` handling in `createInstance` and `commitUpdate` (stored on node directly, not in attributes Map).

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| render-to-string.test.ts | 5 | pass |
| measure-element.test.ts | 4 | pass |
| static.test.tsx | 4 | pass |
| patch-console.test.ts | 6 | pass |
| render.test.ts (pre-existing) | 8 | pass |
| **Total** | **27** | **all pass** |

TypeScript: `npx tsc --noEmit` — clean (no errors).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] reconciler.updateContainer does not flush synchronously for renderToString**
- **Found during:** Task 1 — tests showed empty string output despite DOM not being populated
- **Issue:** `updateContainer`, `updateContainerSync`, and `batchedUpdates` all fail to commit React work before returning control. The React reconciler schedules work through its internal fiber queue.
- **Fix:** Used `reconciler.flushSyncFromReconciler(() => { updateContainer(...) })` which forces synchronous commit before returning.
- **Files modified:** src/render/render-to-string.ts
- **Commit:** 5649f2e

**2. [Rule 2 - Missing] reconciler did not handle internal_static prop on DOMElement**
- **Found during:** Task 2 — Static component sets `internal_static={true}` on ink-box, but reconciler was storing it in `node.attributes` (wrong field) instead of `node.internal_static`
- **Fix:** Added `internal_static` handling in `createInstance` and `commitUpdate`, excluded from `setAttribute` loop
- **Files modified:** src/reconciler/reconciler.ts
- **Commit:** 795c65f

**3. [Rule 1 - Bug] TypeScript inference failure with generic Static component in tests**
- **Found during:** Task 2 — `React.createElement(Static, props)` cannot infer generic T, causing type errors
- **Fix:** Rewrote tests using JSX syntax (`<Static items={items}>`) which TypeScript infers correctly
- **Files modified:** src/components/__tests__/static.test.tsx
- **Commit:** 795c65f

## Commits

| Hash | Description |
|------|-------------|
| 5649f2e | feat(06-04): implement Output class, renderToString, and measureElement |
| 795c65f | feat(06-04): implement Static component, patchConsole, and render index |

## Self-Check: PASSED

All created files verified present on disk. Both task commits (5649f2e, 795c65f) confirmed in git log.

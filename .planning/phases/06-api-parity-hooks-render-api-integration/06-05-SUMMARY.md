---
phase: 06-api-parity-hooks-render-api-integration
plan: 05
subsystem: api
tags: [typescript, public-api, ink-compatible, re-exports]

# Dependency graph
requires:
  - phase: 06-02
    provides: hooks (useInput, useApp, useStdin, useFocus, useFocusManager) + Key type
  - phase: 06-03
    provides: render() entry point, RenderOptions, Instance types
  - phase: 06-04
    provides: renderToString, measureElement, patchConsole, Static component, render/index.ts barrel

provides:
  - Single-import public API surface for tui-engine (src/index.ts)
  - All Ink-compatible exports accessible via one import path

affects: [07-distribution-packaging]

# Tech tracking
tech-stack:
  added: []
  patterns: [barrel-export, single-entry-point]

key-files:
  created: []
  modified:
    - src/index.ts

key-decisions:
  - "Replaced internal-facing index.ts (reconciler/DOM/protocol exports) with consumer-facing public API re-exports matching Ink's surface"
  - "StaticProps included in component type exports alongside the component itself"
  - "DOMElement type exported for measureElement ref typing, enabling typed React.useRef<DOMElement> usage by consumers"

patterns-established:
  - "Public API barrel: src/index.ts re-exports from src/render/index.js, src/hooks/index.js, src/components/index.js"

requirements-completed: [RAPI-01, RAPI-06, RAPI-07]

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 6 Plan 05: Public API Index Summary

**Ink-compatible single-import public API surface wired in src/index.ts — render(), hooks, all six components, and types consumable via one package import**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-13T22:07:13Z
- **Completed:** 2026-03-13T22:12:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced internal-facing `src/index.ts` with consumer-facing public API barrel exporting the full Ink-compatible surface
- All four render functions (render, renderToString, measureElement, patchConsole) plus types (RenderOptions, Instance) exported
- All five hooks (useInput, useApp, useStdin, useFocus, useFocusManager) plus Key type exported
- All six components (Box, Text, Newline, Spacer, Transform, Static) plus their prop types exported
- DOMElement type exported for typed measureElement ref usage
- Full type-check (`npx tsc --noEmit`) passes clean
- Full test suite passes: 164/164 tests across 22 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire public API index and run full verification** - `b6542b7` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/index.ts` - Replaced with complete public API re-export barrel (render API + hooks + components + types)

## Decisions Made

- Replaced internal-facing index (reconciler, DOM ops, layout, protocol) with consumer-facing public API — internal modules are imported directly by their consumers within the package; index.ts serves as the external package entry point
- `StaticProps` included in component type re-exports alongside `Static` for complete type coverage
- `DOMElement` from `src/dom/types.ts` exported to enable typed `React.useRef<DOMElement>` in consumer code (needed for `measureElement`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 6 complete: full Ink-compatible API parity achieved
- `src/index.ts` exports the same surface as Ink: render + hooks + components + types
- Ready for Phase 7: Distribution & Packaging — package.json exports field, build pipeline, npm publish

---
*Phase: 06-api-parity-hooks-render-api-integration*
*Completed: 2026-03-13*

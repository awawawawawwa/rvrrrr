---
phase: 06-api-parity-hooks-render-api-integration
plan: 01
subsystem: ui
tags: [react, context, hooks, stdin, key-parsing, tty, escape-sequences]

# Dependency graph
requires:
  - phase: 05-bridge-process-management
    provides: IpcRendererBridge, bridge types, and process lifecycle already complete
provides:
  - AppContext with exit(error?) callback
  - StdinContext with stdin, isRawModeSupported, and ref-counted setRawMode
  - FocusContext with ordered focus registry (add/remove/next/previous/focus/enableFocus/disableFocus)
  - Key type with all 14 boolean fields matching Ink's interface
  - parseKeypress function handling the full escape sequence table (CSI, meta, ctrl, plain chars)
affects: [06-02-hooks, 06-03-render-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Named React context imports (createContext from 'react', not default React.createContext) per tsconfig moduleResolution:bundler
    - Reference-counted setRawMode wrapper (createSetRawMode) prevents race conditions when multiple hooks share raw mode
    - TDD red-green for escape sequence parser — 17 failing tests committed before implementation

key-files:
  created:
    - src/contexts/app-context.ts
    - src/contexts/stdin-context.ts
    - src/contexts/focus-context.ts
    - src/contexts/index.ts
    - src/hooks/types.ts
    - src/hooks/parse-keypress.ts
    - src/hooks/__tests__/parse-keypress.test.ts
  modified: []

key-decisions:
  - "Named createContext import used instead of default React.createContext — required by tsconfig moduleResolution:bundler with strict mode"
  - "createSetRawMode exported as factory function so render() can create one instance per stdin stream, keeping state isolated"
  - "FocusContext shape matches Ink 4.x exactly: activeId, add, remove, next, previous, focus, enableFocus, disableFocus, isFocusEnabled"
  - "parseKeypress accepts Buffer (not string) matching stdin 'data' event signature; converts internally with toString('utf8')"
  - "CSI modifier table: param2=2 shift, param2=3 meta, param2=5 ctrl, param2=6 ctrl+shift — matches xterm standard"

patterns-established:
  - "Pattern: createContext with undefined-cast default — throws clearly if consumed outside provider, avoids runtime ambiguity"
  - "Pattern: TDD for escape sequence parser — write all 17 test cases first, then minimal implementation to pass"

requirements-completed: [HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05]

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 6 Plan 01: Contexts and Key Parsing Summary

**React contexts (AppContext, StdinContext, FocusContext) and escape-sequence parser providing the foundational contracts for all five Ink-compatible hooks**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T16:43:52Z
- **Completed:** 2026-03-13T21:46:05Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Three React contexts created with correct TypeScript types; FocusContext shape matches Ink 4.x exactly
- StdinContext includes `createSetRawMode` factory producing a reference-counted wrapper to prevent raw mode races
- `parseKeypress` handles the complete escape sequence table: CSI arrows, page up/down, delete, shift/ctrl/meta modifiers, meta prefix, ctrl+a–z, return, tab, backspace, escape, and plain chars
- 17 tests pass covering every behavior case specified in the plan

## Task Commits

Each task was committed atomically:

1. **Task 1: Create contexts and Key type** - `243be9d` (feat)
2. **Task 2: TDD RED — add failing parseKeypress tests** - `3561dce` (test)
3. **Task 2: TDD GREEN — implement parseKeypress** - `c36c283` (feat)

**Plan metadata:** _(final docs commit follows)_

_Note: Task 2 used TDD: test commit (3561dce) then implementation commit (c36c283)._

## Files Created/Modified
- `src/contexts/app-context.ts` - AppContext with exit(error?) callback type
- `src/contexts/stdin-context.ts` - StdinContext + createSetRawMode factory with reference counting
- `src/contexts/focus-context.ts` - FocusContext with full focus registry shape
- `src/contexts/index.ts` - Re-exports all three contexts and types
- `src/hooks/types.ts` - Key type with 14 boolean fields (Ink-compatible)
- `src/hooks/parse-keypress.ts` - Escape sequence parser (CSI, meta, ctrl, plain chars)
- `src/hooks/__tests__/parse-keypress.test.ts` - 17 test cases for parseKeypress

## Decisions Made
- Named `createContext` import (not `React.createContext`) required by tsconfig `moduleResolution: bundler` with strict mode
- `createSetRawMode` exported as a factory function so each `render()` call gets an isolated counter per stdin stream
- FocusContext shape copied exactly from Ink 4.x to ensure hook compatibility in Plan 02
- `parseKeypress` takes `Buffer` matching the stdin `'data'` event signature; converts with `toString('utf8')` internally

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript error on `import React from 'react'` — project uses `moduleResolution: bundler` with strict mode which requires named imports. Fixed by switching to `import {createContext} from 'react'`. (Rule 3 auto-fix, inline during Task 1.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three contexts are ready to be provided by `render()` in Plan 03
- `parseKeypress` is ready to be consumed by `useInput` in Plan 02
- `Key` type is exported and ready for all hook signatures
- No blockers; Plan 02 (hooks) can proceed immediately

---
*Phase: 06-api-parity-hooks-render-api-integration*
*Completed: 2026-03-13*

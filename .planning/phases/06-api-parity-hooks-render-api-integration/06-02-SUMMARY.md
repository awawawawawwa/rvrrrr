---
phase: 06-api-parity-hooks-render-api-integration
plan: 02
subsystem: ui
tags: [react, hooks, tui, ink-compatibility, useInput, useApp, useStdin, useFocus, useFocusManager]

requires:
  - phase: 06-01
    provides: AppContext, StdinContext, FocusContext, parseKeypress, Key type

provides:
  - useInput hook with stdin listener, raw mode lifecycle, and parseKeypress integration
  - useApp hook consuming AppContext with guard
  - useStdin hook consuming StdinContext with guard
  - useFocus hook with focus registration, autoFocus, isActive, and isFocused derivation
  - useFocusManager hook delegating all navigation methods to FocusContext
  - src/hooks/index.ts re-exporting all five hooks and Key type

affects:
  - 06-03-render-api (render() uses hooks indirectly via providers)
  - downstream consumers importing from src/hooks/index.ts

tech-stack:
  added:
    - "@testing-library/react ^14 (dev) — renderHook for hook unit tests"
    - "jsdom (dev) — DOM environment for @testing-library/react in vitest"
  patterns:
    - "Stable handler ref pattern: useRef to hold latest handler, prevents re-subscription on re-render"
    - "Context guard pattern: useContext + undefined check + throw for all hook consumers"
    - "jsdom vitest environment: // @vitest-environment jsdom docblock per test file"
    - "TDD: RED commit of test files before GREEN implementation"

key-files:
  created:
    - src/hooks/use-input.ts
    - src/hooks/use-app.ts
    - src/hooks/use-stdin.ts
    - src/hooks/use-focus.ts
    - src/hooks/use-focus-manager.ts
    - src/hooks/index.ts
    - src/hooks/__tests__/use-input.test.ts
    - src/hooks/__tests__/use-app.test.ts
    - src/hooks/__tests__/use-stdin.test.ts
    - src/hooks/__tests__/use-focus.test.ts
    - src/hooks/__tests__/use-focus-manager.test.ts
  modified:
    - package.json (added @testing-library/react, jsdom)

key-decisions:
  - "Stable handler ref in useInput: useRef(handler) updated each render, effect depends only on [isActive, stdin, setRawMode] — matches Ink behavior exactly"
  - "@testing-library/react + jsdom chosen over custom renderHook — standard React testing idiom, less boilerplate"
  - "// @vitest-environment jsdom docblock per test file — avoids globally switching non-React tests to DOM environment"
  - "useFocus generates stable ids via module-level counter (focusIdCounter) held in useRef — survives re-renders without triggering effect re-run"
  - "isFocused = isActive && isFocusEnabled && activeId === id — all three conditions required per Ink semantics"

patterns-established:
  - "All context-consuming hooks follow: useContext + undefined guard + return value pattern"
  - "TDD per task: RED commit (test files) then GREEN commit (implementation)"
  - "Hook tests use createWrapper helper returning Provider JSX — consistent pattern across all hook tests"

requirements-completed: [HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05]

duration: 4min
completed: 2026-03-13
---

# Phase 06 Plan 02: Hooks Implementation Summary

**Five Ink-compatible React hooks (useInput, useApp, useStdin, useFocus, useFocusManager) with stable handler ref pattern, context guards, and 47 passing tests across 6 test files**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T21:49:15Z
- **Completed:** 2026-03-13T21:52:41Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- useInput: stdin 'data' listener with parseKeypress, raw mode management, isActive flag, stable handler ref
- useApp and useStdin: context consumers with out-of-provider guards
- useFocus: focus registration lifecycle, autoFocus, isActive toggling, isFocused derivation
- useFocusManager: full delegation of focusNext/focusPrevious/focus/enableFocus/disableFocus to FocusContext
- hooks/index.ts re-exports all five hooks and Key type for clean public API
- 47 tests across 6 test files, all passing with jsdom environment

## Task Commits

Each task was committed atomically (TDD: test then implement):

1. **Task 1 RED: Failing tests for useInput, useApp, useStdin** - `bb2e940` (test)
2. **Task 1 GREEN: Implement useInput, useApp, useStdin** - `a9d7413` (feat)
3. **Task 2 RED: Failing tests for useFocus, useFocusManager** - `c5cf89a` (test)
4. **Task 2 GREEN: Implement useFocus, useFocusManager, index.ts** - `511d2e3` (feat)

_Note: TDD tasks have RED + GREEN commits per task._

## Files Created/Modified

- `src/hooks/use-input.ts` - stdin listener, parseKeypress, raw mode, isActive, stable ref
- `src/hooks/use-app.ts` - AppContext consumer with guard
- `src/hooks/use-stdin.ts` - StdinContext consumer with guard
- `src/hooks/use-focus.ts` - Focus registration, autoFocus, isActive, isFocused derivation
- `src/hooks/use-focus-manager.ts` - FocusContext navigation method delegation
- `src/hooks/index.ts` - Public re-export of all 5 hooks + Key type
- `src/hooks/__tests__/use-input.test.ts` - 7 tests
- `src/hooks/__tests__/use-app.test.ts` - 4 tests
- `src/hooks/__tests__/use-stdin.test.ts` - 4 tests
- `src/hooks/__tests__/use-focus.test.ts` - 9 tests
- `src/hooks/__tests__/use-focus-manager.test.ts` - 6 tests
- `package.json` - Added @testing-library/react, jsdom dev deps

## Decisions Made

- Stable handler ref in useInput: `useRef(handler)` updated each render, effect depends only on `[isActive, stdin, setRawMode]` — matches Ink behavior exactly, no re-subscription on handler identity change
- `// @vitest-environment jsdom` docblock per test file — avoids globally switching non-hook tests to DOM environment
- `useFocus` generates stable ids via module-level counter held in `useRef` — survives re-renders without triggering effect re-run
- `isFocused = isActive && isFocusEnabled && activeId === id` — all three conditions required per Ink semantics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @testing-library/react and jsdom**
- **Found during:** Task 1 (useInput tests)
- **Issue:** `@testing-library/react` not installed; tests using `renderHook` could not run. `jsdom` not installed as top-level package; vitest could not load the jsdom environment.
- **Fix:** `npm install --save-dev @testing-library/react jsdom @types/jsdom`
- **Files modified:** package.json, package-lock.json
- **Verification:** All 15 Task 1 tests pass
- **Committed in:** `a9d7413` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Fixed useApp test assertion for no-argument exit call**
- **Found during:** Task 1 GREEN (useApp tests)
- **Issue:** Test asserted `expect(exit).toHaveBeenCalledWith(undefined)` but `exit()` with no arguments produces an empty call array, not `[undefined]`
- **Fix:** Changed assertion to `expect(exit).toHaveBeenCalledOnce()`
- **Files modified:** `src/hooks/__tests__/use-app.test.ts`
- **Verification:** Test now passes correctly
- **Committed in:** `a9d7413` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 test assertion bug)
**Impact on plan:** Both auto-fixes necessary for test execution. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All five hooks complete with matching Ink API signatures
- Full test coverage (47 tests) with mocked contexts
- TypeScript type check clean (`npx tsc --noEmit` passes)
- Ready for render() API integration (06-03) which wires providers around the React tree

---
*Phase: 06-api-parity-hooks-render-api-integration*
*Completed: 2026-03-13*

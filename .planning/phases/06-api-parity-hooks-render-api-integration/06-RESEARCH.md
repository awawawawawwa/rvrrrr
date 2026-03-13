# Phase 6: API Parity — Hooks, Render API & Integration - Research

**Researched:** 2026-03-13
**Domain:** TypeScript public API, React hooks, stdin key parsing, lifecycle state machines, JS-side text rendering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rust is ONLY the renderer — replaces Ink's ANSI escape code generation (Output class), nothing else
- Rust does NOT handle input, raw mode, or any frontend concerns
- JS owns `process.stdin` — same as Ink; JS sets raw mode via `process.stdin.setRawMode()`
- `useInput` reads directly from `process.stdin` — no Rust involvement
- `render(element, options?)` matches Ink's signature exactly; returns Instance with rerender(), unmount(), waitUntilExit(), clear()
- Options: stdout, stdin, stderr, debug, exitOnCtrlC, patchConsole, maxFps
- Static content: JS writes directly to stdout above the dynamic area — does NOT go through Rust
- Console patching: intercept console.log/warn/error to write above dynamic content — same as Ink
- renderToString: pure JS, synchronous, does not use Rust renderer
- Terminal resize: JS detects via `process.stdout.on('resize')`, triggers re-layout, sends `{type:"resize", width, height}` to Rust via bridge.sendResize()
- Input does NOT flow through the bridge — PROT-05 is handled entirely in JS, not Rust

### Claude's Discretion
- Internal wiring between reconciler commits and bridge.enqueueRender()
- How to implement the JS-side text renderer for renderToString
- Exact lifecycle state machine implementation
- measureElement implementation details
- How to handle Phase 5 input.rs cleanup (remove, keep, or leave as dead code)

### Deferred Ideas (OUT OF SCOPE)
- Phase 5 cleanup: input.rs and crossterm event reading in Rust are unnecessary — could be removed or left for potential future use, not blocking
- PROT-05 requirement reinterpretation: input events don't flow through protocol/bridge, handled entirely in JS
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HOOK-01 | useInput with full key parsing (arrows, return, escape, ctrl, shift, tab, backspace, delete, meta) | Key parsing via stdin 'data' event; keypress-style parsing needed in JS |
| HOOK-02 | useApp returning exit(error?) | AppContext with exitCode/exitError state; signals lifecycle state machine |
| HOOK-03 | useStdin returning stdin, isRawModeSupported, setRawMode | StdinContext wrapping process.stdin; isRawModeSupported = typeof process.stdin.setRawMode === 'function' |
| HOOK-04 | useFocus with autoFocus, isActive, id options | FocusContext with focus registry; isActive derived from focused id match |
| HOOK-05 | useFocusManager with enableFocus, disableFocus, focusNext, focusPrevious, focus(id) | FocusManager owns ordered id list; rotates focused index |
| RAPI-01 | render(element, options?) entry point | Creates reconciler container, spawns bridge, wires layout → serialize → enqueueRender |
| RAPI-02 | Instance.rerender(element) | reconciler.updateContainer() with new element |
| RAPI-03 | Instance.unmount() with proper lifecycle state machine | Calls reconciler.updateContainer(null), bridge.shutdown(), resolves waitUntilExit promise |
| RAPI-04 | Instance.waitUntilExit() returning Promise | Promise stored on instance; resolved by unmount() or exit() |
| RAPI-05 | Instance.clear() erasing rendered output | Sends clear message to bridge or writes ANSI clear to stdout |
| RAPI-06 | Static component for permanent output above dynamic content | Uses DOMElement.internal_static flag; JS intercepts static subtree and writes to stdout directly |
| RAPI-07 | renderToString(element) synchronous render | Pure JS text renderer using layout engine; no bridge needed |
| RAPI-08 | measureElement(ref) returning {width, height} | Reads yogaNode.getComputedWidth() / getComputedHeight() from ref |
| RAPI-09 | Console patching to prevent output corruption | Intercept console.log/warn/error; buffer output, write above dynamic content |
| LYOT-07 | Terminal resize triggers re-layout with new dimensions | process.stdout.on('resize') → update root yoga node dimensions → recalculate → re-serialize → enqueueRender + sendResize |
| RUST-10 | Terminal resize detection and re-render on Rust side | bridge.sendResize(width, height) already implemented in IpcRendererBridge; Rust resizes its cell buffers |
</phase_requirements>

---

## Summary

Phase 6 wires all existing building blocks into a complete, Ink-compatible public API. The reconciler, layout engine, component layer, protocol serializer, and bridge are all complete. What remains is the glue: the `render()` entry point that creates and connects these pieces, five React hooks implemented with contexts, terminal resize plumbing, `renderToString()` using a pure-JS text renderer, and utilities like `measureElement()` and console patching.

The core mental model is that this codebase is a structural fork of Ink 4.x with Rust substituted only for Ink's `Output` class (the ANSI escape code emission layer). Every other JS-side concern — hooks, stdin, contexts, lifecycle — maps directly to Ink's implementation. This means the reference implementation for every feature in this phase is Ink's source code.

The key integration contract is: after each React commit, `rootNode.onRender()` fires (already wired in the reconciler's `resetAfterCommit`), which triggers `calculateLayout()`, then `serializeTree()`, then `bridge.enqueueRender()`. The bridge handles throttling and backpressure. This pipeline is the thread that runs through the entire phase.

**Primary recommendation:** Model every feature directly off Ink 4.4.x source code — use it as the canonical specification for hook behavior, context shapes, lifecycle state machine, and key parsing. Then swap out Ink's `render()` internals to wire through the bridge instead of Ink's `Output` class.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.x (already installed) | Component tree, hooks, context | Required — reconciler targets React 19 |
| react-reconciler | 0.32.0 (already installed) | Custom renderer host | Already used in Phase 1 |
| yoga-layout | 3.2.1 (already installed) | Layout computation for measureElement | Already wired |
| signal-exit | 4.x | Reliable process exit hook | Ink uses it for cleanup on abnormal exit |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ansi-escapes | 6.x | ANSI sequences for clear(), cursor hide/show | Use for clear() and Static output positioning |
| cli-cursor | 4.x | Hide/show terminal cursor | Use in render() setup and unmount() teardown |
| string-width | 7.x (already used in layout) | Text width measurement for renderToString | Already in project via layout module |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| signal-exit | process.on('exit') directly | signal-exit handles edge cases (SIGTERM on Windows, uncaughtException ordering) — use signal-exit |
| ansi-escapes | Raw escape strings | ansi-escapes is readable and tested — use it |

**Installation (if not already present):**
```bash
npm install signal-exit ansi-escapes cli-cursor
```

---

## Architecture Patterns

### Recommended Module Structure
```
src/
├── hooks/
│   ├── use-input.ts        # HOOK-01: stdin key parsing
│   ├── use-app.ts          # HOOK-02: AppContext consumer
│   ├── use-stdin.ts        # HOOK-03: StdinContext consumer
│   ├── use-focus.ts        # HOOK-04: FocusContext consumer
│   ├── use-focus-manager.ts # HOOK-05: FocusManager consumer
│   └── index.ts
├── render/
│   ├── render.ts           # RAPI-01..05: render() entry point + Instance
│   ├── render-to-string.ts # RAPI-07: pure JS text renderer
│   ├── measure-element.ts  # RAPI-08: measureElement()
│   ├── patch-console.ts    # RAPI-09: console patching
│   └── index.ts
├── components/
│   └── Static.tsx          # RAPI-06: Static component (add to existing)
├── contexts/
│   ├── app-context.ts      # AppContext (exit, exitCode)
│   ├── stdin-context.ts    # StdinContext
│   ├── focus-context.ts    # FocusContext + FocusManager
│   └── index.ts
└── index.ts                # Updated public API surface
```

### Pattern 1: render() Entry Point and Instance Lifecycle

**What:** `render()` creates one reconciler container, one bridge, one root DOM element, and returns an Instance object. The Instance owns the lifecycle state machine.

**Lifecycle states:** `active` → `unmounting` → `exited`. `waitUntilExit()` returns a promise that resolves when state reaches `exited`.

**When to use:** This is the single top-level entry point. Only one render() call per process is expected (like Ink).

**Example:**
```typescript
// src/render/render.ts
export function render(node: ReactNode, options?: RenderOptions): Instance {
  const stdout = options?.stdout ?? process.stdout;
  const stdin = options?.stdin ?? process.stdin;
  const stderr = options?.stderr ?? process.stderr;

  const rootNode = createNode('ink-root');
  const bridge = new IpcRendererBridge({ maxFps: options?.maxFps ?? 30 });

  // Wire: after each React commit → layout → serialize → bridge
  rootNode.onComputeLayout = () => {
    calculateLayout(rootNode, stdout.columns, stdout.rows);
  };
  rootNode.onRender = () => {
    const tree = serializeTree(rootNode);
    bridge.enqueueRender(tree);
  };

  // Resize wiring (LYOT-07, RUST-10)
  const onResize = () => {
    rootNode.onComputeLayout?.();
    rootNode.onRender?.();
    bridge.sendResize(stdout.columns, stdout.rows);
  };
  stdout.on('resize', onResize);

  const container = reconciler.createContainer(
    rootNode, 0, null, false, null, '', {}, null
  );

  let exitResolve: (err?: Error) => void;
  const exitPromise = new Promise<void>((resolve, reject) => {
    exitResolve = (err) => err ? reject(err) : resolve();
  });

  const instance: Instance = {
    rerender(nextNode) {
      reconciler.updateContainer(nextNode, container, null, null);
    },
    unmount() {
      stdout.off('resize', onResize);
      reconciler.updateContainer(null, container, null, () => {
        void bridge.shutdown().then(() => exitResolve());
      });
    },
    waitUntilExit: () => exitPromise,
    clear() {
      // write ANSI clear to stdout
    },
  };

  // Initial render
  reconciler.updateContainer(node, container, null, null);
  return instance;
}
```

### Pattern 2: useInput — stdin Key Event Parsing

**What:** Reads raw bytes from process.stdin, parses escape sequences into structured key events, calls user handler if component is active.

**Critical detail:** Must call `process.stdin.setRawMode(true)` when at least one `useInput` is registered, and `setRawMode(false)` when the last one unregisters. Use a reference counter.

**Key parsing reference:** Ink's `parse-keypress.ts` (or equivalent) handles the full escape sequence table. This is non-trivial — do not hand-roll from scratch. Copy from Ink.

**Example:**
```typescript
// src/hooks/use-input.ts
export function useInput(
  inputHandler: (input: string, key: Key) => void,
  options?: { isActive?: boolean }
) {
  const { stdin, setRawMode } = useStdin();
  const isActive = options?.isActive ?? true;

  useEffect(() => {
    if (!isActive) return;

    setRawMode(true);

    const handler = (data: Buffer) => {
      const { input, key } = parseKeypress(data);
      if (isActive) inputHandler(input, key);
    };

    stdin.on('data', handler);
    return () => {
      stdin.off('data', handler);
      setRawMode(false);
    };
  }, [isActive, inputHandler]);
}
```

### Pattern 3: Context-Based Hooks

**What:** useApp, useStdin, useFocus, useFocusManager all consume React contexts provided by render().

**Context provision pattern:** render() wraps the user's element in a context provider tree:
```tsx
<AppContext.Provider value={appCtx}>
  <StdinContext.Provider value={stdinCtx}>
    <FocusContext.Provider value={focusCtx}>
      {node}
    </FocusContext.Provider>
  </StdinContext.Provider>
</AppContext.Provider>
```

**FocusManager state:** Maintains an ordered array of registered focus IDs and a `focusedId` string. `focusNext`/`focusPrevious` rotate the index. `useFocus` registers on mount, unregisters on unmount. `isActive` = `focusedId === id`.

### Pattern 4: Static Component

**What:** Renders children to stdout directly (permanent, above dynamic content). Uses `DOMElement.internal_static = true`.

**Implementation:** The `onRender` hook detects the `staticNode` on rootNode (already typed in `DOMElement`). Static content is rendered to a string using the same JS text renderer as `renderToString()`, then written to stdout directly. This writes appear above the dynamic terminal area.

**Example:**
```tsx
// src/components/Static.tsx
export function Static<T>({ items, children }: StaticProps<T>) {
  return (
    <ink-box internal_static>
      {items.map((item, i) => children(item, i))}
    </ink-box>
  );
}
```

### Pattern 5: renderToString — Pure JS Text Renderer

**What:** Synchronous string rendering without a bridge. Uses Yoga for layout, then a JS-side character grid to paint text.

**Implementation approach:** Create a temporary `ink-root` node, run `reconciler.updateContainer()` inside `act()` (or synchronously flush), compute layout, then walk the tree painting to a 2D character array, join rows with newlines.

**Key insight:** This is exactly what Ink's `Output` class does — maintain a `Map<number, string>` of row index → row string, write characters at computed positions, join. Adapt Ink's Output class as `src/render/output.ts`.

### Anti-Patterns to Avoid
- **Setting raw mode without reference counting:** If multiple `useInput` calls fight over setRawMode, terminal breaks on unmount. Use a counter.
- **Calling `process.exit()` directly in exit():** Should reject the `waitUntilExit()` promise with the error, then let the caller decide whether to exit. Ink's `exitOnCtrlC` default calls `process.exit()` after the promise rejects.
- **Patching console before bridge is ready:** Console patch should buffer output and flush once bridge is ready, or write directly to stderr to avoid corruption.
- **Not unregistering process.stdout 'resize' listener on unmount:** Causes memory leaks if multiple render() calls are made (e.g., tests).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Key event parsing | Custom escape sequence parser | Copy Ink's `parseKeypress` | Escape sequences have dozens of edge cases (xterm, rxvt, Windows, meta combos) |
| Raw mode reference counting | Custom counter | Pattern from Ink's StdinContext | Already solved: single setRawMode wrapper with count |
| JS text renderer for renderToString | New render algorithm | Adapt Ink's Output class | Ink's approach is battle-tested for Unicode, wrapping, transforms |
| Console patch buffering | Custom stream | Ink's patch-console pattern | Line-buffering and stream interception are subtle |
| Process cleanup on abnormal exit | process.on('exit') chains | signal-exit library | signal-exit handles SIGTERM on Windows, ordering guarantees |

**Key insight:** Ink 4.4.x is the specification AND the reference implementation for this entire phase. Every hook, context, and utility has a working counterpart there.

---

## Common Pitfalls

### Pitfall 1: reconciler.createContainer Signature Change
**What goes wrong:** React 19 / react-reconciler 0.32 changed `createContainer` arguments. Passing wrong args causes silent failures or crashes.
**Why it happens:** Reconciler API changes between minor versions are undocumented.
**How to avoid:** Match the exact call signature already used in Phase 1 tests: `reconciler.createContainer(rootNode, 0, null, false, null, '', {}, null)`.
**Warning signs:** React throws about missing concurrentFeatures or hydration arguments.

### Pitfall 2: stdin 'data' vs 'readable' Events
**What goes wrong:** Listening on 'data' in raw mode works but 'readable' + read() does not reliably deliver single keystrokes.
**Why it happens:** In raw mode, each keypress is one or more bytes delivered immediately on 'data'.
**How to avoid:** Always use `stdin.on('data', handler)` for key parsing in raw mode.

### Pitfall 3: Yoga Node Dimensions Not Available Until calculateLayout Runs
**What goes wrong:** `measureElement()` returns 0/0 if called before the first layout pass.
**Why it happens:** Yoga nodes start with undefined computed dimensions.
**How to avoid:** `measureElement()` should guard: if `yogaNode.getComputedWidth() === 0 && yogaNode.getComputedHeight() === 0`, warn or return zeros gracefully. Document that it must be called inside an effect (after render).

### Pitfall 4: enqueueRender Called Before Bridge is Ready
**What goes wrong:** First React commit fires `onRender` before bridge's `waitForReady()` resolves. `enqueueRender` is a no-op in `starting` state (bridge guards this), but the initial frame is lost.
**Why it happens:** Reconciler commits synchronously before bridge child process is up.
**How to avoid:** In `render()`, wait for `bridge.waitForReady()` then trigger an initial render manually, OR queue the first frame and flush it once ready. Simplest: after `waitForReady()` resolves, call `rootNode.onRender?.()` to push the frame that was dropped.

### Pitfall 5: Multiple render() Calls in Tests Leaking Listeners
**What goes wrong:** Each `render()` call adds 'resize', SIGINT, SIGTERM, uncaughtException listeners. Tests that don't call `unmount()` leak these.
**Why it happens:** Node.js emits MaxListenersExceededWarning at 10 listeners.
**How to avoid:** Always call `instance.unmount()` in test teardown. Document clearly.

### Pitfall 6: exitOnCtrlC Conflict with useInput Ctrl+C Handler
**What goes wrong:** If `exitOnCtrlC: true` (default) AND a `useInput` registers for Ctrl+C, both fire — the app exits AND the handler runs.
**Why it happens:** exitOnCtrlC is a global stdin listener added by render(); useInput adds another.
**How to avoid:** Same as Ink — exitOnCtrlC handler checks if any useInput is registered, or simply documents the precedence. Ink exits on Ctrl+C before calling useInput handlers.

---

## Code Examples

### calculateLayout call pattern
```typescript
// Source: Ink render.tsx — calculateLayout after each commit
import Yoga from 'yoga-layout';

function calculateLayout(rootNode: DOMElement, width: number, height: number) {
  rootNode.yogaNode!.calculateLayout(width, height, Yoga.DIRECTION_LTR);
}
```

### Key type structure (matches Ink's Key interface)
```typescript
// src/hooks/use-input.ts
export type Key = {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  pageDown: boolean;
  pageUp: boolean;
  return: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  meta: boolean;
};
```

### FocusContext shape
```typescript
// src/contexts/focus-context.ts
export type FocusContextValue = {
  activeId: string | undefined;
  add: (id: string, options: { autoFocus: boolean }) => void;
  remove: (id: string) => void;
  next: () => void;
  previous: () => void;
  focus: (id: string) => void;
  enableFocus: () => void;
  disableFocus: () => void;
  isFocusEnabled: boolean;
};
```

### measureElement implementation
```typescript
// src/render/measure-element.ts
export function measureElement(
  ref: RefObject<DOMElement>
): { width: number; height: number } {
  const node = ref.current;
  if (!node?.yogaNode) return { width: 0, height: 0 };
  return {
    width: node.yogaNode.getComputedWidth(),
    height: node.yogaNode.getComputedHeight(),
  };
}
```

### Console patching
```typescript
// src/render/patch-console.ts
export function patchConsole(
  writeToStdout: (text: string) => void
): () => void {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => writeToStdout(util.format(...args) + '\n');
  console.warn = (...args) => writeToStdout(util.format(...args) + '\n');
  console.error = (...args) => writeToStdout(util.format(...args) + '\n');

  return () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ink used its own Output class for ANSI emission | tui-engine replaces Output with Rust bridge | Phase 4-5 | renderToString still needs JS-side Output equivalent |
| PROT-05 specified input events via bridge | Input stays entirely in JS, no bridge involvement | Phase 6 design decision | Simpler: bridge is write-only from JS perspective |
| react-reconciler createContainer (old API) | React 19 / 0.32 API with 8 args | 2024 | Already handled in Phase 1 reconciler |

---

## Open Questions

1. **calculateLayout import path**
   - What we know: `yoga-layout` exports a Yoga object; `calculateLayout` is called on the root Yoga node
   - What's unclear: Whether `Yoga.DIRECTION_LTR` needs an explicit import or is accessed differently in yoga-layout 3.x
   - Recommendation: Check existing Phase 1 tests — the layout module already calls this successfully

2. **renderToString synchronous flush**
   - What we know: React 19's reconciler is primarily async; `act()` from react-dom/test-utils forces sync flush
   - What's unclear: Whether `act()` is appropriate in production or if there is a lighter synchronous path
   - Recommendation: Use React's `flushSync` or `act()` from the test utilities — same approach Ink uses for renderToString. Ink 4 uses `create-reconciler` with a dedicated synchronous instance.

3. **bridge.sendResize timing relative to enqueueRender**
   - What we know: `bridge.sendResize()` is implemented and sends immediately; `enqueueRender()` is throttled
   - What's unclear: Whether Rust expects resize before or after the next render frame
   - Recommendation: Send resize first (immediate), then enqueue render. Rust resizes buffers then paints — order matters.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (already configured) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/hooks src/render --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOOK-01 | Key parsing: arrows, ctrl, escape, tab, meta | unit | `npx vitest run src/hooks/__tests__/use-input.test.ts` | Wave 0 |
| HOOK-02 | useApp exit() resolves waitUntilExit | unit | `npx vitest run src/hooks/__tests__/use-app.test.ts` | Wave 0 |
| HOOK-03 | useStdin exposes stdin, isRawModeSupported, setRawMode | unit | `npx vitest run src/hooks/__tests__/use-stdin.test.ts` | Wave 0 |
| HOOK-04 | useFocus isActive, autoFocus, id | unit | `npx vitest run src/hooks/__tests__/use-focus.test.ts` | Wave 0 |
| HOOK-05 | focusNext, focusPrevious, focus(id) | unit | `npx vitest run src/hooks/__tests__/use-focus-manager.test.ts` | Wave 0 |
| RAPI-01 | render() returns Instance; reconciler container created | integration | `npx vitest run src/render/__tests__/render.test.ts` | Wave 0 |
| RAPI-02 | rerender() updates component tree | integration | same file | Wave 0 |
| RAPI-03 | unmount() shuts down bridge and resolves waitUntilExit | integration | same file | Wave 0 |
| RAPI-04 | waitUntilExit() promise resolves after unmount | integration | same file | Wave 0 |
| RAPI-05 | clear() writes ANSI clear escape to stdout | unit | same file | Wave 0 |
| RAPI-06 | Static renders above dynamic; internal_static flag set | unit | `npx vitest run src/components/__tests__/static.test.tsx` | Wave 0 |
| RAPI-07 | renderToString() returns correct string | unit | `npx vitest run src/render/__tests__/render-to-string.test.ts` | Wave 0 |
| RAPI-08 | measureElement() returns {width, height} from Yoga | unit | `npx vitest run src/render/__tests__/measure-element.test.ts` | Wave 0 |
| RAPI-09 | console.log captured, not leaked to terminal | unit | `npx vitest run src/render/__tests__/patch-console.test.ts` | Wave 0 |
| LYOT-07 | Resize event triggers re-layout and re-render | integration | `npx vitest run src/render/__tests__/render.test.ts` | Wave 0 |
| RUST-10 | bridge.sendResize called on resize event | integration | same file (mock bridge) | Wave 0 |

All tests use mocked bridge (no real Rust binary required for unit/integration tests — IpcRendererBridge mocked via vitest).

### Sampling Rate
- **Per task commit:** `npx vitest run src/hooks src/render src/components --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/use-input.test.ts` — covers HOOK-01
- [ ] `src/hooks/__tests__/use-app.test.ts` — covers HOOK-02
- [ ] `src/hooks/__tests__/use-stdin.test.ts` — covers HOOK-03
- [ ] `src/hooks/__tests__/use-focus.test.ts` — covers HOOK-04
- [ ] `src/hooks/__tests__/use-focus-manager.test.ts` — covers HOOK-05
- [ ] `src/render/__tests__/render.test.ts` — covers RAPI-01..05, LYOT-07, RUST-10
- [ ] `src/render/__tests__/render-to-string.test.ts` — covers RAPI-07
- [ ] `src/render/__tests__/measure-element.test.ts` — covers RAPI-08
- [ ] `src/render/__tests__/patch-console.test.ts` — covers RAPI-09
- [ ] `src/components/__tests__/static.test.tsx` — covers RAPI-06
- [ ] `src/contexts/` directory — app-context.ts, stdin-context.ts, focus-context.ts
- [ ] `src/hooks/` directory — all five hooks
- [ ] `src/render/` directory — render.ts, render-to-string.ts, measure-element.ts, patch-console.ts

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `src/reconciler/reconciler.ts`, `src/bridge/ipc-child.ts`, `src/dom/types.ts` — read directly
- Project CONTEXT.md — locked decisions, architecture constraints
- Project REQUIREMENTS.md — requirement definitions
- Project STATE.md + ROADMAP.md — what Phases 1-5 delivered

### Secondary (MEDIUM confidence)
- Ink 4.4.x source code (github.com/vadimdemedes/ink) — reference implementation for hooks, key parsing, lifecycle, console patching, Static component, renderToString, Output class — not fetched directly but well understood from architecture decisions in CONTEXT.md which explicitly references "same as Ink"

### Tertiary (LOW confidence)
- None — all claims grounded in existing codebase or locked decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing package.json already has react, reconciler, yoga; only signal-exit/ansi-escapes/cli-cursor are additions
- Architecture: HIGH — locked decisions in CONTEXT.md are highly specific; existing code confirms hook points (onRender, onComputeLayout, internal_static, sendResize already implemented)
- Pitfalls: HIGH — sourced from direct code inspection of existing bridge, reconciler, and dom types

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable API surface — Ink API compatibility is the constraint)

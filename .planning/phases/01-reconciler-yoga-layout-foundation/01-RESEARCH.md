# Phase 1 Research: Reconciler & Yoga Layout Foundation

**Researched:** 2026-03-11
**Sources:** Ink v6.8.0 source (GitHub master), yoga-layout 3.2.1 source, react-reconciler npm, React reconciler host config reference

---

## 1. Ink Source Files to Copy — Dependency Graph

### Critical Discovery: Ink Already Uses React 19 + Reconciler 0.33.0

The user's context references "Ink's React 18 / reconciler 0.29.x" but **Ink v6.8.0 (current master) already uses `react-reconciler@^0.33.0` with `react@>=19.0.0`**. This simplifies Phase 1 significantly — we can copy Ink's current reconciler code with minimal adaptation rather than performing a version migration.

**Version correction:** The user specified `react-reconciler@0.32.0`, but Ink uses `0.33.0`. Both exist on npm. Recommend using **0.33.0** to match Ink's battle-tested configuration.

### File Dependency Graph

```
reconciler.ts  ←── THE CORE FILE
├── dom.ts
│   ├── measure-text.ts
│   │   └── widest-line (npm)
│   ├── wrap-text.ts
│   │   ├── wrap-ansi (npm)
│   │   ├── cli-truncate (npm)
│   │   └── styles.ts (type import only)
│   ├── squash-text-nodes.ts
│   │   ├── dom.ts (circular, type import)
│   │   └── sanitize-ansi.ts
│   │       └── ansi-tokenizer.ts (340 lines, Ink-native, zero deps)
│   ├── styles.ts (type import only)
│   └── render-node-to-output.ts (TYPE IMPORT ONLY — OutputTransformer)
├── styles.ts
│   ├── yoga-layout (npm)
│   ├── cli-boxes (npm, type import for border styles)
│   ├── type-fest (npm, type import for LiteralUnion)
│   └── ansi-styles (npm, type import for ForegroundColorName)
└── render-node-to-output.ts (TYPE IMPORT ONLY — OutputTransformer)
```

### Files to Extract (7 files, ~8 core + 2 utility)

| File | Lines | Purpose | Dependencies to Resolve |
|------|-------|---------|------------------------|
| `reconciler.ts` | ~280 | Host config + reconciler creation | dom.ts, styles.ts, OutputTransformer type |
| `dom.ts` | ~230 | Node creation, tree mutation, text measurement | measure-text.ts, wrap-text.ts, squash-text-nodes.ts, OutputTransformer type |
| `styles.ts` | ~500 | Yoga style prop application | yoga-layout, cli-boxes (types), type-fest (types), ansi-styles (types) |
| `measure-text.ts` | ~30 | Text dimension measurement with caching | widest-line (npm) |
| `wrap-text.ts` | ~40 | Text wrapping/truncation | wrap-ansi (npm), cli-truncate (npm) |
| `squash-text-nodes.ts` | ~45 | Flatten text node tree to string | sanitize-ansi.ts |
| `sanitize-ansi.ts` | ~30 | Strip non-SGR ANSI sequences | ansi-tokenizer.ts |
| `ansi-tokenizer.ts` | ~340 | Full ANSI tokenizer (Ink-native, zero npm deps) | None |
| `get-max-width.ts` | ~10 | Compute content width minus padding/border | yoga-layout |

### Files NOT Needed for Phase 1

| File | Reason |
|------|--------|
| `render-node-to-output.ts` | Rendering pipeline — replaced by Rust in later phases. Only the `OutputTransformer` type is needed (can be inlined). |
| `output.ts` | Character grid for Ink's JS renderer — replaced by Rust. |
| `render-border.ts` | Border painting — Rust renderer responsibility. |
| `render-background.ts` | Background painting — Rust renderer responsibility. |
| `ink.tsx` | Full Ink instance (render lifecycle, throttling, stdout) — Phase 6. |
| `render.ts` | Public `render()` API — Phase 6. |
| `instances.ts` | WeakMap tracking render instances per stdout — Phase 6. |
| `components/*` | Box, Text, etc. — Phase 2. |
| `hooks/*` | useInput, useFocus, etc. — Phase 6. |
| `devtools.ts` | React DevTools integration — not needed. |
| `input-parser.ts` | Key parsing — Phase 6. |

### Type-Only Dependencies to Inline

The `OutputTransformer` type from `render-node-to-output.ts` is imported by both `dom.ts` and `reconciler.ts`. Rather than copying the entire render module, inline it:

```typescript
export type OutputTransformer = (s: string, index: number) => string;
```

---

## 2. React Reconciler API: 0.29.x → 0.33.0 Changes

### No Migration Needed — Ink Already Did It

Since Ink v6.8.0 already runs on `react-reconciler@0.33.0` + `react@19.x`, we can copy the host config directly. However, understanding the changes is important for debugging and future maintenance.

### Breaking Changes (0.29 → 0.33)

#### `commitUpdate` Signature Change (PR #28909)

**Old (0.29):**
```typescript
commitUpdate(instance, updatePayload, type, oldProps, newProps, internalHandle)
```

**New (0.33):**
```typescript
commitUpdate(instance, type, oldProps, newProps, internalHandle)
```

The `updatePayload` parameter was removed. Ink's current code already uses the new signature — the `_type` parameter is the second argument:
```typescript
commitUpdate(node, _type, oldProps, newProps) { ... }
```

#### `flushSync` Renamed (PR #28500)

**Old:** `reconciler.flushSync(fn)`
**New:** `reconciler.flushSyncFromReconciler(fn)` or use `reconciler.updateContainerSync()` + `reconciler.flushSyncWork()`

This doesn't affect the host config — it affects how the reconciler is **called** (relevant for Phase 6's `render()` API).

#### New Required Host Config Methods (0.33)

These methods are all present in Ink's current reconciler.ts and must be copied:

| Method | Purpose | Ink's Implementation |
|--------|---------|---------------------|
| `setCurrentUpdatePriority(priority)` | Store current update priority | Sets module-level variable |
| `getCurrentUpdatePriority()` | Return current update priority | Returns module-level variable |
| `resolveUpdatePriority()` | Resolve effective priority | Returns current or DefaultEventPriority |
| `maySuspendCommit()` | Enable Suspense preloading | Returns `true` |
| `preloadInstance()` | Preload resources for Suspense | Returns `true` |
| `startSuspendingCommit()` | Pre-commit Suspense setup | No-op |
| `suspendInstance()` | Per-component Suspense signal | No-op |
| `waitForCommitToBeReady()` | Suspense commit readiness | Returns `null` |
| `NotPendingTransition` | Transition sentinel | `undefined` |
| `HostTransitionContext` | Context for transitions | `createContext(null)` |
| `resetFormInstance()` | Form state reset | No-op |
| `requestPostPaintCallback()` | Post-paint hook | No-op |
| `shouldAttemptEagerTransition()` | Eager transition flag | Returns `false` |
| `trackSchedulerEvent()` | Scheduler tracking | No-op |
| `resolveEventType()` | Event type resolution | Returns `null` |
| `resolveEventTimeStamp()` | Event timestamp | Returns `-1.1` |
| `rendererPackageName` | Package name for devtools | `'tui-engine'` |
| `rendererVersion` | Version for devtools | Package version string |

#### Scheduler Integration (Required in 0.33)

Ink's reconciler.ts imports and uses these scheduler methods that are now required:

```typescript
import * as Scheduler from 'scheduler';

// In host config:
scheduleCallback: Scheduler.unstable_scheduleCallback,
cancelCallback: Scheduler.unstable_cancelCallback,
shouldYield: Scheduler.unstable_shouldYield,
now: Scheduler.unstable_now,
```

The `scheduler` package must be a dependency (`^0.27.0` to match Ink).

---

## 3. yoga-layout 3.2.1 API — Differences from yoga-wasm-web

### Import Pattern

**yoga-wasm-web (old, dead):**
```typescript
import initYoga from 'yoga-wasm-web';
const Yoga = await initYoga();
const node = Yoga.Node.create();
```

**yoga-layout 3.2.1 (current — default, uses top-level await):**
```typescript
import Yoga from 'yoga-layout';
const node = Yoga.Node.create();
```

**yoga-layout 3.2.1 (alternative — no TLA required):**
```typescript
import { loadYoga } from 'yoga-layout/load';
const Yoga = await loadYoga();
const node = Yoga.Node.create();
```

### Ink Already Uses yoga-layout 3.2.1

Ink's current code does `import Yoga, {type Node as YogaNode} from 'yoga-layout'` — this is the default import with top-level await. **No API migration is needed.**

### Constants Are Backward-Compatible

yoga-layout 3.2.1 exports both TypeScript enums AND legacy uppercase constants:

```typescript
// TypeScript enum style (new):
import { Edge, Display, FlexDirection } from 'yoga-layout';
node.setDisplay(Display.Flex);
node.setPadding(Edge.All, 10);

// Legacy constant style (Ink uses this via default Yoga object):
Yoga.DISPLAY_FLEX     // === Display.Flex === 0
Yoga.EDGE_ALL         // === Edge.All === 8
Yoga.EDGE_TOP         // === Edge.Top === 1
Yoga.FLEX_DIRECTION_ROW // === FlexDirection.Row === 2
```

Ink's code uses the legacy `Yoga.CONSTANT_NAME` style throughout. These are all still available on the default `Yoga` export.

### Measure Function Signature

**yoga-layout 3.2.1 MeasureFunction type:**
```typescript
type MeasureFunction = (
  width: number,
  widthMode: MeasureMode,
  height: number,
  heightMode: MeasureMode,
) => { width: number; height: number };
```

**Ink's actual usage in dom.ts:**
```typescript
node.yogaNode?.setMeasureFunc(measureTextNode.bind(null, node));

// measureTextNode signature:
const measureTextNode = function (node: DOMNode, width: number): {width: number; height: number}
```

Ink binds `node` as the first argument, so the actual function passed to `setMeasureFunc` receives `(width, widthMode, height, heightMode)` — but only uses `width`. The extra parameters are harmlessly ignored. **This works unchanged with yoga-layout 3.2.1.**

### New Features in yoga-layout 3.x (Available but Not Used by Ink)

| Feature | API | Notes |
|---------|-----|-------|
| `display: contents` | `Yoga.DISPLAY_CONTENTS` / `Display.Contents` | New layout mode |
| `box-sizing` | `node.setBoxSizing(BoxSizing.ContentBox)` | Default is border-box |
| `position: static` | `Yoga.POSITION_TYPE_STATIC` / `PositionType.Static` | Ink already supports this |
| Percentage gap | `node.setGapPercent(gutter, percent)` | New setter |
| `setFlexBasisAuto()` | Direct method | Ink currently uses `setFlexBasis(NaN)` as workaround |

### Memory Management (Critical)

yoga-layout 3.2.1 requires manual memory management:

```typescript
node.free()           // Free a single node
node.freeRecursive()  // Free node and all descendants
node.unsetMeasureFunc() // Must call before free() if measure func was set
```

Ink handles this in `removeChildFromContainer` and `removeChild`:
```typescript
const cleanupYogaNode = (node?: YogaNode): void => {
  node?.unsetMeasureFunc();
  node?.freeRecursive();
};
```

**This cleanup must be preserved to avoid WASM memory leaks.**

### ESM / Top-Level Await Handling

yoga-layout 3.2.1's default entry point uses top-level await for WASM initialization. Implications:

1. The package **must** be used in an ESM context (`"type": "module"` in package.json)
2. All files importing `yoga-layout` must be ESM modules
3. For CJS consumers, the `yoga-layout/load` entry point can be used with dynamic `import()`
4. **tsconfig must use `"moduleResolution": "bundler"` or `"node16"`** — the older `"node"` resolution strategy fails to resolve `yoga-layout/load` exports

---

## 4. Hidden Module-Level Dependencies in Ink's Code

### reconciler.ts — Module-Level State

| Variable | Type | Purpose | Action |
|----------|------|---------|--------|
| `currentUpdatePriority` | `number` | Tracks React update priority | **Keep** — required by reconciler API |
| `currentRootNode` | `DOMElement \| undefined` | Tracks root for `<Static>` component dirty marking | **Strip** — Phase 6 concern |
| `packageInfo` | `{name, version}` | Renderer metadata for devtools | **Simplify** — hardcode `{name: 'tui-engine', version: '0.1.0'}` |
| Dev-mode TLA block | `await import('./devtools.js')` | React DevTools connection | **Strip** — optional, add back later |
| `loadPackageJson()` | async function | Reads package.json at runtime | **Strip** — unnecessary |

### reconciler.ts — Ink-Specific Props to Strip

| Prop Handling | What It Does | Action |
|---------------|-------------|--------|
| `internal_static` | Marks `<Static>` component nodes | **Strip** — Phase 6 |
| `internal_transform` | Stores `<Transform>` callback | **Keep** — Phase 2 will need it, cheap to keep |
| `internal_accessibility` | Accessibility roles/states | **Strip** — not part of v1 requirements |
| `isStaticDirty` / `staticNode` | `<Static>` re-render tracking | **Strip** — Phase 6 |
| `onImmediateRender` | Bypass throttle for `<Static>` | **Strip** — Phase 6 |

### dom.ts — Module-Level State

| Variable | Type | Purpose | Action |
|----------|------|---------|--------|
| None | — | dom.ts is stateless | No issues |

### dom.ts — Ink-Specific Fields on DOMElement

| Field | Purpose | Action |
|-------|---------|--------|
| `internal_transform` | `<Transform>` component | **Keep** — needed Phase 2 |
| `internal_accessibility` | Screen reader support | **Strip** — not in v1 scope |
| `isStaticDirty` | `<Static>` dirty tracking | **Strip** — Phase 6 |
| `staticNode` | Reference to `<Static>` node | **Strip** — Phase 6 |
| `onComputeLayout` | Layout callback (set by ink.tsx) | **Keep** — core layout trigger |
| `onRender` | Render callback (set by ink.tsx) | **Keep** — will be set by Phase 6 |
| `onImmediateRender` | Immediate render for `<Static>` | **Strip** — Phase 6 |
| `internal_layoutListeners` | Layout change notification | **Keep** — used by `measureElement` |

### measure-text.ts — Module-Level State

| Variable | Type | Purpose | Action |
|----------|------|---------|--------|
| `cache` | `Map<string, {width, height}>` | Measurement cache | **Keep** — performance optimization |

### wrap-text.ts — Module-Level State

| Variable | Type | Purpose | Action |
|----------|------|---------|--------|
| `cache` | `Record<string, string>` | Wrapping result cache | **Keep** — performance optimization |

### External Module Coupling (instances.ts, ink.tsx)

The `instances` WeakMap in `instances.ts` is **NOT imported by any Phase 1 files**. It's used by `render.ts` and `ink.tsx` (Phase 6). Safe to ignore entirely.

The reconciler's `resetAfterCommit` calls `rootNode.onComputeLayout()`, `rootNode.onRender()`, and `rootNode.onImmediateRender()` — these are callback properties set by whoever creates the root node. In Ink, this is `ink.tsx`. In our Phase 1 tests, we set them directly on the root node.

---

## 5. Project Structure for Phase 1

### package.json

```json
{
  "name": "tui-engine",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest"
  },
  "dependencies": {
    "react-reconciler": "^0.33.0",
    "scheduler": "^0.27.0",
    "yoga-layout": "~3.2.1",
    "widest-line": "^6.0.0",
    "string-width": "^8.1.1",
    "wrap-ansi": "^10.0.0",
    "cli-truncate": "^5.1.1",
    "cli-boxes": "^3.0.0",
    "ansi-styles": "^6.2.1",
    "type-fest": "^5.4.1"
  },
  "peerDependencies": {
    "react": ">=19.0.0"
  },
  "devDependencies": {
    "react": "^19.2.4",
    "@types/react": "^19.2.13",
    "@types/react-reconciler": "^0.33.0",
    "@types/scheduler": "^0.26.0",
    "typescript": "^5.8.3",
    "tsup": "^8.5.0",
    "vitest": "^3.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

Key decisions:
- `"moduleResolution": "bundler"` — required for `yoga-layout/load` exports resolution
- `"module": "ESNext"` — required for top-level await in yoga-layout
- `"jsx": "react-jsx"` — React 19 JSX transform (no `import React` needed)

### Directory Structure

```
tui-engine/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                    # Public API exports
│   ├── reconciler/
│   │   ├── index.ts                # Re-export reconciler
│   │   └── reconciler.ts           # Host config + createReconciler (from Ink)
│   ├── dom/
│   │   ├── index.ts                # Re-export DOM types and functions
│   │   ├── dom.ts                  # Node creation, tree mutation (from Ink)
│   │   └── types.ts                # DOMElement, TextNode, OutputTransformer types
│   ├── layout/
│   │   ├── index.ts                # Re-export layout functions
│   │   ├── styles.ts               # Yoga style application (from Ink)
│   │   ├── measure-text.ts         # Text dimension measurement (from Ink)
│   │   ├── wrap-text.ts            # Text wrapping/truncation (from Ink)
│   │   ├── squash-text-nodes.ts    # Text node flattening (from Ink)
│   │   ├── get-max-width.ts        # Content width calculation (from Ink)
│   │   └── sanitize-ansi.ts        # ANSI sanitization (from Ink)
│   └── util/
│       └── ansi-tokenizer.ts       # ANSI tokenizer (from Ink, zero deps)
├── test/
│   ├── reconciler.test.tsx         # Reconciler + DOM tree tests
│   ├── layout.test.ts              # Yoga layout computation tests
│   ├── measure-text.test.ts        # Text measurement tests
│   └── integration.test.tsx        # Reconciler + Yoga end-to-end
└── .gitignore
```

### Cargo.toml (Placeholder for Mono-repo)

Phase 1 does NOT include Rust code, but the repo structure should accommodate it:

```
tui-engine/
├── src/           # JS/TS source
├── crate/         # Rust source (Phase 4+)
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
├── package.json
└── tsconfig.json
```

No Cargo.toml needed in Phase 1. The `crate/` directory can be created when Phase 4 begins.

---

## 6. Minimal Integration Test

### Test 1: Reconciler Creates Correct DOM Tree

```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import Yoga from 'yoga-layout';
import reconciler from '../src/reconciler/reconciler.js';
import { createNode, type DOMElement } from '../src/dom/dom.js';

describe('Reconciler + DOM', () => {
  it('creates correct node tree from JSX', async () => {
    const rootNode = createNode('ink-root');

    // Minimal layout callback
    rootNode.onComputeLayout = () => {
      rootNode.yogaNode!.calculateLayout(
        undefined, undefined, Yoga.DIRECTION_LTR
      );
    };

    // Create container
    const container = reconciler.createContainer(
      rootNode,  // containerInfo
      0,         // tag (LegacyRoot)
      null,      // hydrationCallbacks
      false,     // isStrictMode
      null,      // concurrentUpdatesByDefaultOverride
      '',        // identifierPrefix
      () => {},  // onUncaughtError
      () => {},  // onCaughtError
      () => {},  // onRecoverableError
      null,      // transitionCallbacks
    );

    // Render JSX into container
    reconciler.updateContainer(
      React.createElement('ink-box', {
        style: { flexDirection: 'row' }
      },
        React.createElement('ink-text', null,
          'Hello'
        ),
        React.createElement('ink-text', null,
          'World'
        ),
      ),
      container,
      null,
      () => {},
    );

    // Verify DOM tree structure
    expect(rootNode.childNodes.length).toBe(1);
    const box = rootNode.childNodes[0] as DOMElement;
    expect(box.nodeName).toBe('ink-box');
    expect(box.childNodes.length).toBe(2);

    const text1 = box.childNodes[0] as DOMElement;
    const text2 = box.childNodes[1] as DOMElement;
    expect(text1.nodeName).toBe('ink-text');
    expect(text2.nodeName).toBe('ink-text');

    // Verify Yoga nodes exist and mirror DOM
    expect(box.yogaNode).toBeDefined();
    expect(text1.yogaNode).toBeDefined();
    expect(text2.yogaNode).toBeDefined();
    expect(box.yogaNode!.getChildCount()).toBe(2);
  });
});
```

### Test 2: Yoga Computes Correct Layout

```typescript
describe('Yoga Layout', () => {
  it('computes flex row layout with text measurement', async () => {
    const rootNode = createNode('ink-root');
    rootNode.yogaNode!.setWidth(80);
    rootNode.yogaNode!.setHeight(24);

    rootNode.onComputeLayout = () => {
      rootNode.yogaNode!.calculateLayout(
        undefined, undefined, Yoga.DIRECTION_LTR
      );
    };

    const container = reconciler.createContainer(
      rootNode, 0, null, false, null, '',
      () => {}, () => {}, () => {}, null,
    );

    reconciler.updateContainer(
      React.createElement('ink-box', {
        style: { flexDirection: 'row', padding: 1 }
      },
        React.createElement('ink-text', null, 'Hello'),
        React.createElement('ink-text', null, 'World'),
      ),
      container, null, () => {},
    );

    // After reconciliation, layout should be computed
    const box = rootNode.childNodes[0] as DOMElement;
    expect(box.yogaNode!.getComputedWidth()).toBe(80);

    const text1 = box.childNodes[0] as DOMElement;
    const text2 = box.childNodes[1] as DOMElement;

    // Text nodes should have computed positions
    expect(text1.yogaNode!.getComputedLeft()).toBe(1); // padding
    expect(text1.yogaNode!.getComputedTop()).toBe(1);  // padding
    expect(text1.yogaNode!.getComputedWidth()).toBe(5); // "Hello" = 5 chars

    expect(text2.yogaNode!.getComputedLeft()).toBe(6); // after "Hello" + padding
    expect(text2.yogaNode!.getComputedWidth()).toBe(5); // "World" = 5 chars
  });
});
```

### Test 3: All Flexbox Props Apply Correctly

```typescript
describe('Flexbox Props', () => {
  it('applies all layout styles to Yoga nodes', () => {
    const node = Yoga.Node.create();

    applyStyles(node, {
      flexDirection: 'row',
      flexWrap: 'wrap',
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: 100,
      justifyContent: 'space-between',
      alignItems: 'center',
      alignSelf: 'flex-start',
      width: 80,
      height: 24,
      minWidth: 40,
      minHeight: 10,
      padding: 2,
      margin: 1,
      gap: 1,
      position: 'relative',
    });

    expect(node.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_ROW);
    expect(node.getFlexWrap()).toBe(Yoga.WRAP_WRAP);
    expect(node.getFlexGrow()).toBe(1);
    expect(node.getFlexShrink()).toBe(0);
    expect(node.getJustifyContent()).toBe(Yoga.JUSTIFY_SPACE_BETWEEN);
    expect(node.getAlignItems()).toBe(Yoga.ALIGN_CENTER);

    node.freeRecursive();
  });
});
```

### Test 4: Text Measurement (Unicode, Emoji, ANSI)

```typescript
describe('Text Measurement', () => {
  it('measures ASCII text correctly', () => {
    const dims = measureText('Hello');
    expect(dims.width).toBe(5);
    expect(dims.height).toBe(1);
  });

  it('measures multi-line text', () => {
    const dims = measureText('Hello\nWorld');
    expect(dims.width).toBe(5);
    expect(dims.height).toBe(2);
  });

  it('handles CJK characters (double-width)', () => {
    const dims = measureText('世界');
    expect(dims.width).toBe(4); // Each CJK char = 2 columns
    expect(dims.height).toBe(1);
  });

  it('strips ANSI when measuring', () => {
    const dims = measureText('\u001b[31mHello\u001b[0m');
    expect(dims.width).toBe(5); // ANSI codes don't count
  });
});
```

---

## 7. npm Dependencies — Full List for Phase 1

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react-reconciler` | `^0.33.0` | React custom renderer API |
| `scheduler` | `^0.27.0` | React scheduler (required by reconciler 0.33) |
| `yoga-layout` | `~3.2.1` | Flexbox layout engine (WASM) |
| `widest-line` | `^6.0.0` | Measure widest line in multiline string (uses string-width internally) |
| `string-width` | `^8.1.1` | Unicode-aware string display width |
| `wrap-ansi` | `^10.0.0` | ANSI-aware text wrapping |
| `cli-truncate` | `^5.1.1` | ANSI-aware text truncation |
| `cli-boxes` | `^3.0.0` | Border style character definitions (types only in Phase 1) |
| `ansi-styles` | `^6.2.1` | Color name types |
| `type-fest` | `^5.4.1` | `LiteralUnion` utility type |

### Peer Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | `>=19.0.0` | React runtime |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | `^19.2.4` | React for testing |
| `@types/react` | `^19.2.13` | React type definitions |
| `@types/react-reconciler` | `^0.33.0` | Reconciler type definitions |
| `@types/scheduler` | `^0.26.0` | Scheduler type definitions |
| `typescript` | `^5.8.3` | Type checking |
| `tsup` | `^8.5.0` | Build tool |
| `vitest` | `^3.0.0` | Test runner |

---

## 8. Key Risks and Mitigations for Phase 1

### Risk 1: `createContainer` API Instability

The `createContainer` method signature varies between reconciler versions and is not well-documented. Ink's current usage (via `ink.tsx`) must be examined for the exact parameter order.

**Mitigation:** Copy Ink's `createContainer` call from `ink.tsx` as the reference. The test suite validates it works.

### Risk 2: Top-Level Await in yoga-layout Breaks CJS Consumers

yoga-layout 3.2.1 uses TLA in its default entry point. Any test runner or consumer using CJS will fail.

**Mitigation:**
- Set `"type": "module"` in package.json from day one
- Use vitest (native ESM support) as the test runner
- For eventual CJS output (Phase 7), use `yoga-layout/load` entry point with dynamic import
- tsconfig `"moduleResolution": "bundler"` resolves the exports correctly

### Risk 3: Yoga Memory Leaks

Every `Yoga.Node.create()` allocates WASM memory that is never garbage collected. If nodes aren't freed with `freeRecursive()`, memory leaks accumulate.

**Mitigation:**
- Ink's `cleanupYogaNode()` function already handles this — copy it exactly
- Called in `removeChild` and `removeChildFromContainer`
- Add a test that creates/destroys 1000 nodes and checks for stability

### Risk 4: `@types/react-reconciler` Lag

The `@types/react-reconciler` package is community-maintained and often lags behind the actual react-reconciler API. Ink uses `// @ts-expect-error` in several places.

**Mitigation:**
- Use `@types/react-reconciler@^0.33.0` as starting point
- Be prepared to add `@ts-expect-error` or use `any` casts for methods not yet typed
- Ink's reconciler.ts is the ground truth — if it works at runtime, trust it over the types

### Risk 5: Ink's `ansi-tokenizer.ts` Is 340 Lines of Custom Code

The `sanitize-ansi.ts` → `ansi-tokenizer.ts` dependency chain is substantial custom code (not an npm package). It's needed by `squash-text-nodes.ts` which is needed by the text measurement pipeline.

**Mitigation:**
- Copy `ansi-tokenizer.ts` as-is — it has zero external dependencies and is well-tested in Ink
- It's pure string parsing, fully portable
- Alternative: use `@alcalzone/ansi-tokenize` (npm) which Ink also depends on for its output module — but the internal tokenizer is simpler and sufficient for sanitization

---

## 9. Exact Extraction Steps

### Step-by-step for each file:

1. **Define `OutputTransformer` type** inline in `src/dom/types.ts` — breaks the circular dep on `render-node-to-output.ts`

2. **Copy `dom.ts`** → `src/dom/dom.ts`
   - Update imports to use local paths
   - Remove `internal_accessibility` field from DOMElement type
   - Import `OutputTransformer` from local types.ts

3. **Copy `styles.ts`** → `src/layout/styles.ts`
   - No changes needed — it only imports from yoga-layout and npm type packages

4. **Copy `measure-text.ts`** → `src/layout/measure-text.ts`
   - No changes needed

5. **Copy `wrap-text.ts`** → `src/layout/wrap-text.ts`
   - Update styles import path

6. **Copy `squash-text-nodes.ts`** → `src/layout/squash-text-nodes.ts`
   - Update dom and sanitize-ansi import paths

7. **Copy `sanitize-ansi.ts`** → `src/layout/sanitize-ansi.ts`
   - Update ansi-tokenizer import path

8. **Copy `ansi-tokenizer.ts`** → `src/util/ansi-tokenizer.ts`
   - No changes needed (zero external deps)

9. **Copy `get-max-width.ts`** → `src/layout/get-max-width.ts`
   - No changes needed

10. **Copy `reconciler.ts`** → `src/reconciler/reconciler.ts`
    - Remove devtools integration block (TLA + conditional import)
    - Remove `loadPackageJson()` and associated TLA
    - Hardcode `rendererPackageName: 'tui-engine'` and `rendererVersion`
    - Remove `currentRootNode` tracking and `internal_static` handling
    - Remove `internal_accessibility` prop handling
    - Strip `isStaticDirty` / `onImmediateRender` logic from `resetAfterCommit`
    - Update all import paths
    - Keep all other host config methods exactly as-is

---

## 10. Requirement Coverage Mapping

| Requirement | How Phase 1 Addresses It |
|-------------|-------------------------|
| **RECON-01** | Surgical extraction of reconciler.ts + dom.ts with stripped coupling |
| **RECON-02** | Copy all mutation methods from Ink's host config (createInstance, appendChild, removeChild, commitUpdate, commitTextUpdate, insertBefore + container variants) |
| **RECON-03** | DOMElement type + createNode() produce all 5 node types (ink-root, ink-box, ink-text, ink-virtual-text, #text) |
| **RECON-04** | Use react-reconciler@0.33.0 + react@19.x with all new required methods |
| **RECON-05** | Yoga.Node.create() in createNode(), insertChild/removeChild in tree mutations, measureFunc on ink-text |
| **LYOT-01** | yoga-layout@3.2.1 with calculateLayout() in onComputeLayout callback |
| **LYOT-02** | applyFlexStyles() in styles.ts covers all flex props |
| **LYOT-03** | applyDimensionStyles() in styles.ts covers width/height/min/max + percentages |
| **LYOT-04** | applyMarginStyles() + applyPaddingStyles() + applyGapStyles() in styles.ts |
| **LYOT-05** | applyPositionStyles() in styles.ts handles absolute/relative/static |
| **LYOT-06** | measureTextNode() in dom.ts + measureText() using widest-line (which uses string-width) |

---

*Research complete: 2026-03-11*
*Sources: Ink v6.8.0 (GitHub master), yoga-layout 3.2.1 (npm/unpkg), react-reconciler README (GitHub), React fiber config (GitHub)*

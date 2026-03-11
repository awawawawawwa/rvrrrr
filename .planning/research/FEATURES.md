# TUI Engine — Feature Research

> Research date: 2026-03-11
> Frameworks surveyed: Ink (v6.8), Ratatui (0.30+), Bubbletea (v2), Blessed, Textual (Python)

---

## 1. Table Stakes (Must Have — Users Leave Without These)

These are features Ink provides today. tui-engine must replicate them to claim "drop-in replacement" status.

### 1.1 Core Components

| Feature | Ink has it | Complexity | Dependencies | Notes |
|---------|-----------|------------|--------------|-------|
| **Box** — flexbox container with all Yoga props | Yes | Medium | Yoga layout engine | `flexDirection`, `flexWrap`, `flexGrow`, `flexShrink`, `flexBasis`, `justifyContent`, `alignItems`, `alignSelf`, `position`, `display`, `overflow`, `overflowX`, `overflowY`, `width`, `height`, `minWidth`, `minHeight`, full margin/padding shorthand + per-side, `gap`/`columnGap`/`rowGap` |
| **Box borders** — preset + custom styles | Yes | Low | Box component | Presets: `single`, `double`, `round`, `bold`, `singleDouble`, `classic`. Custom object with per-side/corner characters. Per-side enable/disable (`borderTop`, `borderBottom`, etc.). Border color props including `borderDimColor`. |
| **Text** — styled terminal text | Yes | Low | ANSI color support | Props: `color`, `backgroundColor`, `dimColor`, `bold`, `italic`, `underline`, `strikethrough`, `inverse`, `wrap` (values: `wrap`, `truncate`, `truncate-start`, `truncate-middle`, `truncate-end`) |
| **Newline** — explicit line break | Yes | Low | None | Trivial component, but part of public API |
| **Spacer** — flexible/fixed spacing | Yes | Low | Yoga layout | Sets `flexGrow: 1` by default to push siblings apart |
| **Transform** — output transform function | Yes | Medium | Rendering pipeline | Receives rendered string output and returns transformed string. Used for effects like gradient text. |

### 1.2 Hooks

| Feature | Ink has it | Complexity | Dependencies | Notes |
|---------|-----------|------------|--------------|-------|
| **useInput(callback, options?)** | Yes | Medium | stdin stream | Callback receives `(input, key)`. Key object has: `upArrow`, `downArrow`, `leftArrow`, `rightArrow`, `return`, `escape`, `ctrl`, `shift`, `tab`, `backspace`, `delete`, `meta`. `options.isActive` to enable/disable. |
| **useApp()** | Yes | Low | App context | Returns `{ exit(error?) }`. Triggers unmount + resolves `waitUntilExit()`. |
| **useStdin()** | Yes | Low | stdin stream | Returns `{ stdin, isRawModeSupported, setRawMode(flag) }` |
| **useFocus(options?)** | Yes | Medium | Focus manager | Returns `{ isFocused }`. Options: `autoFocus`, `isActive`, `id`. Tab key cycles focus. |
| **useFocusManager()** | Yes | Low | Focus system | Returns `{ enableFocus, disableFocus, focusNext, focusPrevious, focus(id) }` |

### 1.3 Render API

| Feature | Ink has it | Complexity | Dependencies | Notes |
|---------|-----------|------------|--------------|-------|
| **render(element, options?)** | Yes | High | Reconciler, Yoga, renderer | Entry point. Options: `stdout`, `stdin`, `stderr`, `debug`, `exitOnCtrlC`, `patchConsole`. Returns Instance. |
| **Instance.rerender(element)** | Yes | Medium | render() | Replace/update root element |
| **Instance.unmount()** | Yes | Low | render() | Tear down React tree + cleanup |
| **Instance.waitUntilExit()** | Yes | Low | render() | Promise that resolves on unmount |
| **Instance.clear()** | Yes | Low | render() | Erase rendered output from terminal |
| **Instance.cleanup()** | Yes | Low | render() | Internal cleanup (raw mode, listeners) |
| **Static component** | Yes | High | Rendering pipeline | Renders items permanently above dynamic content. Items render once, never re-render. Critical for test runners (TAP), build tools (Gatsby), task lists. |
| **renderToString(element)** — sync string render | Yes (v6+) | Medium | Reconciler, Yoga | Synchronous render to string. Bypasses effects. Useful for testing + snapshot. |

### 1.4 Layout System

| Feature | Ink has it | Complexity | Dependencies | Notes |
|---------|-----------|------------|--------------|-------|
| **Yoga flexbox layout** | Yes | High (forked) | yoga-wasm-web / yoga-layout | Full flexbox: direction, wrapping, alignment, grow/shrink, absolute positioning, percentage values |
| **measureElement(ref)** | Yes | Medium | Yoga layout | Returns `{ width, height }` for a Box ref. Used in `useEffect` for responsive layouts. |
| **Terminal resize handling** | Yes | Medium | stdout events | Re-layout + re-render on `SIGWINCH` / stdout resize |
| **Text wrapping + truncation** | Yes | Medium | Text component, Yoga | Word-aware wrapping, multiple truncation modes with ellipsis |

### 1.5 Infrastructure

| Feature | Ink has it | Complexity | Dependencies | Notes |
|---------|-----------|------------|--------------|-------|
| **React reconciler** | Yes | High (forked) | react-reconciler | Custom React renderer. Manages component tree → internal DOM nodes. |
| **Console patching** | Yes | Low | render() | `patchConsole` option intercepts `console.log` etc. to prevent output corruption |
| **Error boundaries** | Yes (React built-in) | Low | React | Standard React error boundaries work in Ink |
| **exitOnCtrlC** | Yes | Low | stdin | Default behavior, configurable via render options |

---

## 2. Differentiators (Competitive Advantage — What Rust Enables)

These are features that tui-engine's architecture uniquely enables or dramatically improves over Ink.

### 2.1 Performance

| Feature | Ink has it | Complexity | Dependencies | Why Rust wins |
|---------|-----------|------------|--------------|---------------|
| **Incremental diffing renderer** | Partially (PR #751) | High | Rendering pipeline | Ink added line-level diffing recently; Rust can do character-level or cell-level diffing at native speed. Eliminates flickering that has plagued Ink for years (issues #450, #359, #413). |
| **Sub-millisecond render cycles** | No | High | Full pipeline | Ratatui achieves sub-ms renders. Ink's JS-based output serialization + ANSI generation is a bottleneck on complex UIs. Rust binary handles the hot path. |
| **Zero-flicker rendering** | No | Medium | Diff renderer | Synchronized output (Mode 2026 / DCS sequences) + smart cursor movement. Bubbletea v2's "Cursed Renderer" proved this is a major selling point. |
| **Large output handling** | No | Medium | Diff renderer | Ink struggles visibly with outputs exceeding terminal height. Rust renderer can handle arbitrarily large buffers with constant-time diffing. |
| **Parallel layout + render** | No | High | Architecture | Yoga layout in JS thread, Rust render in separate process — true parallelism. Layout for frame N+1 while frame N renders. |

### 2.2 Terminal Capabilities

| Feature | Ink has it | Complexity | Dependencies | Why Rust wins |
|---------|-----------|------------|--------------|---------------|
| **True color + color downsampling** | Partial | Medium | Terminal detection | Auto-detect terminal color depth (truecolor → 256 → 16 → mono) and downsample gracefully. Bubbletea v2 does this with colorprofile lib; Rust can do it natively in the renderer. |
| **Synchronized output (Mode 2026)** | No | Low | Renderer | Wrap frame output in `CSI ? 2026 h` / `CSI ? 2026 l` to eliminate partial-frame rendering. Trivial in Rust, difficult to bolt onto Ink's streaming output. |
| **Kitty keyboard protocol** | No | Medium | Input handling | Progressive enhancement for terminals that support it — key release events, disambiguated keys, modifier combos (shift+enter, super+space). Bubbletea v2 ships this. |
| **Mouse event support** | No | Medium | Input handling, renderer | Click, scroll, drag events. Ratatui, Bubbletea, Blessed all support mouse. Ink doesn't. |
| **Terminal capability detection** | Partial | Medium | Startup | Auto-detect Unicode support, color depth, graphics protocols, keyboard protocols. Adapt rendering strategy. |

### 2.3 Developer Experience

| Feature | Ink has it | Complexity | Dependencies | Why Rust wins |
|---------|-----------|------------|--------------|---------------|
| **Render profiling / debug mode** | No | Medium | Renderer | Emit per-frame timing (layout ms, serialize ms, render ms, diff ms). Since Rust owns the render pipeline, instrumentation is trivial. |
| **Headless / test backend** | Partial (renderToString) | Medium | Architecture | Ratatui's TestBackend pattern — capture frames as buffers for assertion. Much richer than string snapshot testing. |
| **Hot reload friendly** | No | Low | Architecture | Rust renderer process stays alive across JS HMR cycles. No cold-start penalty on code changes. |

---

## 3. Anti-Features (Deliberately NOT Building)

Complexity traps that other frameworks fell into. Avoid these.

### 3.1 Widget Library

| Anti-feature | Who has it | Why avoid | Risk if built |
|-------------|-----------|-----------|---------------|
| **Built-in Table widget** | Ratatui, Blessed | Ink doesn't have it. Ecosystem packages (ink-table) handle this. Building widgets is a maintenance black hole. | Infinite edge cases (column sizing, truncation, selection, sorting). Ship none, let community build them. |
| **Built-in Chart/Sparkline/Gauge** | Ratatui, Blessed | Domain-specific widgets don't belong in a rendering engine. | Scope creep. Every vertical wants different chart types. |
| **Built-in Form system** | Blessed | Complex state management that belongs in userland. Ink correctly delegates to ink-text-input etc. | Forms are an application concern, not a renderer concern. |
| **Built-in scrolling primitives** | Ratatui, Bubbletea (viewport) | Ink issue #765 is still open. Scroll is deceptively complex (virtual scroll, lazy render, scroll indicators). | Gets wrong easily. Let it emerge from community need, ship as separate package if at all. |

### 3.2 Architecture Traps

| Anti-feature | Who has it | Why avoid | Risk if built |
|-------------|-----------|-----------|---------------|
| **Cell-based rendering frame** | Ratatui, Bubbletea | Throws away Yoga's layout calculations. Already decided against in PROJECT.md. Widget-based frames preserve layout topology. | Duplicated work: Yoga computes positions → you flatten to cells → you recompute positions for diffing. |
| **Custom component API / DSL** | Textual (CSS), Blessed (custom nodes) | tui-engine is an Ink-compatible engine, not a new framework. React IS the component API. | Fragments the ecosystem. Developers must learn a new abstraction for no gain. |
| **Own state management** | Bubbletea (Elm arch) | React already has useState, useReducer, context, and the entire ecosystem (zustand, jotai, etc.). | Duplicating what React does. Developers lose access to React ecosystem. |
| **Image/graphics rendering** | Kitty protocol, Sixel | Niche feature with fragmented terminal support. High complexity for low adoption. | Kitty protocol isn't universal, sixel is legacy. Not worth the compatibility matrix. |
| **Plugin/middleware system** | Blessed | Adds indirection, versioning headaches, API surface explosion. | Plugin APIs are forever. Get it wrong once, maintain it forever. |
| **Multi-window / split pane management** | Blessed, tmux | Application-level concern. Flexbox already gives you split panes via Box layout. | Conflates layout engine with window management. |

### 3.3 Premature Optimizations

| Anti-feature | Who has it | Why avoid | Risk if built |
|-------------|-----------|-----------|---------------|
| **GPU-accelerated rendering** | Kitty (GPU glyph cache) | Terminal emulator concern, not TUI framework concern. We output ANSI sequences; the terminal decides how to rasterize. | Solving the wrong layer. Zero benefit for a framework that outputs text. |
| **WebAssembly Yoga** | Ink (yoga-wasm-web) | Adds WASM cold-start overhead. Native Yoga binding or pure-JS Yoga is simpler. Evaluate after profiling. | Pre-optimizing layout when rendering is the actual bottleneck. |
| **Custom memory allocator** | Common in Rust | Standard allocator is fine for a rendering process that runs as a sidecar. Profile first. | Complexity for unmeasurable gain. |

---

## 4. Priority Matrix

### P0 — Ship-blocking (Milestone 1)

These must work for anyone to use tui-engine at all:

1. **React reconciler** (forked from Ink) — High complexity
2. **Yoga layout integration** (forked from Ink) — High complexity
3. **Box component** with full flexbox props + borders — Medium complexity
4. **Text component** with all style props — Low complexity
5. **render() + Instance methods** (rerender, unmount, waitUntilExit, clear) — High complexity
6. **useInput hook** — Medium complexity
7. **useApp hook** — Low complexity
8. **Rust renderer** consuming widget-based JSON frames — High complexity
9. **ANSI output generation** in Rust — Medium complexity
10. **Terminal resize handling** — Medium complexity

### P1 — Competitive parity (Milestone 2)

These complete the Ink API surface:

1. **Static component** — High complexity
2. **useStdin hook** — Low complexity
3. **useFocus / useFocusManager** — Medium complexity
4. **Newline, Spacer components** — Low complexity
5. **Transform component** — Medium complexity
6. **measureElement()** — Medium complexity
7. **renderToString()** — Medium complexity
8. **Console patching** — Low complexity
9. **Text wrapping + truncation modes** — Medium complexity
10. **exitOnCtrlC** — Low complexity

### P2 — Differentiators (Milestone 3+)

These make tui-engine worth switching to:

1. **Incremental diffing** (character-level) — High complexity, depends on: Rust renderer
2. **Synchronized output (Mode 2026)** — Low complexity, depends on: Rust renderer
3. **Zero-flicker rendering** — Medium complexity, depends on: incremental diffing + sync output
4. **Color downsampling** — Medium complexity, depends on: terminal detection
5. **Terminal capability detection** — Medium complexity, standalone
6. **Render profiling / debug mode** — Medium complexity, depends on: Rust renderer
7. **Kitty keyboard protocol** — Medium complexity, depends on: input handling
8. **Mouse events** — Medium complexity, depends on: input handling + renderer
9. **Headless test backend** — Medium complexity, depends on: Rust renderer

---

## 5. Dependency Graph

```
React reconciler
  └─► Yoga layout integration
        └─► Box component (flexbox props, borders)
        └─► Text component (styles, wrapping)
        └─► Newline, Spacer (trivial)
        └─► measureElement()
        └─► Transform component
              └─► JSON widget protocol
                    └─► Rust renderer (ANSI output)
                          └─► Incremental diffing
                          └─► Synchronized output
                          └─► Color downsampling
                          └─► Terminal detection

  └─► render() API
        └─► Instance methods (rerender, unmount, waitUntilExit, clear)
        └─► Static component
        └─► Console patching
        └─► exitOnCtrlC

  └─► useInput ──► useStdin (stdin stream)
  └─► useApp (app context)
  └─► useFocus ──► useFocusManager
```

---

## 6. Key Takeaways

1. **Ink's API is small and focused.** ~5 components, ~5 hooks, 1 entry point. This is achievable. The hard part is the reconciler + Yoga fork, not the API surface.

2. **The Rust renderer is the entire value proposition.** Everything before it (reconciler, Yoga, components) is table stakes that Ink already does well. The renderer is where tui-engine earns its existence.

3. **Flickering is Ink's biggest pain point.** Issues #450, #359, #413, #717, #751 span years. A Rust renderer with proper diffing + synchronized output solves this completely. Lead marketing with "zero-flicker."

4. **Don't build widgets.** Ratatui and Blessed prove that widget libraries are maintenance sinkholes. tui-engine is a rendering engine, not a component library. Let the Ink ecosystem packages (ink-table, ink-select-input, ink-text-input) work unchanged.

5. **Bubbletea v2 set the 2026 performance bar.** Their "Cursed Renderer" (ncurses-based, 10x faster) and Kitty keyboard protocol support are what modern TUI users expect. tui-engine should match or exceed this in the React/Node ecosystem.

6. **Mouse support is a differentiator, not table stakes.** Ink has survived without it. But Ratatui, Bubbletea, and Blessed all have it. It's a P2 feature that signals maturity.

---

*Sources: Ink v6.8 (npm), Ink GitHub issues/PRs, Ratatui 0.30 docs, Bubbletea v2 release notes, Blessed npm, Kitty terminal docs, LogRocket TUI comparison (2026)*

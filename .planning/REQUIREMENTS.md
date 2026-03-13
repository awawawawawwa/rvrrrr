# Requirements: tui-engine

**Defined:** 2026-03-11
**Core Value:** Ink-compatible DX with Rust-level rendering performance

## v1 Requirements

### Reconciler

- [ ] **RECON-01**: React reconciler forked from Ink with clean module boundaries (no hidden coupling)
- [ ] **RECON-02**: Host config supports full mutation API (createInstance, appendChild, removeChild, commitUpdate, commitTextUpdate, insertBefore)
- [ ] **RECON-03**: DOM tree with Ink node types (ink-root, ink-box, ink-text, ink-virtual-text, #text)
- [ ] **RECON-04**: React 19 + react-reconciler 0.32.0 compatibility
- [ ] **RECON-05**: Yoga node tree mirrors DOM tree with correct parent/child relationships

### Layout

- [ ] **LYOT-01**: Yoga 3.2.1 integration computing correct x/y/width/height for all nodes
- [ ] **LYOT-02**: Full flexbox props: flexDirection, flexWrap, flexGrow, flexShrink, flexBasis, justifyContent, alignItems, alignSelf
- [ ] **LYOT-03**: Dimension props: width, height, minWidth, minHeight, percentage values
- [ ] **LYOT-04**: Spacing props: margin (all sides + shorthand), padding (all sides + shorthand), gap/columnGap/rowGap
- [ ] **LYOT-05**: Position: absolute and relative positioning
- [ ] **LYOT-06**: Text measurement callback using string-width (handles Unicode, emoji, ANSI stripping)
- [x] **LYOT-07**: Terminal resize triggers re-layout with new dimensions

### Components

- [ ] **COMP-01**: Box component with all Yoga flexbox layout props
- [ ] **COMP-02**: Box borders — 6 preset styles (single, double, round, bold, singleDouble, classic) + custom + per-side enable/disable + border colors
- [ ] **COMP-03**: Text component with color, backgroundColor, dimColor, bold, italic, underline, strikethrough, inverse
- [ ] **COMP-04**: Text wrapping modes: wrap, truncate, truncate-start, truncate-middle, truncate-end
- [ ] **COMP-05**: Newline component
- [ ] **COMP-06**: Spacer component (flexGrow: 1)
- [ ] **COMP-07**: Transform component (receives rendered string, returns transformed string)

### Hooks

- [x] **HOOK-01**: useInput with full key parsing (arrows, return, escape, ctrl, shift, tab, backspace, delete, meta)
- [x] **HOOK-02**: useApp returning exit(error?)
- [x] **HOOK-03**: useStdin returning stdin, isRawModeSupported, setRawMode
- [x] **HOOK-04**: useFocus with autoFocus, isActive, id options
- [x] **HOOK-05**: useFocusManager with enableFocus, disableFocus, focusNext, focusPrevious, focus(id)

### Render API

- [x] **RAPI-01**: render(element, options?) entry point with stdout, stdin, stderr, debug, exitOnCtrlC, patchConsole options
- [x] **RAPI-02**: Instance.rerender(element)
- [x] **RAPI-03**: Instance.unmount() with proper lifecycle state machine
- [x] **RAPI-04**: Instance.waitUntilExit() returning Promise
- [x] **RAPI-05**: Instance.clear() erasing rendered output
- [ ] **RAPI-06**: Static component for permanent output above dynamic content
- [ ] **RAPI-07**: renderToString(element) synchronous render
- [ ] **RAPI-08**: measureElement(ref) returning {width, height}
- [ ] **RAPI-09**: Console patching to prevent output corruption

### Protocol

- [ ] **PROT-01**: Widget-based JSON schema mirroring Yoga node topology (box + text node types)
- [ ] **PROT-02**: Absolute coordinates pre-computed on JS side
- [ ] **PROT-03**: Message framing (length-prefix or NDJSON)
- [ ] **PROT-04**: Error message type for Rust → JS error propagation
- [x] **PROT-05**: Input event forwarding from Rust → JS for useInput

### Rust Renderer

- [ ] **RUST-01**: Double-buffered cell grid (Cell struct with grapheme, fg, bg, style attributes)
- [ ] **RUST-02**: Box painting — background fill, border characters, padding offset
- [ ] **RUST-03**: Text painting — ANSI-aware character placement respecting node bounds
- [ ] **RUST-04**: Unicode-aware display width (strips ANSI, handles CJK, emoji)
- [ ] **RUST-05**: Character-level diff between current and previous buffer
- [ ] **RUST-06**: ANSI escape code emission via crossterm with batched cursor moves
- [ ] **RUST-07**: Overflow clipping for overflow: hidden
- [ ] **RUST-08**: Raw mode enter/exit with crash-safe restoration (panic hook, signal handlers)
- [ ] **RUST-09**: Alternate screen buffer management
- [x] **RUST-10**: Terminal resize detection and re-render

### Bridge

- [x] **BRDG-01**: Spawn Rust binary as child process from Node.js
- [x] **BRDG-02**: Stdin EOF detection — Rust exits when parent dies
- [x] **BRDG-03**: Graceful shutdown on SIGINT, SIGTERM, uncaughtException
- [x] **BRDG-04**: Render throttling (configurable maxFps, default 30)

### Distribution

- [ ] **DIST-01**: npm package with per-platform prebuilt Rust binaries (linux-x64-gnu, linux-x64-musl, linux-arm64-gnu, darwin-x64, darwin-arm64, win32-x64-msvc, win32-arm64-msvc)
- [ ] **DIST-02**: cargo install tui-engine-renderer as alternative
- [ ] **DIST-03**: Dual CJS/ESM output via tsup
- [ ] **DIST-04**: Zero postinstall scripts — optionalDependencies pattern only

## v2 Requirements

### Performance

- **PERF-01**: Zero-flicker rendering via synchronized output (Mode 2026)
- **PERF-02**: Color downsampling (truecolor → 256 → 16 → mono based on terminal detection)
- **PERF-03**: Render profiling / debug mode (per-frame timing: layout ms, serialize ms, render ms, diff ms)

### Terminal Capabilities

- **TERM-01**: Kitty keyboard protocol (key release events, disambiguated keys, modifier combos)
- **TERM-02**: Mouse event support (click, scroll, drag)
- **TERM-03**: Terminal capability auto-detection (Unicode, color depth, keyboard protocol)

### Developer Experience

- **DX-01**: Headless test backend (capture frames as buffers for assertion)
- **DX-02**: Hot reload friendly (Rust renderer stays alive across JS HMR cycles)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Built-in widgets (Table, Chart, Gauge, Form) | Rendering engine, not a component library. Let community build these. |
| Cell-based rendering frame | Throws away Yoga's layout work. Widget-based chosen. |
| Custom component API / DSL | React IS the component API. No new abstractions. |
| Own state management | React has useState, useReducer, context, and full ecosystem. |
| Plugin/middleware system | API surfaces are forever. |
| Image/graphics rendering (Sixel, Kitty) | Niche, fragmented terminal support. |
| GPU-accelerated rendering | Terminal emulator concern, not TUI framework concern. |
| Multi-window / split pane manager | Application-level concern. Flexbox handles splits. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RECON-01 | Phase 1 | Pending |
| RECON-02 | Phase 1 | Pending |
| RECON-03 | Phase 1 | Pending |
| RECON-04 | Phase 1 | Pending |
| RECON-05 | Phase 1 | Pending |
| LYOT-01 | Phase 1 | Pending |
| LYOT-02 | Phase 1 | Pending |
| LYOT-03 | Phase 1 | Pending |
| LYOT-04 | Phase 1 | Pending |
| LYOT-05 | Phase 1 | Pending |
| LYOT-06 | Phase 1 | Pending |
| LYOT-07 | Phase 6 | Complete |
| COMP-01 | Phase 2 | Pending |
| COMP-02 | Phase 2 | Pending |
| COMP-03 | Phase 2 | Pending |
| COMP-04 | Phase 2 | Pending |
| COMP-05 | Phase 2 | Pending |
| COMP-06 | Phase 2 | Pending |
| COMP-07 | Phase 2 | Pending |
| HOOK-01 | Phase 6 | Complete |
| HOOK-02 | Phase 6 | Complete |
| HOOK-03 | Phase 6 | Complete |
| HOOK-04 | Phase 6 | Complete |
| HOOK-05 | Phase 6 | Complete |
| RAPI-01 | Phase 6 | Complete |
| RAPI-02 | Phase 6 | Complete |
| RAPI-03 | Phase 6 | Complete |
| RAPI-04 | Phase 6 | Complete |
| RAPI-05 | Phase 6 | Complete |
| RAPI-06 | Phase 6 | Pending |
| RAPI-07 | Phase 6 | Pending |
| RAPI-08 | Phase 6 | Pending |
| RAPI-09 | Phase 6 | Pending |
| PROT-01 | Phase 3 | Pending |
| PROT-02 | Phase 3 | Pending |
| PROT-03 | Phase 3 | Pending |
| PROT-04 | Phase 3 | Pending |
| PROT-05 | Phase 5 | Complete |
| RUST-01 | Phase 4 | Pending |
| RUST-02 | Phase 4 | Pending |
| RUST-03 | Phase 4 | Pending |
| RUST-04 | Phase 4 | Pending |
| RUST-05 | Phase 4 | Pending |
| RUST-06 | Phase 4 | Pending |
| RUST-07 | Phase 4 | Pending |
| RUST-08 | Phase 4 | Pending |
| RUST-09 | Phase 4 | Pending |
| RUST-10 | Phase 6 | Complete |
| BRDG-01 | Phase 5 | Complete |
| BRDG-02 | Phase 5 | Complete |
| BRDG-03 | Phase 5 | Complete |
| BRDG-04 | Phase 5 | Complete |
| DIST-01 | Phase 7 | Pending |
| DIST-02 | Phase 7 | Pending |
| DIST-03 | Phase 7 | Pending |
| DIST-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 56 total
- Mapped to phases: 56
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after initial definition*

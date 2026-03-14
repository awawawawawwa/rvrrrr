# Roadmap: tui-engine

**Created:** 2026-03-11
**Phases:** 7
**Requirements:** 56 v1 requirements mapped

## Phase 1: Reconciler & Yoga Layout Foundation

**Goal:** Fork Ink's React reconciler and Yoga layout engine into tui-engine as independent, cleanly separated modules that build a DOM tree and compute layout coordinates.
**Requirements:** RECON-01, RECON-02, RECON-03, RECON-04, RECON-05, LYOT-01, LYOT-02, LYOT-03, LYOT-04, LYOT-05, LYOT-06

### Success Criteria
1. A React component tree renders through the forked reconciler and produces a DOM tree with correct Ink node types (ink-root, ink-box, ink-text, ink-virtual-text, #text)
2. Yoga node tree mirrors the DOM tree and computes correct x/y/width/height for nested flex layouts including all flexbox, dimension, spacing, and position props
3. Text measurement callback correctly reports display width for Unicode, emoji, CJK, and ANSI-escaped strings via string-width
4. Reconciler host config supports full mutation API (createInstance, appendChild, removeChild, commitUpdate, commitTextUpdate, insertBefore) with clean module boundaries and no hidden coupling to Ink internals

## Phase 2: Component Layer

**Goal:** Implement the five Ink-compatible components (Box, Text, Newline, Spacer, Transform) on top of the forked reconciler, producing correct Yoga layout nodes.
**Requirements:** COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07

### Success Criteria
1. Box component accepts all Yoga flexbox layout props and renders borders in all 6 preset styles (single, double, round, bold, singleDouble, classic) with custom borders, per-side enable/disable, and border colors
2. Text component renders with color, backgroundColor, dimColor, bold, italic, underline, strikethrough, inverse styles and supports all wrapping/truncation modes (wrap, truncate, truncate-start, truncate-middle, truncate-end)
3. Newline, Spacer, and Transform components produce correct DOM/Yoga output matching Ink's behavior

## Phase 3: Widget Protocol

**Goal:** Design and implement the JSON wire format that serializes the Yoga-computed layout tree into structured messages consumable by an external renderer.
**Requirements:** PROT-01, PROT-02, PROT-03, PROT-04

### Success Criteria
1. JSON schema produces widget-based messages mirroring Yoga's node topology with box and text node types — structure derived from actual Yoga output, not guessed upfront
2. All node coordinates are absolute (pre-computed on JS side) so the renderer needs no layout logic
3. Messages use length-prefix or NDJSON framing suitable for streaming over stdio
4. Error message type enables consumer → producer error propagation

## Phase 4: Rust Renderer

**Goal:** Build the standalone Rust binary that consumes widget JSON frames and paints to the terminal using double-buffered cell-level diffing.
**Requirements:** RUST-01, RUST-02, RUST-03, RUST-04, RUST-05, RUST-06, RUST-07, RUST-08, RUST-09

### Success Criteria
1. Double-buffered cell grid correctly paints boxes (background fill, border characters, padding offsets) and text (ANSI-aware character placement respecting node bounds)
2. Character-level diff between current and previous buffer produces minimal ANSI escape sequences emitted via crossterm with batched cursor moves
3. Overflow clipping correctly hides content outside overflow: hidden boundaries
4. Raw mode and alternate screen buffer are managed crash-safely — panic hooks and signal handlers restore terminal state on any exit path

## Phase 5: Bridge & Process Management

**Goal:** Spawn the Rust renderer as a child process from Node.js with reliable bidirectional communication, lifecycle management, and render throttling.
**Requirements:** BRDG-01, BRDG-02, BRDG-03, BRDG-04, PROT-05
**Plans:** 3/3 plans complete

Plans:
- [ ] 05-01-PLAN.md — Rust async refactor: extend protocol types, refactor main.rs to tokio with bidirectional IPC
- [ ] 05-02-PLAN.md — JS bridge: types, binary resolver, IpcRendererBridge with lifecycle and throttling
- [ ] 05-03-PLAN.md — Integration tests: bridge + renderer end-to-end verification

### Success Criteria
1. Node.js spawns the Rust binary as a child process, sends serialized widget frames over stdin, and receives input events back over stdout
2. Rust process detects stdin EOF and exits cleanly when the parent Node.js process dies
3. Graceful shutdown executes on SIGINT, SIGTERM, and uncaughtException — terminal is always restored
4. Render throttling limits frame delivery to a configurable maxFps (default 30), dropping intermediate frames

## Phase 6: API Parity — Hooks, Render API & Integration

**Goal:** Implement the full Ink-compatible public API surface — render() entry point, all five hooks, terminal resize handling, and remaining integration points — wired end-to-end through the bridge.
**Requirements:** HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, RAPI-01, RAPI-02, RAPI-03, RAPI-04, RAPI-05, RAPI-06, RAPI-07, RAPI-08, RAPI-09, LYOT-07, RUST-10
**Plans:** 5/5 plans complete

Plans:
- [ ] 06-01-PLAN.md — Contexts, Key type, and parseKeypress escape sequence parser
- [ ] 06-02-PLAN.md — All five hooks (useInput, useApp, useStdin, useFocus, useFocusManager)
- [ ] 06-03-PLAN.md — render() entry point, Instance lifecycle, terminal resize wiring
- [ ] 06-04-PLAN.md — Static component, renderToString, measureElement, patchConsole
- [ ] 06-05-PLAN.md — Public API index wiring and full verification

### Success Criteria
1. render(element, options?) returns an Instance with working rerender(), unmount(), waitUntilExit(), and clear() methods matching Ink's lifecycle state machine
2. useInput receives fully parsed key events (arrows, return, escape, ctrl, shift, tab, backspace, delete, meta) forwarded from the Rust process through the bridge
3. useFocus/useFocusManager provide focus navigation with autoFocus, isActive, and id options; useApp exposes exit(error?); useStdin exposes stdin, isRawModeSupported, and setRawMode
4. Terminal resize triggers re-layout with new dimensions on the JS side and re-render on the Rust side
5. Static component renders permanent output above dynamic content, renderToString() produces synchronous string output, measureElement() returns {width, height}, and console patching prevents output corruption

## Phase 7: Distribution & Packaging

**Goal:** Package rvrrrr (renamed from tui-engine) for consumption via npm with prebuilt platform-specific Rust binaries and as a standalone cargo crate.
**Requirements:** DIST-01, DIST-02, DIST-03, DIST-04
**Plans:** 1/3 plans executed

Plans:
- [ ] 07-01-PLAN.md — Rename to rvrrrr, create platform npm packages, update binary resolver, dual CJS/ESM
- [ ] 07-02-PLAN.md — Rename Rust crate and add crates.io metadata
- [ ] 07-03-PLAN.md — GitHub Actions CI and release workflows

### Success Criteria
1. npm package installs prebuilt Rust binaries for all 7 platform targets (linux-x64-gnu, linux-x64-musl, linux-arm64-gnu, darwin-x64, darwin-arm64, win32-x64-msvc, win32-arm64-msvc) via optionalDependencies with zero postinstall scripts
2. `cargo install rvrrrr-renderer` works as an alternative installation path
3. Package ships dual CJS/ESM output via tsup

## Dependency Graph

```
P1 (Reconciler + Yoga)
 └─→ P2 (Components)
      └─→ P3 (Protocol)
           └─→ P4 (Rust Renderer)
                └─→ P5 (Bridge) ← needs P3 + P4
                     └─→ P6 (API Parity) ← needs P2 + P5
                          └─→ P7 (Distribution) ← needs P4 + P6
```

**Critical path:** P1 → P2 → P3 → P4 → P5 → P6 → P7 (strictly linear — bottom-up build order)

**Parallel opportunity:** Once P3 defines the JSON schema, Rust renderer work (P4) and remaining JS-side component refinement can overlap. However, the user's preferred build order is sequential.

## Requirement Coverage

| Category | Count | Phase(s) |
|----------|-------|----------|
| Reconciler (RECON) | 5 | 3/3 | Complete   | 2026-03-13 | 7 | 1/3 | In Progress|  | 7 | P2 |
| Hooks (HOOK) | 5 | P6 |
| Render API (RAPI) | 9 | P6 |
| Protocol (PROT) | 5 | P3 (4), P5 (1) |
| Rust Renderer (RUST) | 10 | P4 (9), P6 (1) |
| Bridge (BRDG) | 4 | P5 |
| Distribution (DIST) | 4 | P7 |
| **Total** | **56** | **All mapped** |

---
*Created: 2026-03-11*

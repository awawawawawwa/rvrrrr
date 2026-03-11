# Phase 1: Reconciler & Yoga Layout Foundation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fork Ink's React reconciler and Yoga layout engine into tui-engine as independent, cleanly separated modules that build a DOM tree and compute layout coordinates. This is the JS frontend foundation — no rendering, no protocol, no Rust code yet.

</domain>

<decisions>
## Implementation Decisions

### Fork Strategy
- Surgical copy — extract the 4-5 core files from Ink (dom.ts, reconciler.ts, styles.ts, text measurement utilities)
- Rewrite imports and strip Ink-specific coupling during extraction
- Use `madge` or manual tracing to catch hidden module-level dependencies (instances WeakMap, stream references, throttled onRender callback)
- Do NOT fork the whole repo and prune — too much dead code to remove

### Architecture
- JS frontend (React reconciler + Yoga layout) / Rust backend (crate lib + binary) / JSON API contract between them
- Rust crate is the center of the project — lib (napi-rs addon for npm) + binary (for cargo install)
- JS code lives in the repo alongside the Rust crate but is NOT compiled into it
- npm package bundles JS files + compiled .node native addon
- napi-rs in-process approach — Rust renderer is a library loaded into Node.js, not a child process
- Input handling stays in JS (like Ink) — Rust side only paints to terminal

### Module Organization
- Single npm package (`tui-engine`) with internal folder structure
- JS source organized as: src/reconciler/, src/layout/, src/components/, etc.
- Rust source in crate structure alongside JS

### Version Targets
- React 19 + react-reconciler 0.32.0 — start on latest, don't fork Ink's React 18 and upgrade later
- yoga-layout 3.2.1 — official Facebook WASM package, replaces dead yoga-wasm-web
- Copy Ink's code as reference but target newer versions from the start

### Claude's Discretion
- Exact file organization within src/
- How to handle yoga-layout 3.x ESM-only / top-level await constraints
- Naming conventions for internal modules
- Test structure for reconciler and layout verification

</decisions>

<specifics>
## Specific Ideas

- "Fork from Ink because Ink is battle tested" — use Ink as reference, not starting from scratch
- The user wants to see what Yoga actually produces before designing the JSON protocol (Phase 3)
- Bottom-up build order is deliberate — foundation first, protocol after

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the foundational patterns

### Integration Points
- notebook.txt and protocol.txt contain the user's original architectural sketches
- Reconciler output will feed into Phase 3 (Widget Protocol) — the tree structure this phase produces IS the input to JSON serialization

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-reconciler-yoga-layout-foundation*
*Context gathered: 2026-03-11*

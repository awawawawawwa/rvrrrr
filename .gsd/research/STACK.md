# tui-engine — Stack Research (March 2026)

Prescriptive technology choices for building an Ink-compatible TUI engine with a Rust rendering backend. Each recommendation includes a confidence level: **HIGH** (industry consensus, battle-tested), **MEDIUM** (strong default with caveats), or **LOW** (best available option but landscape is shifting).

---

## 1. JS Side

### React Reconciler

| Choice | Version | Confidence |
|--------|---------|------------|
| `react-reconciler` | `0.32.0` | **HIGH** |
| `react` / `react-dom` (peer) | `19.x` | **HIGH** |

**Rationale:** This is the only way to build a custom React renderer. Ink currently pins `react-reconciler@0.29.2` with React 18. Since we're starting fresh, target **React 19 + reconciler 0.32.0** — the breaking change (`flushSync` → `flushSyncFromReconciler` / `updateContainerSync` + `flushSyncWork`) is already documented and resolved. Forking from Ink's reconciler means adapting ~1 file of host config methods (`createInstance`, `appendChild`, `commitUpdate`, etc.).

**What NOT to use:**
- `react-test-renderer` — deprecated in React 19; build a lightweight test renderer from `react-reconciler` if needed for testing.
- Reconciler 0.29.x / React 18 — no reason to start on an older API when 0.32.0 is stable.

### Yoga Layout

| Choice | Version | Confidence |
|--------|---------|------------|
| `yoga-layout` | `3.2.1` | **HIGH** |

**Rationale:** The official Facebook package, actively maintained, ships prebuilt WASM bindings. Yoga 3.x adds `display: contents`, `box-sizing`, percentage `gap`, and removes legacy absolute positioning quirks. The API is ESM-only with top-level `await` (or use `yoga-layout/load` for compatibility). Ink migrated from `yoga-layout-prebuilt` → `yoga-wasm-web` → and the ecosystem has now consolidated on `yoga-layout` 3.x as the canonical package.

**What NOT to use:**
- `yoga-wasm-web@0.3.3` — unmaintained (last publish: 3 years ago). Ink used this as a stopgap; `yoga-layout` 3.x supersedes it.
- `yoga-layout-prebuilt` — dead since 2020.
- `yoga-layout@2.x` — missing flexbox features that 3.x provides, no longer receiving updates.

**Caveat:** Manual memory management required (`node.freeRecursive()`, `config.free()`). The reconciler teardown must handle this to avoid WASM memory leaks.

### Bundling / Build Tools

| Choice | Version | Confidence |
|--------|---------|------------|
| `tsup` | `8.5.x` | **MEDIUM** |
| `typescript` | `5.7.x` (tsc --noEmit) | **HIGH** |

**Rationale:** tsup (esbuild-based) is the standard for npm library bundling in 2026 — zero-config, generates CJS + ESM + `.d.ts` declarations, ~1.2s builds. Pair with `tsc --noEmit` for type checking since esbuild skips type validation. tsup's maintainers have flagged `tsdown` as a future successor, but tsdown is not yet mature enough (LOW confidence) for production use.

**What NOT to use:**
- `tsc` alone for bundling — too slow, no tree-shaking, no dual CJS/ESM output.
- `rollup` directly — unnecessary complexity for a library; tsup wraps esbuild which is faster.
- `webpack` — wrong tool for library bundling; designed for applications.
- `unbuild` — good tool but niche (UnJS ecosystem); tsup has 8x the adoption.

---

## 2. Rust Side

### Terminal Rendering

| Choice | Version | Confidence |
|--------|---------|------------|
| `crossterm` | `0.29.0` | **HIGH** |

**Rationale:** Cross-platform (Windows + Unix), pure Rust, 102M+ total downloads, 4,071 reverse dependencies. The de facto standard for terminal I/O in Rust. Provides cursor control, styled output, terminal manipulation, and event handling. Ratatui (the dominant Rust TUI framework) uses crossterm as its default backend — this validates crossterm as the correct low-level layer.

**What NOT to use:**
- `termion` — Unix-only, limited maintenance, uses threads for resize/input events. Disqualified by the Windows requirement.
- `termwiz` — WezTerm-specific, smaller ecosystem. Only consider if targeting WezTerm features (sixel, hyperlinks) which are out of scope.
- `ratatui` — this is an immediate-mode TUI *framework* with its own widget system and layout engine. Since tui-engine already has Yoga for layout and React for the component model, ratatui's abstractions would conflict. Use crossterm directly.

### Async Runtime

| Choice | Version | Confidence |
|--------|---------|------------|
| `tokio` | `1.50.0` | **HIGH** |

**Rationale:** Industry-standard async runtime for Rust. Needed for async stdin reading, timer-based render throttling, and potentially async IPC. MSRV is Rust 1.70. Use `features = ["full"]` during development, then trim to `["rt", "io-util", "io-std", "time", "macros"]` for the final build.

**What NOT to use:**
- `async-std` — declining ecosystem share, fewer integrations.
- `smol` — lightweight but insufficient ecosystem support for crossterm's async features.
- No async runtime at all — stdin event reading and render scheduling benefit significantly from async; synchronous polling creates unnecessary complexity.

### Serialization

| Choice | Version | Confidence |
|--------|---------|------------|
| `serde` | `1.0.228` | **HIGH** |
| `serde_json` | `1.0.149` | **HIGH** |

**Rationale:** Universal standard for Rust serialization. Zero debate here — 818M+ total downloads. The JSON widget protocol between JS and Rust will use `serde_json` for deserialization on the Rust side. Define Rust structs with `#[derive(Deserialize)]` that mirror the JSON protocol.

**What NOT to use:**
- `simd-json` — faster parsing but unsafe, nightly-only features, unnecessary complexity for this message volume.
- `nanoserde` — minimal but loses serde's ecosystem (derive macros, error handling, custom deserializers).
- MessagePack / CBOR / other binary formats — JSON is human-debuggable, and the message volume (one frame per render) doesn't justify binary encoding overhead in DX cost.

---

## 3. Bridge: JS ↔ Rust Communication

### Recommended: Dual Strategy

| Approach | Use Case | Confidence |
|----------|----------|------------|
| **napi-rs** (native binding) | Primary bridge — direct function calls | **HIGH** |
| **stdin/stdout JSON** | Fallback / debug mode | **MEDIUM** |

### Primary: napi-rs Native Binding

| Choice | Version | Confidence |
|--------|---------|------------|
| `@napi-rs/cli` | `3.5.x` (v3) | **HIGH** |
| `napi` (Rust crate) | `3.x` | **HIGH** |
| `napi-derive` (Rust crate) | `3.x` | **HIGH** |

**Rationale:** napi-rs v3 (released July 2025) provides direct Rust ↔ Node.js function calls via Node-API with near-zero overhead (~86M noop ops/sec, ~22M ops/sec for data passing). This eliminates the serialization/deserialization cost of stdin/stdout and removes the child process management complexity. napi-rs v3 also adds WASM compilation support as a fallback target.

The Rust renderer compiles as a native Node.js addon (`.node` file). The JS side calls `renderFrame(jsonString)` directly — no subprocess spawning, no pipe management, no buffering issues.

**Architecture:**
```
React components → reconciler → Yoga layout → JSON string → napi-rs → Rust renderer → terminal
```

### Fallback: stdin/stdout JSON Pipe

Keep a standalone Rust binary mode (`cargo install tui-engine-renderer`) that reads JSON from stdin and writes to stdout. This serves three purposes:
1. **Debugging** — pipe JSON manually to the renderer for inspection
2. **cargo distribution** — Rust users can use the renderer without Node.js
3. **Fallback** — if napi-rs binary isn't available for a platform, spawn the Rust binary as a child process

**What NOT to use:**
- Unix domain sockets / TCP IPC — unnecessary complexity; napi-rs eliminates the need for IPC entirely.
- `wasm-bindgen` / `wasm-pack` — compiling the renderer to WASM loses access to crossterm's terminal I/O (WASM has no terminal access). The renderer *must* run as native code.
- gRPC / Protocol Buffers — extreme overkill for single-process communication.

---

## 4. Distribution

### npm Distribution (Primary)

| Choice | Detail | Confidence |
|--------|--------|------------|
| napi-rs platform packages | Separate npm package per platform | **HIGH** |
| `@napi-rs/cli` scaffolding | Generates package.json with `optionalDependencies` | **HIGH** |

**Architecture:**
```
tui-engine                          ← main package (JS code + type declarations)
├── @tui-engine/linux-x64-gnu       ← prebuilt .node binary
├── @tui-engine/linux-x64-musl
├── @tui-engine/linux-arm64-gnu
├── @tui-engine/darwin-x64
├── @tui-engine/darwin-arm64
├── @tui-engine/win32-x64-msvc
└── @tui-engine/win32-arm64-msvc
```

npm/yarn/pnpm automatically resolves the correct platform package via `os` and `cpu` fields in each sub-package's `package.json`. No postinstall scripts, no CDN downloads, no network dependencies at install time.

**CI/CD pipeline (GitHub Actions):**
- Use `napi-rs/package-template` as the starting CI workflow
- Matrix build across 7+ platform targets
- `cargo-zigbuild` for Linux musl cross-compilation
- `cargo-xwin` for Windows cross-compilation from Linux runners
- Publish all platform packages + main package on npm in a single release

**Target platforms (minimum viable):**

| Target | Triple | Runner |
|--------|--------|--------|
| Linux x64 (glibc) | `x86_64-unknown-linux-gnu` | `ubuntu-latest` |
| Linux x64 (musl) | `x86_64-unknown-linux-musl` | `ubuntu-latest` + zigbuild |
| Linux arm64 (glibc) | `aarch64-unknown-linux-gnu` | `ubuntu-latest` + cross |
| macOS x64 | `x86_64-apple-darwin` | `macos-13` |
| macOS arm64 | `aarch64-apple-darwin` | `macos-14` (M1) |
| Windows x64 | `x86_64-pc-windows-msvc` | `windows-latest` |
| Windows arm64 | `aarch64-pc-windows-msvc` | `windows-latest` + cross |

### cargo Distribution (Secondary)

| Choice | Detail | Confidence |
|--------|--------|------------|
| Publish `tui-engine-renderer` crate | Standalone binary + library | **HIGH** |

The Rust renderer is published to crates.io as a standalone crate. This enables:
- `cargo install tui-engine-renderer` for the standalone binary
- `cargo add tui-engine-renderer` as a library dependency for Rust projects

**What NOT to use:**
- `prebuild` / `node-pre-gyp` — legacy Node.js native addon distribution tools; napi-rs's platform package approach is strictly superior (no postinstall, no CDN dependency).
- Single fat npm package with all binaries — bloats install size; per-platform packages are the standard.
- WASM-only distribution — loses terminal I/O capability; native binaries are required.

---

## 5. Testing

### JS Testing

| Choice | Version | Confidence |
|--------|---------|------------|
| `vitest` | `3.x` | **HIGH** |

**Rationale:** Default test runner for modern TypeScript in 2026. Native ESM support (critical since `yoga-layout` 3.x is ESM-only), esbuild-powered TypeScript handling, ~1.5s cold start for 500 tests. API-compatible with Jest so existing patterns transfer. Used by Nuxt, SvelteKit, Astro, Angular.

**What NOT to use:**
- `jest` — CommonJS-first architecture creates friction with ESM-only dependencies like `yoga-layout`. Requires experimental flags and transform configuration.
- `ava` — Ink uses this but it has a smaller ecosystem and fewer integrations.

### Test Strategy by Layer

**Layer 1: Reconciler Output (Unit)**
Build a minimal test renderer from `react-reconciler` that outputs a plain object tree (no terminal rendering). Assert that React component trees produce the expected node structure.

```typescript
const tree = renderToTree(<Box flexDirection="row"><Text>hello</Text></Box>);
expect(tree).toMatchSnapshot();
```

Confidence: **HIGH** — this pattern is documented and used by React core team.

**Layer 2: Yoga Layout Calculations (Unit)**
Test that Yoga nodes receive correct props and compute expected `x/y/width/height`. Use `yoga-layout` directly in tests — create nodes, set props, call `calculateLayout()`, assert computed values.

```typescript
const root = Yoga.Node.create();
root.setWidth(80);
root.setFlexDirection(FlexDirection.Row);
// ... add children ...
root.calculateLayout(80, 24, Direction.LTR);
expect(root.getChild(0).getComputedLeft()).toBe(0);
expect(root.getChild(0).getComputedWidth()).toBe(40);
```

Confidence: **HIGH** — pure computation, deterministic, fast.

**Layer 3: JSON Protocol (Integration)**
Render a React component tree through the full JS pipeline (reconciler → Yoga → JSON serialization) and snapshot the resulting JSON. This validates the contract between JS and Rust.

```typescript
const json = renderToJSON(<Box width={80}><Text>hello</Text></Box>);
expect(json).toMatchSnapshot();
```

Confidence: **HIGH** — snapshot testing is well-suited for protocol stability.

**Layer 4: Rust Renderer (Unit)**
Use crossterm's `MockTerminal` / buffer-based backend to capture rendered output without a real terminal. Deserialize test JSON fixtures, render to buffer, assert output strings.

```rust
#[test]
fn renders_text_at_position() {
    let frame: Frame = serde_json::from_str(include_str!("fixtures/simple.json")).unwrap();
    let mut buf = Vec::new();
    render_frame(&frame, &mut buf).unwrap();
    let output = String::from_utf8(buf).unwrap();
    assert!(output.contains("hello"));
}
```

Confidence: **HIGH** — standard Rust testing pattern.

**Layer 5: End-to-End (Integration)**
Spawn the full pipeline, render a known component, capture terminal output via a pseudo-terminal (pty). Compare against golden files. Use `node-pty` or similar for pty allocation in CI.

Confidence: **MEDIUM** — pty-based testing is fragile across platforms; use sparingly for smoke tests.

### Rust Testing

| Choice | Version | Confidence |
|--------|---------|------------|
| Built-in `cargo test` | Rust stable | **HIGH** |
| `insta` (snapshot testing) | Latest | **MEDIUM** |

`insta` provides snapshot testing for Rust, useful for golden-file comparisons of rendered terminal output. Pairs well with `serde_json` fixtures.

---

## Summary: Full Stack at a Glance

| Layer | Technology | Version | Confidence |
|-------|-----------|---------|------------|
| React reconciler | `react-reconciler` | 0.32.0 | HIGH |
| React | `react` | 19.x | HIGH |
| Layout engine | `yoga-layout` | 3.2.1 | HIGH |
| JS bundler | `tsup` | 8.5.x | MEDIUM |
| Type checking | `typescript` | 5.7.x | HIGH |
| JS test runner | `vitest` | 3.x | HIGH |
| Terminal backend | `crossterm` | 0.29.0 | HIGH |
| Async runtime | `tokio` | 1.50.0 | HIGH |
| Serialization | `serde` + `serde_json` | 1.0.228 / 1.0.149 | HIGH |
| JS ↔ Rust bridge | `napi-rs` | v3 (3.5.x CLI) | HIGH |
| npm distribution | napi-rs platform packages | — | HIGH |
| cargo distribution | standalone crate | — | HIGH |
| Rust snapshots | `insta` | latest | MEDIUM |

---

*Researched: 2026-03-11*

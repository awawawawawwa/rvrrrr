# TUI-Engine Pitfalls Research

Common pitfalls when building a JS→Rust TUI rendering engine that replaces Ink's rendering backend while preserving its React reconciler and Yoga layout.

---

## 1. Forking Ink

### 1a. Dependency Tangle with `yoga-wasm-web`

Ink switched from `yoga-layout-prebuilt` (asm.js) to `yoga-wasm-web` (WebAssembly) in v4.x. The WASM version uses **top-level await**, which makes it incompatible with CommonJS bundling (`ERR_REQUIRE_ASYNC_MODULE`). Bundlers like `@vercel/ncc`, Rollup, and Webpack 5 all struggle with this.

- **Warning signs:** Build errors mentioning TLA or async module require; consumers using `require()` get cryptic failures.
- **Prevention:** Strip the Yoga WASM dependency entirely during the fork — layout computation moves to Rust (via `taffy` or Yoga's C API). If Yoga JS is kept temporarily, pin the exact version and gate it behind dynamic `import()` with a sync fallback.
- **Phase:** Phase 1 (fork extraction). Decide Yoga's location (JS vs Rust) before writing any bridge code.

### 1b. ESM-Only Distribution Lock-In

Ink v4+ is pure ESM. Forking it locks you into ESM unless you actively convert. Many CLI tools and test runners still expect CJS interop.

- **Warning signs:** Consumers report `ERR_REQUIRE_ESM`; Jest/Vitest config headaches; `ts-node` failures.
- **Prevention:** Publish dual CJS/ESM using `tsup` or `unbuild`. Keep `"type": "module"` in the source but emit both formats. Test the CJS artifact explicitly in CI.
- **Phase:** Phase 1 (fork extraction) and Phase 6 (npm distribution).

### 1c. Version Drift from Upstream Ink

Ink continues to evolve (React 19 migration, new components). Forking creates a snapshot that diverges immediately.

- **Warning signs:** Users file issues that were already fixed upstream; PRs reference Ink internals that no longer match your fork.
- **Prevention:** Maintain a `FORK_DIVERGENCE.md` documenting every intentional change from upstream. Use `git format-patch` to track upstream commits that might be worth cherry-picking. Automate a weekly diff against `vadimdemedes/ink` main.
- **Phase:** Ongoing from Phase 1 onward. Establish the tracking mechanism before the first divergent commit.

### 1d. Hidden Internal Coupling

Ink's reconciler, output module, and components share internal state through module-scoped variables and cross-references (e.g., the throttled `onRender` callback, `stdout`/`stderr` stream references, the `instances` WeakMap).

- **Warning signs:** Extracting the reconciler causes undefined references; tests pass in isolation but fail when composed.
- **Prevention:** Trace all module-level side effects before extracting. Draw the dependency graph with `madge` or `dependency-cruiser`. Replace shared mutable state with explicit injection (constructor/factory parameters).
- **Phase:** Phase 1 (fork extraction). This is the first thing to audit.

---

## 2. React Reconciler

### 2a. Host Config Method Misimplementation

The reconciler host config has ~40 methods. Several are subtly required but rarely documented: `shouldSetTextContent`, `resetTextContent`, `finalizeInitialChildren`, `prepareForCommit`, `resetAfterCommit`. Getting even one wrong causes silent rendering corruption rather than errors.

- **Warning signs:** Components render once but fail to update; children appear in wrong order; text nodes disappear after re-render.
- **Prevention:** Start from Ink's working host config and change one method at a time. Build a visual regression test suite that renders known layouts and diffs ANSI output. Log every host config call during reconciliation to verify the call sequence matches expectations.
- **Phase:** Phase 2 (reconciler integration). Must be stable before any bridge work.

### 2b. Update Batching Across the Bridge

React 18+ batches all updates automatically — including those in `setTimeout`, Promises, and `startTransition`. When the reconciler flushes a batch, it must send a single coherent update to Rust, not N individual mutations.

- **Warning signs:** Flickering on rapid state changes; Rust renderer receives partial trees; multiple redundant IPC messages per frame.
- **Prevention:** Collect mutations during the commit phase (`prepareForCommit` → `resetAfterCommit`) and send a single serialized diff to Rust at `resetAfterCommit`. Never send mutations from `appendChild`/`removeChild` individually — buffer them.
- **Phase:** Phase 3 (bridge protocol). Design the batching strategy as part of the IPC protocol, not as an afterthought.

### 2c. React 19 `ReactSharedInternals` Breakage

React 19 restructured internal exports. Custom reconcilers that import from `react-reconciler` may hit `ReactSharedInternals is undefined` or `ReactCurrentOwner` errors if the reconciler version doesn't match the React version.

- **Warning signs:** Upgrading React peer dependency causes immediate crash on `render()`.
- **Prevention:** Pin `react-reconciler` to a version tested against your supported React range. Test against both React 18 and 19 in CI. If supporting React 19, use the `createRoot` pattern instead of the legacy `updateContainer` flow.
- **Phase:** Phase 2 (reconciler). Lock this down before public beta.

### 2d. Stale Closures in Async Contexts

With automatic batching, closures captured in `useEffect` or event handlers reference stale state longer than in React 17. This is especially dangerous in TUI apps where stdin events trigger state updates asynchronously.

- **Warning signs:** Key handlers report stale counts; rapid input causes state to "rewind."
- **Prevention:** Use functional updaters (`setState(prev => ...)`) in all input-handling code. Document this clearly in API docs — Ink users may not be aware of the behavior change if they're upgrading from Ink v3 (React 17).
- **Phase:** Phase 2 (reconciler) and Phase 7 (API compatibility documentation).

---

## 3. Yoga Layout

### 3a. Text Measurement Function Mismatch

Yoga delegates text measurement to a callback. The callback must return correct `{width, height}` for a given `maxWidth` constraint. In a terminal context, "width" means columns (character cells), not pixels. If the measurement function counts bytes instead of display columns, CJK characters, emoji, and ANSI escape codes break layout.

- **Warning signs:** Layouts break with non-ASCII text; boxes overflow their containers with styled text; CJK text wraps mid-character.
- **Prevention:** Use a Unicode-aware width function (`unicode-width` in Rust, `string-width` in JS) that strips ANSI escapes before measuring. Test with strings containing: ASCII, CJK, emoji (including ZWJ sequences), ANSI-styled text, and mixed-width content.
- **Phase:** Phase 3 (layout bridge). The measurement callback is the single most critical function in the layout pipeline.

### 3b. `flexGrow` + Padding Text Wrapping Bug

Yoga has a known issue where text wrapping breaks when combined with `paddingX` and `flexGrow={1}`. This was reported in Ink after the `yoga-wasm-web` upgrade and stems from Yoga incorrectly computing flex-basis using fit-content instead of max-content.

- **Warning signs:** Text that fits in Ink v3 suddenly wraps or truncates in your engine; adding 1 character to a string changes layout disproportionately.
- **Prevention:** If using Yoga's C API via Rust FFI: pin the exact Yoga version and maintain a patch set for known bugs. If replacing Yoga with `taffy`: verify `taffy`'s text measurement contract matches Yoga's semantics. Build a layout snapshot test suite that covers flex + padding + text combinations.
- **Phase:** Phase 3 (layout). Run the Ink layout test suite against your engine to catch regressions.

### 3c. Separate Yoga Nodes per Text Fragment

Ink originally created individual Yoga nodes for each text segment, making it impossible for text to flow/wrap across styled segments. This was fixed by requiring all text to be wrapped in `<Text>` components that handle measurement as a single unit.

- **Warning signs:** `<Text><Text bold>Hello</Text> world</Text>` wraps between "Hello" and "world" instead of treating them as a single flow.
- **Prevention:** Preserve Ink's `<Text>` architecture: the `<Text>` component flattens its children into a single measured string. Perform text measurement on the concatenated/flattened string, then split it back into styled segments for rendering.
- **Phase:** Phase 2 (reconciler) and Phase 3 (layout). The text flattening logic lives in the reconciler; the measurement lives in layout.

### 3d. Yoga API Version Mismatch

Yoga's C API has changed significantly between versions (v1 vs v2). Struct layouts, enum values, and function signatures differ. Binding to the wrong version causes memory corruption or silent miscalculation.

- **Warning signs:** Layout values are wildly wrong (negative sizes, enormous offsets); segfaults in release mode.
- **Prevention:** Use `yoga-sys` crate with a pinned version or vendor the Yoga C source. Validate basic layout computations (single box, nested boxes, flex row/column) against known-good Yoga output in a C test harness.
- **Phase:** Phase 3 (layout bridge). Validate before any integration with the reconciler.

---

## 4. JS–Rust Bridge

### 4a. JSON Serialization Becomes the Bottleneck

Sending the full widget tree as JSON on every frame is the naive approach. `serde_json` serialization of complex trees costs ~227µs per call. At 60fps, that's 13.6ms/frame just on serialization — eating 82% of the 16.6ms frame budget.

- **Warning signs:** Profiling shows >50% of frame time in `serde_json::to_string` or `JSON.stringify`; visible input lag on complex UIs.
- **Prevention:** Send diffs, not full trees. Design a mutation protocol: `{type: "insert", parent, index, node}`, `{type: "remove", ...}`, `{type: "update", id, props}`. Use MessagePack (`rmp-serde`) or a custom binary protocol instead of JSON. Benchmark with 100+ node trees early.
- **Phase:** Phase 3 (bridge protocol design). The wire format is an architectural decision — changing it later requires rewriting both sides.

### 4b. Child Process Lifecycle: Orphaned Rust Process

If the Node.js process crashes or is killed with SIGKILL, the spawned Rust binary continues running, holding the terminal in raw mode.

- **Warning signs:** Users report "stuck terminal" after Ctrl+C or crash; `ps aux | grep tui-engine` shows zombie Rust processes.
- **Prevention:** The Rust binary should detect stdin EOF (parent died) and exit immediately. Set a heartbeat: if no message arrives within 500ms, begin graceful shutdown. On the JS side, register `beforeExit`, `SIGINT`, `SIGTERM`, and `uncaughtException` handlers that send a shutdown command and call `child.kill()`. Use `prctl(PR_SET_PDEATHSIG)` on Linux to auto-kill on parent death.
- **Phase:** Phase 3 (bridge) and Phase 5 (terminal). This must be rock-solid before any user testing.

### 4c. Stdio Buffering Causes Frame Drops

`stdout`/`stdin` pipes between Node.js and Rust are buffered by the OS (typically 64KB on Linux). Small messages may be coalesced; large messages may be split across reads. Without framing, the Rust side can't tell where one message ends and another begins.

- **Warning signs:** Occasional `serde` parse errors; frames arrive late in bursts; works fine with small UIs but breaks on complex ones.
- **Prevention:** Implement length-prefix framing: write a 4-byte big-endian length header before each message. The reader accumulates bytes until it has `length` bytes, then parses. Alternatively, use newline-delimited JSON (NDJSON) if messages are guaranteed to not contain raw newlines.
- **Phase:** Phase 3 (bridge protocol). This is part of the wire format — must be designed upfront.

### 4d. Error Propagation Across the Boundary

A Rust panic or `Result::Err` must surface as a meaningful JavaScript error, not a silent crash or opaque exit code.

- **Warning signs:** Users see "process exited with code 101" with no context; Rust backtraces are swallowed; JS `try/catch` doesn't catch bridge errors.
- **Prevention:** Define an error message type in the protocol: `{type: "error", message, code, stack?}`. In Rust, set a panic hook that serializes the panic info and writes it to stdout before exiting. On the JS side, parse stderr and emit proper `Error` objects with the Rust context attached.
- **Phase:** Phase 3 (bridge protocol). Design error messages as a first-class protocol type.

### 4e. napi-rs vs Child Process: Architecture Decision Lock-In

Two fundamentally different bridge architectures exist: (a) napi-rs addon loaded in-process, (b) Rust binary as a child process communicating over stdio/IPC. Each has tradeoffs that are nearly impossible to switch later.

- **Warning signs:** Choosing napi-rs then discovering it can't own the terminal (stdin conflict with Node.js); choosing child process then hitting latency requirements that need shared memory.
- **Prevention:** For a TUI engine, child process is likely correct — the Rust side needs exclusive terminal access (raw mode, alternate screen). Design the bridge abstraction so the transport layer (stdio, unix socket, shared memory) can be swapped without changing the protocol. Benchmark both approaches with a 100-node tree at 60fps before committing.
- **Phase:** Phase 3 (bridge architecture). This is the single most consequential architectural decision.

---

## 5. Terminal Rendering

### 5a. ANSI Escape Codes Counted as Visible Characters

When computing cursor positions or string widths, ANSI escape sequences (`\x1b[38;2;255;0;0m`) add 15+ invisible bytes. If these are included in width calculations, text wraps at wrong columns and cursor positioning is incorrect.

- **Warning signs:** Styled text appears shifted right; lines break mid-word; increasing color use makes layout progressively worse.
- **Prevention:** Always strip ANSI sequences before measuring display width. In Rust, use `strip-ansi-escapes` + `unicode-width`. Build a `display_width(s: &str) -> usize` function and use it everywhere — never use `s.len()` or `s.chars().count()` for layout purposes.
- **Phase:** Phase 5 (terminal rendering). This function must exist before any rendering code.

### 5b. Emoji and Unicode Width Disagreements

Terminals disagree on emoji widths. The emoji `⏺` (U+23FA) is 1 column in some terminals, 2 in others. Variation selectors (U+FE0F, U+FE0E) are often ignored. ZWJ sequences (👨‍👩‍👧) have no consistent width across terminals.

- **Warning signs:** Layout looks correct in one terminal but misaligned in another; emoji-heavy UIs have ragged columns.
- **Prevention:** Use `unicode-width` crate (which implements UAX #11) as the canonical source of truth, then document which terminals are known to disagree. Provide a `TERM_EMOJI_WIDTH` env var escape hatch for users whose terminal disagrees. Test on at least: iTerm2, Terminal.app, Windows Terminal, Alacritty, kitty, WezTerm.
- **Phase:** Phase 5 (terminal rendering). Build the width table early and test across terminals continuously.

### 5c. Raw Mode Not Restored on Crash

If the Rust process panics or is killed while the terminal is in raw mode, the user's terminal is left in a broken state (no echo, no line editing, Ctrl+C doesn't work).

- **Warning signs:** Users complain their terminal is "broken" after a crash; they need to run `reset` or `stty sane` manually.
- **Prevention:** In Rust, save the original termios state on startup. Set a panic hook that restores it. Register signal handlers for SIGINT, SIGTERM, SIGQUIT, SIGHUP that restore before exiting. On Windows, use `SetConsoleMode` with stored original mode. Use `crossterm::terminal::disable_raw_mode()` which handles this internally — but verify it runs in signal/panic contexts.
- **Phase:** Phase 5 (terminal rendering). This is a P0 requirement — a broken terminal is the worst possible user experience.

### 5d. Alternate Screen Buffer Mismanagement

Entering alternate screen (`\x1b[?1049h`) and not leaving it (`\x1b[?1049l`) on exit leaves the user in a blank screen. Conversely, leaving it too early causes flicker as the main screen content flashes before the app exits.

- **Warning signs:** Users see a blank terminal after app exits; or a brief flash of scrollback content during shutdown.
- **Prevention:** Pair alternate screen enter/leave in the same cleanup path as raw mode restoration. Test the sequence: start → render → Ctrl+C → verify terminal is normal. Test with: normal exit, SIGINT, SIGTERM, panic, stdin EOF.
- **Phase:** Phase 5 (terminal rendering). Bundle with raw mode cleanup.

### 5e. Resize Race Condition

SIGWINCH arrives asynchronously. If a render is in progress when the terminal resizes, the in-flight frame uses stale dimensions, causing a single corrupted frame.

- **Warning signs:** Resizing the terminal causes a brief flash of incorrectly wrapped content.
- **Prevention:** On SIGWINCH, set a flag and re-query terminal size with `ioctl(TIOCGWINSZ)` or `crossterm::terminal::size()`. Discard the in-flight frame and re-layout with new dimensions. Debounce resize events (50ms) to avoid thrashing during drag-resize. On Windows, poll for resize events since SIGWINCH doesn't exist — crossterm handles this but introduces 1-poll-interval latency.
- **Phase:** Phase 5 (terminal rendering). Address after basic rendering works but before beta.

### 5f. Cursor Position and CSI Sequence Compatibility

Not all terminals support the same CSI (Control Sequence Introducer) sequences. `\x1b[?25l` (hide cursor) is nearly universal, but 256-color (`\x1b[38;5;Nm`), truecolor (`\x1b[38;2;R;G;Bm`), and hyperlinks (`\x1b]8;;URL\x1b\\`) have varying support.

- **Warning signs:** Colors look wrong on older terminals; hyperlinks render as garbage text; tests pass on developer machines but fail in CI (which typically uses `dumb` or `xterm`).
- **Prevention:** Detect terminal capabilities via `TERM`, `COLORTERM`, and `TERM_PROGRAM` env vars. Fall back gracefully: truecolor → 256-color → 16-color → no color. Use `supports-color` (JS) or `supports-color` crate (Rust) for detection. Never hard-code truecolor sequences.
- **Phase:** Phase 5 (terminal rendering). Build capability detection before color rendering.

---

## 6. npm Distribution

### 6a. Platform Package Architecture Mismatch

The esbuild/napi-rs pattern uses `optionalDependencies` with per-platform npm packages (e.g., `@tui-engine/win32-x64`, `@tui-engine/linux-arm64`). If any platform package is missing from the registry, `npm install` fails on that platform with no fallback.

- **Warning signs:** Users on less common platforms (Linux ARM, Alpine/musl, FreeBSD) report install failures; CI on a new architecture fails silently.
- **Prevention:** Enumerate all target triples in CI and fail the release if any platform build fails. Start with the minimum viable set: `linux-x64-gnu`, `linux-x64-musl`, `linux-arm64-gnu`, `darwin-x64`, `darwin-arm64`, `win32-x64-msvc`. Add `linux-arm64-musl` (Alpine ARM) and `win32-arm64` based on user demand. Publish all platform packages atomically.
- **Phase:** Phase 6 (npm distribution). Define the target matrix before the first publish.

### 6b. Binary Size Bloat

A naive Rust release build with `crossterm`, `serde`, `unicode-width`, and a layout engine can easily exceed 10MB. npm packages over 5MB trigger warnings and slow installs.

- **Warning signs:** `npm pack --dry-run` shows >5MB; users complain about slow installs on CI; npm audit flags the package size.
- **Prevention:** Use `strip = true`, `lto = "thin"`, `codegen-units = 1`, `opt-level = "z"` in `Cargo.toml` `[profile.release]`. Run `cargo bloat` to find the largest contributors. Consider UPX compression for the binary (test that it doesn't trigger antivirus on Windows). Target: <3MB per platform binary.
- **Phase:** Phase 6 (npm distribution). Profile binary size after the first working build.

### 6c. Postinstall Script Failures

Postinstall scripts are disabled by default in many lockfile-based workflows and are skipped entirely by `npm ci --ignore-scripts`. If the binary download depends on a postinstall hook, installs fail silently.

- **Warning signs:** Users report "binary not found" errors at runtime despite successful `npm install`; works locally but fails in CI.
- **Prevention:** Use the `optionalDependencies` pattern (esbuild/napi-rs model) as the primary mechanism — no postinstall needed. Add a postinstall only as a **fallback** that downloads the binary if the optionalDependency wasn't installed. At runtime, check for the binary and emit a clear error message with remediation steps if it's missing.
- **Phase:** Phase 6 (npm distribution). Test with `--ignore-scripts` explicitly in CI.

### 6d. Cross-Compilation Toolchain Failures

Cross-compiling Rust for `linux-arm64` from an `x86_64` CI runner requires a cross-compilation toolchain. Missing linkers, wrong sysroot, or OpenSSL cross-compile failures are common.

- **Warning signs:** CI matrix has intermittent "linker not found" failures; ARM builds produce x86 binaries silently.
- **Prevention:** Use `cross` (Docker-based) or `cargo-zigbuild` for Linux cross-compilation. Pin the `cross` Docker image version. Validate each binary's architecture in CI with `file <binary>`. Use GitHub Actions matrix with `runs-on` for macOS and Windows native builds (don't cross-compile these).
- **Phase:** Phase 6 (npm distribution). Set up the full CI matrix before the first alpha release.

### 6e. npm `os`/`cpu` Field Mismatch

The `os` and `cpu` fields in platform package `package.json` must exactly match Node.js `process.platform` and `process.arch`. A typo (`darwin` vs `macos`, `x64` vs `amd64`) causes the package to be skipped on the target platform.

- **Warning signs:** `npm install` succeeds but the platform package isn't in `node_modules`; works on macOS but not Linux.
- **Prevention:** Generate platform package.json files programmatically from a list of `{os, cpu, rustTarget}` tuples. Validate in CI by checking that `require.resolve('@tui-engine/<platform>')` succeeds on each target.
- **Phase:** Phase 6 (npm distribution). Automate this — never hand-edit platform package.json.

---

## 7. API Compatibility

### 7a. Subtle Flex Default Differences

Ink's `<Box>` defaults differ from CSS flexbox: `flexDirection` defaults to `column` (not `row`), `flexShrink` defaults to `1`, and there's no `display: block`. If your engine uses different defaults (e.g., because `taffy` uses CSS defaults), existing Ink apps break silently with wrong layouts.

- **Warning signs:** Ported Ink apps have horizontal layouts where vertical is expected; boxes don't shrink as expected.
- **Prevention:** Document every Ink default explicitly. If using `taffy`, configure its defaults to match Yoga/Ink, not CSS. Build a compatibility test suite that renders Ink's own example apps and diffs the output character-by-character.
- **Phase:** Phase 7 (API compatibility). Run Ink's test suite against your engine.

### 7b. `measureElement` Ref Timing

Ink's `measureElement` hook uses refs to measure a component's computed layout after Yoga computation. If your engine computes layout in Rust, the measurement result isn't available synchronously in JS after render — it requires a round-trip to Rust.

- **Warning signs:** `measureElement` returns `{width: 0, height: 0}`; components that depend on measurement (e.g., dynamic truncation) render incorrectly.
- **Prevention:** Either: (a) keep a shadow Yoga tree in JS for measurement (increases memory), or (b) make `measureElement` async and provide the result via a callback/effect (breaks API compatibility), or (c) send computed layout back to JS as part of the render acknowledgment message. Option (c) preserves compatibility if the ack arrives before the next microtask.
- **Phase:** Phase 4 (bridge integration) and Phase 7 (API compatibility). Design the measurement flow as part of the bridge protocol.

### 7c. `useInput` Key Parsing Differences

Ink's `useInput` normalizes raw terminal input into `{input, key}` objects. It handles escape sequences, arrow keys, and modifier detection. If the Rust side consumes stdin for rendering, the JS side can't read it — breaking `useInput`.

- **Warning signs:** `useInput` handler never fires; or fires with raw escape bytes instead of parsed keys.
- **Prevention:** Decide who owns stdin: if Rust owns the terminal, Rust must parse input events and forward them to JS as structured messages. Reimplement `useInput`'s key parsing in Rust (or use crossterm's `event::read()`) and serialize key events back to JS. Test with: arrow keys, Ctrl+C, Ctrl+D, Tab, Shift+Tab, Escape, function keys, Unicode input, paste events.
- **Phase:** Phase 4 (bridge integration). Stdin ownership is coupled to the bridge architecture decision (pitfall 4e).

### 7d. `render()` Return Value and Lifecycle

Ink's `render()` returns `{rerender, unmount, cleanup, clear, waitUntilExit}`. A race condition was discovered in Ink v5.1.0 where calling `rerender` then `unmount` quickly caused renders after unmount due to throttle function behavior differences (es-toolkit vs lodash).

- **Warning signs:** Errors about rendering after unmount; intermittent crashes in test suites that call `unmount()` in cleanup.
- **Prevention:** Implement a state machine for the render lifecycle: `idle → rendering → mounted → unmounting → unmounted`. Reject any operation that doesn't match the current state. Specifically: `rerender` must no-op after `unmount` is called, even if a throttled render is pending. Test the sequence `render → rerender → unmount` with 0ms delay.
- **Phase:** Phase 7 (API compatibility). This is a known Ink regression to avoid repeating.

### 7e. `<Text>` Wrapping, Truncation, and Styling Props

Ink's `<Text>` supports `wrap="truncate"|"truncate-start"|"truncate-middle"|"truncate-end"|"wrap"`, plus `bold`, `italic`, `underline`, `strikethrough`, `color`, `backgroundColor`, `dimColor`, `inverse`. Each combination interacts with layout measurement. For example, truncation must happen **after** layout (to know the available width) but **before** rendering (to emit the right characters).

- **Warning signs:** Truncated text includes ANSI escape codes in the visible portion, mangling the output; bold text is wider than expected (some terminals use wider glyphs for bold).
- **Prevention:** Implement truncation in the Rust renderer, not in JS. Truncation must operate on display columns, not bytes or codepoints. Strip ANSI, truncate, then re-apply styles. Test with: `"Hello, 世界!"` truncated to 8 columns (should show `"Hello, 世…"`, not `"Hello, 世界"` or `"Hello, 世"`).
- **Phase:** Phase 5 (rendering) and Phase 7 (API compatibility).

### 7f. Color Format Compatibility

Ink v4 removed support for `hsl`, `hsv`, `hwb`, and `ansi` color formats in `<Text color>`. If your engine claims Ink v3 compatibility, users expect these formats to work. If you claim Ink v4 compatibility, users may still pass them from old code.

- **Warning signs:** Colors render as default/white when they shouldn't; no error message for unsupported formats.
- **Prevention:** Decide which Ink version you're compatible with and document it. For unsupported color formats, emit a development-mode warning (not a crash). Support at minimum: hex (`#ff0000`), RGB (`rgb(255,0,0)`), named colors (`red`), and ANSI 256 (`ansi256(196)`).
- **Phase:** Phase 7 (API compatibility). Define the compatibility target before implementing color support.

---

## Cross-Cutting Concerns

### Testing Strategy

Many of these pitfalls share a common mitigation: **snapshot testing of rendered ANSI output**. Build a test harness that:
1. Renders a component tree to a virtual terminal buffer (fixed width/height).
2. Captures the exact ANSI output.
3. Compares against a stored snapshot (using a diff that understands ANSI codes).
4. Runs on all CI platforms (Linux, macOS, Windows).

### Phasing Summary

| Phase | Key Pitfalls to Address |
|-------|------------------------|
| **1. Fork Extraction** | 1a (Yoga dep), 1b (ESM), 1c (drift tracking), 1d (coupling) |
| **2. Reconciler** | 2a (host config), 2c (React 19), 2d (stale closures), 3c (text nodes) |
| **3. Bridge Protocol** | 4a (serialization), 4b (lifecycle), 4c (framing), 4d (errors), 4e (architecture) |
| **4. Bridge Integration** | 2b (batching), 7b (measureElement), 7c (useInput/stdin) |
| **5. Terminal Rendering** | 5a (ANSI width), 5b (emoji), 5c (raw mode), 5d (alt screen), 5e (resize), 5f (capabilities), 3a (text measurement) |
| **6. npm Distribution** | 6a (platforms), 6b (binary size), 6c (postinstall), 6d (cross-compile), 6e (os/cpu fields), 1b (CJS/ESM) |
| **7. API Compatibility** | 7a (flex defaults), 7d (lifecycle), 7e (truncation), 7f (colors), 3b (flex+padding) |

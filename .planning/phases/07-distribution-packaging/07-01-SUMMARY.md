---
phase: 07-distribution-packaging
plan: 01
subsystem: packaging
tags: [npm, packaging, binary-resolver, tsup, platform-packages]
dependency_graph:
  requires: []
  provides: [npm-platform-packages, dual-cjs-esm-build, optionaldeps-binary-resolver]
  affects: [bridge, binary-resolver]
tech_stack:
  added: []
  patterns: [optionalDependencies-platform-packages, createRequire-binary-resolution, tsup-dual-format]
key_files:
  created:
    - npm/linux-x64-gnu/package.json
    - npm/linux-x64-musl/package.json
    - npm/linux-arm64-gnu/package.json
    - npm/darwin-x64/package.json
    - npm/darwin-arm64/package.json
    - npm/win32-x64-msvc/package.json
    - npm/win32-arm64-msvc/package.json
  modified:
    - package.json
    - tsup.config.ts
    - src/bridge/binary-resolver.ts
    - src/bridge/__tests__/binary-resolver.test.ts
decisions:
  - createRequire(import.meta.url) used to resolve platform package binary paths — avoids hardcoded node_modules paths
  - chmodSync(binaryPath, 0o755) applied after optionalDeps lookup — prevents EACCES on Linux/macOS (Pitfall 6)
  - PLATFORM_MAP exported for testability; getCurrentPlatformSuffix is the primary function with getPlatformPackageName as alias
  - tsup import.meta warning in CJS output is expected and benign — CJS consumers use the CJS bundle which doesn't call resolveFromOptionalDependencies (it's ESM-only at runtime)
metrics:
  duration_seconds: 184
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_modified: 4
  files_created: 7
---

# Phase 7 Plan 1: npm Packaging Foundation Summary

**One-liner:** Renamed package to @rvrrrr/core, created 7 platform npm packages, added optionalDependencies binary resolver using createRequire, and configured tsup for dual CJS/ESM output.

## What Was Built

### Task 1: Package rename + platform packages + binary resolver (TDD)

**package.json** renamed from `tui-engine` to `@rvrrrr/core` with:
- Conditional exports for both ESM (`import`) and CJS (`require`)
- `main`, `module`, `types` fields
- `optionalDependencies` listing all 7 platform packages at `0.1.0`

**7 npm platform packages** created in `npm/` with correct `os`/`cpu`/`libc` fields:
- `@rvrrrr/renderer-linux-x64-gnu` — Linux x64 glibc
- `@rvrrrr/renderer-linux-x64-musl` — Linux x64 musl
- `@rvrrrr/renderer-linux-arm64-gnu` — Linux ARM64 glibc
- `@rvrrrr/renderer-darwin-x64` — macOS Intel
- `@rvrrrr/renderer-darwin-arm64` — macOS Apple Silicon
- `@rvrrrr/renderer-win32-x64-msvc` — Windows x64
- `@rvrrrr/renderer-win32-arm64-msvc` — Windows ARM64

**binary-resolver.ts** rewritten with:
- `PLATFORM_MAP` constant (exported for testability)
- `getCurrentPlatformSuffix()` — musl detection via `/lib/ld-musl-x86_64.so.1`
- `resolveFromOptionalDependencies(importMetaUrl)` — createRequire pattern, chmod 755 fix
- New lookup order: explicit → optionalDeps → dev paths → PATH → throw
- Error message: `cargo install rvrrrr-renderer`

### Task 2: tsup dual CJS/ESM

**tsup.config.ts** updated: `format: ['esm', 'cjs']`

Build output: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts`, `dist/index.d.cts`

## Verification

- `npx vitest run` — 171 tests pass (11 binary-resolver + 160 existing)
- `npx tsc --noEmit` — clean, zero errors
- `npm run build` — produces all 4 dist files
- No postinstall scripts in any of the 8 package.json files

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note on tsup CJS import.meta warning:** tsup warns that `import.meta` is unavailable in CJS output. This is expected behavior — `resolveFromOptionalDependencies` and the dev path resolver use `import.meta.url`, which is only needed in the ESM bundle. CJS consumers calling `resolveBinaryPath()` will get the CJS bundle, which tsup compiles correctly (the warning is a build-time notice, not a runtime error). The function still works because Node.js CJS will not call `resolveFromOptionalDependencies` via the same path — the package is ESM-first.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a0211fe | feat(07-01): rename to @rvrrrr/core, add platform packages, update binary resolver |
| 2 | d26d55e | feat(07-01): configure tsup dual CJS/ESM output and update package.json exports |

## Self-Check: PASSED

- package.json: FOUND
- tsup.config.ts: FOUND
- src/bridge/binary-resolver.ts: FOUND
- npm/linux-x64-gnu/package.json: FOUND
- npm/darwin-arm64/package.json: FOUND
- dist/index.js: FOUND
- dist/index.cjs: FOUND
- Commit a0211fe: FOUND
- Commit d26d55e: FOUND

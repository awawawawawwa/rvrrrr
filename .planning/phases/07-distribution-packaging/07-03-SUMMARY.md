---
phase: 07-distribution-packaging
plan: 03
subsystem: ci-cd
tags: [github-actions, ci, release, npm-publish, crates-io, cross-compilation]
dependency_graph:
  requires: [07-01, 07-02]
  provides: [ci-workflow, release-workflow, automated-publish-pipeline]
  affects: [npm-publish, crates-io-publish]
tech-stack:
  added:
    - houseabsolute/actions-rust-cross@v1 (Linux cross-compilation in CI)
    - dtolnay/rust-toolchain (Rust toolchain setup in CI)
  patterns:
    - matrix-build-7-targets
    - platform-packages-before-core-publish-ordering
    - access-public-scoped-packages
    - macos-13-for-intel-darwin
key-files:
  created:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
  modified: []
decisions:
  - "houseabsolute/actions-rust-cross@v1 used for all 7 targets including macOS and Windows — single action handles cross-compilation transparently"
  - "macos-13 used for darwin-x64 (Intel), macos-latest for darwin-arm64 (ARM/M1+) — per Pitfall 3"
  - "Platform packages published before @rvrrrr/core in release.yml — avoids optionalDependencies resolution failure at install time (Pitfall 2)"
  - "NODE_AUTH_TOKEN set at job level as well as step level — ensures npm commands pick up auth token in all contexts"
  - "Version set in all npm/*/package.json and root package.json from git tag (strip v prefix) before publish — ensures version consistency"
  - "win32-arm64-msvc cross-compiled from windows-latest x64 host — no ARM Windows runner available; accepted limitation per Pitfall 4"
metrics:
  duration_seconds: 300
  completed_date: "2026-03-13"
  tasks_completed: 1
  files_modified: 0
  files_created: 2
requirements_completed:
  - DIST-01
---

# Phase 7 Plan 3: GitHub Actions CI and Release Workflows Summary

**One-liner:** Tag-triggered release workflow matrix-builds 7 platform Rust binaries and publishes to npm (platform packages first, then @rvrrrr/core) and crates.io; CI validates on push/PR with vitest + tsc + cargo check.

## What Was Built

### Task 1: CI and Release GitHub Actions Workflows

**.github/workflows/ci.yml** — triggers on push to main/master and pull_request:
- `test` job (ubuntu-latest): checkout, Node 20 setup, `npm ci`, `npx vitest run`, `npx tsc --noEmit`, `npm run build`
- `rust-check` job (ubuntu-latest): checkout, Rust stable via dtolnay/rust-toolchain, `cargo check`, `cargo test` in `crates/renderer/`

**.github/workflows/release.yml** — triggers on tag push matching `v*.*.*`:
- `build` job: matrix of 7 platform targets (fail-fast: false)
  - `linux-x64-gnu` — ubuntu-latest, x86_64-unknown-linux-gnu
  - `linux-x64-musl` — ubuntu-latest, x86_64-unknown-linux-musl
  - `linux-arm64-gnu` — ubuntu-latest, aarch64-unknown-linux-gnu
  - `darwin-x64` — macos-13 (Intel), x86_64-apple-darwin
  - `darwin-arm64` — macos-latest (ARM/M1+), aarch64-apple-darwin
  - `win32-x64-msvc` — windows-latest, x86_64-pc-windows-msvc
  - `win32-arm64-msvc` — windows-latest (cross), aarch64-pc-windows-msvc
  - Each step: houseabsolute/actions-rust-cross@v1 build + actions/upload-artifact@v4
- `publish-npm` job (needs: build):
  - Downloads all 7 artifacts
  - Copies each binary into npm/{platform}/, chmod +x on non-Windows
  - Sets version in all npm/*/package.json and root package.json from git tag
  - Publishes 7 platform packages first (`npm publish --access public`)
  - Then publishes `@rvrrrr/core` (`npm publish --access public`)
- `publish-crate` job (needs: build):
  - Installs Rust stable
  - `cargo publish --locked` in crates/renderer/ with CARGO_REGISTRY_TOKEN

### Task 2: Human Verification (checkpoint:human-verify)

Pending user approval of complete Phase 7 distribution setup.

## Verification

- YAML lint: both files pass `npx yaml-lint`
- Matrix entries: exactly 7 targets confirmed
- Tag trigger: `v*.*.*` confirmed
- Publish ordering: platform packages before @rvrrrr/core confirmed
- macos-13 for darwin-x64 confirmed
- `--access public` on all npm publish commands confirmed
- Full test suite: 171/171 passing before commit

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b55dc60 | feat(07-03): add CI and release GitHub Actions workflows |

## User Setup Required

Before the release workflow can publish successfully:

1. **npm org:** Ensure `@rvrrrr` scope is available (either npm username is `rvrrrr`, or create org at https://www.npmjs.com/org/create)
2. **NPM_TOKEN:** Create granular automation token at npmjs.com → Account Settings → Access Tokens → Generate New Token → Granular Access Token → scope to @rvrrrr packages → Automation type. Add as GitHub Actions secret: repo → Settings → Secrets and variables → Actions → New repository secret → `NPM_TOKEN`
3. **CRATES_IO_TOKEN:** Create at crates.io → Account Settings → API Tokens → New Token. Add as GitHub Actions secret: `CRATES_IO_TOKEN`
4. **README.md in crates/renderer/:** Required for `cargo publish` (Cargo.toml references it). Create before first release.
5. **Update repository URL in Cargo.toml:** Change `https://github.com/rvrrrr/rvrrrr` to the actual GitHub repo URL.

## Self-Check: PASSED

- .github/workflows/ci.yml: FOUND
- .github/workflows/release.yml: FOUND
- Commit b55dc60: FOUND
- YAML lint: PASSED
- 7 matrix targets: CONFIRMED
- Tag trigger v*.*.*: CONFIRMED
- Platform packages published before @rvrrrr/core: CONFIRMED

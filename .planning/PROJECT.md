# tui-engine

## What This Is

A drop-in replacement for Ink that uses a Rust rendering backend for significantly faster terminal UI rendering. Developers write the same React components and Yoga-based layouts they already know from Ink, but rendering is handled by a compiled Rust binary — cutting hundreds of milliseconds off render benchmarks.

## Core Value

Ink-compatible DX with Rust-level rendering performance. If everything else fails, React components must go in, fast terminal output must come out.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Fork Ink's React reconciler into the project, functioning independently
- [ ] Fork Ink's Yoga layout integration, computing layout props correctly
- [ ] React component tree builds and resolves to Yoga nodes with accurate x/y/width/height
- [ ] Widget-based JSON protocol that preserves Yoga's layout topology
- [ ] Rust binary consumes JSON messages and renders to terminal
- [ ] npm distribution with prebuilt platform-specific Rust binaries
- [ ] cargo distribution as an alternative install path
- [ ] Drop-in API compatibility with Ink (Box, Text, render(), hooks)

### Out of Scope

- Cell-based rendering frame — throws away Yoga's layout work, widget-based chosen instead
- Custom component API — this is an Ink-compatible engine, not a new framework
- Mobile/web rendering targets — terminal only

## Context

- Ink is the battle-tested reference implementation — reconciler and Yoga integration are forked from Ink, not written from scratch
- Architecture follows a pipeline: React components → reconciler → Yoga layout → JSON protocol → Rust renderer → terminal output
- Build order is bottom-up: JS foundation (reconciler + Yoga) first, then JSON protocol, then Rust renderer
- The JSON message structure will be designed after the reconciler/Yoga layer is working, so the protocol reflects what Yoga actually produces rather than guessing upfront

## Constraints

- **API compatibility**: Must match Ink's public API surface — same components, same props, same hooks
- **Distribution**: npm package must work without Rust toolchain installed (prebuilt binaries per platform)
- **Architecture**: Widget-based frames only — JSON structure mirrors Yoga's node topology

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Widget-based over cell-based frames | Cell-based discards Yoga's layout calculations, duplicating work at a lower level | — Pending |
| Fork from Ink, not rewrite | Ink's reconciler and Yoga integration are battle-tested | — Pending |
| Bottom-up build order | Need to see actual Yoga output before designing JSON protocol | — Pending |
| Dual distribution (npm + cargo) | npm for JS developer UX, cargo for Rust ecosystem presence | — Pending |

---
*Last updated: 2026-03-11 after initialization*

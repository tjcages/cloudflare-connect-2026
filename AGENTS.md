# Project Instructions For AI Agents

## Monorepo Overview

This repo contains **two engines** during the GPU-first rewrite:

| Engine                              | Packages                                  | Status                             |
| ----------------------------------- | ----------------------------------------- | ---------------------------------- |
| **Live product** (Pixi/CPU)         | `apps/studio` + `packages/stripes-shader` | Ships today; do not break          |
| **Active build** (WebGL2/GPU-first) | `packages/stripes-engine` + `apps/lab`    | Phase 0 landed; active development |

For new-engine work, follow `docs/engine-architecture.md` and the rewrite spec at
`docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`. Do **not** follow
`docs/legacy/` — those docs describe the old Pixi/CPU engine.

## Package Manager

Use `pi` (install) and `pir` (run scripts). Never `npm`, `pnpm`, `yarn`, or `npx` directly.

## Verification

- Typecheck new engine: `pir --filter @necatikcl/stripes-engine typecheck`
- Unit tests: `pir test`
- E2E / visual goldens: `pir test:e2e`
- Live-product changes (`apps/studio` + `packages/stripes-shader`) are verified with `pir verify`.
- Docs/rules-only changes: verify frontmatter, links, paths, and stale references.
- Do not claim completion without fresh verification evidence.

## Safety

- Preserve user changes and avoid destructive git commands.
- Do not edit `.cursor/plans` unless explicitly requested.
- If repeated attempts fail, stop and explain observations plus options.

# Project Instructions For AI Agents

## Monorepo Overview

The GPU-first rewrite is complete and is now the **only** engine. The legacy Pixi/CPU
product (`apps/studio` + `packages/stripes-shader`) has been retired/deleted.

| Package                   | Role                                                                         |
| ------------------------- | ---------------------------------------------------------------------------- |
| `apps/lab`                | Authoring app + the live Cloudflare worker `section-grid-generator` (at `/`) |
| `packages/stripes-engine` | WebGL2 render core + `<StripesShader>` React canvas (`/react` subpath)       |

Follow `docs/engine-architecture.md` and `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`.
Do **not** follow `docs/legacy/` — those describe the retired Pixi/CPU engine.

## Package Manager

Use `pi` (install) and `pir` (run scripts). Never `npm`, `pnpm`, `yarn`, or `npx` directly.

## Verification

- Typecheck new engine: `pir --filter @necatikcl/stripes-engine typecheck`
- Unit tests: `pir test`
- E2E / visual goldens: `pir test:e2e`
- Full check (tests + typecheck + lab build): `pir verify`.
- Docs/rules-only changes: verify frontmatter, links, paths, and stale references.
- Do not claim completion without fresh verification evidence.

## Safety

- Preserve user changes and avoid destructive git commands.
- Do not edit `.cursor/plans` unless explicitly requested.
- If repeated attempts fail, stop and explain observations plus options.

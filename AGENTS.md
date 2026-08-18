# Project Instructions For AI Agents

## Monorepo Overview

The GPU-first rewrite is complete and is now the **only** engine. The legacy Pixi/CPU
product (`apps/studio` + `packages/stripes-shader`) has been retired/deleted.

| Package                     | Role                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| `apps/lab`                  | Authoring app + Cloudflare Worker `connect-shader`                     |
| `apps/site`                 | Connect 2026 refresh site + Cloudflare Worker `connect-2026-site`      |
| `packages/connect-twizzler` | Connect hero shader package used by the refresh site                   |
| `@tjcages/panels` (npm)     | Shared shader panel used by the refresh site (`/dev` entry)            |
| `packages/stripes-engine`   | WebGL2 render core + `<StripesShader>` React canvas (`/react` subpath) |

Follow `docs/engine-architecture.md` and `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`.
Do **not** follow `docs/legacy/` — those describe the retired Pixi/CPU engine.

## Deploy

This repository owns two Workers in account `944ca70087298faa2e84783db46162c5`:

- Shader tool: `connect-shader` from `apps/lab`
- Refresh site: `connect-2026-site` from `apps/site`

Use the matching app-level Wrangler config and root `deploy:shader` / `deploy:site`
script. Details: `docs/deploy.md`.

**PR handoff:** changes spanning both apps require both Cloudflare Workers branch
preview URLs. Never use trycloudflare tunnels or production URLs as substitutes.

## Package Manager

Use `pi` (install) and `pir` (run scripts). Never `npm`, `pnpm`, `yarn`, or `npx` directly.

## Verification

- Typecheck new engine: `pir --filter @necatikcl/stripes-engine typecheck`
- Unit tests: `pir test`
- E2E / visual goldens: `pir test:e2e`
- Refresh site tests: `pir test:site`
- Full check (tests + typecheck + both builds): `pir verify`.
- Docs/rules-only changes: verify frontmatter, links, paths, and stale references.
- Do not claim completion without fresh verification evidence.

## Linear tracking (non-negotiable)

- **Team:** Cloudflare (`CF`)
- **Project:** [Connect shader](https://linear.app/off-brand-studio/project/connect-shader-d90cc371849c)
- **Milestones:** `Editable preview` (active) → `Visual match` → `Production promote`
- **Lifecycle:** `Backlog` → `In Progress` when work starts → `Done` only when shipped. Close the loop before session end.
- **Search before create.** Prefer Linear-generated branch names (`ty/cf-N-…`).
- **Boundary:** Shader work stays in `apps/lab` + `packages/stripes-engine`. Connect site work stays in `apps/site` and its separate Linear project.

## Dev panels

Always render the shader dev panel through a React portal to `document.body`
(`createPortal`). Host sections use `isolate` / `overflow-hidden`, which trap a
fixed-position child in their stacking context and clip it — an inline panel
ends up underneath the page. This applies to any overlay the panel opens.

## Safety

- Preserve user changes and avoid destructive git commands.
- Do not edit `.cursor/plans` unless explicitly requested.
- If repeated attempts fail, stop and explain observations plus options.

# Stripes Shader

A React/TypeScript **WebGL2** engine that turns an image or video into an animated
duotone stripe-grid texture with baked glyph letters and effects (sparkle, flames,
reveal, cursor trail, click wave), a colors mode, and SVG/video export.

## Workspace

This is a pnpm-workspace monorepo:

- `apps/lab/` — the authoring app and the **live Cloudflare Worker** [`connect-shader`](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production) (served at `/`).
- `packages/stripes-engine/` — the WebGL2 render core (`createStripesEngine`) plus the render-only
  `<StripesShader>` React canvas at `@necatikcl/stripes-engine/react`. See its README for usage.

Run scripts from the repo root (they delegate to the lab): `pir dev`, `pir build`, `pir test`, `pir verify`, `pir deploy`. Lint/format run repo-wide: `pir code-check`.

**Deploy target:** always Worker `connect-shader` (see `docs/deploy.md`). Live: https://connect-shader.off-brand.workers.dev/

## Scripts

- `pir dev` serves the playground at `/`.
- `pir typecheck` runs TypeScript project checks.
- `pir code-check` runs `oxlint` and `oxfmt --check` (run before `git push` if you want lint/format gates early).
- `pir lint` runs `oxlint` only.
- `pir format` / `pir format:check` run `oxfmt`.
- `pir test` runs the Vitest suite.
- `pir build` builds the lab app (the deployable client → `apps/lab/dist`).
- `pir deploy` builds the lab and runs `wrangler deploy` → **`connect-shader`** production.
- `pir verify` runs tests, then typecheck, then the lab build (lint/format are intentionally excluded for speed).
- Tip — quicker loops while editing: `pir typecheck`, targeted `pir test <pattern>`, then finish with full `pir verify` (Vitest uses `pool: "threads"` + happy-dom here).

Install dependencies with `pi`.

## Project Context

- New engine architecture: `docs/engine-architecture.md` + `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`.
- Legacy Pixi/CPU engine docs (historical): `docs/legacy/`.
- Legacy Cursor rules (historical): `.cursor/legacy/rules/`.

Use Node `22` from `.node-version` for local development (match this in the Cloudflare dashboard build settings).

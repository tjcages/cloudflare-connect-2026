# Stripes Shader

A React/TypeScript WebGL texture-shader playground (Pixi.js). It turns an image or
video into a stylized duotone stripe-grid texture with baked glyph letters and
animated effects (sparkle, flames, reveal, cursor trail, click wave), and supports
SVG/video export and a copyable config.

> The legacy "Section Grid Builder" app was removed; the playground is now the only
> app. A pnpm-workspace restructure (`packages/stripes-shader` + `apps/studio`) and an
> installable package are planned — see `docs/superpowers/specs/2026-06-17-stripes-shader-refactor-design.md`.

## Workspace

This is a pnpm-workspace monorepo:

- `apps/studio/` — the Stripes Shader playground/authoring app (served at `/`, deployed to Cloudflare).
- `packages/stripes-shader/` — the render core package (placeholder; populated in a later phase).

Run scripts from the repo root (they delegate to the studio): `pir dev`, `pir build`, `pir test`, `pir verify`. Lint/format run repo-wide: `pir code-check`. See `docs/superpowers/specs/2026-06-17-stripes-shader-refactor-design.md` for the full plan.

## Scripts

- `pir dev` serves the playground at `/`.
- `pir typecheck` runs TypeScript project checks.
- `pir code-check` runs `oxlint` and `oxfmt --check` (run before `git push` if you want lint/format gates early).
- `pir lint` runs `oxlint` only.
- `pir format` / `pir format:check` run `oxfmt`.
- `pir test` runs the Vitest suite.
- `pir build` type-checks and builds the app.
- `pir verify` runs tests, then `tsc -b` and `vite build` in parallel (lint/format are intentionally excluded for speed).
- Tip — quicker loops while editing: `pir typecheck`, targeted `pir test <pattern>`, then finish with full `pir verify` (Vitest uses `pool: "threads"` + happy-dom here).

Install dependencies with `pi`.

## Project Context

- Grid generation rules live in `docs/grid-rulebook.md`.
- AI/agent architecture context lives in `docs/ai-context.md`.
- Persistent Cursor rules live in `.cursor/rules/`.

Use Node `22` from `.node-version` for local development (match this in the Cloudflare dashboard build settings).

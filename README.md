# Stripes Shader

A React/TypeScript WebGL texture-shader playground (Pixi.js). It turns an image or
video into a stylized duotone stripe-grid texture with baked glyph letters and
animated effects (sparkle, flames, reveal, cursor trail, click wave), and supports
SVG/video export and a copyable config.

> The legacy "Section Grid Builder" app was removed; the playground is now the only
> app. A pnpm-workspace restructure (`packages/stripes-shader` + `apps/studio`) and an
> installable package are planned — see `docs/superpowers/specs/2026-06-17-stripes-shader-refactor-design.md`.

## Scripts

- `pnpm dev` (run via `pir dev`) serves the playground at `/`.
- `pnpm typecheck` runs TypeScript project checks.
- `pnpm code-check` runs `oxlint` and `oxfmt --check` (run before `git push` if you want lint/format gates early).
- `pnpm lint` runs `oxlint` only.
- `pnpm format` / `pnpm format:check` run `oxfmt`.
- `pnpm test` runs the Vitest suite.
- `pnpm build` type-checks and builds the app.
- `pnpm verify` runs tests, then `tsc -b` and `vite build` in parallel (lint/format are intentionally excluded for speed).
- Tip — quicker loops while editing: `pnpm typecheck`, targeted `pnpm exec vitest run <pattern>`, then finish with full `pnpm verify` (Vitest uses `pool: "threads"` + happy-dom here).

Install dependencies with `pnpm install`.

## Project Context

- Grid generation rules live in `docs/grid-rulebook.md`.
- AI/agent architecture context lives in `docs/ai-context.md`.
- Persistent Cursor rules live in `.cursor/rules/`.

Use Node `22` from `.node-version` for local development (match this in the Cloudflare dashboard build settings).

# Section Grid Generator

A React/TypeScript Canvas component builder. It generates deterministic seeded grid backgrounds from `40x40` and `80x80` cells, supports component layers, and exports the composed canvas as PNG.

## Scripts

- `pnpm dev` starts the Vite dev server.
- `pnpm typecheck` runs TypeScript project checks.
- `pnpm code-check` runs `oxlint` and `oxfmt --check` (run before `git push` if you want lint/format gates early).
- `pnpm lint` runs `oxlint` only.
- `pnpm format` / `pnpm format:check` run `oxfmt`.
- `pnpm test` runs the Vitest suite.
- `pnpm build` type-checks and builds the app.
- `pnpm verify` runs tests, then `tsc -b` and `vite build` in parallel (lint/format are intentionally excluded for speed).
- Tip — quicker loops while editing: `pnpm typecheck`, targeted `pnpm exec vitest run <pattern>`, then finish with full `pnpm verify` (Vitest uses `pool: "threads"` + happy-dom here).

Install dependencies with `pnpm install` (or `pi` if you use the guarded wrapper). Releases younger than 30 days are blocked via `minimumReleaseAge` in `package.json` / `.npmrc`.

## Project Context

- Grid generation rules live in `docs/grid-rulebook.md`.
- AI/agent architecture context lives in `docs/ai-context.md`.
- Persistent Cursor rules live in `.cursor/rules/`.

Use Node `22` from `.node-version` for local development (match this in the Cloudflare dashboard build settings).

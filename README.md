# Section Grid Generator

A React/TypeScript Canvas component builder. It generates deterministic seeded grid backgrounds from `40x40` and `80x80` cells, supports component layers, and exports the composed canvas as PNG.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run typecheck` runs TypeScript project checks.
- `npm run code-check` runs `oxlint` and `oxfmt --check` (used in CI on push/PR; run locally before `git push` if you want the same gate early).
- `npm run lint` runs `oxlint` only.
- `npm run format` / `npm run format:check` run `oxfmt`.
- `npm test` runs the Vitest suite.
- `npm run build` type-checks and builds the app.
- `npm run verify` runs tests, then `tsc -b` and `vite build` in parallel (lint/format are intentionally excluded for speed).
- Tip — quicker loops while editing: `npm run typecheck`, targeted `npx vitest run <pattern>`, then finish with full `npm run verify` (Vitest uses `pool: "threads"` + happy-dom here).

## Project Context

- Grid generation rules live in `docs/grid-rulebook.md`.
- AI/agent architecture context lives in `docs/ai-context.md`.
- Persistent Cursor rules live in `.cursor/rules/`.

Use Node `22` from `.node-version` for local and CI parity.

# Section Grid Generator

A React/TypeScript Canvas component builder. It generates deterministic seeded grid backgrounds from `40x40` and `80x80` cells, supports component layers, and exports the composed canvas as PNG.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run typecheck` runs TypeScript project checks.
- `npm run lint` runs ESLint.
- `npm run format` formats the repo with Prettier.
- `npm run format:check` checks formatting.
- `npm test` runs the Vitest suite.
- `npm run build` type-checks and builds the app.
- `npm run verify` runs lint, format check, tests, and build.

## Project Context

- Grid generation rules live in `docs/grid-rulebook.md`.
- AI/agent architecture context lives in `docs/ai-context.md`.
- Persistent Cursor rules live in `.cursor/rules/`.

Use Node `22` from `.node-version` for local and CI parity.

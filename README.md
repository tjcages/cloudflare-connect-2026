# Cloudflare Connect 2026

The Connect 2026 refresh site and its WebGL2 shader authoring tool live together
in one repository and deploy as separate Cloudflare Workers.

## Workspace

This is a pnpm-workspace monorepo:

- `apps/lab/` — the authoring app and the **live Cloudflare Worker** [`connect-shader`](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production) (served at `/`).
- `apps/site/` — the Astro refresh site and the `connect-2026-site` Worker (Connect homepage at `/connect/`).
- `packages/connect-twizzler/` — the packaged Connect hero shader used by the site.
- `packages/panels/` — the packaged shader control panel used by the site.
- `packages/stripes-engine/` — the WebGL2 render core (`createStripesEngine`) plus the render-only
  `<StripesShader>` React canvas at `@necatikcl/stripes-engine/react`. See its README for usage.

Run scripts from the repo root. Use the `:site` or `:shader` suffix when selecting
an app. See `docs/deploy.md` for the two Worker targets.

## Scripts

- `pir dev:site` serves the refresh site; `pir dev:shader` serves the shader tool.
- `pir typecheck` runs TypeScript project checks.
- `pir code-check` runs `oxlint` and `oxfmt --check` (run before `git push` if you want lint/format gates early).
- `pir lint` runs `oxlint` only.
- `pir format` / `pir format:check` run `oxfmt`.
- `pir test` runs the Vitest suite.
- `pir build:all` builds both deployable apps.
- `pir deploy:site` deploys `connect-2026-site`; `pir deploy:shader` deploys `connect-shader`.
- `pir verify` runs both apps' tests, typechecks, and builds.
- Tip — quicker loops while editing: `pir typecheck`, targeted `pir test <pattern>`, then finish with full `pir verify` (Vitest uses `pool: "threads"` + happy-dom here).

Install dependencies with `pi`.

## Project Context

- New engine architecture: `docs/engine-architecture.md` + `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`.
- Legacy Pixi/CPU engine docs (historical): `docs/legacy/`.
- Legacy Cursor rules (historical): `.cursor/legacy/rules/`.

Use Node `22` from `.node-version` for local development (match this in the Cloudflare dashboard build settings).

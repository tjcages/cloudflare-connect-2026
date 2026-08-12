# Project Instructions For AI Agents

## Monorepo Overview

The GPU-first rewrite is complete and is now the **only** engine. The legacy Pixi/CPU
product (`apps/studio` + `packages/stripes-shader`) has been retired/deleted.

| Package                   | Role                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| `apps/lab`                | Authoring app + the live Cloudflare worker `connect-shader` (at `/`)   |
| `packages/stripes-engine` | WebGL2 render core + `<StripesShader>` React canvas (`/react` subpath) |

Follow `docs/engine-architecture.md` and `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`.
Do **not** follow `docs/legacy/` — those describe the retired Pixi/CPU engine.

## Deploy

**Always** deploy to Worker [`connect-shader`](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production)
(`account_id` `944ca70087298faa2e84783db46162c5`). Details: `docs/deploy.md`.
Live: https://connect-shader.off-brand.workers.dev/

**PR handoff:** use the Cloudflare Workers **branch preview URL** posted on the PR
(`https://<branch-slug>-connect-shader.off-brand.workers.dev/`). Never trycloudflare tunnels.
If missing, enable Build → Branch control → **Builds for non-production branches** (see `docs/deploy.md`).

## Package Manager

Use `pi` (install) and `pir` (run scripts). Never `npm`, `pnpm`, `yarn`, or `npx` directly.

## Verification

- Typecheck new engine: `pir --filter @necatikcl/stripes-engine typecheck`
- Unit tests: `pir test`
- E2E / visual goldens: `pir test:e2e`
- Full check (tests + typecheck + lab build): `pir verify`.
- Docs/rules-only changes: verify frontmatter, links, paths, and stale references.
- Do not claim completion without fresh verification evidence.

## Linear tracking (non-negotiable)

- **Team:** Cloudflare (`CF`)
- **Project:** [Connect shader](https://linear.app/off-brand-studio/project/connect-shader-d90cc371849c)
- **Milestones:** `Editable preview` (active) → `Visual match` → `Production promote`
- **Lifecycle:** `Backlog` → `In Progress` when work starts → `Done` only when shipped. Close the loop before session end.
- **Search before create.** Prefer Linear-generated branch names (`ty/cf-N-…`).
- **Boundary:** Shader work stays in `apps/lab` + `packages/stripes-engine`. Connect marketing site is a separate Linear project.

## Safety

- Preserve user changes and avoid destructive git commands.
- Do not edit `.cursor/plans` unless explicitly requested.
- If repeated attempts fail, stop and explain observations plus options.

## Cursor Cloud specific instructions

- The `pi` / `pir` aliases do **not** exist in the Cloud VM. Run the equivalents directly: `pnpm install` (for `pi`) and `pnpm run <script>` / `pnpm --filter …` (for `pir`). Dependencies are refreshed automatically on startup by the environment update script (`pnpm install`).
- Dev server: `pnpm run dev` serves Vite on `http://localhost:5174/`. The authoring app is `/lab.html`; the client preview is `/`. Other entries: `/experiments.html`, `/client.html`. Editing shader controls updates the WebGL2 canvas live.
- Standard verification commands are in `## Verification` above (map `pir` → `pnpm run`). `pnpm run lint` currently exits non-zero because of a pre-existing unused-import error in `scripts/capture-twizzler.mjs` (plus `react-hooks` warnings) — unrelated to your changes.
- E2E (`pnpm run test:e2e`) needs Playwright's Chromium: `pnpm exec playwright install chromium` (already baked into the snapshot). The webServer is auto-started by `playwright.config.ts`.
- E2E visual goldens are committed for macOS (`*-darwin.png`) only. On Linux the first run **writes** `*-linux.png` baselines and reports failures ("A snapshot doesn't exist … writing actual"); `perf.spec.ts` soft-skips without a real GPU (SwiftShader fallback). A fully green `test:e2e` run is therefore not expected in the Cloud VM. Do **not** commit generated `*-linux.png` snapshots.

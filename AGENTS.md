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

## Cursor Cloud specific instructions

The VM is pre-provisioned with Node 22 and pnpm 10.33.3, and the startup update
script runs `pnpm install`. `pi`/`pir` are personal shell aliases that do not
exist on the VM — use `pnpm install` and `pnpm run <script>` directly (script
names in root `package.json`).

- **No `NODE_AUTH_TOKEN` needed for install.** `apps/site/README.md` warns that a
  GitHub `read:packages` token is required, but that only applies to pulling the
  published `@necatikcl/stripes-engine`. Both `@necatikcl/stripes-engine` and
  `@tjcages/connect-twizzler` are `workspace:*` deps here, so `pnpm install`
  resolves them locally without any token.
- **Dev server ports:** `pnpm run dev:shader` (lab) serves on **5174** (pinned by
  `apps/lab` Vite config + `playwright.config.ts`, not the Vite default 5173).
  `pnpm run dev:site` serves on **4321**; the Connect homepage is at `/connect/`.
- **E2E visual goldens are macOS-only in git.** On this Linux VM `pnpm run test:e2e`
  fails every screenshot spec until Linux baselines exist — run
  `pnpm run test:e2e:update` first (see `tests/README.md`). Do not commit the
  generated `*-linux.png` baselines as part of unrelated work.
- **Expected E2E failures on this VM even with baselines:** `perf.spec.ts` (asserts a
  4K 60fps GPU budget; the VM uses software SwiftShader), `comet-parity.spec.ts`,
  and `uploaded-textures.spec.ts` (localStorage upload timeout). These are
  hardware/timeout limits, not code regressions.
- **`pnpm run lint` and `format:check` currently report pre-existing errors** in the
  checked-in code and exit non-zero; they are not part of the `verify` gate. Judge
  your own changes against these tools rather than expecting a clean baseline.
- Unit tests (`pnpm run test`, `pnpm run test:site`), `pnpm run typecheck`, and
  `pnpm run build:all` all pass cleanly and need no running services or external DB.

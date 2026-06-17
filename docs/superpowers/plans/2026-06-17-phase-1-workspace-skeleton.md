# Phase 1 — pnpm Workspace Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the single-app repo into a pnpm-workspace monorepo: move the playground app into `apps/studio/`, make the root `package.json` dev-tooling-only, create an (empty) `packages/stripes-shader/` skeleton, and prune dead dependencies — with the app still building, testing, and serving green.

**Architecture:** Everything currently under `src/` is consumed only by the playground, so it moves **wholesale** into `apps/studio/src/` (a wholesale move preserves every relative import unchanged). The app's top-level files (`index.html`, `public/`, `vite.config.ts`, `tsconfig.app.json`, `wrangler.jsonc`) move into `apps/studio/`. The root keeps repo-wide tooling (`oxlint`, `oxfmt`, `husky`, `lint-staged`, workspace config) and delegates `dev`/`build`/`test`/`verify` to the studio package via pnpm filters. The render-core package (`packages/stripes-shader/`) is created as a minimal placeholder here; it is populated in Phase 2.

**Tech Stack:** pnpm workspaces (via `pi`), Vite 8, React 19, TypeScript 6 project refs, Vitest 4, oxlint/oxfmt, Cloudflare Wrangler.

## Global Constraints

- **Work directly on `main`, locally. NEVER push.** Commit locally per task. (User preference: no feature branches/worktrees.)
- **Package manager is `pi`** — never `pnpm`/`npm`/`npx` as a typed command. Run scripts with `pir <script>`. Install/relink the workspace with `pi`. (Generated files like `.husky/pre-commit` may contain `pnpm`; that is the committed hook, leave it.)
- **Do not start a dev server.** The user runs their own. For visual checks, ask the user to look at their running dev server.
- **Use `git mv` for all moves** to preserve history and keep the index coherent.
- **Per-task gate is `pir verify`** run so it exercises the studio app (`pir verify` at root must resolve to the studio's verify), plus `pir code-check` staying green. A task is done only when both are green.
- **Preserve relative imports.** Because `src/**` moves as a whole into `apps/studio/src/**`, no `../`-relative import path inside it changes. Do NOT rewrite import paths.
- **The `--color-builder-*` CSS tokens in `global.css` are LIVE** (used by `Button.tsx` and playground UI). Do NOT remove or rename them in this phase.
- **Out of scope:** the core extraction (Phase 2 — render modules stay in `apps/studio/src/playground` and `apps/studio/src/lib/export` for now), the package build/publish (Phase 3), and the git repo/dir rename to `stripes-shader`.
- **Assumed package scope:** `@necatikcl/stripes-shader`.

## Target Layout After Phase 1

```
stripes-shader/                  (workspace root)
├─ package.json                  # tooling-only + delegating scripts
├─ pnpm-workspace.yaml           # packages: ['apps/*', 'packages/*']
├─ tsconfig.json                 # solution: references apps/studio
├─ .oxlintrc.json .oxfmtrc.json .npmrc .node-version .gitignore .husky/  (root, repo-wide)
├─ docs/  README.md  AGENTS.md
├─ apps/studio/
│  ├─ package.json               # name "studio", the app's runtime deps
│  ├─ index.html                 # served at /
│  ├─ vite.config.ts             # app build + vitest config (moved)
│  ├─ tsconfig.json  tsconfig.node.json
│  ├─ wrangler.jsonc
│  ├─ public/{fonts,playground}/…
│  └─ src/…                       # all current src/ moved here verbatim
└─ packages/stripes-shader/      # placeholder skeleton (filled in Phase 2)
   ├─ package.json               # name "@necatikcl/stripes-shader", private for now
   └─ src/index.ts               # export {} placeholder
```

---

### Task 1: Move the app into `apps/studio/` and wire the workspace

The atomic restructure: relocate the app, create its package, make the root a workspace coordinator. Everything must land together so the workspace is coherent and `verify` passes.

**Files:**
- Move (git mv): `src/` → `apps/studio/src/`; `index.html`, `public/`, `vite.config.ts`, `wrangler.jsonc` → `apps/studio/`; `tsconfig.app.json` → `apps/studio/tsconfig.json`; `tsconfig.node.json` → `apps/studio/tsconfig.node.json`
- Create: `apps/studio/package.json`
- Modify: `pnpm-workspace.yaml`, root `package.json`, root `tsconfig.json`

- [ ] **Step 1: Create the app directory and move the source + app files**

```bash
mkdir -p apps/studio
git mv src apps/studio/src
git mv index.html apps/studio/index.html
git mv public apps/studio/public
git mv vite.config.ts apps/studio/vite.config.ts
git mv wrangler.jsonc apps/studio/wrangler.jsonc
git mv tsconfig.app.json apps/studio/tsconfig.json
git mv tsconfig.node.json apps/studio/tsconfig.node.json
```

- [ ] **Step 2: Fix `apps/studio/tsconfig.node.json` self-reference**

It points its build-info and `include` at `vite.config.ts` (now co-located) — that still resolves since both moved together. Open `apps/studio/tsconfig.node.json` and confirm `"include": ["vite.config.ts"]` (relative — correct, no change needed). No edit unless the path is absolute.

- [ ] **Step 3: Create `apps/studio/package.json`**

Create with exactly this content (runtime deps = only those still imported in the surviving tree; build/test tooling the app's own config needs):

```json
{
  "name": "studio",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc -b",
    "build": "pnpm run typecheck && vite build",
    "build:client": "vite build",
    "preview:worker": "pnpm run build && wrangler dev",
    "deploy": "pnpm run build && wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "verify": "pnpm run test && pnpm run typecheck && pnpm run build:client"
  },
  "dependencies": {
    "@ffmpeg/core": "^0.12.10",
    "@ffmpeg/ffmpeg": "^0.12.15",
    "@ffmpeg/util": "^0.12.2",
    "clsx": "^2.1.1",
    "fflate": "^0.8.2",
    "leva": "^0.10.1",
    "lucide-react": "^1.14.0",
    "pixi.js": "^8.18.1",
    "react": "^19.0.5",
    "react-colorful": "^5.7.0",
    "react-dom": "^19.0.5",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "^4.2.4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "happy-dom": "^20.9.0",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.10",
    "vitest": "^4.1.5",
    "wrangler": "^4.88.0"
  }
}
```

(Note: `@ffmpeg/core` is retained even though it shows 0 static import sites — it is loaded at runtime by `playgroundFfmpeg.ts`; Task 2 verifies before any removal. `@types/hast` is intentionally omitted — it was for the deleted code-snippet/lowlight path; Task 2 confirms.)

- [ ] **Step 4: Update `pnpm-workspace.yaml` to declare the workspace packages**

Add a `packages:` list at the top (keep the existing `minimumReleaseAge` and `allowBuilds`):

```yaml
packages:
  - "apps/*"
  - "packages/*"

minimumReleaseAge: 10080

allowBuilds:
  esbuild: set this to true or false
  sharp: set this to true or false
  workerd: set this to true or false
```

- [ ] **Step 5: Rewrite the root `package.json` to tooling-only + delegating scripts**

Replace the root `package.json` with (keeps repo-wide lint/format/husky + lint-staged; delegates app scripts to the studio via pnpm filter; runtime deps now live in `apps/studio`):

```json
{
  "name": "stripes-shader-monorepo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@10.6.3",
  "pnpm": {
    "minimumReleaseAge": 10080
  },
  "scripts": {
    "dev": "pnpm --filter studio dev",
    "build": "pnpm --filter studio build",
    "build:client": "pnpm --filter studio build:client",
    "typecheck": "pnpm --filter studio typecheck",
    "preview:worker": "pnpm --filter studio preview:worker",
    "deploy": "pnpm --filter studio deploy",
    "test": "pnpm --filter studio test",
    "test:watch": "pnpm --filter studio test:watch",
    "verify": "pnpm --filter studio verify",
    "code-check": "oxlint -c .oxlintrc.json . && oxfmt --check .",
    "lint": "oxlint -c .oxlintrc.json .",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "prepare": "husky",
    "precommit": "lint-staged"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,jsonc,css,md,yml,yaml}": ["oxfmt --write"],
    "*.{js,jsx,ts,tsx}": ["oxlint -c .oxlintrc.json"]
  },
  "devDependencies": {
    "husky": "^9.1.7",
    "lint-staged": "^16.4.0",
    "oxfmt": "^0.48.0",
    "oxlint": "^1.63.0"
  }
}
```

(`typescript`/`vitest`/`vite` now live in `apps/studio`; root keeps only repo-wide lint/format/husky tooling. The `export:sync-test` script is dropped — that export-test tooling is removed in Phase 2.)

- [ ] **Step 6: Point the root `tsconfig.json` at the studio**

Replace root `tsconfig.json` with a solution file referencing the studio:

```json
{
  "files": [],
  "references": [{ "path": "./apps/studio" }]
}
```

(`apps/studio/tsconfig.json` already references its own app sources; `tsc -b` from the studio resolves `tsconfig.node.json` if needed. The root solution build delegates there.)

- [ ] **Step 7: Relink the workspace**

Run: `pi`
Expected: pnpm resolves the workspace, installs `apps/studio` deps, writes/updates `pnpm-lock.yaml`. No errors about missing packages.

- [ ] **Step 8: Verify the app builds, tests, and typechecks from the studio**

Run: `pir verify`
Expected: PASS — delegates to `pnpm --filter studio verify`: vitest green (same ~327 tests), `tsc -b` clean, `vite build` emits `apps/studio/dist/index.html`.

- [ ] **Step 9: Verify lint/format still green repo-wide**

Run: `pir code-check`
Expected: PASS — oxlint + oxfmt clean across the relocated tree (paths in `.oxlintrc.json` overrides like `src/grid/**` still match because the lint runs from repo root over `apps/studio/src/grid/**`? NO — verify: oxlint globs are repo-root-relative. If the `src/grid/**` overrides no longer match `apps/studio/src/grid/**`, update them in this step to `apps/studio/src/grid/**` and `**/src/grid/**` as needed, then re-run. Capture the before/after.)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Phase 1: move the app into apps/studio and wire the pnpm workspace

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Prune dead dependencies

Remove the runtime deps the builder left behind (0 import sites in the surviving tree). Verify the two ambiguous ones before dropping.

**Files:**
- Modify: `apps/studio/package.json` (root already shed runtime deps in Task 1)

- [ ] **Step 1: Confirm the ambiguous deps before deciding**

Run:
```bash
rg -n "@ffmpeg/core|ffmpeg-core|prettier" apps/studio/src
```
Expected: `@ffmpeg/core` may appear only as a runtime/CDN URL string in `playgroundFfmpeg.ts` (keep it as a dep); `prettier` should have NO hits (the export formatting path was deleted) → safe to drop. Record what you find.

- [ ] **Step 2: Remove the confirmed-dead deps from `apps/studio/package.json`**

These had 0 import sites in the surviving tree (audited): delete from `dependencies` — `@chenglou/pretext`, `@cloudflare/kumo`, `@phosphor-icons/react`, `@radix-ui/react-slider`, `highlight.js`, `lowlight`, `motion`, `pixi-box-shadow`, `react-hotkeys-hook`, `zundo`, `zustand`, `prettier`. From `devDependencies` delete `@types/hast` (was for the deleted lowlight/code-snippet hast path). (Most of these were already excluded when `apps/studio/package.json` was authored in Task 1 — this step is the explicit confirmation/removal pass; ensure none remain.)

Keep `@ffmpeg/core` (runtime-loaded). Keep everything in the Task 1 dependency list.

- [ ] **Step 3: Reinstall and verify nothing depended on a dropped package**

Run: `pi && pir verify`
Expected: PASS — install succeeds with the slimmer dep set; vitest/typecheck/build all green (proves nothing imported a removed package).

- [ ] **Step 4: Commit**

```bash
git add apps/studio/package.json pnpm-lock.yaml
git commit -m "Phase 1: prune dead builder dependencies from the studio app"
```

---

### Task 3: Create the `packages/stripes-shader` placeholder

Reserve the render-core package so the monorepo skeleton is complete. It is empty here and filled in Phase 2.

**Files:**
- Create: `packages/stripes-shader/package.json`, `packages/stripes-shader/src/index.ts`, `packages/stripes-shader/tsconfig.json`

- [ ] **Step 1: Create the placeholder package**

`packages/stripes-shader/package.json`:
```json
{
  "name": "@necatikcl/stripes-shader",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "description": "Render-only Stripes Shader canvas (placeholder — populated in Phase 2).",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

`packages/stripes-shader/src/index.ts`:
```ts
// Placeholder — the render core (StripesShader, StripesShaderConfig,
// createStripesShaderScene) is extracted here in Phase 2.
export {};
```

`packages/stripes-shader/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Relink and confirm the workspace sees both packages**

Run: `pi && pnpm ls -r --depth -1 2>/dev/null || pi list -r`
Expected: the workspace lists both `studio` and `@necatikcl/stripes-shader`. (If the listing command is awkward, just confirm `pi` completes without error and `packages/stripes-shader` is recognized — no "package not found" warnings.)

- [ ] **Step 3: Verify still green**

Run: `pir verify && pir code-check`
Expected: both PASS (the placeholder package has no tests and isn't built yet; it must not break the studio gates).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Phase 1: add packages/stripes-shader placeholder for the render core"
```

---

### Task 4: Update docs for the monorepo layout

Reflect the new structure so README/AGENTS describe how to work in the workspace.

**Files:**
- Modify: `README.md`, `AGENTS.md`

- [ ] **Step 1: Update `README.md` Scripts/structure section**

Read `README.md`, then under the existing intro add (or update the Scripts section to note) the workspace layout and that root scripts delegate to the studio:

```markdown
## Workspace

This is a pnpm-workspace monorepo:

- `apps/studio/` — the Stripes Shader playground/authoring app (served at `/`, deployed to Cloudflare).
- `packages/stripes-shader/` — the render core package (placeholder; populated in a later phase).

Run scripts from the repo root (they delegate to the studio): `pir dev`, `pir build`, `pir test`, `pir verify`. Lint/format run repo-wide: `pir code-check`. See `docs/superpowers/specs/2026-06-17-stripes-shader-refactor-design.md` for the full plan.
```

- [ ] **Step 2: Update `AGENTS.md` Architecture/Verification**

Add a short note under `## Architecture Boundaries` reflecting the workspace move:

```markdown
- The repo is a pnpm-workspace monorepo: the app lives in `apps/studio/` (entry `apps/studio/src/playground/main.tsx`), and `packages/stripes-shader/` is the (placeholder) render core. Root scripts delegate to the studio; `pir verify` runs the studio's gate.
```

- [ ] **Step 3: Verify**

Run: `pir verify`
Expected: PASS (docs-only; confirm no regression).

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "Phase 1: document the pnpm-workspace layout"
```

---

## Phase 1 Done — Definition

- `apps/studio/` holds the whole app; `pir dev` serves it at `/`; `pir build` emits `apps/studio/dist/index.html`; `wrangler` deploy still serves `dist`.
- Root `package.json` is tooling-only and delegates app scripts to the studio.
- `packages/stripes-shader/` exists as a placeholder.
- Dead builder dependencies are pruned.
- `pir verify` and `pir code-check` are green; relative imports unchanged.
- Everything committed locally; nothing pushed.

## Risks & Watch-Items

1. **oxlint/oxfmt path globs** (Task 1 Step 9): `.oxlintrc.json` overrides reference `src/grid/**`, `src/grid/clipboard.ts`, `src/**/*.test.{ts,tsx}`, `src/test/**`. After the move these live under `apps/studio/src/**`. Confirm the globs still match (oxlint runs from repo root); if not, update them to cover `apps/studio/src/**` (e.g. `**/src/grid/**/*.ts`) and re-run `pir code-check`. This is the most likely breakage.
2. **vitest setup paths**: `apps/studio/vite.config.ts` references `./src/test/setupLocalStorage.ts` + `./src/test/setup.ts` (relative to the config file, now in `apps/studio/`) — these resolve correctly since `src/test/` moved with it. Confirm via `pir verify`.
3. **public asset paths**: the `@font-face` `url("/fonts/…")` and texture URLs `/playground/…` are root-absolute served from `apps/studio/public/` — Vite serves `public/` at `/`, so they still resolve. Confirm the playground renders (visual check in the user's dev server).
4. **wrangler deploy CWD**: `deploy`/`preview:worker` now run from `apps/studio` (assets dir `./dist` resolves to `apps/studio/dist`). Confirm `apps/studio/wrangler.jsonc` `assets.directory` is `./dist` (unchanged).
5. **husky hooks**: `.husky/pre-commit` runs `pnpm run precommit` → root `lint-staged`; staged files under `apps/studio/**` are matched by the root lint-staged globs (`*.{ts,tsx,…}` are extension-based, not path-anchored), so they still lint/format on commit.
6. **tsc -b project references**: confirm `tsc -b` works through the root solution `tsconfig.json` → `apps/studio` → `tsconfig.node.json`. If `tsc -b` complains about missing `composite: true` on referenced projects, set `composite: true` on `apps/studio/tsconfig.json` and `tsconfig.node.json` (and adjust `tsBuildInfoFile`), or run typecheck directly via the studio filter (the scripts already do `pnpm --filter studio typecheck`).

## Self-Review (done while writing)

- **Spec coverage:** implements the spec's "Phase 1 — Stand up the workspace skeleton." Defers core extraction (Phase 2) and package build (Phase 3) as the spec sequences.
- **Dep split** is grounded in the measured audit (0-import-site deps dropped; runtime-loaded `@ffmpeg/core` retained pending Task 2 confirmation).
- **Move strategy** preserves relative imports (wholesale `src/` move), so no import-path edits — the main correctness guarantee.
- **No placeholders**: every step has exact commands or full file contents. The two genuinely conditional steps (lint globs, tsc composite) are written as "check X; if Y then Z" with concrete fixes, because the outcome depends on tool behavior that must be observed at run time.

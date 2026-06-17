# Phase 3 — Library Build + Publishable Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `@necatikcl/stripes-shader` an installable package: a curated public API, a self-bundled auto-registering font, a Vite ESM lib build with `.d.ts`, and `package.json` publish config for GitHub Packages — verified with `npm pack`. **STOP before the actual publish** (that's the user's authenticated action).

**Architecture:** The studio consumes the package as **source** (`workspace:*` → `src/index.ts`, which stays broad for the studio's many imports). To publish a CURATED surface without churning the studio, the lib build uses a separate curated entry `src/public.ts`; `publishConfig` points the published `exports`/`main`/`types` at the built `dist/` (from `public.ts`), while the dev `exports` keep pointing at `src/index.ts`. The font is bundled into the package and registered via the `FontFace` API on `<StripesShader>` mount (no dependency on the studio's `global.css`). `react`/`react-dom`/`pixi.js` are externalized peers.

**Tech Stack:** Vite 8 (lib mode), vite-plugin-dts, TypeScript 6, pnpm workspace, React 19, pixi.js 8.

## Global Constraints

- **Work on `main`, locally. NEVER push. NEVER publish.** Commit locally per task. The publish step is documented for the USER to run with their auth.
- **`pi`/`pir` only.** Adding deps via `pi add` — they must pass the **7-day release-age gate** (`minimumReleaseAge: 10080`); pick a `vite-plugin-dts` version ≥7 days old (if `pi` blocks the latest, use an older satisfying version).
- **Do not start a dev server.**
- **Per-task gate: `pir verify` AND `pir code-check` both green** (the studio must keep building/testing — the lib build is additive and must NOT change how the studio consumes the package as source).
- **Studio stays source-consuming + unchanged.** Do NOT repoint the studio to `dist`; do NOT slim `src/index.ts` (the studio imports broadly from it). Keep the studio's `global.css` `@font-face` as-is.
- **Package stays dependency-clean** at runtime (pixi.js + react peers only).
- **Out of scope:** the actual publish; swapping the licensed font file (user does that for a real release); the optional `buildCurrentConfig()` studio de-dup (nice-to-have, can fold into Task 1 if trivial).

## Reference (current state)

- `packages/stripes-shader/package.json`: `name @necatikcl/stripes-shader`, `version 0.0.0`, `main/types/exports → ./src/index.ts`, peerDeps (pixi/react/react-dom), no build/files/publishConfig.
- `packages/stripes-shader/src/index.ts`: broad (`export *` from ~40 modules + explicit re-exports). KEEP broad (studio uses it).
- Font: `apps/studio/public/fonts/BerkeleyMonoTrial-Regular.otf` (the studio's copy). Family `"Berkeley Mono Trial"` (`codeSnippet.ts:CODE_SNIPPET_FONT_FAMILY`). `stripeLetterFont.ts:preloadStripeLetterFont` only does `document.fonts.load` (needs an existing `@font-face`).

---

### Task 1: Curated public entry `src/public.ts`

**Files:**

- Create: `packages/stripes-shader/src/public.ts`, `packages/stripes-shader/src/public.test.ts`
- Do NOT modify `index.ts` (stays broad for the studio).

- [ ] **Step 1: Write `public.ts` — explicit named exports = the published API**

```ts
// The curated public API of @necatikcl/stripes-shader (the lib-build/publish entry).
// src/index.ts stays broad for the workspace studio; this file is what consumers get.
export { StripesShader, type StripesShaderProps } from "./StripesShader";
export {
  type StripesShaderConfig,
  DEFAULT_STRIPES_SHADER_CONFIG,
  normalizeStripesShaderConfig,
} from "./StripesShaderConfig";
export { serializeStripesShaderConfig } from "./serializeStripesShaderConfig";
export {
  createStripesShaderScene,
  type StripesSceneConfig,
  type StripesShaderSceneOptions,
  type PlaygroundTextureSource,
  type PlaygroundDisplaySize,
} from "./setupTextureShaderScene";
export { resolveStripesSceneConfig } from "./buildSceneConfig";
// Config sub-types a consumer needs to type/build a config literal:
export type { Stripe } from "./stripeColors";
export type { TextureLuminanceMode } from "./colorWhiteness";
export type { PlaygroundGridConfig } from "./playgroundGridConfig";
export type { PlaygroundTextureAdjustments } from "./playgroundTextureAdjustments";
export type { PlaygroundSourceTransform } from "./playgroundSourceTransform";
export type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
export type { PlaygroundRevealConfig } from "./playgroundRevealConfig";
export type { PlaygroundCursorTrailConfig } from "./playgroundCursorTrailConfig";
export type { PlaygroundClickWaveConfig } from "./playgroundClickWaveConfig";
```

(Confirm each imported name exists with that exact spelling — grep if unsure. Adjust to real names. Do NOT export internal render modules — pixi textures, filters, block-grid, letter internals, perf, prng, etc.)

- [ ] **Step 2: Test the public surface**

`public.test.ts` (node env): import `* as pub from "./public"` and assert the expected runtime symbols exist (`StripesShader`, `DEFAULT_STRIPES_SHADER_CONFIG`, `normalizeStripesShaderConfig`, `serializeStripesShaderConfig`, `createStripesShaderScene`, `resolveStripesSceneConfig`) and that an obviously-internal symbol is NOT present (e.g. `expect("createStripeDuotoneFilter" in pub).toBe(false)` and `"buildStripeLetterAtlas" in pub` false). This guards the curation.

- [ ] **Step 3: Gate + commit**

Run: `pir verify && pir code-check` (both green).

```bash
git add -A
git commit -m "Phase 3: add curated public.ts entry for the published API surface

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Self-bundle + auto-register the font

**Files:**

- Add: `packages/stripes-shader/src/assets/BerkeleyMonoTrial-Regular.otf` (copy of the studio's), `packages/stripes-shader/src/registerStripesFont.ts`, `packages/stripes-shader/src/registerStripesFont.test.ts`
- Modify: `packages/stripes-shader/src/stripeLetterFont.ts` (or `StripesShader.tsx`) to register before load; `packages/stripes-shader/src/vite-env.d.ts` (asset module decl, create if absent)

- [ ] **Step 1: Bundle the font asset**

```bash
mkdir -p packages/stripes-shader/src/assets
cp apps/studio/public/fonts/BerkeleyMonoTrial-Regular.otf packages/stripes-shader/src/assets/BerkeleyMonoTrial-Regular.otf
git add packages/stripes-shader/src/assets/BerkeleyMonoTrial-Regular.otf
```

Add an asset-URL module declaration so TS accepts the import — create `packages/stripes-shader/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
declare module "*.otf" {
  const url: string;
  export default url;
}
```

- [ ] **Step 2: Write `registerStripesFont.ts`**

```ts
import fontUrl from "./assets/BerkeleyMonoTrial-Regular.otf";
import { STRIPE_LETTER_FONT_FAMILY } from "./stripeLetterFont";

let registered = false;

/** Registers the bundled letter font via the FontFace API and resolves once it's loaded.
 *  Idempotent; SSR/no-FontFace safe (no-op). */
export async function registerStripesFont(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined" || !document.fonts) return;
  try {
    if (!registered) {
      const face = new FontFace(STRIPE_LETTER_FONT_FAMILY, `url(${fontUrl})`, { weight: "400", style: "normal" });
      document.fonts.add(await face.load());
      registered = true;
    }
    await document.fonts.load(`400 12px "${STRIPE_LETTER_FONT_FAMILY}"`);
  } catch {
    /* font load blocked/unavailable — letters fall back to a system monospace */
  }
}
```

- [ ] **Step 3: Call it on `<StripesShader>` mount**

In `StripesShader.tsx`, the `onPreload` currently `await preloadStripeLetterFont()`. Change it to `await registerStripesFont()` (which registers the bundled face AND loads it). This makes letters render in a consumer with zero `@font-face` setup. (Leave `preloadStripeLetterFont` exported for internal/studio use; the studio path is unchanged.)

- [ ] **Step 4: Test**

`registerStripesFont.test.ts` (happy-dom): call `registerStripesFont()` and assert it resolves without throwing (happy-dom may lack a real FontFace — the SSR/no-FontFace guard returns early, so the test asserts the no-throw + idempotent behavior). If happy-dom provides a `FontFace` stub, assert `document.fonts.add` was invoked. Keep it a smoke test.

- [ ] **Step 5: Gate + commit**

Run: `pir verify && pir code-check`. Watch-item: the `.otf` import must resolve under vitest (Vite resolves asset imports to a URL string by default; if a test fails to resolve the import, add the asset handling the error indicates — but the `*.otf` ambient decl + Vite's default asset pipeline should suffice). Both green.

```bash
git add -A
git commit -m "Phase 3: self-bundle the letter font + FontFace auto-registration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Vite ESM lib build + `.d.ts`

**Files:**

- Create: `packages/stripes-shader/vite.config.ts`, `packages/stripes-shader/tsconfig.build.json` (if dts needs it)
- Modify: `packages/stripes-shader/package.json` (add `build` script + `vite-plugin-dts` dev dep)

- [ ] **Step 1: Add `vite` + `vite-plugin-dts` dev deps (release-age-safe)**

```bash
pi add -D vite vite-plugin-dts --filter @necatikcl/stripes-shader
```

If `pi` blocks the latest `vite-plugin-dts` on the 7-day gate, pin an older satisfying version (e.g. `pi add -D vite-plugin-dts@<older> --filter @necatikcl/stripes-shader`). Use the repo's `vite@^8` to match. Record the versions used.

- [ ] **Step 2: Write `packages/stripes-shader/vite.config.ts`**

```ts
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({
      rollupTypes: true,
      tsconfigPath: "./tsconfig.json",
      include: ["src/public.ts", "src/**/*.ts", "src/**/*.tsx"],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/public.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "pixi.js"],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
```

(`@vitejs/plugin-react` is a studio dev dep; add it to the package dev deps too via `pi add -D @vitejs/plugin-react --filter @necatikcl/stripes-shader`. The font `.otf` is emitted by Vite as a bundled asset under `dist/assets/`; confirm it lands in `dist`.)

- [ ] **Step 3: Add the `build` script**

In `packages/stripes-shader/package.json` `scripts`, add `"build": "vite build"`. (Optionally a root `build:lib` delegating: `"build:lib": "pnpm --filter @necatikcl/stripes-shader build"`.)

- [ ] **Step 4: Build and inspect `dist/`**

Run: `pir --filter @necatikcl/stripes-shader build`
Expected: `dist/index.js` (ESM), `dist/index.d.ts` (rolled-up types from `public.ts` — should NOT contain internal render-module symbols), the font asset under `dist/`, and a sourcemap. Then verify externals are NOT bundled:

```bash
rg -n "createElement|useState" packages/stripes-shader/dist/index.js | head   # react should be imported, not inlined
grep -c "from \"react\"\|from 'react'" packages/stripes-shader/dist/index.js  # >0 = externalized
grep -c "from \"pixi.js\"\|from 'pixi.js'" packages/stripes-shader/dist/index.js # >0 = externalized
```

Confirm `dist/index.d.ts` exposes `StripesShader`/`StripesShaderConfig`/etc. and does NOT export internal filter/texture types.

- [ ] **Step 5: Ignore `dist/` in lint/format/git**

Ensure `dist/` is gitignored (root `.gitignore` already ignores `dist`? verify; if not, add `packages/*/dist`). Confirm `oxlint`/`oxfmt` ignore `dist` (they ignore `dist/**` already). Do NOT commit `dist/`.

- [ ] **Step 6: Gate + commit (config only; dist not committed)**

Run: `pir verify && pir code-check` (both green — the studio still consumes source; the lib build is separate).

```bash
git add packages/stripes-shader/vite.config.ts packages/stripes-shader/package.json pnpm-lock.yaml .gitignore
git commit -m "Phase 3: add Vite ESM lib build + vite-plugin-dts for the package

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `package.json` publish config + `npm pack` verification

**Files:**

- Modify: `packages/stripes-shader/package.json`

- [ ] **Step 1: Add publish fields (dev exports keep pointing at source; publishConfig points at dist)**

Update `packages/stripes-shader/package.json`:

```jsonc
{
  "name": "@necatikcl/stripes-shader",
  "version": "0.1.0",
  "type": "module",
  "description": "Render-only Stripes Shader canvas: <StripesShader src config /> turns a video/image into a duotone stripe-grid texture.",
  "license": "UNLICENSED",
  "sideEffects": false,
  // DEV (workspace): the studio consumes source.
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "files": ["dist"],
  "scripts": { "build": "vite build", "test": "vitest run", "test:watch": "vitest", "typecheck": "tsc --noEmit" },
  "peerDependencies": { "pixi.js": "^8.18.1", "react": "^19.0.5", "react-dom": "^19.0.5" },
  // PUBLISH: swap to the built dist + GitHub Packages registry.
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "main": "./dist/index.js",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  },
  "devDependencies": {
    /* keep existing + vite, vite-plugin-dts, @vitejs/plugin-react */
  },
}
```

(Comments are illustrative — strip them in the real JSON. `sideEffects: false` is safe: the font registers on component mount, not at import. If tree-shaking ever drops the font asset, change to `"sideEffects": ["**/*.otf"]`.)

- [ ] **Step 2: Build, then pack and inspect the tarball**

```bash
pir --filter @necatikcl/stripes-shader build
cd packages/stripes-shader && pnpm pack && cd -
```

(`pnpm pack` applies `publishConfig` overrides and produces `necatikcl-stripes-shader-0.1.0.tgz`.) Inspect:

```bash
tar -tzf packages/stripes-shader/necatikcl-stripes-shader-0.1.0.tgz
```

Expected contents: `package/dist/index.js`, `package/dist/index.d.ts`, the font asset under `package/dist/`, `package/package.json` (with `main/types/exports` → dist). Confirm NO `src/` is shipped (only `dist` per `files`), and the published `package.json`'s `main` is `./dist/index.js`. Delete the `.tgz` after inspection (don't commit it).

- [ ] **Step 3: Document the publish command (DO NOT RUN)**

Add a short `packages/stripes-shader/PUBLISHING.md` with the exact steps the USER runs with their auth:

```markdown
# Publishing (manual — requires your GitHub Packages auth)

1. Authenticate to GitHub Packages: add to `~/.npmrc`:
   `//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT` (PAT with `write:packages`)
2. Build: `pir --filter @necatikcl/stripes-shader build`
3. Publish: `cd packages/stripes-shader && pnpm publish` (uses `publishConfig.registry`).
   - For a real release, FIRST swap `src/assets/BerkeleyMonoTrial-Regular.otf` for your LICENSED font file.
     Consumers: add `@necatikcl:registry=https://npm.pkg.github.com` (+ auth) to their `.npmrc`, then
     `npm i @necatikcl/stripes-shader pixi.js react react-dom` and `<StripesShader src=… config={…} />`.
```

- [ ] **Step 4: Gate + commit (NO publish)**

Run: `pir verify && pir code-check` (both green).

```bash
git add packages/stripes-shader/package.json packages/stripes-shader/PUBLISHING.md
git commit -m "Phase 3: package.json publish config (GitHub Packages) + packing docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 Done — Definition

- The published surface is curated (`public.ts` → `dist`), with `.d.ts` that excludes internals.
- The font is bundled + auto-registers via `FontFace` on `<StripesShader>` mount (zero consumer setup).
- `pir --filter @necatikcl/stripes-shader build` emits `dist/{index.js,index.d.ts,font asset}`; react/react-dom/pixi.js are externalized peers.
- `pnpm pack` yields a tarball with `dist` + a publish-shaped `package.json`; `npm pack` contents verified.
- The studio still consumes the package as source, unchanged; `pir verify` + `pir code-check` green.
- A `PUBLISHING.md` documents the user-run publish. **Nothing is published.** Committed locally; nothing pushed.

## Risks & Watch-Items

1. **Release-age gate on `vite-plugin-dts`** — `pi` blocks <7-day-old versions; pin an older satisfying one. Same for `vite`/`@vitejs/plugin-react` if not already resolvable.
2. **`.otf` asset import resolution** — under vitest (source) + the lib build (dist). The `*.otf` ambient decl + Vite's asset pipeline should handle both; if vitest can't resolve it, the error names the fix (asset stub/inline). The lib build emits it to `dist`.
3. **dts rollup of a React+Pixi component** — `vite-plugin-dts` with `rollupTypes: true` must resolve the peer types (react/pixi). If rollup chokes, drop `rollupTypes` (emit per-file `.d.ts`) and point `types` at `dist/public.d.ts`. Keep the externals as `react`/`pixi.js` (consumer resolves peer types).
4. **`publishConfig` exports swap** — confirm `pnpm pack`'s `package.json` has `main`/`exports` → `dist` (pnpm applies `publishConfig` on pack/publish). If a consumer would still see `src`, the swap didn't apply — fix the `publishConfig` shape.
5. **Studio must stay source-consuming** — after all package.json changes, re-run `pir verify` to confirm the studio still resolves `@necatikcl/stripes-shader` to `src/index.ts` (the dev `exports`), not `dist`.
6. **Font licensing** — the bundled `BerkeleyMonoTrial-Regular.otf` is the TRIAL; `PUBLISHING.md` reminds the user to swap the licensed file before a real release.

## Self-Review (done while writing)

- **Spec coverage:** implements the spec's Phase 3 (lib build, exports/peerDeps, dts, GitHub Packages, self-bundle+auto-register font) + the carry-forward barrel curation.
- **No studio churn:** the `public.ts` + `publishConfig` approach curates the PUBLISHED surface without slimming `index.ts` or repointing the studio — the studio keeps consuming source. This is the key design choice that keeps each task green.
- **Publish is gated to the user:** the plan builds + packs + documents, and explicitly stops before `pnpm publish` (outward-facing, needs the user's auth).
- **Conditional steps** (dts rollup fallback, asset resolution, release-age pinning) are written as "try X; if it fails, do Y."

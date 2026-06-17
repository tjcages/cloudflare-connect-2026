# Phase 2a — Move the Render Core into `packages/stripes-shader/` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Relocate the 43-file live render core out of `apps/studio/src/` into `packages/stripes-shader/src/`, make the studio consume it via `workspace:*`, and keep the studio rendering/testing/building identically. NO behavior or API change — `createTextureSceneTicker` keeps its current signature; this is a pure relocation + import-repoint.

**Architecture:** The render core (traced from `setupTextureShaderScene.ts`) imports only `pixi.js` + `react` and is reachable from both the scene and the studio's UI/persistence/SVG-export. Move all 43 files **flat** into `packages/stripes-shader/src/` (flat preserves sibling `./x` imports among them), fix only the handful of relative imports to the 5 relocated shared leaves, expose a barrel `index.ts`, and repoint every studio import of a moved module to `@necatikcl/stripes-shader`. The studio consumes the package's TypeScript **source** (no build step — Phase 3 adds the lib build); Vite/Vitest/tsc resolve the workspace-linked `.ts` directly.

**Tech Stack:** pnpm workspaces, Vite 8, Vitest 4, TypeScript 6, pixi.js 8, React 19.

## Global Constraints

- **Work on `main`, locally. NEVER push.** Commit locally per task.
- **`pi`/`pir` only** (script bodies may contain pnpm).
- **Do not start a dev server.** Visual checks: ask the user to use their running dev server.
- **Use `git mv` for all moves** (preserve history). Move files **flat** into `packages/stripes-shader/src/` — do NOT create subdirectories in 2a (subdir grouping is a later cosmetic step; flat keeps sibling `./x` imports valid).
- **Per-task gate: `pir verify` AND `pir code-check` both green.**
- **No API/behavior change.** `createTextureSceneTicker` keeps its exact signature; do not refactor it here (that's 2c). Config types keep their current names (`PlaygroundGridConfig` etc.; the rename to `StripesShaderConfig` is 2b).
- **Out of scope for 2a:** config-type unification (2b), the `getConfig`/`createStripesShaderScene` refactor + `<StripesShader>` (2c), deleting the export tree (2d). The `apps/studio/src/lib/export/**` tree and `grid/clipboard.ts`/`stripeGridToSvg.ts` (SVG export) stay where they are; they just repoint their imports of moved modules to the package.
- **Package scope:** `@necatikcl/stripes-shader`.

## The 43 core files to move (flat → `packages/stripes-shader/src/`)

**From `apps/studio/src/playground/` (38):** `setupTextureShaderScene.ts`, `samplePlaygroundFrame.ts`, `computeBlockGrid.ts`, `resampleBlockGrid.ts`, `stabilizeBlockGrid.ts`, `playgroundGridDirty.ts`, `blockGridTexture.ts`, `stripeDuotoneFilter.ts`, `stripeFilterShaders.ts`, `sourceTextureFilter.ts`, `stripeIndexLutTexture.ts`, `stripePaletteTexture.ts`, `stripeLetterLayer.ts`, `stripeLetterFont.ts`, `stripeLetterPlacements.ts`, `playgroundLetterShuffle.ts`, `stripeLetterConstants.ts`, `stripeColors.ts`, `colorWhiteness.ts`, `playgroundVibrantColors.ts`, `playgroundGridConfig.ts`, `playgroundSourceTransform.ts`, `playgroundTextureAdjustments.ts`, `playgroundSparkle.ts`, `playgroundWidthShuffle.ts`, `playgroundFlames.ts`, `playgroundFlamesConfig.ts`, `playgroundFlameComposite.ts`, `playgroundRevealConfig.ts`, `playgroundReveal.ts`, `playgroundCursorTrailConfig.ts`, `playgroundClickWaveConfig.ts`, `cursorTrail.ts`, `clickWave.ts`, `cursorTrailOverlay.ts`, `stripeGridConstants.ts`, `playgroundPerfProfile.ts`, plus their co-located `*.test.ts` files.

**5 shared leaves (relocate + rename to avoid the `components/`/`theme/`/`fonts/`/`grid/` paths):**
- `apps/studio/src/components/pixi/index.tsx` → `packages/stripes-shader/src/pixiMount.tsx`
- `apps/studio/src/components/pixi/utils.ts` → `packages/stripes-shader/src/pixiUtils.ts`
- `apps/studio/src/theme/colorSpace.ts` (+ `.test.ts`) → `packages/stripes-shader/src/colorSpace.ts`
- `apps/studio/src/fonts/codeSnippet.ts` → `packages/stripes-shader/src/codeSnippet.ts`
- `apps/studio/src/grid/prng.ts` → `packages/stripes-shader/src/prng.ts`

(After the move, `apps/studio/src/components/pixi/`, `apps/studio/src/theme/`, and `apps/studio/src/fonts/` directories are empty except files used elsewhere — `theme/accents.ts` stays for `colorSpace.test`? NO: `colorSpace.test.ts` moves with `colorSpace.ts`; `theme/accents.ts` is imported by the moved `colorSpace.test.ts`, so `accents.ts` ALSO moves → `packages/stripes-shader/src/accents.ts`. `grid/clipboard.ts`/`clipboard.test.ts` stay in studio. `fonts/` becomes empty → remove. Verify each leftover dir.)

## Studio files that import a moved module and must repoint to `@necatikcl/stripes-shader`

(Exact set is discovered by grep in Task 2; known import sites from the map): `TexturePlayground.tsx`, `playgroundLevaSchema.ts`, `playgroundLevaControls.tsx`, `playgroundPersistence.ts`, `stripeGridToSvg.ts`, `StripeColorsTable.tsx`, `stripeColorsTablePlugin.tsx`, `canvasBackgroundCss.ts`, `playgroundColorSpace.ts`, `playgroundTextures.ts`, `playgroundUi.ts`, `playgroundLiveRefs.ts`, and the export tree `apps/studio/src/lib/export/**` (it imports `playgroundPersistence`/`playgroundSparkle` which stay, and may import moved config modules — repoint those too) + `apps/studio/src/lib/export/playgroundSnapshot.ts`.

---

### Task 1: Stand up the package — move the 43 files + barrel + package wiring

**Files:**
- Move (git mv): the 43 core files (+ their tests, + `theme/accents.ts`) flat into `packages/stripes-shader/src/`
- Create: `packages/stripes-shader/src/index.ts` (barrel)
- Modify: `packages/stripes-shader/package.json`, `packages/stripes-shader/tsconfig.json`, `packages/stripes-shader/src/index.ts` (replace the `export {}` placeholder)

- [ ] **Step 1: Move the playground render modules (+ tests) flat into the package**

```bash
cd /Users/necatikcl/Documents/code/cloudflare/section-grid-generator
PKG=packages/stripes-shader/src
mkdir -p "$PKG"
for f in setupTextureShaderScene samplePlaygroundFrame computeBlockGrid resampleBlockGrid \
  stabilizeBlockGrid playgroundGridDirty blockGridTexture stripeDuotoneFilter stripeFilterShaders \
  sourceTextureFilter stripeIndexLutTexture stripePaletteTexture stripeLetterLayer stripeLetterFont \
  stripeLetterPlacements playgroundLetterShuffle stripeLetterConstants stripeColors colorWhiteness \
  playgroundVibrantColors playgroundGridConfig playgroundSourceTransform playgroundTextureAdjustments \
  playgroundSparkle playgroundWidthShuffle playgroundFlames playgroundFlamesConfig playgroundFlameComposite \
  playgroundRevealConfig playgroundReveal playgroundCursorTrailConfig playgroundClickWaveConfig \
  cursorTrail clickWave cursorTrailOverlay stripeGridConstants playgroundPerfProfile; do
  for ext in ts tsx test.ts test.tsx; do
    [ -f "apps/studio/src/playground/$f.$ext" ] && git mv "apps/studio/src/playground/$f.$ext" "$PKG/$f.$ext"
  done
done
```
(The inner loop moves whichever extensions exist; missing ones are skipped. Run it; then `ls "$PKG"` and confirm ~38 modules + their tests landed.)

- [ ] **Step 2: Move the 5 shared leaves (+ accents) with renames**

```bash
PKG=packages/stripes-shader/src
git mv apps/studio/src/components/pixi/index.tsx "$PKG/pixiMount.tsx"
git mv apps/studio/src/components/pixi/utils.ts "$PKG/pixiUtils.ts"
git mv apps/studio/src/theme/colorSpace.ts "$PKG/colorSpace.ts"
git mv apps/studio/src/theme/colorSpace.test.ts "$PKG/colorSpace.test.ts"
git mv apps/studio/src/theme/accents.ts "$PKG/accents.ts"
git mv apps/studio/src/fonts/codeSnippet.ts "$PKG/codeSnippet.ts"
git mv apps/studio/src/grid/prng.ts "$PKG/prng.ts"
```
Then confirm now-empty dirs and remove them if empty: `apps/studio/src/components/pixi/`, `apps/studio/src/theme/`, `apps/studio/src/fonts/`. (Check first: `ls apps/studio/src/components/pixi apps/studio/src/theme apps/studio/src/fonts` — `components/` still has Button.tsx/HexColorPopover.tsx etc. and `grid/` still has clipboard.ts; only remove dirs that are fully empty.)

- [ ] **Step 3: Fix the relocated shared-leaf relative imports WITHIN the package**

Inside `packages/stripes-shader/src/`, the moved files referenced the leaves by their old paths. Fix only these (all now flat siblings):
```bash
cd packages/stripes-shader/src
# pixi mount/utils (was ../components/pixi, ../components/pixi/utils, ./utils, ./index)
rg -l "components/pixi" . | xargs sed -i '' -e 's#\.\./components/pixi/utils#./pixiUtils#g' -e 's#\.\./components/pixi#./pixiMount#g'
# pixiMount.tsx imported "./utils" originally -> ./pixiUtils
sed -i '' -e 's#from "\./utils"#from "./pixiUtils"#g' pixiMount.tsx
# colorSpace (was ../theme/colorSpace)
rg -l "theme/colorSpace" . | xargs sed -i '' -e 's#\.\./theme/colorSpace#./colorSpace#g'
# colorSpace.test imported ../theme/accents -> ./accents (now sibling); and ./colorSpace stays
rg -l "theme/accents" . | xargs sed -i '' -e 's#\.\./theme/accents#./accents#g'
# codeSnippet (was ../fonts/codeSnippet)
rg -l "fonts/codeSnippet" . | xargs sed -i '' -e 's#\.\./fonts/codeSnippet#./codeSnippet#g'
# prng (was ../grid/prng)
rg -l "grid/prng" . | xargs sed -i '' -e 's#\.\./grid/prng#./prng#g'
```
Then grep to confirm no `../components`, `../theme`, `../fonts`, `../grid`, `../lib` remain inside the package:
```bash
rg -n "from \"\.\./(components|theme|fonts|grid|lib)" packages/stripes-shader/src && echo "STILL HAS CROSS REFS — fix" || echo "clean: no cross-package relative imports remain"
```
Expected: "clean". (If any remain — e.g. a moved file importing a studio-only module — STOP and report; that file may not actually belong in the core.)

- [ ] **Step 4: Write the barrel `packages/stripes-shader/src/index.ts`**

Replace the `export {}` placeholder with re-exports of every module the studio (and the future component) imports. Use namespace-free `export *` per module; if `pir typecheck` later reports a duplicate-export collision, switch that pair to explicit named re-exports.

```ts
// Render core public surface (2a: relocated as-is; 2b/2c refine into config/ + <StripesShader>).
export * from "./setupTextureShaderScene";
export * from "./samplePlaygroundFrame";
export * from "./computeBlockGrid";
export * from "./resampleBlockGrid";
export * from "./stabilizeBlockGrid";
export * from "./playgroundGridDirty";
export * from "./blockGridTexture";
export * from "./stripeDuotoneFilter";
export * from "./stripeFilterShaders";
export * from "./sourceTextureFilter";
export * from "./stripeIndexLutTexture";
export * from "./stripePaletteTexture";
export * from "./stripeLetterLayer";
export * from "./stripeLetterFont";
export * from "./stripeLetterPlacements";
export * from "./playgroundLetterShuffle";
export * from "./stripeLetterConstants";
export * from "./stripeColors";
export * from "./colorWhiteness";
export * from "./playgroundVibrantColors";
export * from "./playgroundGridConfig";
export * from "./playgroundSourceTransform";
export * from "./playgroundTextureAdjustments";
export * from "./playgroundSparkle";
export * from "./playgroundWidthShuffle";
export * from "./playgroundFlames";
export * from "./playgroundFlamesConfig";
export * from "./playgroundFlameComposite";
export * from "./playgroundRevealConfig";
export * from "./playgroundReveal";
export * from "./playgroundCursorTrailConfig";
export * from "./playgroundClickWaveConfig";
export * from "./cursorTrail";
export * from "./clickWave";
export * from "./cursorTrailOverlay";
export * from "./stripeGridConstants";
export * from "./playgroundPerfProfile";
export * from "./colorSpace";
export * from "./codeSnippet";
export * from "./prng";
export { default as Pixi } from "./pixiMount";
export * from "./pixiMount";
export * from "./pixiUtils";
```

- [ ] **Step 5: Set the package `package.json` + `tsconfig.json` for source consumption**

`packages/stripes-shader/package.json` — point `main`/`types` at the barrel, declare peer deps, drop `private` to allow workspace linking (publishing is Phase 3):
```json
{
  "name": "@necatikcl/stripes-shader",
  "version": "0.0.0",
  "type": "module",
  "description": "Render-only Stripes Shader core (relocated in Phase 2a; public API finalized in 2c/3).",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "peerDependencies": {
    "pixi.js": "^8.18.1",
    "react": "^19.0.5",
    "react-dom": "^19.0.5"
  },
  "devDependencies": {
    "pixi.js": "^8.18.1",
    "react": "^19.0.5",
    "react-dom": "^19.0.5",
    "@types/react": "^19.2.14"
  }
}
```

`packages/stripes-shader/tsconfig.json` — keep the standalone leaf config but ensure it includes `src` and uses the same strictness as the studio:
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
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "useDefineForClassFields": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Commit the package (it won't typecheck-green until Task 2 repoints the studio, so gate lightly here)**

Run: `pir --filter @necatikcl/stripes-shader exec tsc -b --noEmit 2>&1 | tail -20 || true` — to surface any intra-package type errors (missing imports from the leaf renames). Fix any that are purely internal to the package. (The studio will not build until Task 2; that's expected — do NOT run the full `pir verify` yet.)

```bash
git add -A
git commit -m "Phase 2a: relocate the render core into packages/stripes-shader (files + barrel)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Repoint studio imports to the package + link it; restore green

**Files:**
- Modify: `apps/studio/package.json` (add the workspace dep), and every studio file importing a moved module
- Possibly: `apps/studio/vite.config.ts` / root tooling for workspace-TS resolution

- [ ] **Step 1: Add the package as a studio dependency**

In `apps/studio/package.json` `dependencies`, add:
```json
"@necatikcl/stripes-shader": "workspace:*",
```
Then run `pi` to link it.

- [ ] **Step 2: Find every studio import of a moved module**

Run (the moved bare module names + the renamed leaves):
```bash
cd /Users/necatikcl/Documents/code/cloudflare/section-grid-generator
rg -n "from \"\.{1,2}/(setupTextureShaderScene|samplePlaygroundFrame|computeBlockGrid|resampleBlockGrid|stabilizeBlockGrid|playgroundGridDirty|blockGridTexture|stripeDuotoneFilter|stripeFilterShaders|sourceTextureFilter|stripeIndexLutTexture|stripePaletteTexture|stripeLetterLayer|stripeLetterFont|stripeLetterPlacements|playgroundLetterShuffle|stripeLetterConstants|stripeColors|colorWhiteness|playgroundVibrantColors|playgroundGridConfig|playgroundSourceTransform|playgroundTextureAdjustments|playgroundSparkle|playgroundWidthShuffle|playgroundFlames|playgroundFlamesConfig|playgroundFlameComposite|playgroundRevealConfig|playgroundReveal|playgroundCursorTrailConfig|playgroundClickWaveConfig|cursorTrail|clickWave|cursorTrailOverlay|stripeGridConstants|playgroundPerfProfile)\"" apps/studio/src
rg -n "components/pixi|theme/colorSpace|theme/accents|fonts/codeSnippet|grid/prng" apps/studio/src
```
This is the exact repoint surface. Record it.

- [ ] **Step 3: Repoint each import to `@necatikcl/stripes-shader`**

For every match, replace the relative import with a barrel import. Mechanically, collapse each `import { X } from "./stripeColors"` (and `../playground/stripeColors`, etc.) to `import { X } from "@necatikcl/stripes-shader"`. Consolidate multiple barrel imports in a file into one statement. The renamed leaves repoint too: `from "../components/pixi"` → `from "@necatikcl/stripes-shader"` (use the exported `Pixi`), `from "../theme/colorSpace"` → `from "@necatikcl/stripes-shader"`, `from "../fonts/codeSnippet"` → `from "@necatikcl/stripes-shader"`, `from "../grid/prng"` → `from "@necatikcl/stripes-shader"`. Apply across all files found in Step 2 (TexturePlayground, leva schema/controls, persistence, stripeGridToSvg, StripeColorsTable + plugin, canvasBackgroundCss, playgroundColorSpace, playgroundTextures, playgroundUi, playgroundLiveRefs, and the `lib/export/**` files importing moved modules).

- [ ] **Step 4: Resolve workspace-TS consumption (vite/vitest/tsc)**

Run `pir --filter studio exec tsc -b --noEmit 2>&1 | tail -30`. Then `pir build:client` (via filter) and `pir test` (filter). If any of these fail to resolve `@necatikcl/stripes-shader`'s TS source:
- **Vite/Vitest:** workspace-linked `.ts` usually resolves, but if Vite externalizes it or fails to transpile, add to `apps/studio/vite.config.ts`: `resolve: { dedupe: ["pixi.js", "react", "react-dom"] }` and, if needed, `ssr: { noExternal: ["@necatikcl/stripes-shader"] }` / `optimizeDeps: { include: ["@necatikcl/stripes-shader"] }`. Apply the minimal fix the error indicates.
- **tsc:** with `moduleResolution: bundler` + the package `types: ./src/index.ts`, tsc resolves the workspace symlink. If it cannot, add a path alias in `apps/studio/tsconfig.app.json` `compilerOptions.paths`: `{"@necatikcl/stripes-shader": ["../../packages/stripes-shader/src/index.ts"]}` with `baseUrl: "."`.
Record exactly which (if any) resolution fix was needed.

- [ ] **Step 5: Full gate**

Run: `pir verify && pir code-check`
Expected: BOTH green. The studio renders/tests/builds identically — same render code, now imported from the package. (Tests for moved modules now live in the package and run under the studio's vitest? See Task 3 — if vitest only globs `apps/studio`, the moved tests won't run yet. For THIS step, confirm the studio's own tests pass; the moved-test wiring is Task 3.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Phase 2a: repoint studio imports to @necatikcl/stripes-shader; link workspace dep

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Run the moved tests under the workspace (vitest projects)

The ~20 render-module test files moved into the package. Ensure they execute (they currently may be outside the studio's vitest root).

**Files:**
- Create: `vitest.workspace.ts` (root) OR `packages/stripes-shader/vitest.config.ts` + root script
- Modify: root `package.json` test script if needed

- [ ] **Step 1: Determine whether the moved tests run**

Run: `pir test 2>&1 | tail -20` and check the test-file count (was 48 studio files; the moved ~20 should now show under the package, or be MISSING). If the count dropped by ~20 (moved tests not running), wire them in.

- [ ] **Step 2: Add a Vitest workspace so both packages' tests run**

Create root `vitest.workspace.ts`:
```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "apps/studio/vite.config.ts",
  "packages/stripes-shader/vitest.config.ts",
]);
```
Create `packages/stripes-shader/vitest.config.ts` mirroring the studio's node/happy-dom split for these pure-logic + GPU tests:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    pool: "threads",
    globals: true,
    // @ts-expect-error Vitest-only option valid at runtime.
    environmentMatchGlobs: [["src/**/*.test.ts", "node"]],
  },
});
```
Update the root `test` script (and `verify` delegation) so `pir test` runs the workspace (e.g. root `"test": "vitest run"` at the repo root, since `vitest.workspace.ts` makes vitest cover both). Re-point root `verify` to run the workspace test + both typechecks + the studio build, e.g. root scripts: `"test": "vitest run"`, `"verify": "pnpm run test && pnpm run typecheck && pnpm --filter studio build:client"`, `"typecheck": "pnpm -r --filter ./apps/* --filter ./packages/* exec tsc -b"` (or `pnpm -r typecheck` once the package has a `typecheck` script). Choose the form that runs both projects' tests + typechecks; verify it does.

- [ ] **Step 3: Confirm all tests run + green**

Run: `pir verify && pir code-check`
Expected: total test-file count ≈ original (studio + moved package tests all run), all green; both typechecks clean; build green. Confirm the moved tests (e.g. `computeBlockGrid.test`, `cursorTrail.test`, `stripeColors.test`, `colorSpace.test`) appear in the run output.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Phase 2a: run the relocated render-core tests via a vitest workspace

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2a Done — Definition

- The 43 render-core files live in `packages/stripes-shader/src/` (flat); the barrel `index.ts` exports them.
- The studio depends on `@necatikcl/stripes-shader` (`workspace:*`) and imports all render modules from it; no studio file imports a relocated module by relative path.
- `createTextureSceneTicker` is unchanged (signature + behavior); the studio renders identically.
- All tests (studio + relocated) run via a vitest workspace and are green; `pir verify` + `pir code-check` green.
- Committed locally; nothing pushed.

## Risks & Watch-Items

1. **Workspace-TS resolution** (Task 2 Step 4) — the likeliest snag: Vite/Vitest/tsc consuming the package's raw `.ts`. The plan gives the minimal fixes (`ssr.noExternal`/`optimizeDeps`/tsconfig `paths`). If a build step turns out cleaner, that's Phase 3's job — for 2a, prefer source consumption.
2. **`export *` collisions** in the barrel — two modules exporting the same name (e.g. a shared constant). `tsc` reports it; switch the colliding pair to explicit named re-exports.
3. **A "core" file that secretly imports a studio-only module** — Task 1 Step 3's grep guards this. If found, that file isn't pure core; STOP and report (it may need a split, which is 2b/2c territory).
4. **`theme/accents.ts` moved only because `colorSpace.test.ts` imports it** — confirm nothing else in the studio still imports `theme/accents` after the move (grep); if something does, repoint it to the package barrel too.
5. **`stripeColors.ts` ↔ `playgroundColorSpace.ts`** — `playgroundColorSpace.ts` (studio-only, WebGL context setup) imports `colorSpace`; after the move it repoints to the barrel. Confirm it does NOT get dragged into the package (it stays studio — it's not in the core closure).
6. **oxlint grid Math.random override** — `prng.ts` moved to `packages/stripes-shader/src/prng.ts`; the override glob `**/src/grid/**/*.ts` no longer covers it. If the ban should still apply to the relocated prng, update the override to `**/src/prng.ts` or `**/stripes-shader/src/prng.ts`. Confirm `pir code-check` behavior and adjust if the guard matters.

## Self-Review (done while writing)

- **Spec coverage:** implements the relocation half of the spec's "Phase 2 — Extract the core". Config unification, the `getConfig` refactor + `<StripesShader>`, and the export deletion are explicitly deferred to 2b/2c/2d (their own plans).
- **Green-able intermediate:** 2a is a pure relocation — same render code, same `createTextureSceneTicker` signature — so "renders identically" is the verifiable bar; no behavior changes to reason about.
- **Move strategy:** flat move preserves sibling imports; only the 5 leaf renames need import fixes (Step 3) + the studio repoint (Task 2). The grep guards (Task 1 Step 3, Task 2 Step 2) make the surface explicit rather than guessed.
- **Conditional steps** (workspace-TS resolution, `export *` collisions, oxlint glob) are written as "check, then apply this specific fix," because they depend on tool behavior observed at runtime.

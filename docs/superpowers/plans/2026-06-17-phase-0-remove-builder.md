# Phase 0 — Remove Builder, Collapse to a Single App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the legacy "Section Grid Builder" app and make the Texture Shader Playground the repo's only app, served at `/`, with everything still building and testing green.

**Architecture:** The two apps are already decoupled — the playground never imports builder code, and the only shared modules are 7 leaf files. So Phase 0 is: (1) flip the entry point to the playground, then (2) delete the builder closure in one atomic commit (the builder files are mutually referential, so a partial delete would dangle imports), then (3) prune now-stale config, dead files, and docs. No new behavior; the test is regression-green.

**Tech Stack:** Vite 8, React 19, TypeScript 6, Vitest 4 (happy-dom + threads pool), oxlint/oxfmt, pnpm workspace (via `pi`), Cloudflare Wrangler.

## Global Constraints

- **Work directly on `main`, locally. NEVER push.** Commit locally per task. (User preference: no feature branches/worktrees.)
- **Package manager is `pi`** — never `pnpm`/`npm`/`npx`. Run scripts with `pir <script>` (= `pi run <script>`). Install with `pi`.
- **Do not start a dev server.** The user runs their own. For visual checks, ask the user to look at their running dev server (`pir dev` serves the playground at `/` after Task 1).
- **Per-task gate is `pir verify`** (= `vitest run` + `tsc -b` + `vite build`). A task is done only when `pir verify` is green.
- **This is over-delete-unsafe, under-delete-safe.** Leftover builder files are harmless dead code; `tsc -b` only fails if a _kept_ file loses a dependency. The kept set is verified-closed against builder modules, so never delete a kept file (see KEEP SET below).
- **KEEP SET (never delete in Phase 0):** `src/playground/**`, `src/lib/export/**`, `src/lib/cn.ts`, `src/components/Button.tsx`, `src/components/HexColorPopover.tsx` (+ `.test.tsx`), `src/components/pixi/**`, `src/theme/colorSpace.ts` (+ `.test.ts`), `src/grid/prng.ts`, `src/grid/clipboard.ts` (+ `.test.ts`), `src/fonts/codeSnippet.ts`, `src/styles/global.css`, `src/test/**`, `src/vite-env.d.ts`.
- **Out of scope for Phase 0:** the monorepo restructure (Phase 1), the core extraction (Phase 2), the package (Phase 3), and `src/lib/export/**` removal (Phase 2). `.cursor/rules/*.mdc` are now partly stale but are NOT rewritten here (deferred to the restructure).

---

### Task 1: Flip the entry point to the playground

Make the playground the single Vite entry served at `/`. After this task, all builder source still exists but is unreferenced by any entry — so the repo still builds and typechecks.

**Files:**

- Delete: `index.html`, `src/main.tsx`, `src/devExposeBuilderStorage.ts`
- Rename: `playground.html` → `index.html`
- Modify: `vite.config.ts`, `src/vite-env.d.ts`, `package.json`

- [ ] **Step 1: Confirm the dev-global is referenced only by files we're deleting**

Run: `rg -n "__SECTION_GRID_BUILDER_DEV__" src`
Expected: matches only in `src/main.tsx` and `src/vite-env.d.ts` (both edited/deleted in this task). No other source file.

- [ ] **Step 2: Delete the builder entry + dev shim, rename the playground HTML to root**

```bash
git rm src/main.tsx src/devExposeBuilderStorage.ts index.html
git mv playground.html index.html
```

- [ ] **Step 3: Rewrite `vite.config.ts` to a single-entry app config**

Replace the entire file with (drops the dual-entry `rollupOptions.input`, the `playgroundPathRedirect` middleware, and the now-unused `node:path`/`node:url` imports; keeps the `test` block and its `environmentMatchGlobs` untouched — those are pruned in Task 3):

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    environment: "happy-dom",
    /** `forks` (Vitest default) is much slower here with many jsdom/happy-dom workers; threads pool is ~order-of-magnitude faster for this suite. */
    pool: "threads",
    globals: true,
    setupFiles: ["./src/test/setupLocalStorage.ts", "./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "dist/**", ".worktrees/**"],
    // @ts-expect-error Vitest-only option valid at runtime; Vite `InlineConfig` typings omit it under `tsc -b`.
    environmentMatchGlobs: [
      ["src/grid/**/*.test.ts", "node"],
      ["src/lib/**/*.test.ts", "node"],
      ["src/theme/**/*.test.ts", "node"],
      ["src/store*.test.ts", "node"],
      ["src/canvas/hitTest.test.ts", "node"],
      ["src/canvas/scrollAroundEdges.test.ts", "node"],
      ["src/canvas/selection-setup.test.ts", "node"],
      ["src/canvas/components/connector-line/**/*.test.ts", "node"],
    ],
  },
});
```

- [ ] **Step 4: Remove the dead `Window` global from `src/vite-env.d.ts`**

Replace the entire file with (keeps the `*?raw` ambient module that `src/lib/export/**` relies on; drops the builder `declare global` block):

```ts
/// <reference types="vite/client" />

declare module "*?raw" {
  const content: string;
  export default content;
}
```

- [ ] **Step 5: Drop the `dev:playground` script from `package.json`**

Remove this line from the `scripts` block:

```json
    "dev:playground": "vite --port 5175 --strictPort --open /playground.html",
```

(`"dev": "vite"` stays and now serves the playground at `/`.)

- [ ] **Step 6: Verify green**

Run: `pir verify`
Expected: PASS — `vitest run` all green, `tsc -b` clean, `vite build` emits `dist/index.html` (the playground). The builder source still compiles but is no longer an entry.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Phase 0: make the playground the sole entry at /"
```

---

### Task 2: Delete the builder closure (atomic)

Remove every builder-only and orphan file in one commit. They are mutually referential, so this must be a single delete — a partial one would leave dangling imports. The KEEP SET (Global Constraints) is preserved.

**Files:**

- Delete: `src/app/`, `src/canvas/`, `src/store/`, `src/presets/`, `src/types/`, `src/lib/icon-box/`, `src/lib/code-snippet/` (whole dirs)
- Delete: builder state, grid, theme, fonts, lib, and component files (explicit list below)

- [ ] **Step 1: Remove whole builder directories**

```bash
git rm -r src/app src/canvas src/store src/presets src/types src/lib/icon-box src/lib/code-snippet
```

- [ ] **Step 2: Remove builder state files**

```bash
git rm src/store.ts src/store.connector.test.ts src/store.history.test.ts \
       src/store.reorder.test.ts src/storePersist.ts src/storePersist.test.ts
```

- [ ] **Step 3: Remove builder grid files (KEEP `prng.ts`, `clipboard.ts`, `clipboard.test.ts`)**

```bash
git rm src/grid/cellAttachment.ts \
       src/grid/config.ts src/grid/config.test.ts \
       src/grid/generateGridAsync.ts src/grid/generateGridAsync.test.ts \
       src/grid/generator.ts src/grid/generator.test.ts src/grid/generatorWorker.ts \
       src/grid/largeExposure.ts src/grid/largeExposure.test.ts \
       src/grid/mask.ts src/grid/mask.test.ts \
       src/grid/renderer.tsx src/grid/renderer.test.ts \
       src/grid/types.ts src/grid/validate.ts
```

- [ ] **Step 4: Remove builder theme + fonts (KEEP `theme/colorSpace.ts`, `fonts/codeSnippet.ts`)**

```bash
git rm src/theme/palette.ts src/theme/palette.test.ts src/theme/accents.ts src/fonts/iconBoxTitle.ts
```

- [ ] **Step 5: Remove builder lib files (KEEP `lib/cn.ts` and all of `lib/export/`)**

```bash
git rm src/lib/builderShareLink.ts src/lib/builderShareLink.test.ts \
       src/lib/componentRegistry.ts src/lib/componentRegistry.test.ts \
       src/lib/documentSnapshot.ts src/lib/documentSnapshot.test.ts \
       src/lib/iconBoxEnabledByLine.ts src/lib/iconBoxEnabledByLine.test.ts \
       src/lib/iconBoxOutgoingPulseGate.ts src/lib/iconBoxOutgoingPulseGate.test.ts \
       src/lib/iconDropShadow.ts src/lib/iconDropShadow.test.ts \
       src/lib/iconRegistry.ts src/lib/iconRegistry.test.ts \
       src/lib/isInteractiveListChromeTarget.ts
```

- [ ] **Step 6: Remove builder components (KEEP `Button.tsx`, `HexColorPopover.tsx` + its test, `pixi/`)**

```bash
git rm src/components/BuilderField.tsx src/components/BuilderFieldHeaderRow.tsx \
       src/components/BuilderSelectField.tsx src/components/BuilderTextField.tsx \
       src/components/BuilderTextareaField.tsx \
       src/components/CanvasViewportToolbar.tsx src/components/CanvasViewportToolbar.test.tsx \
       src/components/CodeSnippetCodeField.tsx src/components/ComponentDragGhost.tsx \
       src/components/ComponentIcon.tsx src/components/ComponentIcon.test.tsx \
       src/components/ComponentListItem.tsx \
       src/components/ComponentSidebar.tsx src/components/ComponentSidebar.test.tsx \
       src/components/ConfigDebugDisclosure.tsx src/components/ConfigDebugDisclosure.test.tsx \
       src/components/ConfigSeparator.tsx src/components/ConnectorEndpointControls.tsx \
       src/components/FieldToggle.tsx \
       src/components/GapMaskEditor.tsx src/components/GapMaskEditor.test.tsx \
       src/components/GridCanvas.tsx \
       src/components/IconBoxLayoutFields.tsx src/components/IconBoxLayoutFields.test.tsx \
       src/components/IconPickerField.tsx src/components/LayerConfigPanel.tsx \
       src/components/PaletteThemePicker.tsx src/components/PlusMarkerGlyph.tsx \
       src/components/PresetsSidebar.tsx src/components/RailTab.tsx \
       src/components/RatioControl.tsx src/components/RectMarkerGlyph.tsx \
       src/components/SectionHeading.tsx \
       src/components/ShareSidebar.tsx src/components/ShareSidebar.test.tsx \
       src/components/Sidebar.tsx src/components/Sidebar.test.tsx \
       src/components/ThemeField.tsx src/components/iconTokens.ts \
       src/components/sidebarPreview.tsx src/components/useScrollbarThumbFlash.ts
```

- [ ] **Step 7: Confirm the KEEP SET survived**

Run:

```bash
ls src/components/Button.tsx src/components/HexColorPopover.tsx src/components/pixi/index.tsx \
   src/lib/cn.ts src/theme/colorSpace.ts src/grid/prng.ts src/grid/clipboard.ts \
   src/fonts/codeSnippet.ts && ls -d src/lib/export src/playground
```

Expected: every path lists without error.

- [ ] **Step 8: Confirm no remaining file imports a deleted module**

Run: `pir typecheck`
Expected: PASS (clean `tsc -b`). If it fails with a missing-module error, a kept file depended on something deleted — restore that specific dependency and re-run.

- [ ] **Step 9: Verify green (full)**

Run: `pir verify`
Expected: PASS — all remaining tests (playground + export + the kept grid/theme/component tests) green, typecheck clean, build emits the playground.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Phase 0: delete the legacy Section Grid Builder app"
```

---

### Task 3: Prune stale test globs and lint overrides

Remove config entries that name files deleted in Task 2, so the config matches reality and `code-check` stays clean.

**Files:**

- Modify: `vite.config.ts` (`environmentMatchGlobs`), `.oxlintrc.json` (`overrides`)

- [ ] **Step 1: Drop the dead `environmentMatchGlobs` entries in `vite.config.ts`**

In the `test.environmentMatchGlobs` array, delete the five entries that reference now-deleted store/canvas test files. The array becomes exactly:

```ts
    environmentMatchGlobs: [
      ["src/grid/**/*.test.ts", "node"],
      ["src/lib/**/*.test.ts", "node"],
      ["src/theme/**/*.test.ts", "node"],
    ],
```

(These three survive: `grid/clipboard.test.ts`, `lib/export/**` tests, `theme/colorSpace.test.ts` run in the `node` environment.)

- [ ] **Step 2: Remove the `generatorWorker` lint override in `.oxlintrc.json`**

Delete this object from the `overrides` array (its file was deleted in Task 2):

```json
{
  "files": ["src/grid/generatorWorker.ts"],
  "rules": {
    "typescript/no-useless-empty-export": "off"
  }
}
```

Keep the `src/grid/**/*.ts` Math.random ban (covers the surviving `grid/prng.ts`) and the `src/grid/clipboard.ts` override (file survives).

- [ ] **Step 3: Verify lint/format and full gate are green**

Run: `pir code-check && pir verify`
Expected: both PASS (oxlint clean, oxfmt clean, tests/typecheck/build green).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts .oxlintrc.json
git commit -m "Phase 0: prune test globs and lint overrides for deleted builder files"
```

---

### Task 4: Delete playground-folder dead files

Remove the deprecated/unreferenced files that live under `src/playground/` (verified to have no non-test importers). These import only kept code, so they can go after the builder.

**Files:**

- Delete: `src/playground/VideoPlayground.tsx`, `setupVideoShaderScene.ts`, `playgroundVideos.ts`, `controlValueParsing.ts` (+ `controlValueParsing.test.ts`), `FieldHelp.tsx` (+ `FieldHelp.test.tsx`)

- [ ] **Step 1: Re-confirm each target has no live importer**

Run:

```bash
rg -n "VideoPlayground|setupVideoShaderScene|playgroundVideos|controlValueParsing|['\"]\./FieldHelp['\"]" src \
  --glob '!**/VideoPlayground.tsx' --glob '!**/setupVideoShaderScene.ts' \
  --glob '!**/playgroundVideos.ts' --glob '!**/controlValueParsing*' --glob '!**/FieldHelp*'
```

Expected: no matches (note: `playgroundFieldHelp.ts` is a _different_, kept file — the `['"]./FieldHelp['"]` pattern intentionally excludes it). If any match appears, do NOT delete that file; report it.

- [ ] **Step 2: Delete the dead files**

```bash
git rm src/playground/VideoPlayground.tsx src/playground/setupVideoShaderScene.ts \
       src/playground/playgroundVideos.ts \
       src/playground/controlValueParsing.ts src/playground/controlValueParsing.test.ts \
       src/playground/FieldHelp.tsx src/playground/FieldHelp.test.tsx
```

- [ ] **Step 3: Verify green**

Run: `pir verify`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Phase 0: remove deprecated playground dead files"
```

---

### Task 5: Refresh top-level docs to the single-app reality

Update the human/agent-facing docs that currently describe the deleted builder. Keep edits light — a deeper rewrite waits for the Phase 1 restructure.

**Files:**

- Modify: `README.md`, `AGENTS.md`, `docs/ai-context.md`

- [ ] **Step 1: Update `README.md` title + summary**

Replace the top of `README.md` (the title line and the first paragraph) with:

```markdown
# Stripes Shader

A React/TypeScript WebGL texture-shader playground (Pixi.js). It turns an image or
video into a stylized duotone stripe-grid texture with baked glyph letters and
animated effects (sparkle, flames, reveal, cursor trail, click wave), and supports
SVG/video export and a copyable config.

> The legacy "Section Grid Builder" app was removed; the playground is now the only
> app. A pnpm-workspace restructure (`packages/stripes-shader` + `apps/studio`) and an
> installable package are planned — see `docs/superpowers/specs/2026-06-17-stripes-shader-refactor-design.md`.
```

Leave the existing `## Scripts` and `## Project Context` sections, but in `## Scripts` delete the `pnpm dev:playground` mention if present and note that `pnpm dev` (run via `pir dev`) serves the playground at `/`.

- [ ] **Step 2: Update `AGENTS.md` Project Summary**

Replace the `## Project Summary` body with:

```markdown
This is a React + TypeScript WebGL texture-shader playground (Pixi.js). It renders a
duotone stripe-grid texture from an image/video, with baked letters and animated
effects, plus SVG/video export and a copyable config.

The legacy Section Grid Builder app was removed. A monorepo restructure and an
installable render package are planned — see
`docs/superpowers/specs/2026-06-17-stripes-shader-refactor-design.md`.

Read `docs/ai-context.md` before broad architecture work.
```

Leave the rest of `AGENTS.md` (Architecture Boundaries, Development Expectations, Verification, Safety). These reference builder internals that no longer exist; add a single line under `## Architecture Boundaries`:

```markdown
- NOTE: the builder modules below were removed in Phase 0; the live app is `src/playground/**` rendering via Pixi. This section is updated in the upcoming restructure.
```

- [ ] **Step 3: Update `docs/ai-context.md` "Current Product"**

Replace the `## Current Product` paragraph(s) with:

```markdown
## Current Product

The app is a WebGL texture-shader playground. It samples an image/video into per-cell
luminance, renders it as a duotone stripe grid with optional baked glyph letters, and
layers animated effects (sparkle gaps/width, background flames, reveal wipe-in, cursor
trail, click wave). Outputs: live canvas, SVG copy, and MP4/WebM video export, plus a
copyable config.

The legacy Section Grid Builder (canvas component builder) was removed in Phase 0. The
"Architecture Map" below still documents builder internals and is stale; it is rewritten
during the planned monorepo restructure. The live code is `src/playground/**`.
```

- [ ] **Step 4: Verify docs reference nothing broken**

Run: `pir verify`
Expected: PASS (docs don't affect the build, but confirm nothing regressed).

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md docs/ai-context.md
git commit -m "Phase 0: refresh docs to the single playground app"
```

---

## Phase 0 Done — Definition

- `index.html` is the playground; `pir dev` serves it at `/`; `pir build:client` emits `dist/index.html` (playground).
- No builder source remains (`src/app`, `src/canvas`, `src/store*`, `src/presets`, `src/types`, builder `components/lib/grid`, `theme/{palette,accents}`, `fonts/iconBoxTitle` all gone); the 7 shared leaves + `lib/export/**` + playground all survive.
- `pir verify` and `pir code-check` are green.
- Docs describe the single playground app.
- Everything is committed locally; nothing pushed.

## Self-Review (done while writing)

- **Spec coverage:** Implements the spec's "Phase 0 Deletion Set" and the Phase 0 bullet of "Sequencing." Defers `lib/export/**` removal to Phase 2 (per spec risk #4) and the restructure to Phase 1 — intentionally out of scope here.
- **Type/refactor consistency:** Deletion order verified — entry flipped first (Task 1) so builder source is unreferenced before deletion (Task 2); kept-set closure verified against builder modules; `grid/renderer.tsx` (imports `grid/types`) is deleted in the same atomic commit as `grid/types`.
- **No placeholders:** every step has the exact command or full file content.

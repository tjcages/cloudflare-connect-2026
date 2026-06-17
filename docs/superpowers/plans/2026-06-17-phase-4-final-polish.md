# Phase 4 — Final Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the three optional follow-ups from the Phase 2/3 reviews, cleanly: (1) bundle the published `.d.ts` into a single curated file, (2) DRY the studio's two config builders into one helper, (3) drop the studio's `createTextureSceneTicker` adapter so the studio routes through `createStripesShaderScene` directly — one render call path, no adapter.

**Tech Stack:** Vite 8 lib mode, vite-plugin-dts@5 (+ @microsoft/api-extractor), TypeScript 6, React 19, pixi.js 8, pnpm workspace.

## Global Constraints

- **Work on `main`, locally. NEVER push. NEVER publish.** Commit locally per task.
- **`pi`/`pir` only.** New deps must pass the **7-day release-age gate** (`minimumReleaseAge: 10080`) — pin an older satisfying version if `pi` blocks.
- **Do not start a dev server.**
- **Per-task gate: `pir verify` AND `pir code-check` both green.**
- **Behavior-preserving.** Task 1 changes the published types FORMAT only (same symbols). Task 2 is a pure DRY (same outputs). Task 3 must keep the studio rendering **pixel-identically** (the tick is unchanged; only the call site moves from `createTextureSceneTicker(refs)` to `createStripesShaderScene({getConfig})`) — a human visual check is the final gate (note it in the report).
- **Package stays dependency-clean at runtime** (pixi.js + react peers; api-extractor is a build-only dev dep).
- **Studio stays source-consuming.**

---

### Task 1: Bundle the published `.d.ts` into one curated file

Today `vite-plugin-dts@5` emits per-file dts (~50 `dist/src/*.d.ts`, incl. the broad `dist/src/index.d.ts`); only `dist/src/public.d.ts` is referenced. Bundle into a single `dist/index.d.ts` from the `public.ts` entry so the tarball ships exactly the curated public types.

**Files:**

- Modify: `packages/stripes-shader/vite.config.ts`, `packages/stripes-shader/package.json` (dep + publishConfig types path)

- [ ] **Step 1: Add `@microsoft/api-extractor` (release-age-safe dev dep)**

```bash
pi add -D @microsoft/api-extractor --filter @necatikcl/stripes-shader
```

If `pi` blocks the latest on the 7-day gate, pin an older satisfying version. Record the version.

- [ ] **Step 2: Enable dts bundling in `vite.config.ts`**

In the `dts({...})` plugin options, enable type bundling so it rolls all types reachable from the entry into ONE declaration file. For `vite-plugin-dts@5` (which wraps `unplugin-dts`), set `bundleTypes: true` and ensure the entry/`include` resolves the `public.ts` graph. Confirm the emitted bundled file's path (likely `dist/index.d.ts` or `dist/public.d.ts`) — you will point `types` at it in Step 4. Keep `react`/`react-dom`/`react/jsx-runtime`/`pixi.js` external (their types come from the consumer's peers; api-extractor should treat them as external — if it warns about unresolved external types, configure the api-extractor `externalPackages`/bundledPackages accordingly, or accept the warning if the bundled dts still imports the peer types by name).

- [ ] **Step 3: Build and verify a SINGLE curated dts**

Run: `pir --filter @necatikcl/stripes-shader build`
Verify:

```bash
ls packages/stripes-shader/dist/*.d.ts
ls packages/stripes-shader/dist/src/*.d.ts 2>/dev/null | wc -l   # expect 0 (no per-file internal dts) — or far fewer
rg -n "StripesShader\b|StripesShaderConfig|createStripesShaderScene" packages/stripes-shader/dist/index.d.ts | head
rg -n "createStripeDuotoneFilter|buildStripeLetterAtlas|StripeIndexLutTexture" packages/stripes-shader/dist/*.d.ts || echo "no internal symbols in published dts"
```

Expected: one bundled `dist/index.d.ts` (or `dist/public.d.ts`) exposing the public API; NO internal render-module symbols; the per-file `dist/src/*.d.ts` set gone (or not shipped).

- [ ] **Step 4: Point `publishConfig` types at the bundled file**

In `packages/stripes-shader/package.json` `publishConfig`, set `types` and `exports["."].types` to the bundled path from Step 3 (e.g. `./dist/index.d.ts`). Keep `main`/`import` → `./dist/index.js`.

- [ ] **Step 5: Pack-verify (read-only) + gate**

```bash
cd packages/stripes-shader && pnpm pack && tar -tzf *.tgz | rg "\.d\.ts" ; rm -f *.tgz ; cd -
```

Expected: the tarball ships the single bundled dts (and not the ~50 internal `.d.ts`). Then `pir verify && pir code-check` (both green; studio still consumes source).

- [ ] **Step 6: Commit**

```bash
git add packages/stripes-shader/vite.config.ts packages/stripes-shader/package.json pnpm-lock.yaml
git commit -m "Phase 4: bundle the published .d.ts into a single curated file (api-extractor)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Extract `buildCurrentConfig()` to DRY the two studio config builders

`onCopyState` and `onCopyConfig` in `TexturePlayground.tsx` build the identical ~22-field `StripesShaderConfig`. Extract one helper so they can't drift.

**Files:**

- Modify: `apps/studio/src/playground/TexturePlayground.tsx`

- [ ] **Step 1: Extract the helper**

Find the two identical config-building blocks (in `onCopyState` and `onCopyConfig`). Extract a single `buildCurrentConfig(): StripesShaderConfig` (a `useCallback` if it closes over reactive values/refs, with the correct deps; or a plain function if it reads only refs). Replace BOTH blocks with `const config = buildCurrentConfig();`. The two handlers then differ ONLY in the serializer they call (`serializePlaygroundState`/`copyPlaygroundStateToClipboard` for "Copy state" vs `serializeStripesShaderConfig` for "Copy config"). Change NOTHING about the resulting config values.

- [ ] **Step 2: Gate**

Run: `pir verify && pir code-check`
Expected: both green — the persistence/copy tests still pass (identical config built). If any deps-array lint warning appears for the `useCallback`, fix it correctly (don't suppress).

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/playground/TexturePlayground.tsx
git commit -m "Phase 4: DRY onCopyState/onCopyConfig via a shared buildCurrentConfig helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Drop the `createTextureSceneTicker` adapter — studio calls `createStripesShaderScene` directly

The studio currently calls the adapter `createTextureSceneTicker(...23 refs)` which delegates to `createStripesShaderScene({getConfig})`. Remove the indirection: have the studio build `getConfig` from its refs and call `createStripesShaderScene` directly, then delete the adapter. The tick is unchanged, so render stays pixel-identical.

**Files:**

- Modify: `apps/studio/src/playground/TexturePlayground.tsx`, `packages/stripes-shader/src/setupTextureShaderScene.ts` (delete the adapter), `packages/stripes-shader/src/setupTextureShaderScene.test.ts` (drop adapter-specific assertions), `packages/stripes-shader/src/index.ts` (drop the adapter export if present)

- [ ] **Step 1: Read the adapter's `getConfig` mapping (the exact reference)**

In `setupTextureShaderScene.ts`, the `createTextureSceneTicker` adapter builds `getConfig` from its 23 refs (the 16 config fields) and passes the passthroughs (`autoplay`, `flamesStateRef`, `revealStateRef`, `exportStateRef`, `onTextureLuminanceSettingsDetected`, `getSource`, `getDisplaySize`). This mapping is the AUTHORITY for Step 2 — copy it field-for-field.

- [ ] **Step 2: Build `getConfig` in the studio + call `createStripesShaderScene` directly**

In `TexturePlayground.tsx`, find the `tickers` useMemo that calls `createTextureSceneTicker(...)`. Replace it with `createStripesShaderScene({ getConfig: () => ({ ...the 16 fields from the studio's refs... }), getSource: () => textureSource, getDisplaySize: () => displaySize, autoplay: autoplayRef.current, flamesStateRef, revealStateRef, exportStateRef, onTextureLuminanceSettingsDetected })`. The `getConfig` body reads the SAME refs the adapter read, mapped to the SAME `StripesSceneConfig` fields (use the adapter's mapping from Step 1 verbatim). Keep the useMemo deps as they were (stable ref identities + load/display). Import `createStripesShaderScene` (replace the `createTextureSceneTicker` import).

- [ ] **Step 3: Delete the adapter**

Remove `createTextureSceneTicker` from `setupTextureShaderScene.ts`, its export from `index.ts` (and `public.ts` if it was there — it should NOT be public), and any adapter-specific test in `setupTextureShaderScene.test.ts` (keep the `createStripesShaderScene` tests). Grep to confirm no remaining references: `rg -n "createTextureSceneTicker" apps packages`.

- [ ] **Step 4: Gate**

Run: `pir verify && pir code-check`
Expected: both green. The tick is unchanged; the studio now calls `createStripesShaderScene` directly with a getConfig equivalent to the adapter's. Note in the report: a human `pir dev` visual check is the final pixel-parity gate (controller will request it). Confirm `getConfig`'s field mapping matches the adapter's exactly (the diff should show the same 16 fields).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Phase 4: route the studio through createStripesShaderScene directly; drop the adapter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 Done — Definition

- The published package ships ONE bundled `dist/index.d.ts` (curated public types only) — no internal per-file dts in the tarball.
- The studio builds its current config via a single `buildCurrentConfig()` (no duplicated builders).
- The studio calls `createStripesShaderScene` directly; `createTextureSceneTicker` (the adapter) is gone — one render call path.
- `pir verify` + `pir code-check` green; a human visual check confirms studio pixel-parity. Committed locally; nothing pushed/published.

## Risks & Watch-Items

1. **api-extractor + peer types** (Task 1) — react/pixi are external; the bundled dts should `import` their types by name (consumer resolves them). If api-extractor errors on unresolved externals, mark them external (don't bundle peer types). If `bundleTypes` proves flaky, fall back to the per-file dts (current working state) and just stop shipping `dist/src/index.d.ts` — but try the bundle first.
2. **Task 3 fidelity** — the ONLY risk is `getConfig`'s ref→field mapping diverging from the adapter's. Copy it verbatim from the adapter (Step 1). The tick/render is untouched, so equivalence is structural; the human visual check is the belt.
3. **`autoplay` capture** (Task 3) — the adapter captured `autoplayRef.current` once at call time; preserve that (read it once where the studio builds the options), matching today.
4. **Order** — do Task 1 (build), Task 2 (DRY), then Task 3 (render path) last so the riskiest change is isolated and visually checked.

## Self-Review (done while writing)

- All three are review-flagged optionals; each is behavior-preserving (types format / DRY / call-site move) with the existing test suite + a visual check as guards.
- Task 3's safety rests on the adapter mapping being the verbatim source for the studio's `getConfig`, and the tick being untouched (already proven byte-identical in 2c).

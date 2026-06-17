# Phase 2d — Delete the Export Twin, Add "Copy config" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Delete the obsolete "Export React (zip)" system + the hand-maintained portable render twin, and replace the export UX with a "Copy config" button that copies a clean `StripesShaderConfig` literal for pasting into a product app using the `<StripesShader>` package. SVG export is untouched.

**Architecture:** `apps/studio/src/lib/export/**` (39 files: the zip builder + the `portable/AsciiVideo` + `portable/scene` render twin) is superseded by the real `@necatikcl/stripes-shader` core + `<StripesShader>` (built in 2c). Because 2b made `StripesShaderConfig` the single clean config type, "Copy config" simply serializes the current config — no salvage of the old `snapshotToAsciiVideoConfig` is needed. Order: add "Copy config" FIRST (so a replacement exists), then delete the export tree + dialog + unwire the studio, then remove the in-repo snapshot mirror.

**Tech Stack:** TypeScript 6, React 19, Vitest 4, pnpm workspace.

## Global Constraints

- **Work on `main`, locally. NEVER push.** Commit locally per task.
- **`pi`/`pir` only.** Do not start a dev server.
- **Use `git rm`** for deletions.
- **Per-task gate: `pir verify` AND `pir code-check` both green.**
- **SVG export STAYS untouched:** `apps/studio/src/playground/stripeGridToSvg.ts` (+ test) and `apps/studio/src/grid/clipboard.ts` (`writeSvgToClipboard`, + test) and the "Copy SVG" button are NOT part of this deletion (they import only live modules; verify they keep working).
- **Line numbers below are approximate** (they shifted across 2a–2c) — GREP to find the exact current sites; do not trust the numbers.
- **Out of scope:** the lib build/publish (Phase 3); the optional adapter removal (deferred Task 3 of 2c).

## Reference — the delete set & wiring (verified current)

- **Delete (whole tree):** `apps/studio/src/lib/export/**` (39 files: `buildReactExport.ts`, `portableBundle.ts`, `downloadReactExportZip.ts`, `playgroundSnapshot.ts`, `resolveExportPaths.ts`, `syncExportToTest.ts`, `example5Snapshot.ts`, all of `portable/**` incl `portable/runtime/**` and `portable/AsciiVideo.tsx`/`scene.ts`, + their `*.test.ts`).
- **Delete:** `apps/studio/src/playground/ExportReactDialog.tsx`.
- **Unwire in `apps/studio/src/playground/TexturePlayground.tsx`:** the `import { ExportReactDialog } from "./ExportReactDialog"` (~line 72), `import { buildPlaygroundExportSnapshot } from "../lib/export/playgroundSnapshot"` (~74), `const [exportReactOpen, setExportReactOpen] = useState(false)` (~345), the `reactExportSnapshot = useMemo(() => buildPlaygroundExportSnapshot({...}))` block (~1579), the "Export React" button (~1850), and the `<ExportReactDialog open={exportReactOpen} … snapshot={reactExportSnapshot} />` render (~1896).
- **Clean:** `apps/studio/tsconfig.app.json` line ~22 `"exclude": ["src/lib/export/syncExportToTest.ts", "src/lib/export/syncExportToTest.test.ts"]` → `"exclude": []` (or remove the key).
- **Delete:** the in-repo snapshot mirror at repo-root `playground/test/**` (a committed copy of the deleted export's sibling-repo target; verify nothing references it).
- **Existing copy buttons (keep):** "Copy state"/"Import state" (`PlaygroundWorkflowControls.tsx`, `onCopyState`/`onImportState` in `TexturePlayground.tsx`), "Copy SVG".

---

### Task 1: Add the "Copy config" feature (clean `StripesShaderConfig` literal)

Do this FIRST so the export deletion leaves a working replacement.

**Files:**

- Create: `packages/stripes-shader/src/serializeStripesShaderConfig.ts`, `packages/stripes-shader/src/serializeStripesShaderConfig.test.ts`
- Modify: `packages/stripes-shader/src/index.ts` (export it)
- Modify: `apps/studio/src/playground/TexturePlayground.tsx` (add `onCopyConfig`), `apps/studio/src/playground/PlaygroundWorkflowControls.tsx` (add a "Copy config" button)

- [ ] **Step 1: Write the failing test** (`serializeStripesShaderConfig.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_STRIPES_SHADER_CONFIG, normalizeStripesShaderConfig } from "./StripesShaderConfig";
import { serializeStripesShaderConfig } from "./serializeStripesShaderConfig";

describe("serializeStripesShaderConfig", () => {
  it("produces valid JSON that round-trips through normalize to an equivalent config", () => {
    const cfg = normalizeStripesShaderConfig({ duotoneEnabled: true, displayWidth: 848, displayHeight: 480 });
    const text = serializeStripesShaderConfig(cfg);
    const parsed = JSON.parse(text);
    const round = normalizeStripesShaderConfig(parsed);
    expect(round.displayWidth).toBe(848);
    expect(round.displayHeight).toBe(480);
    expect(round.stripes.length).toBe(cfg.stripes.length);
  });

  it("is pretty-printed (multi-line) and includes the meaningful fields", () => {
    const cfg = normalizeStripesShaderConfig({ displayWidth: 640 });
    const text = serializeStripesShaderConfig(cfg);
    expect(text).toContain("\n");
    expect(text).toContain("displayWidth");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `pir --filter @necatikcl/stripes-shader exec vitest run src/serializeStripesShaderConfig.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `serializeStripesShaderConfig.ts`**

A function `serializeStripesShaderConfig(config: StripesShaderConfig): string` that returns a pretty-printed JSON literal of the config suitable for pasting into `<StripesShader config={…} />`. Keep it simple and robust:

- Default to `JSON.stringify(config, null, 2)` of the full config (the package's `normalizeStripesShaderConfig` accepts it as-is, so fidelity is guaranteed).
- OPTIONAL refinement (do it if clean): omit sub-config fields that equal their defaults using the package's `isDefault*` helpers (e.g. drop `grid` if `isDefaultPlaygroundGridConfig(config.grid)`), and drop scalar fields equal to their `DEFAULT_*`, producing a minimal literal. If a clean default-omission is non-trivial for any field, leave that field in — correctness (round-trips through `normalize`) beats minimalism. The test only requires valid round-tripping JSON, not minimality.

Do NOT import any studio code (package stays pixi.js + react only; this file imports only the config helpers + types).

- [ ] **Step 4: Run the test — expect PASS**

Run: `pir --filter @necatikcl/stripes-shader exec vitest run src/serializeStripesShaderConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Export from the barrel**

In `packages/stripes-shader/src/index.ts`, add: `export { serializeStripesShaderConfig } from "./serializeStripesShaderConfig";`

- [ ] **Step 6: Wire `onCopyConfig` in `TexturePlayground.tsx`**

Find `onCopyState` (the existing copy handler) and see how it builds the current config (it constructs a `PlaygroundPersistedConfig` = `StripesShaderConfig`). Add a sibling `onCopyConfig` that builds the SAME current config and copies `serializeStripesShaderConfig(config)` to the clipboard (`navigator.clipboard.writeText`), with the same feedback pattern `onCopyState` uses (a transient "Copied"/"Copy failed" state if present). Pass `onCopyConfig` down to `PlaygroundWorkflowControls` (mirror how `onCopyState` is threaded — likely via the leva controls props bundle).

- [ ] **Step 7: Add the "Copy config" button**

In `PlaygroundWorkflowControls.tsx`, add a `onCopyConfig: () => void` prop and a `<button>Copy config</button>` next to "Copy state" (reuse the existing button styling/disabled handling). (The "Export React" button is removed in Task 2; "Copy config" is its replacement.)

- [ ] **Step 8: Gate + commit**

Run: `pir verify && pir code-check`
Expected: both green.

```bash
git add -A
git commit -m "Phase 2d: add Copy config (serialize StripesShaderConfig literal) to the studio

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Delete the export system + portable twin + unwire the studio

**Files:**

- Delete: `apps/studio/src/lib/export/**`, `apps/studio/src/playground/ExportReactDialog.tsx`
- Modify: `apps/studio/src/playground/TexturePlayground.tsx`, `apps/studio/tsconfig.app.json`

- [ ] **Step 1: Remove the export tree + the dialog**

```bash
cd /Users/necatikcl/Documents/code/cloudflare/section-grid-generator
git rm -r apps/studio/src/lib/export
git rm apps/studio/src/playground/ExportReactDialog.tsx
```

- [ ] **Step 2: Unwire the export from `TexturePlayground.tsx`**

Grep for the sites, then remove each:

```bash
rg -n "ExportReactDialog|buildPlaygroundExportSnapshot|reactExportSnapshot|exportReactOpen|setExportReactOpen|Export React|lib/export" apps/studio/src/playground/TexturePlayground.tsx
```

Remove: the two imports (`ExportReactDialog`, `buildPlaygroundExportSnapshot`), the `exportReactOpen` `useState`, the entire `reactExportSnapshot = useMemo(...)` block, the "Export React" `<Button>` (and its surrounding row entry), and the `<ExportReactDialog … />` element. Remove any now-unused imports left behind (e.g. `useMemo` only if nothing else uses it — check). Do NOT touch the "Copy state"/"Import state"/"Copy SVG"/"Copy config" wiring.

- [ ] **Step 3: Empty the stale tsconfig exclude**

In `apps/studio/tsconfig.app.json`, change the `exclude` (which pointed at the now-deleted `syncExportToTest`) to `"exclude": []` (or remove the key entirely so the default applies).

- [ ] **Step 4: Confirm nothing else references the deleted tree**

Run: `rg -n "lib/export|ExportReactDialog|buildReactExport|buildPlaygroundExportSnapshot|downloadReactExportZip|AsciiVideo|playgroundSnapshot|resolveExportPaths|syncExportToTest" apps/studio/src packages`
Expected: NO matches (outside this plan doc). If any remain, remove that reference (it's dead).

- [ ] **Step 5: Gate**

Run: `pir verify && pir code-check`
Expected: both green. The studio builds without the export tree; the "Copy config" button replaces "Export React"; SVG export still works (its tests pass). Test count drops by the deleted export tests (`buildReactExport.test`, `downloadReactExportZip.test`, `resolveExportPaths.test`, `syncExportToTest.test`, `portable/colorSpace.test`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Phase 2d: delete the React-zip export system and the portable render twin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Remove the in-repo export-snapshot mirror

**Files:**

- Delete: repo-root `playground/test/**`

- [ ] **Step 1: Confirm it's the orphaned mirror with no references**

Run:

```bash
ls -R playground/test | head
rg -n "playground/test" --glob '!docs/**' . | grep -v "public/playground" || echo "no code references to playground/test"
```

Expected: it's a static snapshot tree (the deleted `syncExportToTest` target); no source references it. (Note: `public/playground/` media is DIFFERENT and stays — do not touch it.)

- [ ] **Step 2: Delete it**

```bash
git rm -r playground/test
# remove the now-empty playground/ dir if nothing else is in it
[ -d playground ] && rmdir playground 2>/dev/null || true
```

- [ ] **Step 3: Gate + commit**

Run: `pir verify && pir code-check`
Expected: both green (it was never part of the build).

```bash
git add -A
git commit -m "Phase 2d: remove the orphaned in-repo export-snapshot mirror

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2d Done — Definition

- `apps/studio/src/lib/export/**` and `ExportReactDialog.tsx` are gone; the studio has no "Export React" UI.
- A "Copy config" button copies a clean, round-trippable `StripesShaderConfig` literal (`serializeStripesShaderConfig`, package-owned + tested).
- SVG export (`stripeGridToSvg` + `grid/clipboard` + "Copy SVG") is unchanged and working.
- The orphaned `playground/test/` mirror is removed.
- `pir verify` + `pir code-check` green; committed locally; nothing pushed.

## Risks & Watch-Items

1. **Dangling imports after unwiring** (Task 2) — `tsc -b` catches any leftover reference to a deleted module; the Step 4 grep pre-empts it. Watch for a now-unused `useMemo`/`useState`/`Button` import.
2. **"Copy state" vs "Copy config"** — these coexist intentionally: "Copy state" is the studio's compact wire round-trip (carries texture refs/uploads context); "Copy config" is the clean package literal. Don't remove "Copy state".
3. **`portable/colorSpace.test.ts`** currently imports the package's `stripeColors` to assert parity between the portable copy and the package — deleting `portable/**` deletes this test too (fine; the parity it guarded is moot once the twin is gone).
4. **`public/playground/` is NOT the mirror** — the texture media under `apps/studio/public/playground/` stays; only the repo-root `playground/test/` snapshot mirror is deleted.
5. **Visual check** — after 2d, confirm in `pir dev` that the workflow panel shows "Copy config" (and it copies a usable literal) and that "Export React" is gone, with the rest of the studio unchanged.

## Self-Review (done while writing)

- **Spec coverage:** implements the spec's "delete export zip + portable twin → Copy config". SVG export explicitly preserved.
- **Ordering:** Copy config lands BEFORE the deletion, so there's never a window without an export-equivalent.
- **Salvage obviated by 2b:** the report's flagged `snapshotToAsciiVideoConfig` salvage is unnecessary — `StripesShaderConfig` is already the clean type, so `serializeStripesShaderConfig` just serializes it. Noted so the implementer doesn't reintroduce the old flattener.
- **No placeholders:** delete commands are explicit; the unwire is grep-guided (line numbers shifted, so grep is the authority); the new serializer is TDD'd.

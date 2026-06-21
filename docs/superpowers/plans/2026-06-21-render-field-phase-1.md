# Render field — Phase 1 (source → render field) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GPU "processed texture" be the **render field** — a grayscale image where white = render a stripe, black = hide — instead of the color source, so "stripes off" (and the debug Processed/Field view) shows the black/white field instead of a white screen.

**Architecture:** The render-to-texture chain already exists (source sprite → `processedRT` via the `sourceTextureFilter` → display sprite). Only the filter's _output_ is wrong: it emits a color-preserving image. This phase changes that filter to emit the grayscale render field (luminance/presence + adjustments + overlay-mode inversion), establishing rules R1, R2, R5 from `docs/render-pipeline-architecture.md`.

**Tech Stack:** TypeScript, PixiJS v8 GLSL filter (`sourceTextureFilter.ts`), Leva (studio).

**Spec / rules:** `docs/render-pipeline-architecture.md` (R1–R5; the "render field, precisely" section). This supersedes the `2026-06-21-texture-pipeline-phase-1` spec/plan's "processed = color image" definition.

## Global Constraints

- Package manager: `pi` / `pir`, never npm/pnpm/npx. Gates: `pir typecheck`, `pir test` (existing suite stays green), `pir verify` (studio client build).
- The render field is **grayscale** (`vec3(field)`), white = render, black = hide. Overlay mode inverts (`field = 1 - adjusted`); luminance and colors modes do not. This must mirror the CPU ground truth `finalizeStripeBucketingLuminance(applyTextureLuminanceAdjustments(luma, …), mode)` (`colorWhiteness.ts` / `playgroundTextureAdjustments.ts`).
- Colors mode: the field is the grayscale **presence** mask (white = render); per-cell color stays a separate side input (the existing CPU `uCellColorMap`) — do NOT put color into the field.
- Stripes-ON must stay visually unchanged in **luminance** and **colors** modes (bars come from the CPU `uBlockMap`, untouched). In **overlay** mode the stripe underlay (`uTexture`) now samples the grayscale field instead of the color photo — this is a deliberate, expected change toward R1; call it out at the visual gate.
- This is rendering: not unit-testable. Verification is the automated gates + a human visual gate (the project's recording-diff / field-inspection method).
- Comment density: match the surrounding file (the shader is heavily commented; a concise comment on the field output is expected).

---

## File structure

Modified:

- `packages/stripes-shader/src/sourceTextureFilter.ts` — change `main()` to output the grayscale render field; add a `uOverlayInvert` uniform set from the luminance mode.
- `apps/studio/src/playground/playgroundLevaSchema.ts` + `apps/studio/src/playground/playgroundFieldHelp.ts` — relabel the debug stage "Processed" → "Field" (UI label only; the stage value stays `"processed"`).

No change to `setupTextureShaderScene.ts` (the filter is already wired and `syncLuminanceSettings` is already called on mode change), the stripe shader, the CPU block grid, or the public config.

---

## Task 1: Render-field filter outputs the grayscale field (white-screen fix)

**Files:**

- Modify: `packages/stripes-shader/src/sourceTextureFilter.ts`

**Interfaces:**

- Consumes: existing `adjustLuma`, `sampleMergedLuma`, `applyFlames`, `sampleFilteredSourceRgb` in the same file; the existing `syncLuminanceSettings(settings)` entry point.
- Produces: the filter now renders `vec3(field)` (grayscale render field) into `processedRT`. New uniform `uOverlayInvert` (f32, default 0; 1 in overlay mode).

This is a GLSL + uniform change; verify via typecheck/tests/verify + the human visual gate (no unit test for shaders).

- [ ] **Step 1: Add the `uOverlayInvert` uniform to the fragment source**

In `SOURCE_TEXTURE_FILTER_FRAGMENT`, add the declaration next to `uniform float uColorsMode;`:

```glsl
uniform float uOverlayInvert;
```

- [ ] **Step 2: Replace `main()` to output the grayscale render field**

Replace the existing `void main(void) { … }` (the block that computes `merged`/`mergedLuma`/`adjusted` and outputs a color-preserving `finalRgb`) with:

```glsl
void main(void) {
    vec3 merged = applyFlames(sampleFilteredSourceRgb(vTextureCoord));
    float mergedLuma = sampleMergedLuma(merged);
    float adjusted = adjustLuma(mergedLuma);
    // Render field (rules R1/R2): grayscale, white = render a stripe, black = hide.
    // Overlay mode inverts so dark content on a light background renders on the content.
    // Mirrors finalizeStripeBucketingLuminance(applyTextureLuminanceAdjustments(...), mode).
    float field = uOverlayInvert > 0.5 ? 1.0 - adjusted : adjusted;
    finalColor = vec4(vec3(field), 1.0);
}
```

(`sampleMergedLuma` already returns Rec.709 luma in luminance/overlay modes and the color-presence value in colors mode, so the field is the correct grayscale quantity in every mode; `adjustLuma` already applies levels/gamma/exposure/contrast/brightness/noise/invert/posterize. The only thing missing was the overlay inversion, now added.)

- [ ] **Step 3: Declare the uniform in the uniform group**

In `createSourceTextureFilter`, in the `textureUniforms` `UniformGroup`, add after `uColorsMode: { value: 0, type: "f32" },`:

```ts
    uOverlayInvert: { value: 0, type: "f32" },
```

- [ ] **Step 4: Set `uOverlayInvert` from the luminance mode**

In `filter.syncLuminanceSettings`, extend the uniforms cast and set the value. Replace the body's uniforms read/assignment with:

```ts
filter.syncLuminanceSettings = (settings) => {
  const mode = normalizeTextureLuminanceMode(settings.mode);
  const bg = textureBackgroundColorToRgb01(settings.backgroundColor);
  const uniforms = textureUniforms.uniforms as {
    uColorsMode: number;
    uTextureBgColor: number[];
    uOverlayInvert: number;
  };
  uniforms.uColorsMode = mode === "colors" ? 1 : 0;
  uniforms.uTextureBgColor = bg;
  uniforms.uOverlayInvert = mode === "overlay" ? 1 : 0;
  textureUniforms.update();
};
```

(`normalizeTextureLuminanceMode` is already imported in this file.)

- [ ] **Step 5: Add a file-level note that this filter now produces the render field**

At the top of `SOURCE_TEXTURE_FILTER_FRAGMENT`'s preceding comment (or a one-line comment above `export const SOURCE_TEXTURE_FILTER_FRAGMENT`), note its role per the rules:

```ts
// Produces the RENDER FIELD (docs/render-pipeline-architecture.md, R1/R2): a grayscale
// texture where white = render a stripe, black = hide. NOT a color image.
```

- [ ] **Step 6: Typecheck + run the suite**

Run: `pir typecheck`
Expected: PASS.

Run: `pir test -- packages/stripes-shader`
Expected: PASS (no behavioral test touches this filter; existing suite stays green).

- [ ] **Step 7: Build the studio client**

Run: `pir verify`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/stripes-shader/src/sourceTextureFilter.ts
git commit -m "fix(pipeline): output the grayscale render field (white=render) instead of the color image"
```

- [ ] **Step 9: Human visual gate (controller/user — do NOT start a dev server)**

In the user's running studio, confirm (this is the fix for the white screen):

1. **Debug view = Processed/Field** → shows a black/white field: **white where content is, black background** (e.g. a white bridge on black), in luminance, overlay, and colors modes. NOT a white screen.
2. **Stripes OFF (Normal)** → shows the same field.
3. **Stripes ON, luminance** → bars look exactly as before.
4. **Stripes ON, colors** → looks as before (bars tinted by the cell color map).
5. **Stripes ON, overlay** → bars now sit over the grayscale field instead of the color photo — confirm this is acceptable (deliberate R1 change). If the color underlay is wanted back, that's a later phase, not a Phase 1 bug.
6. **Debug view = Source** → still the raw image.

---

## Task 2: Relabel the debug stage "Processed" → "Field" (studio clarity)

**Files:**

- Modify: `apps/studio/src/playground/playgroundLevaSchema.ts`
- Modify: `apps/studio/src/playground/playgroundFieldHelp.ts`

**Interfaces:**

- Consumes: the existing `DEBUG_STAGE_OPTIONS` map and `debugStage` field help.
- Produces: the UI label reads "Field" for the `"processed"` stage value (value unchanged, so no plumbing/type changes).

- [ ] **Step 1: Relabel the option**

In `playgroundLevaSchema.ts`, change the `DEBUG_STAGE_OPTIONS` map key from `Processed` to `Field` (the value stays `"processed"`):

```ts
const DEBUG_STAGE_OPTIONS: Record<string, PlaygroundDebugStage> = {
  Normal: "normal",
  Source: "source",
  Field: "processed",
};
```

- [ ] **Step 2: Update the field-help text to name the render field**

In `playgroundFieldHelp.ts`, update the `debugStage` entry:

```ts
  debugStage: "Debug view: Normal renders the app; Source shows the raw texture; Field shows the render field (grayscale, white = render a stripe), overlays hidden.",
```

- [ ] **Step 3: Typecheck**

Run: `pir typecheck`
Expected: PASS (label-only change; `"processed"` value and all plumbing unchanged).

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/playground/playgroundLevaSchema.ts apps/studio/src/playground/playgroundFieldHelp.ts
git commit -m "chore(studio): label the debug field-inspection stage 'Field'"
```

---

## Self-review (completed during planning)

- **Spec coverage:** R1/R2 (source → grayscale render field, overlay inversion, colors-mode presence with color as side input) → Task 1 Steps 2–4. R5 (field inspectable) → already present from the prior debug-stage work; Task 2 names it "Field". "Stripes off shows the field, not white" → Task 1 (the filter output is what the display sprite shows when stripes are off). Stripes-ON luminance/colors unchanged, overlay underlay deliberately the field → Global Constraints + Task 1 Step 9 gate. Colors-mode color stays a side input → Global Constraints (no field change for color). ✓
- **Placeholder scan:** none — Task 1 gives the exact GLSL and uniform code; Task 2 is a literal label/string change. The shader's correctness is verified by the visual gate (no fake unit test claimed). ✓
- **Type consistency:** `uOverlayInvert` declared in the fragment (Step 1), the uniform group (Step 3), and the `syncLuminanceSettings` cast (Step 4) — consistent. `DEBUG_STAGE_OPTIONS` value `"processed"` (a valid `PlaygroundDebugStage`) is unchanged in Task 2, so no type or plumbing breakage. ✓

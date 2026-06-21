# Render pipeline architecture & rules

This is the canonical description of how the stripes-shader renderer is built. It is a
**living rules document** — keep it current. Every render change must obey the rules in
the first section. If a change would violate a rule, the rule is wrong (fix it here first
and get agreement) or the change is wrong.

It exists because the pipeline drifted: effects (reveal, flames, cursor, sparkle, …) got
baked _inside_ the stripe shader, per-cell luma was CPU-sampled, and adjustments/flames
were duplicated across three code paths. Disabling stripes disabled everything, and there
was no way to see what each stage did. These rules prevent that.

---

## The rules (the invariant)

- **R1 — One canonical intermediate: the _render field_.** Everything flows through a
  single texture, the _render field_: a grayscale value where **white (1) = render a full
  stripe here, black (0) = hide (background)**. The field is the single source of truth.

- **R2 — Source → field is stage one.** The first stage converts the source (image/video)
  into the field: compute luminance, apply **background-aware inversion** so _content_ is
  white and _background_ is black, and apply all texture adjustments (levels, gamma,
  exposure, contrast, blur/sharpen, posterize, …). The output is black/white — never a
  color photo.

- **R3 — Every effect is a field → field pass.** Reveal, flames, cursor-trail/push,
  click-wave each take the field and return a field. White adds/keeps content; black
  hides. Reveal paints unrevealed regions toward black until their moment. The passes run
  in an explicit order and each is visible with stripes off.

- **R4 — Stripes are the terminal post-process, and ONLY that.** The stripe pass reads the
  final field per cell → picks a band via the stripe LUT → draws bars. It computes **no
  effects**. The only logic allowed in the stripe pass is bar rendering plus the two
  genuinely stripe-only animations, **sparkle** and **width-shuffle**. Removing the stripe
  pass must leave a working pipeline that shows the field.

- **R5 — Every stage is inspectable.** With stripes off, the screen shows the final field
  (white content on black). A debug **stage-view** can show any intermediate field
  (source, after-adjustments, after-reveal, after-flames, …). Debugging is _looking_, not
  guessing.

**Corollary (the thing we keep getting wrong):** "stripes off" must show the _render
field_ (black/white), not the color source and not a blank screen. If a white-background
photo shows a white screen with stripes off, R1/R2 are being violated — the pipeline is
showing the color image instead of the field.

---

## The render field, precisely

- **Luminance mode:** field = adjusted Rec.709 luma of the source.
- **Overlay mode:** field = `1 - luma` (inverted) — this is how dark content on a light
  background (e.g. a dark bridge on white) renders stripes on the _content_. See
  `finalizeStripeBucketingLuminance` / `overlayInvertsStripeBucketing` in
  `colorWhiteness.ts`.
- **Colors mode:** the _render field stays a grayscale presence mask_ (white = render),
  computed from color distance-to-background × saturation (`colorPixelPresence`). The
  per-cell **color is a separate side input** consumed only by the stripe pass to tint
  bars and scale width — it is NOT part of the field. So "render is decided black/white"
  holds in every mode; color is just a lookup at the final stage.

The field is the same quantity the current CPU block grid stores as its per-cell
bucketing luma (`LumaGrid.luma`, already overlay-inverted). The refactor makes that field
an explicit, visible GPU texture rather than a CPU array hidden inside the stripe shader.

---

## Canonical pipeline

```
source (image / video)
  → [adjustments + luminance + background invert]   ⟶  RENDER FIELD  (grayscale, white = render)
  → [reveal]        field → field   (mask unrevealed toward black)
  → [flames]        field → field   (add white light)
  → [cursor/click]  field → field   (paint + displacement)
  = FINAL FIELD     ← shown when stripes are OFF; any stage shown via debug stage-view
  → [stripe post-process]  per cell: sample field → band (LUT) → draw bars
                           (+ sparkle, + width-shuffle; + per-cell color lookup in colors mode)
  + glow overlay    (assembly motes) composited on top
```

Sparkle and width-shuffle are the _only_ things that live in the stripe pass. Everything
else is a field pass upstream.

---

## Current state vs. target

Today (before this refactor lands): a single sprite with the stripe duotone filter does
_everything_ — bucketing, reveal, flames, cursor push, sparkle, width-shuffle — and the
per-cell field is CPU-sampled (`computeBlockGrid`). Adjustments + flames are also
duplicated in a CPU preview-bake and an unused GPU `sourceTextureFilter`.

An initial "Phase 1" stood up a GPU render-to-texture chain but defined the intermediate
wrongly: it rendered the **color** source through `sourceTextureFilter` and called that the
"processed texture." On a white-background image that is a white screen, and it violates
R1/R2. **That mistake is what this document corrects:** the intermediate must be the
_render field_.

### What survives from that Phase 1 work

Reusable and kept (it's the right scaffolding):

- The render-to-texture chain: source sprite (offscreen) → render target → display sprite.
- The `resolveDisplayPlan` / debug-stage mechanism and the Normal/Source/Processed view.
- The per-tick source relayout (live `sourceTransform`).

Redefined: the "processed texture" becomes the **render field** (grayscale, white = render),
produced by a source→field pass — not the color image. This both fixes the white screen
and makes the chain embody R1–R5.

---

## Phase roadmap (each its own spec → plan → ship, verified before the next)

1. **Source → render field; the field is what you see.** Replace "processed = color image"
   with "processed = render field": a GPU source→field pass (luma + overlay/background
   inversion + adjustments → grayscale, white = content). Stripes-off and the
   Processed/Field debug stage show the black/white field (white content on black). The
   stripe pass still reads the CPU block map for bars in this phase, but the field it
   shows must be consistent with that block map's bucketing. **Fixes the white screen;
   establishes R1, R2, R5.**
2. **Stripes downsample the field (R4).** Stripe pass reads a GPU-downsampled per-cell
   value from the field → band via LUT → bars. The CPU block grid stops feeding the stripe
   render (still feeds letters / SVG export / assembly glow for now). Pixel-parity verified
   against the current build.
3. **Reveal as a field pass (R3).** Lift reveal out of the stripe shader into a field→field
   pass that masks the field toward black until revealed; redo the assembly glow as the
   visible colored treatment. Reveal now works stripes-on or -off and is visible before
   stripes. (This is where the assembly reveal finally looks right.)
4. **Flames + cursor-trail/click as field passes (R3).** Move the remaining effects to
   field passes; collapse the duplicated adjustments/flames; delete the dead CPU bake.
   (Cursor push is delicate — measured against recordings.)
5. **Colors-mode color side-input + cleanup.** Make colors-mode tint/coverage a clean
   per-cell side input to the stripe pass; re-point letters/export off the CPU grid where
   possible; prune.

Sparkle and width-shuffle never move — they are stripe-pass animations by definition (R4).

---

## Verification

The field being a real, visible texture is itself the debugging win (R5). For each phase:

- **Automated gates:** `pir typecheck`, `pir test` (existing suite stays green), `pir verify`
  (studio client build).
- **Recording diffs** ("measure recordings, not guesses"): capture current vs new build and
  ffmpeg frame-diff the parity-critical cases — stripes-on luminance + overlay (bands must
  not change until Phase 2 deliberately moves band derivation), stripes-off shows the field,
  live `sourceTransform` on a static image, and a video clip.
- **Field inspection:** the Processed/Field debug stage must show a sensible black/white
  field (white content, black background) for representative images in all three luminance
  modes.

---

## Non-goals

- No new visual features here — this is an architecture re-grounding. New reveals/effects
  come after the pipeline obeys R1–R5.
- Sparkle/width-shuffle stay in the stripe pass (R4); do not "field-ify" them.
- The published `<StripesShader>` public config surface is unchanged by the refactor;
  `debugStage` and pipeline internals stay studio-/scene-internal.

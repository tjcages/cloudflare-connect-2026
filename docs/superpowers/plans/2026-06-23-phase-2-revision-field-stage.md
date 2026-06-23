# Phase 2 REVISION — Field-stage reveal + canvas/UI fixes

> Supersedes the pass PLACEMENT in `2026-06-23-phase-2-reveal.md`. Reveal/assembly were implemented on the
> downsampled CELL texture INSIDE the `if (stripesEnabled)` branch of `engine.ts` — architecturally WRONG.
> They must run on the FIELD (the texture) BEFORE downsample, so the effect is visible with stripes OFF and
> the stripe pass renders LASTLY on the revealed/assembled field.

## Base rule (user, hard, non-negotiable)

Effects modify the **TEXTURE (field)**, never the stripes. EVERYTHING happens before stripes. The stripe pass
renders 1:1 on the final (revealed/assembled) field as the LAST step. **The reveal must be visible when stripes
are DISABLED** — that is the test that proves it's applied to the texture, not to the stripes. "Texture pieces fly;
stripes do their job lastly to make it look good."

## R1 — Move reveal + assembly to the FIELD stage (core fix; user #7 + #3)

- New reveal pass reads the full-res `field` RT → writes a `revealedField` RT, applying the wave mask / assembly
  scatter. **Cell-QUANTIZED** (per-cell mask / cell-block scatter, using the cell grid) so it stays pixelated, but
  computed at FIELD resolution and written to the field RT.
- The reveal pass exists whenever `reveal.enabled` — **NOT** gated on `stripesEnabled`.
- Pipeline:
  - stripes OFF: `field → reveal → present(revealedField)`.
  - stripes ON: `field → reveal → downsample(revealedField) → stripe`.
- Assembly: 40px blocks of the FIELD fly in from off-canvas (so texture pieces visibly fly, even stripes-off).
  At `f=1`, `revealedField == field` exactly (identity → stripes/field unchanged at landing).
- Wave: per-cell mask multiplies the field (pixelated per-cell wavefront).
- Engine: current `engine.ts` builds reveal/scatter midPasses ONLY inside `if (config.stripesEnabled)` on the
  `cell`/`reveal` RTs — move them to operate on `field` and feed both the present (stripes-off) and the
  downsample (stripes-on) paths. Topology: reveal pass present iff `reveal.enabled`; assembly-vs-wave by type.

## R2 — Wave look (user #2)

Old wave = a pixelated "wave of cells" with per-cell randomness (looks like a wave made of cells). Current looks
like "very big cells" / too coarse. Match the old look: cell-quantized mask + per-cell noise (waviness/noiseScale)
tuned to the old `apps/studio` wave. Verify the cell grid granularity is right (not oversized blocks).

## R3 — Assembly flying (user #3) — folded into R1

Once the scatter runs on the FIELD, the texture pieces visibly fly (the prior cell-texture version only affected
the stripe path, so "no flying particles" was visible). 40px field blocks fly in, sharp, stripes render lastly.

## R4 — Canvas sizing (user #1)

Remove the fill-area ResizeObserver. Port the old studio canvas-size behavior:

- Base display size = the SOURCE's intrinsic dimensions (video/image natural size).
- If base width > 1000px → clamp width to 1000, preserve aspect ratio (height scales proportionally).
- Scale presets **1× / 2× / 3× / 4×** (default 1×) multiply the base size.
- Canvas CSS size = base × scale, **aspect ratio preserved**, centered in the canvas area (overflow auto if larger).
- Engine renders at that size × DPR. Add canvas-size + scale-button controls (mirror old `PlaygroundCanvasSizeControls`).

## R5 — UI fixes

- #4: move the **Texture DPR** control from the Quality folder into the **General** folder.
- #5: in the stripe colors table, put the remove-**X** at the **rightmost** of the row (after the Width input), not
  next to the color swatch.
- #6: **conditional config rendering** — show wave params only when `type==="wave"`, assembly params only when
  `type==="assembly"`. Apply generally: only render a control when its dependency/parent config is active.

## Verify

- field/stripes goldens unchanged (reveal default off).
- NEW golden: **reveal visible with stripes OFF** (stripes-off + reveal-on at mid-progress) — proves field-stage.
- Re-capture wave + assembly goldens at the field stage; assembly f=1 == field identity.
- Perf 4K within budget with reveal animating.

# GPU-first engine rewrite — design

**Date:** 2026-06-22
**Status:** Design approved in substance; per-phase plans to follow (Phase 0 first).

A clean-room, GPU-first rewrite of the stripes shader. The current engine is
CPU-oriented (full-frame `getImageData` readbacks, a per-pixel CPU block grid, CPU
trail/letter loops, Canvas2D rasterization) and built on Pixi. We replace the **render
core** with a fresh WebGL2 engine while keeping the _feature set and visual intent_.

---

## Philosophy (read this first)

- **Features are the spec — not the old code.** We preserve what each feature _does_ and
  how it _looks_. We do **not** port the old implementation, the old config field shapes,
  or any "the old code did X" rule. The prior codebase is a feature inventory and a look
  reference, nothing more.
- **Clean-room means the render core.** A brand-new `packages/stripes-engine` (WebGL2, no
  Pixi) and a new `apps/lab` harness. The existing `apps/studio` +
  `packages/stripes-shader` stay untouched until the new engine reaches parity, then we
  cut over and retire them (Phase 9).
- **GPU-first, field-first.** Build one black/white **render field** (white = draw a
  stripe, black = background). Every effect is a field→field GPU pass. **Stripes are a
  pure terminal post-process applied on top — nothing upstream depends on them.** Turning
  stripes off shows the field, never blank, never the color source. No CPU pixel sampling
  on the hot path.
- **No legacy debt.** Drop the dead WebGL1 fallback, the duplicate field derivations, the
  CPU twins, and confirmed-dead config (`pushLagPx`, `pushWobblePx`, `pushLeadBlackAlpha`,
  the `vibrant` extractor, etc.). Design clean config per feature.

---

## Decisions (locked)

| Decision                   | Choice                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Approach                   | Clean-room engine from scratch (render core); reuse only feature intent + the studio/UI later                                                          |
| Substrate                  | **Raw WebGL2**, drop Pixi; thin helper (`twgl.js` or a ~150-line in-house `gl` module) for program/FBO/uniform boilerplate                             |
| GL floor                   | **WebGL2 / GLSL ES 3.00 only.** Unlocks MRT, float/half-float RTs, instancing, dynamic loops, VAOs                                                     |
| Output resolution          | **True `devicePixelRatio`**, capped to `MAX_TEXTURE_SIZE`. No hardcoded 2×                                                                             |
| Field resolution           | Reduced (`fieldScale`, default **0.5× DPR**) — stripes quantize + overlay it anyway                                                                    |
| Stripe + letter resolution | Full DPR (crisp SDF bars + glyphs)                                                                                                                     |
| Parity bar                 | Documented per-mode tolerance via a **visual-golden harness** (goldens captured once a feature's look is approved — not diffed against the old engine) |
| Color                      | display-p3 wide gamut (`drawingBufferColorSpace`/`unpackColorSpace`); data textures uploaded as **raw byte buffers**, never canvases                   |

---

## Why raw WebGL2 (not Pixi)

In a clean-room rebuild, Pixi's value ("free" video upload, color-space, premultiply, RT
pooling, context-loss recovery) stops being a reason to keep it — we're building the
chassis regardless — while Pixi's costs work against the goals:

- **Performance / scaling** (the core complaint): the pipeline is a _fixed multi-pass DAG_
  that maps 1:1 onto raw WebGL2 FBOs with the least per-frame overhead. Pixi wraps each
  pass in scene-graph + batching + filter coordinate bookkeeping we don't need.
- **Clean installable package:** today `index.ts` leaks Pixi symbols and ships ~500KB of
  Pixi to consumers. Raw WebGL2 → a lean, dependency-light `<StripesShader>`.
- **WebGL2-only floor:** native MRT (colors-mode color+coverage), instancing
  (trails/letters/flames), float RTs (ping-pong trails, temporal smoothing) — no extension
  dance.

Bounded cost we take on: display-p3 setup (≈30 lines, logic already exists), premultiply
rules, `texImage2D(video)` per frame, and context-loss recovery — which we design in from
day one (rebuild all GPU state from config + source). Rejected: regl (functional paradigm
fights per-frame conditional branching), WebGPU (experimental, would need WGSL twins of
every shader — revisit later as an optional compute backend behind the same API).

---

## Architecture — the GPU pass graph

Every box is a WebGL2 FBO pass. Zero CPU pixel reads on the hot path.

```
source (image Texture / video → texImage2D each frame)
  │
  ▼  PASS A  source → FIELD            [fieldScale res]
  │           adjustments (levels/gamma/exposure/contrast/brightness/blur/sharpen/
  │           posterize/invert/noise/threshold) + luma (rec709 | colors-presence)
  │           + overlay-invert + background composite + edge-mask
  │           → grayscale RT, white = draw a stripe       ← shown verbatim when stripes OFF
  │
  ▼  PASS B  field → field  effects, in order:            [fieldScale res]
  │           reveal   (wave filter | assembly instanced mesh)
  │           flames   (GPU additive instanced quads; CPU keeps only the cheap particle sim)
  │           cursor   (screen-space warp + tear + white paint)
  │             └─ trails/clicks accumulate into a PING-PONG RGBA float RT (additive splats),
  │                tear = neighbour-difference pass — no CPU cell-maps
  │
  ▼  PASS C  field → fieldCellRT       [cols×rows]  box-average to per-cell value
  │           + colors-mode: MRT emits per-cell COLOR + COVERAGE side-channels
  │           + temporal anti-shimmer: ping-pong maxStep clamp vs previous frame
  │
  ▼  PASS D  STRIPE post-process (terminal)   [full DPR]
  │           per cell: sample fieldCellRT → band via 256-entry LUT → rounded-box SDF bars
  │           the ONLY stripe-pass logic: sparkle + width-shuffle (+ colors tint/width)
  │
  ▼  PASS E  LETTERS (composited above)       [full DPR]
  │           instanced layer sampling the SAME field + packed glyph atlas
  │           + per-cell glyph-index data texture; shuffle/sparkle = in-shader time hashes
  │
  ▼  canvas (display-p3)
```

**CPU keeps only:** config normalize/serialize, the cheap particle sim, pointer→cell
mapping, the reveal-progress scalar, a **one-shot cols×rows readback on export**, the glyph
atlas bake (once per charset/size), and a CPU-baked per-cell eligibility/glyph LUT (raw
buffer, shared with SVG export so screen == export).

### Resolution architecture (the scaling win)

- **Output canvas** = CSS size × `devicePixelRatio`, clamped to `MAX_TEXTURE_SIZE`.
- **Field chain (A, B)** renders at `fieldScale` (default 0.5× DPR). It only needs to
  resolve cell-level detail + smooth effect gradients; opaque bars overlay it. This
  decouples field cost from display resolution — why 4K stays cheap.
- **Cell grid (C)** = cols×rows (display / cellSize). Tiny.
- **Stripes (D) + letters (E)** render at full DPR for crisp edges.

### Determinism (for tests)

The engine accepts an injectable **clock** (`now()`) and **RNG seed**. With a fixed clock +
seed + DPR, every animated feature renders reproducibly — the basis for visual goldens.

---

## Module / package structure

```
packages/stripes-engine/          # new GPU-first WebGL2 render core (eventual installable lib)
  src/
    gl/            context (DPR + display-p3), FBO/RT pool, program/uniform helpers, ping-pong
    passes/        sourceField, effects (reveal/flames/cursor), downsample, stripe, letters
    shaders/       GLSL ES 3.00 sources (one file per pass)
    field/         field config + band LUT + palette
    input/         image/video source loading + upload + source transform
    StripesShader  public React component (SSR-safe) + public config types
    index.ts       curated public surface (no GL internals leak)
apps/lab/                          # dev harness — build + test the engine phase by phase
  source picker · per-feature controls · live perf overlay · debug stage views · perf/visual routes
```

`apps/studio` + `packages/stripes-shader` remain the live product until Phase 9 cutover.

---

## Test harness (the gate, built in Phase 0)

Classic unit tests are the wrong primary tool. Three layers:

1. **Perf gate — "4K @ 60fps."** A harness route renders a known source at 3840×2160 × DPR,
   warms up, then measures rolling FPS + frame-time **p50/p95/p99** and **per-pass GPU ms**
   via `EXT_disjoint_timer_query_webgl2`, plus RT VRAM estimate + draw-call count, in a live
   overlay. Headless (Playwright + real GPU) asserts _median frame time ≤ 16.6ms at 4K_ and
   fails CI when a phase regresses. **Primary gate.**
2. **Visual goldens.** Per-feature Playwright screenshots at fixed seed + fake clock + fixed
   DPR, diffed with tolerance (SSIM / max ΔRGB). Captured once the look is approved — the
   golden is "the look we signed off," the regression net going forward.
3. **Tiny unit tests** only for pure deterministic logic (config normalize, band-LUT
   mapping, glyph placement determinism).

---

## Feature inventory (what each phase must reproduce — intent, not implementation)

Config shapes are redesigned clean; this lists the _capabilities + visual intent_.

- **Source & transform:** image/video upload; `fit` (stretch/contain/cover), `zoom`,
  `panX/panY`. Video uploads to GPU each frame; live source relayout.
- **Texture adjustments → field:** brightness, exposure, contrast, black/white point
  (levels), gamma (no upper clamp), invert, posterize, threshold bias, noise (dither),
  blur, sharpen. Then luminance (rec709) → grayscale field. **Overlay mode** = `1 − luma`.
- **Background:** canvas background color / CSS (not a shader uniform; used by video export
  compositor; SVG bakes no background).
- **Grid geometry:** cell width/height, gapX/gapY, corner radius (rounded SDF bars),
  orientation (vertical/horizontal).
- **Stripes (luminance/overlay):** ordered stripe list (color + start-from threshold +
  width) → 256-entry band LUT + palette → rounded-box SDF bars. Separate overlay stripe
  list for overlay mode.
- **Reveal (Phase 2):** `wave` (positioned, duration, softness, waviness, noise) masks the
  field toward black until its moment; `assembly` (puzzle pieces, per-piece speed +
  stagger) flies content into place. Replays on content/media change (`onRevealReplay`).
- **Sparkle gaps + width (Phase 3):** stripe-pass-only animations — gap pulsing
  (active%, speed, period bounds) and per-cell width shuffle (active%, speed, swing,
  period bounds).
- **Flames (Phase 4):** background light streaks — direction, width/height ratios, speed +
  variation, spawn interval/jitter, max active, edge sharpness, opacity range; additive
  merge into the field.
- **Edge mask (Phase 5):** separable ramp fade of the field to black near canvas edges
  (start, end, power).
- **Cursor trail / click (Phase 6):** trail brighten + **screen-space push/warp + tear**
  (core, even though default strength 0); click ripple brighten + radial push. GPU
  ping-pong accumulation. Push encoding redesigned (float RT; the old byte-128 trick is
  not a constraint).
- **Letters (Phase 7):** glyphs on brightest-band cells — size, ratio (per-cell PRNG
  chance), charset, color, shuffle speed. Glyph atlas + per-cell glyph-index texture; char
  stays stable for unchanged cells across rebuilds (no popping).
- **Colors mode (Phase 8):** stripes tinted by per-cell source color + coverage, width
  scaled by coverage. Field stays a grayscale presence mask; color/coverage is an MRT
  side-input consumed only by the stripe pass. Background auto-detect.
- **SVG + video export (Phase 9):** SVG from a one-shot cols×rows readback (band + color +
  coverage) + the shared deterministic letter-placement LUT; video via canvas
  `captureStream` (flush GPU before `requestFrame`).

---

## Phase roadmap

Each phase: independently testable, ships behind the perf + visual gate, and gets its own
spec → plan → implement cycle.

| Phase | Deliverable                                                                                                                                                                   | Gate                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **0** | New `packages/stripes-engine` + `apps/lab` scaffold; WebGL2 context (DPR + p3); resolution arch; pass-graph skeleton; **perf + visual harness**; fresh AI-rules/docs baseline | Harness boots; perf overlay live; empty pass graph renders a clear field       |
| **1** | Source upload + transform; texture adjustments; luminance + overlay field; background; grid geometry; terminal stripe pass                                                    | Stripes-off shows the field; luminance + overlay look approved; **4K @ 60fps** |
| **2** | Reveal — wave + assembly (field passes)                                                                                                                                       | Reveal visible stripes-on and -off; replays correctly; perf holds              |
| **3** | Sparkle gaps + sparkle width (stripe-pass animations)                                                                                                                         | Look approved; perf holds                                                      |
| **4** | Background flames (CPU sim + GPU additive raster, field merge)                                                                                                                | Look approved; perf holds                                                      |
| **5** | Edge mask (field fade)                                                                                                                                                        | Look approved; perf holds                                                      |
| **6** | Cursor trail / click (GPU ping-pong warp + tear + paint)                                                                                                                      | Trail/push/tear feel approved; perf holds at 4K                                |
| **7** | Letters (glyph atlas + per-cell index + in-shader composite)                                                                                                                  | Letters match intent; char-stable; no per-frame churn; perf holds              |
| **8** | Colors mode (MRT color/coverage side-input + tint/width)                                                                                                                      | Colors look approved; perf holds                                               |
| **9** | SVG + video export; cut the engine into the real studio; retire `packages/stripes-shader` + old docs/rules                                                                    | Export matches screen; studio runs on the new engine; old code removed         |

---

## AI rules / docs reset

The existing `.cursor/rules/*`, `AGENTS.md`, and `docs/*` describe the old Pixi/CPU engine
and are now misleading. Plan:

- **Phase 0:** write a fresh `AGENTS.md` + a new engine architecture rules doc (this file's
  successor) describing the WebGL2 field-first pipeline; quarantine the old `.cursor` rules
  and `docs/*` (move to `docs/legacy/` or mark superseded) so agents stop following them.
- **Phase 9:** delete the legacy rules/docs entirely at cutover.
- **Memory:** the `webgl1-shader-compat` memory is factually wrong (live shaders are ES
  3.00; runtime is WebGL2) — corrected to "WebGL2/ES 3.00 floor." Old-engine memories
  (CPU block grid, Pixi, port 5173, render-field-rules) get superseded as phases land.

---

## Non-goals / open items

- No new visual features beyond the current product's feature set during the rewrite.
- WebGPU is a possible _future_ compute backend behind the same public API — not now.
- Per-phase config shapes are finalized in each phase's own spec (kept clean, not ported).
- The exact `fieldScale` default and the temporal-smoothing cadence are tunable; pinned per
  phase against the perf gate + your visual sign-off.

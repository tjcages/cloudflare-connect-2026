# Shared GL context for `<StripesShader>` (`sharedContext` prop)

Status: in progress (branch: `main`, no commits until user asks)
Owner: feature lives entirely inside `@necatikcl/stripes-engine`.

## Goal

Consumer writes `<StripesShader sharedContext src=... />` (and nothing else) and
every such instance shares ONE WebGL2 context running in ONE Web Worker, instead
of each instance owning its own context. This keeps a page with many shader
sections off the ~16 live-WebGL-context ceiling, moves all GL work off the main
thread (no scroll/React contention), and requires ZERO configuration in the
consumer app.

Non-shared `<StripesShader>` (and `createStripesEngine(canvas)`) behaviour is
UNCHANGED — shared mode is purely additive and opt-in.

## Architecture (de-risked by spike 2026-06-25 — both gates GREEN)

- Singleton **main-thread coordinator** + singleton **worker**, lazily created on
  the first shared instance, torn down when the last shared instance unmounts.
- **Worker** owns ONE `OffscreenCanvas` WebGL2 context (the shared context) and
  hosts one engine instance per registered section, all sharing that context.
  A single rAF loop renders each VISIBLE instance into the shared offscreen, then
  `transferToImageBitmap()` → that instance's display canvas `bitmaprenderer`.
- **Main thread** owns each on-page `<canvas>`, `transferControlToOffscreen()`s it
  to the worker, runs IntersectionObserver (visibility gating) + ResizeObserver,
  decodes media, and relays everything to the worker via the coordinator.
- Display canvases are in normal document flow → compositor scrolls them → no
  scroll desync.

### Locked recipe (from spike — do not re-derive)

- **Worker inlining:** import the worker via `?worker&inline`; add
  `worker: { format: "es" }` to `packages/stripes-engine/vite.config.ts`. Output is
  a single ES file with the worker as an inline Blob/data-URI — NO sibling chunk,
  NO consumer config. Verify after wiring: built `dist/index.js` has the inline
  Blob string and no `*.worker-*.js` sibling.
- **Shared GL context:** `new OffscreenCanvas(w,h).getContext("webgl2",
{ alpha:true, premultipliedAlpha:true, antialias:false })`, then set
  `drawingBufferColorSpace = "display-p3"` and `unpackColorSpace = "display-p3"`
  UNCONDITIONALLY (no `matchMedia` — there is no `window` in a worker).
- **Blit fan-out:** per display canvas — size the shared offscreen to the
  instance, `engine.renderFrame()`, `glCanvas.transferToImageBitmap()`,
  `display.getContext("bitmaprenderer").transferFromImageBitmap(bmp)`. Must
  re-render before each transfer (transferToImageBitmap empties the source).
- **P3 verification:** assert by reading a canvas back through both an `srgb` and
  a `display-p3` 2D context and checking the values DIFFER. ImageBitmap exposes no
  colorSpace metadata; headless screenshots are sRGB-flattened — do not rely on
  either.

## Global constraints (every task)

- **Display-P3 is mandatory**, set unconditionally in the worker context. Never
  gate it behind `matchMedia` on the worker side. Main thread may detect P3 only
  to populate an `isP3` info flag.
- **Zero consumer config** — worker inlined, no separate served file, no Vite
  changes required in the consumer.
- **Standalone path unchanged** — `createStripesEngine(canvas, opts)` and
  non-shared `<StripesShader>` keep identical behaviour; existing tests stay green.
- **No commits** until the user explicitly asks. Implementers leave changes in the
  working tree.
- **Do not touch** the pre-existing uncommitted non-spike changes already in the
  tree (`engine.ts` foreign edits, `config/types.ts`, `config/normalize.ts`+test,
  lab `HexColorPopover.tsx`/`levaSchema.ts`/`colorLibrary.ts`). Build around them.
- **No new unit tests by default** (user rule). Verify via `tsc` typecheck,
  existing `vitest` suite staying green, and the lab + Playwright harness (Task 6).
  Add a unit test only if a task's logic genuinely warrants it.
- Follow the user's styling/codebase rules: object styles not strings, no code
  comments unless asked, `motion` not framer-motion, no `prefers-reduced-motion`
  unless asked.
- Verify with `pir --filter @necatikcl/stripes-engine typecheck` and `pir test`.
  Package manager is `pi`/`pir` only.

## Worker-safety notes (carry into relevant tasks)

- `sourceTexture.ts` uses bare `media instanceof HTMLVideoElement` /
  `HTMLImageElement` — these globals DO NOT EXIST in a worker and will throw.
  Guard with `typeof HTMLVideoElement !== "undefined" && media instanceof …`.
- Worker media must arrive as `ImageBitmap` or `VideoFrame` (both valid
  TexImageSource in workers). `VideoFrame` must be `.close()`d after upload.
- The engine reads `window.devicePixelRatio` and `window.matchMedia` — neither
  exists in a worker. DPR is injected by the host; P3 is set unconditionally.
- The worker must import only the engine CORE (`createStripesEngine` + config),
  never `/react` (which touches the DOM).

## Tasks

### T1 — Engine external-context / worker-safe core

Add an opt-in mode to the engine core so an instance can run with a
host-provided WebGL2 context and host-managed output dimensions, with no canvas
of its own, no internal rAF, and no `window`/`document` access.

- Introduce an internal "render surface" seam: standalone wraps the owned canvas
  (sets `canvas.width/height`, present → null framebuffer); shared takes
  `{ gl, isP3, maxTextureSize }` + host-set `(width,height,dpr)` and presents into
  the shared offscreen back buffer (present pass already targets `null`).
- Shared mode: skip `createEngineContext`, skip canvas mutation, skip canvas
  context-loss listeners, do NOT start an internal rAF; expose `renderFrame()`,
  `resize(w,h)`, `setDpr()`, `setConfig`, `setSource`, `rebuild()` (for host-driven
  context-loss recovery), `dispose()`.
- Make all worker-unsafe global reads (`window`, `matchMedia`,
  `devicePixelRatio`) guarded or injected.
- Public standalone signature/behaviour unchanged.
- Verify: `pir test` green, `pir --filter @necatikcl/stripes-engine typecheck`.

### T2 — Worker host (shared context + render loop + blit)

New worker module in the engine package (e.g. `src/shared/sharedWorker.ts`).

- Owns ONE `OffscreenCanvas` WebGL2 context (P3 unconditional, locked attrs).
- Message protocol (define a typed protocol module shared by worker + coordinator):
  `register{id, canvas(OffscreenCanvas), width, height, dpr, config}`, `resize`,
  `visibility{id, visible}`, `source{id, frame, isStream}`, `config`, `dispose`,
  `terminate`.
- One core engine instance per registration via T1's external-context mode.
- Single rAF loop: for each VISIBLE instance, size the shared offscreen to the
  instance, `renderFrame()`, `transferToImageBitmap()`, blit into that instance's
  transferred display canvas via `bitmaprenderer`.
- Context-loss on the shared context → rebuild all instances.
- Keep last frame for paused instances (don't clear their display canvas).

### T3 — Media transport (image + video) into the worker

- Worker-safe source upload: fix `sourceTexture.ts` instanceof guards; add a
  streaming path that re-uploads a fresh `ImageBitmap`/`VideoFrame` into the
  existing texture and `.close()`s `VideoFrame`s.
- Coordinator side: image → `createImageBitmap` once → transfer →
  `source{isStream:false}`. Video → main-thread `<video>` +
  `requestVideoFrameCallback` → `createImageBitmap(video)` per frame → transfer →
  `source{isStream:true}`; stop the pump when the instance is offscreen.
- Preserve P3 unpack on upload.

### T4 — Main-thread singleton coordinator

`src/shared/coordinator.ts` (+ the inlined worker import).

- Lazy boot the inlined worker on first registration; terminate on last unmount.
- `transferControlToOffscreen()` each display canvas; relay register/resize/
  visibility/source/dispose.
- IntersectionObserver (with generous `rootMargin` preload) → visibility messages;
  ResizeObserver → resize messages; read `devicePixelRatio` and pass it in.
- Manage media pumps (T3) per instance keyed by id.

### T5 — `sharedContext` prop on `<StripesShader>`

- Add `sharedContext?: boolean`. When true, the component renders its `<canvas>`
  and registers via the coordinator (passing src/mediaKind/config), instead of
  `createStripesEngine`. Same props otherwise. Cleanup unregisters.
- Keep `"use client"`; the canvas must be SSR-safe (Astro `client:only` will mount
  it). All worker/coordinator work happens in `useEffect`.

### T6 — Lab harness + Playwright verification

- A lab route mounting several `<StripesShader sharedContext>` (mix of image and
  video sources).
- Playwright (headless chromium, GPU flags as in spike) asserts: exactly ONE
  worker / ONE GL context for all shared instances, no console/page errors, P3
  survives (sRGB-vs-P3 readback divergence per canvas), video instances animate.
- Build the engine lib and confirm the worker is still inlined (no sibling chunk).

### T7 — Delete spike files

Remove all `spike-*` throwaway files listed in the spike report. Leave the
pre-existing foreign changes alone.

import { type Clock, createRealClock } from "./core/clock";
import { createEngineContext } from "./gl/context";
import { createFullscreenQuad } from "./gl/program";
import { resolveOutputSize, resolveFieldSize, type Size } from "./gl/resolution";
import { createSourceFieldPass } from "./passes/sourceFieldPass";
import { createPresentPass } from "./passes/presentPass";
import { createDownsamplePass } from "./passes/downsamplePass";
import { createStripePass } from "./passes/stripePass";
import { createGpuTimer } from "./perf/gpuTimer";
import { createPerfCollector, type PerfSnapshot } from "./perf/perfCollector";
import { createRtPool, type RtPool } from "./pipeline/rtPool";
import { runPipeline, type Pass } from "./pipeline/pipeline";
import { normalizeEngineConfig } from "./config/normalize";
import type { EngineConfig } from "./config/types";
import { createSourceTexture, type EngineSource, type SourceTexture } from "./source/sourceTexture";
import { resolveSourceRect } from "./source/fit";
import { resolveCellGrid, type CellGrid } from "./config/cellGrid";
import { buildStripeLut, lutSignature } from "./field/stripeLut";
import { createDataTexture, updateDataTexture } from "./gl/dataTexture";

export type EngineOptions = { clock?: Clock; seed?: number; dpr?: number; fieldScale?: number };
export type StripesEngine = {
  resize(cssWidth: number, cssHeight: number): void;
  renderFrame(): void;
  start(): void;
  stop(): void;
  setFieldScale(s: number): void;
  setSource(media: EngineSource | null): void;
  setConfig(partial: Partial<EngineConfig>): void;
  readOutputPixels(): Uint8Array;
  getPerf(): PerfSnapshot;
  dispose(): void;
  readonly isP3: boolean;
};

export function createStripesEngine(canvas: HTMLCanvasElement, opts: EngineOptions = {}): StripesEngine {
  const clock = opts.clock ?? createRealClock();
  let fieldScale = opts.fieldScale ?? 0.5;
  let cssW = canvas.clientWidth || 800;
  let cssH = canvas.clientHeight || 600;

  let { gl, isP3, maxTextureSize } = createEngineContext(canvas);
  let output: Size = { width: 0, height: 0 };
  let fieldSize: Size = { width: 2, height: 2 };
  let cellGrid: CellGrid = { cols: 1, rows: 1 };

  let quad = createFullscreenQuad(gl);
  let pool: RtPool = createRtPool(gl);
  let passes: Pass[] = [];
  let gpuTimer = createGpuTimer(gl);
  const perf = createPerfCollector();

  let source: SourceTexture | null = null;
  let config = normalizeEngineConfig({});

  let stripeLutTex: WebGLTexture | null = null;
  let lutSig = "";

  let rafId = 0;
  let lastFrameStart = clock.now();
  let lost = false;
  let lastStripesEnabled = config.stripesEnabled;

  function getDpr() {
    return opts.dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1) ?? 1;
  }

  function ensureLut() {
    const active = config.field.mode === "overlay" ? config.overlayStripes : config.stripes;
    const sig = lutSignature(active);
    if (sig !== lutSig) {
      const bytes = buildStripeLut(active);
      if (stripeLutTex) {
        updateDataTexture(gl, stripeLutTex, bytes, 256, 1);
      } else {
        stripeLutTex = createDataTexture(gl, bytes, 256, 1);
      }
      lutSig = sig;
    }
  }

  function buildPasses() {
    for (const p of passes) p.dispose();
    const sourceFieldPass = createSourceFieldPass(gl, quad);
    const fieldPass: Pass = {
      name: "field",
      render: () => {
        const fieldTarget = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
        if (source) {
          source.update();
          const srcRect = resolveSourceRect(
            source.width,
            source.height,
            output.width,
            output.height,
            config.transform.fit,
            config.transform.zoom,
            config.transform.panX,
            config.transform.panY,
          );
          sourceFieldPass.render(fieldTarget, source.texture, {
            srcRect,
            adjustments: config.adjustments,
            overlay: config.field.mode === "overlay",
            background: config.background.color,
            sourceTexelW: 1 / source.width,
            sourceTexelH: 1 / source.height,
          });
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fieldTarget.fbo);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      },
      dispose: () => sourceFieldPass.dispose(),
    };

    if (config.stripesEnabled) {
      const downsamplePass = createDownsamplePass(gl, quad);
      const stripePass = createStripePass(gl, quad);
      passes = [
        fieldPass,
        {
          name: "downsample",
          render: () => {
            const { cols, rows } = cellGrid;
            const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
            const cellRT = pool.get("cell", cols, rows);
            downsamplePass.render(cellRT, fieldRT.texture, cols, rows);
          },
          dispose: () => downsamplePass.dispose(),
        },
        {
          name: "stripe",
          render: () => {
            const { cols, rows } = cellGrid;
            const cellRT = pool.get("cell", cols, rows);
            stripePass.render(
              cellRT.texture,
              stripeLutTex!,
              {
                cellW: config.grid.cellWidth,
                cellH: config.grid.cellHeight,
                gapX: config.grid.gapX,
                gapY: config.grid.gapY,
                cornerRadius: config.grid.cornerRadius,
                orientation: config.grid.orientation === "horizontal" ? 1 : 0,
                cols,
                rows,
                background: config.background.color,
              },
              output.width,
              output.height,
            );
          },
          dispose: () => stripePass.dispose(),
        },
      ];
    } else {
      const presentPass = createPresentPass(gl, quad);
      passes = [
        fieldPass,
        {
          name: "present",
          render: () =>
            presentPass.render(
              pool.get("field", fieldSize.width, fieldSize.height, { linear: true }).texture,
              output.width,
              output.height,
            ),
          dispose: () => presentPass.dispose(),
        },
      ];
    }
  }

  function applySizes() {
    const dpr = getDpr();
    output = resolveOutputSize(cssW, cssH, dpr, maxTextureSize);
    if (canvas.width !== output.width) canvas.width = output.width;
    if (canvas.height !== output.height) canvas.height = output.height;
    fieldSize = resolveFieldSize(output, fieldScale);
    pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
    cellGrid = resolveCellGrid(cssW, cssH, config.grid.cellWidth, config.grid.cellHeight);
    pool.get("cell", cellGrid.cols, cellGrid.rows);
  }

  function rebuildGpuResources() {
    // Context loss already invalidated the old GL objects (pool, passes, source); disposing them would no-op or error against the dead context, so we drop and recreate. Do not add teardown here without guarding for the lost context.
    const ctx = createEngineContext(canvas);
    gl = ctx.gl;
    isP3 = ctx.isP3;
    maxTextureSize = ctx.maxTextureSize;
    quad = createFullscreenQuad(gl);
    pool = createRtPool(gl);
    gpuTimer = createGpuTimer(gl);
    // Source texture is bound to the old GL context; null it so the caller
    // can re-set it. The SourceTexture.dispose() call is intentionally skipped
    // here because the old context is already lost and the GPU objects are gone.
    source = null;
    // LUT texture is on the old context; reset so ensureLut() recreates it.
    stripeLutTex = null;
    lutSig = "";
    ensureLut();
    buildPasses();
    applySizes();
  }

  function onLost(e: Event) {
    e.preventDefault();
    lost = true;
  }
  function onRestored() {
    lost = false;
    rebuildGpuResources();
  }
  canvas.addEventListener("webglcontextlost", onLost as EventListener, false);
  canvas.addEventListener("webglcontextrestored", onRestored as EventListener, false);

  ensureLut();
  buildPasses();
  applySizes();

  function renderFrame() {
    if (lost) return;
    const t0 = clock.now();
    gpuTimer.poll();
    runPipeline(passes, gpuTimer);
    gl.flush();
    const frameMs = clock.now() - lastFrameStart;
    lastFrameStart = t0;
    perf.recordFrame(frameMs);
    perf.recordPasses(gpuTimer.latest());
  }

  function loop() {
    renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  return {
    get isP3() {
      return isP3;
    },
    resize(w, h) {
      cssW = w;
      cssH = h;
      applySizes();
    },
    setFieldScale(s) {
      fieldScale = s;
      applySizes();
    },
    setSource(media) {
      source?.dispose();
      source = media ? createSourceTexture(gl, media) : null;
    },
    setConfig(partial) {
      config = normalizeEngineConfig({ ...config, ...partial });
      ensureLut();
      applySizes();
      if (config.stripesEnabled !== lastStripesEnabled) {
        buildPasses();
        lastStripesEnabled = config.stripesEnabled;
      }
    },
    renderFrame,
    start() {
      if (!rafId) {
        lastFrameStart = clock.now();
        rafId = requestAnimationFrame(loop);
      }
    },
    stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
    readOutputPixels() {
      const px = new Uint8Array(output.width * output.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, output.width, output.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    },
    getPerf() {
      return perf.snapshot();
    },
    dispose() {
      this.stop();
      canvas.removeEventListener("webglcontextlost", onLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onRestored as EventListener);
      for (const p of passes) p.dispose();
      pool.dispose();
      quad.dispose();
      source?.dispose();
      if (stripeLutTex) {
        gl.deleteTexture(stripeLutTex);
        stripeLutTex = null;
      }
    },
  };
}

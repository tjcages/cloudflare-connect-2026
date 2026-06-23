import { type Clock, createRealClock } from "./core/clock";
import { createEngineContext } from "./gl/context";
import { createFullscreenQuad } from "./gl/program";
import { resolveOutputSize, resolveFieldSize, type Size } from "./gl/resolution";
import { createSourceFieldPass } from "./passes/sourceFieldPass";
import { createPresentPass } from "./passes/presentPass";
import { createDownsamplePass } from "./passes/downsamplePass";
import { createRevealPass } from "./passes/revealPass";
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
import { originForPosition, resolveRevealDurationMs, resolveBandRamp } from "./reveal/revealMath";
import type { AssemblyOrder } from "./config/types";

const ASSEMBLY_ORDER_INDEX: Record<AssemblyOrder, number> = {
  center: 0,
  edges: 1,
  sweep: 2,
  random: 3,
};

export type EngineOptions = { clock?: Clock; seed?: number; dpr?: number; fieldScale?: number };
export type StripesEngine = {
  resize(cssWidth: number, cssHeight: number): void;
  renderFrame(): void;
  start(): void;
  stop(): void;
  setFieldScale(s: number): void;
  setSource(media: EngineSource | null): void;
  setConfig(partial: Partial<EngineConfig>): void;
  triggerReveal(): void;
  readOutputPixels(): Uint8Array;
  getPerf(): PerfSnapshot;
  dispose(): void;
  readonly isP3: boolean;
};

export function createStripesEngine(canvas: HTMLCanvasElement, opts: EngineOptions = {}): StripesEngine {
  const clock = opts.clock ?? createRealClock();
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
  let config = normalizeEngineConfig({ fieldScale: opts.fieldScale });

  let stripeLutTex: WebGLTexture | null = null;
  let lutSig = "";

  let rafId = 0;
  let lastFrameStart = clock.now();
  let lost = false;
  let lastStripesEnabled = config.stripesEnabled;
  let lastRevealEnabled = config.reveal.enabled;
  let revealStartMs = 0;

  function getDpr() {
    return opts.dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1) ?? 1;
  }

  function ensureLut() {
    const sig = lutSignature(config.stripes);
    if (sig !== lutSig) {
      const bytes = buildStripeLut(config.stripes);
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
      const midPasses: Pass[] = [];
      const stripeInputRT = config.reveal.enabled ? "reveal" : "cell";
      if (config.reveal.enabled) {
        const revealPass = createRevealPass(gl, quad);
        midPasses.push({
          name: "reveal",
          render: () => {
            const { cols, rows } = cellGrid;
            const cellRT = pool.get("cell", cols, rows);
            const revealRT = pool.get("reveal", cols, rows);
            const durationMs = resolveRevealDurationMs(config.reveal);
            const progress = (clock.now() - revealStartMs) / durationMs;
            if (config.reveal.type === "assembly") {
              const { assembly } = config.reveal;
              const dur = Math.max(1, assembly.staggerMs + assembly.speedMaxMs);
              const speedMin = Math.max(0, assembly.speedMinMs);
              const speedMax = Math.max(speedMin, assembly.speedMaxMs);
              const avgTotal = Math.min(0.98, Math.max(0.05, (speedMin + speedMax) / 2 / dur));
              const spread = assembly.staggerMs / dur;
              const bandRamp = resolveBandRamp(durationMs);
              revealPass.render(revealRT, cellRT.texture, cols, rows, {
                revealMode: 2,
                origin: [0, 0],
                maxDist: 1,
                progress,
                softness: 0,
                waviness: 0,
                noiseScale: 1,
                bandRamp,
                order: ASSEMBLY_ORDER_INDEX[assembly.order],
                avgTotal,
                spread,
              });
            } else {
              const [ox, oy] = originForPosition(config.reveal.wave.position);
              const maxDist = Math.max(
                Math.hypot(ox, oy),
                Math.hypot(1 - ox, oy),
                Math.hypot(ox, 1 - oy),
                Math.hypot(1 - ox, 1 - oy),
                0.0001,
              );
              const bandRamp = resolveBandRamp(config.reveal.wave.durationMs);
              revealPass.render(revealRT, cellRT.texture, cols, rows, {
                revealMode: 1,
                origin: [ox, oy],
                maxDist,
                progress,
                softness: config.reveal.wave.softness,
                waviness: config.reveal.wave.waviness,
                noiseScale: config.reveal.wave.noiseScale,
                bandRamp,
                order: 0,
                avgTotal: 0,
                spread: 0,
              });
            }
          },
          dispose: () => revealPass.dispose(),
        });
      }
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
        ...midPasses,
        {
          name: "stripe",
          render: () => {
            const { cols, rows } = cellGrid;
            const inputRT = pool.get(stripeInputRT, cols, rows);
            stripePass.render(
              inputRT.texture,
              stripeLutTex!,
              {
                cellW: config.grid.cellWidth,
                cellH: config.grid.cellHeight,
                cornerRadius: config.grid.cornerRadius,
                orientation: config.grid.orientation === "horizontal" ? 1 : 0,
                cols,
                rows,
                background: config.background.color,
                dpr: getDpr(),
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
    fieldSize = resolveFieldSize(output, config.fieldScale);
    pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
    cellGrid = resolveCellGrid(cssW, cssH, config.grid.cellWidth, config.grid.cellHeight);
    pool.get("cell", cellGrid.cols, cellGrid.rows);
    if (config.reveal.enabled) {
      pool.get("reveal", cellGrid.cols, cellGrid.rows);
    }
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
      this.setConfig({ fieldScale: s });
    },
    setSource(media) {
      source?.dispose();
      source = media ? createSourceTexture(gl, media) : null;
    },
    setConfig(partial) {
      config = normalizeEngineConfig({ ...config, ...partial });
      ensureLut();
      applySizes();
      if (config.stripesEnabled !== lastStripesEnabled || config.reveal.enabled !== lastRevealEnabled) {
        buildPasses();
        lastStripesEnabled = config.stripesEnabled;
        lastRevealEnabled = config.reveal.enabled;
      }
    },
    triggerReveal() {
      revealStartMs = clock.now();
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

import { type Clock, createRealClock } from "./core/clock";
import { createEngineContext } from "./gl/context";
import { createFullscreenQuad } from "./gl/program";
import { resolveOutputSize, resolveFieldSize, type Size } from "./gl/resolution";
import { createFieldPass } from "./passes/fieldPass";
import { createPresentPass } from "./passes/presentPass";
import { createGpuTimer } from "./perf/gpuTimer";
import { createPerfCollector, type PerfSnapshot } from "./perf/perfCollector";
import { createRtPool, type RtPool } from "./pipeline/rtPool";
import { runPipeline, type Pass } from "./pipeline/pipeline";

export type EngineOptions = { clock?: Clock; seed?: number; dpr?: number; fieldScale?: number };
export type StripesEngine = {
  resize(cssWidth: number, cssHeight: number): void;
  renderFrame(): void;
  start(): void;
  stop(): void;
  setFieldScale(s: number): void;
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

  let quad = createFullscreenQuad(gl);
  let pool: RtPool = createRtPool(gl);
  let passes: Pass[] = [];
  let gpuTimer = createGpuTimer(gl);
  const perf = createPerfCollector();

  let rafId = 0;
  let lastFrameStart = clock.now();
  let lost = false;

  function buildPasses() {
    for (const p of passes) p.dispose();
    const fieldPass = createFieldPass(gl, quad);
    const presentPass = createPresentPass(gl, quad);
    passes = [
      {
        name: "field",
        render: () =>
          fieldPass.render(pool.get("field", fieldSize.width, fieldSize.height, { linear: true }), clock.now()),
        dispose: () => fieldPass.dispose(),
      },
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

  function applySizes() {
    const dpr = opts.dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1) ?? 1;
    output = resolveOutputSize(cssW, cssH, dpr, maxTextureSize);
    canvas.width = output.width;
    canvas.height = output.height;
    fieldSize = resolveFieldSize(output, fieldScale);
    pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
  }

  function rebuildGpuResources() {
    const ctx = createEngineContext(canvas);
    gl = ctx.gl;
    isP3 = ctx.isP3;
    maxTextureSize = ctx.maxTextureSize;
    quad = createFullscreenQuad(gl);
    pool = createRtPool(gl);
    gpuTimer = createGpuTimer(gl);
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
    },
  };
}

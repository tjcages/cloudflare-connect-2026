import { type Clock, createRealClock } from "./core/clock";
import { createEngineContext } from "./gl/context";
import { createFullscreenQuad } from "./gl/program";
import { type RenderTarget, createRenderTarget, resizeRenderTarget, disposeRenderTarget } from "./gl/renderTarget";
import { resolveOutputSize, resolveFieldSize, type Size } from "./gl/resolution";
import { createFieldPass } from "./passes/fieldPass";
import { createPresentPass } from "./passes/presentPass";
import { createGpuTimer } from "./perf/gpuTimer";
import { createPerfCollector, type PerfSnapshot } from "./perf/perfCollector";

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

  let quad = createFullscreenQuad(gl);
  let fieldPass = createFieldPass(gl, quad);
  let presentPass = createPresentPass(gl, quad);
  let fieldRT: RenderTarget = createRenderTarget(gl, 2, 2, { linear: true });
  let gpuTimer = createGpuTimer(gl);
  const perf = createPerfCollector();

  let rafId = 0;
  let lastFrameStart = clock.now();
  let lost = false;

  function applySizes() {
    const dpr = opts.dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1) ?? 1;
    output = resolveOutputSize(cssW, cssH, dpr, maxTextureSize);
    canvas.width = output.width;
    canvas.height = output.height;
    const field = resolveFieldSize(output, fieldScale);
    resizeRenderTarget(gl, fieldRT, field.width, field.height);
  }

  function rebuildGpuResources() {
    const ctx = createEngineContext(canvas);
    gl = ctx.gl;
    isP3 = ctx.isP3;
    maxTextureSize = ctx.maxTextureSize;
    quad = createFullscreenQuad(gl);
    fieldPass = createFieldPass(gl, quad);
    presentPass = createPresentPass(gl, quad);
    fieldRT = createRenderTarget(gl, 2, 2, { linear: true });
    gpuTimer = createGpuTimer(gl);
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

  applySizes();

  function renderFrame() {
    if (lost) return;
    const t0 = clock.now();
    gpuTimer.poll();
    const time = clock.now();

    gpuTimer.begin("field");
    fieldPass.render(fieldRT, time);
    gpuTimer.end();

    gpuTimer.begin("present");
    presentPass.render(fieldRT.texture, output.width, output.height);
    gpuTimer.end();

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
      fieldPass.dispose();
      presentPass.dispose();
      quad.dispose();
      disposeRenderTarget(gl, fieldRT);
    },
  };
}

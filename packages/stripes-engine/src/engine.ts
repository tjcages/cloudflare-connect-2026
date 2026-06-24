import { type Clock, createRealClock } from "./core/clock";
import { createEngineContext } from "./gl/context";
import { createFullscreenQuad } from "./gl/program";
import { resolveOutputSize, resolveFieldSize, type Size } from "./gl/resolution";
import { createSourceFieldPass } from "./passes/sourceFieldPass";
import { createPresentPass } from "./passes/presentPass";
import { createDownsamplePass } from "./passes/downsamplePass";
import { createRevealPass } from "./passes/revealPass";
import { createAssemblyScatterPass } from "./passes/assemblyScatterPass";
import { createBlurPass } from "./passes/blurPass";
import { createAssemblyCompositePass } from "./passes/assemblyCompositePass";
import { createStripePass } from "./passes/stripePass";
import { createFlamesPass } from "./passes/flamesPass";
import { createEdgeMaskPass } from "./passes/edgeMaskPass";
import { createCursorSplatPass } from "./passes/cursorSplatPass";
import { createCursorTearPass } from "./passes/cursorTearPass";
import { createCursorWarpPass } from "./passes/cursorWarpPass";
import { createClickSplatPass } from "./passes/clickSplatPass";
import {
  createCursorTrailState,
  setCursorTrailTarget,
  updateCursorTrail,
  type CursorTrailState,
} from "./cursorTrail/cursorTrailSim";
import { createClickWaveState, addClickWave, updateClickWave, type ClickWaveState } from "./cursorTrail/clickWaveSim";
import {
  createFlamesState,
  stepFlames,
  flamesGradientStops,
  isVerticalFlamesDirection,
  mulberry32,
  type FlamesState,
} from "./flames/flamesSim";
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
import { bindRenderTarget } from "./gl/renderTarget";
import { originForPosition, resolveRevealDurationMs, resolveBandRamp } from "./reveal/revealMath";

const CURSOR_TRAIL_MAX_PUSH_CELLS = 2;
const CLICK_WAVE_MAX_PUSH_CELLS = 6;

export type EngineOptions = { clock?: Clock; seed?: number; dpr?: number; fieldScale?: number };
export type StripesEngine = {
  resize(cssWidth: number, cssHeight: number): void;
  renderFrame(): void;
  start(): void;
  stop(): void;
  setFieldScale(s: number): void;
  setSource(media: EngineSource | null): void;
  setConfig(partial: Partial<EngineConfig>): void;
  setCursor(x: number | null, y?: number): void;
  click(x: number, y?: number): void;
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
  let lastAssemblyTopo = config.reveal.enabled && config.reveal.type === "assembly";
  let lastFlamesEnabled = config.flames.enabled;
  let lastEdgeMaskEnabled = config.edgeMask.enabled;
  let lastCursorTrailEnabled = config.cursorTrail.enabled;
  let lastClickWaveEnabled = config.clickWave.enabled;
  let revealStartMs = 0;

  const flamesSeed = (opts.seed ?? 1) >>> 0;
  let flamesState: FlamesState = createFlamesState(mulberry32(flamesSeed));

  let cursorTrailState: CursorTrailState = createCursorTrailState();
  let clickWaveState: ClickWaveState = createClickWaveState();
  let lastCursorMs = clock.now();

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

    const flamesFieldPasses: Pass[] = [];
    if (config.flames.enabled) {
      const flamesPass = createFlamesPass(gl);
      flamesFieldPasses.push({
        name: "flamesField",
        render: () => {
          stepFlames(flamesState, config.flames, { width: cssW, height: cssH }, clock.now());
          const { inner, outer } = flamesGradientStops(config.flames.edgeSharpness);
          const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
          flamesPass.render(fieldRT, flamesState.flames, {
            canvasW: cssW,
            canvasH: cssH,
            vertical: isVerticalFlamesDirection(config.flames.direction),
            inner,
            outer,
          });
        },
        dispose: () => flamesPass.dispose(),
      });
    }

    const revealEnabled = config.reveal.enabled;
    const assemblyTopology = revealEnabled && config.reveal.type === "assembly";
    let activeFieldRT = revealEnabled ? "revealedField" : "field";
    const revealFieldPasses: Pass[] = [];

    const MAX_BLUR_PX = 5;
    if (assemblyTopology) {
      const scatterPass = createAssemblyScatterPass(gl);
      const blurPass = createBlurPass(gl, quad);
      const compositePass = createAssemblyCompositePass(gl, quad);
      revealFieldPasses.push({
        name: "assemblyScatterField",
        render: () => {
          const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
          const assembledRT = pool.get("assembledField", fieldSize.width, fieldSize.height, { linear: true });
          const { assembly } = config.reveal;
          const durationMs = resolveRevealDurationMs(config.reveal);
          const rawProgress = (clock.now() - revealStartMs) / durationMs;
          const progress = Math.max(0, Math.min(1, rawProgress));
          const dur = Math.max(1, assembly.staggerMs + assembly.speedMaxMs);
          const speedMin = Math.max(0, assembly.speedMinMs);
          const speedMax = Math.max(speedMin, assembly.speedMaxMs);
          const avgTotal = Math.min(0.98, Math.max(0.05, (speedMin + speedMax) / 2 / dur));
          const spread = assembly.staggerMs / dur;
          const sliceSizePx = Math.max(1, assembly.sliceSizePx);
          const blockCols = Math.max(1, Math.ceil(cssW / sliceSizePx));
          const blockRows = Math.max(1, Math.ceil(cssH / sliceSizePx));
          scatterPass.render(assembledRT, fieldRT.texture, {
            blockCols,
            blockRows,
            progress: rawProgress,
            spread,
            flight: avgTotal,
            spawnDist: 1.6,
            scatter: [assembly.scatterPx / Math.max(1, cssW), assembly.scatterPx / Math.max(1, cssH)],
            angleJitter: (assembly.angleJitterDeg * Math.PI) / 180,
          });

          const revealedRT = pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
          const moveEnd = Math.min(1, spread + avgTotal);
          if (progress >= moveEnd) {
            // Every cell has landed → crisp field, no blur (byte-exact identity).
            blurPass.copy(assembledRT.texture, revealedRT);
          } else {
            // Full-strength Gaussian; the composite reveals it crisp per-cell as each cell lands.
            const blurredRT = pool.get("assemblyBlurred", fieldSize.width, fieldSize.height, { linear: true });
            const blurTempRT = pool.get("blurTemp", fieldSize.width, fieldSize.height, { linear: true });
            blurPass.render(assembledRT.texture, blurTempRT, blurredRT, MAX_BLUR_PX, fieldSize);
            compositePass.render(revealedRT, assembledRT.texture, blurredRT.texture, {
              blockCols,
              blockRows,
              progress: rawProgress,
              spread,
              flight: avgTotal,
            });
          }
        },
        dispose: () => {
          scatterPass.dispose();
          blurPass.dispose();
          compositePass.dispose();
        },
      });
    } else if (revealEnabled) {
      const revealPass = createRevealPass(gl, quad);
      revealFieldPasses.push({
        name: "revealField",
        render: () => {
          const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
          const revealedRT = pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
          const { cols, rows } = cellGrid;
          const durationMs = resolveRevealDurationMs(config.reveal);
          const progress = (clock.now() - revealStartMs) / durationMs;
          const [ox, oy] = originForPosition(config.reveal.wave.position);
          const maxDist = Math.max(
            Math.hypot(ox, oy),
            Math.hypot(1 - ox, oy),
            Math.hypot(ox, 1 - oy),
            Math.hypot(1 - ox, 1 - oy),
            0.0001,
          );
          const bandRamp = resolveBandRamp(config.reveal.wave.durationMs);
          revealPass.render(revealedRT, fieldRT.texture, cols, rows, {
            revealMode: 1,
            origin: [ox, oy],
            maxDist,
            progress,
            softness: config.reveal.wave.softness,
            waviness: config.reveal.wave.waviness,
            bandRamp,
          });
        },
        dispose: () => revealPass.dispose(),
      });
    }

    const edgeMaskFieldPasses: Pass[] = [];
    if (config.edgeMask.enabled) {
      const edgeMaskPass = createEdgeMaskPass(gl, quad);
      const srcRT = activeFieldRT;
      edgeMaskFieldPasses.push({
        name: "edgeMaskField",
        render: () => {
          const srcTex = pool.get(srcRT, fieldSize.width, fieldSize.height, { linear: true }).texture;
          const maskedRT = pool.get("maskedField", fieldSize.width, fieldSize.height, { linear: true });
          edgeMaskPass.render(maskedRT, srcTex, {
            start: config.edgeMask.start,
            end: config.edgeMask.end,
            power: config.edgeMask.power,
          });
        },
        dispose: () => edgeMaskPass.dispose(),
      });
      activeFieldRT = "maskedField";
    }

    const cursorFieldPasses: Pass[] = [];
    if (config.cursorTrail.enabled || config.clickWave.enabled) {
      const trailEnabled = config.cursorTrail.enabled;
      const clickEnabled = config.clickWave.enabled;
      const splatPass = trailEnabled ? createCursorSplatPass(gl) : null;
      const clickSplatPass = clickEnabled ? createClickSplatPass(gl) : null;
      const tearPass = createCursorTearPass(gl, quad);
      const warpPass = createCursorWarpPass(gl, quad);
      const srcRT = activeFieldRT;
      cursorFieldPasses.push({
        name: "cursorField",
        render: () => {
          const dt = clock.now() - lastCursorMs;
          lastCursorMs = clock.now();
          const { cols, rows } = cellGrid;
          const scale = cols / Math.max(1, cssW);
          const trailCap = trailEnabled
            ? Math.min(CURSOR_TRAIL_MAX_PUSH_CELLS, config.cursorTrail.pushStrengthPx * scale)
            : 0;
          const clickCap = clickEnabled
            ? Math.min(CLICK_WAVE_MAX_PUSH_CELLS, config.clickWave.pushStrengthPx * scale)
            : 0;
          const pushCap = Math.max(trailCap, clickCap);

          const accumRT = pool.get("cursorAccum", cols, rows, { float: true });
          bindRenderTarget(gl, accumRT);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          if (splatPass) {
            const { samples } = updateCursorTrail(cursorTrailState, dt, config.cursorTrail);
            const pushScale = (config.cursorTrail.pushStrengthPx * cols) / Math.max(1, cssW);
            splatPass.render(accumRT, samples, {
              cols,
              rows,
              displayWidth: cssW,
              displayHeight: cssH,
              pushRadiusScale: config.cursorTrail.pushRadiusScale,
              pushScale,
            });
          }

          if (clickSplatPass) {
            const { samples } = updateClickWave(clickWaveState, dt, config.clickWave);
            const pushScale = (config.clickWave.pushStrengthPx * cols) / Math.max(1, cssW);
            clickSplatPass.render(accumRT, samples, {
              cols,
              rows,
              displayWidth: cssW,
              displayHeight: cssH,
              pushScale,
              pushBandScale: config.clickWave.pushBandScale,
              stripeWhiteAlpha: config.clickWave.stripeWhiteAlpha,
            });
          }

          const tearRT = pool.get("cursorTear", cols, rows);
          tearPass.render(tearRT, accumRT.texture, { cols, rows, pushCap });

          const srcTex = pool.get(srcRT, fieldSize.width, fieldSize.height, { linear: true }).texture;
          const warpedRT = pool.get("cursorField", fieldSize.width, fieldSize.height, { linear: true });
          warpPass.render(warpedRT, srcTex, accumRT.texture, tearRT.texture, {
            cols,
            rows,
            cellW: cssW / Math.max(1, cols),
            cellH: cssH / Math.max(1, rows),
            pixelW: cssW,
            pixelH: cssH,
            pushCap,
          });
        },
        dispose: () => {
          splatPass?.dispose();
          clickSplatPass?.dispose();
          tearPass.dispose();
          warpPass.dispose();
        },
      });
      activeFieldRT = "cursorField";
    }

    if (config.stripesEnabled) {
      const downsamplePass = createDownsamplePass(gl, quad);
      const stripePass = createStripePass(gl, quad);
      passes = [
        fieldPass,
        ...flamesFieldPasses,
        ...revealFieldPasses,
        ...edgeMaskFieldPasses,
        ...cursorFieldPasses,
        {
          name: "downsample",
          render: () => {
            const { cols, rows } = cellGrid;
            const fieldRT = pool.get(activeFieldRT, fieldSize.width, fieldSize.height, { linear: true });
            const cellRT = pool.get("cell", cols, rows);
            downsamplePass.render(cellRT, fieldRT.texture, cols, rows);
          },
          dispose: () => downsamplePass.dispose(),
        },
        {
          name: "stripe",
          render: () => {
            const { cols, rows } = cellGrid;
            const inputRT = pool.get("cell", cols, rows);
            const timeSec = clock.now() / 1000;
            const gapSpeed = Math.max(0.05, config.sparkle.gaps.speed);
            const gapPeriodMin = 0.21 / gapSpeed;
            const gapPeriodMax = 0.55 / gapSpeed;
            const widthSpeed = Math.max(0.05, config.sparkle.width.speed);
            const shufflePeriodMin = 0.21 / widthSpeed;
            const shufflePeriodMax = 0.55 / widthSpeed;
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
                timeSec,
                gapEnabled: config.sparkle.gaps.enabled,
                gapCoverage: config.sparkle.gaps.coverage,
                gapPeriodMin,
                gapPeriodMax,
                shuffleEnabled: config.sparkle.width.enabled,
                shuffleCoverage: config.sparkle.width.coverage,
                shufflePeriodMin,
                shufflePeriodMax,
                shuffleSwingPx: config.sparkle.width.swingPx,
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
        ...flamesFieldPasses,
        ...revealFieldPasses,
        ...edgeMaskFieldPasses,
        ...cursorFieldPasses,
        {
          name: "present",
          render: () =>
            presentPass.render(
              pool.get(activeFieldRT, fieldSize.width, fieldSize.height, { linear: true }).texture,
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
      pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
      if (config.reveal.type === "assembly") {
        pool.get("assembledField", fieldSize.width, fieldSize.height, { linear: true });
        pool.get("blurTemp", fieldSize.width, fieldSize.height, { linear: true });
      }
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
    flamesState = createFlamesState(mulberry32(flamesSeed));
    cursorTrailState = createCursorTrailState();
    clickWaveState = createClickWaveState();
    lastCursorMs = clock.now();
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
      const assemblyTopo = config.reveal.enabled && config.reveal.type === "assembly";
      if (
        config.stripesEnabled !== lastStripesEnabled ||
        config.reveal.enabled !== lastRevealEnabled ||
        assemblyTopo !== lastAssemblyTopo ||
        config.flames.enabled !== lastFlamesEnabled ||
        config.edgeMask.enabled !== lastEdgeMaskEnabled ||
        config.cursorTrail.enabled !== lastCursorTrailEnabled ||
        config.clickWave.enabled !== lastClickWaveEnabled
      ) {
        if (config.flames.enabled && !lastFlamesEnabled) {
          flamesState = createFlamesState(mulberry32(flamesSeed));
        }
        if (config.cursorTrail.enabled && !lastCursorTrailEnabled) {
          cursorTrailState = createCursorTrailState();
          lastCursorMs = clock.now();
        }
        if (config.clickWave.enabled && !lastClickWaveEnabled) {
          clickWaveState = createClickWaveState();
          lastCursorMs = clock.now();
        }
        buildPasses();
        lastStripesEnabled = config.stripesEnabled;
        lastRevealEnabled = config.reveal.enabled;
        lastAssemblyTopo = assemblyTopo;
        lastFlamesEnabled = config.flames.enabled;
        lastEdgeMaskEnabled = config.edgeMask.enabled;
        lastCursorTrailEnabled = config.cursorTrail.enabled;
        lastClickWaveEnabled = config.clickWave.enabled;
      }
    },
    setCursor(x, y) {
      if (x === null) {
        setCursorTrailTarget(cursorTrailState, null);
      } else {
        setCursorTrailTarget(cursorTrailState, { x, y: y ?? 0 });
      }
    },
    click(x, y) {
      addClickWave(clickWaveState, { x, y: y ?? 0 }, config.clickWave.lifeMs);
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

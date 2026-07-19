import { type Clock, createRealClock } from "./core/clock";
import { createFrameCapState, shouldRenderFrame } from "./core/frameCap";
import type { EngineContext } from "./gl/context";
import { createCanvasSurface, createSharedSurface, type RenderSurface } from "./gl/renderSurface";
import { createFullscreenQuad } from "./gl/program";
import { resolveOutputSize, resolveFieldSize, type Size } from "./gl/resolution";
import { createSourceFieldPass } from "./passes/sourceFieldPass";
import { createSourceFieldColorPass } from "./passes/sourceFieldColorPass";
import { createPresentPass } from "./passes/presentPass";
import { createDownsamplePass } from "./passes/downsamplePass";
import { createDownsampleColorPass } from "./passes/downsampleColorPass";
import { createRevealPass } from "./passes/revealPass";
import { createAssemblyScatterPass } from "./passes/assemblyScatterPass";
import { createEnergyWarpPass } from "./passes/energyWarpPass";
import { createHadoukenPass } from "./passes/hadoukenPass";
import { createBlurPass } from "./passes/blurPass";
import { buildStripeRenderOpts, createStripePass } from "./passes/stripePass";
import { createStylizePass } from "./passes/stylizePass";
import { createLogoFillPass } from "./passes/logoFillPass";
import { createLetterDataPass } from "./passes/letterDataPass";
import { LETTER_CHARSET_LEN } from "./letters/charset";
import { createLetterResources } from "./letters/letterResources";
import { createFlamesPass } from "./passes/flamesPass";
import { createStarsPass } from "./passes/starsPass";
import { createParticleFieldPass } from "./passes/particleFieldPass";
import { createStarsState, stepStars, type StarsState } from "./stars/starsSim";
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
  type FlamesState,
} from "./flames/flamesSim";
import { mulberry32 } from "./core/rng";
import { createGpuTimer } from "./perf/gpuTimer";
import { createPerfCollector, type PerfSnapshot } from "./perf/perfCollector";
import { createRtPool, type RtPool } from "./pipeline/rtPool";
import { runPipeline, type Pass } from "./pipeline/pipeline";
import { DEFAULT_REVEAL, normalizeEngineConfig } from "./config/normalize";
import type { EngineConfig, RevealType } from "./config/types";
import { createSourceTexture, type EngineSource, type SourceTexture } from "./source/sourceTexture";
import { resolveSourceRect } from "./source/fit";
import { resolveCellGrid, type CellGrid } from "./config/cellGrid";
import { buildStripeLut, buildStripeOpacityLut, lutSignature } from "./field/stripeLut";
import { createDataTexture, updateDataTexture } from "./gl/dataTexture";
import { bindRenderTarget, createMrtTarget, type MrtTarget } from "./gl/renderTarget";
import { detectBackgroundColor } from "./colors/backgroundDetect";
import { extractVibrantColors, createSyntheticVibrantPalette, type VibrantColor } from "./colors/vibrantPalette";
import { createColorDistPass } from "./passes/colorDistPass";
import { createMaxReducePass } from "./passes/maxReducePass";
import { originForPosition, resolveRevealDurationMs, resolveBandRamp } from "./reveal/revealMath";

const CURSOR_TRAIL_MAX_PUSH_CELLS = 2;
const CLICK_WAVE_MAX_PUSH_CELLS = 6;
const STARS_SEED_XOR = 173516199;

type WarpRevealType = "turbulence" | "glitch" | "burn" | "portal" | "lightning";
const WARP_MODES: Record<WarpRevealType, number> = { turbulence: 0, glitch: 1, burn: 2, portal: 3, lightning: 4 };
function isWarpRevealType(t: RevealType): t is WarpRevealType {
  return t === "turbulence" || t === "glitch" || t === "burn" || t === "portal" || t === "lightning";
}

export type EngineOptions = { clock?: Clock; seed?: number; dpr?: number; fieldScale?: number };
export type CellGridReadback = { cols: number; rows: number; values: Uint8Array; colors: Uint8Array | null };
export type StripesEngine = {
  resize(cssWidth: number, cssHeight: number): void;
  renderFrame(): void;
  start(): void;
  stop(): void;
  setFieldScale(s: number): void;
  setSource(media: EngineSource | null): void;
  updateSourceFrame(frame: EngineSource): void;
  setConfig(partial: Partial<EngineConfig>): void;
  setCursor(x: number | null, y?: number): void;
  click(x: number, y?: number): void;
  triggerReveal(): void;
  readOutputPixels(): Uint8Array;
  readCellGrid(): CellGridReadback;
  getPerf(): PerfSnapshot;
  dispose(): void;
  readonly isP3: boolean;
  readonly maxFps: number;
};

export type SharedEngineOptions = {
  context: EngineContext;
  width: number;
  height: number;
  dpr: number;
  clock?: Clock;
  seed?: number;
  fieldScale?: number;
};
export type SharedStripesEngine = {
  resize(cssWidth: number, cssHeight: number): void;
  setDpr(dpr: number): void;
  readonly outputWidth: number;
  readonly outputHeight: number;
  renderFrame(): void;
  setFieldScale(s: number): void;
  setSource(media: EngineSource | null): void;
  updateSourceFrame(frame: EngineSource): void;
  setConfig(partial: Partial<EngineConfig>): void;
  setCursor(x: number | null, y?: number): void;
  click(x: number, y?: number): void;
  triggerReveal(): void;
  rebuild(context: EngineContext): void;
  getPerf(): PerfSnapshot;
  dispose(): void;
  readonly isP3: boolean;
  readonly maxFps: number;
};

export function createStripesEngine(canvas: HTMLCanvasElement, opts: EngineOptions = {}): StripesEngine {
  const surface = createCanvasSurface(canvas, opts.dpr);
  return createEngineCore(surface, {
    clock: opts.clock,
    seed: opts.seed,
    fieldScale: opts.fieldScale,
    cssWidth: canvas.clientWidth || 800,
    cssHeight: canvas.clientHeight || 600,
  });
}

export function createStripesEngineShared(opts: SharedEngineOptions): SharedStripesEngine {
  const surface = createSharedSurface(opts.context, opts.dpr);
  return createEngineCore(surface, {
    clock: opts.clock,
    seed: opts.seed,
    fieldScale: opts.fieldScale,
    cssWidth: opts.width,
    cssHeight: opts.height,
  });
}

type EngineCoreOptions = {
  clock?: Clock;
  seed?: number;
  fieldScale?: number;
  cssWidth: number;
  cssHeight: number;
};

function createEngineCore(surface: RenderSurface, opts: EngineCoreOptions): StripesEngine & SharedStripesEngine {
  const clock = opts.clock ?? createRealClock();
  let cssW = opts.cssWidth;
  let cssH = opts.cssHeight;

  let { gl, isP3, maxTextureSize } = surface.acquireContext();
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
  let stripeOpacityLutTex: WebGLTexture | null = null;
  let lutSig = "";

  const letterResources = createLetterResources(gl);

  let rafId = 0;
  let lastFrameStart = clock.now();
  const frameCap = createFrameCapState();
  let lost = false;
  let lastStripesEnabled = config.stripesEnabled;
  const revealPassKind = (): "none" | "wave" | "scatter" | "warp" | "hadouken" => {
    if (!config.reveal.enabled) return "none";
    if (config.reveal.type === "wave") return "wave";
    if (config.reveal.type === "assembly") return "scatter";
    if (config.reveal.type === "hadouken") return "hadouken";
    return "warp";
  };
  let lastRevealKind = revealPassKind();
  let lastFlamesEnabled = config.flames.enabled;
  let lastEdgeMaskEnabled = config.edgeMask.enabled;
  let lastRenderMode = config.renderMode;
  let lastCursorTrailEnabled = config.cursorTrail.enabled;
  let lastClickWaveEnabled = config.clickWave.enabled;
  let lastLettersEnabled = config.letters.enabled;
  let lastColorsMode = config.colors.mode;
  let lastStarsEnabled = config.background.stars.enabled;
  let revealStartMs = 0;

  let detectedBgColor = config.colors.backgroundColor;
  let colorsMrt: MrtTarget | null = null;
  let flamesPalette: VibrantColor[] = createSyntheticVibrantPalette();
  let maxColorDist = Math.sqrt(3);
  let colorDistPass: ReturnType<typeof createColorDistPass> | null = null;
  let maxReducePass: ReturnType<typeof createMaxReducePass> | null = null;
  let lastColorInputSig = "";

  const flamesSeed = (opts.seed ?? 1) >>> 0;
  let flamesState: FlamesState = createFlamesState(mulberry32(flamesSeed));
  const starsSeed = (flamesSeed ^ STARS_SEED_XOR) >>> 0;
  let starsState: StarsState = createStarsState(mulberry32(starsSeed));

  let cursorTrailState: CursorTrailState = createCursorTrailState();
  let clickWaveState: ClickWaveState = createClickWaveState();
  let lastCursorMs = clock.now();

  function getDpr() {
    return surface.getDpr();
  }

  function isDrawable(media: EngineSource): boolean {
    return (
      (typeof HTMLImageElement !== "undefined" && media instanceof HTMLImageElement) ||
      (typeof ImageBitmap !== "undefined" && media instanceof ImageBitmap) ||
      (typeof HTMLCanvasElement !== "undefined" && media instanceof HTMLCanvasElement) ||
      (typeof OffscreenCanvas !== "undefined" && media instanceof OffscreenCanvas) ||
      (typeof HTMLVideoElement !== "undefined" && media instanceof HTMLVideoElement)
    );
  }

  function readSourcePixels(
    media: EngineSource,
    maxSide: number,
  ): { data: Uint8ClampedArray; w: number; h: number } | null {
    if (!isDrawable(media)) return null;
    let mw = 1;
    let mh = 1;
    if (typeof HTMLVideoElement !== "undefined" && media instanceof HTMLVideoElement) {
      mw = media.videoWidth || 1;
      mh = media.videoHeight || 1;
    } else if (typeof HTMLImageElement !== "undefined" && media instanceof HTMLImageElement) {
      mw = media.naturalWidth || media.width || 1;
      mh = media.naturalHeight || media.height || 1;
    } else {
      mw = (media as ImageBitmap | HTMLCanvasElement).width || 1;
      mh = (media as ImageBitmap | HTMLCanvasElement).height || 1;
    }
    const scale = Math.min(1, maxSide / Math.max(mw, mh));
    const w = Math.max(1, Math.round(mw * scale));
    const h = Math.max(1, Math.round(mh * scale));
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const temp = document.createElement("canvas");
      temp.width = w;
      temp.height = h;
      ctx = temp.getContext("2d", { willReadFrequently: true });
    } else if (typeof OffscreenCanvas !== "undefined") {
      ctx = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });
    }
    if (!ctx) return null;
    ctx.drawImage(media as CanvasImageSource, 0, 0, w, h);
    return { data: ctx.getImageData(0, 0, w, h).data, w, h };
  }

  function detectSourceBackground(media: EngineSource): number {
    try {
      const px = readSourcePixels(media, 64);
      if (!px) return config.colors.backgroundColor;
      return detectBackgroundColor(px.data, px.w, px.h);
    } catch {
      return config.colors.backgroundColor;
    }
  }

  function applySourcePalette(media: EngineSource | null): void {
    let px: { data: Uint8ClampedArray; w: number; h: number } | null = null;
    try {
      px = media ? readSourcePixels(media, 96) : null;
    } catch {
      px = null;
    }
    flamesPalette = px ? extractVibrantColors(px.data, px.w, px.h) : createSyntheticVibrantPalette();
  }

  function colorBackground(): number {
    return config.colors.autoDetectBackground ? detectedBgColor : config.colors.backgroundColor;
  }

  function colorInputSig(): string {
    const a = config.adjustments;
    const t = config.transform;
    return [
      config.colors.mode,
      colorBackground(),
      config.background.color,
      a.blackPoint,
      a.whitePoint,
      a.gamma,
      a.exposure,
      a.contrast,
      a.brightness,
      a.thresholdBias,
      a.invert ? 1 : 0,
      a.posterizeLevels,
      a.noiseAmount,
      a.blurRadius,
      a.sharpenAmount,
      t.fit,
      t.zoom,
      t.panX,
      t.panY,
      fieldSize.width,
      fieldSize.height,
      output.width,
      output.height,
    ].join("|");
  }

  function computeMaxColorDist(): void {
    lastColorInputSig = colorInputSig();
    if (!source || config.colors.mode !== "colors" || !colorDistPass || !maxReducePass) {
      maxColorDist = Math.sqrt(3);
      return;
    }
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
    const distRT = pool.get("colorDistFull", fieldSize.width, fieldSize.height);
    colorDistPass.render(distRT, source.texture, {
      srcRect,
      adjustments: config.adjustments,
      background: config.background.color,
      colorBackground: colorBackground(),
      sourceTexelW: 1 / source.width,
      sourceTexelH: 1 / source.height,
    });
    let w = fieldSize.width;
    let h = fieldSize.height;
    let srcTex = distRT.texture;
    let lastRT = distRT;
    let level = 0;
    while (w > 1 || h > 1) {
      const nw = Math.max(1, Math.ceil(w / 4));
      const nh = Math.max(1, Math.ceil(h / 4));
      const dst = pool.get(`colorMaxReduce${level}`, nw, nh);
      maxReducePass.render(dst, srcTex, w, h);
      srcTex = dst.texture;
      lastRT = dst;
      w = nw;
      h = nh;
      level++;
    }
    const px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, lastRT.fbo);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const d = (px[0] / 255) * Math.sqrt(3);
    maxColorDist = d > 1e-4 ? d : Math.sqrt(3);
  }

  function ensureLut() {
    const sig = lutSignature(config.stripes);
    if (sig !== lutSig) {
      const bytes = buildStripeLut(config.stripes);
      const opacityBytes = buildStripeOpacityLut(config.stripes);
      if (stripeLutTex) {
        updateDataTexture(gl, stripeLutTex, bytes, 256, 1);
      } else {
        stripeLutTex = createDataTexture(gl, bytes, 256, 1);
      }
      if (stripeOpacityLutTex) {
        updateDataTexture(gl, stripeOpacityLutTex, opacityBytes, 256, 1);
      } else {
        stripeOpacityLutTex = createDataTexture(gl, opacityBytes, 256, 1);
      }
      lutSig = sig;
    }
  }

  function ensureTextGlyphMap(cols: number, rows: number): WebGLTexture {
    return letterResources.ensureTextMap(
      cols,
      rows,
      config.grid.orientation,
      config.letters.text,
      config.letters.textCopies,
    );
  }

  function buildPasses() {
    for (const p of passes) p.dispose();
    if (colorsMrt) {
      colorsMrt.dispose();
      colorsMrt = null;
    }
    const colorsMode = config.colors.mode === "colors";
    let fieldPass: Pass;
    if (colorsMode) {
      const sourceFieldColorPass = createSourceFieldColorPass(gl, quad);
      const mrt = createMrtTarget(gl);
      colorsMrt = mrt;
      fieldPass = {
        name: "field",
        render: () => {
          const fieldTarget = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
          const fieldColorTarget = pool.get("fieldColor", fieldSize.width, fieldSize.height, { linear: true });
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
            sourceFieldColorPass.render(mrt, fieldTarget, fieldColorTarget, source.texture, {
              srcRect,
              adjustments: config.adjustments,
              background: config.background.color,
              colorBackground: colorBackground(),
              maxColorDist,
              sourceTexelW: 1 / source.width,
              sourceTexelH: 1 / source.height,
            });
          } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, fieldTarget.fbo);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fieldColorTarget.fbo);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
          }
        },
        dispose: () => sourceFieldColorPass.dispose(),
      };
    } else {
      const sourceFieldPass = createSourceFieldPass(gl, quad);
      fieldPass = {
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
    }

    const particleFieldDeps = {
      colorsMode,
      getFieldRT: () => pool.get("field", fieldSize.width, fieldSize.height, { linear: true }),
      getFieldColorRT: () => pool.get("fieldColor", fieldSize.width, fieldSize.height, { linear: true }),
      getPalette: () => flamesPalette,
    };

    const starsFieldPasses: Pass[] = [];
    if (config.background.stars.enabled) {
      starsFieldPasses.push(
        createParticleFieldPass({
          ...particleFieldDeps,
          name: "backgroundStarsField",
          pass: createStarsPass(gl),
          step: () => {
            stepStars(starsState, config.background.stars, { width: cssW, height: cssH }, clock.now());
            return {
              particles: starsState.stars,
              opts: { canvasW: cssW, canvasH: cssH, color: config.background.stars.color },
            };
          },
        }),
      );
    }

    const flamesFieldPasses: Pass[] = [];
    if (config.flames.enabled) {
      flamesFieldPasses.push(
        createParticleFieldPass({
          ...particleFieldDeps,
          name: "flamesField",
          pass: createFlamesPass(gl),
          step: () => {
            stepFlames(flamesState, config.flames, { width: cssW, height: cssH }, clock.now());
            const { inner, outer } = flamesGradientStops(config.flames.edgeSharpness);
            return {
              particles: flamesState.flames,
              opts: {
                canvasW: cssW,
                canvasH: cssH,
                vertical: isVerticalFlamesDirection(config.flames.direction),
                inner,
                outer,
              },
            };
          },
        }),
      );
    }

    const revealEnabled = config.reveal.enabled;
    let activeFieldRT = revealEnabled ? "revealedField" : "field";
    let activeColorRT = "fieldColor";
    const revealFieldPasses: Pass[] = [];

    if (revealEnabled && config.reveal.type === "hadouken") {
      const hadoukenPass = createHadoukenPass(gl, quad);
      revealFieldPasses.push({
        name: "hadoukenField",
        render: () => {
          const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
          const revealedRT = pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
          const assembly = config.reveal.hadouken;
          const durationMs = resolveRevealDurationMs(config.reveal);
          const rawProgress = (clock.now() - revealStartMs) / durationMs;
          const dur = Math.max(1, assembly.staggerMs + assembly.speedMaxMs);
          const speedMin = Math.max(0, assembly.speedMinMs);
          const speedMax = Math.max(speedMin, assembly.speedMaxMs);
          const avgTotal = Math.min(0.98, Math.max(0.05, (speedMin + speedMax) / 2 / dur));
          const spread = assembly.staggerMs / dur;
          const charge = Math.min(1, Math.max(0, (rawProgress - avgTotal) / Math.max(spread, 0.2)));
          const chargeEnd = avgTotal + 0.82 * Math.max(spread, 0.2);
          const burst = Math.min(1, Math.max(0, (rawProgress - chargeEnd) / 0.26));
          const sizePx = 6 * Math.max(0.05, assembly.intensity);
          hadoukenPass.render(revealedRT, fieldRT.texture, {
            progress: rawProgress,
            spread,
            flight: avgTotal,
            charge,
            burst,
            count: assembly.particleCount,
            sizeUv: [sizePx / Math.max(1, cssW), sizePx / Math.max(1, cssH)],
            detail: assembly.detail,
            glow: assembly.glow,
            aspect: cssW / Math.max(1, cssH),
          });
        },
        dispose: () => hadoukenPass.dispose(),
      });
    } else if (revealEnabled && isWarpRevealType(config.reveal.type)) {
      const warpPass = createEnergyWarpPass(gl, quad);
      revealFieldPasses.push({
        name: "energyWarpField",
        render: () => {
          const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
          const revealedRT = pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
          if (!isWarpRevealType(config.reveal.type)) return;
          const type = config.reveal.type;
          const assembly = config.reveal[type];
          const durationMs = resolveRevealDurationMs(config.reveal);
          const rawProgress = (clock.now() - revealStartMs) / durationMs;
          const dur = Math.max(1, assembly.staggerMs + assembly.speedMaxMs);
          const speedMin = Math.max(0, assembly.speedMinMs);
          const speedMax = Math.max(speedMin, assembly.speedMaxMs);
          const avgTotal = Math.min(0.98, Math.max(0.05, (speedMin + speedMax) / 2 / dur));
          const spread = assembly.staggerMs / dur;
          warpPass.render(revealedRT, fieldRT.texture, {
            mode: WARP_MODES[type] ?? 0,
            progress: rawProgress,
            spread,
            flight: avgTotal,
            intensity: assembly.intensity,
            detail: assembly.detail,
            glow: assembly.glow,
          });
        },
        dispose: () => warpPass.dispose(),
      });
    } else if (revealEnabled && config.reveal.type === "assembly") {
      const scatterPass = createAssemblyScatterPass(gl);
      const blurPass = createBlurPass(gl, quad);
      revealFieldPasses.push({
        name: "assemblyScatterField",
        render: () => {
          const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
          const revealedRT = pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
          const assembly = config.reveal.assembly;
          const blurPx = assembly.blurPx ?? DEFAULT_REVEAL.assembly.blurPx ?? 0;
          const blurStart = assembly.blurStart ?? DEFAULT_REVEAL.assembly.blurStart ?? 0;
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

          const moveEnd = Math.min(1, spread + avgTotal);
          let blurQuarterTex = fieldRT.texture;
          let blurHalfTex = fieldRT.texture;
          let blurFullTex = fieldRT.texture;
          if (progress < moveEnd && blurPx > 0) {
            // Blur pyramid of the source field at half res: sigma/4, sigma/2 and the full
            // sigma of blurPx CSS px on screen (Gaussians compose as sqrt(a²+b²); one blur
            // render ≈ sigma of 0.45·radius). Each flying piece blends the two levels
            // bracketing its own remaining-travel blur, so pieces defocus individually.
            const halfSize = {
              width: Math.max(1, Math.round(fieldSize.width / 2)),
              height: Math.max(1, Math.round(fieldSize.height / 2)),
            };
            const quarterRT = pool.get("assemblyBlurQuarter", halfSize.width, halfSize.height, { linear: true });
            const halfRT = pool.get("assemblyBlurHalf", halfSize.width, halfSize.height, { linear: true });
            const fullRT = pool.get("assemblyBlurFull", halfSize.width, halfSize.height, { linear: true });
            const blurTempRT = pool.get("assemblyBlurTemp", halfSize.width, halfSize.height, { linear: true });
            const sigmaPx = (blurPx * halfSize.width) / Math.max(1, cssW);
            blurPass.copy(fieldRT.texture, quarterRT);
            blurPass.render(quarterRT.texture, blurTempRT, quarterRT, (sigmaPx * 0.25) / 0.45, halfSize);
            blurPass.render(quarterRT.texture, blurTempRT, halfRT, (sigmaPx * (Math.sqrt(3) / 4)) / 0.45, halfSize);
            const fullStepRadius = (sigmaPx * (Math.sqrt(3) / 2 / Math.SQRT2)) / 0.45;
            blurPass.render(halfRT.texture, blurTempRT, fullRT, fullStepRadius, halfSize);
            blurPass.render(fullRT.texture, blurTempRT, fullRT, fullStepRadius, halfSize);
            blurQuarterTex = quarterRT.texture;
            blurHalfTex = halfRT.texture;
            blurFullTex = fullRT.texture;
          }

          scatterPass.render(revealedRT, fieldRT.texture, blurQuarterTex, blurHalfTex, blurFullTex, {
            blockCols,
            blockRows,
            progress: rawProgress,
            spread,
            flight: avgTotal,
            spawnDist: 1.6,
            scatter: [assembly.scatterPx / Math.max(1, cssW), assembly.scatterPx / Math.max(1, cssH)],
            angleJitter: (assembly.angleJitterDeg * Math.PI) / 180,
            sigmaUv: [blurPx / Math.max(1, cssW), blurPx / Math.max(1, cssH)],
            blurStart,
          });
        },
        dispose: () => {
          scatterPass.dispose();
          blurPass.dispose();
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
      const srcColorRT = activeColorRT;
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

          const warpParams = {
            cols,
            rows,
            cellW: cssW / Math.max(1, cols),
            cellH: cssH / Math.max(1, rows),
            pixelW: cssW,
            pixelH: cssH,
            pushCap,
          };
          const srcTex = pool.get(srcRT, fieldSize.width, fieldSize.height, { linear: true }).texture;
          const warpedRT = pool.get("cursorField", fieldSize.width, fieldSize.height, { linear: true });
          warpPass.render(warpedRT, srcTex, accumRT.texture, tearRT.texture, warpParams);

          if (colorsMode) {
            const srcColorTex = pool.get(srcColorRT, fieldSize.width, fieldSize.height, { linear: true }).texture;
            const warpedColorRT = pool.get("cursorFieldColor", fieldSize.width, fieldSize.height, { linear: true });
            const tc = flamesPalette[0];
            const trailColor: [number, number, number] = tc ? [tc.r / 255, tc.g / 255, tc.b / 255] : [1, 0.5, 0.2];
            warpPass.renderColor(warpedColorRT, srcColorTex, accumRT.texture, tearRT.texture, warpParams, trailColor);
          }
        },
        dispose: () => {
          splatPass?.dispose();
          clickSplatPass?.dispose();
          tearPass.dispose();
          warpPass.dispose();
        },
      });
      activeFieldRT = "cursorField";
      if (colorsMode) activeColorRT = "cursorFieldColor";
    }

    const colorsModeActive = config.colors.mode === "colors";
    if (config.stripesEnabled) {
      const downsamplePass = createDownsamplePass(gl, quad);
      const downsampleColorPass = colorsModeActive ? createDownsampleColorPass(gl, quad) : null;
      const colorDownsamplePasses: Pass[] = downsampleColorPass
        ? [
            {
              name: "downsampleColor",
              render: () => {
                const { cols, rows } = cellGrid;
                const fieldColorRT = pool.get(activeColorRT, fieldSize.width, fieldSize.height, { linear: true });
                const cellColorRT = pool.get("cellColor", cols, rows);
                downsampleColorPass.render(cellColorRT, fieldColorRT.texture, cols, rows);
              },
              dispose: () => downsampleColorPass.dispose(),
            },
          ]
        : [];
      const stripePass = createStripePass(gl, quad);
      const stylizePass = config.renderMode !== "sharp" ? createStylizePass(gl, quad) : null;
      const logoFillPass = stylizePass ? createLogoFillPass(gl, quad) : null;
      const lettersEnabled = config.letters.enabled;
      const letterDataPass = lettersEnabled ? createLetterDataPass(gl, quad) : null;
      const letterDataPasses: Pass[] = letterDataPass
        ? [
            {
              name: "letterData",
              render: () => {
                const { cols, rows } = cellGrid;
                if (config.letters.mode === "text") {
                  ensureTextGlyphMap(cols, rows);
                  return;
                }
                const cellRT = pool.get("cell", cols, rows);
                const glyphDataRT = pool.get("glyphData", cols, rows);
                const topBandThreshold = Math.max(...config.stripes.map((s) => s.startFrom));
                letterDataPass.render(glyphDataRT, cellRT.texture, {
                  cols,
                  rows,
                  topBandThreshold,
                  coverage: config.letters.coverage,
                  timeSec: clock.now() / 1000,
                  charsetLen: LETTER_CHARSET_LEN,
                  shuffleSpeed: config.letters.shuffleSpeed,
                  positionX: config.letters.positionX,
                  positionY: config.letters.positionY,
                  areaWidth: config.letters.areaWidth,
                  areaHeight: config.letters.areaHeight,
                });
              },
              dispose: () => letterDataPass.dispose(),
            },
          ]
        : [];
      passes = [
        fieldPass,
        ...starsFieldPasses,
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
        ...colorDownsamplePasses,
        ...letterDataPasses,
        {
          name: "stripe",
          render: () => {
            const { cols, rows } = cellGrid;
            const inputRT = pool.get("cell", cols, rows);
            const timeSec = clock.now() / 1000;
            const glyphDataTex =
              lettersEnabled && config.letters.mode === "text"
                ? ensureTextGlyphMap(cols, rows)
                : lettersEnabled
                  ? pool.get("glyphData", cols, rows).texture
                  : letterResources.dummyTex!;
            stripePass.render(
              inputRT.texture,
              stripeLutTex!,
              buildStripeRenderOpts(config, {
                cols,
                rows,
                displayW: cssW,
                displayH: cssH,
                dpr: getDpr(),
                timeSec,
                lettersEnabled,
                colorsMode: colorsModeActive,
                glyphDataTex,
                atlasTex: letterResources.atlasTex!,
                atlasGrid: letterResources.atlasGrid,
                cellColorTex: colorsModeActive ? pool.get("cellColor", cols, rows).texture : letterResources.dummyTex!,
                opacityTex: stripeOpacityLutTex!,
              }),
              output.width,
              output.height,
              stylizePass ? pool.get("stripeOut", output.width, output.height, { linear: true }) : null,
            );
          },
          dispose: () => stripePass.dispose(),
        },
        ...(stylizePass
          ? [
              {
                name: "logoFill",
                render: () => {
                  const srcRT = pool.get("stripeOut", output.width, output.height, { linear: true });
                  const dstRT = pool.get("solidOut", output.width, output.height, { linear: true });
                  logoFillPass!.render(dstRT, srcRT.texture, {
                    resolution: [output.width, output.height] as [number, number],
                    bg: config.background.color,
                  });
                },
                dispose: () => logoFillPass!.dispose(),
              },
            ]
          : []),
        ...(stylizePass
          ? [
              {
                name: "stylize",
                render: () => {
                  const src = pool.get("solidOut", output.width, output.height, { linear: true });
                  const stripesRT = pool.get("stripeOut", output.width, output.height, { linear: true });
                  stylizePass.render(null, src.texture, stripesRT.texture, {
                    mode: config.renderMode,
                    time: clock.now() / 1000,
                    intensity: config.renderIntensity,
                    resolution: [output.width, output.height] as [number, number],
                    dpr: getDpr(),
                    params: config.renderParams as [number, number, number, number],
                    colorA: config.renderColorA,
                    colorB: config.renderColorB,
                  });
                },
                dispose: () => stylizePass.dispose(),
              },
            ]
          : []),
      ];
    } else {
      const presentPass = createPresentPass(gl, quad);
      passes = [
        fieldPass,
        ...starsFieldPasses,
        ...flamesFieldPasses,
        ...revealFieldPasses,
        ...edgeMaskFieldPasses,
        ...cursorFieldPasses,
        {
          name: "present",
          render: () => {
            const presentRT = colorsMode ? activeColorRT : activeFieldRT;
            presentPass.render(
              pool.get(presentRT, fieldSize.width, fieldSize.height, { linear: true }).texture,
              output.width,
              output.height,
            );
          },
          dispose: () => presentPass.dispose(),
        },
      ];
    }
  }

  function applySizes() {
    const dpr = getDpr();
    output = resolveOutputSize(cssW, cssH, dpr, maxTextureSize);
    surface.applyOutputSize(output.width, output.height);
    fieldSize = resolveFieldSize(output, config.fieldScale);
    pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
    cellGrid = resolveCellGrid(cssW, cssH, config.grid.cellWidth, config.grid.cellHeight);
    pool.get("cell", cellGrid.cols, cellGrid.rows);
    if (config.renderMode !== "sharp") {
      pool.get("stripeOut", output.width, output.height, { linear: true });
      pool.get("solidOut", output.width, output.height, { linear: true });
    }
    if (config.reveal.enabled) {
      pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
      if (config.reveal.type === "assembly") {
        const halfW = Math.max(1, Math.round(fieldSize.width / 2));
        const halfH = Math.max(1, Math.round(fieldSize.height / 2));
        pool.get("assemblyBlurQuarter", halfW, halfH, { linear: true });
        pool.get("assemblyBlurHalf", halfW, halfH, { linear: true });
        pool.get("assemblyBlurFull", halfW, halfH, { linear: true });
        pool.get("assemblyBlurTemp", halfW, halfH, { linear: true });
      }
    }
  }

  function rebuildGpuResources(provided?: EngineContext) {
    // Context loss already invalidated the old GL objects (pool, passes, source); disposing them would no-op or error against the dead context, so we drop and recreate. Do not add teardown here without guarding for the lost context.
    const ctx = provided ?? surface.acquireContext();
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
    stripeOpacityLutTex = null;
    lutSig = "";
    letterResources.reset(gl);
    colorsMrt = null;
    colorDistPass = createColorDistPass(gl, quad);
    maxReducePass = createMaxReducePass(gl, quad);
    flamesState = createFlamesState(mulberry32(flamesSeed));
    starsState = createStarsState(mulberry32(starsSeed));
    cursorTrailState = createCursorTrailState();
    clickWaveState = createClickWaveState();
    lastCursorMs = clock.now();
    ensureLut();
    letterResources.ensureAtlas(config.letters.fontFamily);
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
  surface.attachContextLossListeners(onLost, onRestored);

  colorDistPass = createColorDistPass(gl, quad);
  maxReducePass = createMaxReducePass(gl, quad);
  ensureLut();
  letterResources.ensureAtlas(config.letters.fontFamily);
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
    if (shouldRenderFrame(frameCap, config.maxFps, clock.now())) renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  return {
    get isP3() {
      return isP3;
    },
    get maxFps() {
      return config.maxFps;
    },
    get outputWidth() {
      return output.width;
    },
    get outputHeight() {
      return output.height;
    },
    resize(w, h) {
      cssW = w;
      cssH = h;
      applySizes();
      if (config.colors.mode === "colors" && colorInputSig() !== lastColorInputSig) computeMaxColorDist();
    },
    setDpr(dpr) {
      surface.setDpr(dpr);
      applySizes();
      if (config.colors.mode === "colors" && colorInputSig() !== lastColorInputSig) computeMaxColorDist();
    },
    rebuild(context) {
      lost = false;
      rebuildGpuResources(context);
    },
    setFieldScale(s) {
      this.setConfig({ fieldScale: s });
    },
    setSource(media) {
      source?.dispose();
      source = media ? createSourceTexture(gl, media) : null;
      detectedBgColor = media ? detectSourceBackground(media) : config.colors.backgroundColor;
      applySourcePalette(media);
      computeMaxColorDist();
      if (config.colors.mode === "colors") buildPasses();
    },
    updateSourceFrame(frame) {
      if (lost) return;
      if (!source) {
        this.setSource(frame);
        return;
      }
      source.uploadFrame(frame);
    },
    setConfig(partial) {
      config = normalizeEngineConfig({ ...config, ...partial });
      ensureLut();
      letterResources.ensureAtlas(config.letters.fontFamily);
      applySizes();
      if (config.colors.mode === "colors" && colorInputSig() !== lastColorInputSig) computeMaxColorDist();
      if (
        config.stripesEnabled !== lastStripesEnabled ||
        revealPassKind() !== lastRevealKind ||
        config.flames.enabled !== lastFlamesEnabled ||
        config.edgeMask.enabled !== lastEdgeMaskEnabled ||
        config.renderMode !== lastRenderMode ||
        config.cursorTrail.enabled !== lastCursorTrailEnabled ||
        config.clickWave.enabled !== lastClickWaveEnabled ||
        config.letters.enabled !== lastLettersEnabled ||
        config.colors.mode !== lastColorsMode ||
        config.background.stars.enabled !== lastStarsEnabled
      ) {
        if (config.flames.enabled && !lastFlamesEnabled) {
          flamesState = createFlamesState(mulberry32(flamesSeed));
        }
        if (config.background.stars.enabled && !lastStarsEnabled) {
          starsState = createStarsState(mulberry32(starsSeed));
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
        lastRevealKind = revealPassKind();
        lastFlamesEnabled = config.flames.enabled;
        lastEdgeMaskEnabled = config.edgeMask.enabled;
        lastRenderMode = config.renderMode;
        lastCursorTrailEnabled = config.cursorTrail.enabled;
        lastClickWaveEnabled = config.clickWave.enabled;
        lastLettersEnabled = config.letters.enabled;
        lastColorsMode = config.colors.mode;
        lastStarsEnabled = config.background.stars.enabled;
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
      if (!surface.supportsRaf) return;
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
    readCellGrid() {
      const { cols, rows } = cellGrid;
      const cellRT = pool.get("cell", cols, rows);
      const cellPx = new Uint8Array(cols * rows * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, cellRT.fbo);
      gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, cellPx);
      const values = new Uint8Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) values[i] = cellPx[i * 4];
      let colors: Uint8Array | null = null;
      if (config.colors.mode === "colors") {
        const cellColorRT = pool.get("cellColor", cols, rows);
        colors = new Uint8Array(cols * rows * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, cellColorRT.fbo);
        gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, colors);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { cols, rows, values, colors };
    },
    getPerf() {
      return perf.snapshot();
    },
    dispose() {
      this.stop();
      surface.detachContextLossListeners();
      for (const p of passes) p.dispose();
      if (colorsMrt) {
        colorsMrt.dispose();
        colorsMrt = null;
      }
      colorDistPass?.dispose();
      maxReducePass?.dispose();
      pool.dispose();
      quad.dispose();
      source?.dispose();
      if (stripeLutTex) {
        gl.deleteTexture(stripeLutTex);
        stripeLutTex = null;
      }
      if (stripeOpacityLutTex) {
        gl.deleteTexture(stripeOpacityLutTex);
        stripeOpacityLutTex = null;
      }
      letterResources.dispose();
    },
  };
}

import { createManualClock, createStripesEngine, resolveThemedConfig } from "@necatikcl/stripes-engine";
import { createShaderTextureRenderer } from "../../../../../../../apps/lab/src/shaderTextureSource";
import { renderTwizzler } from "../../../../../../../apps/lab/src/twizzler";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import { CONNECT_HERO_RAIN_CONFIG, CONNECT_HERO_RAIN_SHADER_SOURCE } from "../hero/hero-rain-config";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { LOGO_PATHS, LOGO_VIEWBOX } from "./logo";

export const FPS = 60;
export const LOOP_SEC = 30;
export const FRAMES = FPS * LOOP_SEC;
export const ASPECT = 6;
/** 8K-wide 6:1 master. */
export const EXPORT_WIDTH = 7680;
export const EXPORT_HEIGHT = EXPORT_WIDTH / ASPECT;
/** CSS width the hero recipes are authored against; everything scales from it. */
const DESIGN_WIDTH = 1920;
/** The hero draws Twizzler strokes in device pixels at its 1.5 DPR cap. */
const TWIZZLER_DESIGN_PIXELS = DESIGN_WIDTH * 1.5;

/** Board aspect (width / height) and loop length for the background layers. */
export type LoopSpec = { aspect: number; loopSec: number };
const SOFI: LoopSpec = { aspect: ASPECT, loopSec: LOOP_SEC };

export const LAYER_NAMES = ["twizzler", "rain", "logo"] as const;
export type LayerName = (typeof LAYER_NAMES)[number];

/** Renders output frame `frame` of the loop into `canvas`, then advances (wrapping at FRAMES). */
export type SofiLayer = {
  canvas: HTMLCanvasElement;
  readonly frame: number;
  step(): void;
  dispose(): void;
};

export function createLayer(name: LayerName, width: number): SofiLayer {
  const height = Math.round(width / ASPECT);
  if (name === "twizzler") return createTwizzlerLayer(width, height, SOFI);
  if (name === "rain") return createRainLayer(width, height, SOFI);
  return createLogoLayer(width, height);
}

function outputCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // Not willReadFrequently: that pins the canvas to the CPU, where 8K blur and ribbon fills take seconds a frame.
  const context = canvas.getContext("2d")!;
  return { canvas, context };
}

export function createTwizzlerLayer(width: number, height: number, spec: LoopSpec): SofiLayer {
  const { canvas } = outputCanvas(width, height);
  const scale = width / TWIZZLER_DESIGN_PIXELS;
  const d = CONNECT_HERO_TWIZZLER_DEFAULTS;
  const settings = {
    ...d,
    lineWidth: d.lineWidth * scale,
    minLineWidth: d.minLineWidth * scale,
    maxLineWidth: d.maxLineWidth * scale,
  };
  const render = (frame: number) => renderTwizzler(canvas, width, height, frame / FPS, settings, { loopSec: spec.loopSec });
  // The first render ever builds the gradient-field cache and draws without it; burn it.
  render(0);
  const frames = spec.loopSec * FPS;
  let frame = 0;
  return {
    canvas,
    get frame() {
      return frame;
    },
    step() {
      // Sine phases are quantized to the loop length, so the last frame + 1 is exactly frame 0.
      render(frame);
      frame = (frame + 1) % frames;
    },
    dispose() {},
  };
}

/** Seconds the rain's tail crossfades into its head to close the loop. */
const RAIN_CROSSFADE_SEC = 2;
const RAIN_SEED = 1;

/**
 * The rain (noise source, stars, meteors, flames) is not periodic, so the loop
 * is closed by crossfading. The engine runs on a manual clock and a fixed seed,
 * so it is deterministic: a second instance restarted from zero reproduces the
 * stream's head exactly. Output frame k shows stream frame k + X; the last X
 * output frames blend stream frames N..N+X into a fresh copy of frames 0..X, so
 * the final frame hands off seamlessly to output frame 0 (= stream frame X).
 */
export function createRainLayer(width: number, height: number, spec: LoopSpec): SofiLayer {
  const frames = spec.loopSec * FPS;
  const { canvas, context } = outputCanvas(width, height);
  const crossfade = RAIN_CROSSFADE_SEC * FPS;
  const cssWidth = DESIGN_WIDTH;
  const cssHeight = DESIGN_WIDTH / spec.aspect;
  const config = resolveThemedConfig(asThemedEngineConfig(CONNECT_HERO_RAIN_CONFIG));
  const sourceSpec = CONNECT_HERO_RAIN_SHADER_SOURCE;

  const createStream = () => {
    const glCanvas = document.createElement("canvas");
    const clock = createManualClock(0);
    const engine = createStripesEngine(glCanvas, { clock, seed: RAIN_SEED, dpr: width / cssWidth });
    engine.resize(cssWidth, cssHeight);
    engine.setConfig(config);
    const source = createShaderTextureRenderer(sourceSpec.width, sourceSpec.height);
    const error = source.setSource(sourceSpec.source);
    if (error) throw new Error(error);
    source.render(0);
    engine.setSource(source.canvas);
    let index = 0;
    return {
      glCanvas,
      /** Renders stream frame `index`; the WebGL buffer is valid until this task yields. */
      render() {
        clock.set((index * 1000) / FPS);
        source.render((index / FPS) * (sourceSpec.speed ?? 1));
        engine.updateSourceFrame(source.canvas);
        engine.renderFrame();
        index += 1;
      },
      dispose() {
        engine.dispose();
        source.dispose();
      },
    };
  };

  let head = createStream();
  let tail: ReturnType<typeof createStream> | null = null;
  let frame = 0;
  const warmUp = () => {
    for (let i = 0; i < crossfade; i += 1) head.render();
  };
  warmUp();

  return {
    canvas,
    get frame() {
      return frame;
    },
    step() {
      context.clearRect(0, 0, width, height);
      head.render();
      const blendIndex = frame - (frames - crossfade);
      if (blendIndex < 0) {
        context.drawImage(head.glCanvas, 0, 0, width, height);
      } else {
        tail ??= createStream();
        const t = (blendIndex + 1) / (crossfade + 1);
        const mix = t * t * (3 - 2 * t);
        // Premultiplied "lighter" sums the two weighted frames: a true crossfade, alpha included.
        context.globalAlpha = 1 - mix;
        context.drawImage(head.glCanvas, 0, 0, width, height);
        tail.render();
        context.globalCompositeOperation = "lighter";
        context.globalAlpha = mix;
        context.drawImage(tail.glCanvas, 0, 0, width, height);
        context.globalCompositeOperation = "source-over";
        context.globalAlpha = 1;
      }
      frame += 1;
      if (frame === frames) {
        // The tail is now exactly where the head started: it becomes the head.
        head.dispose();
        head = tail!;
        tail = null;
        frame = 0;
      }
    },
    dispose() {
      head.dispose();
      tail?.dispose();
    },
  };
}

// House curves (see CLAUDE.md polish tokens).
const easeSmooth = cubicBezier(0.22, 1, 0.36, 1);
const easeInOut = cubicBezier(0.66, 0, 0.34, 1);

/** Logo timeline, in seconds. Each path enters and exits on its own stagger. */
const LOGO_IN_START = 0.3;
const LOGO_IN_STAGGER = 0.04;
const LOGO_IN_DURATION = 1.1;
const LOGO_OUT_START = 28.1;
const LOGO_OUT_STAGGER = 0.025;
const LOGO_OUT_DURATION = 0.8;
/** Blurs at or above this many output px are rendered downsampled. */
const BLUR_SAMPLE_PX = 2;
/** Logo height as a fraction of the frame height. */
const LOGO_HEIGHT = 0.62;

function createLogoLayer(width: number, height: number): SofiLayer {
  const { canvas, context } = outputCanvas(width, height);
  const logoScale = (height * LOGO_HEIGHT) / LOGO_VIEWBOX.height;
  const originX = (width - LOGO_VIEWBOX.width * logoScale) / 2;
  const originY = (height - LOGO_VIEWBOX.height * logoScale) / 2;
  // Reading order: cloud, then each line left to right (rows bucketed by each path's start point).
  const paths = LOGO_PATHS.map(({ d, fill }) => {
    const [x, y] = d.match(/[\d.]+/g)!.map(Number);
    return { path: new Path2D(d), fill, row: Math.round(y! / 80), x: x! };
  }).sort((a, b) => a.row - b.row || a.x - b.x);
  const scratch = document.createElement("canvas");
  const scratchContext = scratch.getContext("2d")!;
  let frame = 0;

  return {
    canvas,
    get frame() {
      return frame;
    },
    step() {
      const t = frame / FPS;
      context.clearRect(0, 0, width, height);
      paths.forEach(({ path, fill }, order) => {
        const enter = easeSmooth(clamp01((t - LOGO_IN_START - order * LOGO_IN_STAGGER) / LOGO_IN_DURATION));
        const exit = easeInOut(clamp01((t - LOGO_OUT_START - order * LOGO_OUT_STAGGER) / LOGO_OUT_DURATION));
        const opacity = enter * (1 - exit);
        if (opacity <= 0) return;
        // Blur in from below, blur out upward (units: logo viewBox px).
        const offsetY = (1 - enter) * 24 - exit * 16;
        const blur = ((1 - enter) * 10 + exit * 8) * logoScale;
        const y = originY + offsetY * logoScale;
        if (blur < BLUR_SAMPLE_PX) {
          context.globalAlpha = opacity;
          context.setTransform(logoScale, 0, 0, logoScale, originX, y);
          context.fillStyle = fill;
          context.fill(path);
          context.setTransform(1, 0, 0, 1, 0, 0);
          return;
        }
        // A canvas filter at 8K falls back to the CPU (seconds per frame). Blur is
        // low-frequency, so blur a downscaled copy by BLUR_SAMPLE_PX and upscale it.
        const down = blur / BLUR_SAMPLE_PX;
        const pad = BLUR_SAMPLE_PX * 3;
        scratch.width = Math.ceil((LOGO_VIEWBOX.width * logoScale) / down + pad * 2);
        scratch.height = Math.ceil((LOGO_VIEWBOX.height * logoScale) / down + pad * 2);
        scratchContext.filter = `blur(${BLUR_SAMPLE_PX}px)`;
        scratchContext.setTransform(logoScale / down, 0, 0, logoScale / down, pad, pad);
        scratchContext.fillStyle = fill;
        scratchContext.fill(path);
        context.globalAlpha = opacity;
        context.drawImage(scratch, originX - pad * down, y - pad * down, scratch.width * down, scratch.height * down);
      });
      context.globalAlpha = 1;
      frame = (frame + 1) % FRAMES;
    },
    dispose() {},
  };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** CSS cubic-bezier timing function: solve x(s) = t by Newton, return y(s). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  const slope = (a: number, b: number, s: number) =>
    3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;
  return (t: number) => {
    if (t <= 0 || t >= 1) return t <= 0 ? 0 : 1;
    let s = t;
    for (let i = 0; i < 8; i += 1) {
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s = clamp01(s - (curve(x1, x2, s) - t) / d);
    }
    return curve(y1, y2, s);
  };
}

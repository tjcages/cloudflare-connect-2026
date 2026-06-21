import { Container, Sprite, Texture } from "pixi.js";
import { ASSEMBLY_SETTLE, assemblyOrderNorm } from "./playgroundReveal";
import type { PlaygroundAssemblyRevealConfig } from "./playgroundRevealConfig";

export const ASSEMBLY_GLOW_CAP = 800;
const GLOW_TEXEL = 128;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}
function easeOutBack(t: number): number {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 0.123) * 43758.5453;
  return x - Math.floor(x);
}
function hash2(n: number): number {
  const x = Math.sin(n * 269.5 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Off-canvas launch point for an emitter, deterministic per seed. */
export function assemblySpawnPoint(
  seed: number,
  cellX: number,
  cellY: number,
  w: number,
  h: number,
  from: PlaygroundAssemblyRevealConfig["from"],
): [number, number] {
  const cx0 = w / 2;
  const cy0 = h / 2;
  const diag = Math.hypot(w, h);
  if (from === "radial") {
    let vx = cellX - cx0;
    let vy = cellY - cy0;
    const l = Math.hypot(vx, vy) || 1;
    vx /= l;
    vy /= l;
    return [cx0 + vx * diag * 0.7, cy0 + vy * diag * 0.7];
  }
  if (from === "edge") {
    const adx = Math.abs(cellX - cx0) / Math.max(w, 1);
    const ady = Math.abs(cellY - cy0) / Math.max(h, 1);
    const m = diag * 0.16;
    return adx > ady ? [cellX > cx0 ? w + m : -m, cellY] : [cellX, cellY > cy0 ? h + m : -m];
  }
  const angle = hash2(seed) * Math.PI * 2;
  const rr = diag * (0.62 + 0.32 * hash(seed * 3.3));
  return [cx0 + Math.cos(angle) * rr, cy0 + Math.sin(angle) * rr];
}

export type AssemblyEmitterState = { x: number; y: number; alpha: number; radius: number; visible: boolean };
export type AssemblyEmitterOpts = { flight: number; spread: number; glowSize: number; overshoot: boolean };

/** Glow position/alpha/radius at a progress value. Mirrors the prototype fly-in math. */
export function assemblyEmitterAt(
  o: number,
  spawnX: number,
  spawnY: number,
  cellX: number,
  cellY: number,
  progress: number,
  opts: AssemblyEmitterOpts,
): AssemblyEmitterState {
  const flight = Math.max(0, opts.flight);
  const spread = Math.max(0, opts.spread);
  const start = o * (1 - flight) * spread;
  const arrival = start + flight;
  if (progress < start) {
    return { x: cellX, y: cellY, alpha: 0, radius: 0, visible: false };
  }
  if (progress < arrival) {
    const lt = flight <= 0 ? 1 : clamp01((progress - start) / flight);
    const e = opts.overshoot ? easeOutBack(lt) : easeOutCubic(lt);
    return {
      x: lerp(spawnX, cellX, e),
      y: lerp(spawnY, cellY, e),
      alpha: smoothstep(0, 0.18, lt) * 0.85,
      radius: opts.glowSize * (0.55 + 0.45 * e),
      visible: true,
    };
  }
  const st = clamp01((progress - arrival) / ASSEMBLY_SETTLE);
  const alpha = 1 - st;
  if (alpha <= 0.001) {
    return { x: cellX, y: cellY, alpha: 0, radius: 0, visible: false };
  }
  return { x: cellX, y: cellY, alpha, radius: opts.glowSize * (0.9 + 0.45 * st), visible: true };
}

type Emitter = { cx: number; cy: number; sx: number; sy: number; o: number };

function buildGlowTexel(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = GLOW_TEXEL;
  canvas.height = GLOW_TEXEL;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable for assembly glow sprite.");
  }
  const g = ctx.createRadialGradient(GLOW_TEXEL / 2, GLOW_TEXEL / 2, 0, GLOW_TEXEL / 2, GLOW_TEXEL / 2, GLOW_TEXEL / 2);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(0.32, "rgba(190, 214, 255, 0.55)");
  g.addColorStop(1, "rgba(120, 160, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GLOW_TEXEL, GLOW_TEXEL);
  return canvas;
}

/**
 * Additive overlay drawing the flying glow circles for the assembly reveal. The circles
 * are pre-rendered white glow sprites blitted into a display-sized canvas with "lighter"
 * compositing; the resulting texture is shown by an additive Sprite above the stripes.
 */
export class AssemblyGlowOverlay {
  readonly container: Container;
  private readonly sprite: Sprite;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: Texture;
  private readonly glow: HTMLCanvasElement;
  private emitters: Emitter[] = [];
  private key = "";

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context unavailable for assembly glow overlay.");
    }
    this.ctx = ctx;
    this.glow = buildGlowTexel();
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = "linear";
    this.sprite = new Sprite(this.texture);
    this.sprite.blendMode = "add";
    this.sprite.width = this.canvas.width;
    this.sprite.height = this.canvas.height;
    this.container = new Container();
    this.container.addChild(this.sprite);
    this.container.visible = false;
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.canvas.width === w && this.canvas.height === h) {
      return;
    }
    this.canvas.width = w;
    this.canvas.height = h;
    this.sprite.width = w;
    this.sprite.height = h;
    this.texture.source.update();
    this.key = "";
  }

  /** (Re)build emitters when the grid/dimensions/order/from change. Cheap no-op otherwise. */
  ensure(
    cols: number,
    rows: number,
    indices: Uint8Array | Uint8ClampedArray | Int32Array,
    width: number,
    height: number,
    assembly: PlaygroundAssemblyRevealConfig,
  ): void {
    const nextKey = `${cols}x${rows}:${width}x${height}:${assembly.order}:${assembly.from}`;
    if (nextKey === this.key) {
      return;
    }
    this.key = nextKey;
    const cellW = cols > 0 ? width / cols : width;
    const cellH = rows > 0 ? height / rows : height;
    const content: number[] = [];
    for (let i = 0; i < cols * rows; i++) {
      if ((indices[i] ?? 0) > 0) {
        content.push(i);
      }
    }
    const stride = content.length > ASSEMBLY_GLOW_CAP ? Math.ceil(content.length / ASSEMBLY_GLOW_CAP) : 1;
    this.emitters = [];
    for (let k = 0; k < content.length; k += stride) {
      const i = content[k]!;
      const col = i % cols;
      const row = (i - col) / cols;
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;
      const [sx, sy] = assemblySpawnPoint(i, cx, cy, width, height, assembly.from);
      this.emitters.push({ cx, cy, sx, sy, o: assemblyOrderNorm(col, row, cols, rows, assembly.order) });
    }
  }

  sync(progress: number, assembly: PlaygroundAssemblyRevealConfig): void {
    const { width, height } = this.canvas;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    const previousComposite = this.ctx.globalCompositeOperation;
    this.ctx.globalCompositeOperation = "lighter";
    const opts: AssemblyEmitterOpts = {
      flight: assembly.flight,
      spread: assembly.spread,
      glowSize: assembly.glowSize,
      overshoot: assembly.overshoot,
    };
    for (const e of this.emitters) {
      const s = assemblyEmitterAt(e.o, e.sx, e.sy, e.cx, e.cy, progress, opts);
      if (!s.visible || s.alpha <= 0.001 || s.radius <= 0) {
        continue;
      }

      const flight = Math.max(0, opts.flight);
      const spread = Math.max(0, opts.spread);
      const start = e.o * (1 - flight) * spread;
      const arrival = start + flight;
      const inFlight = progress >= start && progress < arrival;

      if (inFlight && flight > 0) {
        const lt = clamp01((progress - start) / flight);
        for (let g = 3; g >= 1; g--) {
          const lt2 = Math.max(0, lt - g * 0.05);
          const e2 = opts.overshoot ? easeOutBack(lt2) : easeOutCubic(lt2);
          const gx = lerp(e.sx, e.cx, e2);
          const gy = lerp(e.sy, e.cy, e2);
          const gr = s.radius * (1 - g * 0.16);
          const ga = s.alpha * (0.34 - g * 0.085);
          if (gr > 0 && ga > 0.001) {
            this.ctx.globalAlpha = clamp01(ga);
            this.ctx.drawImage(this.glow, gx - gr, gy - gr, gr * 2, gr * 2);
          }
        }
      }

      this.ctx.globalAlpha = clamp01(s.alpha);
      this.ctx.drawImage(this.glow, s.x - s.radius, s.y - s.radius, s.radius * 2, s.radius * 2);
    }
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = previousComposite;
    this.texture.source.update();
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  destroy(): void {
    this.texture.destroy(true);
    this.container.destroy({ children: true });
  }
}

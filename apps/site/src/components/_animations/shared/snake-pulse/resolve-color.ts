// Rasterised so oklch/display-p3 resolve correctly.

import { isDisplayP3Active } from "@/components/pixi/utils/display-p3";

const FALLBACK = "#888";

let ctx: CanvasRenderingContext2D | null = null;

function toInt(computed: string): number {
  const colorSpace = isDisplayP3Active() ? "display-p3" : "srgb";

  if (!ctx) {
    ctx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
      colorSpace,
    });
  }

  if (!ctx) return 0x888888;
  ctx.fillStyle = computed || FALLBACK;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1, { colorSpace }).data;
  return r * 65536 + g * 256 + b;
}

let probeEl: HTMLSpanElement | null = null;

function compute(css: string): string {
  if (!probeEl) {
    probeEl = document.createElement("span");
    probeEl.style.cssText = "position:absolute;visibility:hidden";
    document.body.appendChild(probeEl);
  }
  probeEl.style.color = css;
  return getComputedStyle(probeEl).color;
}

const colorCache = new Map<string, number>();

function resolveCached(css: string): number {
  const key = `${isDisplayP3Active() ? "display-p3" : "srgb"}|${css}`;
  const hit = colorCache.get(key);
  if (hit !== undefined) return hit;

  const value = toInt(compute(css));
  colorCache.set(key, value);
  return value;
}

export function resolveColor(name: string, shade = 900): number {
  return resolveCached(`var(--color-${name}-${shade})`);
}

export function resolveCssColor(css: string): number {
  return resolveCached(css);
}

// Snakes use Figma's Dynamic Accent ramp, which inverts in dark. Step N maps to the
// static shades 900/600/500/400/300 in light, so light rendering is unchanged.
export function resolveDynamicColor(name: string, step: number): number {
  return resolveCached(`var(--color-dynamic-${name}-${step})`);
}

const cssCache = new Map<string, string>();

export function resolveDynamicCss(name: string, step: number): string {
  const key = `${name}|${step}`;
  const hit = cssCache.get(key);
  if (hit !== undefined) return hit;

  const value = compute(`var(--color-dynamic-${name}-${step})`);
  cssCache.set(key, value);
  return value;
}

export function resolveCssRamp(
  src: string,
  tgt: string,
  step: number,
  steps = 32
): string[] {
  const key = `ramp|${src}|${tgt}|${step}|${steps}`;
  const hit = cssRampCache.get(key);
  if (hit) return hit;

  const ramp: string[] = [];
  for (let k = 0; k <= steps; k++) {
    const p = (k / steps) * 100;
    ramp.push(
      compute(
        `color-mix(in oklch, var(--color-dynamic-${tgt}-${step}) ${p}%, var(--color-dynamic-${src}-${step}))`
      )
    );
  }
  cssRampCache.set(key, ramp);
  return ramp;
}

const cssRampCache = new Map<string, string[]>();

const rampCache = new Map<string, number[]>();

// Resolved paints are cached per CSS string, so a theme swap leaves every canvas
// painting the previous palette until the caches are dropped.
if (typeof window !== "undefined") {
  addEventListener("themechange", () => {
    colorCache.clear();
    rampCache.clear();
    cssCache.clear();
    cssRampCache.clear();
  });
}

export function resolveRamp(
  src: string,
  tgt: string,
  step: number,
  steps = 32
): number[] {
  const key = `${src}|${tgt}|${step}|${steps}`;
  const hit = rampCache.get(key);
  if (hit) return hit;

  const ramp: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const p = (k / steps) * 100;
    ramp.push(
      resolveCached(
        `color-mix(in oklch, var(--color-dynamic-${tgt}-${step}) ${p}%, var(--color-dynamic-${src}-${step}))`
      )
    );
  }
  rampCache.set(key, ramp);
  return ramp;
}
